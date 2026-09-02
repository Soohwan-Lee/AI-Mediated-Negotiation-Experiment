# Project notes

Online experiment platform for a 2027 CHI submission on AI-mediated
negotiation. Source of truth for the design is
`N - Experimental Design (Ver.2.12).md`. This file records the constraints that
are easy to break by accident.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · deploy to
Vercel · Supabase for persistence (planned, not wired) · `gpt-5.6-terra` at low
reasoning effort for all AI turns.

## Design in one paragraph

120 Prolific participants. Each does **one Baseline task and one Proxy task** —
never all three conditions. Proxy is either **Delegate** (may say only the
reasons the participant ticked) or **Explorer** (may also use pre-approved
role-plausible arguments, with no source labelling). Role is **Leader** (high
power) or **Member** (low power). Two structurally matched tasks, A and B.
Comparisons of interest: `Pooled Proxy − Baseline` and `Explorer − Delegate`,
each crossed with Role.

**Role symmetry is load-bearing.** Both roles hold a socially costly
requirement, mandate a proxy, receive the other side's case, and make a
post-negotiation decision about the other person. There is no receiver-only
arm to hold constant, because everyone is both sender and receiver.

**Two reason cards per role per task.** One Working Reason and one Sensitive
Background, BOTH on that role's own priority issue. The other term is what you
SPEND, not what you argue for, so it carries no card of your own.

**A card carries a reason and never a package (Ver.2.12 §4).** Which terms to
trade is an act taken IN the negotiation; the card only says why the issue is
absolute. This is what lets the credibility ladder read the card's LAYER
without also reading a proposal off it.

**Each SB is a face confession, and all four writing rules are validity-bearing
(§4).** The role brief first sets up a professional image ("head office rates
you as a manager whose plans are precise"), and the SB contradicts it. It
carries one concrete incident, lands on the axis the other side was told to
weigh in their post-negotiation decision, and is the CAUSE of the role's
priority — a weakness unrelated to the ask would be noise, not signal. The two
tasks carry DIFFERENT incidents on purpose: each task's counterpart is
introduced as a different participant, so the same confession twice would be a
tell.

**No screen may name the requirement issue.** With cards on ONE issue, a
per-issue heading points straight at the term the study is about.
`IssueReasonGroups` renders the work and sensitive boxes with no issue heading
at all, and no badge marks which issue is this role's priority (design §5
principle 1). The cards name their own term in their own text, which is the
participant's own briefing. `tests/reason-rules.test.mjs` pins the invariants.

## The task, in numbers

**Two terms, four options each, both integrative** (Ver.2.12 §3.2). One is the
Leader's priority and carries the **Leader's requirement**; one is the Member's
and carries the **Member's**. There is no third term. Payoffs are in
`lib/tasks.ts` and these properties are load-bearing — if you change a number,
recheck all of them:

- individual maximum 3,900; the most reachable while the counterpart still
  agrees is 3,000, because **every agreement path holds the counterpart's own
  priority at its best option**
- the full logroll reaches **6,000**, perfectly symmetric at 3,000 each. That
  is the number `MAX-JOINT` tests for
- reservation 600 each — deliberately BELOW the unargued rung (1,000), so even
  a reason-free agreement beats walking away
- each requirement's threshold is Options 1–2 on its own issue. O1→O2 keeps it,
  O2→O3 breaks it, which is why the trajectory is reported as transitions and
  never summed

**The credibility ladder replaced the acceptance thresholds** (Ver.2.12 §3.3,
§6.2), and this is the single biggest change in the migration. There is no
T_MID and no T_FINAL. How far the counterpart concedes on the participant's
core issue is decided by the best reason the participant side has VOICED:

| Voiced | Participant's core lands at | Participant | Counterpart | JOINT |
|---|---|---:|---:|---:|
| nothing (cheap talk) | 3rd option | 1,000 | 3,600 | 4,600 |
| work reason | 2nd option | 2,000 | 3,300 | 5,300 |
| **sensitive background** | **best option** | **3,000** | **3,000** | **6,000** |
| impasse | — | 600 | 600 | 1,200 |

Two consequences, both deliberate:

- **Disclosure is the only bottleneck to the maximum.** Once the SB is voiced
  the counterpart proposes best↔best ITSELF (`SCRIPT-PROPOSE-MAX`) rather than
  leaving the maximum to be discovered — so negotiation skill cannot be what
  separates outcomes, which is what makes the contrast interpretable.
- **The maximum is not reachable by skill alone.** An over-ask without the SB
  is countered at the tier package, never accepted, however well it is argued.

`tierOf` reads card LAYERS only — never text, never a model's judgement of
whether an argument was any good (§6.2: LLM 비관여).

**A bare point number is not information, so two anchors travel with it.**
`PointsKey` names the most the task could pay this participant (3,900) and the
fallback with no agreement (600); `PackageValue` prices a selected package
against that fallback. Both are already the participant's own, so neither
discloses anything the design withholds. Neither may ever show the other side's
numbers, the joint total, or any hint that trading term against term pays
better than splitting each one: finding the logroll is the behaviour being
observed (pilot gate 6). **Nor may a screen price a position as a forecast** —
the mandate screen labels its two figures as what each POSITION is worth, since
under the ladder where it lands depends on the reasons voiced, not the floor.

Each requirement is worth 3,000 on purpose. If it were cheap, giving it up
would be explicable as a sensible low-priority concession — exactly the thing
this study has to distinguish from withdrawal under evaluative pressure.

## Who decides what in a negotiation

`lib/negotiation/machine.ts` decides the moves: offer levels, the credibility
tier, acceptance, and termination. The model only says those moves in the right
voice. Keep it that way. A counterpart whose judgement is the model's is a
different counterpart for every participant, and it is why the design does not
need to randomize outcomes: identical behaviour already produces identical
results.

**Six stages (Ver.2.12 §6.1), and stage 3 is not a message.**

1. **opening** — the counterpart's own best package on both terms. Fixed.
2. **first reason opportunity** — it gives its WORK reason and asks for the
   participant's priority and reason. This is the turn that opens the
   participant's own first chance to give one.
