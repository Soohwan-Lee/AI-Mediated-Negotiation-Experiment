import assert from "node:assert/strict";
import test from "node:test";

import {
  DIRECT_PRACTICE_CHECK,
  PRACTICE_CHECK_ANSWERS,
  PRACTICE_CHECK_REMEDIATION,
  PROXY_PRACTICE_CHECK,
} from "../src/lib/measures.ts";
import {
  practiceCheckDecision,
  selectPracticeCheckAnswer,
} from "../src/lib/practice-check.ts";

for (const check of [DIRECT_PRACTICE_CHECK, PROXY_PRACTICE_CHECK]) {
  test(`${check.id} blocks unanswered and wrong responses until a correct answer is checked`, () => {
    const correct = PRACTICE_CHECK_ANSWERS[check.id];
    const wrong = check.options.find((option) => option.value !== correct)?.value;
    assert.ok(wrong);

    assert.equal(practiceCheckDecision("", correct, false), "choose");
    assert.equal(practiceCheckDecision(wrong, correct, false), "submit");
    assert.equal(practiceCheckDecision(wrong, correct, true), "retry");
    assert.equal(practiceCheckDecision(correct, correct, false), "submit");
    assert.equal(practiceCheckDecision(correct, correct, true), "complete");
  });

  test(`${check.id} supplies the exact correct option and a concise explanation`, () => {
    const correct = PRACTICE_CHECK_ANSWERS[check.id];
    const correctOption = check.options.find((option) => option.value === correct);

    assert.ok(correctOption?.label);
    assert.ok(PRACTICE_CHECK_REMEDIATION[check.id]);
  });
}

test("repeated IC6 mistakes remain retryable without a retry limit", () => {
  const correct = PRACTICE_CHECK_ANSWERS.IC6;
  const wrong = "automatic";

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    assert.equal(practiceCheckDecision(wrong, correct, true), "retry");
  }
  assert.equal(practiceCheckDecision(correct, correct, true), "complete");
});

test("a wrong IC6 choice shows feedback immediately and can be changed directly", () => {
  const correct = PRACTICE_CHECK_ANSWERS.IC6;
  let selection = selectPracticeCheckAnswer(
    { answer: "", submitted: false, attempt: 1 },
    "automatic",
    correct,
  );

  assert.deepEqual(selection, {
    answer: "automatic",
    submitted: true,
    attempt: 1,
  });
  assert.equal(
    practiceCheckDecision(selection.answer, correct, selection.submitted),
    "retry",
  );

  selection = selectPracticeCheckAnswer(
    selection,
    correct,
    correct,
  );
  assert.deepEqual(selection, {
    answer: correct,
    submitted: false,
    attempt: 2,
  });
  assert.equal(
    practiceCheckDecision(selection.answer, correct, selection.submitted),
    "submit",
  );
});
