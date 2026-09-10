import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { persistOperation } from "../src/lib/server/study-records.ts";
import { assignmentOf } from "../src/lib/server/study-db.ts";
import { BACKGROUND_BLOCKS, END_CHECK_BLOCKS, OEC1_BLOCK, experienceBlocks, proxyExperienceBlocks, taskOpenBlocks, dummyAnswer } from "../src/lib/measures.ts";
import { getTask } from "../src/lib/tasks.ts";
import { bonusAmountFromPercent } from "../src/lib/bonus.ts";

const TABLES = new Set(["assignment_slots", "study_participants", "self_reports", "task_metrics", "chat_messages"]);
const identifier = (name) => {
  assert.match(name, /^[a-z_][a-z0-9_]*$/);
  return `"${name}"`;
};
const json = (value) => JSON.parse(JSON.stringify(value));

/** Test-only PostgREST subset. Requests execute real SQL, constraints and triggers. */
function databaseFetch(db) {
  return async (input, init = {}) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "isolated-study.invalid");
    const table = url.pathname.split("/").at(-1);
    assert.ok(TABLES.has(table), `Unsupported test table ${table}`);
    const method = init.method ?? "GET";
    const entries = [...url.searchParams].filter(([key]) => !["select", "limit", "order", "on_conflict"].includes(key));
    const values = [];
    const where = entries.map(([key, value]) => {
      assert.ok(value.startsWith("eq."));
      values.push(value.slice(3));
      return `${identifier(key)} = $${values.length}`;
    });
    const filter = where.length ? ` where ${where.join(" and ")}` : "";
    let result;
    try {
      if (method === "GET") {
        const order = url.searchParams.get("order");
        const sorting = order ? " order by " + order.split(",").map((field) => {
          const [name, direction] = field.split(".");
          assert.ok(["asc", "desc"].includes(direction));
          return `${identifier(name)} ${direction}`;
        }).join(",") : "";
        result = await db.query(`select * from public.${identifier(table)}${filter}${sorting}`, values);
      } else {
        const body = JSON.parse(init.body);
        const keys = Object.keys(body);
        const encoded = keys.map((key) => body[key] !== null && typeof body[key] === "object" ? JSON.stringify(body[key]) : body[key]);
        if (method === "PATCH") {
          const assignments = keys.map((key, index) => `${identifier(key)} = $${values.length + index + 1}`);
          result = await db.query(`update public.${identifier(table)} set ${assignments.join(",")}${filter} returning *`, [...values, ...encoded]);
        } else {
          assert.equal(method, "POST");
          const conflict = url.searchParams.get("on_conflict");
          const conflictKeys = conflict?.split(",") ?? [];
          const updates = keys.filter((key) => !conflictKeys.includes(key)).map((key) => `${identifier(key)}=excluded.${identifier(key)}`);
          const onConflict = conflict ? ` on conflict (${conflictKeys.map(identifier).join(",")}) do update set ${updates.join(",")}` : "";
          result = await db.query(`insert into public.${identifier(table)} (${keys.map(identifier).join(",")}) values (${keys.map((_, index) => `$${index + 1}`).join(",")})${onConflict} returning *`, encoded);
        }
      }
      return Response.json(result.rows);
    } catch (error) {
      // Preserve the underlying database error in the test failure. This adapter
      // is never shipped or used by the app's actual error responses.
      throw new Error(`${method} ${table}: ${error.message}`, { cause: error });
    }
  };
}

