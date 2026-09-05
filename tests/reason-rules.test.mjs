/**
 * The Ver.2.20 credibility ladder, tested against the shipped state machine
 * and validator (imported directly via tests/ts-register.mjs).
 *
 * WHAT IS LOAD-BEARING HERE (Design §3.3, §6.2, CLAUDE.md):
 *
 *  1. THE LADDER'S FOUR RUNGS, SYMMETRIC, in all four task × role cells.
 *     Both sides land on the same rank: nothing voiced settles at
 *     1,600 / 1,600 (joint 3,200), the WORK REASON at the same 1,600 / 1,600
 *     — it is a DECOY and shares its rank with silence — a bare PRIORITY
 *     claim at 2,300 / 2,300 (4,600), and the sensitive background at
 *     3,000 / 3,000 (6,000, the global maximum). Impasse pays 600 each
 *     (1,200); an accepted misread pays 600 / 1,900 (2,500).
 *
 *     Every rung is above the 600 fallback, so even an unargued agreement
 *     beats walking away, and JOINT alone identifies the tier reached.
 *
 *  2. SB VOICING IS THE ONLY BOTTLENECK. The counterpart proposes at its own
 *     rung (SCRIPT-PROPOSE-T{tier}), so a participant does not need
 *     negotiation skill to reach the maximum, only the disclosure. And the
 *     maximum is NOT reachable by skill alone: an over-ask without the SB is
 *     rebalanced to the tier package (SCRIPT-BALANCE), never accepted — and
 *     nor is an UNDER-ask, so over-conceding cannot drag the outcome below
 *     the rung that was paid for.
 *
 *  3. THE SCHEDULE. The participant's proxy voices the SB at its FIRST
 *     reason opportunity when authorized (`SB` depends on the SB landing
 *     before the counterpart's stage-4 disclosure), the WR otherwise, and no
 *     card twice. Ver.2.20 DELETED the role-plausible pool and its per-issue
 *     allowance: AI-Supplemented now REPLACES the sensitive card with a fixed
 *     one-sentence abstraction said among two covers, so neither policy may
 *     add a reason of its own.
 *
 *  4. SCRIPT AND MACHINE AGREE. The mockup's ideal trajectory settles at
 *     exactly the package the machine would accept, in every cell.
 *
 *  5. THE PROXY'S TIER-2 FLOOR survives the trip to the closing conversation.
 *     `work` and `priority` are DIFFERENT rungs, and folding them together
 *     costs the participant a full option step — see the tests at the end.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const {
  getTask,
  reasonCards,
  requirementIssue,
  counterRequirementIssue,
  rankedOptions,
  scorePackage,
  cardOfLayer,
  abstractedReason,
} = await import("../src/lib/tasks.ts");
const {
  counterpartStep,
  counterpartStageAfter,
  buildProxyPlan,
  designatedReason,
  tierOf,
  tierPackage,
  maxPackage,
  misreadPackage,
  acceptablePackage,
  mentionsScoreNumbers,
  codeOutcome,
  foldTier,
  TIER_LIMIT_INDEX,
} = await import("../src/lib/negotiation/machine.ts");
const { validateAction } = await import("../src/lib/ai/validator.ts");
const { scriptedTask } = await import("../src/lib/negotiation/script.ts");

const ROLES = ["leader", "member"];
const TASKS = ["task_a", "task_b"];
const other = (role) => (role === "leader" ? "member" : "leader");

/** A plain trade-loop exchange state with everything one-shot already spent. */
const state = (tier, extra = {}) => ({
  tier,
  askedWhy: true,
  numbersReminded: true,
  ...extra,
});

/**
 * The standard mandate: the participant's hoped-for level on every term, plus
 * the reasons they authorized.
 *
 * NO FLOOR. Ver.2.13 §2.6 removed the range mandate: it could not change the
 * outcome, because the counterpart's policy is decisive, so all it could do
 * was manufacture an impasse and mix mandate-setting skill into the result.
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
// 1. The outcome ladder, four cells × three rungs
// ---------------------------------------------------------------------------

/**
 * Ver.2.13 §3.3 — the SYMMETRIC ladder. Both sides' cores land at the same
 * rank, so each rung pays both the same and JOINT is a monotone function of
 * the tier. That is what lets §9.6 drop UNLOCK, CONCEAL-PREMIUM and MAX-JOINT:
 * JOINT alone identifies the rung.
 */
