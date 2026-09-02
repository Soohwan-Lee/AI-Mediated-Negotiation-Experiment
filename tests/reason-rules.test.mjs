/**
 * The Ver.2.12 credibility ladder, tested against the shipped state machine
 * and validator (imported directly via tests/ts-register.mjs).
 *
 * WHAT IS LOAD-BEARING HERE (Design §3.3, §6.2, CLAUDE.md):
 *
 *  1. THE LADDER'S THREE RUNGS, in all four task × role cells: nothing voiced
 *     settles at 1,000 / 3,600 (joint 4,600), the work reason at
 *     2,000 / 3,300 (5,300), the sensitive background at 3,000 / 3,000
 *     (6,000 — the global maximum). Impasse pays 600 each. These exact
 *     numbers are §3.3's outcome ladder, and every one of them is below the
 *     next, so disclosure is monotonically rewarded and even the unargued
 *     agreement beats walking away.
 *
 *  2. SB VOICING IS THE ONLY BOTTLENECK. Once the SB tier is open the
 *     counterpart proposes best↔best ITSELF (SCRIPT-PROPOSE-MAX) — a
 *     participant does not need negotiation skill to reach the maximum, only
 *     the disclosure. And the maximum is NOT reachable by skill alone: an
 *     over-ask without the SB is countered at the tier package, never
 *     accepted.
 *
 *  3. THE SCHEDULE. The participant's proxy voices the SB at its FIRST
 *     reason opportunity when authorized (PRE-RECIP-SB depends on the SB
 *     landing before the counterpart's stage-4 disclosure), the WR otherwise,
 *     and no card twice. The Explorer pool keeps its separate allowance of
 *     one per issue and two per task on its own action field.
 *
 *  4. SCRIPT AND MACHINE AGREE. The mockup's ideal trajectory settles at
 *     exactly the package the machine would accept, in every cell.
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
  counterpartOpening,
  cardOfLayer,
} = await import("../src/lib/tasks.ts");
const {
  counterpartStep,
  counterpartStageAfter,
  buildProxyPlan,
  designatedReason,
  tierOf,
  tierPackage,
  maxPackage,
  acceptablePackage,
  mentionsScoreNumbers,
  codeOutcome,
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

/** The standard mandate: best on every term, floor at the requirement
 * threshold, the other term fully spendable. */
function standardMandate(task, role, authorizedReasonIds) {
  return {
    issues: task.issues.map((issue) => {
      const ranked = rankedOptions(task, issue.id, role);
      const isRequirement = issue.id === task.requirementIssueId[role];
      return {
        issueId: issue.id,
        preferredOptionId: ranked[0].id,
        minimumOptionId: isRequirement
          ? ranked[issue.requirementThresholdIndex ?? 1].id
          : ranked[ranked.length - 1].id,
      };
    }),
    authorizedReasonIds,
  };
}

// ---------------------------------------------------------------------------
// 1. The outcome ladder, four cells × three rungs
// ---------------------------------------------------------------------------

