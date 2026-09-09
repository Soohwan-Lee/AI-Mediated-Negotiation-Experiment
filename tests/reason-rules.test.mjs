/**
 * The Ver.2.23 justification ladder, tested against the shipped state machine
 * and validator (imported directly via tests/ts-register.mjs).
 *
 * WHAT IS LOAD-BEARING HERE (Design §3.3, §6.2, §6.4, §6.9):
 *
 *  1. THE LADDER HAS TWO RUNGS, SYMMETRIC, in all four task × role cells.
 *     Nothing voiced, the work reason, and a bare priority claim all settle at
 *     1,000 / 1,000 (joint 2,000); the sensitive background settles at
 *     3,000 / 3,000 (joint 6,000, the global maximum). Impasse pays NOTHING —
 *     0 each, joint 0 — so every agreement beats walking away and no one can
 *     use a threat to break off as a card worth points.
 *
 *  2. SB VOICING IS THE ONLY BOTTLENECK. The counterpart proposes at its own
 *     rung (SCRIPT-PROPOSE-T{1,2}), so a participant does not need negotiation
 *     skill to reach the maximum, only the disclosure. And the maximum is NOT
 *     reachable by skill alone: an over-ask without the SB is rebalanced to the
 *     tier package (SCRIPT-BALANCE), never accepted — and nor is an UNDER-ask,
 *     so over-conceding cannot drag the outcome below the rung that was paid
 *     for.
 *
 *  3. THE ONE-SHOT QUESTIONS. SCRIPT-ASKSIT once when the first message
 *     carries no reason, SCRIPT-ASKWHY once after a priority claim,
 *     SCRIPT-CLARIFY once PER TIER when the classifier is unsure,
 *     SCRIPT-NUDGE once on silence. Each turns a failure the participant
 *     cannot see into a question they can answer.
 *
 *  4. RECIPROCAL DISCLOSURE IN DIRECT. The counterpart's own SB comes out only
 *     after the participant's. A WR-only Direct session never hears it, which
 *     is what makes `SB` a disclosure decision rather than a response to one.
 *     Proxy observation keeps the fixed schedule.
 *
 *  5. SCRIPT AND MACHINE AGREE. The mockup's ideal trajectory settles at
 *     exactly the package the machine would accept, in every cell.
 *
 *  6. THE PROXY'S FLOOR IS T1, THE SAME AS DIRECT'S. Ver.2.21's 12th
 *     correction removed the priority rung, and with it the mode asymmetry the
 *     old proxy floor put into Points and JOINT.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const { compactChatBubbles } = await import("../src/lib/ai/validator.ts");

test("chat compaction preserves disclosure facts and order", () => {
  const parts = ["I appreciate that.", "I planned with too few people.", "It only works if you stay four days.", "I have not told the director."];
  const compact = compactChatBubbles(parts.join(" || "));
  assert.equal(compact.split("||").length, 3);
  assert.equal(compact.replaceAll(" || ", " "), parts.join(" "));
  const long = Array(4).fill("x".repeat(100)).join(" || ");
  assert.equal(compactChatBubbles(long), long, "never drop disclosure to meet a visual target");
});

const {
  getTask,
  reasonCards,
  counterRequirementIssue,
  requirementIssue,
  rankedOptions,
  scorePackage,
  cardOfLayer,
  abstractedReason,
  MAX_INDIVIDUAL_POINTS,
  RESERVATION_POINTS,
} = await import("../src/lib/tasks.ts");
const {
  counterpartStep,
  counterpartStageAfter,
  buildProxyPlan,
  proxyAccepts,
  designatedReason,
  tierOf,
  tierPackage,
  maxPackage,
  acceptablePackage,
  mentionsScoreNumbers,
  codeOutcome,
  foldTier,
  proposalTierNumber,
  TIER_LIMIT_INDEX,
  LABEL_TIER,
  CLARIFY_CONFIDENCE_FLOOR,
  SOFT_CLOSE_SECONDS,
  NEGOTIATION_SECONDS,
  CLOSING_SECONDS,
} = await import("../src/lib/negotiation/machine.ts");
const { validateAction } = await import("../src/lib/ai/validator.ts");
const { scriptedTask, SCRIPT_LINES } = await import(
  "../src/lib/negotiation/script.ts"
);

const ROLES = ["leader", "member"];
const TASKS = ["task_a", "task_b"];
const other = (role) => (role === "leader" ? "member" : "leader");

/** A plain trade-loop exchange state with everything one-shot already spent. */
const state = (tier, extra = {}) => ({
  tier,
  askedWhy: true,
  askSitUsed: true,
  numbersReminded: true,
  ...extra,
});

/**
 * The standard mandate: the participant's hoped-for level on every term, plus
 * the reasons they authorized.
 *
 * NO FLOOR. §2.6 removed the range mandate: it could not change the outcome,
 * because the counterpart's policy is decisive, so all it could do was
 * manufacture an impasse and mix mandate-setting skill into the result. The
 * wish package is the acceptance line instead (§8.6).
 */
function standardMandate(task, role, authorizedReasonIds) {
  return {
    issues: task.issues.map((issue) => ({
      issueId: issue.id,
      preferredOptionId: rankedOptions(task, issue.id, role)[0].id,
    })),
    authorizedReasonIds,
  };
}

// ---------------------------------------------------------------------------
// 1. The outcome ladder, four cells × two rungs
// ---------------------------------------------------------------------------

/**
 * §3.3 — the SYMMETRIC ladder, two rungs since the 12th correction. Both
 * sides' cores land at the same rank, so each rung pays both the same and
 * JOINT is a function of the tier. That is what lets §9.6 drop UNLOCK,
 * CONCEAL-PREMIUM and MAX-JOINT: JOINT alone identifies the rung.
 */
const LADDER = [
  { tier: "none", mine: 1000, theirs: 1000, joint: 2000 },
  { tier: "sensitive", mine: 3000, theirs: 3000, joint: 6000 },
];

test("the payoff spine is the Ver.2.21 convex one", () => {
  // The core column 3,000 / 1,600 / 600 / 0 and the non-core 600 / 400 / 200 /
  // 0, in both tasks. Only the best option solves the problem; the second is
  // worth about half and the third almost nothing.
  for (const taskId of TASKS) {
    const task = getTask(taskId);
    for (const role of ROLES) {
      const core = requirementIssue(task, role);
      const nonCore = counterRequirementIssue(task, role);
      assert.deepEqual(
        rankedOptions(task, core.id, role).map((o) => o.points[role]),
        [3000, 1600, 600, 0],
        `${taskId}/${role} core column`,
      );
      assert.deepEqual(
        rankedOptions(task, nonCore.id, role).map((o) => o.points[role]),
        [600, 400, 200, 0],
        `${taskId}/${role} non-core column`,
      );
    }
  }
  assert.equal(MAX_INDIVIDUAL_POINTS, 3600, "3,000 own core + 600 the other");
  assert.equal(RESERVATION_POINTS, 0, "no agreement is worth nothing");
});

