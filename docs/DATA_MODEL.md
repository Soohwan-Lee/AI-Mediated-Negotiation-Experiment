# Data model (planned)

Not yet implemented. `lib/store.ts` is a localStorage stand-in behind an
interface shaped like these tables — implementing `SupabaseStore` against this
schema should require no page changes.

## Readiness: what the swap actually needs

`lib/store-supabase.ts` now holds a written `SupabaseStore` against this
interface. It is not wired up — `getStore()` still returns the local store and
nothing imports it at runtime — but writing it is how the claim above got
tested rather than assumed. The result: the page components are clean, and
these are the four things that still need doing.

1. **`/api/persist` does not exist yet.** Every read and write in
   `SupabaseStore` posts `{op, payload}` to it. It has to run with the service
   role key and switch on `op`. Reads go through it too, so the anon key never
   needs table access at all.

2. **Writes must not be inferable from the network tab.** This is the reason
   the route is a single opaque endpoint rather than one path per operation. A
   participant who can watch their own traffic can infer their condition from
   it, and knowing the condition is the one thing that invalidates their data.
   Same-shaped requests for every op is the cheapest way to keep that shut.

3. **Several call sites do not await their write, and should not start.**
   `appendMessage` is called from inside a live negotiation; awaiting a round
   trip there is a visible stall between turns. The local store cannot fail, so
   those sites were written with no error branch — correct then, silently lossy
   over a network. `WriteQueue` closes it without touching a call site: writes
   are enqueued synchronously, mirrored to localStorage, and flushed on
   `visibilitychange` via `sendBeacon` (the study ends on a completion screen
   people close at once). Writes a later screen depends on — participant
   creation, assignment, responses, mandate, agreement — go through `settle()`,
   which awaits the drain and logs if it did not land.

   **Retries are event-driven, not budgeted, and that is deliberate.** A drain
   makes one attempt per item and returns at the first failure; nothing is
   dropped and nothing is reordered, because the queue is a transcript and its
   order is data. The next attempt comes from another `push`, the browser's
   `online` event, or the next `settle`. An attempt budget was tried and is the
   wrong shape: once spent while the network was down it could never be
   unspent, so a failing item rotated to the back of the queue stopped every
   later drain dead. `attempts` survives as diagnostics only, and is reset for a
   queue restored from a previous session.

   `settle()` logs and continues rather than throwing. Refusing to advance
   until the server answers turns a dropped connection into a dead end in the
   middle of a 55-minute study, and the write is durable locally either way —
   what must not happen is failing silently. `queue.pending` is readable at the
   end of the study.

4. **`claimSlot` is the one place the local stand-in is not merely a stand-in.**
   `lib/assignment.ts#claimSlot` is deterministic local logic, and the atomic
   claim it stands in for is what keeps the four cells balanced. Replace its
   body with the `claim_assignment_slot` RPC below; `/api/assign` is the only
   caller.

Two gaps in this document were closed while writing that store:
`saveAgreement` had no reader (`loadAgreement` now exists), and
`guardrail_events` was specified here with no interface method able to write to
it — so pilot gate 9's rationale audit had no source. `logGuardrailEvent` now
exists.

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
  task_index    smallint,
  payload          jsonb,
  client_timestamp timestamptz,
  server_timestamp timestamptz not null default now()
);

create index on events (participant_key, server_timestamp);
```

Keep both timestamps: client for participant-perceived latency, server as the
tamper-resistant record.

### `responses`

One row per block per participant. Blocks: `background`, `instruction_check`,
`practice`, `preferences_t{1,2}`, `risk_t{1,2}`, `post_task_t{1,2}`,
`task_outcome_t{1,2}`, `reward_t{1,2}`, `wrap_up`, `debriefing`.

**Everything measured about a negotiation is scoped `_t1` / `_t2`.** The same
construct measured after two differently conditioned tasks is two observations,
not one, and the within-participant contrast is the whole design — they cannot
share a column.

`preferences_t{n}` holds what the participant wanted and the least they would
take on all three terms, written before anything about the task's condition is
visible. It is the first point on the trajectory (Design §9.3.1).

`risk_t{n}` holds the two RISK items, asked immediately before the negotiation
because they ask what the participant EXPECTS raising their requirement to
cost.

`task_outcome_t{n}` carries `outcome` (`agreement` | `no_agreement`), the
participant's structured response to the OTHER side's requirement, and the
coded level of both requirements in the final package.

There is no ratification choice. Both arms now end with the participant
agreeing a package in conversation, so a screen asking them to approve it
afterwards asked them to re-decide what they had just decided — and gave the
Proxy arm a way to undo an agreement neither counterpart has. `outcome` is
what that column used to carry implicitly.

The uptake response and the preservation code are still stored separately, and
still for the §9.3.1 reason: `ownRequirementPreserved` is coded from the
package regardless of how the participant feels about it.

`reward_t{n}` stores the Leader's `BONUS` slider value, or — for a Member — the
fixed value they were shown. Only the Leader's is data; the Member's is a
stimulus, recorded so the export can show what they were told.

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
  participant_key       text not null references participants,
  task_index            smallint not null,
  -- IssueMandate[]: per term, { preferred, minimum }
  issues                jsonb not null,
  -- Reason card ids the AI Proxy may say. Unchecked cards may inform which
  -- package it chooses and must never appear in its text (Design §7).
  authorized_reason_ids jsonb not null,
  revision_count        integer not null default 0,
  created_at            timestamptz not null default now(),
  primary key (participant_key, task_index)
);
```