3. **lock** — a system recording moment. `counterpartStageAfter` walks
   1 → 2 → 4 → 5 and never serves it.
4. **disclosure** — the counterpart voices its own SB card, **once,
   unconditionally**.
5. **conditional trade** — bounded by the tier.
6. **close** — acceptance, or impasse when the clock runs out.

**The counterpart's SB disclosure is new in Ver.2.12 and reverses an earlier
rule.** Ver.2.11 deliberately withheld it, on the grounds that reciprocal
disclosure would prime the very construct PERC measures. Ver.2.12 §6.3 requires
it instead, for a reason that outranks that: `PRE-RECIP-SB` — whether the
participant disclosed BEFORE hearing the other side's confession — is RQ1's
confirmatory outcome, and it is undefined without a fixed reciprocity point.
The confound is controlled by making the disclosure **identical and
unconditional for everyone**: never mirrored to what the participant said,
never skipped, carrying no demand and no package. It changes no tier.

**The participant's conversation is free-form, bounded by a clock.** Ten
minutes in Baseline, three in the Proxy arm's closing (`CLOSING_SECONDS`) —
the ground work there is already done. They write as many messages as they
like and may finish early. Running the clock to zero is an outcome; `onExpire`
closes the exchange as an impasse.

**Closing is unified across the two arms, and that is deliberate.** Both end
exactly three ways, so "how did it end" is never a between-condition artefact:

1. a package the counterpart accepts by the ladder,
2. an explicit **"Accept their proposal"** button — deterministic, so no model
   ever reads the participant's words to decide whether they agreed,
3. the clock — one `SCRIPT-CLOSE` offer near the end, then impasse.

The Proxy arm adds a **decline** control (two-step), because it has a standing
proxy package to reject; that is what `RATIFY` codes. Baseline has nothing to
decline, which is why it has no such button.

**The counterpart's fixed opening must be on screen before the participant
writes anything**: it is the anchor their reply is measured against.

That seed produces **two different stage positions, and they must stay
different.** The counterpart has already *spoken* stage 1, so its next move is
stage 2 — `counterpartStageAfter(replies + SEEDED_OPENING_STAGES)`. The
participant is replying *to* that opening, so their own script slot is one
behind. Conflating them broke it twice before. The Proxy arm has the same idea
at a different size — `DIRECT_STAGE_OFFSET` is 3, because through its proxy the
counterpart has already opened, argued and disclosed; replaying those would
make the participant sit through a disclosure they just watched.

### The credibility ladder

The counterpart concedes on the participant's core issue by tier, and holds its
own core at its best option on every agreement path. The tier is decided by the
**system, from the structured card log** — never by asking a model to grade an
argument (§6.2). In Proxy that is what the proxy actually VOICED (not what was
authorized — a guardrail block can strip a reason, and assuming otherwise made
the rule inert for a whole arm once already); in Baseline it is the card the
participant attaches via `ReasonPicker`. That control may never suggest
attaching one helps, may never default to a card, and may never present the
sensitive card as the better answer.

**The tier only ever rises, and it rises the moment the card is tagged.** In
the Proxy arm's closing it starts from what the proxy earned and can be raised
by the participant tagging their own SB in person (`SELF-DISCLOSE`) — at which
point the counterpart proposes best↔best itself.

**The fixed scripts (§6.4)** are `DecidedAction` values, not prose in a
component: `ask_why` (SCRIPT-ASKWHY, once), `counter_tier` (SCRIPT-FAIR /
SCRIPT-LIMIT), `accept_sb` (SCRIPT-ACCEPT-SB), `propose_max`
(SCRIPT-PROPOSE-MAX), `nonum` (SCRIPT-NONUM), `soft_close` (SCRIPT-CLOSE),
`impasse` (SCRIPT-FALLBACK).

**The no-numbers reminder is one-shot and reads the WHOLE history.** §8.1
forbids telling the other side your score; `mentionsScoreNumbers` screens for
it server-side and the counterpart reminds once, then ignores it. Reading only
the latest message missed a mention made during the fixed stages, where the
counterpart's move is already determined — so the reminder never fired at all.

**The proxy voices an authorized SB at its FIRST reason opportunity**
(`designatedReason`, §6.5), not after a challenge. `PRE-RECIP-SB` is "was the
participant side's SB out before the counterpart's stage-4 disclosure", so a
schedule that held it back past stage 4 would record every Proxy participant as
a non-reciprocal discloser regardless of what they actually authorized.

**"Each card at most once" is the schedule's job, not the validator's.** It is
kept by never designating a card twice. Making it a violation instead would be
actively harmful: the whole message would fall to the package-only fallback and
its reason token would be nulled — and on the turn carrying the requirement's
reason that hands the direct conversation a false "no reason was given".

**`stage_mismatch` is NOT a hard violation.** The model's stage field is an
echo of what it was told, so a mismatch carries no information about the move,
which the machine decided either way. Treating it as hard replaced whole
messages with the package-only fallback on exactly the closing turns — the
machine stamps an accept as stage 6, and the model sometimes echoes the trade
stage it was mid-way through. It is still logged for the audit.

**Message SHAPE is enforced on the text, not asked for in a prompt.** Two
things travel together in `capMessageLength`, and both were prompt-only once
and both failed:

- **Every AI message is bubble-split and under 280 characters.** The `||`
  rule lived in `HUMAN_CHAT_STYLE`, which only P1 and P2 ever saw, so the two
  proxies — the only thing a Proxy participant watches for minutes — wrote
  one 220-character paragraph a turn, 16 turns out of 16. It is in
  `SHARED_RULES` now, and the cap is applied rather than requested: §7's
  exposure control exists so the Explorer arm cannot simply say MORE than the
  Delegate arm, and unenforced it did (226 characters against 194, longest
  471 against 401 — a contrast the policy manipulation would have carried).
