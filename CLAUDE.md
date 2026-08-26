# Project notes

Online experiment platform for a 2027 CHI submission on AI-mediated
negotiation. Source of truth for the design is
`N - Experimental Design (Ver.2.6).md`. This file records the constraints that
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

**Role symmetry is the ver.2.4 change, and most of the rest follows from it.**
Both roles now hold a socially costly requirement, mandate a proxy, and receive
the other side's case. That is why the yoked receiver stimulus is gone (§13):
with both sides sending, there is no receiver-only arm left to hold constant.

**Per-issue reason cards are the ver.2.5 change.** Each role holds one Working
Reason and one Sensitive Background PER ISSUE — six cards spanning all three
terms — instead of six cards about the requirement issue alone. The three SBs
are three facets of ONE backstory, woven into the role story so no card
arrives unannounced. Two rules follow and both are validity-bearing:

- **The reason-linked acceptance rule is issue-scoped.** "A reason was given"
  means a reason ON THE REQUIREMENT ISSUE was given, at all three judgement
  sites (proxy route, direct conversation, Baseline). An argument about the
  timing term is not a reason to concede the requirement — unscoped, a
  participant could earn the concession with an unrelated card.
- **No screen may single a term out any more.** With cards on one issue, a
  heading naming the requirement merely repeated the briefing; with cards on
  all three, it would newly reveal which term the study is about. The three
  issue blocks (briefing, mandate, Baseline picker — `IssueReasonGroups`)
  render identically, and `tests/reason-rules.test.mjs` pins the invariants.

**Ver.2.6 made the ticked cards actually get said.** Per-issue cards were only
half the change: the cap that came with them meant a ticked sensitive card
usually never reached the other side. The deterministic reason schedule is the
fix and it is described under "Who decides what in a negotiation" below. Three
smaller things came with it — sensitive card text must be SPEAKABLE (it is
said aloud, so "that it was my call is something only you know" is incoherent
the moment it is spoken; the confessional form belongs on the card and the
private-state form in the role story) and must carry a work consequence, not
only a feeling, or the reframing rule has nothing to work on.

## The task, in numbers

Three terms, four options each. One is the Leader's priority and carries the
**Leader's requirement**; one is the Member's priority and carries the
**Member's**; one is constant-sum (timing). Payoffs are in `lib/tasks.ts` and
these properties are load-bearing — if you change a number, recheck all of
them:

- individual maximum 6,300; joint range 4,800–7,800
- reservation 2,500 each, so **24 of the 64** packages clear both fallbacks,
  and **14** of those hold *both* requirements — protecting your requirement,
  respecting theirs, and reaching agreement are compatible **by construction**
- exactly **17** clear both fallbacks while holding the Leader's requirement,
  and 17 while holding the Member's. That symmetry is the design; an asymmetric
  count means a payoff was edited on one side only
- all-middle compromise is joint 5,800; the full logroll reaches 7,800
- each requirement's threshold is Options 1–2 on its own issue. O1→O2 keeps it,
  O2→O3 breaks it, which is why the trajectory is reported as transitions and
  never summed

**A bare point number is not information, so two anchors travel with it.**
`PointsKey` names the most the task could pay this participant (6,300) and the
fallback they get with no agreement (2,500); `PackageValue` shows what the
currently-selected package pays, against that fallback, once all three terms
have a level. Both are already the participant's own — the fallback is in the
briefing and the maximum is the sum of their own best levels — so neither
discloses anything the design withholds. Neither may ever show the other side's
numbers, the joint total, or any hint that trading term against term pays
better than splitting each one: finding the logroll is the behaviour being
observed (pilot gate 6). A partial package total is withheld for the same
reason a running subtotal misleads — it reads as the total and falls as terms
are added.

Each requirement is worth 3,000 on purpose. If it were cheap, giving it up
would be explicable as a sensible low-priority concession — exactly the thing
this study has to distinguish from withdrawal under evaluative pressure.

## Who decides what in a negotiation

`lib/negotiation/machine.ts` decides the moves: offer levels, concessions,
acceptance (T_MID = 3,600 at stage 4, T_FINAL = 2,600 at stage 5), and
termination. The model only says those moves in the right voice. Keep it that
way. A counterpart whose judgement is the model's is a different counterpart
for every participant, and it is why the design does not need to randomize
outcomes: identical behaviour already produces identical results.