test("all 16 assignments persist real frontend-shaped records and complete in SQL", {
  skip: !process.env.PGLITE_MODULE_PATH,
}, async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE_PATH);
  const db = new PGlite();
  const originalFetch = globalThis.fetch;
  const environment = Object.fromEntries(["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"].map((key) => [key, process.env[key]]));
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    const directory = new URL("../supabase/migrations/", import.meta.url);
    for (const file of readdirSync(directory).filter((file) => file.endsWith(".sql")).sort()) {
      await db.exec(readFileSync(new URL(file, directory), "utf8"));
    }
    await db.exec("set role service_role");
    process.env.SUPABASE_URL = "https://isolated-study.invalid";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_isolated_test_only";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    globalThis.fetch = databaseFetch(db);
    const combinations = new Set();
    for (let condition = 0; condition < 16; condition++) {
      const key = randomUUID();
      await db.query("select public.claim_study_assignment($1,'integration-study','integration-session',$2)", [`person-${condition}`, key]);
      const current = async () => json((await db.query("select * from public.study_participants where participant_key=$1", [key])).rows[0]);
      const row = await current();
      assert.equal(row.participant_id, condition + 1, "claim is ascending first-free");
      combinations.add([row.proxy_policy, row.role, row.task_order, row.mode_order].join("/"));
      const assignment = assignmentOf(row);
      assert.equal(assignment.sessions[0].taskId, row.task_order === "taskA_first" ? "task_a" : "task_b");
      assert.equal(assignment.sessions[0].condition === "direct", row.mode_order === "directFirst");
      const send = async (op, payload) => persistOperation(await current(), op, payload);
      const responses = (block, values) => send("saveResponses", { participantKey: key, block, responses: values });
      const event = (type, index, phase, at) => send("logEvent", { type, participantKey: key, sessionIndex: index, payload: { phase }, clientTimestamp: new Date(at).toISOString() });
      await send("createParticipant", { participantKey: key });
      await responses("v226_background", {
        ...Object.fromEntries(BACKGROUND_BLOCKS.flatMap((block) => block.items).map((item) => [item.id, dummyAnswer(item)])),
        _instrument_version: "2.26", _submitted_parts: BACKGROUND_BLOCKS.length,
      });
      // No comprehension/practice analysis rows or data should be created.
      await responses("instruction_check", { IC1: "leader" });
      await responses("practice_1", { IC5: "you" });
      for (const plan of assignment.sessions) {
        const index = plan.index;
        const isProxy = plan.condition !== "direct";
        const task = getTask(plan.taskId);
        const preferred = Object.fromEntries(task.issues.map((issue) => [issue.id, [...issue.options].sort((a, b) => b.points[row.role] - a.points[row.role])[0].id]));
        await responses(`preferences_t${index}`, { taskId: plan.taskId, role: row.role, preferred, [`WISH-DEV_t${index}`]: false });
        const start = Date.now() - 120_000;
        if (isProxy) {
          await send("saveMandate", { participantKey: key, mandate: { sessionIndex: index,
            issues: Object.entries(preferred).map(([issueId, preferredOptionId]) => ({ issueId, preferredOptionId })),
            authorizedReasonIds: task.roleBriefs[row.role].reasonCards.map((card) => card.id), revisionCount: 0,
          } });
          await event("negotiation_started", index, "proxy", start);
          const proxyMessage = { id: "opening", sessionIndex: index, speaker: "participant_proxy", text: "The authorized reason. || Another visual bubble.", createdAt: new Date(start + 5_000).toISOString(), reasonLabel: "WR" };
          await send("appendMessage", { participantKey: key, message: proxyMessage });
          await send("appendMessage", { participantKey: key, message: proxyMessage });
          await event("negotiation_ended", index, "proxy", start + 10_000);
        }
        await event("negotiation_started", index, "direct", start + 20_000);
        await send("appendMessage", { participantKey: key, message: { id: "human-opening", sessionIndex: index, speaker: "participant", text: "I would like to discuss the terms.", createdAt: new Date(start + 25_000).toISOString(), reasonLabel: "WR" } });
        await send("appendMessage", { participantKey: key, message: { id: "human-reply", sessionIndex: index, speaker: "counterpart", text: "Let us discuss them.", createdAt: new Date(start + 30_000).toISOString(), reasonLabel: "none" } });
        await event("negotiation_ended", index, "direct", start + 40_000);
        await responses(`negotiation_t${index}`, {
          taskId: plan.taskId, role: row.role, phase: isProxy ? "closing" : "direct", tier: "sensitive",
          [`SB_t${index}`]: false, [`SB-TIMING_t${index}`]: isProxy ? "wrap_up" : "later_turn",
          sbFirstChoice: false, sbTiming: isProxy ? "wrap_up" : "later_turn", priorityClaimed: true,
        });
        const impasse = condition % 2 === 0;
        const agreement = { sessionIndex: index,
          terms: task.issues.map((issue) => ({ issueId: issue.id, optionId: impasse ? null : preferred[issue.id], unresolved: impasse })),
          unresolvedIssueIds: impasse ? task.issues.map((issue) => issue.id) : [],
        };
        await send("saveAgreement", { participantKey: key, agreement });
        await responses(`task_outcome_t${index}`, { outcome: impasse ? "no_agreement" : "agreement", SB: false, "SB-TIMING": isProxy ? "wrap_up" : "later_turn", POINTS: 999999 });
        const blocks = [...experienceBlocks(row.role, isProxy), ...(isProxy ? proxyExperienceBlocks(key) : [])];
        await responses(`v226_post_task_scales_t${index}`, {
          ...Object.fromEntries(blocks.flatMap((block) => block.items).map((item) => [`${item.id}_t${index}`, dummyAnswer(item)])),
          _instrument_version: "2.26", _submitted: true,
          ...(isProxy ? { _pmp_responsibility_order: "human_first", _pop_responsibility_order: "ai_first" } : {}),
        });
        await responses(`v226_task_decision_t${index}`, row.role === "leader"
          ? { [`BR1_t${index}`]: 0, [`BR1_PERCENT_t${index}`]: 0, [`BR1_CONFIRMED_t${index}`]: true, _submitted: true }
          : { [`FE1_t${index}`]: 5, _submitted: true });
        const openAnswers = {
          ...Object.fromEntries(taskOpenBlocks(isProxy).flatMap((block) => block.items).filter(item => item.id !== "OET1").map((item) => [`${item.id}_t${index}`, dummyAnswer(item)])),
          ...(condition % 3 === 1 ? { [`OET1_t${index}`]: "" } : condition % 3 === 2 ? { [`OET1_t${index}`]: `Comment for ${plan.taskId}/${plan.condition}` } : {}),
          _instrument_version: "2.27", _submitted_parts: 1, _completed: true,
        };
        await responses(`v226_task_open_t${index}`, openAnswers);
        assert.deepEqual(await send("loadResponses", { block: `v226_task_open_t${index}` }), openAnswers);
        for (const attempt of [1, 2]) await db.query("select public.merge_task_audit($1,$2::smallint,'classifier:p1',$3::jsonb)", [key,index,JSON.stringify({ attemptId: `attempt-${attempt}`, offTopic: false, conditionalAcceptance: true })]);
        const clientRead = await send("loadResponses", { block: `task_outcome_t${index}` });
        assert.ok(!JSON.stringify(clientRead).includes("attemptId"), "server audit stays private");
        const metrics = (await db.query("select * from public.task_metrics where participant_key=$1 and task_index=$2", [key, index])).rows[0];
        assert.equal(metrics.status, "completed");
        assert.equal(metrics.task_id, plan.taskId);
        assert.equal(metrics.task_mode, plan.condition);
        assert.equal(metrics.sb_timing, isProxy ? "wrap_up" : "later_turn");
        assert.equal(metrics.human_duration_ms, 20_000);
        assert.equal(metrics.proxy_duration_ms, isProxy ? 10_000 : null);
        assert.equal(metrics.duration_ms, isProxy ? 30_000 : 20_000);
        assert.equal(metrics.human_turn_count, 2);
        assert.equal(metrics.proxy_turn_count, isProxy ? 1 : 0);
        assert.equal(metrics.server_audit["classifier:p1"].length, 2);
        assert.notEqual(metrics.points, 999999, "scores derive from agreement, not the client echo");
        const report = (await db.query("select * from public.self_reports where participant_key=$1 and task_index=$2", [key, index])).rows[0];
        assert.equal(report.pmp1 === null, !isProxy);
        assert.equal(report.br1, row.role === "leader" ? "0.00" : null);
        assert.equal(report.fe1, row.role === "member" ? 5 : null);
        assert.equal(report.task_id, plan.taskId);
        assert.equal(report.task_mode, plan.condition);
        const chats = (await db.query("select task_mode,proxy_policy from public.chat_messages where participant_key=$1 and task_index=$2",[key,index])).rows;
        assert.ok(chats.length > 0);
        assert.ok(chats.every(chat => chat.task_mode === plan.condition && chat.proxy_policy === row.proxy_policy));
        assert.equal(report.proxy_policy, row.proxy_policy);
        assert.equal(report.role, row.role);
        assert.equal(report.open_submitted, true);
        assert.ok(report.oed1 && report.oee1);
        assert.equal(report.oep1 === null, !isProxy);
        assert.equal(report.oet1, condition % 3 === 2 ? `Comment for ${plan.taskId}/${plan.condition}` : null);
        assert.equal((await current())[`oed1_t${index}`], null, "historical wide columns no longer receive task responses");
        if (row.role === "leader" && index === 1) {
          for (let percent = 0; percent <= 100; percent++) {
            await responses(`v226_task_decision_t${index}`, { [`BR1_t${index}`]: bonusAmountFromPercent(percent), [`BR1_PERCENT_t${index}`]: percent, [`BR1_CONFIRMED_t${index}`]: true, _submitted: true });
            assert.equal((await db.query("select br1 from public.self_reports where participant_key=$1 and task_index=$2", [key,index])).rows[0].br1, bonusAmountFromPercent(percent).toFixed(2));
          }
        }
      }
      await responses("v226_wrap_up", {
        ...Object.fromEntries([...END_CHECK_BLOCKS.flatMap((block) => block.items), ...OEC1_BLOCK.items].map((item) => [item.id, dummyAnswer(item)])),
        _instrument_version: "2.26", _checks_submitted: true, _completed: true,
      });
      await assert.rejects(db.query("select public.complete_study_participation($1)", [key]), /incomplete/);
      await responses("debriefing", { acknowledged: true, comments: "" });
      const proxyIndex = row.mode_order === "proxyFirst" ? 1 : 2;
      for (const required of ["oep1", "pmp1", "pop1"]) {
        const original = (await db.query(`select ${required} from public.self_reports where participant_key=$1 and task_index=$2`,[key,proxyIndex])).rows[0][required];
        await db.query(`update public.self_reports set ${required}=null where participant_key=$1 and task_index=$2`,[key,proxyIndex]);
        await assert.rejects(db.query("select public.complete_study_participation($1)",[key]), /Required task responses are incomplete/, `${row.proxy_policy} must require ${required}`);
        await db.query(`update public.self_reports set ${required}=$3 where participant_key=$1 and task_index=$2`,[key,proxyIndex,original]);
      }
      assert.equal((await db.query("select public.complete_study_participation($1) as result", [key])).rows[0].result.status, "completed");
      assert.equal((await current()).status, "completed");
      assert.ok(!JSON.stringify(await current()).includes('"IC1"'));
    }
    assert.equal(combinations.size, 16);
    assert.equal((await db.query("select count(*)::integer as n from public.assignment_slots where completed")).rows[0].n, 16);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await db.close();
  }
});
