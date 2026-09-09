import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { participantKeyForDevSlot } from "../src/lib/assignment.ts";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("synthetic dev persistence never replaces an existing participant key", () => {
  assert.equal(participantKeyForDevSlot(null, true), "P-devpreview");
  assert.equal(participantKeyForDevSlot("P-real", true), "P-real");
  assert.equal(participantKeyForDevSlot("P-real", false), "P-real");
  assert.equal(participantKeyForDevSlot(null, false), null);
});

test("active practice and task routes are keyed to the current assignment", () => {
  const practice = read("../src/app/practice/[index]/page.tsx");
  const task = read("../src/app/task/[index]/page.tsx");
  assert.match(practice, /<PracticeRound key=\{fingerprint\}/);
  assert.match(task, /gateReadyFor !== assignmentFingerprint/);
  assert.match(task, /if \(devEnabled\)/);
  assert.doesNotMatch(task, /NODE_ENV/);
});
