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
 * Task A, Member — NOT hand-copied. The cards are read from the shipped
 * `lib/tasks.ts` (via tests/ts-register.mjs), so a wording change there is
 * automatically what this test runs against. The earlier version copied the
 * text across by hand with a comment demanding it be kept in sync, and the
 * ver.2.5 card restructure showed why that fails: the copies silently kept
 * testing cards that no longer existed.
 */
const { getTask } = await import("../src/lib/tasks.ts");

const TASK_A = getTask("task_a");
const CARDS = TASK_A.roleBriefs.member.reasonCards;
const SENSITIVE = CARDS.filter((c) => c.layer === "sensitive");
const WORK = CARDS.filter((c) => c.layer === "work");

/** The default mandate's sayable set: the work cards plus the three issue
 * labels and descriptions — the same construction as the rehearsal route. */
const SAYABLE = [
  ...WORK.map((c) => c.text),
  ...TASK_A.issues.map((i) => i.label),
  ...TASK_A.issues.map((i) => i.description),
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
      "I'll give ground on the weekend shifts to keep the closes down.",
    ),
    false,
  );
});

test("blocks a paraphrase of the second-job card (a_i2_sb_m)", () => {
  assert.equal(
    leaks(
      "I might note you have a second job at another shop in the evenings that the closes clash with.",
    ),
    true,
  );
});

test("blocks a shorter paraphrase of the same card", () => {
  assert.equal(
    leaks("You are working somewhere else on weekday evenings to cover your living costs."),
    true,
  );
});

test("blocks a paraphrase that circles the job without naming it", () => {
  // The same secret from its other side. It never says "second job", but the
  // distinctive vocabulary of the card — the weekday evenings, the clash, the
  // living costs — is what gives it away, which is the case the subtraction
  // step exists to catch.
  assert.equal(
    leaks(
      "The weekday evenings are already spoken for, and the closes clash with what pays your living costs.",
    ),
    true,
  );
});

test("blocks the card quoted verbatim", () => {
  for (const card of SENSITIVE) {
    assert.equal(leaks(card.text), true, `verbatim ${card.id} should block`);
  }
});

test("authorizing a card stops it being treated as a leak", () => {
  // The participant ticks the fatigue card. It moves from forbidden to
  // sayable, and the same sentence must now pass — otherwise ticking a card
  // would silently fail to take effect.
  const ticked = SENSITIVE.find((c) => c.id === "a_i2_sb_m");
  const forbidden = SENSITIVE.filter((c) => c.id !== "a_i2_sb_m");
  const sayable = [...SAYABLE, ticked.text];
  assert.equal(
    leaksForbiddenReason(
      "I might note you have a second job at another shop in the evenings that the closes clash with.",
      forbidden,
      sayable,
    ),
    false,
  );
});