/**
 * The ladder's DISTINCT rungs (Ver.2.16 §3.3).
 *
 * `work` is deliberately absent: under the decoy design the safe reason buys
 * nothing, so it shares the `none` rank. That is asserted separately below —
 * it is the single most important consequence of Ver.2.16 and the easiest
 * thing to undo by accident.
 */
const LADDER = [
  { tier: "none", mine: 1600, theirs: 1600, joint: 3200 },
  { tier: "priority", mine: 2300, theirs: 2300, joint: 4600 },
  { tier: "sensitive", mine: 3000, theirs: 3000, joint: 6000 },
];

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
        // …and every rung beats the fallback, so an unargued agreement is
        // still better than no deal.
        assert.ok(rung.mine > task.reservationPoints);
      });
    }

    test(`${taskId}/${role}: the ladder is strictly monotone for the discloser`, () => {
      const [a, b, c] = LADDER.map((r) =>
        scorePackage(task, tierPackage(task, role, r.tier), role),
      );
      assert.ok(a < b && b < c);
    });

    test(`${taskId}/${role}: impasse pays the fallback`, () => {
      const coded = codeOutcome(task, role, null, false);
      assert.equal(coded.participantPoints, 600);
      assert.equal(coded.jointPoints, 1200);
      assert.equal(coded.agreed, false);
    });

    test(`${taskId}/${role}: the SB rung is the global maximum`, () => {
      const coded = codeOutcome(task, role, maxPackage(task, role), true);
      assert.equal(coded.jointPoints, 6000);
      assert.equal(coded.participantPoints, 3000);
    });

    test(`${taskId}/${role}: JOINT alone identifies the rung (§9.6)`, () => {
      // This is the property the deleted measures rested on. If two rungs
      // ever shared a JOINT value, UNLOCK / CONCEAL-PREMIUM / MAX-JOINT would
      // have been carrying information JOINT does not, and dropping them
      // would have lost it.
      const joints = LADDER.map(
        (r) => codeOutcome(task, role, tierPackage(task, role, r.tier), true).jointPoints,
      );
      joints.push(codeOutcome(task, role, null, false).jointPoints);
      assert.equal(new Set(joints).size, joints.length);
      assert.deepEqual(joints, [3200, 4600, 6000, 1200]);
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

    test(`${taskId}/${role}: the work reason buys nothing (Ver.2.16 decoy)`, () => {
      // THE POINT OF THE WHOLE DECOY DESIGN. A WR is true and safe, but the
      // participant's core term is not that interest's obvious remedy, so it
      // earns exactly what silence earns. If this ever passes at 2,300 again,
      // the SB has stopped being the bottleneck and RQ1's primary outcome is
      // measuring something else.
      const none = tierPackage(task, role, "none");
      const work = tierPackage(task, role, "work");
      assert.deepEqual(work, none);
      assert.equal(scorePackage(task, work, role), 1600);
    });

    test(`${taskId}/${role}: the misread pays less than saying nothing`, () => {
      // SCRIPT-MISREAD offers the obvious remedy for the stated interest —
      // the participant's NON-core term — and asks their core at the
      // counterpart's best. Accepting it is worse than the unargued rung and
      // no better than impasse (§3.4: joint 2,500). §13-19 flags it for
      // softening if the pilot's acceptance rate clears gate 7.
      const mis = misreadPackage(task, role);
      assert.equal(scorePackage(task, mis, role), 600);
      assert.equal(scorePackage(task, mis, counterpart), 1900);
      assert.equal(
        scorePackage(task, mis, role) + scorePackage(task, mis, counterpart),
        2500,
      );
    });

    test(`${taskId}/${role}: the misread is offered once, then never again`, () => {
      // §6.2 `misread_pending`: only when a WR is all that has been voiced,
      // and only once per task.
      const first = counterpartStep(task, counterpart, 5, null, state("work"));
      assert.equal(first.action, "misread");
      assert.deepEqual(first.proposal, misreadPackage(task, role));

      const after = counterpartStep(
        task,
        counterpart,
        5,
        null,
        state("work", { misreadOffered: true }),
      );
      assert.notEqual(after.action, "misread");

      // It is never offered at a rung above the work reason.
      for (const tier of ["priority", "sensitive"]) {
        const d = counterpartStep(task, counterpart, 5, null, state(tier));
        assert.notEqual(d.action, "misread");
      }
    });

    test(`${taskId}/${role}: the counterpart honours its own misread offer`, () => {
      // It offered the thing sincerely, so it cannot refuse when taken up.
      const mis = misreadPackage(task, role);
      assert.equal(
        acceptablePackage(task, role, mis, "work", true),
        true,
      );
      // But not before it has been put on the table.
      assert.equal(
        acceptablePackage(task, role, mis, "work", false),
        false,
      );
    });

    test(`${taskId}/${role}: over-ask without SB is countered at the tier, never accepted`, () => {
      // The participant asks for everything: their best on their core AND
      // the counterpart's core conceded — better than best↔best for them.
      const greedy = {
        ...best,
        [counterRequirementIssue(task, role).id]: rankedOptions(
          task,
          counterRequirementIssue(task, role).id,
          role,
        )[0].id,
      };
      for (const tier of ["none", "priority"]) {
        const d = counterpartStep(task, counterpart, 5, greedy, state(tier));
        assert.equal(d.accepts, false);
        assert.deepEqual(d.proposal, tierPackage(task, role, tier));
      }
      // The work rung answers an over-ask with the misread first (once), and
      // still never accepts it.
      const w = counterpartStep(task, counterpart, 5, greedy, state("work"));
      assert.equal(w.accepts, false);
    });

    test(`${taskId}/${role}: with the SB voiced, best↔best is accepted`, () => {
      const d = counterpartStep(task, counterpart, 5, best, state("sensitive"));
      assert.equal(d.accepts, true);
      assert.equal(d.action, "accept_sb");
    });

    test(`${taskId}/${role}: with the SB voiced, an out-of-tier ask is rebalanced`, () => {
      // Out of tier means asking the counterpart to give up its OWN core —
      // beyond what any rung concedes. SCRIPT-BALANCE names it as one-sided
      // and re-puts the symmetric package, which at this rung is best↔best.
      const theirs = counterRequirementIssue(task, role);
      const greedy = {
        ...best,
        [theirs.id]: rankedOptions(task, theirs.id, role)[0].id,
      };
      const d = counterpartStep(task, counterpart, 5, greedy, state("sensitive"));
      assert.equal(d.action, "balance");
      assert.deepEqual(d.proposal, best);
    });

    test(`${taskId}/${role}: an UNDER-ask is refused too (Ver.2.13 §6.2)`, () => {
      // A package worse for the participant than their rung allows is
      // rebalanced rather than taken. Ver.2.12 accepted these, which let a
      // participant's over-concession mix into the primary outcome; the
      // symmetric rule closes that — "I ask for no more than I move, and no
      // less either."
      const modest = tierPackage(task, role, "work");
      const d = counterpartStep(task, counterpart, 5, modest, state("sensitive"));
      assert.equal(d.accepts, false);
      assert.equal(d.action, "balance");
      assert.deepEqual(d.proposal, best);
    });

    test(`${taskId}/${role}: a max discloser is never left to run the clock out`, () => {
      // The ladder inverts if they can: 600 for the participant who paid the
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
      // Either side of it is refused. Shorting the counterpart on its own
      // core is an over-ask; conceding past the rung is an under-ask.
      const theirs = counterRequirementIssue(task, role);
      const shorted = {
        ...tierPackage(task, role, "priority"),
        [theirs.id]: rankedOptions(task, theirs.id, counterpart)[0].id,
      };
      assert.equal(acceptablePackage(task, role, shorted, "priority"), false);
      assert.equal(
        acceptablePackage(task, role, tierPackage(task, role, "none"), "priority"),
        false,
      );
      assert.equal(
        acceptablePackage(task, role, tierPackage(task, role, "work"), "work"),
        true,
      );
    });

    test(`${taskId}/${role}: every rung moves BOTH sides equally`, () => {
      // The symmetry itself, in one assertion: at each rung the two sides
      // score the same. Ver.2.12 held the counterpart at 3,000+ throughout,
      // and §2.6 removed that as a face threat in its own right.
      for (const rung of LADDER) {
        const pkg = tierPackage(task, role, rung.tier);
        assert.equal(
          scorePackage(task, pkg, role),
          scorePackage(task, pkg, counterpart),
        );
      }
    });

    test(`${taskId}/${role}: a reason-free ask gets one why, then the tier speaks`, () => {
      const greedy = best;
      const first = counterpartStep(
        task,
        counterpart,
        5,
        greedy,
        state("none", { askedWhy: false }),
      );
      assert.equal(first.action, "ask_why");
      const second = counterpartStep(task, counterpart, 5, greedy, state("none"));
      assert.equal(second.action, "balance");
    });
  }
}

