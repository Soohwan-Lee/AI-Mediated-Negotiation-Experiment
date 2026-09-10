-- Five research tables. The slot is reusable; the attempt UUID is never reused.
-- All browser traffic goes through the application's signed-session API.

create table public.assignment_slots (
  participant_id integer primary key check (participant_id between 1 and 180),
  proxy_policy text not null check (proxy_policy in ('user_specified', 'ai_supplemented')),
  task_order text not null check (task_order in ('taskA_first', 'taskB_first')),
  mode_order text not null check (mode_order in ('proxyFirst', 'directFirst')),
  role text not null check (role in ('member', 'leader')),
  assigned boolean not null default false,
  completed boolean not null default false,
  prolific_pid text,
  study_id text,
  session_id text,
  claimed_at timestamptz,
  current_participant_key uuid unique,
  check (not completed or assigned),
  check (assigned = (current_participant_key is not null)),
  check (assigned = (claimed_at is not null))
);

-- Seven complete factorial blocks plus an orthogonal half block give the first
-- 120 slots 7/8 per cell, 60/60 on every factor and 30 per policy x role pair.
-- Eleven complete blocks plus four balanced cells give 180 slots 11/12 per cell.
with permutation as (
  select array[0,3,5,6,9,10,12,15,1,2,4,7,8,11,13,14] as cells
), allocation as (
  select n, case when n <= 176 then cells[((n - 1) % 16) + 1]
    else (array[0,7,9,14])[n - 176] end as cell
  from generate_series(1, 180) n cross join permutation
)
insert into public.assignment_slots (participant_id, proxy_policy, task_order, mode_order, role)
select n,
  case when (cell & 8) = 0 then 'user_specified' else 'ai_supplemented' end,
  case when (cell & 4) = 0 then 'taskA_first' else 'taskB_first' end,
  case when (cell & 2) = 0 then 'proxyFirst' else 'directFirst' end,
  case when (cell & 1) = 0 then 'member' else 'leader' end
from allocation order by n;

create table public.study_participants (
  participant_key uuid primary key,
  participant_id integer not null references public.assignment_slots(participant_id),
  proxy_policy text not null,
  task_order text not null,
  mode_order text not null,
  role text not null,
  prolific_pid text not null check (length(btrim(prolific_pid)) between 1 and 255),
  study_id text not null check (length(btrim(study_id)) between 1 and 255),
  session_id text not null check (length(btrim(session_id)) between 1 and 255),
  status text not null default 'active' check (status in ('active', 'completed', 'expired', 'stopped')),
  assigned_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  background_answers jsonb not null default '{}'::jsonb,
  open_answers jsonb not null default '{}'::jsonb,
  operational jsonb not null default '{}'::jsonb,
  bg1 numeric, bg2 text, bg3 text, bg4 numeric, bg5 text, bg6 smallint, bg7 text,
  fts1 smallint, fts2 smallint, fts3 smallint,
  aia1 smallint, aia2 smallint, aia3 smallint, aia4 smallint, aia5 smallint,
  rsc1 smallint, rsc2 smallint, rsc3 smallint, rsc4 smallint,
  icc1 smallint, icc2 smallint, icc3 text, oec1 text,
  oed1_t1 text, oee1_t1 text, oep1_t1 text,
  oed1_t2 text, oee1_t2 text, oep1_t2 text,
  unique (prolific_pid, study_id),
  unique (participant_key, participant_id),
  check (expires_at > assigned_at),
  check ((status = 'completed') = (completed_at is not null)),
  check (least(bg6, fts1, fts2, fts3, aia1, aia2, aia3, aia4, aia5, rsc1, rsc2, rsc3, rsc4, icc1, icc2) >= 1
    and greatest(bg6, fts1, fts2, fts3, aia1, aia2, aia3, aia4, aia5, rsc1, rsc2, rsc3, rsc4, icc1, icc2) <= 7)
);
create index study_participants_slot_idx on public.study_participants(participant_id);
create index study_participants_expiry_idx on public.study_participants(expires_at) where status in ('active', 'stopped');
alter table public.assignment_slots add constraint assignment_current_attempt_fk
  foreign key (current_participant_key) references public.study_participants(participant_key);

