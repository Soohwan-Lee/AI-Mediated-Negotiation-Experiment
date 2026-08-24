/**
 * The reason-leak guardrail, tested against the real card text.
 *
 * Run with `npm run test:units` (Node's built-in runner — no new dependency).
 *
 * WHY THIS ONE HAS A TEST WHEN NOTHING ELSE DOES. CLAUDE.md's "Still open"
 * section notes that the failure branches were verified by hand and that a
 * regression in them would be quiet. This is the quietest of the lot: if the
 * screen lets a sensitive card through, the reply looks like an ordinary
 * helpful answer, the participant never learns that a reason they deliberately
 * withheld was spoken back to them, and the disclosure measure is contaminated
 * with no visible symptom. It cannot be caught by reading the interface, so it
 * gets assertions instead.
 *
 * The two directions are both real failure modes and they pull against each
 * other, which is why both are asserted:
 *
 *   FALSE NEGATIVE — a withheld card is voiced. Destroys the measure.
 *   FALSE POSITIVE — an ordinary answer about an AUTHORIZED reason is replaced
 *     by the refusal sentence. Makes the proxy look broken and, worse, makes it
 *     look as though the participant's own work reasons were also off-limits.
 *
 * The first version of this check failed the second direction on the very first
 * realistic case, because a forbidden card shares most of its vocabulary with
 * the term it belongs to. Hence `sayable`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Loaded by transpiling the one function under test, so the test runs against
// the shipped source with no build step and no bundler.
const source = readFileSync("src/lib/ai/reason-leak.ts", "utf8");
const js = source
  .replace(/^import[^\n]*\n/gm, "")
  .replace(/: Array<\{ id: string; text: string \}>/g, "")
  .replace(/: string\[\]/g, "")
  .replace(/: string/g, "")
  .replace(/: boolean/g, "")
  .replace(/export function/g, "function");
const { leaksForbiddenReason } = await import(
  "data:text/javascript," +
    encodeURIComponent(js + "\nexport { leaksForbiddenReason };")
);

/**
 * Task A, Member. Verbatim from `lib/tasks.ts` — if the card wording changes
 * there and this drifts, the test is measuring nothing, so copy it across.
 */
const SENSITIVE = [
  {
    id: "SB-M1",
    text: "The last few weeks of constant messages and evening catch-up have left you badly worn down.",
  },
  {
    id: "SB-M2",
    text: "In that state you missed two testing errors. You caught them before launch and fixed them quietly — that exhaustion was the cause is something only you know.",
  },
  {
    id: "SB-M3",
    text: "Without protected time, you are afraid the same mistake will happen again.",
  },
];

/** The work cards plus the three issue labels and descriptions. */
const SAYABLE = [
  "Setup and testing go faster, with fewer errors, in uninterrupted time.",
  "Batching questions into set hours cuts the cost of switching between tasks.",
  "Predictable focus time is what keeps the schedule without evening catch-up.",
  "Quality review checkpoints",
  "How many formal reviews of the AI's answer quality you hold together before launch.",
  "Protected focus afternoons",
  "How many afternoons a week the Member works on testing with no meetings and no messages.",
  "Pilot start",
  "Which week the pilot begins.",
];

const leaks = (text) => leaksForbiddenReason(text, SENSITIVE, SAYABLE);

test("lets through an answer about an authorized work reason", () => {
  assert.equal(
    leaks(
      "I'll say that setup and testing go faster, with fewer errors, in uninterrupted time.",
    ),
    false,
  );
});

test("lets through an answer that names the term and the level", () => {
  assert.equal(
    leaks(
      "I'll open by asking for three protected focus afternoons a week and hold there.",
    ),
    false,
  );
});

test("lets through the refusal sentence itself", () => {
  assert.equal(
    leaks("I have not been authorized to raise that, so I will not bring it up."),
    false,
  );
});

test("lets through generic talk of slipping schedules and quality", () => {
  // The case that killed the first implementation: every content word here is
  // either in an authorized card or in the term's own name, but the phrasing
  // overlaps SB-M3 heavily.
  assert.equal(
    leaks(
      "If they push back I'll explain that without protected time the schedule slips and quality suffers.",
    ),
    false,
  );
});

test("lets through a description of what it will trade", () => {
  assert.equal(
    leaks(
      "I'll trade the pilot start date and the review count to keep your afternoons.",
    ),
    false,
  );
});

test("blocks a paraphrase of the exhaustion card (SB-M1)", () => {
  assert.equal(
    leaks(
      "I could mention the constant messages over recent weeks that have left you worn down.",
    ),
    true,
  );
});

test("blocks a paraphrase of the missed-errors card (SB-M2)", () => {
  assert.equal(
    leaks(
      "I might note you missed two testing errors while exhausted and fixed them quietly.",
    ),
    true,
  );
});

test("blocks a shorter paraphrase of the same card", () => {
  assert.equal(
    leaks("It was the exhaustion that caused you to miss those errors before launch."),
    true,
  );
});

test("blocks a paraphrase of the fear card (SB-M3)", () => {
  assert.equal(
    leaks("I'd say you're afraid the same mistake will happen again without it."),
    true,
  );
});

test("blocks the card quoted verbatim", () => {
  for (const card of SENSITIVE) {
    assert.equal(leaks(card.text), true, `verbatim ${card.id} should block`);
  }
});

test("authorizing a card stops it being treated as a leak", () => {
  // The participant ticks SB-M1. It moves from forbidden to sayable, and the
  // same sentence must now pass — otherwise ticking a card would silently fail
  // to take effect.
  const forbidden = SENSITIVE.filter((c) => c.id !== "SB-M1");
  const sayable = [...SAYABLE, SENSITIVE[0].text];
  assert.equal(
    leaksForbiddenReason(
      "I could mention the constant messages over recent weeks that have left you worn down.",
      forbidden,
      sayable,
    ),
    false,
  );
});
