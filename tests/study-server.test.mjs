import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import * as db from "../src/lib/server/study-db.ts";
import * as records from "../src/lib/server/study-records.ts";
import { getTask, reasonCards } from "../src/lib/tasks.ts";
import { tierPackage } from "../src/lib/negotiation/machine.ts";
import { STUDY, completionSettings } from "../src/lib/study-config.ts";

const key = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const otherKey = "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const pid = "a".repeat(24), studyId = "b".repeat(24), sessionId = "c".repeat(24);
let tables, calls, row, originalFetch, originalEnv;
const envKeys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "STUDY_SESSION_SECRET", "NEXT_PUBLIC_DEV_TOOLS"];

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalEnv = Object.fromEntries(envKeys.map(name => [name, process.env[name]]));
  process.env.SUPABASE_URL = "https://fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-service-role";
  delete process.env.SUPABASE_SECRET_KEY;
  process.env.STUDY_SESSION_SECRET = "test-only-session-secret";
  process.env.NEXT_PUBLIC_DEV_TOOLS = "off";
  row = {
    participant_key: key, participant_id: 1, prolific_pid: pid, study_id: studyId, session_id: sessionId,
    proxy_policy: "ai_supplemented", task_order: "taskA_first", mode_order: "proxyFirst", role: "leader",
    assigned_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7_200_000).toISOString(), status: "active",
    background_answers: {}, open_answers: {}, operational: { consented: true },
  };
  tables = { study_participants: [row], assignment_slots: [{ participant_id: 1 }], self_reports: [], task_metrics: [], chat_messages: [] };
  calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input)), path = url.pathname.split("/rest/v1/")[1];
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, url, init, body });
    if (path === "rpc/claim_study_assignment") return Response.json(row);
    if (path === "rpc/complete_study_participation") return Response.json({ status: "completed" });
    const rows = tables[path];
    assert.ok(rows, `Unexpected table: ${path}`);
    const matches = candidate => [...url.searchParams].every(([name, value]) => !value.startsWith("eq.") || String(candidate[name]) === value.slice(3));
    if (!init.method || init.method === "GET") return Response.json(rows.filter(matches));
    if (init.method === "PATCH") {
      for (const target of rows.filter(matches)) Object.assign(target, body);
      return Response.json(rows.filter(matches));
    }
    const columns = url.searchParams.get("on_conflict")?.split(",") ?? ["participant_key"];
    let existing = rows.find(candidate => columns.every(column => candidate[column] === body[column]));
    if (!existing) { existing = {}; rows.push(existing); }
    Object.assign(existing, body);
    return Response.json([existing]);
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of envKeys) {
    if (originalEnv[name] === undefined) delete process.env[name]; else process.env[name] = originalEnv[name];
  }
});

async function route(name) {
  const source = await readFile(new URL(`../src/app/api/${name}/route.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  const dependencies = { "@/lib/server/study-db": db, "@/lib/server/study-records": records, "@/lib/study-config": { STUDY, completionSettings } };
  new Function("require", "module", "exports", compiled)(name => {
    assert.ok(dependencies[name], name); return dependencies[name];
  }, loaded, loaded.exports);
  return loaded.exports;
}
function request(path, body, cookie = true) {
  const url = `https://study.example/api/${path}`;
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://study.example",
    ...(cookie ? { Cookie: db.sessionCookie(key, new Request(url)).split(";")[0] } : {}) }, body: JSON.stringify(body) });
}
async function save(op, payload) { return records.persistOperation(row, op, payload); }

test("actual SQL factor values resolve every task/mode sequence correctly", () => {
  for (const [task_order, mode_order, expected] of [
    ["taskA_first", "directFirst", "seq1"], ["taskA_first", "proxyFirst", "seq2"],
    ["taskB_first", "directFirst", "seq3"], ["taskB_first", "proxyFirst", "seq4"],
  ]) assert.equal(db.assignmentOf({ ...row, task_order, mode_order }).sequenceId, expected);
});