create table public.self_reports (
  participant_key uuid not null,
  participant_id integer not null,
  proxy_policy text not null, task_order text not null, mode_order text not null, role text not null,
  task_index smallint not null check (task_index in (1, 2)),
  task_id text not null check (task_id in ('task_a', 'task_b')),
  task_mode text not null check (task_mode in ('direct', 'proxy')),
  responses jsonb not null default '{}'::jsonb,
  scf1 smallint, scf2 smallint, sce1 smallint, sce2 smallint,
  ce1 smallint, ce2 smallint, ce3 smallint, ns1 smallint, ns2 smallint,
  pmp1 smallint, pmp2 smallint, pmp3 smallint, pmp4 smallint,
  pop1 smallint, pop2 smallint, pop3 smallint, pop4 smallint,
  fe1 smallint,
  br1 numeric(3,2) check (br1 between 0 and 0.50),
  br1_percent smallint check (br1_percent between 0 and 100),
  br1_confirmed boolean,
  pmp_responsibility_order text check (pmp_responsibility_order in ('human_first', 'ai_first')),
  pop_responsibility_order text check (pop_responsibility_order in ('human_first', 'ai_first')),
  scales_submitted boolean not null default false,
  decision_submitted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (participant_key, task_index),
  foreign key (participant_key, participant_id) references public.study_participants(participant_key, participant_id),
  check (least(scf1, scf2, sce1, sce2, ce1, ce2, ce3, ns1, ns2, pmp1, pmp2, pmp3, pmp4, pop1, pop2, pop3, pop4, fe1) >= 1
    and greatest(scf1, scf2, sce1, sce2, ce1, ce2, ce3, ns1, ns2, pmp1, pmp2, pmp3, pmp4, pop1, pop2, pop3, pop4, fe1) <= 7),
  check (task_mode <> 'direct' or num_nonnulls(pmp1, pmp2, pmp3, pmp4, pop1, pop2, pop3, pop4) = 0),
  check ((role = 'leader' and fe1 is null) or (role = 'member' and br1 is null and br1_percent is null and br1_confirmed is null))
);
create index self_reports_slot_idx on public.self_reports(participant_id);

create table public.task_metrics (
  participant_key uuid not null,
  participant_id integer not null,
  proxy_policy text not null, task_order text not null, mode_order text not null, role text not null,
  task_index smallint not null check (task_index in (1, 2)),
  task_id text not null check (task_id in ('task_a', 'task_b')),
  task_mode text not null check (task_mode in ('direct', 'proxy')),
  status text not null default 'pending' check (status in ('pending', 'active', 'completed', 'interrupted')),
  response_blocks jsonb not null default '{}'::jsonb,
  initial_preferences jsonb, mandate jsonb, agreement jsonb, outcome jsonb,
  ratify text, sb boolean, sb_timing text, tier text, priority_claimed boolean,
  points integer check (points >= 0), joint integer check (joint >= 0),
  own_requirement_preserved boolean, their_requirement_preserved boolean,
  started_at timestamptz, ended_at timestamptz,
  message_count integer not null default 0,
  participant_message_count integer not null default 0,
  counterpart_message_count integer not null default 0,
  proxy_message_count integer not null default 0,
  human_message_count integer not null default 0,
  human_turn_count integer not null default 0,
  proxy_turn_count integer not null default 0,
  wr_count integer not null default 0, sb_count integer not null default 0,
  first_message_at timestamptz, last_message_at timestamptz,
  first_wr_at timestamptz, first_sb_at timestamptz,
  participant_first_wr_at timestamptz, participant_first_sb_at timestamptz,
  human_started_at timestamptz, human_ended_at timestamptz,
  proxy_started_at timestamptz, proxy_ended_at timestamptz,
  duration_ms bigint, human_duration_ms bigint, proxy_duration_ms bigint,
  message_span_ms bigint, human_message_span_ms bigint, proxy_message_span_ms bigint,
  updated_at timestamptz not null default now(),
  primary key (participant_key, task_index),
  foreign key (participant_key, participant_id) references public.study_participants(participant_key, participant_id)
);
create index task_metrics_slot_idx on public.task_metrics(participant_id);