for (const taskId of TASKS) {
  for (const role of ROLES) {
    const task = getTask(taskId);
    const counterpart = other(role);

    for (const rung of LADDER) {
      test(`${taskId}/${role}: ${rung.tier} settles at ${rung.mine} / ${rung.theirs}`, () => {
        const pkg = tierPackage(task, role, rung.tier);
        assert.equal(scorePackage(task, pkg, role), rung.mine);
        assert.equal(scorePackage(task, pkg, counterpart), rung.theirs);
        assert.equal(
          scorePackage(task, pkg, role) + scorePackage(task, pkg, counterpart),
          rung.joint,
        );
        // The tier package is exactly acceptable at its own tier…
        assert.equal(acceptablePackage(task, role, pkg, rung.tier), true);
        // …and every rung beats no agreement, so an unargued settlement is
        // still better than walking away.
        assert.ok(rung.mine > task.reservationPoints);
      });
    }

    test(`${taskId}/${role}: the work reason buys exactly what silence buys`, () => {
      // THE VER.2.21 WORK REASON NAMES BOTH TERMS. A counterpart that hears it
      // learns "they want both", which leaves splitting the difference as the
      // only move. If this ever stops matching `none`, the WR has become
      // directional again and the SB has stopped being the bottleneck.
      const none = tierPackage(task, role, "none");
      const work = tierPackage(task, role, "work");
      assert.deepEqual(work, none);
      assert.equal(scorePackage(task, work, role), 1000);
    });

    test(`${taskId}/${role}: impasse pays nothing at all`, () => {
      const coded = codeOutcome(task, role, null, false);
      assert.equal(coded.participantPoints, 0);
      assert.equal(coded.counterpartPoints, 0);
      assert.equal(coded.jointPoints, 0);
      assert.equal(coded.agreed, false);
      assert.equal(coded.clearsReservation, false);
      // Even the unargued rung beats it, which is the whole point of removing
      // the 600 fallback: breaking off can never be worth playing for.
      assert.ok(
        scorePackage(task, tierPackage(task, role, "none"), role) >
          coded.participantPoints,
      );
    });

    test(`${taskId}/${role}: the SB rung is the global maximum`, () => {
      const coded = codeOutcome(task, role, maxPackage(task, role), true);
      assert.equal(coded.jointPoints, 6000);
      assert.equal(coded.participantPoints, 3000);
      assert.equal(coded.clearsReservation, true);
    });

    test(`${taskId}/${role}: JOINT alone identifies the rung (§9.6)`, () => {
      const joints = LADDER.map(
        (r) => codeOutcome(task, role, tierPackage(task, role, r.tier), true).jointPoints,
      );
      joints.push(codeOutcome(task, role, null, false).jointPoints);
      assert.equal(new Set(joints).size, joints.length);
      assert.deepEqual(joints, [2000, 6000, 0]);
    });

    test(`${taskId}/${role}: every rung moves BOTH sides equally`, () => {
      // The symmetry itself, in one assertion. Ver.2.12 held the counterpart
      // at its own best throughout, and §2.6 removed that as a face threat in
      // its own right.
      for (const rung of LADDER) {
        const pkg = tierPackage(task, role, rung.tier);
        assert.equal(
          scorePackage(task, pkg, role),
          scorePackage(task, pkg, counterpart),
        );
      }
    });
  }
}

// ---------------------------------------------------------------------------
// 2. Counterpart behaviour: SB is the only bottleneck
// ---------------------------------------------------------------------------

for (const taskId of TASKS) {
  for (const role of ROLES) {
    const task = getTask(taskId);
    const counterpart = other(role);
    const best = maxPackage(task, role);

    test(`${taskId}/${role}: a bare priority claim moves nothing`, () => {
      // §3.3, 12th correction. The claim earns one SCRIPT-ASKWHY and the T1
      // package stays on the table beside it. It does NOT earn a rung: a claim
      // the counterpart cannot explain upstairs is cheap talk.
      const asked = counterpartStep(task, counterpart, 5, null, {
        ...state("work", { priorityClaimed: true }),
        askedWhy: false,
      });
      assert.equal(asked.action, "ask_why");
      assert.deepEqual(asked.proposal, tierPackage(task, role, "work"));

      const after = counterpartStep(
        task,
        counterpart,
        5,
        null,
        state("work", { priorityClaimed: true }),
      );
      assert.equal(after.action, "propose_tier");
      assert.deepEqual(after.proposal, tierPackage(task, role, "none"));
      assert.equal(scorePackage(task, after.proposal, role), 1000);
    });

    test(`${taskId}/${role}: over-ask without SB is countered at the tier, never accepted`, () => {
      // The participant asks for everything: their best on their core AND the
      // counterpart's core conceded — better than best↔best for them.
      const greedy = {
        ...best,
        [counterRequirementIssue(task, role).id]: rankedOptions(
          task,
          counterRequirementIssue(task, role).id,
          role,
        )[0].id,
      };
      for (const tier of ["none", "work"]) {
        const d = counterpartStep(task, counterpart, 5, greedy, state(tier));
        assert.equal(d.accepts, false);
        assert.deepEqual(d.proposal, tierPackage(task, role, tier));
      }
    });

    test(`${taskId}/${role}: the full trade is refused without the SB`, () => {
      // Even offering the counterpart its OWN best is not enough: the ladder
      // turns on what was said, not on generosity. SCRIPT-BALANCE says so.
      for (const tier of ["none", "work"]) {
        const d = counterpartStep(task, counterpart, 5, best, state(tier));
        assert.equal(d.accepts, false);
        assert.equal(d.action, "balance");
        assert.deepEqual(d.proposal, tierPackage(task, role, tier));
      }
    });

    test(`${taskId}/${role}: with the SB voiced, best↔best is accepted`, () => {
      const d = counterpartStep(task, counterpart, 5, best, state("sensitive"));
      assert.equal(d.accepts, true);
      assert.equal(d.action, "accept_sb");
    });

    test(`${taskId}/${role}: with the SB voiced, an out-of-tier ask is rebalanced`, () => {
      const theirs = counterRequirementIssue(task, role);
      const greedy = {
        ...best,
        [theirs.id]: rankedOptions(task, theirs.id, role)[0].id,
      };
      const d = counterpartStep(task, counterpart, 5, greedy, state("sensitive"));
      assert.equal(d.action, "balance");
      assert.deepEqual(d.proposal, best);
    });

    test(`${taskId}/${role}: an UNDER-ask is refused too (§6.2)`, () => {
      // A package worse for the participant than their rung allows is
      // rebalanced rather than taken, so a participant's over-concession
      // cannot mix into the primary outcome.
      const modest = tierPackage(task, role, "work");
      const d = counterpartStep(task, counterpart, 5, modest, state("sensitive"));
      assert.equal(d.accepts, false);
      assert.equal(d.action, "balance");
      assert.deepEqual(d.proposal, best);
    });

    test(`${taskId}/${role}: a max discloser is never left to run the clock out`, () => {
      // The ladder inverts if they can: 0 for the participant who paid the
      // most, against 1,000 for one who said nothing. The clock check must
      // therefore outrank the SB rung's re-proposal.
      const theirs = counterRequirementIssue(task, role);
      const greedy = {
        ...best,
        [theirs.id]: rankedOptions(task, theirs.id, role)[0].id,
      };
      const d = counterpartStep(task, counterpart, 5, greedy, {
        ...state("sensitive"),
        secondsRemaining: 30,
      });
      assert.equal(d.action, "soft_close");
      assert.deepEqual(d.proposal, best);
    });

    test(`${taskId}/${role}: only the exact tier package is accepted`, () => {
      const theirs = counterRequirementIssue(task, role);
      const shorted = {
        ...tierPackage(task, role, "work"),
        [theirs.id]: rankedOptions(task, theirs.id, counterpart)[0].id,
      };
      assert.equal(acceptablePackage(task, role, shorted, "work"), false);
      assert.equal(
        acceptablePackage(task, role, tierPackage(task, role, "sensitive"), "work"),
        false,
      );
      assert.equal(
        acceptablePackage(task, role, tierPackage(task, role, "work"), "work"),
        true,
      );
    });

    test(`${taskId}/${role}: a reason-free demand is never asked WHY (§6.9 #7)`, () => {
      // ASKWHY's only trigger is a priority claim (§6.9 #9). Asking "why does
      // that one matter more?" of someone who never said one matters more is a
      // question about something they did not claim. A bare demand gets
      // SCRIPT-ASKSIT once at stage 2, then the T1 package, then BALANCE.
      const first = counterpartStep(
        task,
        counterpart,
        5,
        best,
        state("none", { askedWhy: false }),
      );
      assert.notEqual(first.action, "ask_why");
      assert.equal(first.action, "balance");
      assert.deepEqual(first.proposal, tierPackage(task, role, "none"));

      // With nothing on the table it simply proposes at its rung.
      const empty = counterpartStep(
        task,
        counterpart,
        5,
        null,
        state("none", { askedWhy: false }),
      );
      assert.equal(empty.action, "propose_tier");
    });
  }
}

