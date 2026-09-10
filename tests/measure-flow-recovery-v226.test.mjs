import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { answersForIds, explicitlyCompleted, isMissingResponse, restoredSubmittedPart, restoredValidPart, surveyComplete } from "../src/lib/survey-progress.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const reward = read("../src/app/task/[index]/reward/page.tsx");
const survey = read("../src/app/task/[index]/survey/page.tsx");
const wrapUp = read("../src/app/wrap-up/page.tsx");
const background = read("../src/app/background/page.tsx");
const measure = read("../src/components/measure.tsx");
const ui = read("../src/components/ui.tsx");

test("fully answered drafts never count as explicitly completed", () => {
  const draft = { OED1_t1: "Done", OEE1_t1: "Done", OEP1_t1: "Done" };
  assert.equal(explicitlyCompleted(draft), false);
  assert.equal(explicitlyCompleted({ ...draft, _completed: true }), true);
});

test("whitespace-only open responses remain unanswered", () => {
  assert.equal(isMissingResponse("   \n"), true);
  assert.equal(isMissingResponse("A brief response"), false);
  assert.equal(surveyComplete([["OED1"]], { OED1: "   " }), false);
});

test("reload cursor follows submitted parts, not live answers", () => {
  assert.equal(restoredSubmittedPart(3, undefined), 0);
  assert.equal(restoredSubmittedPart(3, 0), 0);
  assert.equal(restoredSubmittedPart(3, 1), 1);
  assert.equal(restoredSubmittedPart(3, 99), 2);
});

test("clearing a previously submitted answer restores that earlier page", () => {
  const pages = [["OED1"], ["OEE1"], ["OEP1"]];
  const afterPreviousAndClear = { OED1: "", OEE1: "saved", OEP1: "draft" };
  assert.equal(restoredValidPart(pages, afterPreviousAndClear, 2), 0);
  assert.equal(surveyComplete(pages, afterPreviousAndClear), false);
});

test("stale removed items are excluded from a Ver.2.26 response schema", () => {
  assert.deepEqual(
    answersForIds({ SCF1_t1: 5, ATTR1_t1: 7, REMARK_REPLY_t1: "old" }, ["SCF1_t1"]),
    { SCF1_t1: 5 },
  );
});

test("task scale page is one grouped page with draft persistence and explicit submit", () => {
  assert.match(survey, /experienceBlocks\(assignment\.role, isProxy\)/);
  assert.match(survey, /proxyExperienceBlocks\(participantKey\)/);
  assert.match(survey, /lg:grid-cols-2/);
  assert.match(survey, /TranscriptReview/);
  assert.match(survey, /label="Submit & Continue"/);
  assert.doesNotMatch(survey, /setPart|restoredSurveyPart/);
});

test("reward groups all task open questions behind one explicit submit", () => {
  assert.match(reward, /decision\?\._submitted === true/);
  assert.match(reward, /openBlocks\.map\(\(block\) =>/);
  assert.match(reward, /const openMissing = missingIds\(openBlocks, openAnswers\)/);
  assert.match(reward, /_submitted_parts: 0,[\s\S]*_completed: false/);
  assert.match(reward, /_submitted_parts: 1,[\s\S]*_completed: true/);
  assert.match(reward, /_completed: true/);
  assert.match(reward, /label="Submit & Continue"/);
  assert.doesNotMatch(reward, /setOpenPart|activeOpenPart/);
  assert.doesNotMatch(reward, /restoredSurveyPart|setShowRemark|RemarkPhase|attr_t/);
});

test("bonus zero is intentional, confirmed, and BR1 stores actual pounds", () => {
  assert.match(reward, /type="range" min=\{0\} max=\{100\}/);
  assert.match(reward, /Choose £0\.00/);
  assert.match(reward, /amountPercent !== null && amountConfirmed/);
  assert.match(reward, /\[`BR1_t\$\{taskIndex\}`\]: awarded/);
});

test("wrap-up keeps checks together and does not skip a filled draft", () => {
  assert.match(wrapUp, /const LEGACY_PARTS = \[END_CHECK_BLOCKS, \[OEC1_BLOCK\]\]/);
  assert.match(wrapUp, /comparisonInTask \? \[END_CHECK_BLOCKS\] : LEGACY_PARTS/);
  assert.match(wrapUp, /isExpandedOpenInstrument\(taskOpen\?\._instrument_version\)/);
  assert.match(reward, /open\._instrument_version \?\? "2.27"/);
  assert.match(reward, /\["2.27", OPEN_INSTRUMENT_V2, OPEN_INSTRUMENT_VERSION\]/);
  assert.match(wrapUp, /saved\?\._checks_submitted === true/);
  assert.match(wrapUp, /explicitlyCompleted/);
  assert.doesNotMatch(wrapUp, /SUS|ICC4|FR1|FR2/);
});

test("client input bounds match server-valid survey snapshots", () => {
  assert.match(measure, /Number\.isFinite\(Number\(asText\)\)[\s\S]*Number\(asText\) < 0/);
  assert.match(measure, /min=\{0\}/);
  assert.match(measure, /Enter zero or a positive number/);
  assert.match(background, /if \(invalidNumberIds\(next\)\.length === 0\)/);
  assert.match(ui, /maxLength=\{20_000\}/);
});