test("the counterpart walks open → WR+ask → SB disclosure → trade loop", () => {
  assert.equal(counterpartStageAfter(0), 1);
  assert.equal(counterpartStageAfter(1), 2);
  assert.equal(counterpartStageAfter(2), 4);
  assert.equal(counterpartStageAfter(3), 5);
  assert.equal(counterpartStageAfter(9), 5);
});

test("the counterpart's stage-4 move is its own SB disclosure, unconditional", () => {
  const task = getTask("task_a");
  const d = counterpartStep(task, "member", 4, null, state("none"));
  assert.equal(d.action, "disclose_sb");
  // The counterpart holds an SB card of its own to disclose.
  assert.ok(cardOfLayer(task, "member", "sensitive"));
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

test("mentionsScoreNumbers catches score talk and passes shift counts", () => {
  assert.equal(mentionsScoreNumbers("I get 3000 for that"), true);
  assert.equal(mentionsScoreNumbers("that's worth more points to me"), true);
  assert.equal(mentionsScoreNumbers("my score sheet says otherwise"), true);
  assert.equal(mentionsScoreNumbers("could we do 3 per week?"), false);
  assert.equal(mentionsScoreNumbers("4 per month is a lot"), false);
});

/**
 * THE CLIENT AND THE SERVER MUST DECIDE THE SAME THING.
 *
 * Both run `counterpartStep`. The client codes the outcome from ITS decision;
 * the participant reads the sentence the server rendered from the server's.
 * So every field of `ExchangeState` has to reach the route unchanged — and
 * this test exists because one of them (`numbersMentionedNow`) was computed
 * separately on each side, which flips `accepts` on an otherwise identical
 * package: a participant could be shown "let's not talk scores" and be
 * recorded as having agreed.
 */
test("every ExchangeState field can change the decision, so all of them travel", () => {
  const task = getTask("task_a");
  const best = maxPackage(task, "member");
  const base = {
    tier: "sensitive",
    askedWhy: true,
    numbersReminded: false,
    numbersMentionedNow: false,
    secondsRemaining: 300,
    softCloseOffered: false,
  };
  const decide = (over) =>
    counterpartStep(task, "leader", 5, best, { ...base, ...over });

  // The baseline: an accepted best↔best.
  assert.equal(decide({}).accepts, true);

  // Flipping the one field that used to be re-derived server-side changes
  // agreement to no-agreement. If this ever stops being true the field has
  // become inert and the check below is worth revisiting; while it IS true,
  // the field must be sent rather than recomputed.
  assert.equal(decide({ numbersMentionedNow: true }).accepts, false);
  assert.equal(decide({ numbersMentionedNow: true }).action, "nonum");

  // The same for the other one-shots, so none of them is quietly dropped
  // from a request body later.
  assert.equal(decide({ tier: "work" }).accepts, false);
  assert.equal(decide({ secondsRemaining: 0 }).impasse, true);
});

test("a low clock offers SCRIPT-CLOSE once, expiry is an impasse", () => {
  const task = getTask("task_a");
  const greedy = maxPackage(task, "leader");
  const close = counterpartStep(task, "member", 5, greedy, {
    ...state("work"),
    secondsRemaining: 30,
  });
  assert.equal(close.action, "soft_close");
  assert.deepEqual(close.proposal, tierPackage(task, "leader", "work"));
  const expired = counterpartStep(task, "member", 5, greedy, {
    ...state("work"),
    secondsRemaining: 0,
  });
  assert.equal(expired.impasse, true);
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
    });

    test(`${taskId}/${role}: SB authorized → SB voiced at the first reason opportunity`, () => {
      const card = designatedReason(task, role, 2, [wr.id, sb.id]);
      assert.equal(card?.id, sb.id);
    });

    test(`${taskId}/${role}: WR only → WR voiced, and an unticked SB never is`, () => {
      const card = designatedReason(task, role, 2, [wr.id]);
      assert.equal(card?.id, wr.id);
      // Even after the WR is spent, the unticked SB is not designated.
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
    });

    test(`${taskId}/${role}: plan — WR only settles at the priority rung`, () => {
      // TIER 2 IS THE PROXY'S FLOOR (§6.5, §6.9 #1). The proxy holds the
      // preferred package, so it always states which term matters more —
      // it declines the misread and claims the priority. A Direct
      // participant need not, which is the §13-13② asymmetry.
      const plan = buildProxyPlan(
        task,
        role,
        standardMandate(task, role, [wr.id]),
      );
      assert.equal(plan.tier, "priority");
      assert.deepEqual(plan.tentative, tierPackage(task, role, "priority"));
      assert.equal(scorePackage(task, plan.tentative, role), 2300);
    });

    test(`${taskId}/${role}: plan — checking nothing still reaches tier 2`, () => {
      // §6.9 #12: WR unchecked and SB unchecked. The proxy still knows the
      // preferred package, so it still states the priority — the bottom rung
      // is unreachable through a proxy.
      const plan = buildProxyPlan(task, role, standardMandate(task, role, []));
      assert.equal(plan.tier, "priority");
      assert.equal(scorePackage(task, plan.tentative, role), 2300);
    });

    test(`${taskId}/${role}: plan — the proxies always reach a package`, () => {
      // With the mandate floor gone (Ver.2.13 §2.6) there is nothing that can
      // stop the proxies settling at the rung the reasons earned, at any rung.
      // The participant's control is the reason checkboxes before and RATIFY
      // after — not a range the proxy could fail to clear.
      for (const ids of [[], [wr.id], [wr.id, sb.id]]) {
        const plan = buildProxyPlan(task, role, standardMandate(task, role, ids));
        assert.ok(plan.tentative, `no tentative for ${ids.length} card(s)`);
        assert.deepEqual(plan.tentative, tierPackage(task, role, plan.tier));
      }
    });
  }
}

