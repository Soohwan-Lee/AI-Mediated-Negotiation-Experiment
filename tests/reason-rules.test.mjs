/**
 * The ver.2.5 reason rules, tested against the shipped state machine and
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
 *  2. THE PER-ISSUE REASON BUDGETS. Principal cards: at most one distinct
 *     kind per issue per task. Explorer pool: a SEPARATE allowance — at most
 *     one per issue and two per task. Merging the two buckets was tried once
 *     and re-created the Explorer − Delegate stripping bias documented in
 *     lib/ai/validator.ts, so the separation itself is asserted.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const {
  getTask,
  reasonCards,
  scorePackage,
  counterpartOpening,
  preservesRequirement,
} = await import("../src/lib/tasks.ts");
const { counterpartStep, buildProxyPlan, ACCEPTANCE } = await import(
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

function actionWith(reasonSourceId, provenance = "principal_reason") {
  return {
    actionType: "propose",
    stage: 4,
    issueTargets: [],
    proposedTerms: [],
    conditionalLink: null,
    requirementStatus: "held",
    reasonSourceId,
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

test("a second principal kind on the same issue is over budget", () => {
  const result = validateAction(actionWith("a_i1_sb_l"), {
    ...baseCtx,
    reasonsUsed: [used("k1", "quality_reviews", "principal")],
    reasonKey: "k2",
    reasonIssueId: "quality_reviews",
  });
  assert.ok(
    result.violations.some((v) => v.code === "rationale_budget_exceeded"),
  );
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

test("the pool is additive: a pool reason joins a principal one on the same issue", () => {
  // This is the separation whose loss re-created the Explorer − Delegate
  // stripping bias: the pool must NOT consume the principal's issue slot.
  const result = validateAction(actionWith("pool:0", "pool_reason"), {
    ...baseCtx,
    reasonsUsed: [used("k1", "quality_reviews", "principal")],
    reasonKey: "p0",
    reasonIssueId: "quality_reviews",
  });
  assert.equal(result.valid, true);
});

test("a second pool reason on the same issue is over budget", () => {
  const result = validateAction(actionWith("pool:0", "pool_reason"), {
    ...baseCtx,
    reasonsUsed: [used("p9", "quality_reviews", "pool")],
    reasonKey: "p0",
    reasonIssueId: "quality_reviews",
  });
  assert.ok(
    result.violations.some((v) => v.code === "rationale_budget_exceeded"),
  );
});

test("a third pool reason in the task is over budget", () => {
  const result = validateAction(actionWith("pool:2", "pool_reason"), {
    ...baseCtx,
    reasonsUsed: [
      used("p0", "quality_reviews", "pool"),
      used("p1", "focus_afternoons", "pool"),
    ],
    reasonKey: "p2",
    reasonIssueId: "pilot_start",
  });
  assert.ok(
    result.violations.some((v) => v.code === "rationale_budget_exceeded"),
  );
});

test("the exchange pool item escapes the per-issue cap but not the per-task cap", () => {
  const fine = validateAction(actionWith("pool:3", "pool_reason"), {
    ...baseCtx,
    reasonsUsed: [used("p0", "quality_reviews", "pool")],
    reasonKey: "p3",
    reasonIssueId: null,
  });
  assert.equal(fine.valid, true);

  const over = validateAction(actionWith("pool:3", "pool_reason"), {
    ...baseCtx,
    reasonsUsed: [
      used("p0", "quality_reviews", "pool"),
      used("p1", "focus_afternoons", "pool"),
    ],
    reasonKey: "p3",
    reasonIssueId: null,
  });
  assert.ok(
    over.violations.some((v) => v.code === "rationale_budget_exceeded"),
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
