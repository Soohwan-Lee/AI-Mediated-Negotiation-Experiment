# Project notes

## Ver.2.21 alignment override

The design moved to Ver.2.21 (source of truth: `N - Experimental Design
(Ver.2.24).md`; Ver.2.22–2.24 changed measures, timing and pay, not the
ladder). Ver.2.21 changes the ladder itself, so a note written against
Ver.2.20 is not merely out of date — it describes a different study. Where an
older passage anywhere below conflicts, these rules govern:

- **The ladder has TWO rungs, not four.** Nothing, the work reason and a bare
  priority claim all land on T1 (1,000 each, JOINT 2,000); the sensitive
  background — or the AI-Supplemented abstraction of it — reaches T2 (3,000
  each, JOINT 6,000). Impasse is **0**, not 600. There is no fallback package.
- **The work reason is no longer a decoy, and SCRIPT-MISREAD is deleted.** A WR
  is now NON-DIRECTIONAL: true, safe, and says only that both terms matter.
- **A bare priority claim is cheap talk.** It buys one SCRIPT-ASKWHY and the
  same T1 package again. The `priority` tier value is gone.
- **Direct's counterpart disclosure is RECIPROCAL.** It voices its own
  sensitive background only after the participant has voiced theirs. A WR-only
  Direct session never hears it.
- **The proxy floor is T1 in BOTH arms.** The old §13-13② mode asymmetry is
  gone.
- **The Proxy mandate has ONE decision: the sensitive checkbox.** The work
  reason is a fixed utterance, shown ticked and locked.
- **Task B's Member issue is the weekly client report**, not urgent-call duty.
- Payment (Ver.2.24 §7.1): £6 base + £1 extra = £7, paid to everyone in
  practice, against a 40-minute screen budget advertised as 40. The consent
  page shows it as a £6–£7 range because role is unknown there. IRB status is
  an **exemption**, not
  an approval.
- RATIFY approval still finalizes the package immediately; only modification or
  refusal opens the three-minute conversation.
- See `docs/design-2.21-update.md` for the staged implementation and
  verification record, and `docs/design-2.20-update.md` for the version before
  it.

Online experiment platform for a 2027 CHI submission on AI-mediated
negotiation. Source of truth for the design is
`N - Experimental Design (Ver.2.24).md`. This file records the constraints that
are easy to break by accident.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · deploy to
Vercel · Supabase for persistence (planned, not wired) · `gpt-5.6-terra` at low
reasoning effort for all AI turns.

## Design in one paragraph

120 Prolific participants. Each does **one Direct Negotiation task and one
Proxy task** — never all three conditions. Proxy is either **User-Specified**
(`user_specified`: relays the reasons the participant ticked, with every fact
intact) or **AI-Supplemented** (`ai_supplemented`: replaces the sensitive card
with a fixed one-sentence abstraction, said among two cover reasons). Role is
**Leader** (high power) or **Member** (low power). Two structurally matched
tasks, A and B. Comparisons of interest: `Pooled Proxy − Direct` and
`AI-Supplemented − User-Specified`, each crossed with Role.

**Ver.2.18 renamed all three conditions and the rename is not cosmetic.**
"Baseline" named an arm as an absence, when it is the condition every claim is
about — speaking for yourself. "Delegate" and "Explorer" described a policy
that no longer exists: Ver.2.20's `ai_supplemented` does not explore for extra
arguments, it abstracts the one it was given. The type is
`Condition = "direct" | "user_specified" | "ai_supplemented"` in `lib/types.ts`
and the old strings appear nowhere except a localStorage migration in the dev
panel (see below). `baseline-task.tsx` still carries the old filename; the
component inside it is the Direct arm.

**Role symmetry is load-bearing.** Both roles hold a socially costly
requirement, mandate a proxy, receive the other side's case, and make a
post-negotiation decision about the other person. There is no receiver-only
arm to hold constant, because everyone is both sender and receiver.

**Two reason cards per role per task.** One Working Reason and one Sensitive
Background, BOTH on that role's own priority issue. The other term is what you
SPEND, not what you argue for, so it carries no card of your own.

**A card carries a reason and never a package (§4).** Which terms to trade is
an act taken IN the negotiation; the card only says why the issue is absolute.
This is what lets the justification ladder read the card's LAYER without also
reading a proposal off it.

**The work reason is NON-DIRECTIONAL, and Ver.2.21 made it so on purpose
(§3.3, §4).** A WR is TRUE and SAFE — a statement anyone in that role could say
aloud — and it says that BOTH terms are on the speaker's mind. "My analysis
scope is wide this quarter, so the workload is heavy. Both the office days and
the presentations are a burden." What it withholds is the PRIORITY: a
counterpart who hears it learns that this person is under pressure and learns
nothing about which of the two terms is the one that cannot move. There is
nothing left for them to do but split the difference.

`issueId` on a work card still points at the participant's CORE issue, because
that is the term the card is being used to argue for. The difference from
Ver.2.20 is that the card no longer points AWAY from it.

**This replaced the decoy, and the replacement is the headline design change of
Ver.2.21.** Through Ver.2.20 the WR named an interest whose obvious remedy was
the OTHER term — heavy workload is answered by fewer office days, not by
dropping the presentations — so a counterpart who heard only the WR sincerely
offered the wrong term (`SCRIPT-MISREAD`). Two things were wrong with it. It
confused participants, who had been handed a reason that argued against their
own ask and were given no way to see why their counterpart had misunderstood
them. And it bought that confusion with a whole branch of machinery — a
misread package, a once-per-task offer, an acceptance trap paying less than
saying nothing — sitting on the primary outcome.

What replaced it is the structure reviewers already know: the orange. Both
sides appear to want both terms; each actually needs only one; the exchange
works if and only if the priorities become believable. That is standard
integrative bargaining `[fisherUry1991]`, and it needs no misread branch to
make disclosure the bottleneck — a non-directional WR leaves the counterpart
with nothing to move on, and a bare priority claim is cheap talk it cannot
justify upward. **Only the SB explains why the term matters that much, so the
SB is still the sole bottleneck to the maximum** and the participant is still
never told a rule.

**Each SB is a face confession, and all six writing rules are validity-bearing
(§4).** The role brief first sets up a professional image ("the director and
the team know you as a lead whose judgement is sound"), and the SB contradicts
it. It carries one concrete incident, lands on the axis the other side was told
to weigh in their post-negotiation decision, and is the CAUSE of the role's
priority — a weakness unrelated to the ask would be noise, not signal.

**Ver.2.18 replaced all four SB cards, and the reason is rule 5.** An SB must
not be *dissolved by one request*. Ver.2.13 had already cut skill and
information gaps ("I have not learned the new reconciliation procedure") for
inviting "just say so and we'll show you". Ver.2.18 extended the same test to
FEAR and LACK OF CONFIDENCE, because two outside models read those cards the
same way a counterpart would: the natural reply is "let's practise, I'll sit
in", which makes the face cost small, stops the fact being the cause of the
priority, and reads as someone who keeps avoiding what they cannot do — a
competence verdict rather than a face cost. **What survives is a thing ALREADY
DONE**, which nobody can offer to fix:

- Leader = a judgement already committed upward. Task A: told the director four
  days a week was doable before asking the team, and the director passed it on.
  Task B: put fewer people on the plan than the project needs, so asking for
  more now would show the estimate was wrong.
- Member = an adverse CLIENT judgement kept quiet. Task A: the client contact
  asked that the lead present from now on, never passed on. Task B: the client
  contact said last month's weekly report was lacking and asked that the lead
  write it from now on, also never passed on.

Each carries a second admission with it — that it was kept quiet — and rule 6
is self-relevance: the term negotiated sits on the same axis as the confession
(a client who would rather not see you present → the presentation count).

**A card must not read as a LIE.** "The director thinks I checked with the
team" was cut for exactly this: a competence violation is recoverable, an
integrity violation is not, so a card that reads as lying carries a cost so
large it would floor disclosure in every cell and the ladder would have no
top rung to reach.

The two tasks carry DIFFERENT incidents on purpose: each task's counterpart is
introduced as a different participant, so the same confession twice would be a
tell. **Ver.2.21 made them parallel by ROLE rather than by task**, which is what
the equivalence gate needs: the Leader's card is a judgement already committed
upward in BOTH tasks, and the Member's is an adverse client verdict kept quiet
in BOTH. Ver.2.20's Task B Member card was a missed night call — a lapse rather
than a verdict, reading closer to "cannot be relied on" than to the client
judgement Task A carries — and replacing the issue with the weekly client
report fixed the asymmetry.

**No screen may name the requirement issue.** With cards on ONE issue, a
per-issue heading points straight at the term the study is about.
`IssueReasonGroups` renders the work and sensitive boxes with no issue heading
at all, and no badge marks which issue is this role's priority (design §5
principle 1). The cards name their own term in their own text, which is the
participant's own briefing. `tests/reason-rules.test.mjs` pins the invariants.

## The task, in numbers

**Two terms, four options each, both integrative** (§3.2). One is the Leader's
priority and carries the **Leader's requirement**; one is the Member's and
carries the **Member's**. There is no third term. Payoffs are in `lib/tasks.ts`
and these properties are load-bearing — if you change a number, recheck all of
them:

- **the core column is 3,000 / 1,600 / 600 / 0 and it is CONVEX on purpose.**
  Only the best option actually solves the problem: the Member's client asked
  for the lead to present, so one presentation is the answer and two is half an
  answer; the Leader answered the director "four days", so three is already
  wrong. The second option is worth about half the best and the third almost
  nothing. That is the orange peel put into numbers — a fraction of the term is
  not a fraction of the solution.
- **the non-core column is 600 / 400 / 200 / 0**, deliberately shallow but not
  flat. It has to be worth enough to stay a TRADE. At 0/100/200/300 the
  non-core issue stops being worth negotiating and giving it away costs
  nothing, which removes the exchange the task is built on.
- individual maximum **3,600** (both terms at your best); the most reachable
  while the counterpart still agrees is 3,000, which is the SB rung
- the full logroll reaches **6,000**, perfectly symmetric at 3,000 each
- **impasse is 0** (§3.2, 11th correction). There is no separate fallback
  package any more, so every agreement — including the unargued 1,000 — beats
  walking away, and nobody can hold "then we just do not agree" as a card worth
  real points. `reservationPoints` survives as a field because the screens that
  state the no-agreement figure read it from the task, so the copy and the
  outcome coding quote the same number.
- each requirement's threshold is Options 1–2 on its own issue. O1→O2 keeps it,
  O2→O3 breaks it, which is why the trajectory is reported as transitions and
  never summed

**Ver.2.15 restated the scenario in everyday terms, and Ver.2.21 replaced one
of the four issues.** It is a project team at an ordinary company — a team lead
and a senior team member — rather than a consulting agency. Task A is **"Next
Quarter's Working Arrangements"** (days a week in the office × client meetings
the Member presents at); Task B is **"Starting the New Project"** (days a week
on the new project × **weekly client reports the Member writes, out of 4**).
Task B's Member issue was urgent-call duty through Ver.2.20; see the SB
paragraph above for why it moved. The point of §3.1's self-relevance
requirement is unchanged and is what all four terms still carry: each issue is
one the other party's own competence or judgement rides on, which is the
condition White et al. (2004) needed for face threat to suppress joint gain.
The payoff spine is untouched by either rewrite.

**The justification ladder is SYMMETRIC and has TWO rungs** (§3.3, §6.2). How
far the counterpart moves is decided by the best thing the participant side has
VOICED — and it asks for exactly as much as it gives. Both cores land on the
same rank. `TIER_LIMIT_INDEX` in `machine.ts` is the authority:

| Voiced | Both cores land at | Participant | Counterpart | JOINT |
|---|---|---:|---:|---:|
| nothing | 3rd option | 1,000 | 1,000 | 2,000 |
| **work reason** | **3rd option** | **1,000** | **1,000** | **2,000** |
| bare priority claim | 3rd option, after one "why?" | 1,000 | 1,000 | 2,000 |
| **sensitive background** (or its abstraction) | **best option** | **3,000** | **3,000** | **6,000** |
| impasse | — | 0 | 0 | 0 |

