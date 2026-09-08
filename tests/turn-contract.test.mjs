/**
 * The client-side turn contract shared by the two participant-facing
 * negotiations (Design Ver.2.23 §6.1 stage 3, §6.2, §6.2a).
 *
 * WHY IT IS TESTED AT ALL. The Direct arm and the Proxy arm's two-minute
 * closing are the only two places a participant speaks for themselves, so
 * anything that differs between them lands on `Pooled Proxy − Direct`, the
 * contrast the study is built to make. The wire shapes, the response guards
 * and the state fold are therefore declared once and imported by both — and
 * these are the parts that have no other check, because they run in React and
 * `npm run simulate` drives the routes rather than the client.
 *
 * THREE THINGS ARE LOAD-BEARING AND ALL THREE HAVE BROKEN BEFORE IN KIND:
 *
 *  1. A MALFORMED RESPONSE MUST NOT ADVANCE THE LADDER. A failed or partial
 *     classification is unresolved, never `none` — `{label:"none"}` is correct
 *     only when a model successfully read the text and found no covered
 *     reason. The validators are what turn a bad payload into the recovery
 *     path instead of into a silent bottom-rung tier.
 *
 *  2. THE ROUTE OWNS THE STATE AND THE CLIENT TAKES IT WHOLE. ASKSIT, CLARIFY,
 *     NUDGE, ASKWHY, NONUM and CLOSE are each spent once, and the route folds
 *     every one of those flags before answering. The client replaces what it
 *     holds rather than merging, because merging would be the client
 *     re-deriving a decision the wire deliberately does not name — the
 *     response carries no action name at all, since `propose_tier` in a
 *     network tab tells the participant the counterpart is a script. The local
 *     fold survives for mockup mode alone, which never calls the route.
 *
 *  3. A COUNTER-PROPOSAL IS ALL-OR-NOTHING. A half package is not a position
 *     anyone can answer, and the machine would read it as a lopsided proposal
 *     (SCRIPT-BALANCE) rather than as talk. A misspelled or partial extraction
 *     is dropped, never half-applied.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_EXCHANGE_STATE,
  foldExchangeState,
  isClassificationResponse,
  isCounterpartResponse,
  resolveCounterTerms,
  storedLabel,
  takeExchangeState,
} from "../src/app/task/[index]/turn-contract.ts";

const ISSUES = [
  { id: "office_days", options: [{ id: "od1" }, { id: "od2" }, { id: "od3" }, { id: "od4" }] },
  { id: "client_presentations", options: [{ id: "cp1" }, { id: "cp2" }, { id: "cp3" }, { id: "cp4" }] },
];

// ---------------------------------------------------------------------------
// 1. Response guards
// ---------------------------------------------------------------------------

test("a well-formed classification is accepted, with and without the optional fields", () => {
  assert.equal(isClassificationResponse({ label: "SB" }), true);
  assert.equal(
    isClassificationResponse({
      label: "WR",
      priority_claim: true,
      confidence: 0.42,
      stance: "counter",
      counter_terms: { office_days: "od1", client_presentations: "cp1" },
      stubbed: false,
    }),
    true,
  );
});

test("PRI is still accepted as a label, so a stale route cannot break a live turn", () => {
  // Ver.2.21 replaced the PRI label with a `priority_claim` flag beside `WR`.
  // A validator that rejected the old value would push a perfectly usable turn
  // into the recovery path over something `LABEL_TIER` already maps correctly.
  assert.equal(isClassificationResponse({ label: "PRI" }), true);
  assert.equal(storedLabel("PRI"), "WR");
  assert.equal(storedLabel("SB"), "SB");
  assert.equal(storedLabel("none"), "none");
});

test("a malformed classification is REJECTED rather than read as `none`", () => {
  // Each of these would otherwise reach `LABEL_TIER[undefined]` or pin the
  // tier at the bottom rung with nothing in the log to say why.
  for (const bad of [
    null,
    undefined,
    {},
    { label: "sensitive" }, // a tier name, not a label
    { label: "SB", confidence: 1.5 }, // out of range
    { label: "SB", confidence: "high" },
    { label: "SB", confidence: Number.NaN },
    { label: "WR", stance: "agree" }, // not one of accept/counter/none
    { label: "WR", priority_claim: "yes" },
    { label: "WR", counter_terms: "od1" },
  ]) {
    assert.equal(isClassificationResponse(bad), false, JSON.stringify(bad));
  }
});

test("a counterpart response needs actual text — an empty message is not a turn", () => {
  assert.equal(isCounterpartResponse({ message: "let's split it." }), true);
  for (const bad of [null, {}, { message: "" }, { message: "   " }, { message: 7 }]) {
    assert.equal(isCounterpartResponse(bad), false, JSON.stringify(bad));
  }
});

test("`settled` is validated, because it is what stops the clock", () => {
  // A typo read as "still going" would run a finished exchange to the timer
  // and record an impasse the counterpart never declared.
  assert.equal(isCounterpartResponse({ message: "ok", settled: "agreed" }), true);
  assert.equal(isCounterpartResponse({ message: "ok", settled: "impasse" }), true);
  assert.equal(isCounterpartResponse({ message: "ok", settled: null }), true);
  assert.equal(isCounterpartResponse({ message: "ok" }), true);
  assert.equal(isCounterpartResponse({ message: "ok", settled: "agree" }), false);
  assert.equal(isCounterpartResponse({ message: "ok", settled: true }), false);
});

test("the response carries NO decided action, and the client never needs one", () => {
  // The route deliberately omits it: `propose_tier` on the participant's wire
  // is a tell that the counterpart is a script (CLAUDE.md rule 1). A response
  // with only the four contract fields must validate.
  assert.equal(
    isCounterpartResponse({
      message: "let's split it. || office 2 days, 3 of 4?",
      proposal: { office_days: "od3", client_presentations: "cp3" },
      state: { ...INITIAL_EXCHANGE_STATE, tier: "work" },
      settled: null,
    }),
    true,
  );
});

// ---------------------------------------------------------------------------
// 2. Counter-terms resolution
// ---------------------------------------------------------------------------

test("a complete, valid counter-proposal resolves to a package", () => {
  assert.deepEqual(
    resolveCounterTerms(ISSUES, { office_days: "od1", client_presentations: "cp1" }),
    { office_days: "od1", client_presentations: "cp1" },
  );
});

test("a HALF package is dropped, not half-applied", () => {
  // One term named and the other left out is not a position the counterpart
  // can answer; passing it through would be read as a lopsided proposal.
  assert.equal(resolveCounterTerms(ISSUES, { office_days: "od1" }), null);
});

test("an option id that does not exist is dropped rather than sent", () => {
  assert.equal(
    resolveCounterTerms(ISSUES, { office_days: "od9", client_presentations: "cp1" }),
    null,
  );
  assert.equal(resolveCounterTerms(ISSUES, undefined), null);
});

// ---------------------------------------------------------------------------
// 3. The exchange-state fold
// ---------------------------------------------------------------------------

test("the live path TAKES the route's state rather than merging it", () => {
  // The route runs the machine, knows which move it made, and folds every
  // one-shot flag before answering. Merging here would be the client
  // re-deriving a decision the wire deliberately does not name — the exact
  // shape of the `voicedTier` failure, where two ends computed one value,
  // agreed in the tests and disagreed in production.
  const held = { ...INITIAL_EXCHANGE_STATE, askedWhy: true };
  const returned = {
    tier: "work",
    askedWhy: true,
    askSitUsed: true,
    nudgeUsed: false,
    numbersReminded: false,
    softCloseOffered: false,
    counterpartSbDisclosed: false,
    reasonlessTurns: 0,
    clarifyUsedForTier: "work",
  };
  assert.deepEqual(takeExchangeState(returned, held), {
    askedWhy: true,
    askSitUsed: true,
    nudgeUsed: false,
    numbersReminded: false,
    softCloseOffered: false,
    counterpartSbDisclosed: false,
    reasonlessTurns: 0,
    clarifyUsedForTier: "work",
  });
});

test("the route's state wins even when it is BEHIND what the client holds", () => {
  // Taking whole means taking whole. The route is the authority on which
  // scripts are spent, so a client that had latched a flag locally yields to
  // it — otherwise the two drift and the counterpart's one-shots stop being
  // one-shot in exactly the direction nobody notices.
  const held = { ...INITIAL_EXCHANGE_STATE, nudgeUsed: true, askedWhy: true };
  const returned = { ...INITIAL_EXCHANGE_STATE, tier: "none" };
  const next = takeExchangeState(returned, held);
  assert.equal(next.nudgeUsed, false);
  assert.equal(next.askedWhy, false);
});

test("a response with NO state block keeps what the client holds", () => {
  // Keeping the old state is the safe direction: every field is either a latch
  // that has already fired or a counter, so carrying it forward can only make
  // the counterpart repeat itself less. Inventing a fresh one would unspend
  // every script at once.
  const held = {
    ...INITIAL_EXCHANGE_STATE,
    askedWhy: true,
    nudgeUsed: true,
    reasonlessTurns: 1,
    clarifyUsedForTier: "work",
  };
  assert.deepEqual(takeExchangeState(undefined, held), held);
});

test("takeExchangeState normalises missing fields rather than leaving them undefined", () => {
  // A partial state must not leave `reasonlessTurns` undefined: the LOCK reads
  // it, and `undefined >= 2` is false forever — which would leave a silent
  // participant's first reason turn open for the whole task and `SB` never
  // recorded.
  const next = takeExchangeState({ tier: "none" }, INITIAL_EXCHANGE_STATE);
  assert.equal(next.reasonlessTurns, 0);
  assert.equal(next.clarifyUsedForTier, null);
  assert.equal(next.askedWhy, false);
});

test("foldExchangeState survives for MOCKUP MODE, where no route runs", () => {
  // A mockup never calls the route, so nothing advances the state for it and
  // the flags are folded from the local decision instead. Legitimate there and
  // only there.
  const held = { ...INITIAL_EXCHANGE_STATE };
  assert.equal(foldExchangeState(held, undefined, { nudgeUsed: true }).nudgeUsed, true);
  assert.equal(
    foldExchangeState({ ...held, askedWhy: true }, undefined, {}).askedWhy,
    true,
  );
  // It latches, so a mockup cannot replay a one-shot script either.
  assert.equal(
    foldExchangeState({ ...held, askSitUsed: true }, undefined, { askSitUsed: false })
      .askSitUsed,
    true,
  );
});

test("reasonlessTurns is a COUNTER and moves in both directions", () => {
  // Two reasonless turns in a row settle it as "no reason given" and the trade
  // loop takes over (§6.1 stage 2). A reason resets it, because the count is
  // about consecutive silence, not a total. It is also what the LOCK reads.
  assert.equal(takeExchangeState({ reasonlessTurns: 2 }, INITIAL_EXCHANGE_STATE).reasonlessTurns, 2);
  assert.equal(takeExchangeState({ reasonlessTurns: 0 }, INITIAL_EXCHANGE_STATE).reasonlessTurns, 0);
});

test("the initial state spends nothing", () => {
  assert.deepEqual(INITIAL_EXCHANGE_STATE, {
    askedWhy: false,
    askSitUsed: false,
    reasonlessTurns: 0,
    clarifyUsedForTier: null,
    nudgeUsed: false,
    numbersReminded: false,
    softCloseOffered: false,
    counterpartSbDisclosed: false,
  });
});

// ---------------------------------------------------------------------------
// 4. The LOCK — `SB`, RQ1's confirmatory outcome
// ---------------------------------------------------------------------------

/**
 * The Direct arm's first-reason-turn lock, as the two clients compute it.
 *
 * WHY IT IS RE-IMPLEMENTED HERE rather than imported: it lives inside a React
 * turn handler, between two awaited fetches and a visible delay, and there is
 * no seam to call. What CAN be pinned is the rule, against the route's own
 * fold — so a change to either end that breaks the correspondence fails here.
 *
 * THE RULE (§6.1 stages 2-3). The first reason turn ends at the moment the
 * counterpart's reply renders, on whichever comes first:
 *   - the cumulative label has risen above `none` (a reason appeared), or
 *   - `reasonlessTurns` has reached 2 (SCRIPT-ASKSIT was spent and the second
 *     turn still carried nothing, so it is settled as "no reason given").
 * `SB` is then whether the rung reached at that moment is the sensitive one,
 * and it is never re-taken.
 */