// ---------------------------------------------------------------------------
// 2a. The one-shot questions (§6.4, §6.9 #17)
// ---------------------------------------------------------------------------

test("SCRIPT-ASKSIT: a reasonless first message is asked about once", () => {
  const task = getTask("task_a");
  const direct = (extra) => ({
    tier: "none",
    askedWhy: false,
    numbersReminded: true,
    disclosurePolicy: "reciprocal",
    ...extra,
  });

  // The first reasonless turn: ask what their situation is, and wait.
  const first = counterpartStep(task, "member", 2, null, direct({ reasonlessTurns: 1 }));
  assert.equal(first.action, "ask_sit");
  assert.equal(first.proposal, null);

  // Spent — the second reasonless turn settles it as "no reason" and the trade
  // loop takes over (§6.1 stage 2).
  const second = counterpartStep(
    task,
    "member",
    2,
    null,
    direct({ askSitUsed: true, reasonlessTurns: 2 }),
  );
  assert.notEqual(second.action, "ask_sit");

  // Two reasonless turns settle it even if the flag were somehow unset.
  const settled = counterpartStep(
    task,
    "member",
    2,
    null,
    direct({ reasonlessTurns: 2 }),
  );
  assert.notEqual(settled.action, "ask_sit");

  // A first message that DID carry a reason never reaches it.
  const reasoned = counterpartStep(
    task,
    "member",
    2,
    null,
    direct({ tier: "work", reasonlessTurns: 0 }),
  );
  assert.notEqual(reasoned.action, "ask_sit");
});

test("SCRIPT-CLARIFY: low confidence below SB asks once per tier", () => {
  const task = getTask("task_a");
  const low = CLARIFY_CONFIDENCE_FLOOR - 0.1;

  const asked = counterpartStep(task, "member", 5, null, {
    ...state("work"),
    labelConfidence: low,
  });
  assert.equal(asked.action, "clarify");

  // Spent at this tier.
  const spent = counterpartStep(task, "member", 5, null, {
    ...state("work"),
    labelConfidence: low,
    clarifyUsedForTier: "work",
  });
  assert.notEqual(spent.action, "clarify");

  // ONCE PER TIER, not once per task: someone who clarified their way up to
  // `work` may still be vague about an SB later. A tier the clarify was not
  // spent at gets its own.
  const newTier = counterpartStep(task, "member", 5, null, {
    ...state("none"),
    labelConfidence: low,
    clarifyUsedForTier: "work",
  });
  assert.equal(newTier.action, "clarify");

  // Never at the SB rung — there is nothing above it to clarify towards.
  const atSb = counterpartStep(task, "member", 5, null, {
    ...state("sensitive"),
    labelConfidence: low,
    counterpartSbDisclosed: true,
  });
  assert.notEqual(atSb.action, "clarify");

  // A confident answer is acted on rather than questioned.
  const confident = counterpartStep(task, "member", 5, null, {
    ...state("work"),
    labelConfidence: 0.95,
  });
  assert.equal(confident.action, "propose_tier");
});

test("SCRIPT-NUDGE: silence is nudged once, then simply waited out", () => {
  const task = getTask("task_a");
  const silent = counterpartStep(task, "member", 5, null, {
    ...state("none"),
    participantSilent: true,
  });
  assert.equal(silent.action, "nudge");
  assert.equal(silent.proposal, null);

  const spent = counterpartStep(task, "member", 5, null, {
    ...state("none"),
    participantSilent: true,
    nudgeUsed: true,
  });
  assert.notEqual(spent.action, "nudge");

  // A package on the table is answered rather than nudged: there is something
  // to respond to.
  const withOffer = counterpartStep(
    task,
    "member",
    5,
    maxPackage(task, "leader"),
    { ...state("none"), participantSilent: true },
  );
  assert.notEqual(withOffer.action, "nudge");
});

test("the clock's soft close fires at 90 seconds, not 60", () => {
  assert.equal(SOFT_CLOSE_SECONDS, 90);
  const task = getTask("task_a");
  const greedy = maxPackage(task, "leader");
  const close = counterpartStep(task, "member", 5, greedy, {
    ...state("work"),
    secondsRemaining: 89,
  });
  assert.equal(close.action, "soft_close");
  assert.deepEqual(close.proposal, tierPackage(task, "leader", "work"));
  const notYet = counterpartStep(task, "member", 5, greedy, {
    ...state("work"),
    secondsRemaining: 120,
  });
  assert.notEqual(notYet.action, "soft_close");
  const expired = counterpartStep(task, "member", 5, greedy, {
    ...state("work"),
    secondsRemaining: 0,
  });
  assert.equal(expired.impasse, true);
});

test("Ver.2.26 gives Direct and Proxy closing five minutes", () => {
  assert.equal(NEGOTIATION_SECONDS, 5 * 60);
  assert.equal(CLOSING_SECONDS, 5 * 60);
});

test("off-topic and bonus-only first turns redirect without consuming the reason opportunity", () => {
  const task = getTask("task_a");
  const weather = counterpartStep(task, "leader", 2, null, state("none", {
    offTopicNow: true,
    firstReasonOpportunityNow: false,
    reasonlessTurns: 0,
  }));
  assert.equal(weather.action, "redirect");
  assert.equal(weather.proposal, null);

  const bonus = counterpartStep(task, "leader", 2, null, state("none", {
    bonusRequestNow: true,
    firstReasonOpportunityNow: false,
    reasonlessTurns: 0,
  }));
  assert.equal(bonus.action, "bonus_boundary");
  assert.equal(bonus.proposal, null);
});

test("conditional acceptance needs an unambiguous later acceptance", () => {
  const task = getTask("task_a");
  const t1 = tierPackage(task, "member", "work");
  const initial = counterpartStep(task, "leader", 5, t1, state("work", {
    conditionalAcceptanceNow: true,
    bonusRequestNow: true,
  }));
  assert.equal(initial.action, "conditional");
  assert.equal(initial.accepts, false);

  const ambiguousOkay = counterpartStep(task, "leader", 5, t1, state("work", {
    pendingConditionalAcceptance: true,
  }));
  assert.equal(ambiguousOkay.action, "conditional");
  assert.equal(ambiguousOkay.accepts, false);

  const explicitLaterAcceptance = counterpartStep(task, "leader", 5, t1, state("work", {
    pendingConditionalAcceptance: false,
  }));
  assert.equal(explicitLaterAcceptance.action, "accept");
  assert.equal(explicitLaterAcceptance.accepts, true);
});

test("deadline and reciprocity never turn a conditional package into agreement", () => {
  const task = getTask("task_a");
  const t2 = tierPackage(task, "member", "sensitive");
  const expired = counterpartStep(task, "leader", 5, t2, state("sensitive", {
    secondsRemaining: 0,
    counterpartSbDisclosed: true,
    pendingConditionalAcceptance: true,
  }));
  assert.equal(expired.action, "impasse");
  assert.equal(expired.accepts, false);

  const mixed = counterpartStep(task, "leader", 5, t2, state("sensitive", {
    disclosurePolicy: "reciprocal",
    counterpartSbDisclosed: false,
    conditionalAcceptanceNow: true,
    bonusRequestNow: true,
    reasonAdvancedNow: true,
  }));
  assert.equal(mixed.action, "disclose_sb");
  assert.equal(mixed.accepts, false);
});