**The participant's conversation is free-form, bounded only by a ten-minute
timer.** They write as many messages as they like and may finish early. Running
the clock to zero is an outcome — `onExpire` closes the exchange as an impasse
— not a screen with no button on it. The
five stages still exist, but as the COUNTERPART'S script, not a lockstep the
participant is marched through: it advances one move per reply, so every
participant meets the same fixed opening, the same standardized challenge and
the same thresholds in the same order however long they take to get there.
`counterpartStageAfter(replies)` is where that mapping lives.

**The challenge always lands before any acceptance.** The counterpart cannot
accept before it reaches its trade stage, which is after it has opened, stated
its priority and challenged. So a participant who opens with a perfect package
still has to answer the challenge — the manipulation cannot be skipped by
negotiating well. Check this after any change to `counterpartStep`.

**"Late" is decided by the clock, not by the turn count.** T_FINAL is the
relaxed closing threshold, and it applies when `secondsRemaining` is low. Tying
it to the counterpart's script position instead made the Proxy arm relax after
one direct message and Baseline after four, because the Proxy counterpart
resumes mid-script — so identical packages were acceptable at different points
depending on condition. Once both arms are at the trade stage the counterpart's
decision depends only on the package and the clock; verify that after touching
either.

**The counterpart's fixed opening must be on screen before the participant
writes anything**: it is the anchor their reply is measured against.

That seed produces **two different stage positions, and they must stay
different.** The counterpart has already *spoken* stage 1, so its next move is
stage 2 — `counterpartStageAfter(replies + SEEDED_OPENING_STAGES)`. The
participant is replying *to* that opening, so their script slot is still stage
1 — `counterpartStageAfter(replies)`. Conflating them broke it twice in a row:
without the offset the counterpart re-served stage 1 and repeated its opening
word for word, and "fixing" that by seeding `replies` at 1 moved both
positions, skipping the mockup's `b1p` and landing the standardized challenge
a message early. The Proxy arm has the same idea at a different size —
`DIRECT_STAGE_OFFSET` is 3, because through its proxy the counterpart has
opened, stated its priority and challenged.

Check the transcript, not the code, after touching either: the ideal
trajectory is ten messages, and the challenge is the fifth.

**Both sides challenge at stage 3**, each naming the *other* role's
requirement. `standardizedChallenge` is therefore keyed by the role being
challenged. Keying it the other way had a counterpart arguing against its own
requirement.

### The reason-linked acceptance rule

Design §4: the counterpart **will not concede on a requirement nobody has given
a reason for**. It asks once and defers judgement by one turn. Without it a
participant can settle the whole task by swapping options, and the outcome
stops depending on the thing this study manipulates.

Whether a reason was given is decided by the **system, from the structured
log** — never by asking a model to grade an argument. In Proxy that is the
ticked cards; in Baseline it is the reason a participant attaches to a message
via `ReasonPicker`. That control may never suggest attaching one helps, may
never default to a card, and may never treat the sensitive cards as the better
answer. And since ver.2.5 the judgement is **issue-scoped**: with cards on all
three terms, only a reason on the requirement issue counts as a reason for the
requirement — see the ver.2.5 paragraph above.

**The rule has to reach stage 5, not only stage 4.** Gating only the trade made
it cosmetic: the counterpart asked "why does that matter?", the participant
could ignore it, and the closing test accepted the same package anyway — so a
participant who never argued for their requirement got the identical agreement
as one who did, in both conditions. What is withheld is the **concession, not
the agreement**: an unexplained requirement is held where the counterpart
stands, so a deal is still reachable, just not one that hands the requirement
over. Across all four cells, giving a reason preserves the requirement (3,200)
and never giving one loses it (1,200).

**The requirement is the LAST currency the proxy spends, not the first.**
`buildProxyPlan` spends the other two terms, and touches the requirement only
if that was not enough — which on the standard mandate is never, because
handing the other side their priority term outright is already worth T_MID to
them. An earlier version seeded the package with the requirement already at its
mandated floor and then excluded it from the spendable list, so the
cheapest-first ordering that protects it never applied and it was conceded
before the negotiation started. Requirement preservation is the primary
outcome and only the Proxy arm has code that can abandon it unprompted, so
that put a mechanical difference straight into `Pooled Proxy − Baseline`.

