-- Add one balanced 16-cell block plus four balanced cells. Existing slots and
-- assignment state remain untouched.
alter table public.assignment_slots
  drop constraint assignment_slots_participant_id_check;
alter table public.assignment_slots
  add constraint assignment_slots_participant_id_check
  check (participant_id between 1 and 200);

with permutation as (
  select array[0,3,5,6,9,10,12,15,1,2,4,7,8,11,13,14] as cells,
    array[1,6,10,13] as balanced_tail
), allocation as (
  select n, case when n <= 196 then cells[n - 180]
    else balanced_tail[n - 196] end as cell
  from generate_series(181, 200) n cross join permutation
)
insert into public.assignment_slots (participant_id, proxy_policy, task_order, mode_order, role)
select n,
  case when (cell & 8) = 0 then 'user_specified' else 'ai_supplemented' end,
  case when (cell & 4) = 0 then 'taskA_first' else 'taskB_first' end,
  case when (cell & 2) = 0 then 'proxyFirst' else 'directFirst' end,
  case when (cell & 1) = 0 then 'member' else 'leader' end
from allocation order by n;

comment on table public.assignment_slots is
  '200 balanced reusable slots; participant_id identifies the slot, participant_key identifies an immutable attempt.';

-- New attempts receive three hours. Existing attempts keep their stored expiry.
alter table public.study_participants
  alter column expires_at set default (now() + interval '3 hours');

-- PostgREST upserts carry a read/merge/write responses snapshot. A delayed
-- draft must not replace a block that the database has already confirmed.
-- Explicit final re-submissions remain allowed and are intentionally last-write.
create function public.protect_submitted_self_report_blocks() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  scales_key text := 'v226_post_task_scales_t' || old.task_index;
  decision_key text := 'v226_task_decision_t' || old.task_index;
  open_key text := 'v226_task_open_t' || old.task_index;
begin
  new.scales_submitted := old.scales_submitted or new.scales_submitted;
  new.decision_submitted := old.decision_submitted or new.decision_submitted;
  new.open_submitted := old.open_submitted or new.open_submitted;

  if old.scales_submitted and not coalesce(
    ((new.responses -> scales_key) -> '_submitted') = 'true'::jsonb, false
  ) then
    new.scf1 := old.scf1; new.scf2 := old.scf2;
    new.sce1 := old.sce1; new.sce2 := old.sce2;
    new.ce1 := old.ce1; new.ce2 := old.ce2; new.ce3 := old.ce3;
    new.ns1 := old.ns1; new.ns2 := old.ns2;
    new.pmp1 := old.pmp1; new.pmp2 := old.pmp2;
    new.pmp3 := old.pmp3; new.pmp4 := old.pmp4;
    new.pop1 := old.pop1; new.pop2 := old.pop2;
    new.pop3 := old.pop3; new.pop4 := old.pop4;
    new.pmp_responsibility_order := old.pmp_responsibility_order;
    new.pop_responsibility_order := old.pop_responsibility_order;
    new.responses := (new.responses - scales_key) || case when old.responses ? scales_key
      then jsonb_build_object(scales_key, old.responses -> scales_key) else '{}'::jsonb end;
  end if;

  if old.decision_submitted and not coalesce(
    ((new.responses -> decision_key) -> '_submitted') = 'true'::jsonb, false
  ) then
    new.fe1 := old.fe1;
    new.br1 := old.br1; new.br1_percent := old.br1_percent;
    new.br1_confirmed := old.br1_confirmed;
    new.responses := (new.responses - decision_key) || case when old.responses ? decision_key
      then jsonb_build_object(decision_key, old.responses -> decision_key) else '{}'::jsonb end;
  end if;

  if old.open_submitted and not coalesce(
    ((new.responses -> open_key) -> '_completed') = 'true'::jsonb, false
  ) then
    new.oed1 := old.oed1; new.oee1 := old.oee1;
    new.oep1 := old.oep1; new.oet1 := old.oet1;
    new.oei1 := old.oei1; new.oef1 := old.oef1;
    new.oen1 := old.oen1; new.oer1 := old.oer1;
    new.oep2 := old.oep2; new.oep3 := old.oep3;
    new.oep4 := old.oep4; new.oep5 := old.oep5;
    new.oec1 := old.oec1;
    new.open_instrument_version := old.open_instrument_version;
    new.responses := (new.responses - open_key) || case when old.responses ? open_key
      then jsonb_build_object(open_key, old.responses -> open_key) else '{}'::jsonb end;
  end if;

  return new;
end;
$$;

-- PostgreSQL runs same-kind triggers alphabetically, after guard_self_reports.
create trigger protect_submitted_self_report_blocks
  before update on public.self_reports for each row
  execute function public.protect_submitted_self_report_blocks();

revoke all on function public.protect_submitted_self_report_blocks()
  from public, anon, authenticated;
grant execute on function public.protect_submitted_self_report_blocks()
  to service_role;

comment on function public.protect_submitted_self_report_blocks() is
  'Preserves confirmed self-report blocks from delayed draft upserts; explicit final re-submissions remain allowed.';
