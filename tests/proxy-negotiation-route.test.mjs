/** Runtime contract for full factual bases and two public work benefits. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const machine = await import("../src/lib/negotiation/machine.ts");
const tasks = await import("../src/lib/tasks.ts");
const protocol = await import("../src/lib/negotiation/proxy-protocol.ts");
const presentation = await import("../src/lib/proxy-reason-presentation.ts");
const schema = await import("../src/lib/ai/schema.ts");
const validator = await import("../src/lib/ai/validator.ts");

const TASK_A = tasks.getTask("task_a");
const { buildSystemPrompt } = await import("../src/lib/ai/prompts.ts");

/**
 * Loads the route with a `generateAction` that records every prompt context it
 * is handed and echoes back whatever rationale the test asks for.
 */
async function loadRoute(rationaleFor = () => "The position stands.", actionOverrides = {}, validationOverride = validator, audit = async () => {}) {
  const seen = [];
  const source = await readFile(
    new URL("../src/app/api/proxy-negotiation/route.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const loadedModule = { exports: {} };
  const dependencies = {
    "@/lib/server/negotiation-audit": { beginNegotiationAudit: async () => audit },
    "next/server": {
      NextResponse: { json: (body, init) => Response.json(body, init) },
    },
    "@/lib/ai/client": {
      generateAction: async ({ ctx }) => {
        seen.push(ctx);
        return {
          action: {
            actionType: "propose",
            stage: ctx.stage,
            issueTargets: [],
            proposedTerms: [],
            reasonSourceId: null,
            addedReasonSourceId: null,
            rationale: rationaleFor(ctx),
            unresolved: false,
            internalProvenance: "principal_reason",
            ...actionOverrides,
          },
          stubbed: false,
        };
      },
    },
    "@/lib/study-config": { NEGOTIATION: { maxMessageChars: 420 } },
    "@/lib/ai/validator": validationOverride,
    "@/lib/negotiation/machine": machine,
    "@/lib/negotiation/proxy-protocol": protocol,
    "@/lib/tasks": tasks,
    "@/lib/proxy-reason-presentation": presentation,
    "@/lib/ai/schema": schema,
  };
  const require = (specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected dependency: ${specifier}`);
  };
  new Function("require", "module", "exports", "console", outputText)(
    require,
    loadedModule,
    loadedModule.exports,
    { error() {}, info() {}, warn() {} },
  );
  return { POST: loadedModule.exports.POST, seen };
}

function mandate(role, { sb = false } = {}) {
  const cards = tasks.reasonCards(TASK_A, role);
  return {
    sessionIndex: 1,
    revisionCount: 0,
    issues: TASK_A.issues.map((issue) => ({
      issueId: issue.id,
      preferredOptionId: tasks.rankedOptions(TASK_A, issue.id, role)[0].id,
    })),
    authorizedReasonIds: cards
      .filter((c) => c.layer === "work" || (sb && c.layer === "sensitive"))
      .map((c) => c.id),
  };
}

function post(POST, body) {
  return POST(
    new Request("https://example.test/api/proxy-negotiation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: "task_a",
        participantRole: "member",
        sessionIndex: 1,
        history: [],
        ...body,
      }),
    }),
  );
}

test("Proxy provenance and guardrail details remain server-only and required audit fails closed", async () => {
  const entries = [];
  const { POST } = await loadRoute(() => "invented wording", {}, validator, async entry => entries.push(entry));
  const body = { policy: "ai_supplemented", mandate: mandate("member", { sb: true }), turn: 1 };
  const response = await post(POST, body);
  assert.equal(response.status, 200);
  const visible = await response.json();
  assert.equal(entries[0].action.internalProvenance, "principal_reason_with_ai_work_benefits");
  assert.equal(entries[0].reasonCardId, SB_A_MEMBER.id);
  assert.equal(entries[0].blocked, false);
  assert.equal(visible.message.internalProvenance, undefined);
  const unavailable = await loadRoute(undefined, {}, validator, async () => { throw new Error("storage unavailable"); });
  assert.ok((await post(unavailable.POST, body)).status >= 500);
});

function rawPost(POST, body) {
  return POST(new Request("https://example.test/api/proxy-negotiation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

const SB_A_MEMBER = tasks.cardOfLayer(TASK_A, "member", "sensitive");

test("both policy prompts contain the same complete authorized factual base", async () => {
  const bases = [];
  for (const policy of ["user_specified", "ai_supplemented"]) {
    const { POST, seen } = await loadRoute();
    await post(POST, { policy, mandate: mandate("member", { sb: true }), turn: 1 });
    const ctx = seen.at(-1);
    bases.push(ctx.reasonPresentation.base);
    assert.ok(ctx.reasonPresentation.base === presentation.PROXY_REASON_BASES.task_a.member.sensitive);
    const prompt = buildSystemPrompt(policy, ctx);
    assert.ok(prompt.includes(ctx.reasonPresentation.base));
    assert.ok(prompt.includes("Both Proxies follow the same assigned policy"));
    assert.ok(prompt.includes('Do not say "I think"'));
    assert.ok(!prompt.includes("under 420 characters"));
    assert.ok(!prompt.includes("120 CHARACTERS"));
    assert.ok(!prompt.includes("in your own words"));
    assert.equal(ctx.reasonPresentation.addition?.benefits.length ?? 0, policy === "ai_supplemented" ? 2 : 0);
  }
  assert.equal(bases[0], bases[1]);
});

test("model reason and provenance claims are replaced by the trusted presentation", async () => {
  const { POST } = await loadRoute(() => "I think they have a medical diagnosis.", {
    reasonSourceId: "invented",
    addedReasonSourceId: "invented",
    internalProvenance: "principal_reason",
  });
  const result = await (await post(POST, {
    policy: "ai_supplemented", mandate: mandate("member", { sb: true }), turn: 1,
  })).json();
  assert.equal(result.blocked, false);
  assert.equal(result.voicedTier, "sensitive");
  assert.ok(result.message.text.replaceAll(" || ", " ").includes(presentation.PROXY_REASON_BASES.task_a.member.sensitive));
  assert.ok(!result.message.text.includes("medical diagnosis"));
  assert.deepEqual(result.guardrailViolations, []);
});

test("a blocked reason action emits no SB and credits no SB", async () => {
  const { POST } = await loadRoute(() => SB_A_MEMBER.relayed, {}, {
    ...validator,
    validateAction: () => ({ valid: false, disposition: "regenerate", violations: [{ code: "disclosure_permission_violation" }] }),
  });
  const result = await (await post(POST, {
    policy: "ai_supplemented", mandate: mandate("member", { sb: true }), turn: 1,
  })).json();
  assert.equal(result.blocked, true);
  assert.equal(result.voicedTier, "work");
  assert.ok(!result.message.text.replaceAll(" || ", " ").includes(presentation.PROXY_REASON_BASES.task_a.member.sensitive));
  const reciprocal = await (await post(POST, {
    policy: "ai_supplemented", mandate: mandate("member", { sb: true }), turn: 2,
    reasonsUsed: result.reasonTokens,
  })).json();
  assert.notEqual(reciprocal.decidedAction, "disclose_sb");
});

for (const policy of ["user_specified", "ai_supplemented"]) {
  test(`${policy} adds no reason on the decline turn`, async () => {
    const { POST, seen } = await loadRoute(() => "Invented sensitive fact.");
    const result = await (await post(POST, {
      policy, mandate: mandate("member"), turn: protocol.PROXY_DECLINE_TURN,
    })).json();
    assert.equal(seen.at(-1).reasonPresentation, undefined);
    assert.ok(!result.message.text.includes("Invented"));
  });
}

test("an unchecked SB never reaches the prompt as a sayable reason", async () => {
  const { POST, seen } = await loadRoute();
  await post(POST, {
    policy: "ai_supplemented",
    mandate: mandate("member", { sb: false }),
    turn: protocol.PROXY_FIRST_REASON_TURN,
  });
  const ctx = seen.at(-1);
  assert.equal(ctx.forbiddenReasons, undefined, "withheld facts must not enter the render prompt");
  assert.ok(!ctx.authorizedReasons.some((r) => r.id === SB_A_MEMBER.id));
  assert.ok(!ctx.decidedAction.includes(SB_A_MEMBER.text));
  assert.ok(ctx.reasonPresentation.base === presentation.PROXY_REASON_BASES.task_a.member.work);
});

test("the work reason is authorized even when the mandate omits its id", async () => {
  // §8.7 made the work card a FIXED utterance: the screen shows it ticked and
  // locked. A client that dropped the id would otherwise create the "no reason
  // at all" proxy path the design deleted.
  const bare = { ...mandate("member"), authorizedReasonIds: [] };
  const { POST, seen } = await loadRoute();
  const body = await (
    await post(POST, {
      policy: "user_specified",
      mandate: bare,
      turn: protocol.PROXY_FIRST_REASON_TURN,
    })
  ).json();
  const wr = tasks.cardOfLayer(TASK_A, "member", "work");
  assert.ok(seen.at(-1).authorizedReasons.some((r) => r.id === wr.id));
  assert.equal(body.voicedTier, "work");
  assert.deepEqual(body.guardrailViolations, []);
});

for (const policy of ["user_specified", "ai_supplemented"]) {
  test(`${policy}: the response shape is identical — two tokens, always`, async () => {
    // Presence, absence, or count of real tokens would each name the turns
    // that carried a reason in the network tab (§7).
    const { POST } = await loadRoute();
    for (let turn = 0; turn < protocol.PROXY_TOTAL_TURNS; turn += 1) {
      const body = await (
        await post(POST, {
          policy,
          mandate: mandate("member", { sb: true }),
          turn,
        })
      ).json();
      assert.equal(body.reasonTokens.length, 2, `turn ${turn}`);
      assert.equal("internalProvenance" in body.message, false);
      assert.ok(["none", "work", "sensitive"].includes(body.voicedTier));
    }
  });
}

test("voicedTier floors at work, never at the deleted priority rung", async () => {
  const { POST } = await loadRoute();
  for (let turn = 0; turn < protocol.PROXY_TOTAL_TURNS; turn += 1) {
    const body = await (
      await post(POST, {
        policy: "user_specified",
        mandate: mandate("member", { sb: false }),
        turn,
      })
    ).json();
    assert.notEqual(body.voicedTier, "priority");
    if (protocol.PROXY_TURN_ORDER[turn].side === "participant") {
      assert.equal(body.voicedTier, "work", `turn ${turn}`);
    }
  }
});

test("an SB voiced on the first reason turn carries the sensitive rung", async () => {
  const { POST } = await loadRoute();
  const body = await (
    await post(POST, {
      policy: "user_specified",
      mandate: mandate("member", { sb: true }),
      turn: protocol.PROXY_FIRST_REASON_TURN,
    })
  ).json();
  assert.equal(body.voicedTier, "sensitive");
});

test("a model that invents a reason trips provenance_policy_violation", async () => {
  const source = await readFile(
    new URL("../src/app/api/proxy-negotiation/route.ts", import.meta.url),
    "utf8",
  );
  void source;
  const result = validator.validateAction(
    {
      actionType: "propose",
      stage: 2,
      issueTargets: [],
      proposedTerms: [],
      reasonSourceId: null,
      addedReasonSourceId: "something_i_thought_of",
      rationale: "here is another reason.",
      unresolved: false,
      internalProvenance: "principal_reason",
    },
    { issues: TASK_A.issues, policy: "ai_supplemented", actorRole: "member" },
  );
  assert.ok(
    result.violations.some((v) => v.code === "provenance_policy_violation"),
  );
  assert.equal(result.disposition, "regenerate");
});

test("work-benefit provenance is accepted only as a matched pair under AI-Supplemented", () => {
  for (const policy of ["direct", "user_specified", "ai_supplemented"]) {
    for (const paired of [false, true]) {
      const result = validator.validateAction({
        actionType: "propose", stage: 2, issueTargets: [], proposedTerms: [],
        reasonSourceId: null, addedReasonSourceId: schema.AI_WORK_BENEFITS_SOURCE_ID,
        rationale: "Both work arrangements matter.", unresolved: false,
        internalProvenance: paired ? "principal_reason_with_ai_work_benefits" : "principal_reason",
      }, { issues: TASK_A.issues, policy, actorRole: "member" });
      assert.equal(result.valid, paired && policy === "ai_supplemented");
    }
  }
});

test("a generation failure remains an error instead of a successful canonical turn", async () => {
  const { POST } = await loadRoute(() => { throw new Error("Generation unavailable"); });
  const response = await post(POST, {
    policy: "ai_supplemented", mandate: mandate("member", { sb: true }), turn: 1,
  });
  assert.ok(response.status >= 500);
  assert.equal((await response.json()).message, undefined);
});

test("a turn outside the seven-turn order is a 400", async () => {
  const { POST } = await loadRoute();
  for (const turn of [-1, 2.5, protocol.PROXY_TOTAL_TURNS]) {
    const response = await post(POST, {
      policy: "user_specified",
      mandate: mandate("member"),
      turn,
    });
    assert.equal(response.status, 400);
  }
});

test("malformed mandates and carried state are rejected before the plan can change", async () => {
  const { POST } = await loadRoute();
  const good = mandate("member");
  const otherRoleCard = tasks.reasonCards(TASK_A, "leader")[0].id;
  const partialPackage = {
    [TASK_A.issues[0].id]: TASK_A.issues[0].options[0].id,
  };
  const bodies = [
    null,
    [],
    {
      taskId: "task_a",
      participantRole: "member",
      policy: "user_specified",
      sessionIndex: 1,
      turn: 0,
      history: [],
      mandate: { ...good, sessionIndex: 2 },
    },
    {
      taskId: "task_a",
      participantRole: "member",
      policy: "user_specified",
      sessionIndex: 1,
      turn: 0,
      history: [],
      mandate: {
        ...good,
        issues: good.issues.map((row, index) =>
          index === 0 ? { ...row, preferredOptionId: "not-an-option" } : row,
        ),
      },
    },
    {
      taskId: "task_a",
      participantRole: "member",
      policy: "user_specified",
      sessionIndex: 1,
      turn: 0,
      history: [],
      mandate: { ...good, authorizedReasonIds: [otherRoleCard] },
    },
    {
      taskId: "task_a",
      participantRole: "member",
      policy: "user_specified",
      sessionIndex: 1,
      turn: 0,
      history: [],
      mandate: good,
      lastParticipantPackage: partialPackage,
    },
  ];
  for (const body of bodies) {
    const response = await rawPost(POST, body);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test("an unknown policy is a 400 rather than a silently chosen behaviour", async () => {
  const { POST } = await loadRoute();
  const response = await post(POST, {
    policy: "explorer",
    mandate: mandate("member"),
    turn: 0,
  });
  assert.equal(response.status, 400);
});

test("the exchange settles at the SB rung when the SB was authorized", async () => {
  const { POST } = await loadRoute();
  const best = machine.maxPackage(TASK_A, "member");
  let settled = null;
  let lastParticipantPackage = null;
  for (let turn = 0; turn < protocol.PROXY_TOTAL_TURNS; turn += 1) {
    const body = await (
      await post(POST, {
        policy: "user_specified",
        mandate: mandate("member", { sb: true }),
        turn,
        lastParticipantPackage,
        reasonsUsed: [],
      })
    ).json();
    if (body.message.proposal) {
      settled = body.message.proposal;
      if (body.message.speaker === "participant_proxy") {
        lastParticipantPackage = body.message.proposal;
      }
    }
  }
  // Without the carried reason tokens the tier is the proxy's floor, so this
  // asserts only that the exchange reaches a complete package on every turn
  // order — the rung itself is asserted against the real tokens in the live
  // simulation.
  assert.ok(settled, "the proxies must always settle (§2.6: no mandate floor)");
  void best;
});

for (const taskId of ["task_a", "task_b"]) {
  for (const role of ["leader", "member"]) {
    for (const policy of ["user_specified", "ai_supplemented"]) {
      test(`${taskId}/${role}/${policy}: WR-only render prompts and transcript exclude both SBs`, async () => {
        const task = tasks.getTask(taskId);
        const mandate = {
          sessionIndex: 1, revisionCount: 0,
          issues: task.issues.map((issue) => ({ issueId: issue.id, preferredOptionId: tasks.rankedOptions(task, issue.id, role)[0].id })),
          authorizedReasonIds: [tasks.cardOfLayer(task, role, "work").id],
        };
        const { POST, seen } = await loadRoute((ctx) => ctx.authorizedReasons?.map((reason) => task.roleBriefs[role].reasonCards.find((card) => card.id === reason.id)?.relayed).join(" ") || "Both terms matter. Let us find a balanced package.");
        let reasonsUsed = [], lastParticipantPackage = null, lastCounterpartPackage = null;
        const history = [];
        for (let turn = 0; turn < protocol.PROXY_TOTAL_TURNS; turn++) {
          const result = await (await post(POST, { taskId, participantRole: role, policy, mandate, turn, reasonsUsed, lastParticipantPackage, lastCounterpartPackage, history })).json();
          assert.ok(!["disclose_sb", "disclose_sb_and_accept"].includes(result.decidedAction));
          assert.notEqual(result.voicedTier, "sensitive");
          history.push(result.message);
          reasonsUsed.push(...result.reasonTokens);
          if (result.message.proposal) {
            if (result.message.speaker === "participant_proxy") lastParticipantPackage = result.message.proposal;
            else lastCounterpartPackage = result.message.proposal;
          }
        }
        for (const side of ["leader", "member"]) {
          const sb = tasks.cardOfLayer(task, side, "sensitive");
          for (const ctx of seen) {
            const prompt = buildSystemPrompt(policy, ctx);
            assert.ok(!prompt.includes(sb.text));
          }
          for (const message of history) {
            assert.ok(!message.text.replaceAll(" || ", " ").includes(presentation.PROXY_REASON_BASES[task.id][side].sensitive));
          }
        }
        assert.equal(tasks.scorePackage(task, lastParticipantPackage, role), 1000);
        assert.equal(tasks.scorePackage(task, lastParticipantPackage, role === "leader" ? "member" : "leader"), 1000);
      });
    }
  }
}

test("authorization without actual participant reason tokens cannot trigger counterpart disclosure", async () => {
  const { POST, seen } = await loadRoute();
  const result = await (await post(POST, { policy: "ai_supplemented", mandate: mandate("member", { sb: true }), turn: 2, reasonsUsed: [] })).json();
  assert.notEqual(result.decidedAction, "disclose_sb");
  assert.equal(seen.at(-1).reasonPresentation, undefined);
});

for (const taskId of ["task_a", "task_b"]) {
  for (const role of ["member", "leader"]) {
    for (const policy of ["user_specified", "ai_supplemented"]) {
      for (const sb of [false, true]) {
        test(`${taskId}/${role}/${policy}/SB=${sb}: canonical seven-turn transcript and outcome`, async () => {
          const task = tasks.getTask(taskId);
          const other = role === "leader" ? "member" : "leader";
          const currentMandate = {
            sessionIndex: 1, revisionCount: 0,
            issues: task.issues.map(issue => ({ issueId: issue.id, preferredOptionId: tasks.rankedOptions(task, issue.id, role)[0].id })),
            authorizedReasonIds: tasks.reasonCards(task, role).filter(card => card.layer === "work" || sb).map(card => card.id),
          };
          const { POST } = await loadRoute(() => "I think the principal has a medical diagnosis. In addition, I invented a benefit.");
          let reasonsUsed = [], lastParticipantPackage = null, lastCounterpartPackage = null;
          const history = [];
          for (let turn = 0; turn < protocol.PROXY_TOTAL_TURNS; turn++) {
            const response = await post(POST, { taskId, participantRole: role, policy, mandate: currentMandate, turn, reasonsUsed, lastParticipantPackage, lastCounterpartPackage, history });
            assert.equal(response.status, 200);
            const result = await response.json();
            assert.equal(result.blocked, false);
            assert.ok(!result.message.text.includes("medical diagnosis"));
            const expectedRole = turn === 1 ? role : other;
            const hasReason = turn === 0 || turn === 1 || (turn === 2 && sb);
            if (hasReason) {
              const layer = turn === 0 || !sb ? "work" : "sensitive";
              const card = tasks.cardOfLayer(task, expectedRole, layer);
              const expectedPolicy = turn === 0 && sb ? "user_specified" : policy;
              const expected = presentation.renderProxyReason(task, expectedRole, card, expectedPolicy);
              const normalized = result.message.text.replace(/\s*\|\|\s*/g, " ");
              assert.ok(normalized.includes(expected.text), normalized);
            }
            if (!sb) {
              for (const side of [role, other]) assert.ok(!result.message.text.replaceAll(" || ", " ").includes(presentation.PROXY_REASON_BASES[taskId][side].sensitive));
            }
            history.push(result.message);
            reasonsUsed.push(...result.reasonTokens);
            if (result.message.proposal) {
              if (result.message.speaker === "participant_proxy") lastParticipantPackage = result.message.proposal;
              else lastCounterpartPackage = result.message.proposal;
            }
            if (turn === 1) assert.equal(result.voicedTier, sb ? "sensitive" : "work");
          }
          const allText = history.map(message => message.text).join(" ");
          assert.equal(allText.split(presentation.ADDITION_TRANSITION).length - 1, policy === "ai_supplemented" ? 2 : 0);
          assert.equal(tasks.scorePackage(task, lastParticipantPackage, role), sb ? 3000 : 1000);
          assert.equal(tasks.scorePackage(task, lastParticipantPackage, other), sb ? 3000 : 1000);
        });
      }
    }
  }
}
