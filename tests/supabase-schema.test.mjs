import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

const migration = readFileSync(new URL("../supabase/migrations/20260910041518_compact_research_storage.sql", import.meta.url), "utf8");
const optionalBackgroundMigration = readFileSync(new URL("../supabase/migrations/20260911001701_optional_background_demographics.sql", import.meta.url), "utf8");
const submittedGuardMigration = readFileSync(new URL("../supabase/migrations/20260911032955_extend_attempts_and_protect_submitted_self_reports.sql", import.meta.url), "utf8");

test("storage migration exposes five private tables and service-only RPCs", () => {
  assert.equal([...migration.matchAll(/^create table public\./gm)].length, 5);
  assert.equal([...migration.matchAll(/enable row level security/g)].length, 5);
  assert.doesNotMatch(migration, /security definer/i);
  assert.match(migration, /from public, anon, authenticated/);
  assert.match(migration, /unique \(prolific_pid, study_id\)/);
  assert.match(migration, /primary key \(participant_key, task_index, message_id\)/);
});

test("optional background migration adds nullable coded columns without changing completion", () => {
  assert.match(optionalBackgroundMigration, /add column bg8 text/);
  assert.match(optionalBackgroundMigration, /add column bg9 text/);
  assert.match(optionalBackgroundMigration, /comment on column public\.study_participants\.bg8/);
  assert.match(optionalBackgroundMigration, /comment on column public\.study_participants\.bg9/);
  assert.doesNotMatch(optionalBackgroundMigration, /not null|complete_study_participation/i);
});

test("attempt extension is future-only and the submitted-block guard is additive", () => {
  assert.match(submittedGuardMigration, /check \(participant_id between 1 and 200\)/);
  assert.match(submittedGuardMigration, /from generate_series\(181, 200\)/);
  assert.doesNotMatch(submittedGuardMigration, /update public\.assignment_slots/i);
  assert.match(submittedGuardMigration, /alter column expires_at set default \(now\(\) \+ interval '3 hours'\)/);
  assert.doesNotMatch(submittedGuardMigration, /update public\.study_participants/i);
  assert.match(submittedGuardMigration, /create trigger protect_submitted_self_report_blocks[\s\S]*before update on public\.self_reports/);
  assert.match(submittedGuardMigration, /old\.scales_submitted or new\.scales_submitted/);
  assert.match(submittedGuardMigration, /old\.decision_submitted or new\.decision_submitted/);
  assert.match(submittedGuardMigration, /old\.open_submitted or new\.open_submitted/);
  assert.doesNotMatch(submittedGuardMigration, /security definer/i);
});