test("admission ignores browser assignment and signs the server-owned identity", async () => {
  const { POST } = await route("assign");
  const response = await POST(request("assign", { prolificPid: pid, studyId, sessionId, participantKey: otherKey, role: "member" }, false));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.assignment.participantKey, key);
  assert.equal(body.assignment.role, "leader");
  assert.equal(body.consented, true);
  assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
  assert.match(response.headers.get("set-cookie"), /Secure/);
  const claim = calls.find(call => call.path.startsWith("rpc/claim"));
  assert.notEqual(claim.body.p_participant_key, otherKey);
  assert.equal(claim.body.p_session_id, sessionId);
});

test("missing identity and preview mode cannot claim production slots", async () => {
  const { POST } = await route("assign");
  assert.equal((await POST(request("assign", { prolificPid: pid }, false))).status, 400);
  process.env.NEXT_PUBLIC_DEV_TOOLS = "on";
  assert.equal((await POST(request("assign", { prolificPid: pid, studyId, sessionId }, false))).status, 403);
  assert.equal(calls.length, 0);
});

test("signed sessions reject forged cookies, wrong identity and expired attempts", async () => {
  const { POST } = await route("persist");
  const forged = new Request("https://study.example/api/persist", { method: "POST", headers: { Cookie: `amne_study=${key}.${Date.now() + 10000}.forged` }, body: JSON.stringify({ op: "loadAssignment" }) });
  assert.equal((await POST(forged)).status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await POST(request("persist", { op: "loadAssignment", payload: { participantKey: otherKey } }))).status, 409);
  row.expires_at = new Date(Date.now() - 1000).toISOString();
  assert.equal((await POST(request("persist", { op: "saveResponses", payload: { block: "v226_background", responses: { BG6: 5 } } }))).status, 409);
});

test("cross-origin writes and beacon batches are rejected", async () => {
  const { POST } = await route("persist");
  const cross = request("persist", { op: "loadAssignment" });
  cross.headers.set("Origin", "https://other.example");
  assert.equal((await POST(cross)).status, 403);
  assert.equal((await POST(request("persist", { batch: [] }))).status, 400);
  assert.equal(calls.length, 0);
});

test("new Supabase secret keys use apikey only; legacy keys retain Bearer", async () => {
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test_fixture";
  await db.database("assignment_slots");
  assert.equal(calls.at(-1).init.headers.Authorization, undefined);
  assert.equal(calls.at(-1).init.headers.apikey, "sb_secret_test_fixture");
  delete process.env.SUPABASE_SECRET_KEY;
  await db.database("assignment_slots");
  assert.equal(calls.at(-1).init.headers.Authorization, "Bearer test-only-service-role");
});

test("analysis writes require saved consent, while comprehension is not stored", async () => {
  row.operational = {};
  await assert.rejects(save("saveResponses", { block: "v226_background", responses: { FTS1: 5 } }), /consent_required/);
  await save("createParticipant", {});
  assert.equal(row.operational.consented, true);
  const before = calls.length;
  await save("saveResponses", { block: "instruction_check", responses: { IC1: "leader" } });
  await save("logEvent", { type: "comprehension_answer", payload: { IC1: "leader" } });
  assert.equal(calls.length, before);
});

test("real suffixed scales, responsibility order, zero bonus, and open answers map to coded columns", async () => {
  await save("saveResponses", { block: "v226_post_task_scales_t1", responses: {
    SCF1_t1: 6, PMP3_t1: 4, POP4_t1: 3, _submitted: true,
    _pmp_responsibility_order: "human_first", _pop_responsibility_order: "ai_first",
  } });
  let report = tables.self_reports[0];
  assert.equal(report.scf1, 6); assert.equal(report.pmp3, 4); assert.equal(report.pop4, 3);
  assert.equal(report.pmp_responsibility_order, "human_first");
  assert.equal(report.pop_responsibility_order, "ai_first");
  assert.equal(report.scales_submitted, true);
  await save("saveResponses", { block: "v226_task_decision_t1", responses: { BR1_PERCENT_t1: 0, BR1_t1: 999, BR1_CONFIRMED_t1: true, _submitted: true } });
  report = tables.self_reports[0];
  assert.equal(report.br1, 0); assert.equal(report.br1_percent, 0); assert.equal(report.br1_confirmed, true);
  assert.equal(report.scf1, 6);
  const open = { OED1_t1: "I chose to share.", OEE1_t1: "Responsive.", OEP1_t1: "Useful.", OET1_t1: "", _completed: true };
  await save("saveResponses", { block: "v226_task_open_t1", responses: open });
  report = tables.self_reports[0];
  assert.equal(report.oed1, "I chose to share."); assert.equal(report.oep1, "Useful.");
  assert.equal(report.oet1, null); assert.equal(report.open_submitted, true);
  assert.equal(report.participant_key, key); assert.equal(report.task_index, 1);
  assert.equal(row.oed1_t1, undefined); assert.equal(row.operational.open_t1_submitted, undefined);
  assert.deepEqual(await save("loadResponses", { block: "v226_task_open_t1" }), open);
  const restored = await save("loadResponses", { block: "v226_post_task_scales_t1" });
  assert.equal(restored.SCF1_t1, 6);
});

