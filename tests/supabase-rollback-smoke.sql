-- Run only against the reviewed five-table schema. All test data rolls back.
begin;
set local role service_role;
do $$
declare a jsonb; b jsonb; replacement jsonb; expired_key uuid := gen_random_uuid();
  stopped_key uuid := gen_random_uuid(); caught boolean; n integer; m record;
begin
  perform pg_advisory_xact_lock(7272026, 180);
  if exists (select 1 from public.study_participants)
    or exists (select 1 from public.assignment_slots where assigned or completed) then
    raise exception 'Smoke refused: existing participant data or occupied slots';
  end if;
  a := public.claim_study_assignment('rollback-a', 'rollback-study', 'rollback-session', gen_random_uuid());
  b := public.claim_study_assignment('rollback-a', 'rollback-study', 'rollback-session', gen_random_uuid());
  if a->>'participant_key' <> b->>'participant_key' then raise exception 'Duplicate identity claimed twice'; end if;
  caught := false;
  begin perform public.complete_study_participation((a->>'participant_key')::uuid);
  exception when check_violation then caught := true; end;
  if not caught then raise exception 'Incomplete attempt completed'; end if;

  insert into public.chat_messages(participant_key,task_index,message_id,phase,turn_id,speaker,text,created_at,reason_label)
    values ((a->>'participant_key')::uuid,1,'m1','proxy_exchange','turn1','participant_proxy','One reason. || Two bubbles.',now(),'WR');
  insert into public.chat_messages(participant_key,task_index,message_id,phase,turn_id,speaker,text,created_at,reason_label)
    values ((a->>'participant_key')::uuid,1,'m1','proxy_exchange','turn1','participant_proxy','One reason. || Two bubbles.',now(),'WR')
    on conflict(participant_key,task_index,message_id) do update set text=excluded.text;
  select * into m from public.task_metrics where participant_key=(a->>'participant_key')::uuid and task_index=1;
  if m.message_count <> 1 or m.proxy_turn_count <> 1 or m.wr_count <> 1 then raise exception 'Retry/bubble counted as another turn'; end if;
  if m.task_mode <> 'user_specified' then raise exception 'Proxy task mode is not the exact assigned condition'; end if;
  perform public.merge_task_audit((a->>'participant_key')::uuid,1::smallint,'classifier:m1','{"attemptId":"one","offTopic":false}');
  perform public.merge_task_audit((a->>'participant_key')::uuid,1::smallint,'classifier:m1','{"attemptId":"two","offTopic":false}');
  if (select jsonb_array_length(server_audit->'classifier:m1') from public.task_metrics
    where participant_key=(a->>'participant_key')::uuid and task_index=1) <> 2 then
    raise exception 'Audit retry history was overwritten';
  end if;

  insert into public.study_participants(participant_key,participant_id,prolific_pid,study_id,session_id,assigned_at,expires_at,bg2,background_answers)
    values(expired_key,2,'rollback-expired','rollback-study','rollback-session',now()-interval '3 hours',now()-interval '1 hour','woman','{"BG2":"woman"}');
  update public.assignment_slots set assigned=true,current_participant_key=expired_key,claimed_at=now()-interval '3 hours' where participant_id=2;
  replacement := public.claim_study_assignment('rollback-replacement','rollback-study','rollback-session',gen_random_uuid());
  if (replacement->>'participant_id')::integer <> 2 then raise exception 'Expired slot was not reclaimed'; end if;
  if not exists(select 1 from public.study_participants where participant_key=expired_key and participant_id=2 and status='expired' and bg2='woman' and background_answers->>'BG2'='woman') then raise exception 'Historical responses lost'; end if;
  b := public.claim_study_assignment('rollback-expired','rollback-study','rollback-session',gen_random_uuid());
  if b->>'status' <> 'expired' or (b->>'participant_key')::uuid <> expired_key then raise exception 'Expired identity reentered'; end if;
  caught := false;
  begin insert into public.self_reports(participant_key,task_index,scf1) values(expired_key,1,4);
  exception when object_not_in_prerequisite_state then caught := true; end;
  if not caught then raise exception 'Late write accepted'; end if;
  caught := false;
  begin perform public.complete_study_participation(expired_key);
  exception when object_not_in_prerequisite_state then caught := true; end;
  if not caught then raise exception 'Expired attempt completed'; end if;

  insert into public.study_participants(participant_key,participant_id,prolific_pid,study_id,session_id,status,assigned_at,expires_at)
    values(stopped_key,3,'rollback-stopped','rollback-study','rollback-session','stopped',now()-interval '3 hours',now()-interval '1 hour');
  update public.assignment_slots set assigned=true,current_participant_key=stopped_key,claimed_at=now()-interval '3 hours' where participant_id=3;
  replacement := public.claim_study_assignment('rollback-after-stop','rollback-study','rollback-session',gen_random_uuid());
  if (replacement->>'participant_id')::integer <> 3 then raise exception 'Stopped slot was not reclaimed'; end if;

  update public.study_participants set bg2='woman',bg3='full_time',bg5='no',bg6=4,bg7='monthly',fts1=4,fts2=4,fts3=4,
    aia1=4,aia2=4,aia3=4,aia4=4,aia5=4,rsc1=4,rsc2=4,rsc3=4,rsc4=4,icc1=4,icc2=4,icc3='None',oec1='Comparison',
    oed1_t1='Reason',oee1_t1='Impression',oep1_t1='Proxy',oed1_t2='Reason',oee1_t2='Impression',
    operational='{"consented":true,"background_submitted":true,"wrap_up_submitted":true,"debriefing_acknowledged":true,"open_t1_submitted":true,"open_t2_submitted":true}'
    where participant_key=(a->>'participant_key')::uuid;
  for n in 1..2 loop
    insert into public.task_metrics(participant_key,task_index,status,outcome,agreement)
      values((a->>'participant_key')::uuid,n,'completed','{"outcome":"no_agreement"}','{"terms":[],"unresolvedIssueIds":["a","b"]}')
      on conflict(participant_key,task_index) do update set status=excluded.status,outcome=excluded.outcome,agreement=excluded.agreement;
    insert into public.self_reports(participant_key,task_index,scf1,scf2,sce1,sce2,ce1,ce2,ce3,ns1,ns2,fe1,
      pmp1,pmp2,pmp3,pmp4,pop1,pop2,pop3,pop4,scales_submitted,decision_submitted,oed1,oee1,oep1,open_submitted)
      values((a->>'participant_key')::uuid,n,4,4,4,4,4,4,4,4,4,4,
        case when n=1 then 4 end,case when n=1 then 4 end,case when n=1 then 4 end,case when n=1 then 4 end,
        case when n=1 then 4 end,case when n=1 then 4 end,case when n=1 then 4 end,case when n=1 then 4 end,true,true,'Reason','Impression','Proxy',true);
  end loop;
  b := public.complete_study_participation((a->>'participant_key')::uuid);
  if exists (select 1 from public.self_reports where participant_key=(a->>'participant_key')::uuid
    and task_mode <> case when task_index=1 then 'user_specified' else 'direct' end) then
    raise exception 'Task experience mode mismatch';
  end if;
  if b->>'status' <> 'completed' then raise exception 'Complete attempt refused'; end if;
  if public.complete_study_participation((a->>'participant_key')::uuid) <> b then raise exception 'Completion is not idempotent'; end if;
end;
$$;
rollback;
select 'rollback smoke passed' as result,
  (select count(*) from public.assignment_slots) as slots,
  (select count(*) from public.assignment_slots where assigned or completed) as occupied,
  (select count(*) from public.study_participants) as attempts,
  (select count(*) from public.self_reports) as reports,
  (select count(*) from public.task_metrics) as metrics,
  (select count(*) from public.chat_messages) as messages;
