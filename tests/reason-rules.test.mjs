/**
 * The ver.2.6 reason rules, tested against the shipped state machine and
 * validator (imported directly via tests/ts-register.mjs).
 *
 * WHAT IS LOAD-BEARING HERE. Two invariants from CLAUDE.md and Design §4/§7:
 *
 *  1. THE REASON-LINKED ACCEPTANCE RULE, issue-scoped. Giving a reason FOR THE
 *     REQUIREMENT preserves it; never giving one loses it — in all four
 *     task × role cells. Since ver.2.5 the cards span all three issues, so
 *     the callers of `counterpartStep` must scope the flag to the requirement
 *     issue: a reason about the timing term is NOT a reason to concede the
 *     requirement. The machine itself receives a boolean; the four-cell test
 *     here pins the machine's half, and the scoping test pins the shape the
 *     call sites rely on (a card's `issueId` decides whether it counts).
 *
 *  2. THE REASON SCHEDULE AND THE POOL BUDGET. Ver.2.6 dropped the ver.2.5
 *     cap of one principal reason kind per issue: it meant a ticked sensitive
 *     card on the requirement issue was never voiced, because the default-on
 *     work reason spent the issue's only slot at stage 2. Both cards must now
 *     be reachable across a task — WR at stage 2, SB at stage 4 — and "each
 *     card at most once" is a property of `designatedReason`, not a validator
 *     violation, because a violation blanks the message and nulls its reason
 *     token. The Explorer pool keeps its SEPARATE allowance of one per issue
 *     and two per task, now on its own action field so it is additive;
 *     merging the two buckets was tried once and re-created the
 *     Explorer − Delegate stripping bias documented in lib/ai/validator.ts.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const {
  getTask,
  reasonCards,
  requirementIssue,
  scorePackage,
  counterpartOpening,
  preservesRequirement,
} = await import("../src/lib/tasks.ts");
const { counterpartStep, buildProxyPlan, designatedReason, ACCEPTANCE } = await import(
  "../src/lib/negotiation/machine.ts"
);
const { validateAction } = await import("../src/lib/ai/validator.ts");

const ROLES = ["leader", "member"];
const TASKS = ["task_a", "task_b"];

const other = (role) => (role === "leader" ? "member" : "leader");

/** The standard mandate mockup mode uses: best on every term, floor at the
 * requirement threshold, everything else spendable. */