- **The cut is taken at a bubble seam, and never from a clause that carries
  meaning.** `capMessageLength` takes protected clauses in PRIORITY ORDER,
  the principal's card first and the Explorer's pool clause second. Both
  halves of that are load-bearing and both were learned the hard way. Cutting
  from the end removed the pool clause, which is the last bubble the model
  writes — the cap undoing the manipulation it was written to protect.
  Protecting only the pool clause then pushed the CARD out, which is worse:
  the schedule records the card as voiced and the ladder is driven off that
  record, so a participant was credited with a disclosure nobody heard.
  Matching is by CONTENT OVERLAP, never containment — a proxy is required to
  reframe a card rather than quote it (§6.6), so a containment match finds
  the verbatim pool clause every time and the reframed card never. That one
  detail made the failure POLICY-CORRELATED: 4 of 4 Delegate generations kept
  the card against 1 of 4 Explorer ones, which is a bias in
  `Explorer − Delegate` itself.

**The pool clause is APPENDED, not requested, and the model is not shown the
pool at all.** As an instruction it competed with the card instruction on the
same turn ("give exactly this authorized reason and no other") and lost about
three times in four — while `voicedPoolId` spent the §6.6 budget from the
schedule regardless, so a dropped clause was recorded as voiced.
`designatedPool` still decides whether and which, so the per-issue and
per-task budgets are unchanged, and the Delegate guardrail is untouched: it
reads the action's own `pool:` fields, which a Delegate never had the pool to
fill. When both generations drop the card the pool clause is withheld too, so
the two policies fail identically rather than Explorer failing softer.

**The Explorer's pool reasons have their own budget and their own action
field.** At most one per issue and two per task, riding in
`addedReasonSourceId` BESIDE the principal's card rather than instead of it.
Sharing one bucket was tried and was wrong: only the Explorer adds on top, so
it hit the cap sooner and more of its messages were stripped to a reasonless
restatement, biasing `Explorer − Delegate` on exactly the message content the
contrast isolates. **Pool arguments never move the tier** — they are WR-grade
general claims, and letting one open the SB rung would hand an Explorer
participant who authorized nothing the maximum, in one arm only, on the primary
outcome.

**The two pool clauses land on different issues, and must.** The core-support
item rides the reason turn; the EXCHANGE argument (the one pool entry carrying
no issue) rides the trade turn. Pointing both at the core issue looks harmless
and silently halves the manipulation: the second request finds nothing, every
Explorer participant gets one clause where §6.6 allows two, and no log shows
it, because one clause is a legal outcome.

**What the client receives about reasons must be constant in SHAPE, not just
opaque in content.** This has been got wrong three times in the same place. The
response returns EXACTLY TWO opaque hashes on every turn of every policy,
padding with a per-turn decoy — `resolveReasonTokens` drops anything that does
not re-hash to a known id, so a decoy spends no budget and satisfies no rule. A
blocked turn returns decoys too, because an empty array is its own one-bit tell
that a guardrail fired. `voicedTier` travels as a rung name for the same
reason: it describes the participant's own card and is identical under both
policies.

## Things the participant must never learn mid-study

These are load-bearing. Breaking any one invalidates the data.

1. **The counterpart is an AI.** It is presented as another Prolific
   participant — labelled **"Other Participant"**, never a name. A role label
   is a stronger claim to being a real person than a pseudonym, it matches what
   the consent form and instructions already say, and it cannot be compared
   between participants the way a name eventually would be. In the Proxy task
   its AI Proxy is presented as that person's. Disclosed only at
   `/debriefing`.

   The label is a role but the VOICE is a person (prompt P1: very short
   messages, `||` bubble splits, lowercase openings). If the counterpart starts
   writing like a system, the label stops being credible and becomes a tell.
2. **Which condition they are in.** Tasks are labelled "Task 1" and "Task 2",
   never "Baseline"/"Delegate"/"Explorer". The URL carries only the task index.
   The *policy* is disclosed (both principals are told whether pool reasons are
   in use — §7 requires it, and OTHER-AI4 is unanswerable otherwise); the
   *condition name* never is.
3. **Which individual reasons came from the Explorer pool.** Internal
   provenance is computed for the audit and stripped server-side before the
   response leaves `/api/proxy-negotiation`. `DisplayMessage` has no field for
   it, so a transcript component cannot render it even by accident.

   **It is not yet PERSISTED anywhere, and that is deliberate rather than
   forgotten.** `logGuardrailEvent` exists on both stores and has no caller,
   because the only place provenance may be written is the SERVER — handing
   it to the client to save, the way messages are saved, is precisely the
   per-message tell the next paragraph forbids. The write lands with
   `/api/persist`, which holds the service-role key. Until then the audit's
   only source is `npm run simulate`. Do not delete either end of that wire
   to silence an unused-symbol warning; see docs/DATA_MODEL.md.

   Nothing else in the response may carry the kind either. The running reason
   budget travels as an opaque token, and an earlier version prefixed pool
   reasons with `pool` "because the token is opaque" — but the token is
   returned with every message, so the prefix said *this message's reason was
   AI-added*, per message, for the whole transcript. The per-issue budgets and
   the issue-scoped acceptance rule need each token's kind and issue, so the
   route RESOLVES the plain tokens server-side by re-hashing the known card
   and pool ids — the client carries nothing but the token and `voicedTier`,
   which names its own card's rung and is identical under both policies.
4. **That no bonus decision is made about the Member at all.** A Member waits
   while "the Leader decides" and is then shown NOTHING — no score, no amount,
   ever. This replaced a fixed 70/100 presented as the Leader's judgement, and
   removing the number removed three problems at once: a deception that had to
   be explained away, a tell (the same 70 after two visibly different
   negotiations says the number is fixed), and a contaminant (a payout seen
   after Task 1 is a response the Task 2 measures would pick up — which is why
   it had to be constant in the first place). The wait is what carries the
   manipulation: POWER3, gate 2's Member-side check, asks whether outcomes
   that mattered depended on the other person's decisions, and waiting while
   someone else decides your bonus IS that. The Leader still decides a real
   amount and it is still recorded as `BONUS`; it simply never travels. What
   `/debriefing` discloses is that no such decision was ever made about them.
   Do not "restore" a number here for symmetry.

   **The Member's own channel is `RECV-EVAL`** (Ver.2.12 §5): before the wait
   they write an upward evaluation of the manager, told it goes to the district
   manager. It does not — there is no district manager — and `/debriefing`
   retracts that for both roles, since the Leader was told one was being
   written about them. It is the receiver-side mirror of `BONUS`: without it
   the Member has a post-negotiation decision made ABOUT them and none of their
   own, and RQ2's role-specific behavioural outcome has nothing to measure on
   half the sample.
