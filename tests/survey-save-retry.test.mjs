import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const background = read("../src/app/background/page.tsx");
const taskSurvey = read("../src/app/task/[index]/survey/page.tsx");
const reward = read("../src/app/task/[index]/reward/page.tsx");
const wrapUp = read("../src/app/wrap-up/page.tsx");
const debriefing = read("../src/app/debriefing/page.tsx");

function body(source, functionName, nextFunctionName) {
  const start = source.indexOf(`async function ${functionName}()`);
  const boundaries = [
    nextFunctionName ? source.indexOf(`async function ${nextFunctionName}()`, start) : -1,
    source.indexOf("\n\n  if (", start),
    source.indexOf("\n\n  return", start),
  ].filter((index) => index > start);
  const end = Math.min(...boundaries);
  assert.notEqual(start, -1, `${functionName} must exist`);
  assert.ok(Number.isFinite(end), `${functionName} must have a readable boundary`);
  return source.slice(start, end);
}

function assertConfirmedBefore(source, functionName, transition, nextFunctionName) {
  const submission = body(source, functionName, nextFunctionName);
  const confirmed = submission.indexOf("confirmSaved()");
  const advanced = submission.indexOf(transition);
  assert.ok(confirmed >= 0, `${functionName} must explicitly confirm its queued write`);
  assert.ok(advanced > confirmed, `${functionName} must not advance before confirmation`);
  assert.match(submission, /if \(!\(await (?:store|getStore\(\))\.confirmSaved\(\)\)\) \{[\s\S]*setSaveFailed\(true\);[\s\S]*return;/);
  assert.match(submission, /catch \{\s*setSaveFailed\(true\);/);
}

test("survey screens retain their current step when a submission is not confirmed", () => {
  assertConfirmedBefore(background, "handleNext", "setPart", "handlePrevious");
  assertConfirmedBefore(taskSurvey, "submit", "router.push");
  assertConfirmedBefore(reward, "submitDecision", "setStage", "submitOpen");
  assertConfirmedBefore(reward, "submitOpen", "router.push", "previousOpen");
  assertConfirmedBefore(wrapUp, "submit", "setPart", "previous");
  assertConfirmedBefore(debriefing, "handleFinish", "router.push");
});

test("failed survey submissions expose one clear retry path without clearing answers", () => {
  for (const source of [background, taskSurvey, reward, wrapUp, debriefing]) {
    assert.match(source, /We couldn&apos;t save yet\. Your answers are still here\. Please retry\./);
    assert.match(source, /label=\{saveFailed \? "Retry saving"/);
    assert.doesNotMatch(source, /setAnswers\(\{\}\)|latestAnswers\.\.current = \{\}/);
  }
});

test("survey input handlers and controls are locked while a submission is in flight", () => {
  for (const source of [background, taskSurvey, reward, wrapUp]) {
    assert.match(source, /function answer\w*\([^)]*\) \{\s*if \(submitting\.current\) return;/);
    assert.match(source, /<fieldset disabled=\{busy\}/);
  }
  assert.match(debriefing, /if \(!canContinue \|\| submitting\.current\) return;/);
  assert.match(debriefing, /<fieldset disabled=\{busy\}>/);
  assert.match(debriefing, /if \(submitting\.current\) return;/);
});

test("backward section changes also wait for pending answers to save", () => {
  assertConfirmedBefore(background, "handlePrevious", "setPart");
  assertConfirmedBefore(reward, "previousOpen", "setStage");
  assertConfirmedBefore(wrapUp, "previous", "setPart");
});