create table public.chat_messages (
  participant_key uuid not null,
  participant_id integer not null,
  proxy_policy text not null, task_order text not null, mode_order text not null, role text not null,
  task_index smallint not null check (task_index in (1, 2)),
  task_id text not null check (task_id in ('task_a', 'task_b')),
  task_mode text not null check (task_mode in ('direct', 'proxy')),
  message_id text not null,
  phase text not null check (phase in ('proxy_exchange', 'human_negotiation')),
  turn_id text,
  speaker text not null check (speaker in ('participant', 'counterpart', 'participant_proxy', 'counterpart_proxy', 'counterpart_principal', 'system')),
  text text not null,
  stage smallint check (stage between 1 and 6),
  created_at timestamptz not null,
  received_at timestamptz not null default now(),
  proposal jsonb,
  reason_label text check (reason_label in ('none', 'WR', 'SB')),
  reason_confidence numeric check (reason_confidence between 0 and 1),
  reason_priority_claim boolean,
  reason_card_id text, internal_provenance text, decided_action text,
  primary key (participant_key, task_index, message_id),
  foreign key (participant_key, participant_id) references public.study_participants(participant_key, participant_id)
);
create index chat_messages_slot_idx on public.chat_messages(participant_id);
create index chat_messages_transcript_idx on public.chat_messages(participant_key, task_index, created_at, message_id);

-- The caller is the server only. No anonymous or Supabase Auth table policies.
alter table public.assignment_slots enable row level security;
alter table public.study_participants enable row level security;
alter table public.self_reports enable row level security;
alter table public.task_metrics enable row level security;
alter table public.chat_messages enable row level security;
revoke all on public.assignment_slots, public.study_participants, public.self_reports,
  public.task_metrics, public.chat_messages from public, anon, authenticated;
grant select, insert, update on public.assignment_slots, public.study_participants,
  public.self_reports, public.task_metrics, public.chat_messages to service_role;

create function public.guard_study_participant() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare s public.assignment_slots;
begin
  if tg_op = 'INSERT' then
    select * into strict s from public.assignment_slots where participant_id = new.participant_id;
    new.proxy_policy := s.proxy_policy; new.task_order := s.task_order;
    new.mode_order := s.mode_order; new.role := s.role;
  else
    if row(new.participant_key, new.participant_id, new.proxy_policy, new.task_order,
      new.mode_order, new.role, new.prolific_pid, new.study_id, new.session_id,
      new.assigned_at, new.expires_at) is distinct from
      row(old.participant_key, old.participant_id, old.proxy_policy, old.task_order,
      old.mode_order, old.role, old.prolific_pid, old.study_id, old.session_id,
      old.assigned_at, old.expires_at) then
      raise exception 'Participation identity and assignment are immutable' using errcode = '23514';
    end if;
    if old.status <> 'active' and not (old.status = 'stopped' and new.status = 'expired' and old.expires_at <= now()) then
      raise exception 'Participation attempt is closed' using errcode = '55000';
    end if;
    if new.status not in ('expired', 'stopped') and old.expires_at <= now() then
      raise exception 'Participation attempt expired' using errcode = '55000';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger guard_study_participant before insert or update on public.study_participants
  for each row execute function public.guard_study_participant();

