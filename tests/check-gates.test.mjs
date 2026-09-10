import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmCheckGateAdvance,
  readCheckGate,
  readStopReason,
  taskGateRedirect,
  writeCheckGate,
  writeStopReason,
} from "../src/lib/check-gates.ts";
import {
  markTaskCompleted,
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
      removeItem(key) {
        entries.delete(key);
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

test("legacy failed gates become pending without losing attempt history", () => {
  installStorage();

  writeCheckGate("participant-a", "task-1", { status: "passed", attempts: 1 });
  writeCheckGate("participant-a", "task-2", { status: "failed", attempts: 2 });

  assert.deepEqual(readCheckGate("participant-a", "task-1"), {
    status: "passed",
    attempts: 1,
  });
  assert.deepEqual(readCheckGate("participant-a", "task-2"), {
    status: "pending",
    attempts: 2,
  });
});

test("legacy check stops are cleared while withdrawal remains terminal", () => {
  const storage = installStorage();

  writeStopReason("participant-a", "check");
  writeStopReason("participant-b", "withdrawal");

  assert.equal(readStopReason("participant-a"), null);
  assert.equal(storage.has("amne:check-gate:participant-a:stopped"), false);
  assert.equal(readStopReason("participant-b"), "withdrawal");
  assert.equal(readStopReason("participant-c"), null);
});

test("gate and stop migration does not leak between participants", () => {
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

test("task gate routing is shared across common, practice, pass, and withdrawal states", () => {
  installStorage();
  assert.deepEqual(taskGateRedirect("participant-a", 1), {
    href: "/instruction",
    furthestKey: "instruction",
  });

  writeCheckGate("participant-a", "common", { status: "passed", attempts: 3 });
  assert.deepEqual(taskGateRedirect("participant-a", 1), {
    href: "/practice/1",
    furthestKey: "practice",
  });

  writeCheckGate("participant-a", "task-1", { status: "passed", attempts: 4 });
  assert.equal(taskGateRedirect("participant-a", 1), null);

  writeStopReason("participant-a", "withdrawal");
  assert.deepEqual(taskGateRedirect("participant-a", 1), {
    href: "/study-stop?reason=withdrawal",
  });
});

test("a direct remediation correction closes the common gate before Task 1", () => {
  installStorage();
  writeCheckGate("participant-a", "common", { status: "pending", attempts: 1 });

  assert.equal(
    confirmCheckGateAdvance("participant-a", "common", true, true, 1),
    true,
  );
  writeCheckGate("participant-a", "task-1", { status: "passed", attempts: 1 });

  assert.deepEqual(readCheckGate("participant-a", "common"), {
    status: "passed",
    attempts: 1,
  });
  assert.equal(taskGateRedirect("participant-a", 1), null);
});

test("retry remains required until a corrected check is submitted", () => {
  installStorage();
  writeCheckGate("participant-a", "common", { status: "pending", attempts: 1 });

  assert.equal(
    confirmCheckGateAdvance("participant-a", "common", false, true, 2),
    false,
  );
  assert.equal(
    confirmCheckGateAdvance("participant-a", "common", true, false, 2),
    false,
  );
  assert.equal(
    confirmCheckGateAdvance("participant-a", "common", false, false, 2),
    false,
  );
  assert.deepEqual(taskGateRedirect("participant-a", 1), {
    href: "/instruction",
    furthestKey: "instruction",
  });

  assert.equal(
    confirmCheckGateAdvance("participant-a", "common", true, true, 2),
    true,
  );
  assert.deepEqual(readCheckGate("participant-a", "common"), {
    status: "passed",
    attempts: 2,
  });
});

test("reload remains allowed before the measured task becomes active", () => {
  installStorage();
  writeCheckGate("participant-a", "common", { status: "passed", attempts: 8 });
  writeCheckGate("participant-a", "task-1", { status: "passed", attempts: 9 });

  assert.equal(readTaskRun("participant-a", 1), null);
  assert.equal(taskGateRedirect("participant-a", 1), null);
  assert.equal(taskGateRedirect("participant-a", 1), null);
  assert.equal(readTaskRun("participant-a", 1), null);
});

test("re-entering an active task marks it interrupted and stops the study", () => {
  installStorage();
  writeCheckGate("participant-a", "common", { status: "passed", attempts: 1 });
  writeCheckGate("participant-a", "task-1", { status: "passed", attempts: 1 });
  markTaskStarted("participant-a", 1);

  assert.deepEqual(taskGateRedirect("participant-a", 1), {
    href: "/study-stop?reason=technical",
  });
  assert.equal(readTaskRun("participant-a", 1)?.status, "interrupted");
  assert.equal(readStopReason("participant-a"), "technical");
});

test("a completed task re-entry advances to its questionnaire instead of restarting", () => {
  installStorage();
  markTaskStarted("participant-a", 1);
  markTaskCompleted("participant-a", 1);

  assert.deepEqual(taskGateRedirect("participant-a", 1), {
    href: "/task/1/survey",
    preserveFurthest: true,
  });
});

test("a completed old task never lowers a participant's later position", () => {
  installStorage({ "amne:furthest": "8" });
  markTaskStarted("participant-a", 1);
  markTaskCompleted("participant-a", 1);

  assert.deepEqual(taskGateRedirect("participant-a", 1), {
    href: "/task/2",
    preserveFurthest: true,
  });
});

test("task run markers do not leak from the first task to the second", () => {
  installStorage();
  writeCheckGate("participant-a", "common", { status: "passed", attempts: 3 });
  writeCheckGate("participant-a", "task-2", { status: "passed", attempts: 4 });
  markTaskStarted("participant-a", 1);

  assert.equal(taskGateRedirect("participant-a", 2), null);
  assert.equal(readTaskRun("participant-a", 2), null);
});
