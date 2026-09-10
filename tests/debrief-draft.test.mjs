import assert from "node:assert/strict";
import test from "node:test";

import {
  readDebriefDraft,
  writeDebriefDraft,
} from "../src/lib/debrief-draft.ts";

function installStorage() {
  const entries = new Map();
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
}

test.afterEach(() => {
  delete globalThis.window;
});

test("optional debrief drafts restore only for the same participant", () => {
  installStorage();

  writeDebriefDraft("participant-a", "Please make the task timer clearer.");

  assert.equal(
    readDebriefDraft("participant-a"),
    "Please make the task timer clearer.",
  );
  assert.equal(readDebriefDraft("participant-b"), "");
});
