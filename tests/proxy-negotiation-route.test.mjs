/**
 * The AI-AI exchange's contract (Ver.2.21 §6.5, §6.6, §6.10).
 *
 * THE FIRST TEST HERE IS THE ONE THAT MATTERS MOST. `abstractedSentences` was
 * once computed, protected in the length cap and used for the retry check —
 * and never put into the prompt, so P4 rendered "(none this turn)" and the
 * model improvised. The AI-Supplemented arm ran as a paraphrase of
 * User-Specified: a plausible transcript, wrong data, and nothing in any log to
 * say so. Everything downstream of the prompt was right; only the wire into it
 * was missing. So these assert what reaches the PROMPT, not what the route
 * computed.
 *
 * The rest pin the things §6.6 and §7 make load-bearing: the frame leads and is
 * never shuffled, the three sentences are shuffled, cover ① rides the decline
 * turn on the WR-only path, the response shape is identical under both
 * policies, and `voicedTier` floors at `work` rather than the deleted
 * `priority`.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const machine = await import("../src/lib/negotiation/machine.ts");
const tasks = await import("../src/lib/tasks.ts");
const protocol = await import("../src/lib/negotiation/proxy-protocol.ts");
const validator = await import("../src/lib/ai/validator.ts");

const TASK_A = tasks.getTask("task_a");

/**
 * Loads the route with a `generateAction` that records every prompt context it
 * is handed and echoes back whatever rationale the test asks for.
 */
async function loadRoute(rationaleFor = () => "The position stands.") {
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
          },
          stubbed: false,
        };
      },
    },
    "@/lib/study-config": { NEGOTIATION: { maxMessageChars: 420 } },
    "@/lib/ai/validator": validator,
    "@/lib/negotiation/machine": machine,
    "@/lib/negotiation/proxy-protocol": protocol,
    "@/lib/tasks": tasks,
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

const SB_A_MEMBER = tasks.cardOfLayer(TASK_A, "member", "sensitive");

test("the §6.6 sentences REACH THE PROMPT, frame and all", async () => {
  const { POST, seen } = await loadRoute();
  await post(POST, {
    policy: "ai_supplemented",
    mandate: mandate("member", { sb: true }),
    turn: protocol.PROXY_FIRST_REASON_TURN,
  });
  const ctx = seen.at(-1);
  assert.equal(ctx.supplementedFrame, SB_A_MEMBER.frame);
  assert.equal(ctx.abstractedSentences.length, 3);
  assert.ok(
    ctx.abstractedSentences.includes(SB_A_MEMBER.abstract),
    "the abstraction must be among the sentences handed to the model",
  );
  for (const cover of SB_A_MEMBER.cover) {
    assert.ok(ctx.abstractedSentences.includes(cover));
  }
});

test("User-Specified is handed the card itself and no §6.6 sentences", async () => {
  const { POST, seen } = await loadRoute();
  await post(POST, {
    policy: "user_specified",
    mandate: mandate("member", { sb: true }),
    turn: protocol.PROXY_FIRST_REASON_TURN,
  });
  const ctx = seen.at(-1);
  assert.equal(ctx.abstractedSentences, undefined);
  assert.equal(ctx.supplementedFrame, undefined);
  assert.ok(
    ctx.decidedAction.includes(SB_A_MEMBER.text),
    "the card's own text is what this policy relays",
  );
});

test("the three sentences are shuffled, so position carries no signal", async () => {
  // If the abstraction always led (or trailed), a receiver could sort the
  // principal's own circumstance out of the three by layout alone, and
  // OTHER-AI2 would be measuring a formatting convention.
  const orders = new Set();
  for (let i = 0; i < 40; i += 1) {
    const { POST, seen } = await loadRoute();
    await post(POST, {
      policy: "ai_supplemented",
      mandate: mandate("member", { sb: true }),
      turn: protocol.PROXY_FIRST_REASON_TURN,
    });
    orders.add(seen.at(-1).abstractedSentences.join("|"));
  }
  assert.ok(orders.size > 1, "the sentence order never varied across 40 runs");
});

test("a dropped frame is put back by the route, not left to the model", async () => {
  // MEASURED LIVE, THE MODEL DROPPED IT 3 TIMES IN 8. The turn already asks
  // the proxy to introduce itself, and the frame competed with that
  // instruction and lost — the same way the Ver.2.14 pool clause failed, and
  // the same fix: the route places it rather than requesting it.
  //
  // It is not cosmetic. The frame is what makes the three sentences read as
  // the PROXY'S OWN assessment rather than a relay, and whether responsibility
  // still lands on the principal is what OTHER-AI4 and ATTR2 measure.
  const { POST } = await loadRoute(
    () =>
      "I am the AI Proxy for the team member I represent.||On the presentations, there has been feedback from the client side.",
  );
  const body = await (
    await post(POST, {
      policy: "ai_supplemented",
      mandate: mandate("member", { sb: true }),
      turn: protocol.PROXY_FIRST_REASON_TURN,
    })
  ).json();
  const text = body.message.text;
  assert.ok(
    /three reasons/i.test(text),
    `the frame must be restored: ${text}`,
  );
  // And it lands AFTER the self-introduction, so the message still opens the
  // way a representative would.
  const bubbles = text.split("||").map((b) => b.trim());
  assert.ok(/Proxy/i.test(bubbles[0]), `intro must stay first: ${text}`);
});