test("a valid unconditional acceptance outranks incidental off-topic or bonus text", () => {
  const task = getTask("task_a");
  const t1 = tierPackage(task, "leader", "work");
  const accepted = counterpartStep(task, "member", 5, t1, state("work", {
    offTopicNow: true,
    bonusRequestNow: true,
    conditionalAcceptanceNow: false,
  }));
  assert.equal(accepted.accepts, true);
});

test("a stale T1 cannot settle after a later SB promotes the live tier", () => {
  for (const taskId of TASKS) {
    const task = getTask(taskId);
    for (const role of ROLES) {
      const counterpartRole = other(role);
      const staleT1 = tierPackage(task, role, "work");
      const decision = counterpartStep(
        task,
        counterpartRole,
        5,
        staleT1,
        state("sensitive", { counterpartSbDisclosed: true }),
      );
      assert.equal(decision.accepts, false, `${taskId}/${role}`);
      assert.deepEqual(decision.proposal, tierPackage(task, role, "sensitive"));
    }
  }
});

// ---------------------------------------------------------------------------
// 2b. Reciprocal disclosure in Direct (§6.3)
// ---------------------------------------------------------------------------

test("the counterpart walks open → first reason → disclosure → trade loop", () => {
  assert.equal(counterpartStageAfter(0), 1);
  assert.equal(counterpartStageAfter(1), 2);
  assert.equal(counterpartStageAfter(2), 4);
  assert.equal(counterpartStageAfter(3), 5);
  assert.equal(counterpartStageAfter(9), 5);
});

for (const taskId of TASKS) {
  for (const role of ROLES) {
    const task = getTask(taskId);
    const counterpart = other(role);
    const direct = (tier, extra = {}) =>
      state(tier, { disclosurePolicy: "reciprocal", ...extra });

    for (const tier of ["none", "work"]) {
      test(`${taskId}/${role}/Direct: ${tier} can accept its own rung with no disclosure at all`, () => {
        const pkg = tierPackage(task, role, tier);
        const decision = counterpartStep(task, counterpart, 2, pkg, direct(tier));
        assert.equal(decision.accepts, true);
        assert.equal(decision.action, "accept");
        assert.deepEqual(decision.proposal, pkg);
      });
    }

    test(`${taskId}/${role}/Direct: a WR-only path NEVER hears the counterpart's SB`, () => {
      // §6.3, Ver.2.21. Reciprocity is the rule: the counterpart discloses only
      // after the participant has. This is what makes `SB` a disclosure
      // decision rather than a response to one — and it means a WR-only Direct
      // session has no receiver experience of an SB at all (§3.3).
      for (const tier of ["none", "work"]) {
        for (const stage of [2, 4, 5]) {
          const d = counterpartStep(task, counterpart, stage, null, direct(tier));
          assert.notEqual(d.action, "disclose_sb", `${tier} at stage ${stage}`);
          assert.notEqual(d.action, "disclose_sb_and_accept");
        }
      }
    });

    test(`${taskId}/${role}/Direct: SB plus max package reciprocates and accepts once`, () => {
      const best = maxPackage(task, role);
      const first = counterpartStep(task, counterpart, 2, best, direct("sensitive"));
      assert.equal(first.action, "disclose_sb_and_accept");
      assert.equal(first.accepts, true);
      assert.deepEqual(first.proposal, best);

      const replay = counterpartStep(
        task,
        counterpart,
        4,
        best,
        direct("sensitive", { counterpartSbDisclosed: true }),
      );
      assert.equal(replay.action, "accept_sb");
      assert.equal(replay.accepts, true);
    });

    test(`${taskId}/${role}/Direct: a late SB is reciprocated without duplicating it`, () => {
      const first = counterpartStep(task, counterpart, 5, null, direct("sensitive"));
      assert.equal(first.action, "disclose_sb");
      const after = counterpartStep(
        task,
        counterpart,
        5,
        null,
        direct("sensitive", { counterpartSbDisclosed: true }),
      );
      assert.notEqual(after.action, "disclose_sb");
      assert.notEqual(after.action, "disclose_sb_and_accept");
      assert.equal(after.action, "propose_tier");
      assert.deepEqual(after.proposal, maxPackage(task, role));
    });
  }
}

test("the four Ver.2.23 WR cards retain their full work context", () => {
  const expected = {
    "task_a/leader": [/coordination faster/i, /early impression/i],
    "task_a/member": [/commuting and meetings/i, /several days/i],
    "task_b/leader": [/early work moving/i, /builds trust/i],
    "task_b/member": [/delay my existing work/i, /separate time to prepare/i],
  };
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      const wr = cardOfLayer(getTask(taskId), role, "work");
      for (const phrase of expected[`${taskId}/${role}`]) {
        assert.match(wr.text, phrase, `${taskId}/${role} lost canonical WR detail`);
      }
    }
  }
});

test("role briefings use the same neutral disclosure notice and £0.50 decision", () => {
  const notices = new Set();
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      const brief = getTask(taskId).roleBriefs[role];
      notices.add(brief.disclosureRisk);
      assert.match(brief.organizationalPosition, /up to £0\.50/);
      assert.doesNotMatch(brief.roleStory, /can read as|could make you look/i);
    }
  }
  assert.equal(notices.size, 1, "the notice must not vary by role or task");
});

test("Proxy observation keeps its fixed stage-4 disclosure schedule", () => {
  // The counterpart proxy always discloses while the participant watches, at
  // every tier — so a Proxy participant's receiver experience is the same in
  // every cell, which Direct's reciprocity rule deliberately is not.
  const task = getTask("task_a");
  for (const tier of ["none", "work", "sensitive"]) {
    const decision = counterpartStep(task, "member", 4, null, {
      ...state(tier),
      disclosurePolicy: "fixed",
    });
    assert.equal(decision.action, "disclose_sb");
  }
});

// ---------------------------------------------------------------------------
// 2c. Early settlement and the clock
// ---------------------------------------------------------------------------

test("a valid acceptance ends the task at once, with no forced disclosure stage", () => {
  // §6.1 stage 6. A participant who takes the package on the table should not
  // have to sit through an intermediate turn before it is answered.
  const task = getTask("task_a");
  for (const tier of ["none", "work"]) {
    const pkg = tierPackage(task, "leader", tier);
    for (const stage of [2, 4, 5]) {
      const d = counterpartStep(task, "member", stage, pkg, {
        ...state(tier, { disclosurePolicy: "reciprocal" }),
      });
      assert.equal(d.accepts, true, `${tier} at stage ${stage}`);
      assert.equal(d.stage, 6);
    }
  }
});

test("the score reminder outranks an otherwise valid early acceptance", () => {
  const task = getTask("task_a");
  const pkg = tierPackage(task, "leader", "work");
  const reminded = counterpartStep(task, "member", 2, pkg, {
    ...state("work", { disclosurePolicy: "reciprocal" }),
    numbersReminded: false,
    numbersMentionedNow: true,
  });
  assert.equal(reminded.action, "nonum");
  assert.equal(reminded.accepts, false);
});

