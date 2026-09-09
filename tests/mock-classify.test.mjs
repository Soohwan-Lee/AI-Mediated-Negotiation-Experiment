/**
 * Mockup mode's offline classifier stand-in.
 *
 * WHY THIS HAS A TEST. The value it replaced was the constant
 * `{ label: "none" }`, and that constant recorded a typed confession as a
 * non-disclosure: `SB-TIMING = never`, 1,000 instead of 3,000, on the
 * confirmatory outcome. Mockup mode is how the flow is read, so what it shows
 * is what a reader believes the study does — and this is the second bug of
 * exactly that shape (the first was the Proxy script voicing a card the
 * mandate forbade).
 *
 * It is a MOCK. It reads vocabulary, never meaning, so a denial would score as
 * a disclosure. The live P5 route is what gate 19's κ is computed from; these
 * assertions only pin that the stand-in gets the four real SB cards right and
 * does not fire on ordinary negotiation talk.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { mockClassify } = await import("../src/app/task/[index]/turn-contract.ts");
const { leaksForbiddenReason } = await import("../src/lib/ai/reason-leak.ts");
const { getTask, cardOfLayer } = await import("../src/lib/tasks.ts");

const TASKS = ["task_a", "task_b"];
const ROLES = ["leader", "member"];

function classify(taskId, role, texts) {
  const task = getTask(taskId);
  return mockClassify(
    texts,
    {
      sensitive: cardOfLayer(task, role, "sensitive"),
      work: cardOfLayer(task, role, "work"),
      sayable: [
        task.publicBrief,
        ...task.issues.flatMap((i) => [i.label, i.description]),
      ],
    },
    leaksForbiddenReason,
  );
}

// 1. THE FOUR SB CARDS, in the participant's own words rather than the card's.
for (const taskId of TASKS) {
  for (const role of ROLES) {
    test(`${taskId}/${role}: the sensitive background is read as SB`, () => {
      const sb = cardOfLayer(getTask(taskId), role, "sensitive");
      const out = classify(taskId, role, [sb.text]);
      assert.equal(out.label, "SB", `card text scored ${out.label}`);
      assert.equal(out.confidence, 1);
      assert.equal(out.priority_claim, false);
    });

    test(`${taskId}/${role}: the work reason does not reach SB`, () => {
      const wr = cardOfLayer(getTask(taskId), role, "work");
      const out = classify(taskId, role, [wr.text]);
      assert.notEqual(
        out.label,
        "SB",
        "a safe reason must never buy the disclosure rung",
      );
    });
  }
}

// 2. NEUTRAL TALK IS `none`. Ordinary negotiation about the terms must not
//    score as a reason: the issue names are shared vocabulary, which is exactly
//    what the matcher's subtraction is for.
test("ordinary negotiation talk is not a reason", () => {
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      for (const text of [
        "hi, good to meet you. shall we get started?",
        "I'd like to talk about both of the conditions today.",
        "can we split the difference on this one?",
      ]) {
        const out = classify(taskId, role, [text]);
        assert.equal(
          out.label,
          "none",
          `${taskId}/${role} scored "${text}" as ${out.label}`,
        );
      }
    }
  }
});

// 3. CUMULATIVE (§6.2a). The confession split across messages, none of which
//    is an SB alone, still has to reach SB — judging one at a time is the
//    Direct-arm floor the real route was rewritten to avoid.
test("a confession split across messages still reaches SB", () => {
  for (const taskId of TASKS) {
    for (const role of ROLES) {
      const sb = cardOfLayer(getTask(taskId), role, "sensitive");
      const halves = sb.text.split(". ");
      const pieces = [halves.slice(0, 1).join(". "), halves.slice(1).join(". ")];
      const out = classify(taskId, role, pieces);
      assert.equal(out.label, "SB", `${taskId}/${role} split confession missed`);
    }
  }
});

// 4. STANCE comes off the LATEST message, and matches the mock replies' own
//    accept phrasing so a scripted agreement settles as it reads on screen.
test("acceptance is detected on the latest message only", () => {
  const a = classify("task_a", "leader", ["that works for me."]);
  assert.equal(a.stance, "accept");
  const b = classify("task_a", "leader", ["that works for me.", "actually, one more thing."]);
  assert.equal(b.stance, "none", "an older acceptance must not still count");
  const c = classify("task_a", "leader", ["what do you think?"]);
  assert.equal(c.stance, "none");
});
