import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { restoredSubmittedPart, restoredValidPart } from "../src/lib/survey-progress.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const background = read("../src/app/background/page.tsx");
const reward = read("../src/app/task/[index]/reward/page.tsx");
const wrapUp = read("../src/app/wrap-up/page.tsx");
const measure = read("../src/components/measure.tsx");

test("Previous is shown wherever an earlier participant-facing section exists", () => {
  assert.match(background, /part > 0 \? <PreviousPart/);
  assert.match(reward, /secondary=\{<PreviousPart onClick=\{previousOpen\}/);
  assert.match(wrapUp, /activePart > 0 \? <PreviousPart/);
});

test("each back handler refuses to step below zero and saves before moving", () => {
  assert.match(background, /handlePrevious\(\)[\s\S]*if \(part === 0 \|\| submitting\.current\) return;[\s\S]*await saveResponses[\s\S]*setPart\(part - 1\)/);
  assert.match(reward, /previousOpen\(\)[\s\S]*if \(submitting\.current\) return;[\s\S]*await getStore\(\)\.saveResponses[\s\S]*setStage\("decision"\)/);
  assert.match(wrapUp, /previous\(\)[\s\S]*if \(activePart === 0 \|\| submitting\.current\) return;[\s\S]*await getStore\(\)\.saveResponses[\s\S]*setPart\(activePart - 1\)/);
});

test("reload landing comes from submitted progress, not filled drafts", () => {
  assert.equal(restoredSubmittedPart(3, undefined), 0);
  assert.equal(restoredSubmittedPart(3, 1), 1);
  assert.equal(restoredValidPart([["A"], ["B"]], { A: "", B: "done" }, 1), 0);
  assert.match(background, /restoredValidPart\(BACKGROUND_PAGE_IDS, merged, saved\._submitted_parts\)/);
  assert.match(reward, /decision\?\._submitted === true/);
  assert.match(reward, /explicitlyCompleted\(open \?\? \{\}\)/);
  assert.match(wrapUp, /saved\?\._checks_submitted === true/);
});

test("back navigation remains inside each route and is audit logged", () => {
  for (const source of [background, reward, wrapUp]) assert.match(source, /logEvent\(\s*"survey_back"/);
  assert.match(measure, /export function PreviousPart/);
  const imports = measure.slice(0, measure.indexOf("export type Answers"));
  assert.doesNotMatch(imports, /BACK_STEPS|useRouter|study-config/);
});

test("Previous does not carry a cue ring", () => {
  assert.doesNotMatch(measure.slice(measure.indexOf("export function PreviousPart")), /cue-ring/);
});
