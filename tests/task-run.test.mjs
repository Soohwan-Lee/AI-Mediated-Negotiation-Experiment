import assert from "node:assert/strict";
import test from "node:test";

import {
  markTaskCompleted,
  markTaskInterrupted,
  markTaskStarted,
  readTaskRun,
} from "../src/lib/task-run.ts";

function installStorage(seed = {}) {
  const entries = new Map(Object.entries(seed));
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return entries.has(key) ? entries.get(key) : null;
      },
      setItem(key, value) {
        entries.set(key, String(value));
      },
    },
  };
  return entries;
}

test.afterEach(() => {
  delete globalThis.window;
});

test("task runs are scoped by participant and task", () => {
  installStorage();

  const first = markTaskStarted("participant-a", 1);

  assert.equal(first?.status, "active");
  assert.deepEqual(readTaskRun("participant-a", 1), first);
  assert.equal(readTaskRun("participant-a", 2), null);
  assert.equal(readTaskRun("participant-b", 1), null);
});

test("active, interrupted, and completed transitions preserve the start time", () => {
  installStorage();

  const active = markTaskStarted("participant-a", 1);
  const sameActive = markTaskStarted("participant-a", 1);
  assert.equal(sameActive?.startedAt, active?.startedAt);

  const completed = markTaskCompleted("participant-a", 1);
  assert.equal(completed?.status, "completed");
  assert.equal(completed?.startedAt, active?.startedAt);
  assert.equal(typeof completed?.completedAt, "string");

  assert.deepEqual(markTaskInterrupted("participant-a", 1), completed);
  assert.deepEqual(readTaskRun("participant-a", 1), completed);

  const secondActive = markTaskStarted("participant-a", 2);
  const interrupted = markTaskInterrupted("participant-a", 2);
  assert.equal(interrupted?.status, "interrupted");
  assert.equal(interrupted?.startedAt, secondActive?.startedAt);
  assert.equal(typeof interrupted?.interruptedAt, "string");
});

test("a task cannot be completed unless its active marker was stored", () => {
  installStorage();
  assert.equal(markTaskCompleted("participant-a", 1), null);
});

test("a blocked browser store fails closed before a task can start", () => {
  globalThis.window = {
    localStorage: {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    },
  };

  assert.equal(readTaskRun("participant-a", 1), null);
  assert.equal(markTaskStarted("participant-a", 1), null);
  assert.doesNotThrow(() => markTaskInterrupted("participant-a", 1));
});

test("successful markers mirror task status into the existing response store", () => {
  const storage = installStorage();

  const active = markTaskStarted("participant-a", 1);
  assert.deepEqual(
    JSON.parse(storage.get("amne:responses:participant-a:task_run_t1")),
    active,
  );
});
