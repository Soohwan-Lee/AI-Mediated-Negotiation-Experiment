alter table public.study_participants
  add column bg8 text,
  add column bg9 text;

comment on column public.study_participants.bg8 is
  'Optional race or ethnicity category (BG8). NULL when skipped.';
comment on column public.study_participants.bg9 is
  'Optional current country of residence (BG9). NULL when skipped.';
