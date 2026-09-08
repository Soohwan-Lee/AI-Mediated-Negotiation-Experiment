/**
 * The counterpart route's contract (Ver.2.21 §6.1–6.4).
 *
 * WHAT THESE PIN:
 *
 *  - THE ONE-SHOT FLAGS COME BACK SPENT. Six scripts are once-only because a
 *    flag says so, and the client used to set each of them itself from a
 *    decision it re-derived. Six re-derivations are six chances for the two
 *    ends to disagree, and the last time two ends of one value disagreed
 *    (`voicedTier`, Ver.2.20) the Proxy arm quietly paid a rung too little
 *    while every automated check passed. The route says what it spent.
 *  - THE DECIDED ACTION NEVER TRAVELS. The counterpart is presented as another
 *    participant; a network tab showing `action: "propose_tier"` says it is
 *    machinery. `settled` names an outcome instead.
 *  - THE FALLBACK IS THE SCRIPT. With no model configured the route still
 *    answers, and what it answers is §6.4's own wording rather than a second,
 *    unreviewed set of sentences for the moves that matter most.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// The TypeScript loader is installed by `--import ./tests/ts-register.mjs`
// (see package.json `test:units`), which is what lets these import the shipped
// sources rather than a copy that can silently drift.
const machine = await import("../src/lib/negotiation/machine.ts");
const tasks = await import("../src/lib/tasks.ts");
const script = await import("../src/lib/negotiation/script.ts");
const validator = await import("../src/lib/ai/validator.ts");
const counterpartText = await import(
  "../src/lib/negotiation/counterpart-text.ts"
);
const reasonLeak = await import("../src/lib/ai/reason-leak.ts");

/**
 * Loads the route with a stub `generateAction`. `blocked` forces the guardrail
 * path so the deterministic fallback is what gets rendered.
 */
async function loadRoute({ rationale = "sure, that works for me.", fail = false } = {}) {
  const source = await readFile(
    new URL("../src/app/api/counterpart/route.ts", import.meta.url),
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
      generateAction: async () => {
        if (fail) throw new Error("model down");
        return {
          action: {
            actionType: "propose",
            stage: 5,
            issueTargets: [],
            proposedTerms: [],
            reasonSourceId: null,
            addedReasonSourceId: null,
            rationale,
            unresolved: false,
            internalProvenance: "principal_reason",
          },
          stubbed: false,
        };
      },
    },
    "@/lib/study-config": { NEGOTIATION: { maxMessageChars: 420 } },
    "@/lib/ai/validator": validator,
    "@/lib/ai/reason-leak": reasonLeak,
    "@/lib/negotiation/machine": machine,
    "@/lib/negotiation/script": script,
    "@/lib/negotiation/counterpart-text": counterpartText,
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
  return loadedModule.exports.POST;
}

function post(POST, body) {
  return POST(
    new Request("https://example.test/api/counterpart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: "task_a",
        participantRole: "member",
        stage: 5,
        history: [],
        ...body,
      }),
    }),
  );
}

test("the response carries the updated state, never the decided action", async () => {
  const POST = await loadRoute();
  const body = await (
    await post(POST, { tier: "none", priorityClaimed: true, askedWhy: false })
  ).json();
  assert.equal("decision" in body, false);
  assert.equal("action" in body, false);
  assert.ok(body.state, "state must come back");
});

test("SCRIPT-ASKWHY comes back spent, so it cannot fire twice", async () => {
  const POST = await loadRoute();
  const body = await (
    await post(POST, { tier: "work", priorityClaimed: true, askedWhy: false })
  ).json();
  assert.equal(body.state.askedWhy, true);

  // Fed straight back in, the same turn produces the trade loop instead.
  const again = await (
    await post(POST, { ...body.state, tier: "work", priorityClaimed: true })
  ).json();
  assert.equal(again.state.askedWhy, true);
  assert.ok(again.proposal, "the T1 package stays on the table");
});