test("optional background blanks remain valid and malformed scales never write", async () => {
  await save("saveResponses", { block: "v226_background", responses: { BG1: "", BG4: "", FTS1: 3, _submitted_parts: 3 } });
  assert.equal(row.bg1, null); assert.equal(row.bg4, null); assert.equal(row.fts1, 3);
  assert.equal(row.bg8, undefined); assert.equal(row.bg9, undefined);
  assert.equal(row.operational.background_submitted, true);
  const before = calls.length;
  await assert.rejects(save("saveResponses", { block: "v226_background", responses: { FTS1: 99 } }), /invalid_scale/);
  assert.equal(calls.length, before);
});

test("optional race and country responses validate and persist in coded and raw forms", async () => {
  await save("saveResponses", { block: "v226_background", responses: {
    BG8: "asian", BG9: "South Korea", _submitted_parts: 1,
  } });
  assert.equal(row.bg8, "asian"); assert.equal(row.bg9, "South Korea");
  assert.equal(row.background_answers.BG8, "asian");
  assert.equal(row.background_answers.BG9, "South Korea");

  await save("saveResponses", { block: "v226_background", responses: { BG8: "", BG9: "" } });
  assert.equal(row.bg8, null); assert.equal(row.bg9, null);
  assert.equal(row.background_answers.BG8, "");
  assert.equal(row.background_answers.BG9, "");

  for (const race of [
    "asian", "black", "white", "middle_eastern_north_african", "indigenous",
    "mixed_multiple", "another_background", "no_answer",
  ]) {
    await save("saveResponses", { block: "v226_background", responses: { BG8: race } });
    assert.equal(row.bg8, race);
  }
  await assert.rejects(
    save("saveResponses", { block: "v226_background", responses: { BG8: "unsupported" } }),
    /invalid_choice/,
  );
  await assert.rejects(
    save("saveResponses", { block: "v226_background", responses: { BG9: 42 } }),
    /invalid_record/,
  );
});

test("real later-turn SB and approved-as-is ratification are retained", async () => {
  await save("saveResponses", { block: "ratify_t1", responses: { RATIFY_t1: "approved_as_is" } });
  await save("saveResponses", { block: "negotiation_t1", responses: { SB_t1: false, "SB-TIMING_t1": "later_turn", tier: "sensitive" } });
  assert.equal(tables.task_metrics[0].ratify, "approved_as_is");
  assert.equal(tables.task_metrics[0].sb_timing, "later_turn");
});

test("agreement determines points and requirement preservation, including no agreement", async () => {
  const task = getTask("task_a"), pkg = tierPackage(task, "leader", "sensitive");
  const agreement = { sessionIndex: 1, terms: task.issues.map(issue => ({ issueId: issue.id, optionId: pkg[issue.id] })), unresolvedIssueIds: [] };
  await save("saveAgreement", { agreement });
  assert.equal(tables.task_metrics[0].points, 3000);
  assert.equal(tables.task_metrics[0].joint, 6000);
  assert.equal(tables.task_metrics[0].own_requirement_preserved, true);
  assert.equal(tables.task_metrics[0].their_requirement_preserved, true);
  agreement.terms.forEach(term => { term.optionId = null; });
  await save("saveAgreement", { agreement });
  assert.equal(tables.task_metrics[0].points, 0);
  assert.equal(tables.task_metrics[0].outcome.agreed, false);
  assert.ok(tables.task_metrics[0].agreement);
});