5. **Which term the study is about.** Both terms are entered the same way
   on the preference screen — no extra control, no highlight, no separate
   heading for the requirement issue. Pilot gate 6 tests for exactly this kind
   of transparency, which is also why the instructions no longer teach the
   logroll.

When adding any UI, check it against this list.

## Assignment (planned Supabase behavior)

A pre-seeded `assignment_slots` table holds one row per planned participant,
each with a fixed `(proxy_policy, role, sequence_id)` and a `claimed` boolean.
On entry the server **atomically** claims the first unclaimed row and flips it
to true. This keeps the four `Proxy Policy × Role` cells and the four sequences
balanced by construction, with no runtime randomization.

The claim must use `FOR UPDATE SKIP LOCKED` (or an equivalent conditional
update) so two simultaneous participants cannot take the same slot. Assignment
is idempotent per participant key, so a refresh never reassigns.

Currently `lib/assignment.ts#claimSlot` is a deterministic local stand-in.
`/api/assign` is the swap point: replacing the body of `claimSlot` with the RPC
call is the whole change, because nothing else in the app decides an
assignment.

`lib/store-supabase.ts` holds a written `SupabaseStore` — not wired up, nothing
imports it, `getStore()` still returns the local store. It exists because
writing it is how the "no page changes" claim got tested instead of assumed.
The pages are clean; what remains is in docs/DATA_MODEL.md under **Readiness**.
Two things there are easy to get wrong later:

- **One opaque `/api/persist` endpoint, not a path per operation.** A
  participant who reads their own network tab can infer their condition from
  it, and that is the one thing that invalidates their data.
- **Several writes are deliberately not awaited and must stay that way.**
  Awaiting `appendMessage` mid-negotiation is a visible stall between turns.
  The local store cannot fail so those call sites have no error branch — fine
  locally, silently lossy over a network. `WriteQueue` closes it without
  touching a call site: enqueue synchronously, mirror to localStorage, flush on
  `visibilitychange` via `sendBeacon`, since the study ends on a screen people
  close at once.

  Its retries are **event-driven, not budgeted**, and that is load-bearing: one
  attempt per item per drain, return at the first failure, nothing dropped and
  nothing reordered (the queue is a transcript, so its order is data). The next
  try comes from another push, the `online` event, or the next flush. An
  attempt budget was tried and is the wrong shape — once spent while the
  network was down it could never be unspent, and a failing item rotated to the
  back stopped every later drain dead. Tests in `tests/write-queue.test.mjs`;
  `npm run test:units`.

The dev panel's slot picker does **not** go through any of this. It swaps the
assignment the UI renders, in memory, for previewing; it never claims a slot
and never writes one. Keep it that way — a preview control that could consume a
real row would silently unbalance the design.

## The flow

Consent → background (incl. covariates) → instructions + comprehension →
**one** practice round → **Task 1 → Task 1 questions → Task 1 decision** →
**Task 2 → Task 2 questions → Task 2 decision** → wrap-up → debriefing.

The post-task decision screen is the one screen that differs by role: the
Leader decides the recommended bonus, the Member writes `RECV-EVAL` and then
waits while "the manager decides" — shown no number, ever.

**M1 is asked where the decision was made, not in one fixed place.** Under
Proxy it sits on the confirm screen, of non-disclosers only, while the mandate
choice is fresh and nothing has been negotiated; under Baseline there is no
such moment, so it is asked retrospectively in the post-task battery. Asking a
Proxy participant retrospectively would be asking them to reconstruct a
decision they made forty minutes and one negotiation earlier.

The questionnaire and the bonus sit **inside each task block** (§8), and that
is not a layout preference: every §9.4 measure is a judgement about one
specific negotiation, so asking it after a second, differently conditioned
negotiation would blend the two conditions inside a single answer. Item ids
carry a `_t1` / `_t2` suffix for the same reason.

**The questions are paginated, forward only.** A Proxy task's battery is about
twenty-five rating items plus seven required free-text answers, twice over —
as one screen that is where a paid worker starts straight-lining. It runs in
parts of roughly twelve items, cut at BLOCK boundaries so the §9.4 order is
untouched: a part is a run of whole blocks in the same fixed sequence, never a
reshuffle, and a block longer than the cap becomes a part of its own rather
than splitting a scale from its hint row. There is no Previous, for the same
reason the order is fixed — the AI-Proxy blocks come last so they cannot
colour the answers about the other side, and paging back to revise would undo
that. It is still ONE route, so the progress bar comes from the URL alone
(rule 3); the part index is component state. Two things it needs and would be
silently broken without: `useRestoreAnswers` (Back from the bonus screen is in
`BACK_STEPS`) and an autofill key carrying the PART index.

Inside a Baseline task: cover → brief → **RISK** → what you want → "waiting for
the other participant" → negotiate → review.

Inside a Proxy task: cover → brief → **RISK** → **mandate (levels + reason
cards, one screen)** → check with your proxy → confirm → watch the two AI
Proxies → **handover** → negotiate directly → review.

**The mandate is ONE screen: the levels on both terms and the reason
cards.** They were two screens in sequence, which made them two decisions
taken in order — the position fixed before the reasons were considered. The
gap this study is about is precisely that the second half was never asked, so
splitting them contradicted the contribution.