**Concessions are chosen step by step, not issue by issue.** Ordering whole
issues by cost ratio spent the distributive term to its floor once picked, and
on a constant-sum term every point given is exactly one point gained — pure
transfer, always the worst rate, never the way to close a gap the integrative
terms could close more cheaply. A step that buys the counterpart nothing is
never taken. Across the whole mandate space this is the difference between the
proxy breaking its principal's requirement in 50% of mandates and in 31%, all
of the remainder being mandates the participant set below their own threshold.

**The state machine decides WHICH reason is voiced, and when** (ver.2.6 §7,
`designatedReason`). The proxy used to be told "state your priority, with one
authorized reason" and the model picked. Combined with the ver.2.5 cap of one
reason kind per issue per task, that meant a ticked sensitive card on the
requirement issue was never said: work reasons arrive ticked by default, the
model took one at stage 2, and the cap closed the issue for good. REASON-SCOPE
recorded a disclosure the negotiation never contained — the opposite of what
the mandate screen promises. The schedule escalates like the counterpart's own
script: the work reason at stage 2, the sensitive one after the challenge at
stage 4, and on any other issue the sensitive card when that issue carries a
trade. A card ticked on the requirement issue is therefore guaranteed to be
voiced; cards on the other terms are voiced only if that term is traded, which
is why what was AUTHORIZED and what was SAID are logged separately.

**"Each card at most once" is the schedule's job, not the validator's.** It is
kept by never designating a card twice. Making it a violation instead would be
actively harmful: budget codes are hard codes, so the whole message would fall
to the package-only fallback and its reason token would be nulled — and on the
turn carrying the requirement's reason that hands the direct conversation a
false "no reason was given", which is the inert-rule bug already fixed once
below. Prevent repetition; do not punish it.

**The Explorer's pool reasons have their own budget, and their own action
field.** The pool is a SEPARATE allowance from the principal's cards — at most
one per issue and two per task — and since ver.2.6 it rides in
`addedReasonSourceId`, beside the card rather than instead of it. Sharing one
bucket was tried and was wrong: only the Explorer adds on top of its
principal's reasons, so it hit the cap sooner and more of its messages were
stripped to a reasonless package restatement, biasing `Explorer − Delegate` on
exactly the message content the contrast isolates. Sharing one FIELD is wrong
for a second reason: the pool id would displace the card, and because each
role's exchange argument carries a null issue, the requirement's reason would
go unregistered — so the Explorer arm would arrive at the direct conversation
flagged reasonless where the Delegate arm did not. Keep both separations.

**The two pool clauses land on different issues, and must.** Stage 2 spends
the requirement issue's pool item; stage 4 spends the EXCHANGE argument, the
one pool entry carrying no issue, because that stage's move is the trade.
Pointing both at the requirement issue looks harmless and silently halves the
manipulation: each role's pool holds exactly one item per issue, so the second
request finds nothing, every Explorer participant gets one added clause where
§7 allows two, and no log shows it because one clause is a legal outcome.

**What the client receives about reasons must be constant in SHAPE, not just
opaque in content.** This has been got wrong three times in the same place.
The `pool:` prefix named the AI-added messages outright; a separate
`addedReasonToken` field named them by its presence, since only the Explorer
populates it; collapsing both into one variable-length array named them by its
length. The response therefore returns EXACTLY TWO opaque hashes on every turn
of every policy, padding with a per-turn decoy — `resolveReasonTokens` drops
anything that does not re-hash to a known id, so a decoy spends no budget and
satisfies no rule. A blocked turn returns decoys too, because an empty array
is its own one-bit tell that a guardrail fired.

**Whether the proxy argued the requirement is decided server-side, from the
principal's card alone** (`reasonForRequirement`). The client used to pair a
token with an issue id to work it out, which was correct only because of which
issue ids the designation sites happened to pass — and the stage-4 pool fix
moves exactly those ids. A pool argument is not the principal's reason: if one
could satisfy the rule, an Explorer participant who authorized nothing would
still be handed the requirement concession, 3,200 against 1,200, in one arm
only, on the primary outcome. The boolean leaks nothing, being equally true
under Delegate.