test("proxy messages keep real disclosure metadata and one full message per turn", async () => {
  const task = getTask("task_a"), pkg = tierPackage(task, "leader", "work");
  await save("saveMandate", { mandate: { sessionIndex: 1, issues: task.issues.map(issue => ({ issueId: issue.id, preferredOptionId: pkg[issue.id] })), authorizedReasonIds: reasonCards(task, "leader").map(card => card.id), revisionCount: 0 } });
  const message = { id: "m2", sessionIndex: 1, speaker: "counterpart_proxy", text: "First sentence. || Second sentence.", stage: 4, createdAt: new Date().toISOString(), reasonLabel: "SB", decidedAction: "disclose_sb" };
  await save("appendMessage", { message });
  await save("appendMessage", { message });
  assert.equal(tables.chat_messages.length, 1);
  assert.equal(tables.chat_messages[0].turn_id, "m2");
  assert.equal(tables.chat_messages[0].decided_action, "disclose_sb");
  assert.equal(tables.chat_messages[0].reason_label, "SB");
  await save("appendMessage", { message: { ...message, id: "m1", speaker: "participant_proxy", reasonLabel: undefined, decidedAction: undefined } });
  assert.equal(tables.chat_messages[1].reason_label, undefined, "authorization alone does not prove a blocked disclosure");
});

test("phase events retain human and proxy negotiation duration separately", async () => {
  const start = Date.now() - 120_000;
  for (const [type, delta, payload] of [
    ["negotiation_started", 0, { policy: "ai_supplemented" }], ["negotiation_ended", 30_000, { phase: "proxy" }],
    ["negotiation_started", 50_000, { phase: "direct" }], ["negotiation_ended", 100_000, { phase: "direct" }],
  ]) await save("logEvent", { type, sessionIndex: 1, clientTimestamp: new Date(start + delta).toISOString(), payload });
  assert.equal(tables.task_metrics[0].proxy_duration_ms, 30_000);
  assert.equal(tables.task_metrics[0].human_duration_ms, 50_000);
  assert.equal(tables.task_metrics[0].duration_ms, 80_000);
});

test("completion invokes database finalization and ignores caller debrief flags", async () => {
  const { POST } = await route("complete");
  await save("saveResponses", { block: "debriefing", responses: { acknowledged: true, comments: "" } });
  const response = await POST(request("complete", { participantKey: otherKey, debriefConfirmed: true }));
  assert.equal(response.status, 200);
  const call = calls.find(call => call.path === "rpc/complete_study_participation");
  assert.deepEqual(call.body, { p_participant_key: key });
  assert.equal(row.operational.debriefing_acknowledged, true);
});

test("withdrawal saves the final message before closing the attempt", async () => {
  const { POST } = await route("persist");
  const message = { id: "withdrawal", sessionIndex: 2, speaker: "participant", text: "I want to stop.", createdAt: new Date().toISOString() };
  assert.equal((await POST(request("persist", { op: "appendMessage", payload: { participantKey: key, message } }))).status, 200);
  assert.equal((await POST(request("persist", { op: "logEvent", payload: { participantKey: key, type: "negotiation_ended", sessionIndex: 2, payload: { phase: "withdrawal" }, clientTimestamp: new Date().toISOString() } }))).status, 200);
  assert.equal(row.status, "stopped");
  assert.equal(row.operational.stop_reason, "withdrawal");
  assert.equal(tables.chat_messages[0].text, "I want to stop.");
  assert.equal((await POST(request("persist", { op: "appendMessage", payload: { participantKey: key, message: { ...message, id: "late" } } }))).status, 409);
  for (const name of ["baseline-task", "shared"]) {
    const source = await readFile(new URL(`../src/app/task/[index]/${name}.tsx`, import.meta.url), "utf8");
    const end = source.indexOf('router.push("/study-stop?reason=withdrawal")');
    const branch = source.slice(0, end);
    assert.ok(branch.lastIndexOf("appendMessage") < branch.lastIndexOf('logEvent("negotiation_ended", { phase: "withdrawal" }'));
  }
});
