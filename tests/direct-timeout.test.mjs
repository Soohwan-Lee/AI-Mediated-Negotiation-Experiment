import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("a quiet Direct timeout uses the same persisted endTask path as in-flight expiry", () => {
  const source = readFileSync(
    new URL("../src/app/task/[index]/baseline-task.tsx", import.meta.url),
    "utf8",
  );
  const timer = source.match(
    /<CountdownTimer[\s\S]*?onExpire=\{\(\) => \{([\s\S]*?)\}\}\s*\/>/,
  )?.[1];
  assert.ok(timer, "Direct CountdownTimer onExpire handler not found");
  assert.match(timer, /endTask\("impasse", null, "timeout"/);
  assert.match(timer, /sbFirstChoice/);
  assert.match(timer, /sbEverVoiced/);
  assert.match(timer, /priorityClaimed/);
  assert.doesNotMatch(timer, /logEvent\(\s*"negotiation_ended"/);
});
