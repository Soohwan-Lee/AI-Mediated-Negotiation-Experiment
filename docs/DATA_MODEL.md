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
   later drain dead. No per-item counter is kept at all.

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

**`logGuardrailEvent` STILL HAS NO CALLER, and that is a gap, not dead code.**
The validator's verdict and the proxy's `internalProvenance` are both
computed on every turn in `/api/proxy-negotiation` and both are discarded
there. They cannot be handed to the client to persist the way messages are:
rule 3 of "Things the participant must never learn" forbids the response
carrying the KIND of a reason, and provenance is exactly that kind — a per
message tell for the whole transcript.

So the audit needs a SERVER-side write, which is the one piece of persistence
that does not exist yet. It lands with `/api/persist`: that route holds the
service-role key, and the guardrail write is one more `{op, payload}` on it.
Until then gate 10's guardrail audit and gate 9's rationale audit have no
source outside `npm run simulate`, which returns `guardrailViolations` on
every turn and is currently the only reader.

Do not "clean up" `logGuardrailEvent`, `GuardrailEvent`, or the
`internalProvenance` field to remove the unused-symbol warning. They are the
two ends of a wire whose middle is scheduled, and deleting them would silently
drop a pilot gate.

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
  proxy_policy    text    not null check (proxy_policy in ('user_specified','ai_supplemented')),
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
`practice`, `preferences_t{1,2}`, `risk_t{1,2}`, `m1_t{1,2}` (Proxy only —
Direct answers M1 inside `post_task_t{n}`), `negotiation_t{1,2}`,
`ratify_t{1,2}` (Proxy only), `post_task_t{1,2}`, `task_outcome_t{1,2}`,
`recv_eval_t{1,2}` (Member only), `reward_t{1,2}`, `attr_t{1,2}`, `wrap_up`,
`debriefing`.

**`negotiation_t{n}` is Ver.2.21's addition** and it is written by the
negotiation screen itself, at the moment the exchange ends, in both arms. It
carries what the tier machinery knew that the outcome row does not:

| Key | Meaning |
|---|---|
| `taskId` · `role` · `phase` | which task, which role, and `direct` or the Proxy closing |
| `tier` | the folded `ReasonTier` the exchange settled at — `none` / `work` / `sensitive` |
| `SB_t{n}` | the participant side's first-disclosure choice, duplicated here beside the log that produced it |
| `SB-TIMING_t{n}` | the timing category, same values as the outcome row |
| `priorityClaimed` | did the classifier ever see a bare priority claim (§6.2) |
| `classifierLog` | **JSON string**: every `{text, label, confidence}` the P5 classifier returned, in order |
| `outcome` | **JSON string**: the full `codeOutcome` result |
| `participantPoints` · `jointPoints` | the two scores, flat, so the export can read them without parsing |

Two of those are JSON strings on purpose. `ResponseValue` is deliberately flat —
one row per item id is what makes the export a table — so the two structured
records travel as text and are parsed by the analysis rather than exploding the
schema.

**`classifierLog` is what gate 19's κ is computed against.** Every Direct
transcript is re-coded by hand and the analysis reports κ between the human
codes and this log, plus a sensitivity analysis excluding disagreements. Below
κ = .90 the study switches to Wizard-of-Oz tagging (§13-24). Without this
column there is nothing to compute κ from, so it is not optional storage.

**`ratify_t{n}` holds `RATIFY_t{n}` alone**, written on the RATIFY screen at
the moment the decision is taken (`ratify.tsx`), never inferred later. The
survey route reads it back to decide whether to show CP1–2: those items ask
about the other PERSON, so they are shown in Direct always and in a Proxy task
only when RATIFY was `modified` or `rejected` — an approver never spoke to the
counterpart at all.

`attr_t{n}` is Ver.2.14's addition (§6.8, §9.4.9): after the post-negotiation
decision the counterpart leaves one fixed line, and the participant answers
`ATTR1` (everyone), `ATTR2` (Proxy only) and `OE-ATTR`.

