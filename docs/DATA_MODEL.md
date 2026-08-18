# Data model (planned)

Not yet implemented. `lib/store.ts` is a localStorage stand-in behind an
interface shaped like these tables — implementing `SupabaseStore` against this
schema should require no page changes.

## Principles

- **Pseudonymous keys.** `participant_key` is the join key everywhere.
  `prolific_pid` lives in one table and is never exported with responses
  (Methods §Data logging).
- **Server-authoritative writes.** Assignment claims, event logs, and
  transcripts go through `/api/*` routes with the service role key. The browser
  gets an anon key with RLS that denies direct table writes.
- **Provenance stays server-side.** `internal_provenance` is written but never
  returned to a participant-facing client.

## Tables

### `assignment_slots`

Pre-seeded before recruitment. One row per planned participant. Seed with
`buildSlotBlock()` from `lib/assignment.ts`, repeated to the target N — 16 rows
per block (2 policies × 2 roles × 4 sequences), 120 participants ≈ 8 blocks.

```sql
create table assignment_slots (
  id              bigserial primary key,
  slot_index      integer not null unique,
  proxy_policy    text    not null check (proxy_policy in ('delegate','explorer')),
  role            text    not null check (role in ('leader','member')),
  sequence_id     text    not null check (sequence_id in ('seq1','seq2','seq3','seq4')),
  claimed         boolean not null default false,
  participant_key text    unique,
  claimed_at      timestamptz
);

create index on assignment_slots (claimed, slot_index);
```

Atomic claim — the important part. `SKIP LOCKED` is what prevents two
simultaneous participants from taking the same row:

```sql
create or replace function claim_assignment_slot(p_key text)
returns assignment_slots
language plpgsql
as $$
declare
  existing assignment_slots;
  claimed  assignment_slots;
begin
  -- Idempotent: a refresh must not reassign.
  select * into existing from assignment_slots where participant_key = p_key;
  if found then
    return existing;
  end if;

  update assignment_slots
     set claimed = true, participant_key = p_key, claimed_at = now()
   where id = (
     select id from assignment_slots
      where claimed = false
      order by slot_index
      limit 1
      for update skip locked
   )
  returning * into claimed;

  if not found then
    raise exception 'assignment pool exhausted';
  end if;

  return claimed;
end;
$$;
```

`/api/assign` should return 409 on pool exhaustion so the study can be closed
cleanly rather than silently over-recruiting.

### `participants`

```sql
create table participants (
  participant_key text primary key,
  prolific_pid    text unique,       -- keep out of research exports
  study_id        text,
  session_id      text,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz,
  withdrew_data   boolean not null default false
);
```

`withdrew_data` is set from the debriefing page. Exclude these rows from
analysis; do not delete, so the count is auditable.

### `events`

Append-only log backing the timestamp and latency measures.

```sql
create table events (
  id               bigserial primary key,
  participant_key  text not null references participants,
  type             text not null,
  page             text,
  session_index    smallint,
  payload          jsonb,
  client_timestamp timestamptz,
  server_timestamp timestamptz not null default now()
);

create index on events (participant_key, server_timestamp);
```

Keep both timestamps: client for participant-perceived latency, server as the
tamper-resistant record.

### `responses`

One row per block per participant. Blocks: `background`, `survey`,
`manipulation_check`, `reward_decision`, `debriefing`, `instruction_check`,
`private_target_s{1,2}`, `post_task_s{1,2}`, `session_outcome_s{1,2}`.

`private_target_s{n}` holds the focal level the participant privately judged
sufficient plus the two pre-task jeopardy items, and it is written before the
session's condition is visible — the first point on the trajectory in Methods
ver.1.8 §Primary outcome 1.

`session_outcome_s{n}` carries the ratification choice, the Leader's
structured focal response (Requirement Uptake), and the coded focal level of
the final package. The last two are stored separately on purpose: a package
that broke the threshold and was then rejected is still coded as preserved.

