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
