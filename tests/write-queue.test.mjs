/**
 * The Supabase write queue's failure behaviour.
 *
 * Run with `npm run test:units`.
 *
 * WHY THIS IS TESTED WHEN THE STORE IS NOT EVEN WIRED UP. The queue exists for
 * exactly one situation — the network failing partway through a 55-minute study
 * — and that situation is the hardest to reach by hand and the most expensive
 * to get wrong: the writes it holds are the transcript, the mandate and the
 * survey blocks. Three bugs were found here by tracing the loop on paper, and
 * every one of them was invisible in the happy path:
 *
 *   1. `flush()` resolved while writes were still queued, whenever a background
 *      drain happened to be running. The awaited writes are awaited precisely
 *      because the next screen depends on them.
 *   2. A failing item was rotated to the back still carrying its exhausted
 *      attempt count, so every later drain broke on it immediately and the
 *      queue never moved again — silent, permanent data loss.
 *   3. Retrying inside one drain slept up to 90 seconds per item while
 *      `flush()` awaited it, so a dropped connection looked like a frozen
 *      study.
 *
 * The queue is coupled to browser globals, so the test stubs the few it uses.
 * The logic under test is the drain/flush contract, not the storage.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// --- browser stubs, installed before the module is evaluated ---------------
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  },
  addEventListener: () => {},
};
globalThis.localStorage = globalThis.window.localStorage;
globalThis.document = { visibilityState: "visible" };
// `navigator` is getter-only in Node 22, so it has to be redefined rather than
// assigned. Only `sendBeacon` is used, and only on tab-hide.
Object.defineProperty(globalThis, "navigator", {
  value: { sendBeacon: () => true },
  configurable: true,
  writable: true,
});

/** Load `WriteQueue` from source, stripping types (no build step). */
const source = readFileSync("src/lib/store-supabase.ts", "utf8");
const classStart = source.indexOf("interface QueuedWrite");
const classEnd = source.indexOf("export class SupabaseStore");
const js = source
  .slice(classStart, classEnd)
  // drop the QueuedWrite interface entirely
  .replace(/interface QueuedWrite \{[\s\S]*?\n\}\n/, "")
  .replace(/: QueuedWrite\[\]/g, "")
  .replace(/: Promise<void> \| null/g, "")
  .replace(/: Promise<void>/g, "")
  .replace(/: Promise<boolean>/g, "")
  .replace(/: unknown/g, "")
  .replace(/: QueuedWrite/g, "")
  .replace(/private endpoint: string/g, "endpoint")
  .replace(/\(op: string, payload: unknown\)/g, "(op, payload)")
  .replace(/: number\b/g, "")
  .replace(/: string\b/g, "")
  .replace(/: void\b/g, "")
  .replace(/private |public /g, "")
  // The class is already declared `export class WriteQueue`, so appending a
  // second export statement is a duplicate-export syntax error.
  .replace(/export class WriteQueue/, "class WriteQueue");
const { WriteQueue } = await import(
  "data:text/javascript," + encodeURIComponent(js + "\nexport { WriteQueue };")
);

/** A queue whose transport we control. */
function makeQueue(fetchImpl) {
  store.clear();
  globalThis.fetch = fetchImpl;
  return new WriteQueue("/api/persist");
}

const ok = async () => ({ ok: true });
const offline = async () => {
  throw new Error("offline");
};

test("a drain against a dead server returns at once and keeps everything", async () => {
  let calls = 0;
  const q = makeQueue(async () => {
    calls += 1;
    throw new Error("offline");
  });
  q.push("appendMessage", { turn: 1 });
  q.push("appendMessage", { turn: 2 });
  q.push("appendMessage", { turn: 3 });

  const started = Date.now();
  const landed = await q.flush();

  assert.equal(landed, false, "flush must report that nothing landed");
  assert.equal(q.pending, 3, "nothing may be discarded");
  assert.ok(
    Date.now() - started < 1000,
    "a dead server must not be retried with sleeps inside one drain",
  );
  assert.ok(calls <= 3, `should stop at the first failure, made ${calls} calls`);
});