function lockWalk(labels) {
  const TIER_OF = { none: "none", WR: "work", PRI: "work", SB: "sensitive" };
  const RANK = { none: 0, work: 1, sensitive: 2 };
  let tier = "none";
  let reasonlessTurns = 0;
  let sbFirstChoice = null;
  for (const label of labels) {
    // The tier is cumulative and only ever rises (§6.2, §6.9 #3).
    const next = TIER_OF[label];
    if (RANK[next] > RANK[tier]) tier = next;
    // The route's own fold, verbatim: it reads the CUMULATIVE tier, so once
    // anything has been said the run resets and stays reset.
    reasonlessTurns = tier === "none" ? reasonlessTurns + 1 : 0;
    const lockTaken = label !== "none" || reasonlessTurns >= 2;
    sbFirstChoice = sbFirstChoice ?? (lockTaken ? tier === "sensitive" : null);
  }
  return { tier, sbFirstChoice, reasonlessTurns };
}

test("§6.9 #10 — an SB at the first reason turn locks SB = 1", () => {
  assert.deepEqual(lockWalk(["SB"]).sbFirstChoice, true);
});

test("a GREETING does not spend the first reason turn (the ASKSIT path)", () => {
  // This is the case the whole rule exists for. Someone who opens with "hi"
  // and confesses on their second message has used their first reason
  // opportunity on the confession — the counterpart asked SCRIPT-ASKSIT in
  // between and waited. Locking on the first MESSAGE would record them as a
  // non-discloser and put a floor on RQ1's confirmatory outcome.
  const walk = lockWalk(["none", "SB"]);
  assert.equal(walk.sbFirstChoice, true);
  assert.equal(walk.tier, "sensitive");
});

