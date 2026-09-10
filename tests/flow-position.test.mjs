import assert from "node:assert/strict";
import test from "node:test";

import {
  readFurthest,
  setFlowPositionIdentity,
} from "../src/lib/flow-position.ts";

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

test("the same participant keeps an existing progress mark on reload", () => {
  const storage = installStorage({
    "amne:furthest": "8",
    "amne:session": JSON.stringify({ participantKey: "participant-a" }),
  });

  setFlowPositionIdentity("participant-a");

  assert.equal(readFurthest(), 8);
  assert.equal(storage.get("amne:furthest-identity"), "participant-a");
});

test("a newly admitted participant cannot inherit the previous progress mark", () => {
  const storage = installStorage({
    "amne:furthest": "8",
    "amne:furthest-identity": "participant-a",
    "amne:session": JSON.stringify({ participantKey: "participant-a" }),
  });

  setFlowPositionIdentity("participant-b");

  assert.equal(readFurthest(), 0);
  assert.equal(storage.get("amne:furthest-identity"), "participant-b");
});

test("a malformed legacy session cannot donate progress to a new identity", () => {
  const storage = installStorage({
    "amne:furthest": "11",
    "amne:session": "not json",
  });

  setFlowPositionIdentity("participant-b");

  assert.equal(readFurthest(), 0);
  assert.equal(storage.get("amne:furthest-identity"), "participant-b");
});
