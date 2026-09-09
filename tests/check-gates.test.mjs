import assert from "node:assert/strict";
import test from "node:test";

import {
  readCheckGate,
  readStopReason,
  writeCheckGate,
  writeStopReason,
} from "../src/lib/check-gates.ts";

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

test("a participant's attempt count and pending state survive a reload read", () => {
  const storage = installStorage();

  writeCheckGate("participant-a", "common", { status: "pending", attempts: 1 });

  assert.deepEqual(readCheckGate("participant-a", "common"), {
    status: "pending",
    attempts: 1,
  });
  assert.equal(
    storage.get("amne:check-gate:participant-a:common"),
    JSON.stringify({ status: "pending", attempts: 1 }),
  );
});

test("passed and failed gates remain distinct across task scopes", () => {
  installStorage();

  writeCheckGate("participant-a", "task-1", { status: "passed", attempts: 1 });
  writeCheckGate("participant-a", "task-2", { status: "failed", attempts: 2 });

  assert.deepEqual(readCheckGate("participant-a", "task-1"), {
    status: "passed",
    attempts: 1,
  });
  assert.deepEqual(readCheckGate("participant-a", "task-2"), {
    status: "failed",
    attempts: 2,
  });
});

test("check and withdrawal stop reasons persist for the intended participant", () => {
  installStorage();

  writeStopReason("participant-a", "check");
  writeStopReason("participant-b", "withdrawal");

  assert.equal(readStopReason("participant-a"), "check");
  assert.equal(readStopReason("participant-b"), "withdrawal");
  assert.equal(readStopReason("participant-c"), null);
});

test("gate and stop state do not leak between participants", () => {
  installStorage();

  writeCheckGate("participant-a", "common", { status: "failed", attempts: 2 });
  writeStopReason("participant-a", "check");

  assert.deepEqual(readCheckGate("participant-b", "common"), {
    status: "pending",
    attempts: 0,
  });
  assert.equal(readStopReason("participant-b"), null);
});

test("missing, malformed, and invalid persisted records restore safely", () => {
  installStorage({
    "amne:check-gate:participant-a:common": "not json",
    "amne:check-gate:participant-a:task-1": JSON.stringify({
      status: "unknown",
      attempts: 99,
    }),
    "amne:check-gate:participant-a:task-2": JSON.stringify({
      status: "passed",
      attempts: -4,
    }),
    "amne:check-gate:participant-a:stopped": "timeout",
  });

  assert.deepEqual(readCheckGate("participant-a", "common"), {
    status: "pending",
    attempts: 0,
  });
  assert.deepEqual(readCheckGate("participant-a", "task-1"), {
    status: "pending",
    attempts: 0,
  });
  assert.deepEqual(readCheckGate("participant-a", "task-2"), {
    status: "passed",
    attempts: 0,
  });
  assert.equal(readStopReason("participant-a"), null);
});

test("server rendering reads neutral state and performs no writes", () => {
  delete globalThis.window;

  assert.deepEqual(readCheckGate("participant-a", "common"), {
    status: "pending",
    attempts: 0,
  });
  assert.equal(readStopReason("participant-a"), null);
  assert.doesNotThrow(() => {
    writeCheckGate("participant-a", "common", { status: "passed", attempts: 1 });
    writeStopReason("participant-a", "check");
  });
});