```sql
create table responses (
  participant_key text not null references participants,
  block           text not null,
  data            jsonb not null,
  updated_at      timestamptz not null default now(),
  primary key (participant_key, block)
);
```

### `mandates`

```sql
create table mandates (
  participant_key    text not null references participants,
  session_index      smallint not null,
  -- IssueMandate[]: per term, { preferred, acceptable_floor, hard_boundary }
  issues             jsonb not null,
  -- { reason_card_id: 'sayable' | 'private' } — the disclosure measure
  reason_permissions jsonb not null,
  conditional_trade  boolean not null default true,
  revision_count     integer not null default 0,
  created_at         timestamptz not null default now(),
  primary key (participant_key, session_index)
);
```

Two behavioural codes come straight out of this table. `MANDATE` is whether
the hard boundary on the focal term preserves the participant's private
target; the disclosure measure is which reason cards they marked sayable. Both
are participant choices, not failures — a participant who entrusted no
boundary has `MANDATE = 0`, which is data (Methods ver.1.8 §Missingness).

Store each revision as a separate `events` row so mandate revision behavior is
recoverable.

### `messages`

```sql
create table messages (
  id                  bigserial primary key,
  participant_key     text not null references participants,
  session_index       smallint not null,
  turn_index          integer not null,
  stage               smallint,       -- 1..5, the controlled interaction stage
  speaker             text not null,
  text                text not null,
  proposal            jsonb,          -- the package on the table, if any
  rationale_frame     text,           -- Appendix B4; 'common_practice' = Explorer only
  reason_source_id    text,           -- which reason card the rationale used
  structured_action   jsonb,          -- NegotiationAction
  internal_provenance text,           -- 'principal_mandate' | 'agent_option'
  validator_result    jsonb,
  created_at          timestamptz not null default now()
);

create index on messages (participant_key, session_index, turn_index);
```

`internal_provenance`, `structured_action`, `rationale_frame` and
`reason_source_id` are audit fields. Never select them into a
participant-facing response — the Explorer condition is defined by the
participant being unable to tell an explored option from an authorized one, so
a leak here is not a privacy bug but a destroyed manipulation.

`stage` and `proposal` are what make the trajectory recoverable: the focal
level at stage 1 is opening advocacy, at stage 4 is retention after the
standardized challenge, and at stage 5 is the final package.

### `guardrail_events`

Every validator block and regeneration (Methods §Guardrail and validation).
Needed for the fidelity measures — notably false personal-fact fabrication,
whose target value is 0.

```sql
create table guardrail_events (
  id              bigserial primary key,
  participant_key text not null references participants,
  session_index   smallint not null,
  turn_index      integer,
  violation_code  text not null,
  detail          text,
  disposition     text not null,   -- accept | regenerate | mark_unresolved
  created_at      timestamptz not null default now()
);
```

### `agreements`

```sql
create table agreements (
  participant_key      text not null references participants,
  session_index        smallint not null,
  terms                jsonb not null,   -- AgreementTerm[]
  unresolved_issue_ids text[] not null default '{}',
  ratification_choice  text,             -- ratify | request_revision | reject
  edited_terms         jsonb,
  revision_note        text,
  decided_at           timestamptz,
  primary key (participant_key, session_index)
);
```

## RLS sketch

```sql
alter table participants     enable row level security;
alter table events           enable row level security;
alter table responses        enable row level security;
alter table mandates         enable row level security;
alter table messages         enable row level security;
alter table agreements       enable row level security;
alter table assignment_slots enable row level security;
alter table guardrail_events enable row level security;
```

No policies for the anon role — all writes go through server routes using the
service role key. This is the least-privilege posture Methods §Data logging
calls for, and it also prevents a participant from inspecting network responses
to infer their condition.

## Export

Join on `participant_key`, excluding `participants.prolific_pid`. One row per
participant-session for the LMM, carrying `condition`, `role`, `task`,
`session_order`, and the three z-scored covariates.
