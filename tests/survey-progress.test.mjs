import { test } from "node:test";
import assert from "node:assert/strict";
import { restoredSurveyPart } from "../src/lib/survey-progress.ts";

const pages = [["PERC1", "PERC2"], ["PCR1"], ["OE1"]];

test("a new survey lands on its first page", () => {
  assert.equal(restoredSurveyPart(pages, {}), 0);
});

test("a restored survey lands on the first page not yet persisted", () => {
  assert.equal(restoredSurveyPart(pages, { PERC1: 5, PERC2: 6 }), 1);
});

test("completing live answers cannot move the frozen restored cursor", () => {
  const restoredSnapshot = {};
  const landing = restoredSurveyPart(pages, restoredSnapshot);
  const liveAnswers = { PERC1: 5, PERC2: 6 };

  assert.equal(landing, 0);
  assert.equal(restoredSurveyPart(pages, liveAnswers), 1);
  assert.equal(landing, 0, "the rendered page changes only after explicit navigation");
});

test("a fully persisted survey resumes on its final page", () => {
  assert.equal(restoredSurveyPart(pages, { PERC1: 5, PERC2: 6, PCR1: 4, OE1: "Done" }), 2);
});