function standardMandate(task, role) {
  return {
    issues: task.issues.map((issue) => {
      const ranked = [...issue.options].sort(
        (a, b) => b.points[role] - a.points[role],
      );
      const isRequirement = issue.id === task.requirementIssueId[role];
      return {
        issueId: issue.id,
        preferredOptionId: ranked[0].id,
        minimumOptionId: isRequirement
          ? ranked[issue.requirementThresholdIndex ?? 1].id
          : ranked[ranked.length - 1].id,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// 1. Reason-linked acceptance, four cells
// ---------------------------------------------------------------------------

for (const taskId of TASKS) {
  for (const role of ROLES) {
    const task = getTask(taskId);
    const counterpart = other(role);
    // The participant's counterpackage from the standard mandate: holds their
    // requirement, pays for it elsewhere. This is the package whose fate the
    // reason rule decides.
    const plan = buildProxyPlan(task, role, standardMandate(task, role));
    const ask = plan.counterpackage;

    test(`${taskId}/${role}: reason given → requirement conceded`, () => {
      const decision = counterpartStep(
        task,
        counterpart,
        4,
        ask,
        counterpartOpening(task, counterpart),
        { reasonGivenForRequirement: true, reasonAlreadyRequested: false },
      );
      assert.equal(decision.accepts, true);
      const requirementIssueId = task.requirementIssueId[role];
      assert.equal(decision.proposal[requirementIssueId], ask[requirementIssueId]);
    });

    test(`${taskId}/${role}: no reason → asked once, then requirement withheld`, () => {
      const held = counterpartOpening(task, counterpart);
      const first = counterpartStep(task, counterpart, 4, ask, held, {
        reasonGivenForRequirement: false,
        reasonAlreadyRequested: false,
      });
      assert.equal(first.action, "request_reason");
      assert.equal(first.accepts, false);

      const second = counterpartStep(task, counterpart, 4, ask, held, {
        reasonGivenForRequirement: false,
        reasonAlreadyRequested: true,
      });
      // The concession is withheld, not the agreement: the package is taken
      // with the requirement left where the counterpart stands.
      assert.equal(second.action, "hold");
      assert.equal(second.accepts, true);
      const requirementIssueId = task.requirementIssueId[role];
      assert.equal(second.proposal[requirementIssueId], held[requirementIssueId]);
      assert.notEqual(second.proposal[requirementIssueId], ask[requirementIssueId]);
    });

    test(`${taskId}/${role}: reason given preserves the requirement, withheld loses it`, () => {
      const held = counterpartOpening(task, counterpart);
      const withReason = counterpartStep(task, counterpart, 4, ask, held, {
        reasonGivenForRequirement: true,
        reasonAlreadyRequested: false,
      });
      const withheld = counterpartStep(task, counterpart, 4, ask, held, {
        reasonGivenForRequirement: false,
        reasonAlreadyRequested: true,
      });
      const requirementIssueId = task.requirementIssueId[role];
      assert.equal(
        preservesRequirement(
          task,
          role,
          withReason.proposal[requirementIssueId],
        ),
        true,
      );
      assert.equal(
        preservesRequirement(task, role, withheld.proposal[requirementIssueId]),
        false,
      );
      // Both are agreements — what the rule withholds is the concession, not
      // the deal — and the gap is symmetric across all four cells. An
      // asymmetric gap means a payoff was edited on one side only.
      const gained = scorePackage(task, withReason.proposal, role);
      const lost = scorePackage(task, withheld.proposal, role);
      assert.equal(gained - lost, 3000);
    });
  }
}

// ---------------------------------------------------------------------------
// 2. Issue scoping — the shape the call sites rely on
// ---------------------------------------------------------------------------

for (const taskId of TASKS) {
  for (const role of ROLES) {
    test(`${taskId}/${role}: every card carries its issue, one WR + one SB per issue`, () => {
      const task = getTask(taskId);
      const cards = reasonCards(task, role);
      assert.equal(cards.length, 6);
      for (const issue of task.issues) {
        const onIssue = cards.filter((c) => c.issueId === issue.id);
        assert.equal(onIssue.length, 2, `${issue.id} has WR+SB`);
        assert.equal(onIssue.filter((c) => c.layer === "work").length, 1);
        assert.equal(
          onIssue.filter((c) => c.layer === "sensitive").length,
          1,
        );
      }
      // The scoping the acceptance rule's call sites perform: a voiced card
      // counts only if it sits on the role's own requirement issue.
      const requirementIssueId = task.requirementIssueId[role];
      const timingCard = cards.find(
        (c) => c.issueId !== requirementIssueId && c.layer === "work",
      );
      const requirementCard = cards.find(
        (c) => c.issueId === requirementIssueId && c.layer === "work",
      );
      const counts = (voicedIds) =>
        voicedIds.some(
          (id) =>
            cards.find((c) => c.id === id)?.issueId === requirementIssueId,
        );
      assert.equal(counts([timingCard.id]), false);
      assert.equal(counts([timingCard.id, requirementCard.id]), true);
    });
  }
}

// ---------------------------------------------------------------------------
// 3. Per-issue budgets in the validator
// ---------------------------------------------------------------------------

const task = getTask("task_a");

function actionWith(
  reasonSourceId,
  provenance = "principal_reason",
  addedReasonSourceId = null,
) {
  return {
    actionType: "propose",
    stage: 4,
    issueTargets: [],
    proposedTerms: [],
    conditionalLink: null,
    requirementStatus: "held",
    reasonSourceId,
    addedReasonSourceId,
    rationale: "A plain message.",
    unresolved: false,
    internalProvenance: provenance,
  };
}

const baseCtx = {
  issues: task.issues,
  policy: "explorer",
  actorRole: "leader",
  stage: 4,
};

const used = (key, issueId, source) => ({ key, issueId, source });

test("both of an issue's cards may be voiced across the task (ver.2.6)", () => {
  // THE INVERSE OF THE VER.2.5 RULE, and the reason it changed. The old cap
  // allowed one reason KIND per issue for the whole task, so a participant who
  // ticked the sensitive background on their requirement issue got a proxy
  // that spent the slot on the default-on work reason at stage 2 and could
  // never say the sensitive one. Voicing the second card must now be clean —
  // per-card-once is kept by the schedule in machine.ts, not by a violation
  // here, because a violation would blank the message and null its token.
  const result = validateAction(actionWith("a_i1_sb_l"), {
    ...baseCtx,
    reasonsUsed: [used("k1", "quality_reviews", "principal")],
    reasonKey: "k2",
    reasonIssueId: "quality_reviews",
  });
  assert.equal(result.valid, true);
});

test("repeating the same principal reason is fine", () => {
  const result = validateAction(actionWith("a_i1_wr_l"), {
    ...baseCtx,
    reasonsUsed: [used("k1", "quality_reviews", "principal")],
    reasonKey: "k1",
    reasonIssueId: "quality_reviews",
  });
  assert.equal(result.valid, true);
});

test("a principal reason on a different issue is fine", () => {
  const result = validateAction(actionWith("a_i2_wr_l"), {
    ...baseCtx,
    reasonsUsed: [used("k1", "quality_reviews", "principal")],
    reasonKey: "k2",
    reasonIssueId: "focus_afternoons",
  });
  assert.equal(result.valid, true);
});

test("the pool is additive: it rides beside a principal card in one message", () => {
  // The ver.2.6 shape. Both slots are filled on the SAME action — the card in
  // reasonSourceId, the pool clause in addedReasonSourceId — which is what
  // "additive" means and what the single field could not express. The pool
  // must not consume the principal's slot; that separation is what keeps the
  // Explorer − Delegate stripping bias from coming back.
  const result = validateAction(
    actionWith("a_i1_wr_l", "pool_reason", "pool:0"),
    {
      ...baseCtx,
      reasonsUsed: [used("k1", "quality_reviews", "principal")],
      reasonKey: "k1",
      reasonIssueId: "quality_reviews",
      addedReasonKey: "p0",
      addedReasonIssueId: "quality_reviews",
    },
  );
  assert.equal(result.valid, true);
});

test("a second pool reason on the same issue is over budget", () => {
  const result = validateAction(
    actionWith("a_i1_wr_l", "pool_reason", "pool:0"),
    {
      ...baseCtx,
      reasonsUsed: [used("p9", "quality_reviews", "pool")],
      addedReasonKey: "p0",
      addedReasonIssueId: "quality_reviews",
    },
  );
  assert.ok(
    result.violations.some((v) => v.code === "rationale_budget_exceeded"),
  );
});

test("a third pool reason in the task is over budget", () => {
  const result = validateAction(
    actionWith("a_i1_wr_l", "pool_reason", "pool:2"),
    {
      ...baseCtx,
      reasonsUsed: [
        used("p0", "quality_reviews", "pool"),
        used("p1", "focus_afternoons", "pool"),
      ],
      addedReasonKey: "p2",
      addedReasonIssueId: "pilot_start",
    },
  );
  assert.ok(
    result.violations.some((v) => v.code === "rationale_budget_exceeded"),
  );
});

test("the exchange pool item escapes the per-issue cap but not the per-task cap", () => {
  const fine = validateAction(
    actionWith("a_i1_wr_l", "pool_reason", "pool:3"),
    {
      ...baseCtx,
      reasonsUsed: [used("p0", "quality_reviews", "pool")],
      addedReasonKey: "p3",
      addedReasonIssueId: null,
    },
  );
  assert.equal(fine.valid, true);

  const over = validateAction(
    actionWith("a_i1_wr_l", "pool_reason", "pool:3"),
    {
      ...baseCtx,
      reasonsUsed: [
        used("p0", "quality_reviews", "pool"),
        used("p1", "focus_afternoons", "pool"),
      ],
      addedReasonKey: "p3",
      addedReasonIssueId: null,
    },
  );
  assert.ok(
    over.violations.some((v) => v.code === "rationale_budget_exceeded"),
  );
});

test("a Delegate may not fill the added slot either", () => {
  const result = validateAction(
    actionWith("a_i1_wr_l", "pool_reason", "pool:0"),
    {
      ...baseCtx,
      policy: "delegate",
      reasonsUsed: [],
      addedReasonKey: "p0",
      addedReasonIssueId: "quality_reviews",
    },
  );
  assert.ok(
    result.violations.some((v) => v.code === "provenance_policy_violation"),
  );
});

test("the added slot carries the pool only, never a principal card", () => {
  // A card there would slip past the disclosure-permission check, which reads
  // the first slot — so an unticked sensitive card could be voiced.
  const result = validateAction(
    actionWith("a_i1_wr_l", "principal_reason", "a_i1_sb_l"),
    { ...baseCtx, reasonsUsed: [] },
  );
  assert.ok(
    result.violations.some((v) => v.code === "provenance_policy_violation"),
  );
});

test("a Delegate may not touch the pool at all", () => {
  const result = validateAction(actionWith("pool:0", "pool_reason"), {
    ...baseCtx,
    policy: "delegate",
    reasonsUsed: [],
    reasonKey: "p0",
    reasonIssueId: "quality_reviews",
  });
  assert.ok(
    result.violations.some((v) => v.code === "provenance_policy_violation"),
  );
});

// ---------------------------------------------------------------------------
// 4. The mockup scripts' settlement is what the machine produces
// ---------------------------------------------------------------------------

for (const taskId of TASKS) {
  for (const role of ROLES) {
    test(`${taskId}/${role}: standard mandate settles at 4,200 / 3,600`, () => {
      const t = getTask(taskId);
      const plan = buildProxyPlan(t, role, standardMandate(t, role));
      assert.equal(scorePackage(t, plan.counterpackage, role), 4200);
      assert.equal(scorePackage(t, plan.counterpackage, other(role)), 3600);
      assert.ok(
        scorePackage(t, plan.counterpackage, other(role)) >= ACCEPTANCE.T_MID,
      );
    });
  }
}

// ---------------------------------------------------------------------------
// 5. Ver.2.6 §5 card-writing rules: speakability and the argument link
// ---------------------------------------------------------------------------
//
// Both are properties of the CARD TEXT, which is the string the proxy says out
// loud. They are pinned here because the failure is silent: a card that
// describes its own privacy still renders, still passes the guardrail, and
// only reads as wrong in a transcript nobody re-reads.

for (const taskId of TASKS) {
  for (const role of ROLES) {
    test(`${taskId}/${role}: sensitive cards are speakable aloud`, () => {
      const cards = reasonCards(getTask(taskId), role).filter(
        (c) => c.layer === "sensitive",
      );
      assert.ok(cards.length > 0);
      for (const card of cards) {
        // "only you know" / "no one else knows" describe the fact as private.
        // Spoken to the other side they contradict the act of speaking them.
        assert.doesNotMatch(
          card.text,
          /only you know|no one else knows|nobody else knows/i,
          `${card.id} states its own privacy; use the confessional form instead`,
        );
      }
    });
  }
}

// ---------------------------------------------------------------------------
// 6. The reason schedule (Ver.2.6 §7) — the fix for "SB never gets said"
// ---------------------------------------------------------------------------

for (const taskId of TASKS) {
  for (const role of ROLES) {
    const t = getTask(taskId);
    const req = requirementIssue(t, role);
    const cards = reasonCards(t, role).filter((c) => c.issueId === req.id);
    const wr = cards.find((c) => c.layer === "work");
    const sb = cards.find((c) => c.layer === "sensitive");
    const both = [wr.id, sb.id];

    test(`${taskId}/${role}: with both ticked, WR at stage 2 and SB at stage 4`, () => {
      // The whole point of ver.2.6. Under the old rule the stage-2 pick
      // consumed the issue and the sensitive card was never voiced, so a
      // participant's disclosure decision had no effect on the negotiation.
      const first = designatedReason(t, role, 2, both);
      assert.equal(first.id, wr.id);

      const second = designatedReason(t, role, 4, both, {
        alreadyVoiced: [first.id],
      });
      assert.equal(second.id, sb.id);
    });

    test(`${taskId}/${role}: an unticked SB is never designated`, () => {
      const only = [wr.id];
      assert.equal(designatedReason(t, role, 2, only).id, wr.id);
      // Stage 4 prefers the sensitive card, but it was not authorized: the
      // work reason is restated rather than the withheld card leaking.
      assert.equal(designatedReason(t, role, 4, only).id, wr.id);
      // And once it has been spent there is nothing left to designate.
      assert.equal(
        designatedReason(t, role, 4, only, { alreadyVoiced: [wr.id] }),
        null,
      );
    });

    test(`${taskId}/${role}: an SB ticked alone is voiced at stage 2`, () => {
      // Something has to be said when the priority is stated, and this is the
      // only thing authorized on the issue.
      assert.equal(designatedReason(t, role, 2, [sb.id]).id, sb.id);
    });

    test(`${taskId}/${role}: no card is ever designated twice`, () => {
      const voiced = [];
      for (const stage of [2, 4, 5]) {
        const card = designatedReason(t, role, stage, both, {
          alreadyVoiced: voiced,
        });
        if (card) {
          assert.ok(!voiced.includes(card.id), `${card.id} designated twice`);
          voiced.push(card.id);
        }
      }
      assert.deepEqual(voiced, both);
    });
  }
}
