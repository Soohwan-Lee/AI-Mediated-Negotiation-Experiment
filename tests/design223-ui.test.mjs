/**
 * Participant-facing guards for the Ver.2.26 briefing and task entry flow.
 *
 * These checks intentionally stay at the source boundary. The relevant
 * regressions are extra rendered phases and misleading fixed copy, not the
 * internal names used by historical comments or pretest-only instruments.
 */

import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const shared = read("../src/app/task/[index]/shared.tsx");
const direct = read("../src/app/task/[index]/baseline-task.tsx");
const proxy = read("../src/app/task/[index]/proxy-task.tsx");
const survey = read("../src/app/task/[index]/survey/page.tsx");
const briefing = read("../src/components/briefing-guide.tsx");
const roleMap = read("../src/components/proxy-art.tsx");
const background = read("../src/app/background/page.tsx");

test("the main-study task flow renders neither RISK nor M1", () => {
  assert.ok(!shared.includes("export function RiskForm"));
  assert.ok(!direct.includes("<RiskForm"));
  assert.ok(!proxy.includes("<RiskForm"));
  assert.ok(!proxy.includes("m1Item("));
  assert.ok(!proxy.includes("M1_t"));
  assert.ok(!survey.includes("m1Item("));
  assert.ok(!survey.includes("M1_t"));
});

test("the role map identifies the participant without relying on colour", () => {
  assert.match(roleMap, /Team lead \{isLeader \? <span[^>]*>You<\/span>/);
  assert.match(roleMap, /Team member \{!isLeader \? <span[^>]*>You<\/span>/);
  assert.match(roleMap, /Evaluates the team lead/);
  assert.match(roleMap, /Receives that evaluation/);
});

test("payment briefing uses study constants and does not promise an amount reveal", () => {
  for (const key of ["compensation", "bonusAmount", "totalPaid"]) {
    assert.ok(briefing.includes(`STUDY.${key}`), `briefing omits STUDY.${key}`);
  }
  // The per-task figure is on the SAME guide page, inside the decision
  // diagram, so the participant still reads it before the tasks. It used to be
  // repeated in a second card underneath, which is the repeat that went.
  assert.ok(roleMap.includes("STUDY.bonusPerTask"), "role map omits the per-task bonus");
  assert.match(briefing, /do not reduce your payment/);
  assert.match(briefing, /Bonus amounts are not shown during the tasks/);
  assert.ok(!briefing.includes("You see the amounts after both tasks"));
  assert.ok(!briefing.includes("up to 10 minutes"));
  assert.ok(!briefing.includes("bonus decision"));
  assert.ok(!shared.includes("decide the bonus"));
});

test("background questions save drafts but advance only after explicit submission", () => {
  assert.match(background, /const \[part, setPart\] = useState\(0\)/);
  assert.match(background, /block=\{currentBlock\}/);
  assert.ok(!background.includes("BLOCKS.map((block)"));
  assert.match(background, /RESPONSE_BLOCK = "v226_background"/);
  assert.match(background, /_submitted_parts: nextSubmittedParts/);
  assert.match(background, /restoredValidPart/);
  assert.match(background, /if \(part < BLOCKS\.length - 1\)/);
  assert.match(background, /if \(submitting\.current\) return/);
});