**It is written LAST on that screen, and the ordering is the measure.** The
comment is mildly negative, so showing it before PERC, PCR, PNPQ, PNOQ,
OWN/OTHER-AI or the bonus decision would contaminate every confirmatory answer
in RQ2. The wording is a constant — the only thing that varies is whether it
points at the participant or at their Proxy, and that difference IS the Mode,
which is what makes `ATTR1`'s `Proxy − Direct` contrast a clean test of whether
delegation moves the RECEIPT of an evaluation as well as the speaking of it.

**Everything measured about a negotiation is scoped `_t1` / `_t2`.** The same
construct measured after two differently conditioned tasks is two observations,
not one, and the within-participant contrast is the whole design — they cannot
share a column.

`preferences_t{n}` holds what the participant hoped for on both terms, written
before anything about the task's condition is visible. Ver.2.13 §8.6 reduced it
to that one field per issue: the "least you would take" was a floor the proxy
could not cross, and §2.6 removed it because the counterpart's policy is
decisive — a floor could not change the outcome, only manufacture an impasse
and mix mandate-setting skill into a result meant to turn on disclosure. The
review screen sets the hoped-for package beside what was agreed.

**Ver.2.21 pre-selects the best option on both terms and adds
`WISH-DEV_t{n}`** (§8.6). It is a boolean: did the participant move off the
default. It is an AUDIT FLAG, not a measure — nothing in §9 reports it. Two
things depend on the default. The wish is the proxy's target and its acceptance
line (`proxyAccepts`), so a modest wish changes how far the proxy pushes for
reasons unrelated to disclosure. And REMARK's fixed line presupposes the
participant asked for a lot, which a modest wish makes factually wrong for that
person. §13-25 switches REMARK to demand-free wording if `WISH-DEV` clears 20%
at pilot, which is the only thing this flag is for.

`risk_t{n}` holds the two RISK items, asked immediately before the negotiation
because they ask what the participant EXPECTS raising their requirement to
cost.

`task_outcome_t{n}` carries the participant's structured response to the OTHER
side's requirement, the coded level of both requirements in the final package,
and the four behavioural measures of Ver.2.13 §9.3:

