-- Keep slot-based export access and cover each composite attempt foreign key.
drop index public.self_reports_slot_idx;
drop index public.task_metrics_slot_idx;
drop index public.chat_messages_slot_idx;
create index self_reports_slot_idx on public.self_reports(participant_id, participant_key);
create index task_metrics_slot_idx on public.task_metrics(participant_id, participant_key);
create index chat_messages_slot_idx on public.chat_messages(participant_id, participant_key);
