import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const welcome = read("../src/app/page.tsx");
const guide = read("../src/components/briefing-guide.tsx");
const session = read("../src/components/session.tsx");
const shared = read("../src/app/task/[index]/shared.tsx");
const practice = read("../src/app/practice/[index]/practice-round.tsx");
const measures = read("../src/lib/measures.ts");
const illustrations = read("../src/lib/illustrations.ts");

test("eligibility is based on English ability and work experience, not US residence", () => {
  assert.match(welcome, /read and write English comfortably/);
  assert.match(welcome, /at least one year of work experience/);
  assert.doesNotMatch(welcome, /reside in the United States/);
});

test("participants are explicitly told never to reveal any option point value", () => {
  assert.match(guide, /Never share your point values/);
  assert.match(guide, /how many points any option gives you/);
  assert.match(guide, /Discuss the work terms and your reasons instead/);
});

test("sensitive context is framed as fictional role information without a benefit pitch", () => {
  assert.match(guide, /belonging to this fictional role/);
  assert.match(guide, /not a request for your real personal history/);
  assert.match(session, /sensitive private context for your assigned role/);
  assert.doesNotMatch(session, /help the other side understand/);
  assert.doesNotMatch(shared, /help the other person understand/);
});

test("the situation stays expanded in the negotiation briefing rail", () => {
  assert.match(session, /<details open className="group [^"]*rounded-lg/);
});

test("practice teaches the prominent mutual-confirmation acceptance control", () => {
  assert.match(practice, /Accept current offer/);
  assert.match(practice, /both of you confirm the same two terms/);
  assert.match(practice, /sendProxyConfirmation/);
  assert.match(practice, /disabled=\{!proxyCounterpartConfirmed \|\| acceptedOffer\}/);
  assert.doesNotMatch(practice, /setProxyDecision/);
  assert.doesNotMatch(practice, /writeStopReason/);
  assert.match(measures, /both confirm the final agreement/);
});

test("task brief illustrations use the Ver.2.27 asset set and native issue captions", () => {
  for (const filename of [
    "design227-task-a.png",
    "design227-task-a-leader.png",
    "design227-task-a-member.png",
    "design227-task-b.png",
    "design227-task-b-leader.png",
    "design227-task-b-member.png",
  ]) assert.match(illustrations, new RegExp(filename.replace(".", "\\.")));
  assert.equal((illustrations.match(/design227-[^\"]+\?v=20260910/g) ?? []).length, 6);
  assert.match(shared, /Issue 1 · Office days per week/);
  assert.match(shared, /Issue 2 · Member-written weekly client reports/);
});