test("the same queue drains in order once the server recovers", async () => {
  const sent = [];
  let up = false;
  const q = makeQueue(async (url, init) => {
    if (!up) throw new Error("offline");
    sent.push(JSON.parse(init.body).payload.turn);
    return { ok: true };
  });
  q.push("appendMessage", { turn: 1 });
  q.push("appendMessage", { turn: 2 });
  q.push("appendMessage", { turn: 3 });
  assert.equal(await q.flush(), false);

  up = true;
  assert.equal(await q.flush(), true, "must drain once the server is back");
  assert.equal(q.pending, 0);
  assert.deepEqual(sent, [1, 2, 3], "order is data — it must be preserved");
});

test("flush awaits an in-flight drain instead of resolving early", async () => {
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const q = makeQueue(async () => {
    await gate;
    return { ok: true };
  });
  q.push("createParticipant", { key: "P-1" });

  const first = q.drain();
  let pendingWhenResolved = null;
  const second = q.flush().then((landed) => {
    pendingWhenResolved = q.pending;
    return landed;
  });

  // Give the second caller every chance to resolve early.
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(
    pendingWhenResolved,
    null,
    "flush resolved while the write was still in flight",
  );

  release();
  assert.equal(await second, true);
  await first;
  assert.equal(pendingWhenResolved, 0, "flush must see an empty queue");
});

test("a queue restored from a previous session still drains", async () => {
  // Simulate yesterday's tab dying with writes still queued. A retry budget
  // carried across sessions is what once made the queue permanently refuse to
  // drain; there is no such counter now, so a restored queue simply drains.
  store.clear();
  store.set(
    "amne:writequeue",
    JSON.stringify([
      { id: "old-1", op: "appendMessage", payload: { turn: 9 }, queuedAt: "x" },
    ]),
  );
  globalThis.fetch = ok;
  const q = new WriteQueue("/api/persist");

  assert.equal(await q.flush(), true, "a stale queue must still drain");
  assert.equal(q.pending, 0);
});

test("a successful queue reports landed and empties", async () => {
  const q = makeQueue(ok);
  q.push("saveMandate", { a: 1 });
  q.push("logEvent", { b: 2 });
  assert.equal(await q.flush(), true);
  assert.equal(q.pending, 0);
});

test("queued writes survive in storage until they land", async () => {
  const q = makeQueue(offline);
  q.push("saveResponses", { block: "risk_t1" });
  await q.flush();
  const persisted = JSON.parse(store.get("amne:writequeue"));
  assert.equal(persisted.length, 1, "an unsent write must be on disk");
  assert.equal(persisted[0].op, "saveResponses");
});

test("an idempotent completion write is queued only once", async () => {
  const sent = [];
  const q = makeQueue(async (_url, init) => {
    sent.push(JSON.parse(init.body).id);
    return { ok: true };
  });

  q.pushIdempotent("logEvent", { type: "study_completed" }, "complete:P-1");
  q.pushIdempotent("logEvent", { type: "study_completed" }, "complete:P-1");
  assert.equal(await q.flush(), true);
  assert.deepEqual(sent, ["complete:P-1"]);
});

test("a corrected response snapshot supersedes its rejected 400 predecessor only", async () => {
  const sent = [];
  const q = makeQueue(async (_url, init) => {
    const item = JSON.parse(init.body);
    sent.push([item.op, item.payload.responses?.BG4 ?? null]);
    if (item.payload.responses?.BG4 === "-1") {
      return { ok: false, status: 400 };
    }
    return { ok: true, status: 200 };
  });

  q.push("saveResponses", {
    participantKey: "P-1", block: "v226_background", responses: { BG4: "-1" },
  });
  q.push("logEvent", { type: "negotiation_started" });
  q.push("saveResponses", {
    participantKey: "P-1", block: "v226_background", responses: { BG4: "5" },
  });

  assert.equal(await q.flush(), true);
  assert.deepEqual(sent, [
    ["saveResponses", "-1"],
    ["logEvent", null],
    ["saveResponses", "5"],
  ], "the unrelated event must remain ordered between the two snapshots");
});