test("three-hour default preserves existing expiry and delayed drafts cannot replace submitted blocks", {
  skip: !process.env.PGLITE_MODULE_PATH,
}, async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE_PATH);
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    const directory = new URL("../supabase/migrations/", import.meta.url);
    const files = readdirSync(directory).filter(file => file.endsWith(".sql")).sort();
    const pending = files.find(file => file.includes("extend_attempts_and_protect_submitted_self_reports"));
    assert.ok(pending);
    for (const file of files.slice(0, files.indexOf(pending))) {
      await db.exec(readFileSync(new URL(file, directory), "utf8"));
    }
    const seededSlots = (await db.query(
      "select * from public.assignment_slots order by participant_id",
    )).rows;
    assert.equal(seededSlots.length, 180);
    await db.exec("set role service_role");
    const existingKey = randomUUID();
    const existing = (await db.query(
      "select public.claim_study_assignment('before-extension','study','session',$1) as result", [existingKey],
    )).rows[0].result;
    const existingExpiry = existing.expires_at;
    const originalSlots = (await db.query(
      "select * from public.assignment_slots order by participant_id",
    )).rows;

    await db.exec("reset role");
    await db.exec(readFileSync(new URL(pending, directory), "utf8"));
    await db.exec("set role service_role");
    const extendedSlots = (await db.query(
      "select * from public.assignment_slots order by participant_id",
    )).rows;
    assert.deepEqual(extendedSlots.slice(0, 180), originalSlots);
    assert.deepEqual(extendedSlots.slice(180).map(slot => slot.participant_id),
      Array.from({ length: 20 }, (_, index) => index + 181));
    assert.equal((await db.query(
      "select expires_at from public.study_participants where participant_key=$1", [existingKey],
    )).rows[0].expires_at.toISOString(), new Date(existingExpiry).toISOString());

    const newKey = randomUUID();
    const fresh = (await db.query(
      "select public.claim_study_assignment('after-extension','study','session',$1) as result", [newKey],
    )).rows[0].result;
    const lifetime = Date.parse(fresh.expires_at) - Date.parse(fresh.assigned_at);
    assert.equal(lifetime, 3 * 60 * 60 * 1000);

    const scalesKey = "v226_post_task_scales_t1";
    const decisionKey = "v226_task_decision_t1";
    const openKey = "v226_task_open_t1";
    const submitted = {
      [scalesKey]: { SCF1_t1: 6, _submitted: true },
      [decisionKey]: { FE1_t1: 5, _submitted: true },
      [openKey]: { OED1_t1: "Final answer", _completed: true },
    };
    await db.query(`insert into public.self_reports
      (participant_key,task_index,scf1,fe1,oed1,open_instrument_version,
       scales_submitted,decision_submitted,open_submitted,responses)
      values($1,1,6,5,'Final answer','2.27',true,true,true,$2::jsonb)`, [existingKey, JSON.stringify(submitted)]);

    const lateDraft = {
      [scalesKey]: { SCF1_t1: 1, _submitted: false },
      [decisionKey]: { FE1_t1: 1 },
      [openKey]: { OED1_t1: "Late draft", _completed: false },
    };
    await db.query(`update public.self_reports set scf1=1,fe1=1,oed1='Late draft',
      scales_submitted=false,decision_submitted=false,open_submitted=false,responses=$2::jsonb
      where participant_key=$1 and task_index=1`, [existingKey, JSON.stringify(lateDraft)]);
    let report = (await db.query(
      "select * from public.self_reports where participant_key=$1 and task_index=1", [existingKey],
    )).rows[0];
    assert.equal(report.scf1, 6);
    assert.equal(report.fe1, 5);
    assert.equal(report.oed1, "Final answer");
    assert.equal(report.scales_submitted, true);
    assert.equal(report.decision_submitted, true);
    assert.equal(report.open_submitted, true);
    assert.deepEqual(report.responses, submitted);

    const explicitRetry = { ...submitted, [decisionKey]: { FE1_t1: 7, _submitted: true } };
    await db.query(`update public.self_reports set fe1=7,responses=$2::jsonb
      where participant_key=$1 and task_index=1`, [existingKey, JSON.stringify(explicitRetry)]);
    report = (await db.query(
      "select fe1,responses from public.self_reports where participant_key=$1 and task_index=1", [existingKey],
    )).rows[0];
    assert.equal(report.fe1, 7);
    assert.equal(report.responses[decisionKey].FE1_t1, 7);
  } finally {
    await db.close();
  }
});