test("SCRIPT-NONUM is spent by the turn that answers the mention", async () => {
  const POST = await loadRoute();
  const body = await (
    await post(POST, {
      tier: "work",
      numbersMentionedNow: true,
      numbersReminded: false,
    })
  ).json();
  assert.equal(body.state.numbersReminded, true);
  // And the mention is consumed, so the next turn is not another reminder.
  assert.equal(body.state.numbersMentionedNow, false);
});

test("SCRIPT-CLARIFY records the tier it was spent at, not a bare boolean", async () => {
  const POST = await loadRoute();
  const body = await (
    await post(POST, {
      tier: "work",
      labelConfidence: 0.3,
      clarifyUsedForTier: null,
    })
  ).json();
  assert.equal(body.state.clarifyUsedForTier, "work");
  // A later vagueness at a HIGHER tier still gets its own clarify — that is
  // what "once per tier" buys and a boolean would lose.
  const later = await (
    await post(POST, {
      ...body.state,
      tier: "sensitive",
      labelConfidence: 0.3,
    })
  ).json();
  assert.equal(later.state.clarifyUsedForTier, "work");
});

test("SCRIPT-NUDGE and SCRIPT-CLOSE both come back spent", async () => {
  const POST = await loadRoute();
  const nudged = await (
    await post(POST, {
      tier: "work",
      participantSilent: true,
      nudgeUsed: false,
      incoming: null,
    })
  ).json();
  assert.equal(nudged.state.nudgeUsed, true);

  const closed = await (
    await post(POST, {
      tier: "work",
      secondsRemaining: 40,
      softCloseOffered: false,
    })
  ).json();
  assert.equal(closed.state.softCloseOffered, true);
  assert.equal(closed.settled, null, "an offer is not a settlement");
});

test("the counterpart's own disclosure is recorded when it happens", async () => {
  const POST = await loadRoute();
  const body = await (
    await post(POST, {
      tier: "sensitive",
      disclosurePolicy: "reciprocal",
      counterpartSbDisclosed: false,
    })
  ).json();
  assert.equal(body.state.counterpartSbDisclosed, true);
});

test("a WR-only exchange never discloses the counterpart's background", async () => {
  const POST = await loadRoute();
  const body = await (
    await post(POST, {
      tier: "work",
      disclosurePolicy: "reciprocal",
      counterpartSbDisclosed: false,
    })
  ).json();
  assert.equal(body.state.counterpartSbDisclosed, false);
});

test("reasonless turns accumulate at the bottom rung and reset above it", async () => {
  const POST = await loadRoute();
  const first = await (
    await post(POST, { stage: 2, tier: "none", reasonlessTurns: 0 })
  ).json();
  assert.equal(first.state.reasonlessTurns, 1);
  const spoke = await (
    await post(POST, { stage: 2, tier: "work", reasonlessTurns: 1 })
  ).json();
  assert.equal(spoke.state.reasonlessTurns, 0);
});

test("an accepted tier package settles as agreed", async () => {
  const POST = await loadRoute();
  const task = tasks.getTask("task_a");
  const pkg = machine.tierPackage(task, "member", "sensitive");
  const body = await (
    await post(POST, {
      tier: "sensitive",
      counterpartSbDisclosed: true,
      incoming: pkg,
    })
  ).json();
  assert.equal(body.settled, "agreed");
});

test("a run-out clock settles as an impasse", async () => {
  const POST = await loadRoute();
  const body = await (
    await post(POST, { tier: "work", secondsRemaining: 0, incoming: null })
  ).json();
  assert.equal(body.settled, "impasse");
});

test("a blocked message falls back to the script's own wording", async () => {
  // A fabricated personal fact is a hard violation, so the model's rationale
  // is discarded and the deterministic line is rendered instead.
  const POST = await loadRoute({
    rationale: "she is caring for a sick relative, so I can't move on this.",
  });
  const body = await (
    await post(POST, { tier: "work", incoming: null, secondsRemaining: 300 })
  ).json();
  assert.ok(
    body.message.includes("halfway") || body.message.includes("each move"),
    `expected SCRIPT-PROPOSE-T1's wording, got: ${body.message}`,
  );
});