-- Lock the attempt before every child write. Reclaim/complete need this same
-- row lock, so an authorized-but-delayed HTTP request cannot write after reuse.
create function public.guard_study_analysis_write() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare p public.study_participants;
begin
  if tg_op = 'UPDATE' and row(new.participant_key, new.task_index) is distinct from
    row(old.participant_key, old.task_index) then
    raise exception 'Analysis record identity is immutable' using errcode = '23514';
  end if;
  select * into strict p from public.study_participants
    where participant_key = new.participant_key for update;
  if p.status <> 'active' or p.expires_at <= now() or not exists (
    select 1 from public.assignment_slots where participant_id = p.participant_id
      and current_participant_key = p.participant_key and assigned and not completed
  ) then
    raise exception 'Participation attempt is no longer writable' using errcode = '55000';
  end if;
  new.participant_id := p.participant_id;
  new.proxy_policy := p.proxy_policy; new.task_order := p.task_order;
  new.mode_order := p.mode_order; new.role := p.role;
  new.task_id := case when (new.task_index = 1) = (p.task_order = 'taskA_first') then 'task_a' else 'task_b' end;
  new.task_mode := case when (new.task_index = 1) = (p.mode_order = 'proxyFirst') then 'proxy' else 'direct' end;
  if tg_table_name <> 'chat_messages' then new.updated_at := now(); end if;
  return new;
end;
$$;
create trigger guard_self_reports before insert or update on public.self_reports
  for each row execute function public.guard_study_analysis_write();
create trigger guard_task_metrics before insert or update on public.task_metrics
  for each row execute function public.guard_study_analysis_write();
create trigger guard_chat_messages before insert or update on public.chat_messages
  for each row execute function public.guard_study_analysis_write();

-- Counts refer to stored full messages and explicit turn IDs, not rendered || bubbles.
create function public.refresh_chat_metrics() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.task_metrics (participant_key, task_index)
    values (new.participant_key, new.task_index) on conflict do nothing;
  update public.task_metrics m set
    message_count = a.message_count, participant_message_count = a.participant_message_count,
    counterpart_message_count = a.counterpart_message_count, proxy_message_count = a.proxy_message_count,
    human_message_count = a.human_message_count, human_turn_count = a.human_turn_count,
    proxy_turn_count = a.proxy_turn_count, wr_count = a.wr_count, sb_count = a.sb_count,
    first_message_at = a.first_message_at, last_message_at = a.last_message_at,
    first_wr_at = a.first_wr_at, first_sb_at = a.first_sb_at,
    participant_first_wr_at = a.participant_first_wr_at, participant_first_sb_at = a.participant_first_sb_at,
    message_span_ms = (extract(epoch from a.last_message_at - a.first_message_at) * 1000)::bigint,
    human_message_span_ms = (extract(epoch from a.human_ended_at - a.human_started_at) * 1000)::bigint,
    proxy_message_span_ms = (extract(epoch from a.proxy_ended_at - a.proxy_started_at) * 1000)::bigint
  from (
    select count(*)::integer as message_count,
      count(*) filter (where speaker in ('participant', 'participant_proxy'))::integer as participant_message_count,
      count(*) filter (where speaker in ('counterpart', 'counterpart_proxy', 'counterpart_principal'))::integer as counterpart_message_count,
      count(*) filter (where phase = 'proxy_exchange')::integer as proxy_message_count,
      count(*) filter (where phase = 'human_negotiation')::integer as human_message_count,
      count(distinct turn_id) filter (where phase = 'human_negotiation')::integer as human_turn_count,
      count(distinct turn_id) filter (where phase = 'proxy_exchange')::integer as proxy_turn_count,
      count(*) filter (where reason_label = 'WR')::integer as wr_count,
      count(*) filter (where reason_label = 'SB')::integer as sb_count,
      min(created_at) as first_message_at, max(created_at) as last_message_at,
      min(created_at) filter (where reason_label = 'WR') as first_wr_at,
      min(created_at) filter (where reason_label = 'SB') as first_sb_at,
      min(created_at) filter (where reason_label = 'WR' and speaker in ('participant', 'participant_proxy')) as participant_first_wr_at,
      min(created_at) filter (where reason_label = 'SB' and speaker in ('participant', 'participant_proxy')) as participant_first_sb_at,
      min(created_at) filter (where phase = 'human_negotiation') as human_started_at,
      max(created_at) filter (where phase = 'human_negotiation') as human_ended_at,
      min(created_at) filter (where phase = 'proxy_exchange') as proxy_started_at,
      max(created_at) filter (where phase = 'proxy_exchange') as proxy_ended_at
    from public.chat_messages where participant_key = new.participant_key and task_index = new.task_index
  ) a where m.participant_key = new.participant_key and m.task_index = new.task_index;
  return new;