// Optional real PostgreSQL engine, installed outside this repository. No network
// or remote database is used. Set PGLITE_MODULE_PATH to its dist/index.js file.
test("database allocation, isolation, expiry, transcript metrics and completion", {
  skip: !process.env.PGLITE_MODULE_PATH,
}, async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE_PATH);
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    const directory = new URL("../supabase/migrations/", import.meta.url);
    for (const file of readdirSync(directory).filter((file) => file.endsWith(".sql")).sort()) {
      await db.exec(readFileSync(new URL(file, directory), "utf8"));
    }
    const rows = (await db.query("select * from public.assignment_slots order by participant_id")).rows;
    assert.equal(rows.length, 200);
    assert.equal(rows[0].participant_id, 1);
    assert.equal(rows.at(-1).participant_id, 200);
    assert.ok(rows.every((row) => !row.assigned && !row.completed));
    for (const count of [120, 180, 200]) {
      const subset = rows.slice(0, count);
      for (const field of ["proxy_policy", "task_order", "mode_order", "role"]) {
        const levels = Map.groupBy(subset, (row) => row[field]);
        assert.deepEqual([...levels.values()].map((group) => group.length), [count / 2, count / 2]);
      }
      const pairs = Map.groupBy(subset, (row) => `${row.proxy_policy}/${row.role}`);
      assert.equal(pairs.size, 4);
      assert.ok([...pairs.values()].every((group) => group.length === count / 4));
      const cells = Map.groupBy(subset, (row) => [row.proxy_policy, row.task_order, row.mode_order, row.role].join("/"));
      assert.equal(cells.size, 16);
      assert.ok([...cells.values()].every((group) => [Math.floor(count / 16), Math.ceil(count / 16)].includes(group.length)));
    }
    const privacy = (await db.query(`select c.relname, c.relrowsecurity,
      has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon_access,
      has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as auth_access
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'`)).rows;
    assert.equal(privacy.length, 5);
    assert.ok(privacy.every((row) => row.relrowsecurity && !row.anon_access && !row.auth_access));
    const privileges = (await db.query(`select proname,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_access,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_access,
      has_function_privilege('service_role', p.oid, 'EXECUTE') as server_access
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`)).rows;
    assert.ok(privileges.every((row) => !row.anon_access && !row.auth_access && row.server_access));

    const claim = async (pid, key = randomUUID()) => (await db.query(
      "select public.claim_study_assignment($1,'study','session',$2::uuid) as result", [pid, key],
    )).rows[0].result;
    await db.exec("set role service_role");
    const first = await claim("participant-a");
    const same = await claim("participant-a");
    assert.equal(same.participant_key, first.participant_key);
    assert.equal(same.participant_id, first.participant_id);
    const second = await claim("participant-b");
    assert.notEqual(second.participant_id, first.participant_id);
    await db.query("insert into public.self_reports(participant_key,task_index,oed1) values($1,1,'Historical draft')", [second.participant_key]);
    await assert.rejects(db.query("update public.self_reports set open_instrument_version='2.27-open-v3' where participant_key=$1 and task_index=1", [second.participant_key]), /immutable once started/);
    await db.query("update public.self_reports set open_instrument_version='2.27' where participant_key=$1 and task_index=1", [second.participant_key]);
    await db.query("insert into public.self_reports(participant_key,task_index) values($1,2)", [second.participant_key]);
    await db.query("update public.self_reports set open_instrument_version='2.27-open-v3' where participant_key=$1 and task_index=2", [second.participant_key]);
    await assert.rejects(db.query("update public.self_reports set open_instrument_version='unknown' where participant_key=$1 and task_index=2", [second.participant_key]), /immutable once started/);
    await assert.rejects(db.query("update public.study_participants set role='leader' where participant_key=$1", [first.participant_key]), /immutable/);
    await assert.rejects(db.query("select public.complete_study_participation($1)", [first.participant_key]), /incomplete/);

    const message = { participant_key: first.participant_key, task_index: 1, message_id: "opening", phase: "proxy_exchange", turn_id: "turn-1", speaker: "participant_proxy", text: "Original reason. || Second display bubble.", created_at: "2026-09-10T01:00:10Z", reason_label: "WR" };
    const insertMessage = async (value) => db.query(`insert into public.chat_messages
      (participant_key,task_index,message_id,phase,turn_id,speaker,text,created_at,reason_label)
      select participant_key,task_index,message_id,phase,turn_id,speaker,text,created_at,reason_label
      from jsonb_populate_record(null::public.chat_messages,$1::jsonb)
      on conflict(participant_key,task_index,message_id) do update set text=excluded.text`, [JSON.stringify(value)]);
    await insertMessage(message);
    await insertMessage(message);
    let metrics = (await db.query("select * from public.task_metrics where participant_key=$1 and task_index=1", [first.participant_key])).rows[0];
    assert.equal(metrics.message_count, 1);
    assert.equal(metrics.proxy_turn_count, 1);
    assert.equal(metrics.wr_count, 1);
    assert.equal(metrics.participant_id, first.participant_id);
    assert.equal(metrics.role, first.role);
    await db.query("update public.task_metrics set proxy_started_at='2026-09-10T01:00:00Z',proxy_ended_at='2026-09-10T01:00:30Z',proxy_duration_ms=30000 where participant_key=$1 and task_index=1", [first.participant_key]);
    await insertMessage({ ...message, message_id: "m2", turn_id: "turn-2", created_at: "2026-09-10T01:00:20Z", reason_label: "SB" });
    metrics = (await db.query("select * from public.task_metrics where participant_key=$1 and task_index=1", [first.participant_key])).rows[0];
    assert.equal(metrics.message_count, 2);
    assert.equal(metrics.proxy_turn_count, 2);
    assert.equal(metrics.proxy_duration_ms, 30000);
    assert.equal(metrics.proxy_message_span_ms, 10000);
    await insertMessage({ ...message, task_index: 2, phase: "human_negotiation", speaker: "participant" });
    assert.equal((await db.query("select count(*)::int as n from public.chat_messages where participant_key=$1", [first.participant_key])).rows[0].n, 3);

    // Create a historical incomplete attempt with already-saved responses.
    // The fixture is inserted at its original timestamp; no production trigger
    // is disabled and no expiry control is exposed to participants.
    const expiredKey = randomUUID();
    await db.query(`insert into public.study_participants
      (participant_key,participant_id,prolific_pid,study_id,session_id,assigned_at,expires_at,bg2,background_answers)
      values ($1,3,'expired-person','study','session',now()-interval '3 hours',now()-interval '1 hour','woman','{"BG2":"woman"}')`, [expiredKey]);
    await db.query("update public.assignment_slots set assigned=true,claimed_at=now()-interval '3 hours',current_participant_key=$1,prolific_pid='expired-person',study_id='study',session_id='session' where participant_id=3", [expiredKey]);
    const replacement = await claim("replacement-person");
    assert.equal(replacement.participant_id, 3);
    const expired = (await db.query("select * from public.study_participants where participant_key=$1", [expiredKey])).rows[0];
    assert.equal(expired.status, "expired");
    assert.equal(expired.participant_id, 3);
    assert.equal(expired.bg2, "woman");
    assert.deepEqual(expired.background_answers, { BG2: "woman" });
    assert.equal((await claim("expired-person")).participant_key, expiredKey);
    await assert.rejects(db.query("update public.study_participants set bg2='man' where participant_key=$1", [expiredKey]), /closed/);
    await assert.rejects(insertMessage({ ...message, participant_key: expiredKey }), /no longer writable/);
    await assert.rejects(db.query("select public.complete_study_participation($1)", [expiredKey]), /no longer completable/);

    const stoppedKey = randomUUID();
    await db.query(`insert into public.study_participants
      (participant_key,participant_id,prolific_pid,study_id,session_id,status,assigned_at,expires_at)
      values ($1,4,'stopped-person','study','session','stopped',now()-interval '3 hours',now()-interval '1 hour')`, [stoppedKey]);
    await db.query("update public.assignment_slots set assigned=true,claimed_at=now()-interval '3 hours',current_participant_key=$1 where participant_id=4", [stoppedKey]);
    assert.equal((await claim("replace-stopped")).participant_id, 4);
    assert.equal((await db.query("select status from public.study_participants where participant_key=$1", [stoppedKey])).rows[0].status, "expired");

    // Complete a Member attempt including an explicit no-agreement outcome.
    await db.query(`update public.study_participants set
      bg2='woman',bg3='full_time',bg5='no',bg6=4,bg7='monthly',fts1=4,fts2=4,fts3=4,
      aia1=4,aia2=4,aia3=4,aia4=4,aia5=4,rsc1=4,rsc2=4,rsc3=4,rsc4=4,icc1=4,icc2=4,
      icc3='None',oec1='My comparison',oed1_t1='Reason',oee1_t1='Impression',oep1_t1='Proxy',oed1_t2='Reason',oee1_t2='Impression',
      operational='{"consented":true,"background_submitted":true,"wrap_up_submitted":true,"open_t1_submitted":true,"open_t2_submitted":true}'
      where participant_key=$1`, [first.participant_key]);
    for (const taskIndex of [1, 2]) {
      await db.query(`update public.task_metrics set status='completed',outcome='{"outcome":"no_agreement"}',agreement='{"terms":[],"unresolvedIssueIds":["a","b"]}'
        where participant_key=$1 and task_index=$2`, [first.participant_key, taskIndex]);
      await db.query(`insert into public.self_reports(participant_key,task_index,scf1,scf2,sce1,sce2,ce1,ce2,ce3,ns1,ns2,fe1,
        pmp1,pmp2,pmp3,pmp4,pop1,pop2,pop3,pop4,scales_submitted,decision_submitted,oed1,oee1,oep1,open_submitted)
        values ($1,$2,4,4,4,4,4,4,4,4,4,4,$3,$3,$3,$3,$3,$3,$3,$3,true,true,'Reason','Impression','Proxy',true)`, [first.participant_key, taskIndex, taskIndex === 1 ? 4 : null]);
    }
    await assert.rejects(db.query("select public.complete_study_participation($1)", [first.participant_key]), /incomplete/);
    await db.query("update public.study_participants set operational=operational || '{\"debriefing_acknowledged\":true}'::jsonb where participant_key=$1", [first.participant_key]);
    const completed = (await db.query("select public.complete_study_participation($1) as result", [first.participant_key])).rows[0].result;
    assert.equal(completed.status, "completed");
    assert.deepEqual((await db.query("select public.complete_study_participation($1) as result", [first.participant_key])).rows[0].result, completed);
    assert.equal((await db.query("select completed from public.assignment_slots where participant_id=$1", [first.participant_id])).rows[0].completed, true);
    await assert.rejects(insertMessage(message), /no longer writable/);
    await assert.rejects(db.query("select public.merge_task_audit($1,1::smallint,'classifier:p1','{}')", [first.participant_key]), /no longer writable/);
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from public.study_participants"), /permission denied/);
    await assert.rejects(db.query("select public.complete_study_participation($1)", [first.participant_key]), /permission denied/);
    await assert.rejects(db.query("select public.merge_task_audit($1,1::smallint,'classifier:p1','{}')", [first.participant_key]), /permission denied/);
  } finally {
    await db.close();
  }
});