test("tierOf reads layers and ignores everything else", () => {
  assert.equal(tierOf([]), "none");
  assert.equal(tierOf([{ layer: "work" }]), "work");
  assert.equal(tierOf([{ layer: "work" }, { layer: "sensitive" }]), "sensitive");
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

        // The participant side voices the SB before the counterpart's SB
        // disclosure — the PRE-RECIP-SB path the mockup demonstrates.
        const participantSpeakers = ["participant", "participant_proxy"];
        const counterpartSpeakers = ["counterpart", "counterpart_proxy"];
        const sb = reasonCards(task, role).find(
          (c) => c.layer === "sensitive",
        );
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

test("the counterpart's opening carries NO package (Ver.2.13 §6.1)", () => {
  // The anchored opening — "my best, your worst" — is gone. §2.6 identifies it
  // as a face threat in its own right: the non-negotiable, lowball offer
  // White et al. (2004) name, which made a high-FTS participant competitive by
  // a route that has nothing to do with self-disclosure. The first package the
  // participant ever sees is now the symmetric tier one.
  for (const taskId of TASKS) {
    const task = getTask(taskId);
    for (const role of ROLES) {
      const d = counterpartStep(task, role, 1, null, state("none"));
      assert.equal(d.action, "open");
      assert.equal(d.proposal, null);
      assert.equal(d.accepts, false);
    }
  }
});

// ---------------------------------------------------------------------------
// 5. No additive reasons — the Ver.2.20 abstraction policy
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

test("no policy may add a reason beside the principal's card", () => {
  // Ver.2.20 ABOLISHED THE POOL. AI-Supplemented no longer adds to the card —
  // it REPLACES the card with the §6.6 abstraction and says it among two
  // covers, all three supplied by the route. So there is nothing legitimate
  // for a model to put in `addedReasonSourceId` under EITHER policy, and a
  // value there means it invented a reason of its own.
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

test("every sensitive card carries its §6.6 abstraction and two covers", () => {
  // The twelve sentences are FIXED (§6.6) — the model joins them, it never
  // writes them, because what survives the abstraction IS the manipulation.
  // A card missing them would silently fall back to relaying the card whole,
  // making AI-Supplemented identical to User-Specified.
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      const sb = cardOfLayer(getTask(taskId), role, "sensitive");
      const rendered = abstractedReason(sb);
      assert.ok(rendered, `${taskId}/${role} has no abstraction`);
      assert.equal(rendered.cover.length, 2);
      // The abstraction must not reproduce the card: it keeps the KIND of
      // fact and drops the event, the third party's words, and the
      // concealment. If it contained the card's own text the policies would
      // differ in nothing.
      assert.notEqual(rendered.abstract, sb.text);
      assert.ok(rendered.abstract.length < sb.text.length);
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

// ---------------------------------------------------------------------------
// The proxy's tier-2 floor, on the wire between the route and the closing.
//
// THIS REGRESSION HAS NOW HAPPENED TWICE, in the two halves of the same wire.
// The server was fixed first (`voicedTier` folds `"priority"` in
// unconditionally, api/proxy-negotiation). The CLIENT kept a hand-written
// ternary that collapsed everything below `sensitive` to `work` — and it typed
// the response inline without `"priority"`, so `tsc` could not see the
// mismatch with the server's own union.
//
// The cost is the one the server's comment names: a participant who authorized
// no sensitive card watches the proxies settle at 2,300/2,300, takes over at
// RATIFY, and is offered 1,600 — below the package still on screen. It lands
// on Points/JOINT in the Proxy arm only, i.e. along the primary contrast.
//
// `foldTier` is the fix in both places. These pin WHY it cannot be a ternary.
// ---------------------------------------------------------------------------

test("work and priority are different rungs, so collapsing them costs points", () => {
  assert.notEqual(
    TIER_LIMIT_INDEX.work,
    TIER_LIMIT_INDEX.priority,
    "if these ever match, the ternary that collapsed them was harmless — " +
      "and the decoy ladder has lost its middle rung",
  );
  assert.equal(TIER_LIMIT_INDEX.work, 2);
  assert.equal(TIER_LIMIT_INDEX.priority, 1);
});

test("foldTier carries priority through, where a ternary dropped it", () => {
  // The exact folds the proxy closing performs as each turn's voicedTier
  // arrives. A `sensitive`-or-`work` ternary gets the middle two wrong.
  assert.equal(foldTier("none", "priority"), "priority");
  assert.equal(foldTier("work", "priority"), "priority");
  assert.equal(foldTier("priority", "priority"), "priority");
  assert.equal(foldTier("priority", "work"), "priority");
  assert.equal(foldTier("priority", "sensitive"), "sensitive");
  assert.equal(foldTier("sensitive", "priority"), "sensitive");
});
