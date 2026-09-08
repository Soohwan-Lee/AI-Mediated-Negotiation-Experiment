/**
 * The §9 instrument, pinned where getting it wrong is silent.
 *
 * These are not "does the file parse" tests. Each one guards a property that a
 * plausible edit breaks without any visible symptom: an item order that
 * contaminates a later answer, a conditional block asked of the wrong people,
 * an id renamed (which renames a column in the export), or a free-text item
 * with no mockup answer (which makes a screen unreadable in a walkthrough
 * without failing anything).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ATTR_BLOCK,
  FINAL_OPEN_BLOCK,
  POWER_BLOCK,
  SUSPICION_BLOCK,
  dummyAnswer,
  m1Item,
  postTaskBlocks,
  requiredIds,
} from "../src/lib/measures.ts";

const ids = (blocks) => blocks.flatMap((b) => b.items.map((i) => i.id));

// --- 9.4.4a  CP ------------------------------------------------------------

test("CP is asked after a Direct task, always", () => {
  // A Direct participant wrote the whole negotiation, so there is always a
  // stretch of the other person's messages for CP to be about.
  assert.ok(ids(postTaskBlocks(false, true)).includes("CP1"));
  assert.ok(ids(postTaskBlocks(false, true)).includes("CP2"));
});

test("CP is asked after a Proxy task only when the closing conversation happened", () => {
  // RATIFY = approve ends the task at the decision screen. That participant
  // watched two representatives and never exchanged a word with the person,
  // so "their messages felt natural" would have no stimulus.
  assert.ok(ids(postTaskBlocks(true, true)).includes("CP1"));
  assert.ok(!ids(postTaskBlocks(true, false)).includes("CP1"));
  assert.ok(!ids(postTaskBlocks(true, false)).includes("CP2"));
});

test("CP sits after PNOQ and before the AI blocks (§9.4.4a)", () => {
  // Order is the design, not layout. Asking about the other side's AI Proxy
  // before asking about the other side would tell the participant what to
  // notice about them.
  const order = postTaskBlocks(true, true).map((b) => b.id);
  assert.deepEqual(order, [
    "perc",
    "pcr",
    "pnpq",
    "pnoq",
    "cp",
    "own_ai",
    "other_ai",
  ]);
});

test("CP's wording points at the other participant, never at a Proxy", () => {
  const cp = postTaskBlocks(true, true).find((b) => b.id === "cp");
  for (const item of cp.items) {
    assert.ok(
      !/proxy/i.test(item.text) && !/\bAI\b/.test(item.text),
      `${item.id} names a Proxy: ${item.text}`,
    );
  }
  // It is also asked BEFORE the debriefing and must not use the words the
  // debriefing is about, or it becomes a hindsight question.
  for (const item of cp.items) {
    assert.ok(!/\b(human|real person|bot)\b/i.test(item.text), item.id);
  }
});

// --- 9.3.1  M1 -------------------------------------------------------------

test("M1 offers exactly the four §9.3.1 reasons, in the design's order", () => {
  const four = [
    "I was worried it would make me look bad",
    "I was worried it would be used against me",
    "It didn't seem relevant",
    "It's a private matter",
  ];
  assert.deepEqual(
    m1Item("proxy").options.map((o) => o.label),
    four,
  );
  // The Direct form adds ONE escape and nothing else. It is asked
  // retrospectively of everyone, so someone who did disclose needs a way past
  // it; §9.3.1's distribution is defined over non-disclosers and excludes it.
  const direct = m1Item("direct").options;
  assert.equal(direct[0].value, "did_share");
  assert.deepEqual(direct.slice(1).map((o) => o.label), four);
});

// --- 9.5  the end block ----------------------------------------------------

test("the end block is the eleven §9.5 measures in order", () => {
  const order = ids([POWER_BLOCK, FINAL_OPEN_BLOCK, SUSPICION_BLOCK]).filter(
    (id) => id !== "SUS3-WHEN",
  );
  assert.deepEqual(order, [
    "POWER1",
    "POWER2",
    "IMM1",
    "IMM2",
    "INCENT1",
    "OE-F1",
    "OE-F2",
    "SUS0",
    "SUS1",
    "SUS2",
    "SUS3",
  ]);
});

test("the suspicion funnel widens to narrow, and SUS3 is last", () => {
  // SUS0 supplies no hypothesis; SUS3 supplies the whole one. A "yes" at SUS3
  // from someone who wrote nothing at SUS0 is much weaker evidence, which is
  // the entire reason for the order.
  const order = SUSPICION_BLOCK.items.map((i) => i.id);
  assert.equal(order[0], "SUS0");
  assert.ok(order.indexOf("SUS3") > order.indexOf("SUS0"));
  assert.ok(order.indexOf("SUS3") > order.indexOf("SUS1"));
  assert.equal(order[order.length - 1], "SUS3-WHEN");
  // Only SUS3 may name the deception.
  for (const item of SUSPICION_BLOCK.items) {
    if (item.id.startsWith("SUS3")) continue;
    assert.ok(
      !/real person/i.test(item.text),
      `${item.id} plants the idea the funnel exists to detect`,
    );
  }
});

test("SUS3's free-text half is optional", () => {
  // A "No" answer leaves nothing to write. Gating Continue on it would push
  // those participants into inventing a suspicion they did not have.
  assert.ok(!requiredIds(SUSPICION_BLOCK).includes("SUS3-WHEN"));
  assert.ok(requiredIds(SUSPICION_BLOCK).includes("SUS3"));
});

test("IMM2 asks about this sample, not about the pretest's", () => {
  // Restored in Ver.2.21: pretest 3 is a separate sample, so it cannot answer
  // gate 4 for the people who actually ran the study.
  const imm2 = POWER_BLOCK.items.find((i) => i.id === "IMM2");
  assert.ok(imm2);
  assert.equal(imm2.kind, "scale");
});

// --- mockup mode -----------------------------------------------------------

test("every free-text item in the end block has a written mockup answer", () => {
  // A textarea that fills with "" in mockup mode tells you the control renders
  // and nothing about whether the question reads — which is the whole point of
  // filling rather than skipping.
  for (const block of [POWER_BLOCK, FINAL_OPEN_BLOCK, SUSPICION_BLOCK, ATTR_BLOCK]) {
    for (const item of block.items) {
      if (item.kind !== "text") continue;
      const answer = dummyAnswer(item);
      assert.ok(
        typeof answer === "string" && answer.length > 20,
        `${item.id} has no written mockup answer`,
      );
    }
  }
});

test("mockup answers survive the per-task id suffix", () => {
  // Per-task items carry `_t1` / `_t2`; the lookup strips it, and a change
  // that stopped stripping would blank every open answer in both tasks.
  assert.equal(
    dummyAnswer({ kind: "text", id: "OE-F1_t1", text: "" }),
    dummyAnswer({ kind: "text", id: "OE-F1", text: "" }),
  );
});