test("task-open migration backfills closed historical attempts without dropping their answers", {
  skip: !process.env.PGLITE_MODULE_PATH,
}, async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE_PATH);
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    const directory = new URL("../supabase/migrations/", import.meta.url);
    const files = readdirSync(directory).filter(file => file.endsWith(".sql")).sort();
    const pending = files.find(file => file.includes("task_open_answers_and_server_audit"));
    for (const file of files.slice(0, files.indexOf(pending))) await db.exec(readFileSync(new URL(file,directory),"utf8"));
    const key = "cce52f33-a12c-4e65-9012-1158b8aa6767";
    await db.query("select public.claim_study_assignment('historical','backfill','session',$1)",[key]);
    await db.query(`update public.study_participants set oed1_t1='Original reason',oee1_t1='Original impression',oep1_t1='Original proxy',
      operational='{"open_t1_submitted":true}',status='completed',completed_at=now() where participant_key=$1`,[key]);
    for (const file of files.slice(files.indexOf(pending))) await db.exec(readFileSync(new URL(file,directory),"utf8"));
    const report = (await db.query("select * from public.self_reports where participant_key=$1",[key])).rows[0];
    assert.equal(report.task_id,"task_a");
    assert.equal(report.task_mode,"user_specified");
    assert.equal(report.oed1,"Original reason");
    assert.equal(report.responses.v226_task_open_t1.OED1_t1,"Original reason");
    assert.equal(report.open_submitted,true);
    assert.equal(report.oet1,null);
    assert.equal((await db.query("select oed1_t1 from public.study_participants where participant_key=$1",[key])).rows[0].oed1_t1,"Original reason");
    await assert.rejects(db.query("update public.self_reports set oed1='late' where participant_key=$1",[key]), /no longer writable/);
  } finally { await db.close(); }
});