Where the cards sit took care and must not be "tidied". They exist for one
term — the participant's requirement — so the obvious layout nests them in that
term's card. That breaks §5 principle 4: one of the two term cards would be
visibly taller and carry a control the other does not, which tells the
participant which term the study is about without a word being said. The
reasons are therefore a section BELOW both term cards, and the two term cards
stay identical. `PreferenceForm` takes the section as a prop; Baseline passes
none.

**The participant can question their own AI Proxy before it runs**
(`RehearsalChat`, `/api/proxy-rehearsal`). They ask what it will open with, how
far it will go, which reasons it may use, and can then go back and change the
mandate. It is optional and says so. Three limits keep it from disturbing the
design, and all three are enforced rather than intended:

- **Not a negotiation.** The counterpart is absent and never spoken for.
  Nothing is proposed or agreed, and `machine.ts` is never called — so no
  negotiation decision moves to the model.
- **Not a second bite.** It is BEFORE the exchange. The deleted post-hoc
  revision let a Proxy participant re-run a finished negotiation, which is a
  bite Baseline never had; editing instructions before anyone has spoken is
  just writing a mandate.
- **No unticked card, ever.** The route screens the generated text against the
  cards left unticked and substitutes a refusal. Hearing a sensitive card read
  aloud without authorizing it would stage the disclosure being measured, so a
  prompt instruction alone is not enough.

What it costs, and it is real: the Proxy arm gains screen time and a written
exchange Baseline has no counterpart for. Read it as part of the manipulation,
and against the §10 gate 8 timing budget.

**The Proxy participant takes over from their AI Proxy and finishes the
negotiation themselves.** The proxies run ONCE — there is no revision, and no
second run — and then the participant talks to the other participant directly,
with the proxies' full transcript on screen beside them. What the two people
agree is the result.

That transcript is not a convenience. Every §9.4 measure asks the participant
to judge what was said on their behalf — whether the other side's requirement
read as genuinely theirs, who is answerable for it, whether their own proxy
represented them well — so taking it away would turn those items into a memory
test. `ProxyTranscriptPanel` keeps it one click away, never behind a
navigation.

**The counterpart picks its script up mid-way in the direct conversation**
(`DIRECT_STAGE_OFFSET` = 3), because through its own proxy it has already
opened, given its work reason and disclosed its SB. Replaying those would sit
the participant through a confession they just watched, and would give the
Proxy arm two disclosures where Baseline has one.

**The review screen shows the participant's plan beside the agreement**
(§7): hoped-for and agreed, per issue, with the shortfall stated on the CORE
issue only. A whole-package delta would report a loss even on the best
reachable agreement, because the plan's level on the other side's term was
never winnable — and the WR-only path's gap IS the finding, so the screen
states it neutrally and never editorialises it.

**The review screen must show the participant's OWN conversation.** It once
showed the AI-AI transcript captioned as theirs, so every item asking them to
judge "what was said" was answered against the wrong stimulus and their own
words were never shown back. Both transcripts belong there — theirs as the
subject of the decision, the proxies' collapsed above it, because several §9.4
items ask about each.

**The reason rule reads what the proxy actually said, not what it should have
said.** `DirectNegotiation` takes `reasonAlreadyVoiced` rather than assuming
one was voiced: an emergency stop can end the exchange before the proxy speaks
and a guardrail block can strip the reason out of the message meant to carry
it. Assuming it made the rule inert for every Proxy participant while it kept
biting in Baseline — a mechanical asymmetry in the primary outcome, along the
primary contrast.

**There is no "ask for one change", and no approve/reject either.** The
revision existed when the proxies produced the final package alone; talking to
the other side directly is a better version of the same control, and keeping
both would give the Proxy arm two bites Baseline does not have.

Ratification went for the same reason one step later. Both arms now end with
the participant agreeing a package *in conversation*, so a screen asking "do
you accept this?" asked them to re-decide what they had just decided — and it
handed the Proxy arm a way to undo an agreement that neither counterpart has.
The review screen states the outcome instead. What survives is the §9.3.1
uptake question about the OTHER side's requirement, which is asked rather than
coded off the transcript, and `outcome: agreement | no_agreement`, which used
to be implicit in the ratification choice and is now recorded explicitly.
`RatificationChoice` and `saveRatification` are gone, so the Supabase port does
not inherit a table nothing writes.

**RISK sits in the same place in both arms, and that position is load-bearing.**
It asks what the participant *expects* raising their requirement to cost. Asked
after the mandate — as an earlier version did in Proxy only — they answer it
having already decided which sensitive cards to hand over and read the policy
disclosure, which makes a pre-task measure partly post-treatment in one arm.
RISK is also §10 gate 4's task-equivalence instrument, so it cannot carry a
condition effect.

It is now asked **straight after the briefing, before the levels screen**, in
both arms. Merging the levels and the reason cards made the old placement
unsafe even where it had been fine: "after the levels screen" became "after the
mandate" in the Proxy arm and not in Baseline. Asked cold, right after the
situation is read and before anything about their own position is committed, it
is identical in both arms and cannot be reached by any condition-specific
screen. Do not move it back down the flow to group it with the other pre-task
screens.

## Interface rules

Ten decisions the screens depend on. Breaking one is a regression even if it
compiles.

1. **Colour encodes visibility.** Cool white and navy are the shared table;
   sand is private to the participant. Never render a private value — a point
   total, a minimum position, a briefing — on a plain white card. The study is
   about what people are willing to expose, so "can they see this?" must never
   be a question the participant has to ask. Tokens in `globals.css`.
2. **Nothing starts answered.** `Scale` and `AmountScale` have no default
   position. A slider's midpoint gets submitted by everyone who does not
   engage, and is indistinguishable from a considered midpoint. The one
   deliberate exception is the reason-card defaults (§7: work on, sensitive
   off), which are specified and must not be "improved".
3. **One progress bar, derived from the URL.** `flowKeyFromPath` is the single
   source; pages never declare their own step. This is what makes progress
   assignment-order-proof — the URL carries only the task index.