test("the tier package sent in the last seconds is accepted, not read as impasse", () => {
  // `secondsRemaining` is captured BEFORE the reply delay, so a participant who
  // puts the tier package up near the end reaches the machine at zero.
  // Answering that with an impasse pays 0 instead of the rung they earned, and
  // which one they got would be decided by when the message landed.
  const task = getTask("task_a");
  for (const tier of ["none", "work", "sensitive"]) {
    const pkg = tierPackage(task, "leader", tier);

    const direct = counterpartStep(task, "member", 2, pkg, {
      ...state(tier, { disclosurePolicy: "reciprocal" }),
      secondsRemaining: 0,
      counterpartSbDisclosed: true,
    });
    assert.equal(direct.accepts, true, `direct ${tier}`);
    assert.deepEqual(direct.proposal, pkg);

    const trade = counterpartStep(task, "member", 5, pkg, {
      ...state(tier),
      secondsRemaining: 0,
    });
    assert.equal(trade.accepts, true, `trade ${tier}`);
    assert.deepEqual(trade.proposal, pkg);
  }

  // Off-tier at zero is still an impasse — the clock outranks everything the
  // counterpart was going to refuse anyway.
  const greedy = maxPackage(task, "leader");
  const refused = counterpartStep(task, "member", 5, greedy, {
    ...state("work"),
    secondsRemaining: 0,
  });
  assert.equal(refused.action, "impasse");
  assert.equal(refused.accepts, false);

  // And a first score mention at zero must not cost the rung: with no turn left
  // to accept in, the acceptance wins over the one-shot reminder.
  const pkg = tierPackage(task, "leader", "work");
  const mentioned = counterpartStep(task, "member", 5, pkg, {
    ...state("work"),
    secondsRemaining: 0,
    numbersReminded: false,
    numbersMentionedNow: true,
  });
  assert.equal(mentioned.accepts, true);
});

test("the score-number reminder fires once, then mentions are ignored", () => {
  const task = getTask("task_a");
  const best = maxPackage(task, "leader");
  const first = counterpartStep(task, "member", 5, best, {
    ...state("sensitive"),
    numbersReminded: false,
    numbersMentionedNow: true,
  });
  assert.equal(first.action, "nonum");
  const later = counterpartStep(task, "member", 5, best, {
    ...state("sensitive"),
    numbersMentionedNow: true,
  });
  assert.equal(later.action, "accept_sb");
});

test("mentionsScoreNumbers catches score talk and passes option counts", () => {
  assert.equal(mentionsScoreNumbers("I get 3000 for that"), true);
  assert.equal(mentionsScoreNumbers("that's worth more points to me"), true);
  assert.equal(mentionsScoreNumbers("my score sheet says otherwise"), true);
  assert.equal(mentionsScoreNumbers("could we do 3 per week?"), false);
  assert.equal(mentionsScoreNumbers("4 of the 4 is a lot"), false);
  assert.equal(mentionsScoreNumbers("that is the key point for me"), false);
  assert.equal(mentionsScoreNumbers("I see your point"), false);
  assert.equal(mentionsScoreNumbers("that earns one point"), true);
});

/**
 * THE CLIENT AND THE SERVER MUST DECIDE THE SAME THING.
 *
 * Both run `counterpartStep`. The client codes the outcome from ITS decision;
 * the participant reads the sentence the server rendered from the server's. So
 * every field of `ExchangeState` has to reach the route unchanged — and this
 * test exists because one of them (`numbersMentionedNow`) was computed
 * separately on each side, which flips `accepts` on an otherwise identical
 * package: a participant could be shown "let's not talk scores" and be recorded
 * as having agreed.
 */
test("every ExchangeState field can change the decision, so all of them travel", () => {
  const task = getTask("task_a");
  const best = maxPackage(task, "member");
  const base = {
    tier: "sensitive",
    askedWhy: true,
    askSitUsed: true,
    numbersReminded: false,
    numbersMentionedNow: false,
    secondsRemaining: 300,
    softCloseOffered: false,
  };
  const decide = (over) =>
    counterpartStep(task, "leader", 5, best, { ...base, ...over });

  assert.equal(decide({}).accepts, true);

  assert.equal(decide({ numbersMentionedNow: true }).accepts, false);
  assert.equal(decide({ numbersMentionedNow: true }).action, "nonum");
  assert.equal(decide({ tier: "work" }).accepts, false);
  assert.equal(
    decide({ tier: "work", labelConfidence: 0.2 }).action,
    "clarify",
  );
  assert.equal(
    decide({ tier: "work", priorityClaimed: true, askedWhy: false }).action,
    "ask_why",
  );
  // …and without the flag the same state does not reach it.
  assert.notEqual(
    decide({ tier: "work", askedWhy: false }).action,
    "ask_why",
  );
  assert.equal(
    counterpartStep(task, "leader", 5, best, {
      ...base,
      tier: "work",
      secondsRemaining: 0,
    }).impasse,
    true,
  );
});

// ---------------------------------------------------------------------------
// 3. The proxy plan and the reason schedule
// ---------------------------------------------------------------------------

for (const taskId of TASKS) {
  for (const role of ROLES) {
    const task = getTask(taskId);
    const cards = reasonCards(task, role);
    const wr = cards.find((c) => c.layer === "work");
    const sb = cards.find((c) => c.layer === "sensitive");

    test(`${taskId}/${role}: two cards, WR + SB, both on this role's own core issue`, () => {
      assert.equal(cards.length, 2);
      assert.ok(wr && sb);
      assert.equal(wr.issueId, task.requirementIssueId[role]);
      assert.equal(sb.issueId, task.requirementIssueId[role]);
      // Speakable, first person: said aloud to the other side.
      assert.match(sb.text, /\bI\b|\bmy\b/i);
      assert.match(wr.text, /\bmy\b|\bthis\b|\bthe\b/i);
    });

    test(`${taskId}/${role}: the work reason names BOTH terms and neither priority`, () => {
      // §3.2, §4 — non-directional. Both issue labels have to be findable in
      // the card, and it must not say one matters more. This is the property
      // that makes T1 the only thing a counterpart can do with it.
      const core = requirementIssue(task, role);
      const nonCore = counterRequirementIssue(task, role);
      const text = wr.text.toLowerCase();
      const noun = (issue) =>
        issue.label.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      for (const issue of [core, nonCore]) {
        assert.ok(
          noun(issue).some((word) => text.includes(word.replace(/s$/, ""))),
          `${taskId}/${role} WR should mention ${issue.label}`,
        );
      }
      assert.doesNotMatch(
        wr.text,
        /matters? more|more important|priority|most important/i,
        "the WR must not reveal a priority",
      );
    });

    test(`${taskId}/${role}: SB authorized → SB voiced at the first reason opportunity`, () => {
      const card = designatedReason(task, role, 2, [wr.id, sb.id]);
      assert.equal(card?.id, sb.id);
    });

    test(`${taskId}/${role}: WR only → WR voiced, and an unticked SB never is`, () => {
      const card = designatedReason(task, role, 2, [wr.id]);
      assert.equal(card?.id, wr.id);
      const later = designatedReason(task, role, 5, [wr.id], [wr.id]);
      assert.equal(later, null);
    });

    test(`${taskId}/${role}: no card is designated twice`, () => {
      const first = designatedReason(task, role, 2, [wr.id, sb.id]);
      const second = designatedReason(task, role, 5, [wr.id, sb.id], [first.id]);
      assert.notEqual(second?.id, first.id);
      const third = designatedReason(
        task,
        role,
        5,
        [wr.id, sb.id],
        [first.id, second.id],
      );
      assert.equal(third, null);
    });

    test(`${taskId}/${role}: plan — SB authorized settles at best↔best`, () => {
      const plan = buildProxyPlan(
        task,
        role,
        standardMandate(task, role, [wr.id, sb.id]),
      );
      assert.equal(plan.tier, "sensitive");
      assert.deepEqual(plan.tentative, maxPackage(task, role));
      assert.equal(scorePackage(task, plan.tentative, role), 3000);
    });

    test(`${taskId}/${role}: plan — the proxy's floor is T1, the same as Direct's`, () => {
      // VER.2.21, 12th correction. The proxy still declines the first T1 offer
      // and states the priority, because it holds the wish package — but that
      // earns nothing now, so both arms floor at the same rung and the old
      // §13-13② mode asymmetry in Points/JOINT is gone.
      for (const ids of [[], [wr.id]]) {
        const plan = buildProxyPlan(task, role, standardMandate(task, role, ids));
        assert.equal(plan.tier, "work");
        assert.deepEqual(plan.tentative, tierPackage(task, role, "work"));
        assert.equal(scorePackage(task, plan.tentative, role), 1000);
      }
    });

    test(`${taskId}/${role}: plan — the work reason is voiced whether or not it was ticked`, () => {
      // §8.7: the WR is a fixed utterance, not a checkbox. Un-ticking it would
      // create a "no reason at all" proxy path with no Direct counterpart.
      const unticked = buildProxyPlan(task, role, standardMandate(task, role, []));
      const ticked = buildProxyPlan(task, role, standardMandate(task, role, [wr.id]));
      assert.equal(unticked.tier, ticked.tier);
      assert.deepEqual(unticked.tentative, ticked.tentative);
    });

    test(`${taskId}/${role}: plan — the proxies always reach a package`, () => {
      for (const ids of [[], [wr.id], [wr.id, sb.id]]) {
        const plan = buildProxyPlan(task, role, standardMandate(task, role, ids));
        assert.ok(plan.tentative, `no tentative for ${ids.length} card(s)`);
        assert.deepEqual(plan.tentative, tierPackage(task, role, plan.tier));
      }
    });

    test(`${taskId}/${role}: the wish accept rule — take it if it matches the wish, else push`, () => {
      // §6.5, §8.6. The wish package is the proxy's target AND its acceptance
      // line. The screen's default is both terms at their best, so no package
      // the counterpart offers can match it and the proxy goes to the ceiling
      // its reasons allow, then brings back what it reached.
      const plan = buildProxyPlan(
        task,
        role,
        standardMandate(task, role, [wr.id, sb.id]),
      );
      assert.equal(plan.wishScore, MAX_INDIVIDUAL_POINTS);
      const best = maxPackage(task, role);
      assert.equal(
        proxyAccepts(task, role, best, plan, 1),
        false,
        "the default wish is above even best↔best, so it keeps pushing",
      );
      assert.equal(
        proxyAccepts(task, role, best, plan, 0),
        true,
        "out of reasons: take what is on the table as the tentative package",
      );
      assert.equal(proxyAccepts(task, role, null, plan, 0), false);

      // A modest wish is met by the T1 package and accepted straight away.
      const modestMandate = {
        issues: task.issues.map((issue) => ({
          issueId: issue.id,
          preferredOptionId: tierPackage(task, role, "work")[issue.id],
        })),
        authorizedReasonIds: [wr.id],
      };
      const modest = buildProxyPlan(task, role, modestMandate);
      assert.equal(modest.wishScore, 1000);
      assert.equal(
        proxyAccepts(task, role, tierPackage(task, role, "work"), modest, 2),
        true,
      );
    });
  }
}