test("reviewed smoke rolls everything back and refuses an occupied study", {
  skip: !process.env.PGLITE_MODULE_PATH,
}, async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE_PATH);
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    const directory = new URL("../supabase/migrations/", import.meta.url);
    for (const file of readdirSync(directory).filter(file => file.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file,directory),"utf8"));
    const smoke = readFileSync(new URL("./supabase-rollback-smoke.sql",import.meta.url),"utf8");
    await db.exec(smoke);
    assert.equal((await db.query("select count(*)::integer n from public.study_participants")).rows[0].n,0);
    assert.equal((await db.query("select count(*)::integer n from public.assignment_slots where assigned or completed")).rows[0].n,0);
    await db.query("select public.claim_study_assignment('real-pilot','real-study','session',$1)",[randomUUID()]);
    await assert.rejects(db.exec(smoke), /Smoke refused/);
    await db.exec("rollback");
    assert.equal((await db.query("select count(*)::integer n from public.study_participants")).rows[0].n,1);
  } finally { await db.close(); }
});

test("exact task-mode migration preserves closed records and restores every write guard", {
  skip: !process.env.PGLITE_MODULE_PATH,
}, async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE_PATH);
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    const directory = new URL("../supabase/migrations/", import.meta.url);
    const files = readdirSync(directory).filter(file => file.endsWith(".sql")).sort();
    const pending = files.find(file => file.includes("exact_task_experience_mode"));
    for (const file of files.slice(0, files.indexOf(pending))) await db.exec(readFileSync(new URL(file,directory),"utf8"));
    const attempts = [];
    for (let i=1;i<=5;i++) {
      const key=randomUUID();
      await db.query("select public.claim_study_assignment($1,'mode-backfill','session',$2)",[`pilot-${i}`,key]);
      if (![1,5].includes(i)) continue;
      attempts.push(key);
      for (const index of [1,2]) {
        await db.query("insert into public.self_reports(participant_key,task_index,oed1) values($1,$2,'Preserved answer')",[key,index]);
        await db.query("insert into public.chat_messages(participant_key,task_index,message_id,phase,turn_id,speaker,text,created_at) values($1,$2,'m1','human_negotiation','m1','participant','Preserved transcript',now())",[key,index]);
        await db.query("select public.merge_task_audit($1,$2::smallint,'classifier:m1','{\"attemptId\":\"original\"}')",[key,index]);
      }
      await db.query("update public.study_participants set status=$2,completed_at=case when $2='completed' then now() end where participant_key=$1",[key,i===1?"completed":"expired"]);
    }
    const before = {};
    for (const table of ["self_reports","task_metrics","chat_messages"]) before[table]=(await db.query(`select * from public.${table} order by participant_key,task_index`)).rows;
    const slotsBefore=(await db.query("select * from public.assignment_slots order by participant_id")).rows;
    for (const file of files.slice(files.indexOf(pending))) await db.exec(readFileSync(new URL(file,directory),"utf8"));
    for (const table of ["self_reports","task_metrics","chat_messages"]) {
      const after=(await db.query(`select * from public.${table} order by participant_key,task_index`)).rows;
      const oldColumns = Object.keys(before[table][0]);
      assert.deepEqual(after.map(row=>Object.fromEntries(oldColumns.map(key=>[key,row[key]]))),before[table].map(row=>({...row,task_mode:row.task_mode==="proxy"?row.proxy_policy:"direct"})), `${table}: existing data unchanged except mode`);
      if (table === "self_reports") for (const row of after) {
        for (const field of ["oei1","oef1","oen1","oer1","oep2","oep3","oep4","oep5","oec1","open_instrument_version"]) assert.equal(row[field], null, "additive reflection fields do not promote old attempts");
      }
      for (const key of attempts) await assert.rejects(db.query(`update public.${table} set task_mode='direct' where participant_key=$1`,[key]),/no longer writable/);
    }
    const slotsAfter=(await db.query("select * from public.assignment_slots order by participant_id")).rows;
    assert.deepEqual(slotsAfter.slice(0,180),slotsBefore);
    assert.equal(slotsAfter.length,200);
    assert.ok(slotsAfter.slice(180).every(slot=>!slot.assigned&&!slot.completed));
    const guards=(await db.query("select tgname,tgenabled from pg_trigger where not tgisinternal and tgrelid in ('public.self_reports'::regclass,'public.task_metrics'::regclass,'public.chat_messages'::regclass)")).rows;
    assert.equal(guards.length,5);
    assert.ok(guards.some(trigger=>trigger.tgname==='protect_submitted_self_report_blocks'));
    assert.ok(guards.every(trigger=>trigger.tgenabled==='O'));
  } finally { await db.close(); }
});