4. **The study only moves forward, except where going back is harmless.**
   `NavigationGuard` absorbs the browser back press with a sentinel history
   entry — do not "fix" it by redirecting forward instead, because a task's
   phase is component state and a remount restarts the negotiation. The steps a
   participant may return to are listed in `BACK_STEPS` (`lib/study-config.ts`).
   Anything reachable by Back must restore its saved answers with
   `useRestoreAnswers`, or Back is a trap that blanks the screen.
5. **The briefing is never taken away.** `TaskLayout` pins it beside the work
   from `lg` up and behind one tap below that, at every phase. Anything a
   participant is expected to negotiate from belongs in it — including all six
   reason cards.

   **Its sections fold, but nothing is removed.** As one scroll it ran to
   several screens in the rail and buried the payoff table — the part most
   often wanted mid-negotiation — under the story. What is open by default is
   chosen by what a participant reaches for mid-sentence: the numbers, the
   fallback, and the reason cards (rule 6's decision has to be visible to be
   made). The situation and objectives fold, because by then they have been
   read on the brief phase, where `defaultOpen` expands everything. Use
   `<details>`, not state — a section stays open across the re-renders a live
   negotiation produces, and find-in-page still reaches closed ones.

   Do not put `.prose-study` inside the panel. It sets `1.0625rem`, so the
   role story rendered half again the size of everything around it and took
   most of the rail on its own — the panel's own `text-[0.8125rem]` was being
   silently overridden. Prose treatment at 13px means the leading and the
   measure, not the display face.
6. **The two reason boxes stay visually separate.** Work and sensitive cards
   get their own headings, borders and colours, on the briefing, on the mandate
   screen and in the Baseline reason picker. The whole measure is which box a
   participant is willing to draw from; if the two read as one list, that
   decision stops being legible.
7. **Items are data.** Every questionnaire item lives in `lib/measures.ts`;
   pages hold answers and never lay out a question. Item ids are the column
   names in the export and match Design §9 — renaming one renames a variable.
   `[YOUR REQUIREMENT]` is substituted per task *and per role* by
   `withRequirement`, so one id covers four cells rather than four ids meaning
   the same thing.
8. **Two measures, and prose keeps its own.** Column widths are the
   `--measure-*` tokens in `globals.css`; the header and the action bar follow
   the page through `--measure-page`, so a hardcoded width in any one of the
   three misaligns the other two. The columns are wide because these screens
   are mostly forms — an eighty-item battery on a narrow column is all scroll,
   which is why a rating statement sits *beside* its buttons from `lg` up and
   why two short answers (`half` in `lib/measures.ts`) share a row. Prose does
   not follow the column: `.prose-study` and `max-w-prose` hold it near 70
   characters. Widening something without capping the prose inside it is the
   easy way to regress this. The other easy way is a control with a minimum
   width its container cannot give it: a rating row of fixed statement column
   plus fixed anchors plus fixed buttons needed 54rem and the task column is
   about 50rem, so "Strongly agree" hung outside the card. Rows flex, and the
   parts that cannot shrink are grids that fit their container.
9. **A cue points, it does not colour.** The one thing a screen is waiting for
   gets `.cue-ring` and a `Cue` pill — "Your turn", "3 to answer", "Waiting
   for their reply". It may never change a card's surface, because the surface
   is what says who can see what is on it (rule 1), and it may never suggest
   an answer, only that one is expected. At most one ring on a screen; pills
   that count what is left may repeat.

   The ring is a **glow, not a line**. A hard outline is the shape a form uses
   to mark a field as wrong, and it was reading as an error on controls whose
   message is the opposite. It breathes on a 4s cycle, slow enough to catch
   the eye returning after a wait rather than to nag; `prefers-reduced-motion`
   restates it as a static glow, because the blanket
   `animation-iteration-count: 1` in that block would otherwise freeze it on
   whatever frame it stopped at and lose the signal along with the movement.
   Nest two and it reads as a rendering fault, so the ring goes on the control
   (the composer), never also on the card around it.
10. **A task announces itself.** The practice round and every task opens on a
    `TaskCover`: which of the two it is, whether it counts, what happens in
    it, how long it takes, and a `CoverArt` row showing who talks to whom. It
    is a phase, not a route — the flow step still comes from the URL alone
    (rule 3) — and it is deliberately not counted as one of the task's own
    steps.

    **Both arms get a cover and both get a scene.** `proxy-task.tsx` opened on
    `brief` for a while, so its `intro` phase was unreachable and only Baseline
    participants ever saw a cover — a whole orientation screen present in one
    condition and not the other. The art draws the INTERFACE, never the
    condition: Delegate and Explorer are the same picture, the other side is
    drawn as a person with the same figure the participant gets, and the
    handover uses the direct scene because from there the proxies are done.

## Dev / mockup mode

A floating panel (bottom-right, or Ctrl/Cmd+Shift+D) makes the flow walkable:
it fills every screen on arrival, skips required-field gating, jumps between
pages *and* between the phases inside a task, swaps the assignment (role ·
proxy policy · sequence) without clearing storage, plays the negotiation
instantly, and resets participant data.

**Mockup mode** (`autoFill`) is the one that matters for reading the flow.
Filling is not the same as skipping: skipping lets you past an empty screen and
leaves you looking at an empty screen, which tells you nothing about whether
the thing reads. With mockup mode on, every condition × role × task has a
written exchange in `lib/negotiation/script.ts` — participant messages and
open-ended answers included — so the Baseline composer arrives with the message
for that stage already in it, the review screen shows a real transcript and a
real package, and pressing Continue from the consent page to the completion
code shows you what a participant would actually see.

Those scripts are the *ideal* trajectories: the SB is voiced at the first
reason opportunity, the counterpart discloses its own at stage 4, and the
best↔best trade lands. They are for reading the flow, not for exercising the
failure branches.

**The scripts must agree with the state machine.** All twelve cells settle at
3,000 for the speaker and 3,000 for the other side — the ladder's SB rung,
which is why the mockup mandate ticks the sensitive card: a mockup showing a
disclosure the mandate forbids would be a mockup of a different study. A test
in `tests/reason-rules.test.mjs` asserts the agreement in every cell, because
this pair has drifted apart twice. Levels named in a message are read from the
package that message carries, never from an option index, because option order
is role-relative.