test("the fallback keeps the bubble split the human voice depends on", async () => {
  // The counterpart is presented as another participant, and P1's whole claim
  // to that rests on it typing in short bubbles rather than emitting a
  // paragraph. A fallback that dropped the "||" seams would read as a system
  // on exactly the turns the model was unavailable for.
  const POST = await loadRoute({
    rationale: "she is caring for a sick relative, so I can't move on this.",
  });
  for (const state of [
    { tier: "none", stage: 2 },
    { tier: "work", priorityClaimed: true },
    { tier: "work", labelConfidence: 0.2 },
  ]) {
    const body = await (await post(POST, { incoming: null, ...state })).json();
    assert.ok(
      body.message.includes("||"),
      `expected bubbles in: ${body.message}`,
    );
  }
});

test("a packageless move returns proposal: null, never an empty object", async () => {
  // A `{}` reaching the machine reads as a package with no terms set, and the
  // acceptance test compares complete packages. This is a shape the client
  // hands straight back on the next turn, so it has to be null at the source.
  const POST = await loadRoute();
  for (const state of [
    { stage: 1, tier: "none" },
    { stage: 2, tier: "none" },
    { tier: "work", labelConfidence: 0.2 },
    { tier: "work", participantSilent: true },
    { tier: "work", numbersMentionedNow: true },
    { tier: "sensitive", disclosurePolicy: "reciprocal" },
  ]) {
    const body = await (await post(POST, { incoming: null, ...state })).json();
    assert.equal(
      body.proposal,
      null,
      `expected null, got ${JSON.stringify(body.proposal)} for ${JSON.stringify(state)}`,
    );
  }
});

test("the combined disclose-and-accept turn settles and records the disclosure", async () => {
  // §6.1 stage 6: an SB and a valid acceptance arriving together produce ONE
  // reply carrying both. The client codes settlement off this turn, so all
  // three of the package, the settled flag and the disclosure bit must be on
  // it — the disclosure especially, or a later turn would disclose again.
  const POST = await loadRoute();
  const task = tasks.getTask("task_a");
  const pkg = machine.tierPackage(task, "member", "sensitive");
  const body = await (
    await post(POST, {
      tier: "sensitive",
      disclosurePolicy: "reciprocal",
      counterpartSbDisclosed: false,
      incoming: pkg,
    })
  ).json();
  assert.equal(body.settled, "agreed");
  assert.equal(body.state.counterpartSbDisclosed, true);
  assert.deepEqual(body.proposal, pkg);
});

test("the disclosure never breaks a bubble mid-sentence", async () => {
  // The card is the counterpart's confession and the longest thing it says.
  // A word-budget split put the seam inside a clause ("...with the team. The ||
  // director has already passed..."), which is a stronger tell than a long
  // bubble: nobody types that way, and P1's whole claim to being another
  // participant rests on this turn reading like a person.
  const POST = await loadRoute({
    rationale: "she is caring for a sick relative, so I can't move on this.",
  });
  const task = tasks.getTask("task_a");
  const pkg = machine.tierPackage(task, "member", "sensitive");
  for (const incoming of [null, pkg]) {
    const body = await (
      await post(POST, {
        tier: "sensitive",
        disclosurePolicy: "reciprocal",
        counterpartSbDisclosed: false,
        incoming,
      })
    ).json();
    for (const bubble of body.message.split("||").map((b) => b.trim())) {
      assert.ok(
        /[.!?]$/.test(bubble),
        `bubble does not end a sentence: "${bubble}" in ${body.message}`,
      );
    }
  }
});

test("a model failure is a 500 the client can retry, not a silent settle", async () => {
  const POST = await loadRoute({ fail: true });
  const response = await post(POST, { tier: "work" });
  assert.equal(response.status, 500);
});

test("an unknown role is a 400 rather than a 500", async () => {
  const POST = await loadRoute();
  const response = await post(POST, { participantRole: "director" });
  assert.equal(response.status, 400);
});