test("a legacy stored 413 backlog keeps only its latest complete same-block snapshot", async () => {
  store.clear();
  store.set("amne:writequeue", JSON.stringify([
    { id: "old-large", op: "saveResponses", payload: {
      participantKey: "P-1", block: "v226_task_open_t1", responses: { OED1_t1: "too large" },
    }, queuedAt: "x" },
    { id: "old-fixed", op: "saveResponses", payload: {
      participantKey: "P-1", block: "v226_task_open_t1", responses: { OED1_t1: "fixed" },
    }, queuedAt: "y" },
  ]));
  const sent = [];
  globalThis.fetch = async (_url, init) => {
    const item = JSON.parse(init.body);
    sent.push(item.payload.responses.OED1_t1);
    return item.id === "old-large"
      ? { ok: false, status: 413 }
      : { ok: true, status: 200 };
  };

  const q = new WriteQueue("/api/persist");
  assert.equal(await q.flush(), true);
  assert.deepEqual(sent, ["fixed"]);
});

test("a transient 503 never discards or reorders same-block snapshots", async () => {
  const sent = [];
  let up = false;
  const q = makeQueue(async (_url, init) => {
    const item = JSON.parse(init.body);
    if (!up) return { ok: false, status: 503 };
    sent.push(item.payload.responses.BG4);
    return { ok: true, status: 200 };
  });
  q.push("saveResponses", {
    participantKey: "P-1", block: "v226_background", responses: { BG4: "4" },
  });
  q.push("saveResponses", {
    participantKey: "P-1", block: "v226_background", responses: { BG4: "5" },
  });

  assert.equal(await q.flush(), false);
  assert.equal(q.pending, 2);
  up = true;
  assert.equal(await q.flush(), true);
  assert.deepEqual(sent, ["4", "5"]);
});

for (const status of [401, 409]) {
  test(`HTTP ${status} never discards a response snapshot`, async () => {
    const q = makeQueue(async () => ({ ok: false, status }));
    q.push("saveResponses", {
      participantKey: "P-1", block: "v226_background", responses: { BG4: "4" },
    });
    q.push("saveResponses", {
      participantKey: "P-1", block: "v226_background", responses: { BG4: "5" },
    });

    assert.equal(await q.flush(), false);
    assert.equal(q.pending, 2);
  });
}

test("a partial later response snapshot cannot compensate for rejected answers", async () => {
  const q = makeQueue(async () => ({ ok: false, status: 400 }));
  q.push("saveResponses", {
    participantKey: "P-1",
    block: "v226_background",
    responses: { BG3: "manager", BG4: "-1" },
  });
  q.push("saveResponses", {
    participantKey: "P-1",
    block: "v226_background",
    responses: { BG4: "5" },
  });

  assert.equal(await q.flush(), false);
  assert.equal(q.pending, 2);
});

test("a rejected protocol block is never treated as a replaceable survey snapshot", async () => {
  const q = makeQueue(async () => ({ ok: false, status: 400 }));
  q.push("saveResponses", {
    participantKey: "P-1", block: "task_run_t1", responses: { state: "old" },
  });
  q.push("saveResponses", {
    participantKey: "P-1", block: "task_run_t1", responses: { state: "new" },
  });

  assert.equal(await q.flush(), false);
  assert.equal(q.pending, 2);
});

test("a 400 is retained without a later snapshot for the same participant and block", async () => {
  const q = makeQueue(async () => ({ ok: false, status: 400 }));
  q.push("saveResponses", {
    participantKey: "P-1", block: "v226_background", responses: { BG4: "-1" },
  });
  q.push("saveResponses", {
    participantKey: "P-1", block: "v226_task_open_t1", responses: { OED1_t1: "later" },
  });
  q.push("saveResponses", {
    participantKey: "P-2", block: "v226_background", responses: { BG4: "5" },
  });

  assert.equal(await q.flush(), false);
  assert.equal(q.pending, 3, "another block or participant cannot compensate for the rejection");
});