| Key | Meaning |
|---|---|
| `POINTS` · `JOINT` | own total, and both totals summed |
| `SB` | the participant side's SB was out BEFORE the counterpart's fixed disclosure — **RQ1's confirmatory outcome**. Proxy: the mandate checkbox, since a checked card is voiced at the proxy's first reason turn (stage 2, always before the counterpart's stage 4). Direct: the P5 classifier's verdict on the participant's own messages (§6.2a), confirmed against post-hoc human coding |
| `SB-TIMING` | WHEN it came out: `none` / `before_counterpart` / `after_counterpart` (Direct only) / `wrap_up` (Proxy only). **Ver.2.21 changed what category ③ MEANS** — see below |
| `RATIFY` | what the participant decided about the proxies' package (`approved_as_is` / `modified` / `rejected`) — **confirmatory for RQ3**; `null` in Direct, which has nothing to ratify |

**Ver.2.13 cut this from nine measures to four, and the cut is not tidying.**

`UNLOCK`, `CONCEAL-PREMIUM`, `MAX-JOINT` and `outcome` are gone because the
symmetric package rule (§3.3) makes `JOINT` take a value per rung. **Under
Ver.2.21's two-rung ladder that is three values: 2,000 (T1) / 6,000 (T2) / 0
(impasse).** So `JOINT` alone already says which rung was reached, whether the
best package opened (6,000), what concealment cost (the 4,000 gap) and whether
there was an agreement at all (0 = none). Four indicators computed off one
number are four chances for them to disagree with it, not four measures.

**Ver.2.16's fifth value is gone with the branch that produced it.** The
misread package paid 600/1,900 for `JOINT` = 2,500; Ver.2.21 deleted the
misread entirely, because a non-directional work reason gives the counterpart
nothing to sincerely misread. **Ver.2.21 also removed the fallback**: impasse
now pays 0 rather than 600, so every agreement including the unargued one beats
walking away.

**`JOINT` does not separate `none` from `work`, and it no longer separates a
priority claim either.** All three land at 2,000 (§3.3): a non-directional work
reason tells the counterpart both terms matter, which is the same information
as silence for the purpose of deciding where to land, and an unbacked priority
claim is cheap talk the counterpart cannot justify upward. Which of the three a
session was is recovered from `negotiation_t{n}` — `tier` and `priorityClaimed`
for the summary, `classifierLog` for the detail — never from the outcome row.

`PRE-RECIP-SB`, `POST-RECIP-SB`, `MUTUAL-SB`, `SELF-DISCLOSE` and `SB-VOICED`
are gone because they coded ONE nominal event five times. `SB` inherits
PRE-RECIP-SB's definition unchanged; `SB-TIMING` carries the rest as exclusive
categories, and "voiced at all" is categories 2+3+4. Categories 3 and 4 are
structurally exclusive by arm — Direct has no closing stage, and a Proxy
participant's only free speech after the disclosure IS the closing — which
§9.8-5 flags for the χ²'s unit, not for the coding.

**Ver.2.21 changed what category ③ means in Direct, and the old label no longer
describes it.** Under the fixed schedule, `after_counterpart` meant "the
participant disclosed after hearing the counterpart's confession", because that
confession arrived on a schedule no participant could influence. Under
reciprocal disclosure (§6.3) the counterpart discloses only AFTER the
participant does, so in Direct there is no such thing as an SB voiced after
hearing one. **Category ③ now means an SB voiced at a LATER turn than the
participant's first reason opportunity** — later than the LOCK, not later than
the counterpart's confession. Both are "a disclosure that was not the first
move", but they are not the same event and the two cannot be pooled across
versions.

Two consequences for the analysis. Any stored `after_counterpart` from a
pre-Ver.2.21 run means the older thing and must be re-coded from the raw
`classifierLog` and turn order rather than read as-is. And a WR-only Direct
session never hears the counterpart's SB at all (§6.3), so the PCR items about
the other side's disclosure apply only on the path where the participant
disclosed first — a path selected by the primary outcome. §6.3 says explicitly
that this analysis set and the old PRE/POST framing have to be pre-specified
before the study runs.

**RATIFY is back, and it is recorded where the decision is taken.** Ver.2.12
deleted a ratification screen because both arms then ended with the participant
agreeing a package in conversation, so asking "do you accept this?" afterwards
made them re-decide what they had just decided. Ver.2.13 §7 changes the shape:
approving ENDS the task, and the closing conversation is what modify-or-reject
leads to. Reading RATIFY back off the final package — as the deleted
`ratifyOf` did — would code a participant who asked for a change and then
agreed the same package as an approver.

**These belong in the outcome row, not only in `events`.** The event log is an
append-only trace of what happened when; this row is what the export reads per
task. Half of a participant's primary measures living only in the trace would
have to be reconstructed by replaying it — the kind of derivation that goes
wrong quietly, on the measures RQ1 rests on. `POINTS` and `JOINT` are produced
by `codeOutcome` rather than recomputed at the call site, so there is one
definition and the tests pin it.

The uptake response and the preservation code are still stored separately, and
still for the §9.3.1 reason: `ownRequirementPreserved` is coded from the
package regardless of how the participant feels about it.

`reward_t{n}` stores the Leader's `BONUS` slider value. A Member's row carries
`null` there: no bonus decision is made about them and no number is ever shown
to them (deception item 4).

`recv_eval_t{n}` is the Member's half of the §5 decision pair — the upward
evaluation of the manager (judgement / operations / collaboration, plus an
optional comment), written before the wait. They are told it goes to the
district manager; it does not, and `/debriefing` retracts that for both roles.
It is a real behavioural outcome for the Member exactly as `BONUS` is for the
Leader.

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
  -- IssueMandate[]: per term, { preferred }. One field since Ver.2.13 §8.6 —
  -- see `preferences_t{n}` above for why the floor went.
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
  stage               smallint,       -- 1..6, the fixed progression stage
  speaker             text not null,
  text                text not null,
  proposal            jsonb,          -- the package on the table, if any
  reason_card_id      text,           -- Proxy: which card the proxy voiced
  reason_label        text,           -- Direct: P5's verdict, none|WR|SB
  reason_confidence   real,           -- Direct: P5's own confidence, 0-1
  reason_priority_claim boolean,      -- Direct: P5's priority_claim flag
  decided_action      text,           -- what the state machine chose this turn
  structured_action   jsonb,          -- NegotiationAction
  internal_provenance text,           -- 'principal_reason'
  validator_result    jsonb,
  created_at          timestamptz not null default now()
);

