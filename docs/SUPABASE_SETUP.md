# Supabase study storage

The five-table schema was applied to project `gtbvfjbrwusesbfzxqpp` on 2026-09-10. This replaces the historical schema in `DATA_MODEL.md`. Applying this schema does not deploy the app or start recruitment.

## Work ownership and progress

| Work | Owner | State |
| --- | --- | --- |
| SQL migrations, database checks, this guide | Database worker | Applied; local engine and remote rollback checks passed |
| Signed participant session, assignment/persistence/completion APIs, Store wiring | Backend worker | All 16 record-mapping/completion flows passed in the isolated SQL engine |
| Overall review, user handoff, deployment decision | Root agent | Deployment remains outside this change |

## Tables and analysis keys

| Table | Row represents | Contents |
| --- | --- | --- |
| `assignment_slots` | One of 180 reusable slots | Four fixed assignment factors, assigned/completed flags, current Prolific IDs, claim time |
| `study_participants` | One immutable participation attempt | UUID key, slot ID, frozen assignment, Prolific identity, background answers, study-wide checks, open responses, completion state |
| `self_reports` | One task in one attempt | SCF/SCE/CE/NS, Proxy PMP/POP, Leader BR1 or Member FE1, task-open OED/OEE/OEP/OET, submission flags |
| `task_metrics` | One task in one attempt | Initial preferences, mandate, agreement/impasse, outcome, disclosure timing, event durations, message aggregates and private server audit |
| `chat_messages` | One original message | Human/Proxy phase, speaker, text, explicit turn ID, timestamp, proposal, reason labels |

Every analysis row includes `participant_id`, `participant_key`, `proxy_policy`, `task_order`, `mode_order`, and `role`. Child rows also include `task_index`, `task_id`, and `task_mode`. Database triggers derive these values from the frozen attempt; client values cannot change the assignment.

`task_mode` stores the exact experienced condition: `direct`, `user_specified`, or `ai_supplemented`, in all three child tables. `proxy_policy` remains the between-subject assigned factor even for a Direct task. For example, a Direct task in an AI-supplemented assignment has `task_mode = 'direct'` and `proxy_policy = 'ai_supplemented'`; its Proxy task has both values `ai_supplemented`. Message `phase` is separate: `human_negotiation` or `proxy_exchange`. A Proxy task's later human discussion still has its original Proxy condition as `task_mode`.

`participant_id` is the slot number, 1–180. It can be reused after an incomplete attempt expires. `participant_key` is the immutable UUID of an attempt. Join research data using `participant_key`; joining on the slot alone would combine a previous attempt with its replacement.

SQL uses lowercase codes: `scf1` is SCF1, `bg2` is BG2, and so on. Background and study-wide codes are `bg1`–`bg7`, `fts1`–`fts3`, `aia1`–`aia5`, `rsc1`–`rsc4`, `icc1`–`icc3`, `oec1`. Canonical task-open answers are `self_reports.oed1`, `oee1`, `oep1`, and `oet1`, beside their actual task/mode/policy/role metadata. OEP applies only to the Proxy task. OET1 is one new optional final comment on each existing task-open page; blank or missing values remain NULL and never prevent completion. End-study ICC/OEC and optional post-debrief comments remain in `study_participants`.

The historical participant-wide `oed1_t1`, `oee1_t1`, `oep1_t1` and `_t2` columns are retained and backfilled into canonical task rows, but receive no new writes. Their suffix is presentation index, not task A/B. Use `self_reports` for current analysis rather than mixing the historical and canonical sources.

Task scale codes are `scf1`–`scf2`, `sce1`–`sce2`, `ce1`–`ce3`, `ns1`–`ns2`, `pmp1`–`pmp4`, `pop1`–`pop4`, `br1`, `fe1`. Unasked items stay NULL. `br1` stores pounds from **0.00 to 0.50**, with `br1_percent` storing the separate 0–100 slider position. UI and server share an integer-pence conversion (nearest penny, half-penny rounded up). Zero is a valid recommendation. PMP/POP are individual items, not an automatically averaged score.

JSON columns preserve the whitelisted response-block structure for reloads. They are not general event logs. IC/practice answers and click telemetry are not persisted remotely. `operational` contains a small set of submission/consent/stop flags required to run and finish the study.

## Assignment and expiry

The 180-slot pool crosses all 16 combinations of two Proxy policies, two task orders, two mode orders and two roles. The first 120 slots contain 7 or 8 of every full combination, 60 on each level of every factor and 30 of every Proxy-policy × role pair. All 180 contain 11 or 12 per full combination, 90 per factor level and 45 per Proxy-policy × role pair. Prolific controls the recruitment target; the database has 180 slots rather than an artificial 120-slot cap.

