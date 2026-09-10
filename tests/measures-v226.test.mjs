import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BACKGROUND_BLOCKS, BR1_ITEM, END_CHECK_BLOCKS, FE1_BLOCK, OEC1_BLOCK,
  blockForTask, dummyAnswer, experienceBlocks, proxyExperienceBlocks,
  requiredIds, responsibilityOrder, taskOpenBlocks, legacyTaskOpenBlocks,
  isExpandedOpenInstrument, OPEN_INSTRUMENT_VERSION, OPEN_INSTRUMENT_V2,
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

test("legacy open-ended sequence and wording remain available by version", () => {
  assert.deepEqual(ids(legacyTaskOpenBlocks(false)), ["OED1", "OEE1", "OET1"]);
  assert.deepEqual(ids(legacyTaskOpenBlocks(true)), ["OED1", "OEE1", "OEP1", "OET1"]);
  assert.deepEqual(taskOpenBlocks(true, { version: "2.27" }), legacyTaskOpenBlocks(true));
  assert.match(legacyTaskOpenBlocks(true)[2].items[0].text, /initially expect/);
});

test("open-v3 has six common and four Proxy questions, comparison only in Task 2, optional comment last", () => {
  assert.equal(OPEN_INSTRUMENT_VERSION, "2.27-open-v3");
  assert.equal(OPEN_INSTRUMENT_V2, "2.27-open-v2");
  const common = ["OED1", "OEI1", "OEF1", "OEE1", "OEN1", "OER1"];
  assert.deepEqual(ids(taskOpenBlocks(false)), [...common, "OET1"]);
  assert.deepEqual(ids(taskOpenBlocks(true)), [...common, "OEP1", "OEP3", "OEP4", "OEP5", "OET1"]);
  for (const isProxy of [false, true]) {
    const second = taskOpenBlocks(isProxy, { taskIndex: 2, role: "member" });
    assert.deepEqual(ids(second).slice(-2), ["OEC1", "OET1"]);
    assert.equal(second.flatMap(requiredIds).length, isProxy ? 11 : 7);
    const optional = blockForTask(taskOpenBlocks(isProxy).at(-1), 2);
    assert.deepEqual(requiredIds(optional), []);
    assert.equal(optional.items[0].id, "OET1_t2");
  }
  assert.equal(taskOpenBlocks(false)[0].items[0].text, taskOpenBlocks(true)[0].items[0].text);
  assert.equal(taskOpenBlocks(false)[1].items[0].text, taskOpenBlocks(true)[1].items[0].text);
  assert.deepEqual(ids([OEC1_BLOCK]), ["OEC1"]);
});

test("open-v3 probes remain optional, role-aware, neutral and free of word minima", () => {
  const blocks = taskOpenBlocks(true, { role: "leader", taskIndex: 2 });
  const items = blocks.flatMap(block => block.items);
  assert.match(items.find(item => item.id === "OEE1").hint, /bonus recommendation/);
  assert.match(taskOpenBlocks(false, { role: "member" })[1].items[0].hint, /evaluation of the Leader/);
  assert.match(items.find(item => item.id === "OEP1").text, /represented you and how much say/);
  assert.match(items.find(item => item.id === "OEP3").hint, /both, or neither/);
  assert.match(items.find(item => item.id === "OEP4").hint, /any AI contribution/);
  assert.match(items.find(item => item.id === "OEP5").hint, /person it represented, the AI, both, or neither/);
  for (const item of items) {
    assert.equal(item.kind, "text");
    assert.equal(item.minWords, undefined);
    assert.equal(item.minLength, undefined);
    assert.doesNotMatch(item.text + " " + item.hint, /people.*real|simulated counterpart|User-Specified|AI-Supplemented/);
  }
});

test("open-v2 wording and ids remain available exactly by version", () => {
  const blocks = taskOpenBlocks(true, { version: OPEN_INSTRUMENT_V2 });
  const items = blocks.flatMap((block) => block.items);
  assert.deepEqual(ids(blocks).slice(6, 10), ["OEP1", "OEP2", "OEP3", "OEP4"]);
  assert.equal(items.find((item) => item.id === "OEP1").text, "How well did your Proxy express what you wanted to say, and why?");
  assert.equal(items.find((item) => item.id === "OEP2").text, "How, if at all, did using a Proxy affect your sense of control over the negotiation, and why?");
  assert.equal(items.find((item) => item.id === "OEP3").text, "Who, if anyone, do you see as responsible for the reasons your Proxy conveyed, and why?");
  assert.equal(items.find((item) => item.id === "OEP4").text, "How did you understand where the reasons conveyed by the other Proxy came from, and why?");
  assert.equal(items.some((item) => item.id === "OEP5"), false);
});

test("expanded instrument recognition accepts only the two expanded versions", () => {
  assert.equal(isExpandedOpenInstrument(OPEN_INSTRUMENT_VERSION), true);
  assert.equal(isExpandedOpenInstrument(OPEN_INSTRUMENT_V2), true);
  for (const version of [undefined, null, "2.27", "2.27-open-v4", 227]) {
    assert.equal(isExpandedOpenInstrument(version), false);
  }
});

test("role decisions and end checks use Ver.2.26 ids only", () => {
  assert.equal(BR1_ITEM.id, "BR1");
  assert.deepEqual(ids([FE1_BLOCK]), ["FE1"]);
  assert.deepEqual(ids(END_CHECK_BLOCKS), ["RSC1", "RSC2", "RSC3", "RSC4", "ICC1", "ICC2", "ICC3"]);
  assert.doesNotMatch(ids([...END_CHECK_BLOCKS, OEC1_BLOCK]).join(" "), /ICC4|FR|ATTR|REMARK|SUS/);
});

test("per-task suffixes and dummy answers preserve canonical code meaning", () => {
  const suffixed = blockForTask(taskOpenBlocks(true)[0], 2);
  assert.deepEqual(suffixed.items.map((item) => item.id), ["OED1_t2", "OEI1_t2", "OEF1_t2"]);
  assert.ok(String(dummyAnswer(suffixed.items[0])).length > 20);
  assert.deepEqual(requiredIds(suffixed), ["OED1_t2", "OEI1_t2", "OEF1_t2"]);
});

test("quantitative response totals are 40 for Leaders and 42 for Members", () => {
  const covariates = 8;
  const commonPostTask = ids(experienceBlocks("leader")).length * 2;
  const proxyOnly = ids(proxyExperienceBlocks("count-key")).length;
  const endRatings = 6;
  assert.equal(covariates + commonPostTask + proxyOnly + endRatings, 40);
  assert.equal(covariates + commonPostTask + proxyOnly + endRatings + 2 * ids([FE1_BLOCK]).length, 42);
});