**`none` and `work` share a rank, and Ver.2.21 collapsed the priority claim
into them too.** `ReasonTier` is back to three values —
`"none" | "work" | "sensitive"` — and `TIER_RANK` orders them for `foldTier`.
Hearing a non-directional work reason tells the counterpart that both terms are
on this person's mind, which is the same information as silence for the purpose
of deciding where to land.

**A bare priority claim buys exactly one question and nothing else.** "The
presentations matter more to me than the office days" is unverifiable, and the
person on the other side has to justify an unusual concession to their own
director and their own team — a claim they cannot repeat upward buys them
nothing. So the counterpart asks once (`SCRIPT-ASKWHY`, "I would like to hear
why") and, absent an answer, puts the same T1 package up again. It travels as
`priorityClaimed` on the exchange state rather than as a tier value, and
`state.askedWhy` spends the question. **The 1,000-to-3,000 gap is exactly the
instrumental value of the SB**, and it is the whole reason the ladder has a
gap at all.

**Ver.2.21 deleted the misread branch entirely.** `misread`, `misreadPackage`,
`SCRIPT-MISREAD` and `misreadOffered` are gone from `machine.ts` and from
`acceptablePackage`. With a non-directional WR there is nothing for the
counterpart to sincerely misread, so the branch had no trigger; and the 600 /
1,900 trap it carried — an offer that paid less than saying nothing — was a
real cost sitting on the primary outcome. Do not reintroduce a sincere-mistake
branch to "make the WR do something". The WR doing nothing IS the finding.

**The symmetric rule itself is older and the reason still matters.** Ver.2.12
held the counterpart's own core at its best on every path and conceded only on
the participant's. §2.6 gives two grounds for dropping it. One: a counterpart
that opens "my best, your worst" and never moves off its own core is itself a
face threat — exactly the non-negotiable, lowball offer White et al. (2004)
identify — so a high-FTS participant was pushed into competing by a route that
has nothing to do with self-disclosure. Two: a ladder where only the
participant loses reframes disclosure as "giving in to them" rather than as
buying credibility.

Three consequences, all deliberate:

- **JOINT IS the ladder.** One value per rung — 2,000 or 6,000, plus 0 for
  impasse — so JOINT alone identifies the tier reached. That is why §9.6 could
  delete UNLOCK, CONCEAL-PREMIUM, MAX-JOINT and `outcome`: they were four
  indicators computed off one number. Points and JOINT are collinear by
  construction (Points = JOINT/2); §3.4 tests on JOINT and reports Points only
  as the context for what the participant saw.
- **Disclosure is the only bottleneck to the maximum.** The counterpart
  proposes at its rung (`SCRIPT-PROPOSE-T{tier}`) rather than leaving the
  maximum to be discovered — so negotiation skill cannot be what separates
  outcomes, which is what makes the contrast interpretable.
- **Acceptance is the tier package EXACTLY, refused in both directions.** An
  over-ask asks for more credibility than was earned; an UNDER-ask is refused
  too (`SCRIPT-BALANCE`), so a participant's over-concession cannot drag the
  outcome below the rung they paid for. Ver.2.12 accepted under-asks.

**The counterpart's opening carries no package and no priority of its own**
(§6.1). `SCRIPT-OPEN` gives the counterpart's own non-directional work reason —
"both of these are on my mind" — and asks about the participant's SITUATION.
Naming its own priority would hand the participant the move the study is
watching for, and it would spare them meeting a non-directional reason from the
RECEIVING side, which is the other half of what makes the structure legible.
`state_priority` is gone from `DecidedAction` with the stage that used it. The
first package anyone sees is the symmetric T1.

**A bare point number is not information, so two anchors travel with it.**
`PointsKey` names the most the task could pay this participant (3,600) and what
no agreement pays (0); `PackageValue` prices a selected package against that.
Both are already the participant's own, so neither discloses anything the
design withholds. Neither may ever show the other side's numbers, the joint
total, or any hint that trading term against term pays better than splitting
each one: finding the logroll is the behaviour being observed (pilot gate 6).
**Nor may a screen price a position as a forecast** — the wish screen labels
its two figures as what each POSITION is worth, since under the ladder where it
lands depends on the reasons voiced.

Each requirement is worth 3,000 on purpose. If it were cheap, giving it up
would be explicable as a sensible low-priority concession — exactly the thing
this study has to distinguish from withdrawal under evaluative pressure.

## Who decides what in a negotiation

`lib/negotiation/machine.ts` decides the moves: offer levels, the credibility
tier, acceptance, and termination. The negotiating models only say those moves
in the right voice. Keep it that way. A counterpart whose judgement is the
model's is a different counterpart for every participant, and it is why the
design does not need to randomize outcomes: identical behaviour already
produces identical results.

**One model does read the participant's words, and it is not a negotiator.**
Ver.2.20 abolished the reason-card buttons, so something has to decide which
rung each free-form message reached; that is P5, below. §6.7's LLM 비관여 rule
is about the DECISION, and the decision is still `machine.ts`.

**Six stages (§6.1), and stage 3 is not a message.**

1. **opening** — its own non-directional WORK reason and a question about the
   participant's situation, and **no package and no priority of its own**
   (`SCRIPT-OPEN`). Fixed.
2. **first reason opportunity** — the participant's first chance to give a
   reason. In Direct this stage runs until a reason actually ARRIVES, not until
   the first message: a reasonless opener gets `ask_sit` (SCRIPT-ASKSIT) once,
   and a second reasonless turn settles it as "no reason" and moves on.
   `reasonlessTurns` counts them.
3. **lock** — a system recording moment. `counterpartStageAfter` walks
   1 → 2 → 4 → 5 and never serves it. **The turn boundary is the moment the
   counterpart's reply renders**, so several participant messages sent before
   it count as one turn.
4. **disclosure** — the counterpart voices its own SB card once. **In Direct
   this is RECIPROCAL** (below); in Proxy observation it keeps the fixed
   schedule.
5. **conditional trade** — bounded by the tier. `ask_why`, `clarify`, `nudge`,
   `balance` and `propose_tier` all live here.
6. **close** — acceptance, or impasse when the clock runs out. **A valid
   acceptance ends the task at once** and does not wait for an intervening
   disclosure stage.

**Direct's counterpart disclosure is RECIPROCAL since Ver.2.21, and this is a
real change with a real cost** (§6.3). The counterpart voices its own sensitive
background only AFTER the participant has voiced theirs. `disclosurePolicy` is
`"reciprocal"` in Direct and `"fixed"` in Proxy observation and in the Proxy
closing; `counterpartSbDisclosed` spends it. It is split into two or three
short bubbles by `splitIntoBubbles`, at sentence seams — a confession broken
mid-clause is a stronger tell than a long bubble.

Why it changed: an unconditional confession, arriving on a fixed schedule
regardless of what the participant said, is a stimulus the participant did
nothing to earn, and it primes the very construct PERC measures for everyone
including the people who chose to stay silent. Reciprocity ties it to the
participant's own act, which is what the delegation contrast is about.

**What it costs, stated rather than designed away: a WR-only Direct session
never hears the counterpart's SB at all.** So the PCR items about the other
side's disclosure — PCR1–3 on reading their situation, and the receiver-side
face judgements — only apply on the path where the participant disclosed first.
That is a selective exposure by an outcome variable, and §6.3 says plainly that
the analysis set for those items and the old PRE/POST disclosure framing must
be re-specified before the study runs. It is not a bug to close by restoring
the unconditional schedule.

**The disclosure changes no tier and carries no demand or package**, in either
arm. And it never announces itself: a proxy that opens its SB with "my
principal has authorized me to share this" states a permission structure no
policy applies and tells the receiver exactly where to look.

**The participant's conversation is free-form, bounded by a clock.** Ten
minutes in Direct, three in the Proxy arm's closing (`CLOSING_SECONDS`) — the
ground work there is already done. They write as many messages as they like and
may finish early. Running the clock to zero is an outcome; `onExpire` closes the
exchange as an impasse.

**The Proxy arm's closing conversation is CONDITIONAL on RATIFY** (September 6
correction; the override at the top of this file governs). Approving finalizes
the package and ends the task; only modify-or-reject leads here. It was
unconditional for a while, and the cost of reversing that is recorded in full
under RATIFY below: the amount of contact with the other side is no longer
constant within the Proxy arm, and it covaries with an outcome variable. What
buys that cost back is that `RATIFY` is the confirmatory measure of the
construct the study is about, and an approval that changes nothing about what
happens next is not a decision.

**When a closing conversation does happen, both arms end the same three ways**,
so "how did it end" is never a between-condition artefact:

1. a package the counterpart accepts by the ladder,
2. an explicit **"Accept their proposal"** button — deterministic, so no model
   ever reads the participant's words to decide whether they agreed,
3. the clock — one `SCRIPT-CLOSE` offer near the end, then impasse.

**The clock outranks the tier's own proposal.** Without `soft_close`
(SCRIPT-CLOSE, offered once below `SOFT_CLOSE_SECONDS` = 90) a participant who
kept asking off-tier would meet the same refusal every turn and run out at
**0** — below the 1,000 a participant who said nothing gets, and below the
3,000 an SB buys, inverting the ladder for whoever paid the most. Since
Ver.2.21 impasse pays nothing at all, so this guard matters more than it did.

**Silence gets a visible question too.** `nudge` (SCRIPT-NUDGE) fires once
after `NUDGE_AFTER_SILENT_SECONDS` = 60 of participant silence. The client
watches the clock and sets `participantSilent`; the machine owns whether the
nudge is still available.

**A refusal leaves nothing standing.** `openingPackage` is null and the
composer starts empty — passing the refused package back in would put up
exactly what the participant just refused, for the counterpart to treat as an
offer on the table.

**The counterpart's fixed opening must be on screen before the participant
writes anything**, so they never arrive at an empty conversation.

That seed produces **two different stage positions, and they must stay
different.** The counterpart has already *spoken* stage 1, so its next move is
stage 2 — `counterpartStageAfter(replies + SEEDED_OPENING_STAGES)`. The
participant is replying *to* that opening, so their own script slot is one
behind. Conflating them broke it twice before. The Proxy arm has the same idea
at a different size — `DIRECT_STAGE_OFFSET` is 3, because through its proxy the
counterpart has already opened, argued and disclosed; replaying those would
make the participant sit through a disclosure they just watched.

### How the tier is decided: the P5 classifier

**Ver.2.20 §6.2a abolished the reason-card buttons; Ver.2.21 rewrote what the
classifier is asked.** Through Ver.2.19 a Direct participant tagged each message
with the card they were drawing on and the tag set the tier. Now the Direct arm
and the Proxy arm's closing are **free conversation**: the participant simply
talks. A **separate, single-purpose classifier** — prompt P5,
`/api/classify-reason`, `buildClassifierPrompt` — reads what they said and
returns a label. `LABEL_TIER` maps it onto the ladder and `foldTier` raises the
running tier.

**Why the buttons went, and it is two reasons.** Pressing "[sensitive
background]" is a more deliberate act than simply saying the thing, so the tag
risked a floor on the primary outcome. And — worse — it made Direct something
other than "just talking", so `Pooled Proxy − Direct` would have compared two
INTERFACES rather than two ways of being represented, which is the contrast the
whole study is built to make.

**THE INPUT IS CUMULATIVE, and this is Ver.2.21's most important change to the
route.** The body carries EVERY message the participant has sent in this task,
in order, and the output is the highest label reached ACROSS ALL OF THEM —
never a verdict on the latest one alone.

```
POST /api/classify-reason
  { taskId, role, messages: string[] }        // all of them, in order
→ { label: "none" | "WR" | "SB",
    priority_claim: boolean,
    confidence: number,
    stance: "accept" | "counter" | "none",
    counter_terms?: Record<issueId, optionId>,
    stubbed?: true }
```