**The counterpart gives a work reason and never its sensitive one.** Ver.2.6
§4 fixes its mandate with all six cards ticked so the receiver-side stimulus is
identical for everyone; the fixed-and-identical half is implemented, the
core-issue confession is not. Its disclosure would be a STIMULUS, and one that
primes the very construct PERC and RISK measure — reciprocal self-disclosure
reliably increases disclosure, and RISK is gate 4's task-equivalence
instrument, which cannot carry a condition effect. The participant's own
proxy is the opposite case: there the disclosure IS the manipulation, so it
voices everything authorized. The same confession arriving from two different
"Other Participants" across Task 1 and Task 2 would also be a tell.

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
   provenance is recorded for audit and stripped server-side before the
   response leaves `/api/proxy-negotiation`. `DisplayMessage` has no field for
   it, so a transcript component cannot render it even by accident.

   Nothing else in the response may carry the kind either. The running reason
   budget travels as an opaque token, and an earlier version prefixed pool
   reasons with `pool` "because the token is opaque" — but the token is
   returned with every message, so the prefix said *this message's reason was
   AI-added*, per message, for the whole transcript. The per-issue budgets and
   the issue-scoped acceptance rule need each token's kind and issue, so the
   route RESOLVES the plain tokens server-side by re-hashing the known card
   and pool ids — the client carries nothing but the token, plus the reason's
   ISSUE (`reasonIssueId`), which the message text argues openly anyway.
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
5. **Which term the study is about.** All three terms are entered the same way
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
**one** practice round → **Task 1 → Task 1 questions → Task 1 bonus** →
**Task 2 → Task 2 questions → Task 2 bonus** → wrap-up → debriefing.

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

**The mandate is ONE screen: the levels on all three terms and the reason
cards.** They were two screens in sequence, which made them two decisions
taken in order — the position fixed before the reasons were considered. The
gap this study is about is precisely that the second half was never asked, so
splitting them contradicted the contribution.

Where the cards sit took care and must not be "tidied". They exist for one
term — the participant's requirement — so the obvious layout nests them in that
term's card. That breaks §5 principle 4: one of the three cards would be
visibly taller and carry a control the others do not, which tells the
participant which term the study is about without a word being said. The
reasons are therefore a section BELOW all three cards, addressed to the
requirement in their own heading exactly as the briefing presents them, and the
three term cards stay identical. `PreferenceForm` takes the section as a prop;
Baseline passes none.

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
(`DIRECT_STAGE_OFFSET`), because through its own proxy it has already opened,
stated its priority and challenged. Replaying those would make the participant
answer a challenge they watched being answered, and would give the Proxy arm
two challenges where Baseline has one.

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
for that stage already in it, the review screen shows a real ten-message
transcript and a real package, and pressing Continue from the consent page to
the completion code shows you what a participant would actually see.

Those scripts are the *ideal* trajectories: the logroll lands, both thresholds
hold, the counterpart accepts at stage 4. They are for reading the flow, not
for exercising the failure branches.

**The scripts must agree with the state machine.** All twelve cells settle at
4,200 for the speaker and 3,600 for the other side, which is what
`buildProxyPlan` independently produces from the standard mandate. A mockup
showing a package the real system would never reach is a mockup of a different
study, and this pair has drifted apart twice — check it after any change to
either file. Levels named in a message are read from the package that message
carries, never from an option index, because option order is role-relative.

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
| Atomic slot claim | `app/api/assign/route.ts` |
| Task payoffs, role stories, reason cards, Explorer pool | `lib/tasks.ts` |
| Counterpart moves, acceptance thresholds, concessions | `lib/negotiation/machine.ts` |
| The scripted ideal exchanges for mockup mode | `lib/negotiation/script.ts` |
| Model / temperature | `lib/ai/config.ts` |
| Agent behavior rules (P0–P4) | `lib/ai/prompts.ts` |
| Guardrails | `lib/ai/validator.ts` |
| Timings, payment, IRB text, completion code | `lib/study-config.ts` |
| Questionnaire items, scales, response options | `lib/measures.ts` |
| Design tokens, type scale | `app/globals.css` |
| Controls (scale, chips, buttons, cards) | `components/ui.tsx` |
| Progress bar and sticky action bar | `components/study-chrome.tsx` |
| Briefing panel and task layout | `components/session.tsx` |
| Stage rail, transcript, composer, timer | `components/negotiation.tsx` |
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
  construction: `counterpartOpening` plus the acceptance thresholds.