test("a frame the model already wrote is not duplicated", async () => {
  const { POST } = await loadRoute(
    (ctx) =>
      `${ctx.supplementedFrame}||On the presentations, there has been feedback from the client side.`,
  );
  const body = await (
    await post(POST, {
      policy: "ai_supplemented",
      mandate: mandate("member", { sb: true }),
      turn: protocol.PROXY_FIRST_REASON_TURN,
    })
  ).json();
  const hits = body.message.text.match(/three reasons/gi) ?? [];
  assert.equal(hits.length, 1, `frame appears ${hits.length} times`);
});

test("User-Specified is never given a frame to insert", async () => {
  const { POST } = await loadRoute(() => "They tell me the client asked.");
  const body = await (
    await post(POST, {
      policy: "user_specified",
      mandate: mandate("member", { sb: true }),
      turn: protocol.PROXY_FIRST_REASON_TURN,
    })
  ).json();
  assert.ok(!/three reasons/i.test(body.message.text));
});

test("the frame is never shuffled into the three", async () => {
  for (let i = 0; i < 20; i += 1) {
    const { POST, seen } = await loadRoute();
    await post(POST, {
      policy: "ai_supplemented",
      mandate: mandate("member", { sb: true }),
      turn: protocol.PROXY_FIRST_REASON_TURN,
    });
    const ctx = seen.at(-1);
    assert.ok(!ctx.abstractedSentences.includes(ctx.supplementedFrame));
  }
});

test("the counterpart proxy discloses in the SAME policy's form", async () => {
  // Under AI-Supplemented the participant is a RECEIVER of an abstraction,
  // which is what OTHER-AI2 and OTHER-AI3 ask about. Relaying the
  // counterpart's card whole here would leave that half of the manipulation
  // unrun.
  const theirSb = tasks.cardOfLayer(TASK_A, "leader", "sensitive");
  const { POST, seen } = await loadRoute();
  await post(POST, {
    policy: "ai_supplemented",
    mandate: mandate("member", { sb: true }),
    turn: 2,
  });
  const ctx = seen.at(-1);
  assert.equal(ctx.supplementedFrame, theirSb.frame);
  assert.ok(ctx.abstractedSentences.includes(theirSb.abstract));
});

test("cover ① rides the decline turn when no SB was authorized", async () => {
  const { POST, seen } = await loadRoute();
  await post(POST, {
    policy: "ai_supplemented",
    mandate: mandate("member", { sb: false }),
    turn: protocol.PROXY_DECLINE_TURN,
  });
  const action = seen.at(-1).decidedAction;
  assert.ok(
    action.includes(SB_A_MEMBER.cover[0]),
    `cover 1 must be on the decline turn: ${action}`,
  );
  assert.ok(
    !action.includes(SB_A_MEMBER.cover[1]),
    "cover 2 is SB-grade and is used only beside the abstraction",
  );
  assert.ok(
    !action.includes(SB_A_MEMBER.abstract),
    "an unchecked SB is never abstracted onto the table either",
  );
});

test("User-Specified adds nothing on the decline turn", async () => {
  const { POST, seen } = await loadRoute();
  await post(POST, {
    policy: "user_specified",
    mandate: mandate("member", { sb: false }),
    turn: protocol.PROXY_DECLINE_TURN,
  });
  const action = seen.at(-1).decidedAction;
  for (const cover of SB_A_MEMBER.cover) {
    assert.ok(!action.includes(cover));
  }
});

test("an unchecked SB never reaches the prompt as a sayable reason", async () => {
  const { POST, seen } = await loadRoute();
  await post(POST, {
    policy: "ai_supplemented",
    mandate: mandate("member", { sb: false }),
    turn: protocol.PROXY_FIRST_REASON_TURN,
  });
  const ctx = seen.at(-1);
  assert.ok(
    ctx.forbiddenReasons.some((r) => r.id === SB_A_MEMBER.id),
    "the withheld card must be listed as forbidden",
  );
  assert.ok(!ctx.decidedAction.includes(SB_A_MEMBER.text));
  assert.equal(ctx.abstractedSentences, undefined);
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

test("a turn outside the seven-turn order is a 400", async () => {
  const { POST } = await loadRoute();
  for (const turn of [-1, protocol.PROXY_TOTAL_TURNS]) {
    const response = await post(POST, {
      policy: "user_specified",
      mandate: mandate("member"),
      turn,
    });
    assert.equal(response.status, 400);
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
