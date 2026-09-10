import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { codeOutcome } from "../src/lib/negotiation/machine.ts";
import { PRACTICE_TASK } from "../src/lib/tasks.ts";

const baseline = readFileSync(
  new URL("../src/app/task/[index]/baseline-task.tsx", import.meta.url),
  "utf8",
);
const shared = readFileSync(
  new URL("../src/app/task/[index]/shared.tsx", import.meta.url),
  "utf8",
);

test("explicitly ending either human chat records the existing zero-point impasse", () => {
  for (const role of ["leader", "member"]) {
    const outcome = codeOutcome(PRACTICE_TASK, role, null, false);
    assert.equal(outcome.agreed, false);
    assert.equal(outcome.participantPoints, 0);
    assert.equal(outcome.counterpartPoints, 0);
    assert.equal(outcome.jointPoints, 0);
  }

  assert.match(baseline, /endTask\("impasse", null, EXPLICIT_NO_AGREEMENT_REASON/);
  assert.match(shared, /settle\("impasse", null, EXPLICIT_NO_AGREEMENT_REASON\)/);
});

test("both explicit-end handlers invalidate and abort an in-flight reply first", () => {
  for (const source of [baseline, shared]) {
    const handler = source.match(
      /function endWithoutAgreement\(\) \{[\s\S]*?\n  \}/,
    )?.[0];
    assert.ok(handler);
    assert.match(handler, /turnGeneration\.current \+= 1/);
    assert.match(handler, /activeRequest\.current\?\.abort\(\)/);
    assert.ok(
      handler.indexOf("activeRequest.current?.abort()") <
        handler.indexOf("EXPLICIT_NO_AGREEMENT_REASON"),
    );
  }
});

test("the latest counterpart offer drives both the visible summary and acceptance", () => {
  assert.match(
    shared,
    /setLastCounterpartPackage\(counterProposal\)[\s\S]*?<CurrentOfferDecision[\s\S]*?offer=\{lastCounterpartPackage\}/,
  );
  for (const source of [baseline, shared]) {
    assert.match(
      source,
      /const currentOffer = \{ \.\.\.lastCounterpartPackage \};[\s\S]*?void send\([\s\S]*?currentOffer/,
    );
  }
  assert.match(shared, /<CardTitle>Current offer<\/CardTitle>/);
  assert.doesNotMatch(
    shared,
    /✓ Accept current offer[\s\S]{0,300}task\.issues\.map/,
  );
});