- **Guardrail asymmetry confirmed.** Red lines, fabricated personal facts, and
  invalid options all block. Two checks are specific to ver.2.4: an unchecked
  reason card may not be voiced under *either* policy, and a `pool:`-prefixed
  reason is Explorer-only.
- **The validator fires on live wording in ordinary runs**, usually
  `stage_mismatch` — the model claiming a stage other than the one it was
  given. The fallback absorbs it correctly: the sentence is replaced, the state
  machine's package survives, and the message count stays at ten. But it means
  the plain fallback text ("On my principal's behalf: …") will appear in real
  transcripts at some rate, so it is worth reading a sample from the pilot
  rather than assuming every message is model prose. If the rate is high, the
  fix is the prompt's stage block, not the validator.

## Still open

Nothing structural. What remains is values to fix and behaviour to exercise:

- **Pilot-dependent numbers.** Reservation (2,500), acceptance thresholds
  (T_MID = 3,600 / T_FINAL = 2,600), the advertised time, the payment (£7.50
  participation, £1.00 bonus per task — GBP because Prolific pays in it, and
  both must clear Prolific's fair-pay rate), and the Prolific completion code.
  The Member's fixed bonus is no longer on this list: no number is shown to a
  Member at all.

  On the impasse target: across the whole 256-mandate space the proxy's
  counterpackage falls below T_FINAL in 36% of mandates, against the design's
  sub-10% goal. That number is not the expected impasse rate — most of those
  mandates are hardline ones no participant is likely to set, and the standard
  mandate settles comfortably — but it is the lever if the pilot runs hot, and
  it moves with T_FINAL rather than with any code change.
- **Timing.** `STAGE_MINUTES` sums to about 55 minutes, which is what the
  consent page advertises. Design §10 gate 8 asks for a task median under 12
  minutes, and a Proxy task now contains two conversations — the proxies'
  ~2 minutes of watching plus up to 10 minutes of direct talk — so it is the
  longer of the two arms. The timer is a cap rather than a target and a
  participant who is happy can finish in three minutes, so the pilot median is
  what decides this. The lever is the reply-delay range, not the advertised
  figure, which must not drift below what the study actually takes.

- **Whether the two arms are matched on the participant's own airtime.** A
  Baseline participant writes the whole negotiation; a Proxy participant
  watches one and then writes a shorter one. That asymmetry is the design —
  delegation is the manipulation — but it means "how much did they say" is not
  a between-condition control, and any measure that behaves like a word count
  should be read with that in mind. Worth checking against the pilot
  transcripts.
- **Whether three issues survive the demand-characteristic check.** With only
  three terms each requirement is salient, and the suspicion probe may show
  that participants guessed the design. The preregistered fallback is a fourth
  (distributive) issue, which would mean recomputing every payoff property
  listed above.
- **The failure branches work but nothing exercises them automatically.**
  Impasse, the emergency stop, the reason-request branch, the reason-withheld
  close and the one revision were all verified by hand — driving the state
  machine directly and walking the interface — and the scratch scripts that did
  it are not in the repo. Mockup mode carries only the ideal trajectories, so a
  regression in any of them would be quiet. The checks worth keeping as tests:
  a greedy package impasses at stage 5; giving a reason preserves the
  requirement while withholding one loses it, in all four cells; the revision
  option disappears after one use; the emergency stop discards the package the
  exchange was heading for.
- **The counterpart principal's three templates are inlined** in `review.tsx`
  rather than rendered through P2. The *decision* between them is the state
  machine's and is correct — ratify above T_FINAL, reject below, fallback on no
  agreement — but the wording should go through `/api/counterpart` with
  `kind: "counterpart_principal"` before collection so its voice matches the
  rest of the exchange.
- Fixed vs. jittered counterpart delay · final IRB language · English
  translation of the item wording (Design §12 lists the items as Korean
  drafts; the implementation is already English and needs checking against the
  final translation).

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