test("tierOf reads layers and ignores everything else", () => {
  assert.equal(tierOf([]), "none");
  assert.equal(tierOf([{ layer: "work" }]), "work");
  assert.equal(tierOf([{ layer: "work" }, { layer: "sensitive" }]), "sensitive");
});

test("the tier only ever rises, and there are only two rungs to rise between", () => {
  assert.deepEqual(Object.keys(TIER_LIMIT_INDEX).sort(), [
    "none",
    "sensitive",
    "work",
  ]);
  assert.equal(TIER_LIMIT_INDEX.none, 2);
  assert.equal(TIER_LIMIT_INDEX.work, 2);
  assert.equal(TIER_LIMIT_INDEX.sensitive, 0);

  assert.equal(foldTier("none", "work"), "work");
  assert.equal(foldTier("work", "none"), "work");
  assert.equal(foldTier("work", "sensitive"), "sensitive");
  assert.equal(foldTier("sensitive", "none"), "sensitive");
  assert.equal(foldTier("sensitive", "work"), "sensitive");

  assert.equal(proposalTierNumber("none"), 1);
  assert.equal(proposalTierNumber("work"), 1);
  assert.equal(proposalTierNumber("sensitive"), 2);
});

test("the classifier's labels map onto the two rungs, PRI included as an alias", () => {
  assert.equal(LABEL_TIER.none, "none");
  assert.equal(LABEL_TIER.WR, "work");
  assert.equal(LABEL_TIER.SB, "sensitive");
  // Ver.2.21 replaced the PRI label with a `priority_claim` flag. The alias is
  // kept so a stale client or a replayed log cannot produce `undefined` where
  // a tier belongs — and it maps to `work`, which is what a priority claim
  // buys.
  assert.equal(LABEL_TIER.PRI, "work");
});

// ---------------------------------------------------------------------------
// 4. Script and machine agree, in every cell
// ---------------------------------------------------------------------------