const LADDER = [
  { tier: "none", mine: 1000, theirs: 3600, joint: 4600 },
  { tier: "work", mine: 2000, theirs: 3300, joint: 5300 },
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
      assert.equal(coded.maxJoint, false);
      assert.equal(coded.concealPremium, 3000);
    });

    test(`${taskId}/${role}: the SB rung is the global maximum`, () => {
      const coded = codeOutcome(task, role, maxPackage(task, role), true);
      assert.equal(coded.jointPoints, 6000);
      assert.equal(coded.maxJoint, true);
      assert.equal(coded.unlocked, true);
      assert.equal(coded.concealPremium, 0);
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
      for (const tier of ["none", "work"]) {
        const d = counterpartStep(task, counterpart, 5, greedy, state(tier));
        assert.equal(d.accepts, false);
        assert.deepEqual(d.proposal, tierPackage(task, role, tier));
      }
    });

    test(`${taskId}/${role}: with the SB voiced, best↔best is accepted`, () => {
      const d = counterpartStep(task, counterpart, 5, best, state("sensitive"));
      assert.equal(d.accepts, true);
      assert.equal(d.action, "accept_sb");
    });

    test(`${taskId}/${role}: with the SB voiced, an out-of-tier ask is answered with the maximum`, () => {
      // Out of tier means asking the counterpart to give up its OWN core —
      // beyond what any rung concedes. The answer is the maximum the SB
      // earned, proposed directly (SCRIPT-PROPOSE-MAX) rather than refused.
      const theirs = counterRequirementIssue(task, role);
      const greedy = {
        ...best,
        [theirs.id]: rankedOptions(task, theirs.id, role)[0].id,
      };
      const d = counterpartStep(task, counterpart, 5, greedy, state("sensitive"));
      assert.equal(d.action, "propose_max");
      assert.deepEqual(d.proposal, best);
    });

    test(`${taskId}/${role}: the SB rung accepts LESS than the maximum, if that is what is asked`, () => {
      // Paying the full face cost opens the best option; it does not oblige
      // the participant to take it. Refusing a package that is strictly
      // better for the counterpart would punish the people who disclosed
      // most, which the outcome ladder cannot do.
      const modest = tierPackage(task, role, "work");
      const d = counterpartStep(task, counterpart, 5, modest, state("sensitive"));
      assert.equal(d.accepts, true);
      assert.equal(d.action, "accept_sb");
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

    test(`${taskId}/${role}: acceptance requires the counterpart's own core at its best`, () => {
      // Within tier on the participant's core, but shorting the counterpart
      // on theirs: not acceptable.
      const theirs = counterRequirementIssue(task, role);
      const shorted = {
        ...tierPackage(task, role, "work"),
        [theirs.id]: rankedOptions(task, theirs.id, counterpart)[1].id,
      };
      assert.equal(acceptablePackage(task, role, shorted, "work"), false);
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
      assert.equal(second.action, "counter_tier");
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

    test(`${taskId}/${role}: plan — WR only settles at the partial agreement`, () => {
      const plan = buildProxyPlan(
        task,
        role,
        standardMandate(task, role, [wr.id]),
      );
      assert.equal(plan.tier, "work");
      assert.deepEqual(plan.tentative, tierPackage(task, role, "work"));
      assert.equal(scorePackage(task, plan.tentative, role), 2000);
    });

    test(`${taskId}/${role}: plan — a minimum above the tier leaves no tentative`, () => {
      // Mandate: WR only, but minimum = own best option. The work tier's
      // second option is below that floor, so the proxies cannot settle and
      // the principals must close it directly.
      const req = requirementIssue(task, role);
      const mandate = standardMandate(task, role, [wr.id]);
      mandate.issues = mandate.issues.map((im) =>
        im.issueId === req.id
          ? { ...im, minimumOptionId: rankedOptions(task, req.id, role)[0].id }
          : im,
      );
      const plan = buildProxyPlan(task, role, mandate);
      assert.equal(plan.tentative, null);
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
    for (const condition of ["baseline", "delegate", "explorer"]) {
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

test("the counterpart's opening is its own best package on both terms", () => {
  for (const taskId of TASKS) {
    const task = getTask(taskId);
    for (const role of ROLES) {
      const opening = counterpartOpening(task, role);
      assert.equal(scorePackage(task, opening, role), 3900);
    }
  }
});

// ---------------------------------------------------------------------------
// 5. The Explorer pool budget (unchanged shape, on its own action field)
// ---------------------------------------------------------------------------

const task = getTask("task_a");

function poolAction(overrides = {}) {
  return {
    actionType: "propose",
    issueTargets: [],
    proposedTerms: [],
    conditionalLink: null,
    stage: 2,
    requirementStatus: "not_addressed",
    reasonSourceId: "a_wr_l",
    addedReasonSourceId: "pool:0",
    rationale: "Weekend cover matters, and steady weekend service is the baseline.",
    unresolved: true,
    internalProvenance: "pool_reason",
    ...overrides,
  };
}

test("the pool is additive: it rides beside a principal card in one message", () => {
  const result = validateAction(poolAction(), {
    issues: task.issues,
    policy: "explorer",
    actorRole: "leader",
    stage: 2,
    reasonsUsed: [],
    reasonKey: "rA",
    reasonIssueId: "weekend_shifts",
    addedReasonKey: "rPool0",
    addedReasonIssueId: "weekend_shifts",
  });
  assert.equal(result.valid, true);
});

test("a second pool reason on the same issue is over budget", () => {
  const result = validateAction(poolAction(), {
    issues: task.issues,
    policy: "explorer",
    actorRole: "leader",
    stage: 2,
    reasonsUsed: [
      { key: "rOld", issueId: "weekend_shifts", source: "pool" },
    ],
    reasonKey: "rA",
    reasonIssueId: "weekend_shifts",
    addedReasonKey: "rPool0",
    addedReasonIssueId: "weekend_shifts",
  });
  assert.equal(result.valid, false);
  assert.equal(result.violations[0].code, "rationale_budget_exceeded");
});

test("a third pool reason in the task is over budget", () => {
  const result = validateAction(poolAction(), {
    issues: task.issues,
    policy: "explorer",
    actorRole: "leader",
    stage: 2,
    reasonsUsed: [
      { key: "rOld1", issueId: "weekend_shifts", source: "pool" },
      { key: "rOld2", issueId: null, source: "pool" },
    ],
    reasonKey: "rA",
    reasonIssueId: "weekend_shifts",
    addedReasonKey: "rPool2",
    addedReasonIssueId: null,
  });
  assert.equal(result.valid, false);
  assert.equal(result.violations[0].code, "rationale_budget_exceeded");
});

test("a Delegate may not touch the pool at all", () => {
  const result = validateAction(poolAction(), {
    issues: task.issues,
    policy: "delegate",
    actorRole: "leader",
    stage: 2,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some((v) => v.code === "provenance_policy_violation"),
  );
});

test("the added slot carries the pool only, never a principal card", () => {
  const result = validateAction(
    poolAction({ addedReasonSourceId: "a_sb_l" }),
    {
      issues: task.issues,
      policy: "explorer",
      actorRole: "leader",
      stage: 2,
    },
  );
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some((v) => v.code === "provenance_policy_violation"),
  );
});

test("an unchecked card may not be voiced under either policy", () => {
  for (const policy of ["delegate", "explorer"]) {
    const result = validateAction(
      poolAction({ addedReasonSourceId: null, reasonSourceId: "a_sb_l" }),
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
