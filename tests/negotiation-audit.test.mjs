import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { beginNegotiationAudit } from "../src/lib/server/negotiation-audit.ts";
import { assignmentOf, sessionCookie } from "../src/lib/server/study-db.ts";

let row, calls, oldFetch, env;
const names = ["NEXT_PUBLIC_DEV_TOOLS", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "STUDY_SESSION_SECRET"];
beforeEach(() => {
  oldFetch = globalThis.fetch; env = Object.fromEntries(names.map(n => [n, process.env[n]]));
  process.env.NEXT_PUBLIC_DEV_TOOLS = "off";
  process.env.SUPABASE_URL = "https://fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
  process.env.STUDY_SESSION_SECRET = "fixture-only-session";
  delete process.env.SUPABASE_SECRET_KEY;
  row = { participant_key: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", participant_id: 1,
    proxy_policy: "user_specified", role: "leader", task_order: "taskA_first", mode_order: "proxyFirst",
    assigned_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7200000).toISOString(),
    status: "active", operational: { consented: true } };
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
    return Response.json(String(url).includes("rpc/") ? null : [row]);
  };
});
afterEach(() => { globalThis.fetch = oldFetch; for (const n of names) {
  if (env[n] === undefined) delete process.env[n]; else process.env[n] = env[n];
} });
function request(cookie = true) {
  const url = "https://study.example/api/counterpart";
  return new Request(url, { headers: { Origin: "https://study.example", ...(cookie
    ? { Cookie: sessionCookie(row.participant_key, new Request(url)).split(";")[0] } : {}) } });
}

test("all 16 assignments bind audit requests to actual task/role/policy/mode", async () => {
  let cells = 0;
  for (const proxy_policy of ["user_specified", "ai_supplemented"])
    for (const role of ["leader", "member"])
      for (const task_order of ["taskA_first", "taskB_first"])
        for (const mode_order of ["proxyFirst", "directFirst"]) {
          Object.assign(row, { proxy_policy, role, task_order, mode_order });
          for (const session of assignmentOf(row).sessions) {
            const identity = { sessionIndex: session.index, messageId: "p0", taskId: session.taskId,
              role, afterProxy: session.condition !== "direct" };
            const audit = await beginNegotiationAudit(request(), identity, "counterpart");
            await audit({ decision: "fixture", message: "visible" });
            assert.equal(calls.at(-1).body.p_task_index, session.index);
            await assert.rejects(beginNegotiationAudit(request(), { ...identity, taskId: session.taskId === "task_a" ? "task_b" : "task_a" }, "counterpart"), /assignment_mismatch/);
            await assert.rejects(beginNegotiationAudit(request(), { ...identity, afterProxy: !identity.afterProxy }, "counterpart"), /assignment_mismatch/);
            await assert.rejects(beginNegotiationAudit(request(), { ...identity, role: role === "leader" ? "member" : "leader" }, "classifier"), /assignment_mismatch/);
            if (session.condition !== "direct") {
              await assert.rejects(beginNegotiationAudit(request(), { ...identity, policy: proxy_policy === "user_specified" ? "ai_supplemented" : "user_specified" }, "proxy"), /assignment_mismatch/);
            }
          }
          cells++;
        }
  assert.equal(cells, 16);
});

test("stable correlation keeps retry attempts distinct and audit failure is surfaced", async () => {
  const identity = { sessionIndex: 1, messageId: "d-p0", taskId: "task_a", role: "leader" };
  for (let i = 0; i < 2; i++) await (await beginNegotiationAudit(request(), identity, "classifier"))({ result: { label: "SB" } });
  const writes = calls.filter(c => c.body);
  assert.equal(writes[0].body.p_audit_key, writes[1].body.p_audit_key);
  assert.notEqual(writes[0].body.p_details.attemptId, writes[1].body.p_details.attemptId);
  const audit = await beginNegotiationAudit(request(), identity, "classifier");
  globalThis.fetch = async () => new Response(null, { status: 503 });
  await assert.rejects(audit({ result: {} }), /storage_unavailable/);
});

test("unconsented and unauthenticated traffic cannot produce research audit; preview stays local", async () => {
  const identity = { sessionIndex: 1, messageId: "p0", taskId: "task_a", role: "leader" };
  await assert.rejects(beginNegotiationAudit(request(false), identity, "classifier"), /session_required/);
  row.operational.consented = false;
  await assert.rejects(beginNegotiationAudit(request(), identity, "classifier"), /consent_required/);
  process.env.NEXT_PUBLIC_DEV_TOOLS = "on"; calls = [];
  await (await beginNegotiationAudit(request(false), identity, "classifier"))({ result: {} });
  assert.equal(calls.length, 0);
});
