/**
 * Invariants on the advertised time and the money.
 *
 * These are one edit away from being wrong at any moment, and getting them
 * wrong is not a rendering bug — it underpays a real person, or advertises a
 * rate that does not clear Prolific's fair-pay floor.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STUDY,
  STAGE_MINUTES,
  TOTAL_MINUTES,
  timingIsHonest,
} from "../src/lib/study-config.ts";
import { capMessageLength } from "../src/lib/ai/validator.ts";
import { NEGOTIATION } from "../src/lib/study-config.ts";

const money = (s) => Number(s);

test("the advertised time does not undercut the flow's own budget", () => {
  assert.ok(
    timingIsHonest(),
    `advertised ${STUDY.estimatedMinutes} vs budget ${TOTAL_MINUTES}`,
  );
});

test("STAGE_MINUTES sums to TOTAL_MINUTES", () => {
  const sum =
    STAGE_MINUTES.consent +
    STAGE_MINUTES.background +
    STAGE_MINUTES.instruction +
    STAGE_MINUTES.practice +
    2 * (STAGE_MINUTES.task + STAGE_MINUTES.taskSurvey + STAGE_MINUTES.reward) +
    STAGE_MINUTES.wrapUp;
  assert.equal(sum, TOTAL_MINUTES);
});

test("base + bonus equals the advertised total", () => {
  assert.equal(
    money(STUDY.compensation) + money(STUDY.bonusAmount),
    money(STUDY.totalPaid),
  );
});

test("the two per-task bonus halves sum to the whole bonus", () => {
  assert.equal(2 * money(STUDY.bonusPerTask), money(STUDY.bonusAmount));
});

test("the total clears Prolific's recommended fair-pay rate", () => {
  // Prolific's hard floor is £6.00/hr; £9.00/hr is what they recommend, and
  // this study is effortful enough that the recommendation is the target.
  const perHour = (money(STUDY.totalPaid) / STUDY.estimatedMinutes) * 60;
  assert.ok(perHour >= 9.0, `£${perHour.toFixed(2)}/hr is below £9.00`);
  assert.equal(perHour.toFixed(2), money(STUDY.hourlyEquivalent).toFixed(2));
});

test("the base alone still clears Prolific's hard floor", () => {
  // A participant is guaranteed the base; the bonus is framed as decided by
  // someone else. Even if a reviewer reads only the guaranteed part, it must
  // not fall under £6.00/hr.
  const perHour = (money(STUDY.compensation) / STUDY.estimatedMinutes) * 60;
  assert.ok(perHour >= 6.0, `base is £${perHour.toFixed(2)}/hr`);
});

// --- the exposure cap -------------------------------------------------------

test("a message inside the cap is returned untouched", () => {
  const text = "short one || and a second bubble";
  assert.equal(capMessageLength(text, 280), text);
});

test("an over-cap message is cut at a bubble seam, not mid-sentence", () => {
  const long = [
    "i hear you on the weekends",
    "the closing reconciliation is the part i genuinely cannot cover alone right now",
    "so could we hold closings at one a week and i take the weekend load instead",
  ].join(" || ");
  const capped = capMessageLength(long, 60);
  assert.ok(capped.length <= 60);
  // Whatever survives must be whole bubbles, never a truncated one.
  for (const bubble of capped.split("||").map((b) => b.trim())) {
    assert.ok(
      long.includes(bubble),
      `"${bubble}" is not a whole original bubble`,
    );
  }
});

test("a single over-cap bubble falls back to a word boundary", () => {
  const one = "a".repeat(20) + " " + "b".repeat(200);
  const capped = capMessageLength(one, 50);
  assert.ok(capped.length <= 50);
  assert.ok(!capped.endsWith(" "));
});

test("the cap the routes apply is the design's exposure control", () => {
  // §7 caps message length so the Explorer arm's extra clause cannot become
  // extra LENGTH on the contrast it is measured by (pilot gate 9).
  assert.equal(NEGOTIATION.maxMessageChars, 280);
});
