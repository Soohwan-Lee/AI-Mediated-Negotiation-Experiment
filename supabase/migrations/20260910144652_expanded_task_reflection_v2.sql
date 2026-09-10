-- Additive instrument revision. Existing rows and old-client responses remain
-- on their original completion contract; no analysis or assignment is reset.
alter table public.self_reports
  add column oei1 text, add column oef1 text, add column oen1 text,
  add column oer1 text, add column oep2 text, add column oep3 text,
  add column oep4 text, add column oec1 text,
  add column open_instrument_version text;

comment on column public.self_reports.open_instrument_version is
  'Task reflection instrument: 2.27-open-v2 for expanded questions; NULL or 2.27 uses legacy requirements.';
comment on column public.self_reports.oec1 is
  'Required comparison on Task 2 for 2.27-open-v2, mirrored to the historical participant field.';

create or replace function public.guard_study_analysis_write() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare p public.study_participants;
begin
  if tg_table_name = 'self_reports' and tg_op = 'UPDATE' then
    if old.open_instrument_version = '2.27-open-v2'
      and new.open_instrument_version is distinct from '2.27-open-v2' then
      raise exception 'Task reflection instrument cannot be downgraded' using errcode = '23514';
    end if;
  end if;
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
  new.task_mode := case when (new.task_index = 1) = (p.mode_order = 'proxyFirst') then p.proxy_policy else 'direct' end;
  if tg_table_name <> 'chat_messages' then new.updated_at := now(); end if;
  return new;
end;
$$;

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
    or coalesce(btrim(p.icc3), '') = '' then
    raise exception 'Required participant responses are incomplete' using errcode = '23514';
  end if;
  select count(*) into task_count from public.task_metrics where participant_key = p.participant_key
    and status = 'completed' and outcome is not null and agreement is not null;
  if task_count <> 2 then raise exception 'Both task outcomes are required' using errcode = '23514'; end if;
  select count(*) into task_count from public.self_reports where participant_key = p.participant_key;
  if task_count <> 2 then raise exception 'Both task questionnaires are required' using errcode = '23514'; end if;
  for r in select * from public.self_reports where participant_key = p.participant_key loop
    if r.open_instrument_version = '2.27-open-v2' and (
      coalesce(btrim(r.oei1), '') = '' or coalesce(btrim(r.oef1), '') = ''
      or coalesce(btrim(r.oen1), '') = '' or coalesce(btrim(r.oer1), '') = ''
      or (r.task_mode in ('user_specified', 'ai_supplemented') and (
        coalesce(btrim(r.oep2), '') = '' or coalesce(btrim(r.oep3), '') = '' or coalesce(btrim(r.oep4), '') = ''))
      or (r.task_index = 2 and coalesce(btrim(r.oec1), '') = '')
    ) then raise exception 'Required expanded task responses are incomplete' using errcode = '23514'; end if;
    if r.task_index = 2 and r.open_instrument_version is distinct from '2.27-open-v2'
      and coalesce(btrim(p.oec1), '') = '' then
      raise exception 'Required legacy comparison is incomplete' using errcode = '23514';
    end if;
    if not r.scales_submitted or not r.decision_submitted or not r.open_submitted
      or coalesce(btrim(r.oed1), '') = '' or coalesce(btrim(r.oee1), '') = ''
      or (r.task_mode in ('user_specified', 'ai_supplemented') and coalesce(btrim(r.oep1), '') = '')
      or r.scf1 is null or r.scf2 is null or r.sce1 is null or r.sce2 is null
      or r.ce1 is null or r.ce2 is null or r.ce3 is null or r.ns1 is null or r.ns2 is null
      or (r.task_mode in ('user_specified', 'ai_supplemented') and (r.pmp1 is null or r.pmp2 is null or r.pmp3 is null or r.pmp4 is null
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