It is present by default on every build, including deployed ones, so the layout
can be checked wherever it happens to be running.

**Before recruiting: set `NEXT_PUBLIC_DEV_TOOLS=off` and redeploy.** The panel
names conditions and shows the assignment. The ON/OFF and "hide" controls live
in one browser's localStorage — they are conveniences for whoever is looking,
and they do not hide anything from a participant. Only the variable does.

| Build | Panel |
|---|---|
| local / preview | present, dev mode on by default |
| live deployment (`NEXT_PUBLIC_VERCEL_ENV=production`) | present, dev mode **off** by default, with a warning in the panel |
| `NEXT_PUBLIC_DEV_TOOLS=off` | not loaded — the chunk is behind a dynamic import that is never reached |

`?dev=1` / `?dev=0` in the URL forces the toggle.

Wiring, when adding a page: gate the Continue button on `useDevGate(complete)`
rather than `complete`, register a filler with `useDevAutofill`, and register
phase jumps with `useDevActions` for state the URL cannot reach. All are no-ops
in a production build. See `lib/dev-mode.tsx`.

`useDevAutofill` takes a second `key` argument. Pass one from anything that
changes without remounting — a task phase, a negotiation stage — or the screen
fills once and every screen after it inside the same component arrives empty.

## Where to plug things in

| Task | File |
|---|---|
| Supabase persistence | `lib/store.ts` — swap `getStore()` to the `SupabaseStore` in `lib/store-supabase.ts` |
| The `{op, payload}` persistence endpoint | `app/api/persist/route.ts` — does not exist yet |
| Rehearsal chat (participant ↔ own proxy) | `app/api/proxy-rehearsal/route.ts` · prompt P5 in `lib/ai/prompts.ts` |
| Atomic slot claim | `app/api/assign/route.ts` — `claimSlot` in `lib/assignment.ts` is the only thing that decides an assignment |
| Task payoffs, role stories, reason cards, Explorer pool | `lib/tasks.ts` |
| Counterpart moves, the credibility ladder, outcome coding | `lib/negotiation/machine.ts` |
| The scripted ideal exchanges for mockup mode | `lib/negotiation/script.ts` |
| The live end-to-end simulation | `scripts/simulate-negotiation.mjs` — `npm run simulate` |
| Model / temperature | `lib/ai/config.ts` |
| Agent behavior rules (P0–P4) | `lib/ai/prompts.ts` |
| Guardrails | `lib/ai/validator.ts` |
| Timings, payment, IRB text, completion code | `lib/study-config.ts` |
| Questionnaire items, scales, response options | `lib/measures.ts` |
| Design tokens, type scale | `app/globals.css` |
| Controls (scale, chips, buttons, cards) | `components/ui.tsx` |
| Progress bar and sticky action bar | `components/study-chrome.tsx` |
| Briefing panel and task layout | `components/session.tsx` |
| Transcript and bubble splitting, composer, timer | `components/negotiation.tsx` |
| Dev-mode gating, autofill, phase jumps | `lib/dev-mode.tsx` · `components/dev-panel.tsx` |

Pages never touch persistence or the network directly — they go through
`lib/store.ts` and `lib/participant-context.tsx`.

## Verified against the live model

Tested end to end against `gpt-5.6-sol` (2026-08-11) and re-run against the
current pin `gpt-5.6-terra` (2026-08-26). The two are API-identical — same
Responses shape, same 400 on `temperature`, same reasoning-block-first
ordering — and produced equivalent proxy output on the same prompts, so terra
was pinned as the cheaper snapshot. **The pin is fixed for the duration of data
collection; changing it mid-study splits the collection batch.** Findings worth
keeping:

- **No `temperature`.** This model family rejects the parameter with a 400.
  Use `reasoning.effort` instead — see `lib/ai/config.ts`.
- **Reasoning block comes first.** The Responses payload emits a `reasoning`
  block before the `message` block, so `output[0]` has no text. Select by
  `type === "message"`. Keep `max_output_tokens` generous, since reasoning
  tokens draw from the same budget and a tight cap returns `incomplete` with no
  message at all.
- **~7.5s per AI turn**, so `/api/proxy-negotiation` generates **one turn per
  request** and the client drives the sequence. Each invocation stays well
  inside Vercel's 60s Hobby limit — and one turn per request is also what makes
  live spectating possible at all.
- **The model must not be given the judgement.** Told only how many turns were
  left, the agents restated their openings and then "accepted" packages
  containing none of the other side's terms. If an exchange ever starts
  behaving oddly again, check whether something has quietly handed a decision
  back to the model.
- **The counterpart needs its own mandate.** Without one it mirrors whatever
  the participant's Proxy opens with instead of negotiating. It has one by
  construction: `counterpartOpening` plus the ladder.
- **Guardrail asymmetry confirmed.** Red lines, fabricated personal facts, and
  invalid options all block. Two checks are policy-specific: an unchecked
  reason card may not be voiced under *either* policy, and a `pool:`-prefixed
  reason is Explorer-only.
- **`stage_mismatch` was demoted to a soft violation, and that was a real
  bug fix.** The model's stage field is an echo, so a mismatch says nothing
  about the move — but as a hard code it replaced the whole message with the
  package-only fallback, and it fired on exactly the closing turns (the machine
  stamps an accept as stage 6; the model echoes the trade stage it was mid-way
  through). Live runs were losing the acceptance wording for no reason. It is
  still logged for the gate-10 audit.

**Ver.2.12 was re-verified the same way** (`npm run simulate`, ten runs, all
passing). What the runs are for, beyond the assertions: the ladder produces
exactly 3,000/3,000 with the SB and 2,000/3,300 without, in live prose; the
counterpart's own SB disclosure reads as a person volunteering something rather
than a system reciting a card; and a mid-closing confession really does move
the counterpart to propose the maximum itself. Three prompt fixes came out of
reading the transcripts rather than the checks — the bubble-splitting rule for
over-long turns, dropped duplicate "matters most to me" phrasing when the card
already says it, and an `accept_sb` frame that no longer acts newly surprised
by something already acknowledged. Only the first changed the design doc (§12
P1); the other two are instruction wording, which the doc leaves to the
implementation.

