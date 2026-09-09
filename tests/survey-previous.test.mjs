/**
 * The Previous control on the paginated questionnaires.
 *
 * These are source assertions rather than a rendered walk, matching the house
 * style of `measure-flow-recovery.test.mjs`: the pages are client components
 * whose behaviour lives in a handler, and what has to stay true of that
 * handler is checkable without a DOM. What a DOM could add — that a revised
 * answer survives to the end — is the browser walk, not this file.
 */

import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { BACKGROUND_BLOCKS, requiredIds } from "../src/lib/measures.ts";
import { restoredSurveyPart } from "../src/lib/survey-progress.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const background = read("../src/app/background/page.tsx");
const taskSurvey = read("../src/app/task/[index]/survey/page.tsx");
const wrapUp = read("../src/app/wrap-up/page.tsx");
const measure = read("../src/components/measure.tsx");
const types = read("../src/lib/types.ts");

const PAGES = [
  ["the background survey", background, "background"],
  ["the per-task battery", taskSurvey, "post_task"],
  ["the wrap-up block", wrapUp, "wrap_up"],
];

test("every paginated questionnaire offers Previous", () => {
  for (const [name, source] of PAGES) {
    assert.match(source, /PreviousPart/, `${name} imports and renders the control`);
    assert.match(
      source,
      /secondary=\{(?:active)?[pP]art > 0 \? <PreviousPart/,
      `${name} puts it in the action bar's secondary slot`,
    );
  }
});

test("Previous is absent on the first part", () => {
  // Rendered behind `part > 0`, so part 0 has no control at all rather than a
  // disabled one that looks live.
  assert.match(background, /part > 0 \? <PreviousPart/);
  assert.match(taskSurvey, /activePart > 0 \? <PreviousPart/);
  assert.match(wrapUp, /part > 0 \? <PreviousPart/);
});

test("the back handler refuses to step below the first part", () => {
  assert.match(background, /if \(part === 0 \|\| submitting\.current\) return;/);
  assert.match(taskSurvey, /if \(activePart === 0 \|\| submitting\.current\) return;/);
  assert.match(wrapUp, /if \(part === 0 \|\| submitting\.current\) return;/);
});

test("answers are persisted before the move, so a revision cannot be lost", () => {
  assert.match(
    background,
    /handlePrevious\(\)[\s\S]*?await saveResponses\("background", answers\);[\s\S]*?setPart\(part - 1\)/,
  );
  assert.match(
    taskSurvey,
    /goBack\(\)[\s\S]*?saveResponses\(participantKey, `post_task_t\$\{taskIndex\}`, answers\)[\s\S]*?setPart\(activePart - 1\)/,
  );
  assert.match(
    wrapUp,
    /goBack\(\)[\s\S]*?saveResponses\(participantKey, "wrap_up", answers\)[\s\S]*?setPart\(part - 1\)/,
  );
});

test("a revision is logged with the part it came from", () => {
  assert.match(types, /\| "survey_back"/);
  for (const [name, source, block] of PAGES) {
    assert.match(source, /logEvent\(\s*"survey_back"/, `${name} logs the move`);
    assert.match(
      source,
      /from: (?:active)?[pP]art, to: (?:active)?[pP]art - 1/,
      `${name} records both ends of the step`,
    );
    assert.ok(source.includes(block), `${name} names its own response block`);
  }
});

test("Previous pages by one and never reshuffles the block order", () => {
  // The only writes to the part index are +1 forward and -1 back. Anything
  // that jumped or reordered would show up here as a third form.
  for (const [name, source] of PAGES) {
    // The updater form `setPart((current) => current + 1)` carries its own
    // parentheses, so the argument is read up to the end of the statement
    // rather than to the first `)`.
    const writes = [...source.matchAll(/setPart\(([\s\S]*?)\);/g)].map((m) =>
      m[1].trim().replace(/^\([a-zA-Z]*\) =>\s*/, ""),
    );
    assert.ok(writes.length > 0, `${name} moves the part index somewhere`);
    for (const step of writes) {
      assert.ok(
        /^[a-zA-Z]+ [-+] 1$/.test(step) || /firstIncomplete|Math\.max/.test(step),
        `${name} moves one part at a time, got setPart(${step})`,
      );
    }
  }
});

test("the autofill key still changes on every part", () => {
  // Without the part in the key, dev mode fills the first part and every part
  // after it arrives empty inside the same component.
  assert.match(background, /`background-\$\{part\}`/);
  assert.match(taskSurvey, /`task-survey-\$\{taskIndex\}-\$\{restoreReady \? activePart : "loading"\}`/);
  assert.match(wrapUp, /`wrap-up-\$\{part\}`/);
});

test("a late store read cannot drag a participant forward out of Previous", () => {
  // The background restore is async and used to re-pick the landing section
  // every time it resolved. It now lands once.
  assert.match(background, /const landed = useRef\(false\)/);
  assert.match(background, /if \(landed\.current\) return;[\s\S]*?landed\.current = true;/);
});

test("the task battery's landing part is a starting point Previous can leave", () => {
  // `restoredSurveyPart` chooses where a returning participant lands; `part`
  // then overrides it. Both directions have to work off the same index space.
  const pages = BACKGROUND_BLOCKS.map((block) => requiredIds(block));
  assert.equal(restoredSurveyPart(pages, {}), 0);
  assert.match(taskSurvey, /const activePart = part \?\? restoredPart;/);
});

test("Previous stays inside the route and does not touch BACK_STEPS", () => {
  // Crossing a route boundary is `BackButton` / `BACK_STEPS`, a different
  // control with different rules. The part index is component state and the
  // progress bar still comes from the URL alone.
  assert.match(measure, /export function PreviousPart/);
  // It takes an `onClick` and nothing else: no router, no flow config. The
  // comment names `BACK_STEPS` to say what this is NOT, so the check is on
  // what the file imports rather than on what it mentions.
  const imports = measure.slice(0, measure.indexOf("export type Answers"));
  assert.doesNotMatch(imports, /BACK_STEPS|backStep|useRouter|study-config/);
  for (const [name, source] of PAGES) {
    const handler = source.slice(source.indexOf("Previous") >= 0 ? 0 : 0);
    assert.ok(
      !/goBack[\s\S]{0,600}router\.(push|replace)/.test(handler) &&
        !/handlePrevious[\s\S]{0,600}router\.(push|replace)/.test(handler),
      `${name} does not navigate away from the route on Previous`,
    );
  }
});

test("Previous does not carry a cue ring", () => {
  // Interface rule 9: at most one ring on a screen, and nothing is waiting on
  // this control.
  assert.doesNotMatch(measure.slice(measure.indexOf("export function PreviousPart")), /cue-ring/);
});
