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

// --- protected clauses ------------------------------------------------------

const CARD = "the closing reconciliation still cannot be handled alone";
const POOL = "Steady service through the weekend peak is the baseline any store is judged on.";

test("a protected clause survives a cut taken from the end", () => {
  // The Explorer's pool clause is the LAST bubble the model writes, so a
  // naive trailing-bubble trim removes the manipulation itself.
  const text = [
    "a bit of preamble that is not load-bearing at all here",
    "some more filler that can go without costing the study anything",
    CARD,
    POOL,
  ].join(" || ");
  const capped = capMessageLength(text, 160, [CARD, POOL]);
  assert.ok(capped.length <= 160);
  assert.ok(capped.includes(POOL), "pool clause was cut");
});

test("when both cannot fit, the CARD wins over the pool clause", () => {
  // The card drives the credibility ladder and the schedule records it as
  // voiced either way; a message carrying only the pool clause would credit
  // a participant with a disclosure nobody heard.
  const text = ["filler", CARD, POOL].join(" || ");
  const capped = capMessageLength(text, CARD.length + 8, [CARD, POOL]);
  assert.ok(capped.includes(CARD), "card was dropped in favour of the pool clause");
});

test("protection is a no-op when the message already fits", () => {
  const text = `short || ${POOL}`;
  assert.equal(capMessageLength(text, 280, [CARD, POOL]), text);
});

test("an absent protected clause does not break the trim", () => {
  const text = ["one bubble here", "two bubbles here", "three bubbles here"].join(" || ");
  const capped = capMessageLength(text, 30, [CARD, POOL]);
  assert.ok(capped.length <= 30);
  assert.ok(text.includes(capped.split("||")[0].trim()));
});

test("a REFRAMED card is protected, not just a quoted one", () => {
  // The regression this pins: proxies are required to reframe a card rather
  // than quote it (§6.6), so containment matching found the verbatim pool
  // clause and missed the reframed card every time. The cap then protected
  // the Explorer's addition and dropped the principal's own reason — with the
  // schedule still recording the card as voiced, and the ladder driven off
  // that record. Measured live it produced a POLICY-CORRELATED failure: the
  // card survived 4 of 4 Delegate generations and 1 of 4 Explorer ones.
  const card =
    "The truth is, I got the weekend demand forecast wrong twice last month " +
    "and had to ask another store's manager for emergency cover. The district " +
    "manager knows, and if it happens again it goes into my operations review.";
  const reframed =
    "Two missed forecasts last month required emergency cover from another " +
    "store; the district knows, and a repeat goes into the operations review.";
  const text = ["Weekend shifts are our priority.", reframed, "What is your top issue?", POOL].join(" || ");

  const capped = capMessageLength(text, 280, [card, POOL]);
  assert.ok(capped.length <= 280);
  assert.ok(capped.includes(reframed), "the reframed card was dropped");
  assert.ok(capped.includes(POOL), "the pool clause was dropped");
});
