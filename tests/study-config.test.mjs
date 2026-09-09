/**
 * Invariants on the advertised time and the money.
 *
 * These are one edit away from being wrong at any moment, and getting them
 * wrong is not a rendering bug — it underpays a real person, or advertises a
 * rate that does not clear Prolific's fair-pay floor.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PHASES,
  STUDY,
  FLOW,
  nextHref,
  STAGE_MINUTES,
  TOTAL_MINUTES,
  timingIsHonest,
  backStep,
} from "../src/lib/study-config.ts";
import { capMessageLength } from "../src/lib/ai/validator.ts";
import { NEGOTIATION } from "../src/lib/study-config.ts";

const money = (s) => Number(s);

test("IRB metadata records an exemption determination, not an approval", () => {
  assert.equal(STUDY.irb.institution, "UNIST");
  assert.equal(STUDY.irb.reviewStatus, "exempt");
  assert.equal(STUDY.irb.exemptionNumber, "UNISTIRB-26-073 -C");
  assert.equal(STUDY.irb.principalInvestigator, "Soohwan Lee");
  assert.equal(STUDY.irb.researcherEmail, "soohwanlee@unist.ac.kr");
  assert.ok(!("contactEmail" in STUDY.irb));
  assert.ok(!STUDY.irb.exemptionNumber.startsWith("TBD"));
});

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
    // The PI added a second practice round, one before each task in that
    // task's own arm, on 2026-09-09. Design §7's timing table still lists a
    // single practice and needs the row.
    STAGE_MINUTES.practice2 +
    2 * (STAGE_MINUTES.task + STAGE_MINUTES.taskSurvey + STAGE_MINUTES.reward) +
    STAGE_MINUTES.proxyObservation +
    STAGE_MINUTES.wrapUp +
    STAGE_MINUTES.debrief;
  assert.equal(sum, TOTAL_MINUTES);
});

test("every flow step the participant sits through carries minutes", () => {
  // Debriefing is read, not skipped: participants confirm data use there.
  assert.ok(STAGE_MINUTES.debrief > 0);
});

test("the budget matches Design Ver.2.26 §7's recruitment estimate", () => {
  assert.equal(TOTAL_MINUTES, 45);
  assert.equal(STUDY.estimatedMinutes, 45);
  assert.ok(timingIsHonest());
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

test("the pre-assignment welcome card advertises the base rate, not the eventual total", () => {
  const welcome = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(welcome, /hint="Base rate"/);
  assert.match(welcome, /Number\(STUDY\.compensation\)/);
  assert.doesNotMatch(welcome, /hint="Equivalent total rate"/);
});

test("the advertised range spans the two roles' guarantees", () => {
  // Ver.2.24 §7.1: a Leader's £7 is fixed from assignment; a Member is
  // guaranteed £6 with up to £1 recommended on top. Role is unknown at
  // consent, so the range is the only honest pre-assignment headline.
  assert.equal(money(STUDY.minTotal), money(STUDY.compensation));
  assert.equal(money(STUDY.maxTotal), money(STUDY.totalPaid));
  assert.ok(money(STUDY.minTotal) < money(STUDY.maxTotal));
});

test("the consent page headlines the total as a range, never base-plus-bonus", () => {
  // "£6 + up to £1 bonus" presents the MEMBER's structure to everyone and
  // understates what a Leader is guaranteed, which is why the tile shows the
  // span instead. This pins the shape, not the styling.
  const welcome = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(welcome, /STUDY\.minTotal.*STUDY\.maxTotal/s);
  assert.doesNotMatch(welcome, /\+ up to \$\{STUDY\.currencySymbol\}\$\{STUDY\.bonusAmount\} bonus/);
});

test("both pre-task notices reach the participant before the practice round", () => {
  // §8.1: keep the point sheet private, and stay anonymous. The point-sheet
  // half is also pinned by the COMP3 comprehension item; this pins that the
  // guide page a participant reads before practice actually carries both.
  const guide = readFileSync(
    new URL("../src/components/briefing-guide.tsx", import.meta.url),
    "utf8",
  );
  assert.match(guide, /Do not tell the other side your scores, your payoff table, or how many points any option gives you/);
  assert.match(guide, /Stay anonymous in the chat/);
  // Named, not merely implied: "stay anonymous" alone is a slogan, and the
  // employer is the detail a participant is most likely to type without
  // thinking of it as identifying. The wording is free; naming it is not.
  assert.match(guide, /employer/);
});

test("the guide says the counterpart moves on reasons without naming which reason works", () => {
  // §8.1 requires the first half. The second is the whole study: saying the
  // sensitive reason works better would stage the primary outcome.
  const guide = readFileSync(
    new URL("../src/components/briefing-guide.tsx", import.meta.url),
    "utf8",
  );
  assert.match(guide, /depends on the reasons they hear/);
  assert.doesNotMatch(guide, /sensitive background (works|helps) (better|more)/i);
});

test("the phase strip names the six phases and marks both practices as not counting", () => {
  const labels = PHASES.map((p) => p.label);
  assert.deepEqual(labels, [
    "Instructions",
    "Practice",
    "Task 1",
    "Practice",
    "Task 2",
    "Final questions",
  ]);
  // BOTH practices carry it. The second is the one a participant is most
  // likely to mistake for the real thing: it arrives between two tasks,
  // after they have already negotiated once for points.
  assert.equal(PHASES.find((p) => p.key === "practice")?.doesNotCount, true);
  assert.equal(PHASES.find((p) => p.key === "practice2")?.doesNotCount, true);
});

test("the consent page's step list adds up to the whole budget", () => {
  // Stream V found the visible rows summing to less than the stat card above
  // them: the list started at the background questions and ended at the final
  // ones, so this consent page and the debriefing — four minutes of real
  // reading — were missing. Two different answers to "how long is this" on one
  // screen, and the smaller one is what underpays anyone slower than the
  // estimate.
  //
  // Read from the SOURCE rather than imported: page.tsx is a "use client"
  // component full of JSX and cannot be pulled into a node test. Every row's
  // minutes is an expression over STAGE_MINUTES, so evaluating those
  // expressions is what makes this catch a wrong figure as well as a missing
  // row.
  const welcome = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const steps = welcome.slice(
    welcome.indexOf("const STEPS = ["),
    welcome.indexOf("export const stepMinutesTotal"),
  );
  assert.ok(steps.length > 0, "could not find the STEPS array");

  const expressions = [...steps.matchAll(/minutes:\s*([^,\n]+(?:\n\s*[^,\n]+)*),/g)].map(
    (m) => m[1].trim(),
  );
  assert.ok(expressions.length >= 5, `only found ${expressions.length} rows`);

  const sum = expressions.reduce((total, expression) => {
    // Only STAGE_MINUTES arithmetic is permitted, so a row cannot smuggle in a
    // hardcoded number that drifts from the flow.
    assert.match(
      expression,
      /^[\d\s*+()]*(?:STAGE_MINUTES\.\w+[\d\s*+()]*)+$/,
      `row minutes must be arithmetic over STAGE_MINUTES, got: ${expression}`,
    );
    const value = Function(
      "STAGE_MINUTES",
      `return (${expression});`,
    )(STAGE_MINUTES);
    assert.ok(Number.isFinite(value) && value > 0, `bad minutes: ${expression}`);
    return total + value;
  }, 0);

  assert.equal(
    sum,
    TOTAL_MINUTES,
    `the listed steps add to ${sum} but the budget is ${TOTAL_MINUTES}`,
  );
  // And the headline the participant reads first may only round it DOWN by a
  // minute, which is the same rule `timingIsHonest` enforces.
  assert.ok(sum >= STUDY.estimatedMinutes);
  assert.ok(sum - STUDY.estimatedMinutes <= 1);
});

test("a practice round sits before each task, and REMARK 1 leads into the second", () => {
  // The single practice round ran `sessionPlan(assignment, 1)`, so it always
  // rehearsed TASK 1's arm. Since every participant does one Direct task and
  // one Proxy task, whichever arm fell second was met cold — an interface
  // difference landing on `Pooled Proxy − Direct`, the primary contrast.
  const keys = FLOW.map((s) => s.key);
  assert.ok(
    keys.indexOf("practice") < keys.indexOf("task-1"),
    "the first practice must precede Task 1",
  );
  assert.ok(
    keys.indexOf("practice-2") < keys.indexOf("task-2"),
    "the second practice must precede Task 2",
  );
  // REMARK is the last phase of the reward route, and it leaves via
  // `nextHref(flowKey)`. This is what carries Task 1's REMARK into the second
  // practice without the reward page knowing the practice exists.
  assert.equal(nextHref("reward-1"), "/practice/2");
  assert.equal(nextHref("practice-2"), "/task/2");
  assert.equal(nextHref("practice"), "/task/1");
  // The URL carries the index and nothing else: no condition name, no arm.
  for (const key of ["practice", "practice-2"]) {
    const href = FLOW.find((s) => s.key === key).href;
    assert.match(href, /^\/practice\/[12]$/);
  }
});

test("the debrief calls the observed bonus input a recommendation, not a transfer", () => {
  const debrief = readFileSync(new URL("../src/app/debriefing/page.tsx", import.meta.url), "utf8");
  assert.match(debrief, /recommend a bonus/);
  assert.match(debrief, /recommended the other side/);
  assert.doesNotMatch(debrief, /decided the other side/);
  assert.doesNotMatch(debrief, /waited while/);
});

test("Ver.2.26 pacing uses one minute per mode practice and no artificial Proxy delay", () => {
  assert.equal(NEGOTIATION.practiceSeconds, 60);
  assert.deepEqual(NEGOTIATION.proxyMessageGap, { minMs: 0, maxMs: 0 });
});

test("post-task questionnaires cannot be revisited after the decision stimulus", () => {
  assert.equal(backStep("reward-1"), null);
  assert.equal(backStep("reward-2"), null);
  assert.equal(backStep("instruction")?.key, "background");
  assert.equal(backStep("practice")?.key, "instruction");
  // The second practice sits directly after Task 1's reward decision and
  // REMARK, so it must lead nowhere: going back there would let a participant
  // revise a recorded decision after seeing the next task's opening.
  assert.equal(backStep("practice-2"), null);
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
  // 420 since Ver.2.20: §6.6's three-sentence AI-Supplemented reason turn
  // runs 303-340 characters across the four cards, so 280 could not carry the
  // manipulation at all — live runs dropped both cover sentences and left the
  // abstraction alone. One cap still applies to both policies, which is what
  // the exposure control actually rests on.
  assert.equal(NEGOTIATION.maxMessageChars, 420);
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