Why cumulative: people do not confess in one message. They say "so, about the
presentations" / "the client said something after the last one" / "I never told
you". Judged one message at a time, with the ties-downward rule below applied
to each, none of those three reaches `SB` and the disclosure is scored as
never having happened. That produces a **systematic floor on Direct disclosure
specifically** — the Proxy arm has no such problem, because a checkbox does not
have to be said in one breath — and a floor on Direct is exactly the shape of
the result the study is looking for. It would have been read as the Proxy's
protective effect. This is the single easiest way to invalidate the primary
contrast, so do not "optimize" the route to send only the newest message.

**The label set is `none / WR / SB`, and `PRI` is gone from it.** A bare
priority claim comes back as `priority_claim: true` beside a `WR` or `none`
label, because it says something real about the conversation without buying a
rung. `LABEL_TIER` still accepts `PRI` as an alias mapping to `work`, purely so
a stale client, a replayed log or a model that has not read the new prompt
cannot crash a live turn or put `undefined` where a tier belongs.

**`stance` is how an acceptance is detected without a model deciding anything.**
`accept` means the participant agreed to what is on the table; `counter` comes
with `counter_terms`, the levels extracted from their words, which the client
resolves into a package and hands to `machine.ts` as `incoming`. The
classifier reports what was said; `acceptablePackage` still decides whether it
is agreed.

Six rules hold the whole thing in place, and each closes a specific way it
could go wrong:

- **The classifier is not part of the negotiation.** It writes no text anyone
  sees, holds no conversation state, speaks for nobody, and never reaches the
  participant. The label goes to `machine.ts`, which decides the package as it
  always did. The counterpart's own model is never asked to judge an argument.
- **Ties go DOWNWARD.** The prompt instructs the lower label whenever two are
  in play. A missed SB is recoverable — the participant can say more, and the
  tier only ever rises. A concession already granted cannot be taken back.
- **Low confidence draws a QUESTION rather than a guess.** Below
  `CLARIFY_CONFIDENCE_FLOOR` (0.6), and only while the label is below `SB`, the
  counterpart's next move is `clarify` (SCRIPT-CLARIFY) instead of a proposal.
  It is once PER TIER, not once per task — `clarifyUsedForTier` holds which —
  because someone who clarified their way up to `work` may still be vague about
  an SB later, and that later case is exactly what the script is for. **This is
  the partial answer to the invisible-failure problem below**: it turns a
  missed disclosure from something the participant cannot see into a visible
  request for more.