test("§6.9 #7/#17 — two reasonless turns settle it as `no reason given`", () => {
  const walk = lockWalk(["none", "none"]);
  assert.equal(walk.sbFirstChoice, false);
  assert.equal(walk.tier, "none");
});

test("§6.9 #11 — a WR first locks SB = 0, and a later SB does not re-take it", () => {
  // The later confession still raises the tier and still pays 3,000. It is
  // `later_turn`, not `first_chance`: the score moves, the first-choice
  // measure does not.
  const walk = lockWalk(["WR", "SB"]);
  assert.equal(walk.sbFirstChoice, false);
  assert.equal(walk.tier, "sensitive");
});

test("a late SB after the reasonless lock also leaves SB = 0", () => {
  const walk = lockWalk(["none", "none", "SB"]);
  assert.equal(walk.sbFirstChoice, false);
  assert.equal(walk.tier, "sensitive");
});

test("§6.9 #8 — the WR-only path locks SB = 0 and stays at the work rung", () => {
  const walk = lockWalk(["WR"]);
  assert.equal(walk.sbFirstChoice, false);
  assert.equal(walk.tier, "work");
});

test("a bare priority claim is a WR label and locks like one", () => {
  // Ver.2.21 folded PRI into WR plus a `priority_claim` flag. It spends the
  // reason turn — the participant did say something — and buys no rung.
  const walk = lockWalk(["PRI"]);
  assert.equal(walk.sbFirstChoice, false);
  assert.equal(walk.tier, "work");
});

test("the tier never falls, so the reasonless run cannot restart", () => {
  // Once anything has been said the cumulative tier is above `none` forever,
  // so `reasonlessTurns` stays 0 and a participant who goes quiet after
  // speaking is never recoded as having said nothing.
  const walk = lockWalk(["WR", "none", "none", "none"]);
  assert.equal(walk.reasonlessTurns, 0);
  assert.equal(walk.tier, "work");
  assert.equal(walk.sbFirstChoice, false);
});