end;
$$;
create trigger refresh_chat_metrics after insert or update on public.chat_messages
  for each row execute function public.refresh_chat_metrics();

create function public.claim_study_assignment(
  p_prolific_pid text, p_study_id text, p_session_id text, p_participant_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.study_participants; s public.assignment_slots; expired_attempt record;
begin
  if p_participant_key is null or p_prolific_pid is null or p_study_id is null or p_session_id is null
    or length(btrim(p_prolific_pid)) not between 1 and 255
    or length(btrim(p_study_id)) not between 1 and 255
    or length(btrim(p_session_id)) not between 1 and 255 then
    raise exception 'Valid Prolific identity and server attempt UUID are required' using errcode = '22023';
  end if;
  -- Tiny 180-slot registry: serialize only claim/finalize, not normal writes.
  perform pg_advisory_xact_lock(7272026, 180);
  for expired_attempt in
    select participant_key, participant_id from public.study_participants
      where status in ('active', 'stopped') and expires_at <= now() order by participant_key for update
  loop
    update public.study_participants set status = 'expired' where participant_key = expired_attempt.participant_key;
    update public.assignment_slots set assigned = false, completed = false,
      prolific_pid = null, study_id = null, session_id = null, claimed_at = null, current_participant_key = null
      where participant_id = expired_attempt.participant_id and current_participant_key = expired_attempt.participant_key;
  end loop;
  select * into p from public.study_participants
    where prolific_pid = btrim(p_prolific_pid) and study_id = btrim(p_study_id) for update;
  if not found then
    select * into s from public.assignment_slots where not assigned order by participant_id limit 1 for update;
    if not found then return jsonb_build_object('status', 'full'); end if;
    insert into public.study_participants (participant_key, participant_id, prolific_pid, study_id, session_id)
      values (p_participant_key, s.participant_id, btrim(p_prolific_pid), btrim(p_study_id), btrim(p_session_id)) returning * into p;
    update public.assignment_slots set assigned = true, prolific_pid = p.prolific_pid,
      study_id = p.study_id, session_id = p.session_id, claimed_at = p.assigned_at,
      current_participant_key = p.participant_key where participant_id = s.participant_id;
  end if;
  return jsonb_build_object('participant_key', p.participant_key, 'participant_id', p.participant_id,
    'proxy_policy', p.proxy_policy, 'task_order', p.task_order, 'mode_order', p.mode_order,
    'role', p.role, 'status', p.status, 'assigned_at', p.assigned_at, 'expires_at', p.expires_at);
end;
$$;

create function public.complete_study_participation(p_participant_key uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.study_participants; r public.self_reports; task_count integer; proxy_index integer;
begin
  perform pg_advisory_xact_lock(7272026, 180);
  select * into strict p from public.study_participants where participant_key = p_participant_key for update;
  if p.status = 'completed' then return jsonb_build_object('status', 'completed', 'completed_at', p.completed_at); end if;
  if p.status <> 'active' or p.expires_at <= now() then
    raise exception 'Participation attempt is no longer completable' using errcode = '55000';
  end if;
  if not exists (select 1 from public.assignment_slots where participant_id = p.participant_id
    and current_participant_key = p.participant_key and assigned and not completed) then
    raise exception 'Participation slot has changed' using errcode = '55000';
  end if;
  proxy_index := case when p.mode_order = 'proxyFirst' then 1 else 2 end;
  if not (p.operational @> '{"consented":true,"background_submitted":true,"wrap_up_submitted":true,"debriefing_acknowledged":true,"open_t1_submitted":true,"open_t2_submitted":true}'::jsonb)
    or p.bg2 is null or p.bg3 is null or p.bg5 is null or p.bg6 is null or p.bg7 is null
    or p.fts1 is null or p.fts2 is null or p.fts3 is null
    or p.aia1 is null or p.aia2 is null or p.aia3 is null or p.aia4 is null or p.aia5 is null
    or p.rsc1 is null or p.rsc2 is null or p.rsc3 is null or p.rsc4 is null or p.icc1 is null or p.icc2 is null
    or coalesce(btrim(p.icc3), '') = '' or coalesce(btrim(p.oec1), '') = ''
    or coalesce(btrim(p.oed1_t1), '') = '' or coalesce(btrim(p.oee1_t1), '') = ''
    or coalesce(btrim(p.oed1_t2), '') = '' or coalesce(btrim(p.oee1_t2), '') = ''
    or (proxy_index = 1 and coalesce(btrim(p.oep1_t1), '') = '')
    or (proxy_index = 2 and coalesce(btrim(p.oep1_t2), '') = '') then
    raise exception 'Required participant responses are incomplete' using errcode = '23514';
  end if;
  select count(*) into task_count from public.task_metrics where participant_key = p.participant_key
    and status = 'completed' and outcome is not null and agreement is not null;
  if task_count <> 2 then raise exception 'Both task outcomes are required' using errcode = '23514'; end if;
  select count(*) into task_count from public.self_reports where participant_key = p.participant_key;
  if task_count <> 2 then raise exception 'Both task questionnaires are required' using errcode = '23514'; end if;
  for r in select * from public.self_reports where participant_key = p.participant_key loop
    if not r.scales_submitted or not r.decision_submitted
      or r.scf1 is null or r.scf2 is null or r.sce1 is null or r.sce2 is null
      or r.ce1 is null or r.ce2 is null or r.ce3 is null or r.ns1 is null or r.ns2 is null
      or (r.task_mode = 'proxy' and (r.pmp1 is null or r.pmp2 is null or r.pmp3 is null or r.pmp4 is null
        or r.pop1 is null or r.pop2 is null or r.pop3 is null or r.pop4 is null))
      or (p.role = 'leader' and (r.br1 is null or r.br1_percent is null or r.br1_confirmed is distinct from true))
      or (p.role = 'member' and r.fe1 is null) then
      raise exception 'Required task responses are incomplete' using errcode = '23514';
    end if;
  end loop;
  update public.study_participants set status = 'completed', completed_at = now()
    where participant_key = p.participant_key returning * into p;
  update public.assignment_slots set completed = true
    where participant_id = p.participant_id and current_participant_key = p.participant_key;
  return jsonb_build_object('status', 'completed', 'completed_at', p.completed_at);
end;
$$;

-- Scope grants to these functions; do not alter unrelated project defaults.
revoke all on function public.guard_study_participant(), public.guard_study_analysis_write(),
  public.refresh_chat_metrics(), public.claim_study_assignment(text, text, text, uuid),
  public.complete_study_participation(uuid) from public, anon, authenticated;
grant execute on function public.guard_study_participant(), public.guard_study_analysis_write(),
  public.refresh_chat_metrics(), public.claim_study_assignment(text, text, text, uuid),
  public.complete_study_participation(uuid) to service_role;

comment on table public.assignment_slots is '180 balanced reusable slots; participant_id identifies the slot, participant_key identifies an immutable attempt.';
comment on table public.study_participants is 'One immutable attempt per Prolific PID + study ID. Expired attempts and their responses are retained.';
comment on table public.self_reports is 'Task-level coded scale/role-decision columns; NULL means not asked or not yet answered, never zero.';
comment on table public.task_metrics is 'Task outcomes and transcript aggregates. duration_ms uses negotiation event times; message_span_ms is the separate first-to-last message span.';
comment on table public.chat_messages is 'One original full message per row, with phase and explicit turn_id; visual bubble splits do not create turns.';