`REASON-SCOPE` (Design §9.3.1) comes straight out of `authorized_reason_ids`,
and it is reported as its parts, never as one number: how many cards, whether
any sensitive one, and how far into the situation they went (`incident` →
`undisclosed` → `worry`). "Checked four cards" means something entirely
different depending on which four.

Ticking no sensitive card is a participant choice, not a failure — it is the
specified default and it is the measure.

Store each revision as a separate `events` row so mandate revision behaviour is
recoverable.

### `messages`

```sql
create table messages (
  id                  bigserial primary key,
  participant_key     text not null references participants,
  task_index          smallint not null,
  turn_index          integer not null,
  stage               smallint,       -- 1..5, the fixed progression stage
  speaker             text not null,
  text                text not null,
  proposal            jsonb,          -- the package on the table, if any
  reason_card_id      text,           -- which reason this message voiced
  decided_action      text,           -- what the state machine chose this turn
  structured_action   jsonb,          -- NegotiationAction
  internal_provenance text,           -- 'principal_reason' | 'pool_reason'
  validator_result    jsonb,
  created_at          timestamptz not null default now()
);

create index on messages (participant_key, task_index, turn_index);
```

`internal_provenance`, `structured_action` and `decided_action` are audit
fields. Never select them into a participant-facing response — the Explorer
condition is defined by the participant being unable to tell a pool reason from
one of their own, and OTHER-AI4 asks them to try, so a leak here is not a
privacy bug but a destroyed manipulation.

`decided_action` beside `text` is what pilot gate 9 reads: the pair shows the
model said what the state machine decided and nothing else.

`reason_card_id` is not decoration. The reason-linked acceptance rule (Design
§4) needs a deterministic answer to "has a reason been given for this
requirement", and it is decided from this column rather than by asking a model
to grade an argument. In Baseline it is what the participant attached to the
message; in Proxy it is the card the proxy voiced.

`stage` and `proposal` are what make the trajectory recoverable: the
requirement level at stage 1 is opening advocacy, at stage 4 is retention after
the standardized challenge, and at stage 5 is the final package. A Proxy task
has no participant messages at all, so without this the trajectory would jump
from what was entrusted straight to the final package and the two middle
transitions would not exist for half the design.

### `rehearsal_messages`

The participant questioning their own AI Proxy about the mandate, before it
negotiates. Proxy tasks only.

```sql
create table rehearsal_messages (
  id              bigserial primary key,
  participant_key text not null references participants,
  task_index      smallint not null,
  turn_index      integer not null,
  speaker         text not null check (speaker in ('participant','proxy')),
  text            text not null,
  -- The guardrail replaced the model's wording because it reproduced a reason
  -- card the participant had not authorized. Recorded rather than silently
  -- swapped: the rate is a pilot audit number.
  blocked         boolean not null default false,
  -- How many times the mandate had been edited when this turn was taken, so
  -- "asked, then changed their instructions" is recoverable.
  revision_count  integer not null default 0,
  created_at      timestamptz not null default now()
);

create index on rehearsal_messages (participant_key, task_index, turn_index);
```

**A separate table from `messages`, deliberately.** A rehearsal turn was never
part of a negotiation: no stage, no package, and nothing reached the
counterpart. Per-stage message counts and the message trajectory are reported
measures (§9.3.2), so putting these rows in `messages` would put turns that
were never in an exchange into the transcript the analysis reads.

It is still behavioural data worth having. Whether a participant interrogates a
delegate before trusting it with a socially costly argument — and whether they
revise the mandate afterwards — is the same delegation decision `REASON-SCOPE`
measures, approached from a different side. The turn count also lands in
`events` as `rehearsal_finished`.

### `guardrail_events`

Every validator block and regeneration. Needed for pilot gate 9 (rationale
audit): zero packages, reasons or personal facts outside the rules.

```sql
create table guardrail_events (
  id              bigserial primary key,
  participant_key text not null references participants,
  task_index   smallint not null,
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
  task_index        smallint not null,
  terms                jsonb not null,   -- AgreementTerm[]
  unresolved_issue_ids text[] not null default '{}',
  -- No ratification columns, and no `decided_at`. The participant agrees the
  -- package in the conversation itself; whether one was reached is
  -- `task_outcome_t{n}.outcome` in `responses`, and the terms above are what
  -- they agreed. `decided_at` timestamped the ratification decision and has
  -- no writer now that there is none — `created_at` below is the row's time.
  created_at           timestamptz not null default now(),
  primary key (participant_key, task_index)
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