`claim_study_assignment(p_prolific_pid, p_study_id, p_session_id, p_participant_key)` is called only by the server, using a server-generated UUID. It returns the attempt key, slot ID, frozen factors, status, assignment time and expiry time. An advisory transaction lock plus row locks makes claim/reclaim/finalize atomic. Repeated Prolific PID + study ID returns the original attempt, including when it is expired or stopped; it never gives that person a new condition.

Claims take the lowest-numbered free slot. The first 16 slots illustrate every combination below; A/B are actual tasks, while 1/2 are presentation indices. Each attempt experiences its assigned role in both tasks and its assigned policy in the Proxy task. Direct has no Proxy policy behavior, although the attempt's policy remains in the analysis metadata.

| Slot | Proxy policy | Role | Task index 1 | Task index 2 |
| --- | --- | --- | --- | --- |
| 1 | User-specified | Member | A / Proxy | B / Direct |
| 2 | User-specified | Leader | A / Direct | B / Proxy |
| 3 | User-specified | Leader | B / Proxy | A / Direct |
| 4 | User-specified | Member | B / Direct | A / Proxy |
| 5 | AI-supplemented | Leader | A / Proxy | B / Direct |
| 6 | AI-supplemented | Member | A / Direct | B / Proxy |
| 7 | AI-supplemented | Member | B / Proxy | A / Direct |
| 8 | AI-supplemented | Leader | B / Direct | A / Proxy |
| 9 | User-specified | Leader | A / Proxy | B / Direct |
| 10 | User-specified | Member | A / Direct | B / Proxy |
| 11 | User-specified | Member | B / Proxy | A / Direct |
| 12 | User-specified | Leader | B / Direct | A / Proxy |
| 13 | AI-supplemented | Member | A / Proxy | B / Direct |
| 14 | AI-supplemented | Leader | A / Direct | B / Proxy |
| 15 | AI-supplemented | Leader | B / Proxy | A / Direct |
| 16 | AI-supplemented | Member | B / Direct | A / Proxy |

An incomplete attempt expires two hours after its original claim. Expiry is enforced for writes and completion immediately at that deadline. Slot flags are refreshed **lazily on the next assignment request**, not by a background timer. That request marks expired active/stopped attempts `expired`, clears their current slot claim and makes the slot available. Previous participant rows and responses remain intact. Delayed requests using the old UUID cannot write into the reused slot or complete it. Completed slots are never reclaimed.

## Completion and timing

`complete_study_participation(p_participant_key)` requires an active, unexpired attempt still owning its slot, consent/background/final/debrief flags, all required coded responses, both submitted task questionnaires/role decisions and canonical task-open rows, and both completed task outcomes with agreement records. An impasse has an explicit unresolved agreement record and is valid completion. Optional BG1/BG4/OET1, post-debrief comments and unasked Proxy/role items are not required. Repeating an already successful completion returns the same completion timestamp.

`started_at`, `ended_at` and `duration_ms` are derived from negotiation events. The human and Proxy phase fields store the corresponding event times and durations. `message_span_ms` and its phase variants separately describe the first-to-last message interval. The chat aggregate trigger never overwrites the event timing fields.

Messages are keyed by `(participant_key, task_index, message_id)` because message IDs can repeat across tasks. `turn_id` denotes the original message/turn; visual `||` bubble breaks do not add rows or turns. Retries upsert the same message. Reason labels/timestamps describe what was actually stored, while SB authorization and first-disclosure decisions remain separate task metrics.

`task_metrics.sb` records the design's **first-chance SB choice**, not whether SB was ever disclosed. A later disclosure can have `sb = false` and `sb_timing = 'later_turn'`. For disclosure at any time, use a non-NULL `participant_first_wr_at` or `participant_first_sb_at`; these include the participant's own Proxy relay. `wr_count` and `sb_count` count labelled messages across all speakers, not only the participant. They are cumulative labelled-message counts, not unique disclosure acts; do not interpret a repeated/cumulative label as a new disclosure.

`task_metrics.server_audit` is the canonical full classifier/guardrail/fallback/provenance record. Keys are `kind:messageId`; each value is an array of server-generated attempts with an attempt UUID and timestamp. The service-only `merge_task_audit` RPC appends atomically, including retries rather than silently replacing them. Classifier entries retain the full classification and input context; counterpart/Proxy entries retain generated and chosen actions, validation, blocking/fallback and reason metadata. These fields are never returned by participant read APIs. Legacy client guardrail telemetry is not the authoritative audit source. Successful audit recording does not imply a model response was displayed: use the correlated chat message ID to distinguish recorded attempts from delivered messages.