- **The tier only ever RISES**, enforced by `foldTier` in all three places that
  need it (the Direct loop, the Proxy closing, the route's own log). Two
  hand-written ternaries would eventually disagree.
- **A classifier failure is unresolved, never `none` or a guess.** The pending
  turn is held for retry and the tier does not change until classification
  succeeds. Normal ambiguity within a valid model response still goes to the
  lower label; a network error is not evidence for any label. The route also
  returns `stubbed: true` when there is no API key, because
  `{label:"none", confidence:0}` from an unconfigured deployment is otherwise
  byte-identical to a genuine "they said nothing" — which would look like a
  study where every Direct participant happened to stay silent.
- **Every `{text, label, confidence}` is stored for post-hoc human re-coding**,
  reported as κ against the classifier with a sensitivity analysis excluding
  disagreements (§6.2). **Gate 19 requires κ ≥ .90**; below it the study
  switches to Wizard-of-Oz tagging (§13-24). It travels as
  `classifierLog` (JSON) inside `negotiation_t{n}`; persistence lands with
  `/api/persist` — see docs/DATA_MODEL.md.

**The cost is real and is stated plainly rather than designed away: the failure
mode is largely invisible to the participant.** Someone whose SB is missed at
high confidence experiences "I said it and it didn't land", with nothing on
screen to tell them otherwise. `clarify` catches the uncertain cases; it cannot
catch a confident mistake. §6.2 accepts that because the cards are fixed and
few, and gates it with the κ requirement above. Do not add a confirmation
affordance to "help" — a control that tells the participant their disclosure
registered is a card button again, with the same deliberateness cost, and it
would put the interface difference back into `Pooled Proxy − Direct`.

**`tierOf` survives, and it is the PROXY path only.** There the participant's
checkbox decides whether the SB is voiced, so the layer is known without
reading anything — the function still reads LAYERS, never text. The Direct path
and the Proxy closing go through the classifier instead. In the Proxy closing
the two meet: the tier starts from what the proxy actually VOICED (not what was
authorized — a guardrail block can strip a reason, and assuming otherwise made
the rule inert for a whole arm once already) and is folded with whatever the
participant says in person. A confession made there is recorded as
`SB-TIMING = wrap_up`, and at that point the counterpart puts best↔best up
itself.

**The proxy's floor is T1 in BOTH arms since Ver.2.21, and the old asymmetry is
GONE.** `buildProxyPlan` folds only `"work"` in unconditionally, because the
work reason is a fixed utterance the proxy always says (§8.7). A proxy handed
its principal's preferred package still knows which term matters more and still
says so — it declines the counterpart's T1 once and states the priority — but
under the two-rung ladder that claim buys nothing. The counterpart asks why,
the proxy has nothing more it is allowed to say, and it takes T1 as the
tentative package.

Do not restore a tier-2 proxy floor to "make the proxy competent". The point of
the change is that both arms now bottom out at the same rung, which removes the
mechanical component §13-13② had to document in every Mode difference in
Points and JOINT. `SB` remains the confirmatory outcome and JOINT stays
secondary, but for the ordinary reason (JOINT is a function of one binary
choice), not because the arms were built unequal.

The live simulation found the other end of this wire the hard way once: the
route derived the counterpart's tier straight from `tierOf` on the token log,
so the counterpart offered a package the proxy had already argued past, and the
proxy — whose instructions are to accept when it has nothing left — took it.
An AI-AI exchange has no participant in it to notice. **Read the tier through
the plan, not through the log.**

**The fixed scripts (§6.4)** are `DecidedAction` values, not prose in a
component: `open` (SCRIPT-OPEN), `ask_sit` (SCRIPT-ASKSIT, once),
`disclose_sb`, `ask_why` (SCRIPT-ASKWHY, once), `clarify` (SCRIPT-CLARIFY, once
per tier), `nudge` (SCRIPT-NUDGE, once), `propose_tier`
(SCRIPT-PROPOSE-T1/T2), `balance` (SCRIPT-BALANCE), `accept` / `accept_sb` /
`disclose_sb_and_accept`, `nonum` (SCRIPT-NONUM), `soft_close` (SCRIPT-CLOSE),
`impasse` (SCRIPT-FALLBACK).

**`disclose_sb_and_accept` is the one combined action, and §6.1 stage 6
requires it.** When an SB and a valid T2 acceptance arrive in the same turn,
both the confession and the accepted levels have to survive into ONE reply —
otherwise a participant who discloses and agrees in one message sits through a
disclosure turn before their own agreement is answered. It is rendered
deterministically by `reciprocalAcceptanceText` rather than generated, because
free rendering plus a length cap could trim one half while keeping the other,
and the client codes settlement off exactly this turn.

Ver.2.13 merged four names into `propose_tier`: SCRIPT-FAIR, SCRIPT-LIMIT,
SCRIPT-ACCEPT-SB and SCRIPT-PROPOSE-MAX were one move — "here is what this tier
buys" — at different depths, which under the symmetric rule differ only in the
rank they name. `balance` stayed separate because refusing a LOPSIDED package
is a different speech act, and it is the one a participant meets after an
over-ask *or* an over-concession.

**THE ORDER OF THE GUARDS IN `counterpartStep` IS THE DESIGN.** Expiry, then
the acceptance that outranks it, then the no-numbers reminder, then reciprocal
disclosure, then acceptance, then the clock's soft close, then the questions
(`clarify`, `ask_why`, `ask_sit`), then the proposal. Each is commented where it
sits. `ask_why` is reached from a bare priority claim; `ask_sit` from a turn
carrying no reason at all. They are different questions and neither may be
folded into the other.

**The counterpart route returns no action name, and that is a deception
control.** The response is `{ message, proposal, state, settled }` — and
`settled` is `"agreed" | "impasse" | null`, the OUTCOME, never the move. A
participant who opens the network tab and sees `action: "propose_tier"` has
just learned the other party is machinery, which is the one thing this arm
cannot survive. The client re-runs `counterpartStep` itself from the same
inputs and gets the same answer, because the machine is deterministic; what it
cannot safely re-derive is which one-shot flags this turn spent, so `state`
comes back explicitly.

**The no-numbers reminder is one-shot and the CLIENT is authoritative about
it.** §8.1 forbids telling the other side your score; `mentionsScoreNumbers`
screens for it and the counterpart reminds once, then ignores it. The request
carries `numbersMentionedNow` because the same package is `nonum` (no
agreement) when true and `accept_sb` (agreed) when false — a participant could
otherwise be shown "let's not talk scores" and recorded as having agreed. The
route's own history scan survives only as a fallback for a caller that does not
send it.

**The proxy voices an authorized SB at its FIRST reason opportunity**
(`designatedReason`, §6.5), not after a challenge. `SB` is the participant
side's first-disclosure choice, so a schedule that held the card back would
record every Proxy participant as a non-discloser regardless of what they
actually authorized.

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

### The AI-Supplemented policy: it ABSTRACTS, and it speaks as ITSELF

**Ver.2.20 deleted the role-plausible pool and its budget entirely** (§6.6).
Through Ver.2.19 the policy ADDED pre-approved general arguments beside the
principal's card, at most one per issue and two per task. That whole apparatus —
`designatedPool`, `voicedPoolId`, the per-issue budget, the `pool:` prefix and
its guardrail — is gone.

**Ver.2.21 changed the SPEAKER, and that is the substantive change.** The
AI-Supplemented proxy no longer relays anything as its principal's. It gives
**its own assessment**: a fixed `frame` sentence — "Looking at the side of the
team member I represent, I think the presentations should come down this
quarter. Three reasons —" — followed by the abstraction and two covers as
**subjectless declaratives**, shuffled, with **no attribution to the principal
on any of the three**.

**Why the attribution was dropped.** Through Ver.2.20 the abstraction still
said "the team lead I represent has already spoken about this upward", so every
sentence pointed back at the principal and responsibility went there whole. The
two policies then differed only in HOW MUCH DETAIL arrived — AI-Supplemented
was a shorter User-Specified — and the delegation questions (`OTHER-AI2`
source discrimination, `OTHER-AI3` authorization inference, `OTHER-AI4` and
`ATTR2` responsibility) had nothing to separate. With the frame carrying the AI
as speaker and the three sentences carrying no subject, what the receiver is
left with is "an AI is recommending this term for three reasons", and which of
the three came from the person is not decidable from the sentences. That is
the maximum an AI can say in its own name, and whether attribution still lands
on the principal anyway is the thing being tested.

**The covers are GRADED, and the grade decides which path uses which** (§6.6,
12th correction). `cover[0]` is **WR-grade** — role generality of the "both
terms need attention" kind. `cover[1]` is **SB-grade** — why the term matters
that much. They are used on different paths:

- **SB ticked** → at the first reason opportunity, the frame plus
  `[abstract, cover[0], cover[1]]` **shuffled** into one message. `SB-abs`,
  tier 2.
- **SB not ticked** → the work reason as an ordinary third-person relay, and
  then on the turn where the proxy declines T1 and states the priority,
  `cover[0]` alone, appended as the proxy's own view ("as I see it, …"). Fixed
  position, not shuffled, so sessions stay comparable. It moves no tier —
  it is role generality, not this person's situation. `cover[1]` is never used
  on this path.

That second rule is why the policy difference is visible on the WR-only path at
all. Without it, a participant who ticked nothing would experience the two
policies identically, and `AI-Supplemented − User-Specified` would be estimated
only among disclosers.

Five things about it are load-bearing:

- **All sixteen sentences are FIXED on the cards** (`frame`, `abstract` and the
  two `cover` entries in `lib/tasks.ts`), not generated. The manipulation IS
  the wording: a model writing its own abstraction each turn would vary how
  much of the fact survives, and how much survives is the independent variable.
  The model only joins them into one natural message.
- **The three sentences must share one grammatical form** — subjectless
  declaratives. A predicate difference ("they say…" versus "as I understand
  it…") sorts the principal's sentence out of the three on form alone, and the
  frame is the one sentence that carries a speaker.
- **Position must carry no signal**, hence the `shuffle`. If the abstraction
  were always first (or last), a receiver could sort it out by layout, and
  `OTHER-AI2` would measure a formatting convention instead of the
  manipulation.
- **Both policies produce the SAME points.** They differ only in what the
  counterpart LEARNS. That is deliberate: a policy that reached further would
  confound `AI-Supplemented − User-Specified` with concession reach, and
  `buildProxyPlan` computes identically for both.
- **No policy may add a reason of its own.** `addedReasonSourceId` survives in
  the schema purely as a tripwire: any value in it is a
  `provenance_policy_violation` under EITHER policy, because the §6.6 sentences
  are supplied by the route and there is nothing legitimate left to put there.

**The abstraction stops at "something happened", and the stopping point is the
rule.** It keeps the KIND of fact and its link to the core term — "on the
presentations, there has been feedback from the client side" — and drops the
event, the third party's words, the concealment, and the personal attribution.
User-Specified reaches "why am I only hearing this now?"; AI-Supplemented stops
at "there was something". It is still tier 2 because a circumstance specific to
that side is what the counterpart needs in order to justify moving upward. A
cover must never gesture at the SB's content ("the director is watching this
too") — all three have to read as reasons the term should go that way, or the
abstraction stops being hidden among them.

**The sentences are appended to the finished message, not requested in the
prompt.** As an instruction the addition competed with the card instruction on
the same turn and lost about three times in four, while the schedule spent the
budget regardless — so a dropped clause was recorded as voiced. The route
places them itself.

**The live simulation caught the way this fails silently.**
`abstractedSentences` was computed, protected in the cap, and used for the
retry check — and never put into the prompt context, so P4 rendered "(none this
turn)" and the model improvised. The AI-Supplemented arm was running as a
paraphrase of User-Specified, with a plausible transcript and wrong data. If
the manipulation ever looks weak in a pilot, check that the sentences reach the
prompt before you touch the wording.

**Message SHAPE is enforced on the text, not asked for in a prompt.** Two
things travel together in `capMessageLength`, and both were prompt-only once
and both failed. `compactChatBubbles` runs on the Direct counterpart only
(`counterpart/route.ts`), because that voice is a person typing short bubbles
while the proxies speak in plain third-person sentences
(`proxy-negotiation/route.ts`):

- **Every AI message is bubble-split and under 420 characters**
  (`NEGOTIATION.maxMessageChars`). The `||` rule lived in `HUMAN_CHAT_STYLE`,
  which only P1 and P2 ever saw, so the two proxies — the only thing a Proxy
  participant watches for minutes — wrote one 220-character paragraph a turn,
  16 turns out of 16. It is in `SHARED_RULES` now, and the cap is applied
  rather than requested: §7's exposure control exists so one policy cannot
  simply say MORE than the other, and unenforced it did (226 characters against
  194, longest 471 against 401 — a contrast the policy manipulation would have
  carried).

  **The cap was 280 and could not fit the manipulation.** §6.6 fixes the
  AI-Supplemented reason turn at a frame plus three sentences, which run past
  what 280 allows before any reply clause. Live runs came back with the
  abstraction alone and both covers dropped, which collapses the policy into a
  shorter User-Specified. Raised to 420. **The control was never the absolute
  number — it is that ONE cap applies to both policies**, and gate 9 reads
  realised lengths, not the cap. Lower it again only after checking the longest
  §6.6 turn still fits.
- **The cut is taken at a bubble seam, and never from a clause that carries
  meaning.** `capMessageLength` takes protected clauses in PRIORITY ORDER.
  Under User-Specified that is the principal's card. Under AI-Supplemented the
  card is never said at all — the frame and the three §6.6 sentences ARE the
  message — so the **abstraction is protected first and the two covers after
  it**, for the same reason the card comes first: it is what the ladder is
  driven off, and losing a cover costs only some of the cover.

  Both halves were learned the hard way. Cutting from the end removed whichever
  clause the model wrote last — the cap undoing the manipulation it was written
  to protect. Protecting only the addition then pushed the CARD out, which is
  worse: the schedule records the card as voiced and the ladder is driven off
  that record, so a participant was credited with a disclosure nobody heard.
  Matching is by CONTENT OVERLAP, never containment — a proxy is required to
  reframe rather than quote (§6.6), so a containment match finds a verbatim
  sentence every time and the reframed card never. That one detail made the
  failure POLICY-CORRELATED: 4 of 4 User-Specified generations kept the card
  against 1 of 4 AI-Supplemented ones, which is a bias in
  `AI-Supplemented − User-Specified` itself.

### The proxies speak in the THIRD PERSON

**Ver.2.19: both proxies introduce themselves and refer to their principal as
"the team lead I represent" / "the team member I represent".** Never "I" about
the principal's situation. If the proxy sounds like the person, the delegation
stops being visible — and the delegation is what both policies are variants of,
so an invisible one makes the Mode contrast unreadable and OTHER-AI4
(responsibility attribution) unanswerable.

The mockup's scripted exchange got this wrong by pasting card text verbatim, so
the proxy claimed its principal's confession as its own ("the client contact
pulled me aside… I never repeated that to you"). On screen that is
indistinguishable from the participant speaking.

**The fix is a written `relayed` field on every card, not a derivation.** A
pronoun-substitution pass was tried first and produced broken sentences on
exactly the clauses carrying the confession — "they'd rather the other side
delivered these yourself" — because the cards address the counterpart as "you"
while reporting a third party's words. Both persons of a load-bearing sentence
are worth writing once. Do not replace `relayed` with a transform.

**And a disclosure carries no label on itself.** The counterpart proxy once
opened its SB with "My principal has authorized me to share their side of it",
which announces a permission structure no policy applies and tells the receiver
where to look.

**What the client receives about reasons must be constant in SHAPE, not just
opaque in content.** This has been got wrong three times in the same place. The
response returns EXACTLY TWO opaque hashes on every turn of every policy,
padding with a per-turn decoy — `resolveReasonTokens` drops anything that does
not re-hash to a known id, so a decoy spends no budget and satisfies no rule.
Since Ver.2.20 the second slot is ALWAYS a decoy, because there is no second
reason id left to carry; the width stays two so the shape does not change. A
blocked turn returns decoys too, because an empty array is its own one-bit tell
that a guardrail fired. `voicedTier` travels as a rung name for the same
reason: it describes the participant's own side's rung and is identical under
both policies.

**`voicedTier` must carry the proxy's floor — AND SO MUST THE CLIENT THAT
RECEIVES IT. This wire broke TWICE, once at each end, and the lesson outlived
the rung it was about.** A closing conversation that loses the floor starts
below what the participant just watched the proxies reach.

The first break was the route's, which sent the wrong rung. The second was
`proxy-task.tsx`, which was still throwing the floor away after the route was
fixed, in three places at once: the state was typed with a locally written
union, the response was RE-DECLARED INLINE — which is why `tsc --noEmit` stayed
clean and never saw the mismatch with the route's own type — and the fold was a
hand-written ternary.

**Nothing in the test suite or the simulation could catch it**, and the reason
is worth remembering: `scripts/simulate-negotiation.mjs` preserved the value
correctly, so the app and the simulation implemented DIFFERENT logic at the
same point and only the simulation was right. Every automated check passed
while the Proxy arm quietly paid a rung too little, on Points and JOINT, along
the primary contrast.

Ver.2.21's two-rung ladder narrows the blast radius — a proxy that voiced only
the work reason now genuinely sits at T1, so losing "the floor" between route
and client no longer costs a rung on that path — but the rule stands and the
SB path still depends on it. Both ends use `foldTier` and the shared
`ReasonTier`. Do not re-type this value locally, and do not fold it by hand:
the shared type is the only thing that makes the two ends agree, and a local
union silently opts out of it.

## The parting comment: REMARK and ATTR

**Ver.2.14 §6.8, §9.4.9.** After each post-negotiation decision the participant
is shown one line "the other participant left for you", and may leave one back
(optional, never analysed — it is there so a one-way comment does not read as
odd). Then ATTR1 (everyone), ATTR2 (Proxy only, because there must be a Proxy
to point at) and one written answer, `OE-ATTR`.

It is transplanted from chen2026's "AI phantom limb" procedure: a client leaves
a one-line comment for an agent, and the finding is that NEGATIVE feedback
aimed at the AGENT is still internalized by the person who delegated. That is
this study's delegation–protection gap in another domain, so §6.8 imports the
procedure to ask whether delegation moves the RECEIPT of an evaluation as well
as the speaking of it. It is the **fourth deception**, retracted at
`/debriefing` with the other three.

Five rules, each a constraint that makes the contrast readable:

1. **Constant wording.** The same text for every tier, condition, role and
   task. **The only thing that changes is who it points at — the participant,
   or their Proxy — and that difference IS the Mode.** Tiering the valence
   would tangle the comment with the outcome the participant earned;
   randomizing it would halve every cell (chen2026 needed 355 between-subjects
   for η²p = .013). The impasse variant changes only the first sentence,
   because "glad we sorted it" would be false.
2. **Style only, never the reasons.** A comment on what was disclosed would
   tangle with the disclosure decision and become a face attack of its own.
3. **Mildly negative, and TRUE.** "It threw me a little" rather than
   chen2026's "awful" — and everyone opens at their preferred package on both
   terms, so "you pushed hard at the start" is accurate in every session.
4. **After every confirmatory measure.** PERC, PCR, PNPQ, PNOQ, OWN/OTHER-AI
   and the post-negotiation decision are all done before this appears, so it
   cannot contaminate RQ2. This is why it is its own screen
   (`src/app/task/[index]/remark.tsx`) and cannot be folded into the battery.
5. **Disclosed at debriefing** as one of the four deceptions.

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
   The PROXIES are the opposite case and must not be "fixed" to match: they
   speak as third-person representatives on purpose (Ver.2.19, above).
2. **Which condition they are in.** Tasks are labelled "Task 1" and "Task 2",
   never "Direct"/"User-Specified"/"AI-Supplemented". The URL carries only the
   task index. The *policy* is disclosed (both principals are told how their
   proxy may use their reasons — §7 requires it, and OTHER-AI3 is unanswerable
   otherwise); the *condition name* never is.
3. **Which of the three sentences carried the real fact.** Internal provenance
   is computed for the audit and stripped server-side before the response
   leaves `/api/proxy-negotiation`. `DisplayMessage` has no field for it, so a
   transcript component cannot render it even by accident. Under
   AI-Supplemented the abstraction and its two covers are shuffled and
   unlabelled precisely so the answer is not available from layout either —
   `OTHER-AI2` asks the discrimination question and must be measuring the
   manipulation, not a formatting convention.

   **It is not yet PERSISTED anywhere, and that is deliberate rather than
   forgotten.** `logGuardrailEvent` exists on both stores and has no caller,
   because the only place provenance may be written is the SERVER — handing
   it to the client to save, the way messages are saved, is precisely the
   per-message tell the next paragraph forbids. The same is true of the
   classifier's `{text, label, confidence}` log, which gate 19's κ depends on.
   Both writes land with `/api/persist`, which holds the service-role key.
   Until then the audit's only source is `npm run simulate`. Do not delete
   either end of that wire to silence an unused-symbol warning; see
   docs/DATA_MODEL.md.

   Nothing else in the response may carry the kind either. The running reason
   budget travels as an opaque token, and an earlier version prefixed added
   reasons with `pool` "because the token is opaque" — but the token is
   returned with every message, so the prefix said *this message's reason was
   AI-added*, per message, for the whole transcript. The route RESOLVES the
   plain tokens server-side by re-hashing the known card ids — the client
   carries nothing but the token and `voicedTier`, which names its own side's
   rung and is identical under both policies.
4. **That no bonus decision is made about the Member at all.** A Member waits
   while "the Leader decides" and is then shown NOTHING — no score, no amount,
   ever. This replaced a fixed 70/100 presented as the Leader's judgement, and
   removing the number removed three problems at once: a deception that had to
   be explained away, a tell (the same 70 after two visibly different
   negotiations says the number is fixed), and a contaminant (a payout seen
   after Task 1 is a response the Task 2 measures would pick up — which is why
   it had to be constant in the first place). The wait is what carries the
   manipulation: POWER2, gate 2's Member-side check, asks whether outcomes
   that mattered depended on the other person's decisions, and waiting while
   someone else decides your bonus IS that. The Leader still decides a real
   amount and it is still recorded as `BONUS`; it simply never travels. What
   `/debriefing` discloses is that no such decision was ever made about them.
   Do not "restore" a number here for symmetry.

   **The Member's own channel is `RECV-EVAL`** (§5): before the wait
   they write an upward evaluation of the lead, told it goes to the director.
   It does not — there is no director — and `/debriefing`
   retracts that for both roles, since the Leader was told one was being
   written about them. It is the receiver-side mirror of `BONUS`: without it
   the Member has a post-negotiation decision made ABOUT them and none of their
   own, and RQ2's role-specific behavioural outcome has nothing to measure on
   half the sample.

   **The §5② evaluation guideline is ONE sentence and it is the same for both
   roles**: weigh "not only the negotiation result but the negotiation as a
   whole, and whether you would want to work with this person again". It names
   no competence axis, and that is the change Ver.2.18 made. The SB cards cost
   their speaker on judgement and trust; naming an ability axis
   ("operational competence", as the reward screen once did) would invite
   reading the confession as an admission of incompetence, which is the reading
   rule 5 was rewritten to prevent. One sentence for both roles also keeps the
   announced axis symmetric, which is what lets an SB "land on the axis the
   other side was told to weigh" mean the same thing in all four cells.
5. **Which term the study is about.** Both terms are entered the same way
   on the preference screen — no extra control, no highlight, no separate
   heading for the requirement issue. Pilot gate 6 tests for exactly this kind
   of transparency, which is also why the instructions no longer teach the
   logroll.

   The instruction page DOES say, per §8.1, that the counterpart moves on the
   reasons it hears — without naming which reason works. Saying the sensitive
   one is better would stage the disclosure being measured, and naming the
   logroll is gate 6's own question.

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
**practice round 1 (Task 1's arm)** → **Task 1 → Task 1 questions → Task 1
decision → Task 1 REMARK** → **practice round 2 (Task 2's arm)** → **Task 2 →
Task 2 questions → Task 2 decision → Task 2 REMARK** → wrap-up → debriefing.

**There are TWO practice rounds since 2026-09-09, one before each task, and
each rehearses THAT task's arm.** Through Ver.2.24 there was one practice
round and it followed Task 1's condition (`sessionPlan(assignment, 1)`), so
whichever arm came SECOND was met cold: a Proxy-second participant reached the
mandate, the watched exchange and RATIFY with no rehearsal, while a
Proxy-first participant had one. That is interface novelty covarying with
sequence × condition on the primary contrast, and the PI ruled it out. Round 2
is the same neutral scenario in the other arm, drops the CHK5 check (asked
once, in round 1), and is budgeted at one minute (`STAGE_MINUTES.practice2`);
the budget is 41 against an advertised 40, which `timingIsHonest()` permits.
Routes are `/practice/1` and `/practice/2` (`app/practice/[index]/`), the
FLOW key `practice-2` sits between `reward-1` and `task-2` so `nextHref`
carries REMARK 1 into it, `backStep("practice-2")` is null, and the phase
strip shows both practices as not counting. **The design doc's §7 timing table
still lists one practice round and needs the row.**

**Ver.2.23 removed the pre-task RISK battery** (design §9.2: pretest only).
The RISK paragraph further down describes where it sat and why; it no longer
exists on any screen, and must not be re-added as a per-task measure.

The post-task decision screen is the one screen that differs by role: the
Leader decides the recommended bonus, the Member writes `RECV-EVAL` and then
waits while "the manager decides" — shown no number, ever. REMARK comes after
it, in both roles and both arms.

**Open as of 2026-09-09: there is no wait screen in the code.** `submitEval`
in `task/[index]/reward/page.tsx` goes to REMARK on the same tick, and
Ver.2.24 §5 specifies RECV-EVAL and the "forwarded to the director" framing
but no interstitial. Item 4 under "Things the participant must never learn"
describes the wait as carrying POWER2; whether to add one is the PI's call,
not a bug to fix silently.

**M1 is asked where the decision was made, not in one fixed place.** Under
Proxy it sits on the confirm screen, of non-disclosers only, while the mandate
choice is fresh and nothing has been negotiated; under Direct there is no
such moment, so it is asked retrospectively in the post-task battery. Asking a
Proxy participant retrospectively would be asking them to reconstruct a
decision they made forty minutes and one negotiation earlier.

The questionnaire and the bonus sit **inside each task block** (§8), and that
is not a layout preference: every §9.4 measure is a judgement about one
specific negotiation, so asking it after a second, differently conditioned
negotiation would blend the two conditions inside a single answer. Item ids
carry a `_t1` / `_t2` suffix for the same reason.

**CP1–2 are CONDITIONAL on the conversation, not on the arm** (§9.4.4a).
They ask whether the other PERSON's messages read as a person's, so they need a
stretch where the participant actually talked to them: always in Direct, and in
a Proxy task only when RATIFY was modify-or-refuse. An approver never spoke to
the counterpart at all, and asking them would be asking about two AI proxies.
The decision is read back from the `ratify_t{n}` block, written on the RATIFY
screen itself — never inferred from the final package, because a participant
who asked for a change and then agreed the same package is a modifier.

They sit after PNOQ and BEFORE the debriefing, and they cannot move later. Once
someone has been told the counterpart was simulated, "did they seem like a
person?" is answered by hindsight — everyone remembers something that felt a
bit off — so the question is worthless after the retraction. With the end
block's suspicion funnel they are the validity evidence for the simulated
counterpart (gate 3′).

**The questions are paginated, forward only.** A Proxy task's battery is about
twenty-seven rating items plus seven required free-text answers, twice over —
as one screen that is where a paid worker starts straight-lining. The split is
at BLOCK boundaries so the §9.4 order is untouched: a part is a run of whole
blocks in the same fixed sequence, never a reshuffle. **The one block that IS
split is the free-text one, three questions to a page.** A rating block is one
instrument with one response scale and one hint row, so cutting it separates a
scale from its anchors; a written-answer block has neither, and seven essay
boxes on one page is precisely the screen the pagination exists to prevent.
**There IS a Previous, and it pages within the route only.** Every part after
the first carries one in the action bar's `secondary` slot (`PreviousPart` in
`components/measure.tsx`); it steps back one part, re-renders the saved answers
editable, and writes the current part before moving so a revision cannot be
lost. It never reshuffles: the block order is still the fixed §9.4 / §9.5
sequence and the only writes to the part index are +1 and −1.

**What the old forward-only rule was guarding is not solved, only accepted and
made visible.** The AI-Proxy blocks come last so they cannot colour the answers
about the other side, and the suspicion funnel runs SUS0 → SUS3 for the same
reason; paging back lets a participant revise an earlier answer after seeing a
later block, which is exactly what that ordering exists to prevent. So the move
is recorded — `survey_back`, with the part stepped from and to — and an answer
revised after a later part was on screen is a fact the analysis can find rather
than one it has to infer.

It is still ONE route, so the progress bar comes from the URL alone (rule 3);
the part index is component state. Three things it needs and would be silently
broken without: `useRestoreAnswers` (Back from the bonus screen is in
`BACK_STEPS`, and is a different control from this one), an autofill key
carrying the PART index, and a landing section chosen ONCE — the background
page's restore is an async store read, and re-picking the section every time it
resolves would drag a participant forward out of the part they just went back
to.

Inside a Direct task: cover → brief → **RISK** → what you want → "waiting for
the other participant" → negotiate → review.

**The wish screen defaults to the BEST option on both terms, in both arms**
(§8.6). Nothing else on the study is pre-answered (interface rule 2), and this
is the deliberate second exception alongside the mandate's locked work box.
Two reasons. The wish is the proxy's target AND its acceptance line
(`proxyAccepts`), so a modest wish would change how far the proxy pushes for
reasons that have nothing to do with disclosure — and under the two-rung ladder
that changes the PROCESS without changing the score, which is a difference
between participants that carries no signal. And REMARK's fixed line
presupposes the participant asked for a lot; a modest wish makes that comment
factually wrong for that person.

Departure from the default is what is recorded, not the selection:
`WISH-DEV_t{n}` is an audit flag on the `preferences_t{n}` block, and §13-25
switches REMARK to demand-free wording if it clears 20% at pilot.

Inside a Proxy task: cover → brief → **RISK** → **mandate (levels + reason
cards, one screen)** → confirm → watch the two AI
Proxies → **RATIFY** → handover → negotiate directly → review.
RATIFY decides whether the last two steps happen: approval finalizes the
package and goes straight to review; only modification or refusal opens the
three-minute closing conversation (§7, carried into Ver.2.21 unchanged — see
the override at the top of this file).

**Neither arm has a card control inside the conversation any more.** Ver.2.20
removed it; both negotiation screens are a composer and nothing else. The
reason cards still exist — but the only one still TICKABLE is the sensitive
card on the mandate screen, in the Proxy arm only, where authorizing a proxy is
what it is for. A Direct participant reads both cards in the briefing panel,
with the same ⚠ caption under the sensitive one, and then simply talks.

**The mandate is ONE screen: the levels on both terms and the reason
cards.** They were two screens in sequence, which made them two decisions
taken in order — the position fixed before the reasons were considered. The
gap this study is about is precisely that the second half was never asked, so
splitting them contradicted the contribution.

**Since Ver.2.21 there is only ONE decision on it: the sensitive checkbox**
(§8.7). The work reason is a FIXED utterance — the proxy always says it, and
the box is rendered ticked and disabled, with the label saying which it is. A
disabled checkbox that does not explain itself reads as broken.

Why the work box lost its control: a WR moves no tier and is the safe reason
anyone opens with in a real negotiation, so unticking it changed nothing about
the outcome. Leaving it tickable created a "no reason at all" Proxy path that
Direct has no counterpart for, and it muddied M1 — a participant who unticked
everything is answering a different question about withholding than one who
unticked the sensitive card only. **The whole delegation decision is now the
one card that costs something to send.**

**The ⚠ caption under the sensitive box is §8.1's common notice cut to one
line**, and the same sentence appears under the sensitive card in the Direct
briefing panel. That symmetry is the point: the notice is common to both arms
by design, so a caption in one arm only would be an exposure difference between
the conditions. It states that disclosure may help the other side understand
the ask AND may be weighed in the bonus or the upward evaluation. It does not
predict a bad outcome and it never opens a confirmation dialog — that would
tell the participant which answer is the careful one.

**One control per term, and no walkaway limit** (§8.6, §2.6). The floor is gone
from BOTH arms: it could not change the outcome, because the counterpart's
policy is decisive, so all it could do was manufacture an impasse and mix
mandate-setting skill into a result meant to turn on disclosure. The practice
round teaches the same one control — it used to rehearse the two-field layout,
which sent participants to the real mandate looking for a control that was no
longer there.

Where the cards sit took care and must not be "tidied". They exist for one
term — the participant's requirement — so the obvious layout nests them in that
term's card. That breaks §5 principle 4: one of the two term cards would be
visibly taller and carry a control the other does not, which tells the
participant which term the study is about without a word being said. The
reasons are therefore a section BELOW both term cards, and the two term cards
stay identical. `PreferenceForm` takes the section as a prop; Direct passes
none.

**There is no rehearsal chat with your own proxy any more (2026-09-09).**
Through Ver.2.21 a Proxy participant could question their proxy before it ran
(`RehearsalChat`, `/api/proxy-rehearsal`). Ver.2.24 §7 and §8.7 have no such
screen, and it was Proxy-only screen time and a written exchange Direct never
had. The flow is mandate → confirm → watch. What survived is
`lib/ai/reason-leak.ts`, because the Direct counterpart route uses the same
vocabulary screen to keep the counterpart from voicing its own SB before
reciprocity allows it; `tests/reason-leak.test.mjs` still pins it, and it must
be re-run whenever an SB card is reworded.

**The decision comes back to the participant: `RATIFY`** (§7, §9.3). The
proxies run ONCE — no revision, no second run — and then the participant
approves what they reached, asks for a change, or refuses it.

**APPROVAL FINALIZES; ONLY MODIFICATION OR REFUSAL OPENS THE CONVERSATION**
(September 6 correction, and the override at the top of this file governs).
An approver's task ends at RATIFY and goes to review. A modifier and a refuser
go on to the three-minute closing, and what they carry in differs: a modifier
takes the proxies' package as something to change, a refuser takes nothing
(`openingPackage` is null and the composer starts empty). `RATIFY` is recorded
where the decision is taken.

The ending was unconditional for a while, and the reason it was is worth
keeping in view because it is a real cost of the current rule. Under the
unconditional version every Proxy participant finished in conversation, so
"how the task ended" could not be a function of a choice that is itself an
outcome — approvers and modifiers answered the §9.4 items against the same
stimulus, and `Pooled Proxy − Direct` compared two arms that both always end
in conversation. Ver.2.20's September 6 correction reversed it and accepts
that cost: sending an approver into a chat makes the approval cosmetic, and
`RATIFY` is the confirmatory measure of exactly the construct this study is
about — delegation of VOICE with retention of the DECISION. A decision that
changes nothing about what happens next is not the decision being measured.
The consequence to carry into the analysis is that amount of contact with the
other side is not constant within the Proxy arm, and it covaries with RATIFY.

The three-minute conversation, where it happens, has the proxies' full
transcript on screen beside it.

**Ver.2.12 deleted a ratification screen, and bringing it back is not a
reversal of that reasoning.** That reasoning was right about the shape it had:
when BOTH arms ended with the participant agreeing a package in conversation,
asking "do you accept this?" afterwards made them re-decide what they had just
decided, and handed the Proxy arm a way to undo an agreement Direct could
not. §7 changes the shape — the conversation is no longer the ending every
Proxy participant reaches — and the retained decision IS the construct this
study is built on: delegation of VOICE with retention of the DECISION (§2.6).

**Three rules the screen must keep.** It may not recommend an answer: the three
controls carry equal weight, none is pre-selected, and no copy suggests what a
sensible participant does — the distribution across the three is the finding.
That is harder to hold now that approval is the shorter path, so the hints must
not let approval read as the quick way out.
`RATIFY` is recorded where the decision is taken, never inferred from the final
package: a participant who asked for a change and then agreed the same package
is a modifier, and reading it back off the outcome would call them an approver.
And a refusal leaves nothing standing, in the composer as well as in the copy.

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
Proxy arm two disclosures where Direct has one.

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
biting in Direct — a mechanical asymmetry in the primary outcome, along the
primary contrast.

**There is still no "ask for one change" DURING the exchange.** The old
mid-exchange revision existed when the proxies produced the final package
alone; RATIFY plus a direct conversation is a better version of the same
control, and keeping both would give the Proxy arm two bites Direct does not
have.

**`outcome: agreement | no_agreement` is gone too**, and not because the
distinction stopped mattering. Under the symmetric rule JOINT = 1,200 IS the
impasse, so a separate column restated one number in another form. What
survives beside the four measures is the §9.3.1 uptake question about the OTHER
side's requirement, which is asked rather than coded off the transcript.

**The practice round is a click-by-click TUTORIAL, and the coach never leaves
it.** `components/tutorial.tsx` exports `Coach`, a speech bubble pointing at
the one control each step needs; it is imported by
`app/practice/[index]/practice-round.tsx` and nowhere else. Do not reach for it from a task screen and do not "reuse" it to
explain the mandate or the composer in Task 1 or Task 2.

The reason is the measure. What the study observes is which box a participant
draws from and how far they go in their own words. A pointer on a real task
screen would sit on one control rather than another at the moment that decision
is being taken — a cue suggesting an answer (interface rule 9) on the primary
outcome. The practice round is the only place with no decision to bias: its
scenario is neutral and its data is excluded.

Three interface rules it keeps and that are easy to break when editing it: the
bubble is a SHARED surface, never sand, and carries no private value (rule 1);
it may say WHAT to do and never WHICH option to pick, and there is exactly ONE
`.cue-ring` on the screen, which the page moves with the step (rule 9); it
pre-selects nothing (rule 2). The one exception to the single ring is
`nextCue`, whose control is the sticky action bar — shared chrome that cannot
take a ring — so the bubble renders the button itself and rings that. On those
steps the page must not also ring a card.

**The end block since Ver.2.23 (§9.0a, §9.5 of the doc): OE-COMP, then
POWER1, POWER2, IMM2, INCENT1, then CP1–2, then the two-step suspicion
funnel.** Ver.2.23 DELETED the old SUS1 (who produced the behaviour), the old
SUS2 (what the study was looking for), IMM1, OE-F1/F2, OWN-AI3 and OTHER-AI3;
the doc renumbered the survivors as SUS1 (spontaneous "anything unusual?") and
SUS2 (yes/no "might not be a real person?" plus when/why). **The code keeps the
ORIGINAL ids** — `SUS0` for the spontaneous question and `SUS3` / `SUS3-WHEN`
for the identity question — because the doc says deleted and renamed items keep
their original codes in the export. Do not add the deleted items back to
"complete the funnel"; the 2026-09-09 audit read the older eleven-item list
above and flagged exactly that.

**The funnel's order is still the point.** The spontaneous question comes
first, naming nothing; the identity question is last, because a "yes" there
from someone who wrote nothing spontaneously is a much weaker signal than a
mention, and nothing about humanness is asked after the debriefing.

**RISK is GONE since Ver.2.23 (pretest only); the paragraph below is kept as
the record of why its position mattered while it existed.** It asked what the participant *expects* raising their requirement to cost. Asked
after the mandate — as an earlier version did in Proxy only — they answer it
having already decided which sensitive cards to hand over and read the policy
disclosure, which makes a pre-task measure partly post-treatment in one arm.
RISK is also §10 gate 4's task-equivalence instrument, so it cannot carry a
condition effect.

It is now asked **straight after the briefing, before the levels screen**, in
both arms. Merging the levels and the reason cards made the old placement
unsafe even where it had been fine: "after the levels screen" became "after the
mandate" in the Proxy arm and not in Direct. Asked cold, right after the
situation is read and before anything about their own position is committed, it
is identical in both arms and cannot be reached by any condition-specific
screen. Do not move it back down the flow to group it with the other pre-task
screens.

## The study is desktop-only, and says so first

**A phone cannot run this study, so the consent page says that before anything
else.** The interface puts a live chat beside a private briefing the
participant reads WHILE negotiating; below `lg` the briefing stops being a
pinned rail and goes behind a tap, which is exactly the point at which reading
it while typing stops being possible. That is a design property, not a layout
bug to fix: the two-panel arrangement IS the task.

The notice escalates rather than merely advising. Above 1024px it reads
"Desktop or laptop required"; below it, the reader gets a red panel telling
them this screen is too small and asking them to come back on a computer. It is
a LIVE viewport check (`useIsNarrow`, a `matchMedia` listener), not a
user-agent sniff, because a half-width window on a laptop has the same problem
as a phone and a landscape tablet may not — and it clears the moment someone
widens the window rather than stranding a reader who has already fixed it.

**Why it is stated this plainly:** a participant who starts on a phone finds
out forty minutes in, having been paid for nothing and having produced a
session that cannot be analysed. Telling them on the first screen is cheaper
for them than any amount of responsive work, and it is the honest thing to put
in front of someone about to commit an hour.

## IRB

**The determination is an EXEMPTION, not an approval, and the distinction is
participant-facing copy.** `STUDY.irb.reviewStatus` is `"exempt"` and
`exemptionNumber` is `UNISTIRB-26-073 -C`, issued by UNIST. The screens must
say the study was determined exempt from review — never that the study or its
methodology was "approved", because an exemption is a finding that review was
not required and claiming approval overstates what the IRB did.
`tests/study-config.test.mjs` pins the status string and the number, and
`/api/preflight` refuses a placeholder number (`irb_exemption_set`).

The number is deliberately never invented while unknown: a consent form is a
record, a fabricated number would misstate to a participant which
determination covers them, and it is the one string on that page they might
quote back to an IRB office.

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
   deliberate exception is the reason-card defaults on the mandate screen
   (§7: work on, sensitive off), which are specified and must not be
   "improved".
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
   participant is expected to negotiate from belongs in it — including both of
   the participant's own reason cards, which since Ver.2.20 is where a Direct
   participant reads them, there being no picker in the composer any more.

   **It is a CHEAT SHEET, readable without a click (2026-09-09).** The rail
   once carried the role, the payment, the goals, a notice and three tabs, and
   the point sheet and the two reason cards — the only things a person needs
   while typing — sat below the fold behind a tab. The PI's complaint was
   exactly that: "you have to click it every time, and it is a thin column
   that does not register." `BriefingPanel` is now, top to bottom: one header
   line; `RailPointSheet` (the two issues SIDE BY SIDE as mini tables with the
   best row emerald, one anchor line 🏆 3,600 · ⛔ 0); the two reason cards at
   full text with the ⚠ caption; and a closed `<details>` "Your situation".
   Role, payment and goals live on the brief pages, not here. **The whole rail
   fits inside a 1440×900 viewport in every role × task cell (measured at
   630px), so nothing needs scrolling; keep it that way** — anything added to
   it must be measured in all four cells. The rail is 400px from 1024 and
   30rem from 1440 (`min-[…]` breakpoints, because Tailwind's `lg:` block was
   emitted after the arbitrary-width one and the wider rail never applied).

   **The goals line is deliberately NOT in the rail.** Each role's first
   objective names its own priority term ("get as many days a week in the
   office as you can"); in a rail with no issue heading, that sentence IS the
   badge design §5 principle 1 forbids. The brief page carries the objectives.

   Always-visible reasons are better for validity than a tab: a Direct
   participant who never clicked "Reasons" had an interface floor on
   disclosure. Use `<details>` for the folded story, not state — it stays put
   across the re-renders a live negotiation produces.

   Do not put `.prose-study` inside the panel. It sets `1.0625rem`, so the
   role story rendered half again the size of everything around it and took
   most of the rail on its own — the panel's own `text-[0.8125rem]` was being
   silently overridden. Prose treatment at 13px means the leading and the
   measure, not the display face.
6. **The two reason boxes stay visually separate, and the sensitive one is
   ROSE.** Work and sensitive cards
   get their own headings, borders and colours, on the briefing and on the
   mandate screen. The whole measure is which box a participant is willing to
   draw from; if the two read as one list, that decision stops being legible.
   It matters MORE now that the Direct arm has no picker: the briefing panel is
   the only place a Direct participant ever sees the two boxes, so it is the
   only place the distinction can be made visible to them at all.

   The sensitive box was amber, which is the private/sand family itself
   (rule 1), so it separated from the work box by almost nothing and from the
   rail's own sand ground by less than that. It is ROSE: the nearest warm hue
   outside that family, with the weight in the border and the ink rather than
   the fill. The colour may say the sentence is COSTLY — which
   `disclosureRisk` already says in words — and may NOT say what to do about
   it. A saturated red would read as a form validation error, which claims the
   participant did something wrong, and either reading would stage the primary
   outcome. No cue ring here either (rule 9): the box is not waiting for
   anything.
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
    `brief` for a while, so its `intro` phase was unreachable and only Direct
    participants ever saw a cover — a whole orientation screen present in one
    condition and not the other. The art draws the INTERFACE, never the
    condition: User-Specified and AI-Supplemented are the same picture, the
    other side is drawn as a person with the same figure the participant gets,
    and the handover uses the direct scene because from there the proxies are
    done.

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
open-ended answers included — so the Direct composer arrives with the message
for that stage already in it, the review screen shows a real transcript and a
real package, and pressing Continue from the consent page to the completion
code shows you what a participant would actually see.

Those scripts are the *ideal* trajectories: the SB is voiced at the first
reason opportunity, the counterpart reciprocates, and the best↔best trade
lands. They are for reading the flow, not for exercising the failure branches.
`ask_sit`, `clarify` and `nudge` never fire in a mockup, because the ideal path
never says nothing, never hedges and never falls silent — and the counterpart's
reciprocal disclosure always happens there, which is exactly the WR-only case
a mockup cannot show you. Use `npm run simulate` and the committed transcripts
for those.

**The scripts must agree with the state machine.** All twelve cells settle at
3,000 for the speaker and 3,000 for the other side — the ladder's SB rung,
which is why the mockup mandate ticks the sensitive card: a mockup showing a
disclosure the mandate forbids would be a mockup of a different study. A test
in `tests/reason-rules.test.mjs` asserts the agreement in every cell, because
this pair has drifted apart twice. Levels named in a message are read from the
package that message carries, never from an option index, because option order
is role-relative.

**A scripted proxy speaks in the third person, like a real one.** The scripts
pasted card text verbatim once and so had the proxy claiming its principal's
confession as its own — see Ver.2.19 above. When you write a scripted proxy
turn, take the card's `relayed` text, never its `text`.

It is present by default on every build, including deployed ones, so the layout
can be checked wherever it happens to be running.

**A saved slot outlives a rename.** The panel's chosen assignment lives in one
browser's localStorage, so a panel opened after the Ver.2.18 rename carried
`"explorer"` into an assignment whose type no longer has that value. It is
migrated on read. Participants are unaffected, which is exactly why it would
have gone unnoticed — if a condition is ever renamed again, migrate here too.

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

## Launch readiness: the study refuses to start unconfigured

**The one failure that voids a collection run without announcing itself is a
missing `OPENAI_API_KEY`.** With no key, `generateAction` returns a canned
"[SCAFFOLD] No model configured…" action and every route still answers 200 —
so the negotiation RUNS. Packages settle, the ladder codes a tier, and the
questionnaire records judgements about a counterpart that never said anything.
Nothing in the UI, the transcript or the export marks the session as void. The
run looks like it worked, which is what makes this the worst class of bug here.

**`npm run simulate` structurally cannot catch it**: it reads `.env.local`
directly, so it is always configured. The gap is between "the code works" and
"the DEPLOYMENT is configured", and only the deployed process can answer that.

Three layers, and the order matters:

1. **The entry gate.** The consent page asks `/api/preflight?gate=1` before
   `beginStudy()` and refuses to start if the answer is no. This is the one
   that carries the guarantee, because entry is the only point where refusing
   is FREE — nothing is recorded and the participant can return the submission
   uncharged. They see a plain "not available right now" with **no technical
   detail**: naming a model or a key would tell every participant who saw that
   screen what the counterpart is.
2. **The backstop**, for what entry cannot cover — the environment changing
   while a participant is already inside. `assertNotLiveWithoutModel` sits at
   all three stub branches in `lib/ai/client.ts`. It **throws** rather than
   returning, because every caller wraps these in a try/catch that answers
   5xx, while a returned value would be swallowed (see below).
3. **`/api/preflight`** reports the whole launch state in one GET: key
   configured, dev panel off, completion code and IRB number set, advertised
   timing against the real budget. Token-gated via `PREFLIGHT_TOKEN`; with no
   token set it answers only when this is NOT a live study, so forgetting to
   set one closes the route rather than opening it. It never prints the key,
   not even masked — a mask still leaks length and tail.

**What the entry gate proves, and what it does not.** It checks before consent
that a usable-looking key is present, so a known misconfiguration can be
refused while participation is still free. It does not call the provider and
is not proof that every later model request will succeed.

Once a negotiation is under way, a non-200 classifier or counterpart response
is treated as unknown and unresolved. The pending action is held, the
participant sees a retry path, and the study does not assign `none` or advance
from that failed request. A transient per-turn failure may clear on retry;
normal ambiguity in a successful classifier response still follows the
downward-label rule above.

**`ModelNotConfiguredError` is a named class for one reason**: the classifier
must tell it apart from an ordinary model failure. `{label:"none"}` is correct
only when the model successfully classifies the text as containing no covered
reason. A failed call, whether caused by configuration, transport, or provider
health, remains unresolved and must be retried rather than converted into a
label. The named error still lets the server distinguish a deployment fault
from an ordinary per-turn failure for diagnosis and entry refusal.

**The scaffold is deliberately untouched where it belongs.** Dev-tools-on with
no key still returns it at 200: walking the whole flow without credentials is
what it is for, and no participant can reach a dev build. `isLiveStudy()` is
`NEXT_PUBLIC_DEV_TOOLS === "off" || VERCEL_ENV === "production"` — either
signal alone, because they fail in opposite directions and the errors are not
symmetric. A false positive costs one confusing local error; a false negative
costs a whole run. `getApiKey` treats a blank value as absent, which is how
this actually goes wrong: a variable left in the dashboard with its value
deleted. `tests/model-readiness.test.mjs` pins the matrix.

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
| The reason classifier (P5) | `app/api/classify-reason/route.ts` · `buildClassifierPrompt` in `lib/ai/prompts.ts` |
| The forbidden-card vocabulary screen (counterpart reciprocity) | `lib/ai/reason-leak.ts` — tested by `tests/reason-leak.test.mjs` |
| Atomic slot claim | `app/api/assign/route.ts` — `claimSlot` in `lib/assignment.ts` is the only thing that decides an assignment |
| Task payoffs, role stories, reason cards, the §6.6 abstractions and covers | `lib/tasks.ts` |
| Counterpart moves, the justification ladder, outcome coding | `lib/negotiation/machine.ts` |
| The counterpart's reciprocal-disclosure and combined-accept wording | `lib/negotiation/counterpart-text.ts` |
| One negotiation turn's client contract (classify → counterpart → commit) | `src/app/task/[index]/turn-contract.ts` — tested by `tests/turn-contract.test.mjs` |
| Bounded retry for a failed turn, and the clock pause around it | `lib/negotiation/recoverable-request.ts` — see `docs/turn-recovery.md` |
| The scripted ideal exchanges for mockup mode | `lib/negotiation/script.ts` |
| The live end-to-end simulation | `scripts/simulate-negotiation.mjs` — `npm run simulate` |
| Model / reasoning effort, the live-study guard | `lib/ai/config.ts` |
| Launch readiness report and the entry gate | `app/api/preflight/route.ts` |
| Agent behavior rules (P0–P4, the classifier) | `lib/ai/prompts.ts` |
| Guardrails, the message cap and its protected clauses | `lib/ai/validator.ts` |
| REMARK and ATTR | `src/app/task/[index]/remark.tsx` |
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
  construction: its own fixed cards plus the ladder.
- **Guardrail asymmetry confirmed.** Fabricated personal facts and invalid
  options block. An unchecked reason card may not be voiced under *either*
  policy. Since Ver.2.20 the additive check is stricter and no longer
  policy-specific: any `addedReasonSourceId` at all is a
  `provenance_policy_violation`, because the §6.6 sentences are supplied by the
  route and neither policy may invent one. (`red_line_violation` went with the
  mandate floor it existed to enforce — §2.6.)
- **`stage_mismatch` was demoted to a soft violation, and that was a real
  bug fix.** The model's stage field is an echo, so a mismatch says nothing
  about the move — but as a hard code it replaced the whole message with the
  package-only fallback, and it fired on exactly the closing turns (the machine
  stamps an accept as stage 6; the model echoes the trade stage it was mid-way
  through). Live runs were losing the acceptance wording for no reason. It is
  still logged for the gate-10 audit.

**Ver.2.21 was re-verified the same way** — `npm run simulate`, **thirteen
scenarios** through the real routes against the live model, plus the unit
suite, ESLint and a production build. **The simulation drives the tier through
the REAL classifier — one live P5 call per participant turn — because that is
the only automated check on it.** Deriving the tier from a card id there would
test a study that no longer exists.

The thirteen and what each is for:

- `direct-wr-only` — the work reason alone lands T1 (1,000/1,000) **and the
  counterpart's own SB never appears**. That second half is the reciprocity
  rule: a WR-only path must not hear a confession.
- `direct-priority` — a bare priority claim draws exactly one SCRIPT-ASKWHY and
  then T1 again. The claim buys nothing.
- `direct-sb-own-words` — the confession in the participant's own words, not
  the card's; the counterpart reciprocates and T2 lands.
- `direct-sb-split` — **the same fact split over THREE messages, none of which
  is an SB on its own.** The cumulative classifier has to reach `SB` anyway.
  This is the run that guards against the Direct-arm floor.
- `direct-asksit` — a first message with no reason at all draws exactly one
  SCRIPT-ASKSIT.
- `direct-clarify` — a hedge the classifier is unsure about draws exactly one
  SCRIPT-CLARIFY rather than a silent miss.
- `direct-nonum` — score talk draws exactly one SCRIPT-NONUM.
- `proxy-user-sb` / `proxy-user-wr` — User-Specified at both rungs; the card
  relayed in the third person, and 1,000/1,000 with nothing sensitive ticked.
- `proxy-supp-sb` — AI-Supplemented with the SB ticked: the turn carries the
  FRAME plus all three sentences, with no attribution and no event.
- `proxy-supp-wr` — AI-Supplemented WR-only: 1,000/1,000 with **cover ① on the
  decline turn**, which is the only place the policy difference shows on that
  path.
- `closing-self-disclose` — the Proxy closing after a WR-only run: the
  participant confesses in person → T2, `SB-TIMING = wrap_up`.
- `classifier-probe` — the classifier asked directly. The **denial** ("it's not
  like the client complained about me") and the **vague hint** must both land
  BELOW `SB`, and the stance extraction must resolve a real counter-offer into
  levels.

What the runs are for beyond the assertions: the symmetric ladder produces
exactly 3,000/3,000 with the SB and 1,000/1,000 on the work reason alone, in
live prose; the counterpart's reciprocal disclosure reads as a person
volunteering something rather than a system reciting a card; the rewritten
confessions land as things a colleague would actually be reluctant to say; the
AI-Supplemented turn reads as the proxy's own assessment rather than a relay;
and a mid-closing confession really does move the counterpart to put the
maximum up itself.

**Read the transcripts, not only the checks.** The P1/P2 voice, the bubble
rhythm and the SB reframing are judgement calls no boolean carries. They land
in `docs/transcripts/` and are committed for exactly that reason.

**Four defects came out of the Ver.2.20 runs and three were real** — the kind
that produce a plausible transcript and wrong data, which is why the run
exists. All three are recorded in the sections above: the counterpart
misreading its own proxy, the abstraction sentences never reaching the prompt,
and `voicedTier` not carrying the proxy's floor into the closing, plus the
280-character cap that could not fit a §6.6 turn. The fourth was a bad test
script — a participant who opens "the days are the big one" is making a
priority claim, and the classifier was right to say so.

Two earlier findings that still hold. **The simulation's seeded opening had
diverged from the app** — it was anchoring on the counterpart's own best
package after `openingLine` had moved to SCRIPT-OPEN, which meant the only
automated check on the live prose was checking a study nobody runs.
`counterpartOpening` is deleted so the two cannot drift again. And
**SCRIPT-BALANCE needed splitting**: it carries a judgement AND a package, and
asked as one sentence the model wrote a single 179-character bubble, over the
120-char rule that keeps the counterpart reading like a person typing.

**Some defects only a browser walk finds.** A pass over practice → mandate →
confirm → watch → RATIFY → reward → REMARK in both arms with mockup mode on
found six things no unit test or simulation could reach, because they were in
the SCRIPTED prose and the screens around it: first-person proxies, a labelled
disclosure, a seeded opening that still asked for the priority, a missing §8.1
sentence on the instruction page, a stale Task B title and role-story pronoun,
and the dev panel's un-migrated slot. Walk the flow after any migration; the
tests do not read.

## Ver.2.21 migration status

Migrated in full, across eight design versions of which six change structure
rather than wording:

- **Ver.2.14** — REMARK and ATTR after each post-negotiation decision (§6.8,
  §9.4.9), and the §9.6 item cuts with their renumbering: PCR 7→6, PNPQ 4→3,
  OWN-AI 5→4, OTHER-AI 6→4, POWER 3→2. The four behavioural measures are
  untouched: `SB` / `SB-TIMING` / `Points·JOINT` / `RATIFY` (§9.3).
- **Ver.2.15** — the everyday-terms scenario: a project team at a company,
  team lead and senior team member; Task A "Next Quarter's Working
  Arrangements", Task B "Starting the New Project".
- **Ver.2.16–2.17** — the decoy work reason, the four-rung ladder and
  `SCRIPT-MISREAD`. **All three are gone again in Ver.2.21**; what survives is
  the anchor-free, priority-free `SCRIPT-OPEN`.
- **Ver.2.18** — the condition rename (`direct` / `user_specified` /
  `ai_supplemented`), all four SB cards rewritten as things ALREADY DONE, and
  the single §5② evaluation guideline for both roles.
- **Ver.2.19** — the third-person representative voice for both proxies, with
  `relayed` written on every card.
- **Ver.2.20** — the card buttons abolished and the **P5 classifier** in their
  place (§6.2a); AI-Supplemented rewritten to ABSTRACT rather than ADD, with
  the role-plausible pool and its budgets deleted (§6.6); the message cap at
  420.
- **Ver.2.21** — the substantive one, and everything in it is structural:
  - **the TWO-rung ladder** (§3.3, §6.2): T1 1,000 each / JOINT 2,000, T2
    3,000 each / JOINT 6,000, **impasse 0**. `priority` deleted from
    `ReasonTier`, `misread` / `misreadPackage` / `misreadOffered` deleted from
    `machine.ts`.
  - **convex payoffs** (§3.2): core 3,000 / 1,600 / 600 / 0, non-core
    600 / 400 / 200 / 0, individual max 3,600.
  - **the non-directional work reason** (§3.3, §4): all four WR cards
    rewritten to say both terms matter and to hide the priority.
  - **Task B's Member issue** replaced with the weekly client report, plus its
    SB, abstraction, covers and role briefs (§3.2).
  - **reciprocal disclosure in Direct** (§6.3): the counterpart discloses only
    after the participant.
  - **the cumulative classifier** (§6.2a): all messages in, `none/WR/SB` out,
    with `priority_claim`, `stance` and `counter_terms`.
  - **new fixed scripts** (§6.4): SCRIPT-ASKSIT, SCRIPT-CLARIFY, SCRIPT-NUDGE,
    and SCRIPT-CLOSE at 90 seconds; new BALANCE / T1 / T2 / ASKWHY / OPEN
    wording.
  - **early settlement** (§6.1 stage 6): a valid acceptance ends the task at
    once, and `disclose_sb_and_accept` puts both halves in one reply.
  - **the counterpart route returns no action name**, only
    `{ message, proposal, state, settled }`.
  - **the Proxy mandate reduced to one decision** (§8.7): the work reason is a
    fixed utterance, shown ticked and locked, with a ⚠ caption on the sensitive
    box mirrored into the Direct briefing panel. **The proxy floor is T1 in
    both arms**, which retires the §13-13② mode asymmetry.
  - **the AI-Supplemented speaker** (§6.6): the proxy's own frame, then the
    abstraction and two GRADED covers as subjectless declaratives, shuffled,
    with no attribution to the principal.
  - **the wish screen defaults to best-on-both** in both arms, with `WISH-DEV`
    recording deviation (§8.6).
  - **§9 measures**: CP1–2 restored after PNOQ, IMM2 restored, the four-item
    SUS funnel (SUS0 → SUS1 → SUS2 → SUS3), M1 given four options plus a
    Direct-only "I did share it", and §7 timing recomputed.

Carried forward and still true: the symmetric package rule (§3.3, §6.2), the
six-stage script (§6.1), the consolidated fixed scripts (§6.4), the proxy's
first-opportunity SB schedule (§6.5), **RECV-EVAL** (§5), **RATIFY as its own
screen** with the conditional closing conversation (§7), and the removal of the
range mandate from both arms (§2.6, §8.6).

Verified against the live model end to end — `npm run simulate`, thirteen
scenarios through the real routes with the classifier in the loop; see
"Verified against the live model" above, and `docs/design-2.21-update.md` for
the staged record.

**Still design-open (§9.8, §13), not implementation gaps:**

- the working values themselves: the T1 rung (1,000) and the strength of the
  §5② decision guideline are to be fixed at pilot
- §9.8-1: the three RECV-EVAL items are `[PROPOSED]` — wording and anchor style
  (7-point agreement vs evaluation) are not settled
- §9.8-5: `SB-TIMING`'s categories ③ and ④ are structurally exclusive by arm,
  so the χ² has zero cells by construction — the test's unit must be
  pre-specified. Ver.2.21 changes what ③ MEANS in Direct (see
  docs/DATA_MODEL.md) without closing the question.
- §6.3: the analysis set for the PCR items about the other side's disclosure,
  now that a WR-only Direct session never hears it, and the re-specification of
  the old PRE/POST disclosure framing
- §13.4: aligning PCR / PNPQ / PNOQ to the SVI's four factors, so a validated
  scale can be cited
- §13.5: the item wording is written in English against Korean drafts and
  needs a pass against the final translation
- §13-25: whether REMARK's demand-referencing line has to become demand-free,
  decided by the pilot's `WISH-DEV` rate against 20%

**§9.8-4 is RESOLVED.** It asked for the Direct operational definition of `SB`
when a participant describes the sensitive background without tagging the card.
There is no card to tag any more: the P5 classifier reads every message, and
the post-hoc human re-coding reported as κ (gate 19, ≥ .90 or Wizard-of-Oz) is the sensitivity analysis §6.2 asked for. The question the old design could only
answer by convention is now answered by measurement.

## Still open

Nothing structural. What remains is values to fix and behaviour to observe:

- **Pilot-dependent numbers.** The T1 rung (1,000), the strength of the §5②
  decision guideline, and the Prolific completion code.

  **The payment is settled (Ver.2.24 §7.1)**: £6.00 base plus £1.00 extra is
  £7.00 for a 40-minute study — £10.50 an hour on the total and £9.00 on the
  base alone, at Prolific's recommended fair-pay rate of £9.00 (their hard
  floor is £6.00/hour). GBP because Prolific pays in it. A Leader is told the
  £1 is theirs from role assignment and that they recommend up to £0.50 per
  task for the Member; a Member is told £6 is guaranteed and £6–£7 is the span. **The pay rises whenever the budget does, and the direction is the
  rule.** The number to adjust is always the PAY, never the advertised minutes:
  the estimate is derived from the screens that exist, and quoting less than
  the study takes underpays whoever is slower than it. Ver.2.21 cut the budget
  rather than raising it — the misread branch is gone and a valid acceptance
  ends the task at once — so the rate improved without the pay moving.

  The bonus is held back and presented as something a Leader decides and a
  Member receives, and every participant is paid it in full — one of the four
  deceptions alongside the counterpart's existence, the upward evaluation and
  the parting comment, all retracted by name at `/debriefing`. It is held back
  rather than paid flat because gate 2's POWER2 asks whether outcomes that
  mattered depended on the other person's decisions, and a bonus the Member
  believes someone else is deciding IS that dependence.
  `tests/study-config.test.mjs` pins base plus bonus against the advertised
  total and both against the rate.

  On the impasse target (gate 6, under 10%): the ladder makes impasse hard to
  reach, because both rungs are acceptable agreements and even the unargued one
  (1,000) beats the 0 that walking away pays. **Ver.2.21 raised the stakes on
  this**: with the fallback removed, an impasse now costs the participant
  everything, so the remaining route — someone who keeps asking off the ladder
  and refuses the tier package until the clock runs out — is more expensive
  than it was. SCRIPT-CLOSE is what stands between that participant and zero.
  Watch the rate rather than pre-emptively widening anything.

- **Timing.** `STAGE_MINUTES` sums to 40 minutes and the consent page
  advertises 40 (Ver.2.24 §7: Direct chat 5 minutes, Proxy closing 2). `TOTAL_MINUTES` is derived from those same numbers and
  `timingIsHonest()` pins the relation — the advertised figure may round the
  budget DOWN by at most a minute and never further, because a listing that
  promises less than the study takes underpays anyone slower than the estimate
  and the fair-pay rate is computed from it. The design's §7 table budgets
  49–53; the code's figure is summed from the screens that actually exist and
  is deliberately the more conservative of the two. Ver.2.21's honest
  additions: `debrief` at 2 minutes, which carried none at all before and so
  quietly understated the study, and `taskSurvey` held at 7 now that CP1–2 join
  the battery. `task` came DOWN to 10 with the misread branch gone. Gate 8 asks
  for a task median under 12 minutes. A Proxy task is the longer arm — the
  proxies' watching plus a 3-minute closing where one happens — but both clocks
  are caps, not targets. The pilot median decides this; the lever is the
  reply-delay range, never the advertised figure.

- **Whether the two arms are matched on the participant's own airtime.** A
  Direct participant writes the whole negotiation; a Proxy participant watches
  one and then sometimes writes a short closing. That asymmetry IS the design,
  but it means "how much did they say" is not a between-condition control, and
  any measure that behaves like a word count should be read with that in mind.

- **Selective exposure to the counterpart's confession** (§6.3). Reciprocal
  disclosure means a WR-only Direct participant never hears the other side's
  SB, so the PCR items about it apply only on the path where the participant
  disclosed first — and that path is chosen by the primary outcome. The
  analysis set for those items has to be pre-specified, and the old PRE/POST
  disclosure framing re-examined. This is the live successor to the question
  the unconditional schedule used to raise, and it replaces it: the old worry
  was that a confession everyone heard would lift PERC and RISK uniformly.

- **Classifier agreement.** Gate 19's κ ≥ .90 decides whether the P5 route
  survives contact with real participants. Until the pilot the only evidence is
  the simulation's own runs — the own-words confession, the split confession,
  the denial and the vague hint. If it fails, the fallback is Wizard-of-Oz
  tagging (§13-24), which is a live-operations change, not a code change to
  plan for now.

- **Whether two issues survive the demand-characteristic check.** With only two
  terms each requirement is highly salient, and the suspicion probe may show
  participants guessed the design. Adding a term back would mean recomputing
  every payoff property above.

- **The failure branches have tests, but mostly at the machine level.**
  `tests/reason-rules.test.mjs` pins the two rungs in four cells, impasse, the
  one-shot scripts and script–machine agreement;
  `tests/turn-contract.test.mjs` and `tests/recoverable-request.test.mjs` pin
  the turn contract and its recovery; the route tests pin the three API
  contracts; `tests/reason-leak.test.mjs` pins the forbidden-card screen in both
  directions; the live simulation covers the WR-only path, the split
  confession and a mid-closing disclosure. What is still unexercised
  automatically is the INTERFACE around the failure branches — the emergency
  stop, and the clock actually running out on a real screen. Both were walked
  by hand, as were RATIFY's three branches: approve goes straight to review,
  modify keeps the package on the table, refuse clears it.

- **The Proxy closing's "End without agreement" control was removed on
  2026-09-07**, and it may be restored only in BOTH arms at once. It let a
  Proxy participant take the fallback by hand, on the primary contrast, where a
  Direct participant has no such button — so "how did it end" carried an
  arm-specific route that appears in no design record. Both arms now end the
  same three ways: a package the counterpart accepts by the ladder, the
  explicit Accept button, or the clock. **Under Ver.2.21 that button would be
  worse still**, because ending without agreement now pays 0 rather than 600.

- Fixed vs. jittered counterpart delay · final IRB language (four deceptions
  now: the counterpart's existence, the bonus, the upward evaluation being
  forwarded, and the parting comment) · a pass over the item wording against
  the final translation.

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
