import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  claimOptionalNudge,
  createOptionalNudgeAttempt,
} from "../src/app/task/[index]/turn-contract.ts";

test("a failed optional nudge remains spent after bounded request exhaustion", () => {
  const attempt = createOptionalNudgeAttempt();

  assert.equal(claimOptionalNudge(attempt), true);
  // Simulate the request rejecting. There is deliberately no success callback
  // to latch: claiming the attempt already spent the optional automatic turn.
  assert.equal(claimOptionalNudge(attempt), false);
  assert.deepEqual(attempt, { attempted: true });
});

test("both participant-facing chats use the attempt latch without clearing it", () => {
  for (const { relative, afterSend } of [
    {
      relative: "../src/app/task/[index]/baseline-task.tsx",
      afterSend: "// --- phases",
    },
    {
      relative: "../src/app/task/[index]/shared.tsx",
      afterSend: "/**\n   * SCRIPT-NUDGE",
    },
  ]) {
    const source = readFileSync(new URL(relative, import.meta.url), "utf8");
    const runNudge = source.match(
      /async function runNudge\(\) \{([\s\S]*?)\n  \}\n\n  \/\*\*/,
    )?.[1];
    assert.ok(runNudge, `runNudge not found in ${relative}`);
    assert.match(runNudge, /claimOptionalNudge\(nudgeAttempt\.current\)/);
    assert.match(runNudge, /onFailure: \(\) => beginRecovery\(\)/);
    assert.match(runNudge, /finally \{[\s\S]*?finishRecovery\(\)/);
    assert.doesNotMatch(runNudge, /nudgeAttempt\.current\s*=/);
    assert.match(source, /!nudgeAttempt\.current\.attempted/);

    const sendStart = source.indexOf("async function send(");
    const sendEnd = source.indexOf(afterSend, sendStart);
    assert.ok(sendStart >= 0 && sendEnd > sendStart, `send not found in ${relative}`);
    const send = source.slice(sendStart, sendEnd);
    assert.match(send, /lastParticipantAt\.current = Date\.now\(\)/);
    assert.doesNotMatch(
      send,
      /nudgeAttempt\.current\s*=/,
      `participant send must not re-arm the one-shot nudge in ${relative}`,
    );
  }
});

test("Direct starts its silence window only when matchmaking completes", () => {
  const source = readFileSync(
    new URL("../src/app/task/[index]/baseline-task.tsx", import.meta.url),
    "utf8",
  );
  const transition = source.match(
    /logEvent\("negotiation_started"[\s\S]*?setPhase\("negotiate"\);/,
  )?.[0];
  assert.ok(transition, "Direct negotiation transition not found");
  assert.match(transition, /lastParticipantAt\.current = Date\.now\(\)/);
  assert.match(
    transition,
    /nudgeAttempt\.current = createOptionalNudgeAttempt\(\)/,
  );
});