create index on messages (participant_key, task_index, turn_index);
```

`internal_provenance`, `structured_action`, `decided_action`, `reason_label`
and `reason_confidence` are audit fields. Never select them into a
participant-facing response — the AI-Supplemented condition is defined by the
participant being unable to tell which of three sentences carries the other
side's own circumstance, and `OTHER-AI2` asks them to try, so a leak there is
not a privacy bug but a destroyed manipulation. `reason_label` leaks in the
other direction: it is the tier the system read off the participant's own
words, and showing it would tell them which things "count".

`decided_action` beside `text` is what pilot gate 9 reads: the pair shows the
model said what the state machine decided and nothing else.

**`reason_card_id` and `reason_label` are the two input channels of §6.2a, and
they are recorded separately because they are different kinds of evidence.**

In the Proxy arm the participant's checkboxes decide which card is voiced, so
`reason_card_id` is a fact about the schedule: no judgement is involved and
nothing can disagree with it.

In Direct and the Proxy closing there are no longer any buttons (Ver.2.20). The
participant simply talks, and a separate single-purpose classifier — P5, which
writes nothing anyone sees and never speaks for either party — reads the
conversation into `none / WR / SB`. That label sets the tier. It is a
MEASUREMENT rather than a record, so its confidence is kept beside it and the
whole Direct transcript is re-coded by hand afterwards: the analysis reports κ
between the two and a sensitivity analysis excluding disagreements. Gate 19
requires κ ≥ .90; below it the study switches to Wizard-of-Oz tagging (§13-24).

**Ver.2.21 dropped `PRI` from the label set and made the judgement CUMULATIVE.**
A bare priority claim now travels as `reason_priority_claim` beside the label,
because it says something real about the conversation without buying a rung
(§3.3, 12th correction). And the classifier is called with EVERY participant
message in the task, returning the highest label reached across all of them —
never a verdict on the newest message alone. People do not confess in one
message; judged one at a time, with the ties-downward rule applied to each, a
confession spread over three turns is scored as never having happened. That is
a systematic floor on Direct disclosure specifically, and it would be read as
the Proxy arm's protective effect. The per-row label here is the classifier's
running verdict AT that turn, and the full ordered log lives in
`negotiation_t{n}.classifierLog`.

This is what resolved §9.8-4, which had been open since Ver.2.13: the Direct
operational definition of `SB` is the classifier's verdict, with the post-hoc
coding as the reported value and κ as the evidence for it.

The negotiating models still decide nothing (§6.7). P1–P4 render moves the
state machine chose; P5 never generates a negotiation sentence. Keeping the two
apart is what makes the counterpart identical for every participant.

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
  -- No ratification columns here even though RATIFY is back (Ver.2.13 §7).
  -- The decision is a MEASURE, not a property of the agreement: it is
  -- `task_outcome_t{n}.RATIFY` in `responses`, alongside the other three
  -- behavioural measures, and this table holds only the terms that were
  -- finally agreed. Whether one was reached at all is JOINT = 1,200.
  -- `decided_at` stays out for the same reason `created_at` is enough.
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
