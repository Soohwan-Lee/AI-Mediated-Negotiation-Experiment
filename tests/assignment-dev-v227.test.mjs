import assert from "node:assert/strict";
import test from "node:test";

import {
  ordersForSequence,
  resolveAssignment,
  sequenceForOrders,
  sessionFingerprint,
  sessionPlan,
} from "../src/lib/assignment.ts";

const policies = ["user_specified", "ai_supplemented"];
const roles = ["leader", "member"];
const combinations = [
  ["direct_first", "task_a_first", "seq1"],
  ["proxy_first", "task_a_first", "seq2"],
  ["direct_first", "task_b_first", "seq3"],
  ["proxy_first", "task_b_first", "seq4"],
];

test("independent mode and task orders map bijectively to registered sequences", () => {
  for (const [modeOrder, taskOrder, sequenceId] of combinations) {
    assert.equal(sequenceForOrders(modeOrder, taskOrder), sequenceId);
    assert.deepEqual(ordersForSequence(sequenceId), { modeOrder, taskOrder });
  }
});

test("all 16 dev assignments preserve the selected policy, role, mode order, and task order", () => {
  const fingerprints = new Set();
  for (const policy of policies) {
    for (const role of roles) {
      for (const [modeOrder, taskOrder, sequenceId] of combinations) {
        const assignment = resolveAssignment(
          `dev-${policy}-${role}-${sequenceId}`,
          { proxyPolicy: policy, role, sequenceId },
          "1970-01-01T00:00:00.000Z",
        );
        const first = sessionPlan(assignment, 1);
        const second = sessionPlan(assignment, 2);

        assert.equal(assignment.role, role);
        assert.equal(assignment.proxyPolicy, policy);
        assert.equal(assignment.sessionOrder, modeOrder);
        assert.equal(first.taskId, taskOrder === "task_a_first" ? "task_a" : "task_b");
        assert.equal(second.taskId, taskOrder === "task_a_first" ? "task_b" : "task_a");
        assert.equal(first.condition === "direct", modeOrder === "direct_first");
        assert.equal(second.condition === "direct", modeOrder === "proxy_first");
        if (first.condition !== "direct") assert.equal(first.condition, policy);
        if (second.condition !== "direct") assert.equal(second.condition, policy);
        fingerprints.add(`${role}:${policy}:${sequenceId}`);
      }
    }
  }
  assert.equal(fingerprints.size, 16);
});

test("session-local component keys change for every active assignment switch", () => {
  const taskOneKeys = new Set();
  const taskTwoKeys = new Set();
  for (const policy of policies) {
    for (const role of roles) {
      for (const [, , sequenceId] of combinations) {
        const assignment = resolveAssignment(
          "P-devpreview",
          { proxyPolicy: policy, role, sequenceId },
          "1970-01-01T00:00:00.000Z",
        );
        taskOneKeys.add(sessionFingerprint(assignment, 1));
        taskTwoKeys.add(sessionFingerprint(assignment, 2));
      }
    }
  }
  assert.equal(taskOneKeys.size, 16);
  assert.equal(taskTwoKeys.size, 16);
  for (const key of taskOneKeys) assert.equal(taskTwoKeys.has(key), false);
});