This audit covers successful classifier/generator results, including generated output subsequently rejected or replaced by guardrails. Provider/network exceptions before audit invocation are not stored here; they remain application errors/logs. If the audit write itself fails, that entry is not durable and the route does not return a successful model response. It is not a complete API-failure or network-attempt ledger.

## Credentials and access

The server requires `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`). `STUDY_SESSION_SECRET` can supply a separate signing secret. Never put a service/secret key in a `NEXT_PUBLIC_` variable. The browser uses the app's signed HttpOnly session and application APIs; it never receives a Supabase service key.

All five public tables have RLS enabled. `PUBLIC`, `anon` and `authenticated` have no table access or RPC execute privileges. Only the server's `service_role` has the necessary access. Functions use `SECURITY INVOKER` with an empty search path. No anonymous RLS policies are needed for this server-only design.

## Migrations and checks

Verification snapshot, 2026-09-10 (remote schema checked after 09:26 UTC; public production status last checked at 09:01 UTC):

- Final full local suite after dependency patches: 495/495 passed, no skipped tests, including the real SQL engine. The Next.js 16.3.4 production-mode build (`NEXT_PUBLIC_DEV_TOOLS=off`) and TypeScript check passed. Lint had no errors and one pre-existing unused-function warning. Full `npm audit` reported zero vulnerabilities at all severities; the scoped secret scan found only a deliberately fake test credential.
- Browser checks: all 16 assignments × both task indices (32 main-screen renders) matched the actual task title, Direct/Proxy mode and role-specific private SB facts. The optional OET1 question allowed a blank answer with the development “skip required” bypass OFF. These are bounded UI checks, not 32 full negotiations or proof of live-model behavior.
- Remote guarded rollback smoke ran against all four applied migrations after 09:26 UTC and passed. After rollback: 180 slots, zero occupied slots, and zero rows in participants, self-reports, task metrics and chat messages. No synthetic participant data was retained. Independent catalog checks confirmed the exact-mode constraints, enabled triggers, RLS and service-only RPC access.
- Remote security advisor reported only the expected informational RLS-without-policies notices for the service-only tables, with no warnings or errors.
- A temporary local production server passed 8/8 bounded HTTP checks: landing 200, preflight 503/not-ready for the expected missing completion code, assignment GET 401, malformed persistence 400, valid persistence without a cookie 401, completion without a cookie 401, administrative test-ID assignment 400, and allowed PNG optimization 200. These checks made no valid participant claim, paid model call or database write.
- The public production site still served the older application code at 09:01 UTC. Database migration success is not deployment success. The user subsequently authorized the reviewed three-commit push after final verification. No post-deployment verification is claimed here; Git push may trigger the hosting provider's automatic deployment.
- Remaining launch gates: configure the real completion code and verify a deployed participant pilot manually. Vercel management access was unauthenticated, so deployed environment values were not verified through that integration. Local passing checks do not establish those external conditions.

The migration files are the canonical SQL:

1. `20260910041518_compact_research_storage.sql`
2. `20260910041749_cover_analysis_attempt_foreign_keys.sql`
3. `20260910090126_task_open_answers_and_server_audit.sql`
4. `20260910092624_exact_task_experience_mode.sql`

All four filenames match remote migration history. The second migration replaces three single-column indexes with composite indexes covering the attempt foreign keys, without adding more indexes. The third adds canonical task-open answers and private server audit without adding a sixth table; it was applied on 2026-09-10 after local engine checks and SQL review.

The fourth migration replaces historical `task_mode = 'proxy'` with each attempt's frozen Proxy policy, including closed attempts, without changing answers, timestamps, message phases or assignment slots. It restores all write guards after the backfill and requires Proxy-only OEP/PMP/POP for both exact Proxy conditions. The local 16-assignment integration test checks each stored child row against the actual session plan's condition, including Direct rows retaining their assigned `proxy_policy`.

Applied at 2026-09-10 09:26 UTC: the fourth migration's three mode constraints are validated and all four child-table triggers are enabled. The updated remote rollback smoke passed with exact-mode assertions and the live-data refusal guard intact. After rollback, the 180 slots were unoccupied and all four analysis tables again had zero rows. Its focused local suite passed 21/21 with no skips; the updated smoke/schema subset also passed 5/5. This DB verification is separate from deployment and the earlier full-suite snapshot.

`tests/supabase-schema.test.mjs` can execute the real SQL in an isolated PGlite PostgreSQL engine. Install `@electric-sql/pglite@0.5.8` into a temporary directory outside this repository and set `PGLITE_MODULE_PATH` to its `dist/index.js`, then run:

