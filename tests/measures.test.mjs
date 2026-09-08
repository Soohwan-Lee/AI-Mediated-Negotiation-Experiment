import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ATTR_BLOCK, ATTR_PROXY_ITEM, BACKGROUND_BLOCKS, CP_BLOCK, OE_COMPARE_BLOCK,
  POWER_BLOCK, PROXY_EXPERIENCE_BLOCKS, RECV_EVAL_BLOCK, SUS_IDENTITY_BLOCK,
  SUS_UNUSUAL_BLOCK, blockForTask, disclosureOpenBlock, dummyAnswer,
  experienceBlocks, postCommentOpenBlocks, requiredIds,
} from "../src/lib/measures.ts";

const ids = (blocks) => blocks.flatMap((block) => block.items.map((item) => item.id));

test("background is exactly six BG and eight prespecified covariate items", () => {
  assert.deepEqual(ids(BACKGROUND_BLOCKS), [
    "BG1", "BG2", "BG5", "BG6", "BG7", "BG9",
    "FTS1", "FTS2", "FTS3", "AIA1", "AIA2", "AIA3", "AIA4", "AIA5",
  ]);
});

test("common post-task experience is nine items in canonical order", () => {
  assert.deepEqual(ids(experienceBlocks("leader")), [
    "PERC-F1", "PERC-F2", "PERC-I1", "PERC-I2", "PCR4", "PCR5", "PCR6", "PNPQ1", "PNOQ1",
  ]);
  assert.match(experienceBlocks("leader")[0].items[2].text, /evaluation of me sent to the director/);
  assert.match(experienceBlocks("member")[0].items[2].text, /my bonus/);
});

test("Proxy experience retains representation, source, and symmetric responsibility", () => {
  assert.deepEqual(ids(PROXY_EXPERIENCE_BLOCKS), ["OWN-AI2", "OWN-AI4", "OTHER-AI2", "OTHER-AI4"]);
  assert.match(PROXY_EXPERIENCE_BLOCKS[0].items[1].text, /^I felt responsible/);
  assert.match(PROXY_EXPERIENCE_BLOCKS[1].items[1].text, /^I felt that the counterpart was responsible/);
});

test("condition-specific open responses total Direct two, Proxy three, and one comparison", () => {
  assert.deepEqual(ids([disclosureOpenBlock(false), ...postCommentOpenBlocks(false)]), ["OE-DISC-D", "OE-INTERP-D"]);
  assert.deepEqual(ids([disclosureOpenBlock(true), ...postCommentOpenBlocks(true)]), ["OE-DISC-P", "OE-SELF-P", "OE-OTHER-P"]);
  assert.ok(postCommentOpenBlocks(true).every((block) => block.items.length === 1));
  assert.deepEqual(ids([OE_COMPARE_BLOCK]), ["OE-COMP"]);
});

test("open questions use one field with optional prompts and no minimum", () => {
  for (const block of [disclosureOpenBlock(false), disclosureOpenBlock(true), ...postCommentOpenBlocks(false), ...postCommentOpenBlocks(true), OE_COMPARE_BLOCK]) {
    assert.match(block.hint, /no minimum word count/i);
    for (const item of block.items) {
      assert.equal(item.kind, "text");
      assert.match(item.hint, /^Optional prompt:/);
      assert.ok(String(dummyAnswer(item)).length > 20);
    }
  }
});

test("role decision and comment measures use canonical single-item forms", () => {
  assert.deepEqual(ids([RECV_EVAL_BLOCK]), ["RECV-EVAL"]);
  assert.deepEqual(ids([ATTR_BLOCK]), ["ATTR1"]);
  assert.equal(ATTR_PROXY_ITEM.id, "ATTR2");
  assert.equal(ATTR_PROXY_ITEM.low, "Entirely at my AI Proxy");
  assert.equal(ATTR_PROXY_ITEM.high, "Entirely at me");
});

test("end flow contains only comparison, role checks, CP, and SUS funnel", () => {
  assert.deepEqual(ids([OE_COMPARE_BLOCK, POWER_BLOCK, CP_BLOCK, SUS_UNUSUAL_BLOCK, SUS_IDENTITY_BLOCK]), [
    "OE-COMP", "POWER1", "POWER2", "IMM2", "INCENT1", "CP1", "CP2", "SUS0", "SUS3", "SUS3-WHEN",
  ]);
  assert.ok(!requiredIds(SUS_IDENTITY_BLOCK).includes("SUS3-WHEN"));
  assert.ok(!SUS_UNUSUAL_BLOCK.items[0].text.includes("real person"));
});

test("per-task suffixes preserve item meaning and optional ids", () => {
  const suffixed = blockForTask(SUS_IDENTITY_BLOCK, 2);
  assert.deepEqual(suffixed.items.map((item) => item.id), ["SUS3_t2", "SUS3-WHEN_t2"]);
  assert.deepEqual(suffixed.optional, ["SUS3-WHEN_t2"]);
  assert.equal(dummyAnswer({ kind: "text", id: "OE-COMP_t1", text: "" }), dummyAnswer({ kind: "text", id: "OE-COMP", text: "" }));
});

test("the quantitative response totals are 40 for Leaders and 42 for Members", () => {
  const covariates = 8;
  const commonPostTask = ids(experienceBlocks("leader")).length * 2;
  const proxyOnly = ids(PROXY_EXPERIENCE_BLOCKS).length;
  const comments = 1 + 2;
  const endChecks = ids([POWER_BLOCK, CP_BLOCK]).length + 1;
  assert.equal(covariates + commonPostTask + proxyOnly + comments + endChecks, 40);
  assert.equal(covariates + commonPostTask + proxyOnly + comments + endChecks + 2 * ids([RECV_EVAL_BLOCK]).length, 42);
});