## Ver.2.12 migration status

Migrated in full: the scenario and payoffs, the two-issue shape, the eight
face-confession reason cards, the **credibility ladder** (§3.3, §6.2), the
**six-stage script** (§6.1), the **counterpart's fixed SB disclosure** (§6.3),
the fixed scripts (§6.4), the proxy's first-opportunity SB schedule (§6.5),
**RECV-EVAL** (§5), the unified closing with `RATIFY` / `SELF-DISCLOSE`, the
outcome measures `UNLOCK` / `CONCEAL-PREMIUM` / `JOINT` / `MAX-JOINT`, the
§9 instrument (PERC-F/I, FTS, the seven PCR items, the six OTHER-AI items,
M1, INCENT1), and prompts P0–P4 (§12).

Verified against the live model end to end — `npm run simulate`, ten runs
through the real routes; see "Verified against the live model" below.

**Still design-open (Ver.2.12 §13), not implementation gaps:**

- the working values themselves: the outcome ladder (1,000 / 2,000 / 3,000),
  the fallback (600), and the strength of the §5② decision guidelines are all
  to be fixed at pilot
- §13.3: whether the Proxy closing stays a free conversation with card tagging
  (current) or becomes an approve-only button. The current shape is what makes
  `SELF-DISCLOSE` measurable at all; an approve-only button would remove the
  measure along with the contamination risk
- §13.4: aligning PCR / PNPQ / PNOQ to the SVI's four factors, so a validated
  scale can be cited
- §13.5: the item wording is written in English against Korean drafts and
  needs a pass against the final translation

## Still open

Nothing structural. What remains is values to fix and behaviour to observe:

- **Pilot-dependent numbers.** The fallback (600), the outcome ladder
  (1,000 / 2,000 / 3,000), the strength of the §5② decision guidelines, and
  the Prolific completion code.

  **The payment is settled**: £8.00 participation plus a £1.00 bonus is £9.00
  for a 60-minute study, which is exactly Prolific's recommended fair-pay rate
  (their hard floor is £6.00/hour). GBP because Prolific pays in it. The pound
  is held back and presented as something a Leader decides and a Member
  receives, and every participant is paid it in full — the third deception
  alongside the counterpart's existence and the upward evaluation, retracted
  by name at `/debriefing`. It is held back rather than paid flat because
  gate 2's POWER3 asks whether outcomes that mattered depended on the other
  person's decisions, and a bonus the Member believes someone else is
  deciding IS that dependence. `tests/study-config.test.mjs` pins base plus
  bonus against the advertised total and both against the rate.

  On the impasse target (gate 6, under 10%): the ladder makes impasse much
  harder to reach than the old threshold rule did, because every rung is an
  acceptable agreement and even the unargued one (1,000) beats the fallback
  (600). The remaining route to impasse is a participant who sets a minimum
  above what their voiced reasons earn and then refuses the counterpart's tier
  package — which is a real behaviour worth measuring, not a bug. Watch the
  rate rather than pre-emptively widening anything.

- **Timing.** `STAGE_MINUTES` sums to 61 minutes and the consent page
  advertises 60. `TOTAL_MINUTES` is derived from those same numbers and
  `timingIsHonest()` pins the relation — the advertised figure may round the
  budget DOWN by at most a minute and never further, because a listing that
  promises less than the study takes underpays anyone slower than the estimate
  and the fair-pay rate is computed from it. (It was 55 against a
  four-minute-per-task survey budget, for about twenty-five rating items and
  seven written answers; seven is the honest figure and the six minutes that
  restores were six minutes of unpaid work.) Gate 8 asks for a
  task median under 12 minutes. A Proxy task is the longer arm — the proxies'
  watching plus a 3-minute closing — but both clocks are caps, not targets. The
  pilot median decides this; the lever is the reply-delay range, never the
  advertised figure, which must not drift below what the study actually takes.

- **Whether the two arms are matched on the participant's own airtime.** A
  Baseline participant writes the whole negotiation; a Proxy participant
  watches one and then writes a short closing. That asymmetry IS the design,
  but it means "how much did they say" is not a between-condition control, and
  any measure that behaves like a word count should be read with that in mind.

- **Whether two issues survive the demand-characteristic check.** With only two
  terms each requirement is highly salient, and the suspicion probe may show
  participants guessed the design. Adding a term back would mean recomputing
  every payoff property above.

- **Whether the counterpart's SB disclosure primes PERC.** This is the known
  cost of the Ver.2.12 §6.3 change, accepted because `PRE-RECIP-SB` needs a
  fixed reciprocity point. It is constant across conditions, so it cannot
  produce a condition effect — but it can lift PERC and RISK uniformly, and
  RISK is gate 4's task-equivalence instrument. Check both tasks' RISK means
  against gate 4 in the pilot before reading anything into their level.

- **The failure branches now have tests, but only at the machine level.**
  `tests/reason-rules.test.mjs` pins all three ladder rungs in four cells,
  impasse, the one-shot reminders, and script–machine agreement; the live
  simulation covers the below-mandate branch and a mid-closing disclosure. What
  is still unexercised automatically is the INTERFACE around the failure
  branches — the emergency stop, and the clock actually running out on a real
  screen. Both were walked by hand.

- Fixed vs. jittered counterpart delay · final IRB language (three deceptions
  now: the counterpart's existence, the bonus, and the upward evaluation being
  forwarded) · a pass over the item wording against the final translation.

## Conventions

- Keep placeholder content marked `[PLACEHOLDER]` or `TBD` so it is greppable.
- Anything that would leak the design gets a comment explaining why it is
  written that way — the next person will not have this context.
- `npm run build` and `npx eslint src --max-warnings=0` must pass before commit.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