for (const taskId of TASKS) {
  for (const role of ROLES) {
    for (const condition of ["direct", "user_specified", "ai_supplemented"]) {
      test(`${taskId}/${role}/${condition}: the scripted ideal settles at 3,000 / 3,000 and the machine accepts it`, () => {
        const task = getTask(taskId);
        const counterpart = other(role);
        const script = scriptedTask(task, role, condition);
        assert.equal(script.agreed, true);
        assert.deepEqual(script.tentative, maxPackage(task, role));
        assert.equal(scorePackage(task, script.tentative, role), 3000);
        assert.equal(scorePackage(task, script.tentative, counterpart), 3000);

        // The participant side voices the SB at its first reason opportunity,
        // and the counterpart's own SB comes after it — reciprocity in Direct,
        // the fixed schedule in Proxy, and the same order on screen either way.
        const participantSpeakers = ["participant", "participant_proxy"];
        const counterpartSpeakers = ["counterpart", "counterpart_proxy"];
        const sb = reasonCards(task, role).find((c) => c.layer === "sensitive");
        const sbIndex = script.messages.findIndex(
          (m) =>
            participantSpeakers.includes(m.speaker) && m.reasonCardId === sb.id,
        );
        const discloseIndex = script.messages.findIndex(
          (m) => counterpartSpeakers.includes(m.speaker) && m.stage === 4,
        );
        assert.ok(sbIndex >= 0, "the ideal path voices the SB");
        assert.ok(discloseIndex > sbIndex, "SB lands before the disclosure");

        // The machine accepts the scripted trade at the scripted tier.
        const d = counterpartStep(
          task,
          counterpart,
          5,
          script.tentative,
          state("sensitive"),
        );
        assert.equal(d.accepts, true);
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 4b. THE PROXY SCRIPT FOLLOWS THE MANDATE
// ---------------------------------------------------------------------------
//
// The mockup exchange used to voice the sensitive card in every Proxy cell
// whatever the participant had authorized. So a participant who left the
// sensitive box unticked — the WR-only mandate, which the ladder pays 1,000 —
// still watched their proxy confess and still settled at 3,000/3,000, the SB
// rung. That is the confirmatory outcome reading the wrong value in the arm
// the whole study is about, and mockup mode is how the flow is read, so it is
// what a PI walking the study sees.
//
// `scriptedTask(..., sbAuthorized)` is the fix and these are its pins: with
// the box off the exchange lands on the T1 package the ladder actually pays,
// and the sensitive card is never voiced anywhere in it.
for (const taskId of TASKS) {
  for (const role of ROLES) {
    for (const condition of ["user_specified", "ai_supplemented"]) {
      test(`${taskId}/${role}/${condition}: the WR-only mockup settles at 1,000 / 1,000 and never voices the SB`, () => {
        const task = getTask(taskId);
        const counterpart = other(role);
        const script = scriptedTask(task, role, condition, false);

        // THE T1 RUNG, from the machine rather than from a number written here:
        // the script and the ladder have drifted apart twice before.
        assert.deepEqual(script.tentative, tierPackage(task, role, "work"));
        assert.equal(scorePackage(task, script.tentative, role), 1000);
        assert.equal(scorePackage(task, script.tentative, counterpart), 1000);

        // The sensitive card is never voiced — not as a reason token, and not
        // as its text anywhere in the transcript.
        const sb = cardOfLayer(task, role, "sensitive");
        for (const message of script.messages) {
          assert.notEqual(
            message.reasonCardId,
            sb.id,
            "the WR-only script must not designate the sensitive card",
          );
          assert.ok(
            !message.text.includes(sb.text.slice(0, 40)),
            `the withheld card's text leaked: ${message.text.slice(0, 120)}`,
          );
        }

        // The participant side still voices its WORK reason: it is a fixed
        // utterance the proxy always says (§8.7), so the WR-only path is
        // "one reason", never "no reason at all".
        const wr = cardOfLayer(task, role, "work");
        assert.ok(
          script.messages.some(
            (m) =>
              m.speaker === "participant_proxy" && m.reasonCardId === wr.id,
          ),
          "the WR is voiced at the first reason opportunity",
        );

        // BOTH POLICIES RUN THE SAME NUMBER OF TURNS (§7's exposure control).
        // A WR-only path that were shorter would confound the policy contrast
        // with how much was said.
        assert.equal(
          script.messages.length,
          scriptedTask(task, role, condition, true).messages.length,
        );

        // And the machine agrees the counterpart accepts exactly this package
        // at exactly this tier.
        const d = counterpartStep(
          task,
          counterpart,
          5,
          script.tentative,
          state("work"),
        );
        assert.equal(d.accepts, true);
      });
    }
  }
}

test("the WR-only mockup keeps the counterpart's own disclosure on its fixed schedule", () => {
  // §6.10: Direct's RECIPROCITY rule does not apply in the Proxy arm. While
  // the participant is watching, the counterpart proxy always discloses, so a
  // Proxy participant's receiver experience is the same in every cell — it
  // must NOT become conditional on the participant's own checkbox, which would
  // make the stimulus covary with the primary outcome.
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      for (const condition of ["user_specified", "ai_supplemented"]) {
        const task = getTask(taskId);
        const script = scriptedTask(task, role, condition, false);
        assert.ok(
          script.messages.some(
            (m) => m.speaker === "counterpart_proxy" && m.stage === 4,
          ),
          `${taskId}/${role}/${condition}: the counterpart still discloses on the WR-only path`,
        );
      }
    }
  }
});

test("cover ① rides the AI-Supplemented decline turn, and cover ② stays out of it", () => {
  // §6.6 rule (b), and it is the ONLY place the policy difference is visible
  // when the participant has authorized nothing sensitive. Without it a
  // participant who ticked nothing would experience the two policies
  // identically, and `AI-Supplemented − User-Specified` would be estimated
  // only among disclosers.
  //
  // Cover ② is SB-GRADE and must not appear: its job is to sit beside the
  // abstraction and make it unclear which of three sentences is the
  // principal's, and on a path with no abstraction it would just be a second
  // reason.
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      const task = getTask(taskId);
      const sb = cardOfLayer(task, role, "sensitive");
      const supp = scriptedTask(task, role, "ai_supplemented", false);
      const user = scriptedTask(task, role, "user_specified", false);
      const suppText = supp.messages.map((m) => m.text).join(" ");
      const userText = user.messages.map((m) => m.text).join(" ");

      assert.ok(
        suppText.includes(sb.cover[0].slice(1, 40)),
        `${taskId}/${role}: cover ① is missing from the AI-Supplemented WR-only path`,
      );
      assert.ok(
        !suppText.includes(sb.cover[1].slice(0, 40)),
        `${taskId}/${role}: cover ② must not appear on the WR-only path`,
      );
      // And User-Specified adds nothing of its own: it relays what it was
      // given and no more.
      assert.ok(
        !userText.includes(sb.cover[0].slice(1, 40)),
        `${taskId}/${role}: User-Specified must not carry a cover sentence`,
      );
    }
  }
});

test("a scripted proxy never speaks as its principal", () => {
  // §6.5, Ver.2.19. The proxy refers to "the team lead I represent" and never
  // claims the confession as its own — on screen a first-person proxy is
  // indistinguishable from the participant speaking, and the delegation is what
  // both policies are variants of.
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      const task = getTask(taskId);
      const sb = cardOfLayer(task, role, "sensitive");
      for (const condition of ["user_specified", "ai_supplemented"]) {
        const script = scriptedTask(task, role, condition);
        for (const message of script.messages) {
          assert.ok(
            !message.text.includes(sb.text),
            `${taskId}/${role}/${condition} pasted the card verbatim`,
          );
        }
      }
    }
  }
});

test("the counterpart's opening carries NO package and NO priority (§6.1)", () => {
  // The anchored opening — "my best, your worst" — is gone: §2.6 identifies it
  // as a face threat in its own right. And the counterpart never names its own
  // priority, so the participant starts without knowing what the other side
  // needs.
  for (const taskId of TASKS) {
    const task = getTask(taskId);
    for (const role of ROLES) {
      const d = counterpartStep(task, role, 1, null, state("none"));
      assert.equal(d.action, "open");
      assert.equal(d.proposal, null);
      assert.equal(d.accepts, false);
    }
  }
  // And the SCRIPT-OPEN wording asks about their situation rather than their
  // priority — an opening that asked "what matters most to you?" would invite a
  // priority claim as the first move.
  const opened = SCRIPT_LINES.open({ workReason: "there's a lot on." });
  assert.match(opened, /situation/i);
  assert.doesNotMatch(opened, /matters most|more important/i);
});

