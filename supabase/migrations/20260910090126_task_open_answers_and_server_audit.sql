-- Canonical task-specific qualitative answers live beside their task metadata.
-- Historical participant-wide columns remain available, but receive no new writes.
alter table public.self_reports
  add column oed1 text, add column oee1 text, add column oep1 text,
  add column oet1 text, add column open_submitted boolean not null default false;
alter table public.task_metrics add column server_audit jsonb not null default '{}'::jsonb;

-- Backfill also closed historical attempts. Only this migration bypasses the
-- active-attempt write guard, under the transaction's ALTER TABLE lock.
alter table public.self_reports disable trigger guard_self_reports;
insert into public.self_reports (participant_key, participant_id, proxy_policy, task_order,
  mode_order, role, task_index, task_id, task_mode, oed1, oee1, oep1, open_submitted, responses)
select p.participant_key, p.participant_id, p.proxy_policy, p.task_order, p.mode_order, p.role, i::smallint,
  case when (i = 1) = (p.task_order = 'taskA_first') then 'task_a' else 'task_b' end,
  case when (i = 1) = (p.mode_order = 'proxyFirst') then 'proxy' else 'direct' end,
  case when i = 1 then p.oed1_t1 else p.oed1_t2 end,
  case when i = 1 then p.oee1_t1 else p.oee1_t2 end,
  case when i = 1 then p.oep1_t1 else p.oep1_t2 end,
  p.operational @> jsonb_build_object('open_t' || i || '_submitted', true),
  jsonb_build_object('v226_task_open_t' || i,
    jsonb_strip_nulls(jsonb_build_object(
      'OED1_t' || i, case when i = 1 then p.oed1_t1 else p.oed1_t2 end,
      'OEE1_t' || i, case when i = 1 then p.oee1_t1 else p.oee1_t2 end,
      'OEP1_t' || i, case when i = 1 then p.oep1_t1 else p.oep1_t2 end,
      '_completed', p.operational @> jsonb_build_object('open_t' || i || '_submitted', true)))
    || coalesce(p.open_answers -> ('v226_task_open_t' || i), '{}'::jsonb))
from public.study_participants p cross join generate_series(1, 2) i
where p.open_answers ? ('v226_task_open_t' || i)
  or (i = 1 and num_nonnulls(p.oed1_t1, p.oee1_t1, p.oep1_t1) > 0)
  or (i = 2 and num_nonnulls(p.oed1_t2, p.oee1_t2, p.oep1_t2) > 0)
on conflict (participant_key, task_index) do update set
  oed1 = coalesce(self_reports.oed1, excluded.oed1),
  oee1 = coalesce(self_reports.oee1, excluded.oee1),
  oep1 = coalesce(self_reports.oep1, excluded.oep1),
  open_submitted = self_reports.open_submitted or excluded.open_submitted,
  responses = excluded.responses || self_reports.responses;
alter table public.self_reports enable trigger guard_self_reports;

-- Server-only model/classifier attempts, correlated with a stable message ID.
-- Each retry appends an entry atomically; it never replaces an earlier attempt.
create function public.merge_task_audit(p_participant_key uuid, p_task_index smallint,
  p_audit_key text, p_details jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_task_index is null or p_task_index not in (1, 2)
    or p_audit_key is null or length(p_audit_key) not between 1 and 255
    or p_details is null or jsonb_typeof(p_details) <> 'object' then
    raise exception 'Invalid server audit entry' using errcode = '22023';
  end if;
  insert into public.task_metrics (participant_key, task_index, server_audit)
    values (p_participant_key, p_task_index, jsonb_build_object(p_audit_key, jsonb_build_array(p_details)))
  on conflict (participant_key, task_index) do update set server_audit = jsonb_set(
    task_metrics.server_audit, array[p_audit_key],
    coalesce(task_metrics.server_audit -> p_audit_key, '[]'::jsonb) || jsonb_build_array(p_details), true);
end;
$$;
revoke all on function public.merge_task_audit(uuid, smallint, text, jsonb) from public, anon, authenticated;
grant execute on function public.merge_task_audit(uuid, smallint, text, jsonb) to service_role;

create or replace function public.complete_study_participation(p_participant_key uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.study_participants; r public.self_reports; task_count integer;
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
  if not (p.operational @> '{"consented":true,"background_submitted":true,"wrap_up_submitted":true,"debriefing_acknowledged":true}'::jsonb)
    or p.bg2 is null or p.bg3 is null or p.bg5 is null or p.bg6 is null or p.bg7 is null
    or p.fts1 is null or p.fts2 is null or p.fts3 is null
    or p.aia1 is null or p.aia2 is null or p.aia3 is null or p.aia4 is null or p.aia5 is null
    or p.rsc1 is null or p.rsc2 is null or p.rsc3 is null or p.rsc4 is null or p.icc1 is null or p.icc2 is null
    or coalesce(btrim(p.icc3), '') = '' or coalesce(btrim(p.oec1), '') = '' then
    raise exception 'Required participant responses are incomplete' using errcode = '23514';
  end if;
  select count(*) into task_count from public.task_metrics where participant_key = p.participant_key
    and status = 'completed' and outcome is not null and agreement is not null;
  if task_count <> 2 then raise exception 'Both task outcomes are required' using errcode = '23514'; end if;
  select count(*) into task_count from public.self_reports where participant_key = p.participant_key;
  if task_count <> 2 then raise exception 'Both task questionnaires are required' using errcode = '23514'; end if;
  for r in select * from public.self_reports where participant_key = p.participant_key loop
    if not r.scales_submitted or not r.decision_submitted or not r.open_submitted
      or coalesce(btrim(r.oed1), '') = '' or coalesce(btrim(r.oee1), '') = ''
      or (r.task_mode = 'proxy' and coalesce(btrim(r.oep1), '') = '')
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
comment on column public.self_reports.oet1 is 'Optional final task comment; never required for completion.';
comment on column public.task_metrics.server_audit is 'Server-only audit keyed by kind:messageId, arrays retain all model/classifier attempts. Never sent to participant clients.';
