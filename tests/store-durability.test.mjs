import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { LocalStore } from "../src/lib/store.ts";

const values = new Map();
let writesFail = false;

globalThis.window = {
  localStorage: {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => {
      if (writesFail) throw new Error("quota exceeded");
      values.set(key, value);
    },
  },
};

function message(id, extra = {}) {
  return {
    id,
    sessionIndex: 1,
    speaker: "participant",
    text: `message ${id}`,
    createdAt: "2026-09-10T00:00:00.000Z",
    ...extra,
  };
}

test("a failed local write remains readable and confirmSaved retries it", async () => {
  values.clear();
  writesFail = true;
  const store = new LocalStore();

  await store.saveResponses("participant-a", "background", { BG1: "35-44" });
  assert.deepEqual(
    await store.loadResponses("participant-a", "background"),
    { BG1: "35-44" },
    "the current session must not lose access to an unsaved value",
  );
  assert.equal(await store.confirmSaved(), false);

  writesFail = false;
  assert.equal(await store.confirmSaved(), true);
  assert.deepEqual(
    JSON.parse(values.get("amne:responses:participant-a:background")),
    { BG1: "35-44" },
  );
});

test("appendMessage merges a classified repeat by id and preserves distinct rapid messages", async () => {
  values.clear();
  writesFail = true;
  const store = new LocalStore();

  await store.appendMessage("participant-a", message("m1"));
  await store.appendMessage(
    "participant-a",
    message("m1", {
      text: "a later rendering must not replace the original",
      createdAt: "2026-09-10T00:00:01.000Z",
      reasonLabel: "SB",
      reasonConfidence: 0.97,
    }),
  );
  await store.appendMessage("participant-a", message("m2"));

  const saved = await store.loadMessages("participant-a", 1);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].id, "m1");
  assert.equal(saved[0].text, "message m1");
  assert.equal(saved[0].createdAt, "2026-09-10T00:00:00.000Z");
  assert.equal(saved[0].reasonLabel, "SB");
  assert.equal(saved[0].reasonConfidence, 0.97);
  assert.equal(saved[1].id, "m2");

  writesFail = false;
  assert.equal(await store.confirmSaved(), true);
  assert.equal(
    JSON.parse(values.get("amne:messages:participant-a:1")).length,
    2,
    "retry must keep both distinct rapid messages",
  );
});

test("study_completed is idempotent in the local participant event stream", async () => {
  values.clear();
  const store = new LocalStore();
  const event = {
    type: "study_completed",
    participantKey: "participant-a",
    page: "complete",
    clientTimestamp: "2026-09-10T00:00:00.000Z",
  };

  await store.logEvent(event);
  await store.logEvent({ ...event, clientTimestamp: "2026-09-10T00:00:01.000Z" });

  assert.equal(JSON.parse(values.get("amne:events:participant-a")).length, 1);
});

test("completion code stays behind save and interruption checks", () => {
  const complete = readFileSync("src/app/complete/page.tsx", "utf8");
  assert.match(complete, /await store\.confirmSaved\(\)/);
  assert.match(complete, /await store\.logEvent\(\{[\s\S]*type: "study_completed"/);
  assert.match(complete, /status === "ready" \? \(/);
  assert.match(complete, /stopped === "withdrawal" \|\| stopped === "technical"/);
  assert.match(complete, /taskRuns\.every\(\(run\) => run\?\.status === "completed"\)/);
  assert.match(complete, /!devEnabled/);
  assert.match(complete, /It has not been submitted to a research server/);
});
