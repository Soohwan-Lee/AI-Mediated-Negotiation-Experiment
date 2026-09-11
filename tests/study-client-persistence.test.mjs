import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { WriteQueue, SupabaseStore } from "../src/lib/store-supabase.ts";
import { requestAdmission } from "../src/lib/admission.ts";

let storage, listeners, originalFetch, originalWindow;
beforeEach(() => {
  originalFetch = globalThis.fetch; originalWindow = globalThis.window;
  storage = new Map(); listeners = [];
  globalThis.window = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    addEventListener: (event, callback) => listeners.push({ event, callback }),
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
});

test("production admission transmits all three URL identifiers and no client assignment", async () => {
  const identity = { prolificPid: "a".repeat(24), studyId: "b".repeat(24), sessionId: "c".repeat(24) };
  let observed;
  globalThis.fetch = async (url, init) => { observed = { url, init }; return Response.json({ status: "active", assignment: { participantKey: "server-key" } }); };
  const result = await requestAdmission(identity);
  assert.equal(result.assignment.participantKey, "server-key");
  assert.equal(observed.init.method, "POST");
  assert.deepEqual(JSON.parse(observed.init.body), identity);
  assert.equal(observed.init.credentials, "same-origin");
});

test("internal refresh uses the cookie, partial Prolific identity never claims", async () => {
  let calls = 0, method;
  globalThis.fetch = async (_url, init) => { calls++; method = init.method; return Response.json({ status: "active", assignment: { participantKey: "server-key" } }); };
  await requestAdmission({ prolificPid: null, studyId: null, sessionId: null });
  assert.equal(method, "GET");
  await assert.rejects(requestAdmission({ prolificPid: "a".repeat(24), studyId: null, sessionId: null }), /full study link/);
  assert.equal(calls, 1);
});

test("old attempt writes remain parked and cannot block a new attempt queue", async () => {
  globalThis.fetch = async () => new Response(null, { status: 503 });
  const old = new WriteQueue("/api/persist", "amne:writequeue:old");
  old.push("saveResponses", { participantKey: "old", value: 1 });
  assert.equal(await old.flush(), false);
  const oldBytes = storage.get("amne:writequeue:old");
  const sent = [];
  globalThis.fetch = async (_url, init) => { sent.push(JSON.parse(init.body)); return Response.json({ data: null }); };
  const next = new WriteQueue("/api/persist", "amne:writequeue:new");
  next.push("saveResponses", { participantKey: "new", value: 2 });
  assert.equal(await next.flush(), true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].payload.participantKey, "new");
  assert.equal(storage.get("amne:writequeue:old"), oldBytes);
  assert.ok(!listeners.some(listener => listener.event === "visibilitychange"), "no parallel beacon can replay stale drafts");
});

test("remote reads await pending writes and preserve their ordering", async () => {
  const calls = [];
  let release;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body); calls.push(body.op);
    if (body.op === "appendMessage") await new Promise(resolve => { release = resolve; });
    return Response.json({ data: body.op === "loadMessages" ? [{ id: "m1" }] : null });
  };
  const store = new SupabaseStore("attempt-a");
  await store.appendMessage("attempt-a", { id: "m1" });
  const pending = store.loadMessages("attempt-a", 1);
  assert.deepEqual(calls, ["appendMessage"]);
  release();
  assert.deepEqual(await pending, [{ id: "m1" }]);
  assert.deepEqual(calls, ["appendMessage", "loadMessages"]);
});

test("failed remote reads do not masquerade as empty saved responses", async () => {
  globalThis.fetch = async () => new Response(null, { status: 503 });
  const store = new SupabaseStore("attempt-b");
  await assert.rejects(store.loadResponses("attempt-b", "v226_background"), /could not be loaded/);
});

test("practice, comprehension, click and completion events never enter the remote queue", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ data: null }); };
  const store = new SupabaseStore("attempt-c");
  await store.saveResponses("attempt-c", "instruction_check", { IC1: "leader" });
  await store.saveResponses("attempt-c", "practice_1", { IC5: "you" });
  await store.logEvent({ type: "page_enter", participantKey: "attempt-c" });
  await store.logEvent({ type: "study_completed", participantKey: "attempt-c" });
  await store.logGuardrailEvent("attempt-c", {});
  assert.equal(await store.confirmSaved(), true);
  assert.equal(calls, 0);
});

test("one thousand cumulative keystroke snapshots send only the active and latest drafts", async () => {
  const sent = [];
  let releaseFirst;
  const firstGate = new Promise(resolve => { releaseFirst = resolve; });
  globalThis.fetch = async (_url, init) => {
    const item = JSON.parse(init.body);
    sent.push(item);
    if (sent.length === 1) await firstGate;
    return Response.json({ data: null });
  };

  const queue = new WriteQueue("/api/persist", "queue:typing");
  for (let index = 0; index < 1_000; index += 1) {
    queue.push("saveResponses", {
      participantKey: "P-typing",
      block: "v226_task_open_t1",
      responses: {
        OED1_t1: "x".repeat(index + 1),
        SHARE_DETAIL_t1: index < 999,
        _instrument_version: "2.27-open-v3",
        _submitted_parts: index === 999 ? 1 : 0,
        _completed: index === 999,
      },
    });
  }

  const parked = JSON.parse(storage.get("queue:typing"));
  assert.equal(parked.length, 2, "the in-flight draft and newest unsent draft must remain");
  assert.equal(parked[1].payload.responses.OED1_t1.length, 1_000);
  assert.equal(parked[1].payload.responses._completed, true);

  releaseFirst();
  assert.equal(await queue.flush(), true);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].payload.responses.OED1_t1.length, 1_000);
  assert.equal(sent[1].payload.responses.SHARE_DETAIL_t1, false, "false is a valid latest answer");
  assert.equal(sent[1].payload.responses._submitted_parts, 1);
  assert.equal(sent[1].payload.responses._completed, true);
});