```sh
node --import ./tests/ts-register.mjs --test tests/supabase-schema.test.mjs
```

Without that environment variable, the engine test is explicitly skipped; the static schema check still runs. The integration check in `tests/supabase-persistence-integration.test.mjs` uses the same isolated engine and actual server record mapping.

`tests/supabase-rollback-smoke.sql` exercises server-role claim, duplicate identity, stored message idempotency, expiry/reuse/history retention, old-attempt rejection and complete/impasse behavior inside one transaction followed by `ROLLBACK`. The applied project was verified afterward: 180 slots, zero assigned/completed slots and zero rows in all four analysis tables. Synthetic smoke data was never retained. Local tests do not reproduce multiple independent database connections; the remote claim lock is also checked by source/catalog inspection.

The cross-layer integration test covers all 16 assignments using actual `persistOperation` code and frontend-shaped records against the SQL engine: both roles/orders/policies, every integer BR1 slider position, agreement/impasse, later disclosure, message/turn aggregates, event durations, required debrief completion, canonical open-answer reload, optional OET1 missing/blank/filled, and private audit retry retention. The schema test separately verifies closed historical answer backfill and restored write guards. These checks do not call a paid model or replay the full browser interface. Actual browser/task routing must also be checked independently; a metadata-only test is not proof that the UI showed the correct scenario.

## Selective pilot reset (operator review required; never automatic)

Export the intended pilot attempt before deletion. Stop its browser requests and verify its UUID, Prolific PID and study ID using a read-only query. Do not reset real recruited participants. The following administrative SQL template targets exactly one reviewed attempt and defaults to rollback. Replace all three placeholders; review the returned target before explicitly changing the final `ROLLBACK` to `COMMIT`. Use an administrative database connection: the application's service role deliberately has no DELETE privilege.

```sql
begin;
select pg_advisory_xact_lock(7272026, 180);
do $$
declare
  pilot_key uuid := 'REPLACE_WITH_REVIEWED_ATTEMPT_UUID';
  expected_pid text := 'REPLACE_WITH_REVIEWED_PROLIFIC_PID';
  expected_study text := 'REPLACE_WITH_REVIEWED_STUDY_ID';
  pilot public.study_participants;
begin
  if expected_pid like 'REPLACE_%' or expected_study like 'REPLACE_%' then
    raise exception 'Replace and verify all pilot identifiers first';
  end if;
  select * into strict pilot from public.study_participants
    where participant_key = pilot_key for update;
  if pilot.prolific_pid <> expected_pid or pilot.study_id <> expected_study then
    raise exception 'Pilot identity mismatch; no data removed';
  end if;
  -- Clear the referencing slot only if this attempt still owns it.
  -- A replacement attempt in the same slot must remain untouched.
  update public.assignment_slots set assigned=false, completed=false,
    prolific_pid=null, study_id=null, session_id=null, claimed_at=null,
    current_participant_key=null
    where participant_id=pilot.participant_id and current_participant_key=pilot_key;
  delete from public.chat_messages where participant_key=pilot_key;
  delete from public.self_reports where participant_key=pilot_key;
  delete from public.task_metrics where participant_key=pilot_key;
  delete from public.study_participants where participant_key=pilot_key;
  raise notice 'Reviewed pilot attempt removed within this transaction: %', pilot_key;
end;
$$;
-- Inspect the transaction result before choosing to retain this deletion.
rollback;
```

No assignment seed rows or conditions are deleted. Clearing only a slot is insufficient: the retained PID + study identity would still return the old attempt. After an approved committed selective reset, the same PID + study can claim again, taking the then-lowest free slot, not necessarily its former condition. For multiple pilot attempts, review and run one explicit UUID at a time; do not broaden the WHERE clause.

Before retesting, close **all** incognito windows (not merely one tab), then start a fresh incognito session. For a normal browser, clear this site's cookies and local storage, including the signed `amne_study` cookie and `amne:*` progress/write queues. A stale cookie or queued write must not be reused for a new attempt. After an approved reset verify the exact target is absent, unrelated attempts remain, and only its still-owned slot was released. Deletion becomes irreversible after commit unless the export/backup is restored.

Supabase's [RLS-without-policies informational advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) is expected for these server-only tables. Unused-index informational notices are expected before recruitment. Do not grant public access merely to silence those notices.

The performance advisor still reports the three composite foreign keys because their declared column order is opposite the slot-first indexes. Both key columns are indexed; this is an informational item for later query-plan review, not a missing access-control policy or a recruitment gate.