test("every fixed script line is short-bubbled and says what §6.4 says", () => {
  // Each bubble is about one short sentence — that is what makes the
  // counterpart read like a person typing rather than a system emitting a
  // paragraph, which is the whole of the "another participant" claim.
  const ctx = {
    workReason: "there's a lot on at the moment.",
    levels: "2 days on the office days, 3 of 4 on the presentations",
    participantCoreLabel: "the presentations",
    counterpartCoreLabel: "the office days",
  };
  for (const [name, line] of Object.entries(SCRIPT_LINES)) {
    const text = line(ctx);
    assert.ok(text.length <= 420, `${name} is over the message cap`);
    for (const bubble of text.split(" || ")) {
      assert.ok(bubble.length <= 130, `${name} has a ${bubble.length}-char bubble`);
    }
  }
  // SCRIPT-ASKWHY keeps the T1 package on the table beside the question.
  assert.match(SCRIPT_LINES.ask_why(ctx), /until then/i);
  // SCRIPT-PROPOSE-T2 receives the SB as an update, not as a favour.
  assert.match(SCRIPT_LINES.propose_t2(ctx), /didn't know/i);
  // SCRIPT-BALANCE names the imbalance and invites the missing reason.
  assert.match(SCRIPT_LINES.balance(ctx), /same amount/i);
  // SCRIPT-FALLBACK no longer promises a default arrangement: there is none.
  assert.doesNotMatch(SCRIPT_LINES.impasse(), /default/i);
  for (const [name, line] of Object.entries(SCRIPT_LINES)) {
    assert.doesNotMatch(line(ctx), /—/, `${name} contains an em dash`);
  }
  assert.match(
    SCRIPT_LINES.bonus_boundary({ ...ctx, participantRole: "member" }),
    /make the bonus recommendation after the negotiation/i,
  );
  assert.match(
    SCRIPT_LINES.bonus_boundary({ ...ctx, participantRole: "leader" }),
    /don't decide your payment/i,
  );
});

// ---------------------------------------------------------------------------
// 5. The §6.6 sentences and the no-additive-reason rule
// ---------------------------------------------------------------------------

const task = getTask("task_a");

function addingAction(overrides = {}) {
  return {
    actionType: "propose",
    issueTargets: [],
    proposedTerms: [],
    stage: 2,
    reasonSourceId: "a_wr_l",
    addedReasonSourceId: "pool:0",
    rationale: "The office days matter, and being in the same room early keeps mistakes down.",
    unresolved: true,
    internalProvenance: "principal_reason",
    ...overrides,
  };
}

test("no policy may add a reason of its own", () => {
  // The §6.6 sentences are supplied by the route, so there is nothing
  // legitimate for a model to put in `addedReasonSourceId` under EITHER policy,
  // and a value there means it invented a reason.
  for (const policy of ["user_specified", "ai_supplemented"]) {
    const result = validateAction(addingAction(), {
      issues: task.issues,
      policy,
      actorRole: "leader",
      stage: 2,
    });
    assert.equal(result.valid, false, `${policy} should refuse an addition`);
    assert.ok(
      result.violations.some((v) => v.code === "provenance_policy_violation"),
    );
  }
});

test("every sensitive card carries its §6.6 frame, abstraction and two covers", () => {
  // The sixteen sentences are FIXED (§6.6) — the model joins them, it never
  // writes them, because what survives the abstraction IS the manipulation. A
  // card missing them would silently fall back to relaying the card whole,
  // making AI-Supplemented identical to User-Specified.
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      const sb = cardOfLayer(getTask(taskId), role, "sensitive");
      const rendered = abstractedReason(sb);
      assert.ok(rendered, `${taskId}/${role} has no §6.6 sentences`);
      assert.equal(rendered.cover.length, 2);

      // The frame is the PROXY's own voice (11th correction): its assessment,
      // naming the principal as someone it represents.
      assert.match(rendered.frame, /I represent/);
      assert.match(rendered.frame, /three reasons/i);

      // The abstraction must not reproduce the card, and must carry NO
      // attribution to the principal — that is exactly what §6.6 stage 2
      // removes, and what separates the two policies.
      assert.notEqual(rendered.abstract, sb.text);
      assert.ok(rendered.abstract.length < sb.text.length);
      assert.doesNotMatch(
        rendered.abstract,
        /I represent|they told|on their behalf|the team (lead|member)/i,
        `${taskId}/${role} abstraction still attributes the fact`,
      );

      // All three sentences are subjectless declaratives of the same shape, so
      // sentence form alone cannot sort them.
      for (const sentence of [rendered.abstract, ...rendered.cover]) {
        assert.match(sentence, /\.$/);
        assert.doesNotMatch(sentence, /^I\b/);
      }
    }
  }
});

test("a whole §6.6 turn fits under the message cap", () => {
  // THE CAP TRIMS, AND WHAT IT TRIMS IS THE MANIPULATION. §6.6 fixes the
  // AI-Supplemented reason turn at a frame plus three sentences, and
  // `capMessageLength` cuts at a bubble seam when a message runs over 420
  // characters (NEGOTIATION.maxMessageChars). If the fixed text alone does not
  // fit, a cover — or worse, the abstraction — is dropped before any reply
  // clause is even written, and the policy collapses into a shorter
  // User-Specified. The Ver.2.21 frame is new and cost about 100 characters the
  // cap was never sized for, so this is checked rather than assumed.
  //
  // The margin matters as much as the limit: the model wraps these sentences in
  // a reply, so the fixed text has to leave room for one.
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      const card = cardOfLayer(getTask(taskId), role, "sensitive");
      const rendered = abstractedReason(card);
      const whole = [
        rendered.frame,
        rendered.cover[0],
        rendered.abstract,
        rendered.cover[1],
      ].join(" ");
      assert.ok(
        whole.length <= 400,
        `${taskId}/${role} §6.6 turn is ${whole.length} chars, leaving no room under the 420 cap`,
      );
    }
  }
});

test("an unchecked card may not be voiced under either policy", () => {
  for (const policy of ["user_specified", "ai_supplemented"]) {
    const result = validateAction(
      addingAction({ addedReasonSourceId: null, reasonSourceId: "a_sb_l" }),
      {
        issues: task.issues,
        policy,
        actorRole: "leader",
        stage: 2,
        mandate: {
          sessionIndex: 1,
          issues: task.issues.map((i) => ({
            issueId: i.id,
            preferredOptionId: null,
            minimumOptionId: null,
          })),
          authorizedReasonIds: ["a_wr_l"],
          revisionCount: 0,
        },
      },
    );
    assert.equal(result.valid, false);
    assert.ok(
      result.violations.some(
        (v) => v.code === "disclosure_permission_violation",
      ),
      `${policy} must block the unchecked card`,
    );
  }
});

test("both sides of an AI-Supplemented exchange use their own fixed sentences", async () => {
  const { PROXY_TURN_ORDER } = await import("../src/lib/negotiation/proxy-protocol.ts");
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      const t = getTask(taskId);
      const exchange = scriptedTask(t, role, "ai_supplemented");
      assert.equal(exchange.messages.length, PROXY_TURN_ORDER.length);
      for (const [speaker, speakerRole] of [
        ["participant_proxy", role],
        ["counterpart_proxy", other(role)],
      ]) {
        const card = cardOfLayer(t, speakerRole, "sensitive");
        const message = exchange.messages.find(
          (m) => m.speaker === speaker && m.text.includes(card.abstract),
        );
        assert.ok(message, `${taskId}/${role}/${speaker} has its fixed summary`);
        assert.ok(message.text.includes(card.frame));
        assert.ok(card.cover.every((sentence) => message.text.includes(sentence)));
        assert.ok(!message.text.includes(card.text));
      }
    }
  }
});

test("both policies run the same number of turns", async () => {
  // §7's exposure control: if one policy simply got more turns to speak in, any
  // difference in what the counterpart learns would be confounded with how much
  // was said.
  const { PROXY_TOTAL_TURNS } = await import("../src/lib/negotiation/proxy-protocol.ts");
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      const t = getTask(taskId);
      const specified = scriptedTask(t, role, "user_specified");
      const supplemented = scriptedTask(t, role, "ai_supplemented");
      assert.equal(specified.messages.length, PROXY_TOTAL_TURNS);
      assert.equal(supplemented.messages.length, PROXY_TOTAL_TURNS);
      assert.deepEqual(
        specified.messages.map((m) => [m.stage, m.speaker]),
        supplemented.messages.map((m) => [m.stage, m.speaker]),
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 6. No screen may name the requirement issue (§5 principle 1)
// ---------------------------------------------------------------------------

test("no card, brief or objective says which term the study is about", () => {
  // With cards on ONE issue, anything that flags the core term points straight
  // at what is being measured. The cards name their own term in their own text,
  // which is the participant's own briefing; nothing may label it as the
  // special one.
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      const t = getTask(taskId);
      const brief = t.roleBriefs[role];
      const surfaces = [
        t.publicBrief,
        brief.roleStory,
        brief.requirementNote,
        brief.batnaSummary,
        ...brief.objectives,
        ...brief.reasonCards.map((c) => c.text),
        ...brief.reasonCards.map((c) => c.relayed ?? ""),
      ];
      for (const text of surfaces) {
        assert.doesNotMatch(
          text,
          /sensitive background|work(ing)? reason card|tier|disclosure decision/i,
          `${taskId}/${role} names the mechanism`,
        );
      }
    }
  }
});

test("no brief promises a fallback score any more", () => {
  // Ver.2.21 made no agreement worth zero. The four batna sentences were the
  // last place the old 600 was stated to a participant.
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      const brief = getTask(taskId).roleBriefs[role];
      assert.doesNotMatch(brief.batnaSummary, /fallback score|600/i);
      assert.match(brief.batnaSummary, /\b0 points\b/);
    }
  }
});
