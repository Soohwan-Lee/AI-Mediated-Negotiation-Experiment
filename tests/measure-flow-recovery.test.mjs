import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const reward = read("../src/app/task/[index]/reward/page.tsx");
const wrapUp = read("../src/app/wrap-up/page.tsx");

test("a saved post-task decision resumes after the decision rather than overwriting it", () => {
  assert.match(reward, /loadResponses\(participantKey, `reward_t\$\{taskIndex\}`\)/);
  assert.match(reward, /loadResponses\(participantKey, `recv_eval_t\$\{taskIndex\}`\)/);
  assert.match(reward, /else if \(reward \|\| evaluation\)[\s\S]*setShowRemark\(true\)/);
  assert.match(reward, /if \(attr\)[\s\S]*setShowOpenAnswer\(true\)/);
});

test("completed post-comment answers advance without showing the decision again", () => {
  assert.match(reward, /if \(open\) \{[\s\S]*router\.replace\(nextHref\(flowKey\)\)/);
  assert.match(reward, /if \(!assignment \|\| !restored\)/);
});

test("the bonus control has an intentional zero path and explicit confirmation", () => {
  assert.match(reward, /type="range"/);
  assert.match(reward, /min=\{0\}/);
  assert.match(reward, /max=\{100\}/);
  assert.match(reward, /Choose \{STUDY\.currencySymbol\}0\.00/);
  assert.match(reward, /amount !== null && amountConfirmed/);
});

test("wrap-up restores the first unfinished section before rendering prompts", () => {
  assert.match(wrapUp, /loadResponses\(participantKey, "wrap_up"\)/);
  assert.match(wrapUp, /const firstIncomplete = groups\.findIndex/);
  assert.match(wrapUp, /if \(!restored\)/);
  assert.match(wrapUp, /router\.replace\(nextHref\("wrap-up"\)\)/);
});
