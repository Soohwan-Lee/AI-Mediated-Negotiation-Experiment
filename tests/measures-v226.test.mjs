import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BACKGROUND_BLOCKS, BR1_ITEM, END_CHECK_BLOCKS, FE1_BLOCK, OEC1_BLOCK,
  blockForTask, dummyAnswer, experienceBlocks, proxyExperienceBlocks,
  requiredIds, responsibilityOrder, taskOpenBlocks,
} from "../src/lib/measures.ts";

const ids = (blocks) => blocks.flatMap((block) => block.items.map((item) => item.id));

test("Ver.2.26 background has the seven canonical BG codes and eight covariate items", () => {
  assert.deepEqual(ids(BACKGROUND_BLOCKS), [
    "BG1", "BG2", "BG3", "BG4", "BG5", "BG6", "BG7",
    "FTS1", "FTS2", "FTS3", "AIA1", "AIA2", "AIA3", "AIA4", "AIA5",
  ]);
});

test("each task scale page contains Direct 9 or Proxy 17 items in grouped blocks", () => {
  const direct = experienceBlocks("leader", false);
  const proxy = [...experienceBlocks("member", true), ...proxyExperienceBlocks("participant-a")];
  assert.deepEqual(ids(direct), ["SCF1", "SCF2", "SCE1", "SCE2", "CE1", "CE2", "CE3", "NS1", "NS2"]);
  assert.deepEqual(new Set(ids(proxy)), new Set([
    "SCF1", "SCF2", "SCE1", "SCE2", "CE1", "CE2", "CE3", "NS1", "NS2",
    "PMP1", "PMP2", "PMP3", "PMP4", "POP1", "POP2", "POP3", "POP4",
  ]));
  assert.equal(ids(direct).length, 9);
  assert.equal(ids(proxy).length, 17);
  assert.match(experienceBlocks("leader")[1].items[0].text, /evaluation of me sent to the director/);
  assert.match(experienceBlocks("member")[1].items[0].text, /my bonus/);
});

test("responsibility order is stable, varies by participant, and preserves fixed analysis ids", () => {
  assert.equal(responsibilityOrder("a"), responsibilityOrder("a"));
  assert.notEqual(responsibilityOrder("a"), responsibilityOrder("b"));
  for (const key of ["a", "b"]) {
    const blocks = proxyExperienceBlocks(key);
    assert.deepEqual(new Set(blocks[0].items.slice(2).map((item) => item.id)), new Set(["PMP3", "PMP4"]));
    assert.deepEqual(new Set(blocks[1].items.slice(2).map((item) => item.id)), new Set(["POP3", "POP4"]));
  }
});

test("open-ended sequence is shared OED1, OEE1, then Proxy-only OEP1", () => {
  assert.deepEqual(ids(taskOpenBlocks(false)), ["OED1", "OEE1"]);
  assert.deepEqual(ids(taskOpenBlocks(true)), ["OED1", "OEE1", "OEP1"]);
  assert.equal(taskOpenBlocks(false)[0].items[0].text, taskOpenBlocks(true)[0].items[0].text);
  assert.equal(taskOpenBlocks(false)[1].items[0].text, taskOpenBlocks(true)[1].items[0].text);
  assert.deepEqual(ids([OEC1_BLOCK]), ["OEC1"]);
});

test("role decisions and end checks use Ver.2.26 ids only", () => {
  assert.equal(BR1_ITEM.id, "BR1");
  assert.deepEqual(ids([FE1_BLOCK]), ["FE1"]);
  assert.deepEqual(ids(END_CHECK_BLOCKS), ["RSC1", "RSC2", "RSC3", "RSC4", "ICC1", "ICC2", "ICC3"]);
  assert.doesNotMatch(ids([...END_CHECK_BLOCKS, OEC1_BLOCK]).join(" "), /ICC4|FR|ATTR|REMARK|SUS/);
});

test("per-task suffixes and dummy answers preserve canonical code meaning", () => {
  const suffixed = blockForTask(taskOpenBlocks(true)[0], 2);
  assert.deepEqual(suffixed.items.map((item) => item.id), ["OED1_t2"]);
  assert.ok(String(dummyAnswer(suffixed.items[0])).length > 20);
  assert.deepEqual(requiredIds(suffixed), ["OED1_t2"]);
});

test("quantitative response totals are 40 for Leaders and 42 for Members", () => {
  const covariates = 8;
  const commonPostTask = ids(experienceBlocks("leader")).length * 2;
  const proxyOnly = ids(proxyExperienceBlocks("count-key")).length;
  const endRatings = 6;
  assert.equal(covariates + commonPostTask + proxyOnly + endRatings, 40);
  assert.equal(covariates + commonPostTask + proxyOnly + endRatings + 2 * ids([FE1_BLOCK]).length, 42);
});