test("a stored cumulative backlog is compacted before its first retry and read", async () => {
  storage.set("amne:writequeue:P-restored", JSON.stringify(Array.from({ length: 1_000 }, (_, index) => ({
    id: `old-${index}`,
    op: "saveResponses",
    payload: {
      participantKey: "P-restored",
      block: "v226_task_open_t2",
      responses: {
        OED1_t2: "y".repeat(index + 1),
        _instrument_version: "2.27",
        _submitted_parts: index === 999 ? 1 : 0,
        _completed: index === 999,
      },
    },
    queuedAt: "old",
  }))));
  const sent = [];
  globalThis.fetch = async (_url, init) => {
    const item = JSON.parse(init.body);
    sent.push(item);
    return Response.json({ data: item.op === "loadResponses" ? { OED1_t2: "saved" } : null });
  };

  const store = new SupabaseStore("P-restored");
  const compacted = JSON.parse(storage.get("amne:writequeue:P-restored"));
  assert.equal(compacted.length, 1);
  assert.equal(compacted[0].id, "old-999");
  assert.deepEqual(await store.loadResponses("P-restored", "v226_task_open_t2"), { OED1_t2: "saved" });
  assert.deepEqual(sent.map(item => item.op), ["saveResponses", "loadResponses"]);
  assert.equal(sent[0].payload.responses.OED1_t2.length, 1_000);
  assert.equal(sent[0].payload.responses._completed, true);
});

test("survey compaction stops at participant, block, version, operation, and partial-snapshot barriers", async () => {
  const writes = [
    { id: "base", op: "saveResponses", payload: { participantKey: "P-1", block: "v226_background", responses: { BG1: "a", BG2: "b", _instrument_version: "2.26" } }, queuedAt: "x" },
    { id: "partial", op: "saveResponses", payload: { participantKey: "P-1", block: "v226_background", responses: { BG2: "c", _instrument_version: "2.26" } }, queuedAt: "x" },
    { id: "other-participant", op: "saveResponses", payload: { participantKey: "P-2", block: "v226_background", responses: { BG2: "d", _instrument_version: "2.26" } }, queuedAt: "x" },
    { id: "other-block", op: "saveResponses", payload: { participantKey: "P-2", block: "v226_wrap_up", responses: { BG2: "e", _instrument_version: "2.26" } }, queuedAt: "x" },
    { id: "other-version", op: "saveResponses", payload: { participantKey: "P-2", block: "v226_wrap_up", responses: { BG2: "f", _instrument_version: "2.27" } }, queuedAt: "x" },
    { id: "event", op: "logEvent", payload: { type: "negotiation_started" }, queuedAt: "x" },
    { id: "after-event", op: "saveResponses", payload: { participantKey: "P-2", block: "v226_wrap_up", responses: { BG2: "g", _instrument_version: "2.27" } }, queuedAt: "x" },
  ];
  storage.set("queue:barriers", JSON.stringify(writes));
  globalThis.fetch = async () => new Response(null, { status: 503 });

  const queue = new WriteQueue("/api/persist", "queue:barriers");
  assert.equal(await queue.flush(), false);
  assert.deepEqual(JSON.parse(storage.get("queue:barriers")).map(item => item.id), writes.map(item => item.id));
});

test("compaction never regresses a submitted snapshot", async () => {
  storage.set("queue:submitted", JSON.stringify([
    { id: "submitted", op: "saveResponses", payload: { participantKey: "P-1", block: "v226_task_decision_t1", responses: { BR1_t1: 600, _instrument_version: "2.26", _submitted: true } }, queuedAt: "x" },
    { id: "draft", op: "saveResponses", payload: { participantKey: "P-1", block: "v226_task_decision_t1", responses: { BR1_t1: 700, _instrument_version: "2.26", _submitted: false } }, queuedAt: "x" },
  ]));
  globalThis.fetch = async () => new Response(null, { status: 503 });

  const queue = new WriteQueue("/api/persist", "queue:submitted");
  assert.equal(await queue.flush(), false);
  assert.deepEqual(JSON.parse(storage.get("queue:submitted")).map(item => item.id), ["submitted", "draft"]);
});

test("a failed active write retains the latest compacted payload for retry", async () => {
  let available = false;
  const sent = [];
  globalThis.fetch = async (_url, init) => {
    const item = JSON.parse(init.body);
    if (!available) return new Response(null, { status: 503 });
    sent.push(item.payload.responses.OED1_t1);
    return Response.json({ data: null });
  };
  const queue = new WriteQueue("/api/persist", "queue:retry");
  for (let index = 1; index <= 100; index += 1) {
    queue.push("saveResponses", {
      participantKey: "P-retry",
      block: "v226_task_open_t1",
      responses: { OED1_t1: "z".repeat(index), _instrument_version: "2.27" },
    });
  }
  assert.equal(await queue.flush(), false);
  const parked = JSON.parse(storage.get("queue:retry"));
  assert.equal(parked.at(-1).payload.responses.OED1_t1.length, 100);

  available = true;
  assert.equal(await queue.flush(), true);
  assert.equal(sent.at(-1).length, 100);
});
