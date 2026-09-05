# Project notes

Online experiment platform for a 2027 CHI submission on AI-mediated
negotiation. Source of truth for the design is
`N - Experimental Design (Ver.2.20).md`. This file records the constraints that
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

**The work reason is a DECOY, and this is the single most consequential thing
in the design (Ver.2.16–2.17 §3.3).** A WR is TRUE and SAFE — a statement of
the participant's real interest that anyone could say aloud ("my analysis scope
is wide this quarter, so the workload is heavy"). What it does not do is
justify the term they actually need, because their core term is not that
interest's obvious remedy: heavy workload is answered by fewer office days, not
by dropping the client presentations. So `issueId` on a work card points at the
participant's CORE issue — that is what the card is being used to argue for —
while the interest it names would naturally be served by the OTHER one. That
gap is the design, and it is written into every role story: "there is a reason
you can say safely… but if that is all you say, the other side will offer to
cut your office days — not the presenting."

A counterpart who hears only the WR therefore answers it sincerely and answers
the WRONG TERM (`SCRIPT-MISREAD`), leaving "why that term specifically?"
standing. Only the SB answers it. **That is what makes disclosure the sole
bottleneck to the maximum without the participant ever being told a rule** —
the older design had to hope the ladder was inferred; this one lets it be
watched.

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
  asked that the lead present from now on, never passed on. Task B: a missed
  night call and a direct complaint, apologised for and never reported.

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
tell. They are parallel by TYPE — Task A is a hidden fault of one's own, Task B
is a third party's adverse judgement.

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

- individual maximum 3,900; the most reachable while the counterpart still
  agrees is 3,000, which is the SB rung of the ladder
- the full logroll reaches **6,000**, perfectly symmetric at 3,000 each
- reservation 600 each — deliberately BELOW the unargued rung (1,600), so even
  a reason-free agreement beats walking away
- each requirement's threshold is Options 1–2 on its own issue. O1→O2 keeps it,
  O2→O3 breaks it, which is why the trajectory is reported as transitions and
  never summed

**Ver.2.15 restated the scenario in everyday terms.** It is now a project team
at an ordinary company — a team lead and a senior team member — rather than a
consulting agency with consultants. Task A is **"Next Quarter's Working
Arrangements"** (days a week in the office × client meetings the Member
presents at); Task B is **"Starting the New Project"** (days a week on the new
project × urgent-call duty). The point of §3.1's self-relevance requirement is
unchanged and is what the terms still carry: each issue is one the other
party's own competence or judgement rides on, which is the condition White et
al. (2004) needed for face threat to suppress joint gain. The payoff spine is
untouched by the rewrite.

**The justification ladder is SYMMETRIC and has FOUR rungs** (§3.3, §6.2). How
far the counterpart moves is decided by the best thing the participant side has
VOICED — and it asks for exactly as much as it gives. Both cores land on the
same rank. `TIER_LIMIT_INDEX` in `machine.ts` is the authority:

| Voiced | Both cores land at | Participant | Counterpart | JOINT |
|---|---|---:|---:|---:|
| nothing (cheap talk) | 3rd option | 1,600 | 1,600 | 3,200 |
| **work reason (the decoy)** | **3rd option** | **1,600** | **1,600** | **3,200** |
| priority claim | 2nd option | 2,300 | 2,300 | 4,600 |
| **sensitive background** | **best option** | **3,000** | **3,000** | **6,000** |
| impasse | — | 600 | 600 | 1,200 |
| misread accepted | — | 600 | 1,900 | 2,500 |

**`none` and `work` share a rank, and that is the decoy made mechanical.**
Ver.2.16 inserted `priority` and collapsed `work` into `none`: hearing the WR
changes what the counterpart OFFERS — a misread package, once — but not how far
it will move. A bare priority claim ("the presentations matter more to me than
the office days") is believable enough to move it one step and not enough to
explain the mismatch, so it stops at the second option. `ReasonTier` therefore
has four values where it once had three, and `TIER_RANK` orders them for
`foldTier`.

**The misread is not a lowball and must never read as one** (`misreadPackage`,
§6.2). The counterpart believes it is helping: told the workload is heavy, it
offers fewer office days — the participant's NON-core issue, one step in — and
asks for their core at its own best. That sincerity is what makes the decoy
legible from inside the conversation rather than as a rule anyone is told. It
is offered once per task and never repeated, and once offered it stays
ACCEPTABLE: the counterpart cannot refuse its own good-faith offer
(`acceptablePackage(..., misreadOffered)`). Accepting it pays 600 — the same as
impasse, and below the 1,600 a participant who said nothing gets. **That is a
real trap and it is deliberate**; §13-19 flags it, and if the pilot's
acceptance rate clears gate 7 the script softens from an offer to a question.
Do not soften it pre-emptively.

**This replaced an asymmetric policy and the reason matters.** Ver.2.12 held
the counterpart's own core at its best on every path and conceded only on the
participant's (1,000/2,000/3,000 against 3,600/3,300/3,000). §2.6 gives two
grounds for dropping it. One: a counterpart that opens "my best, your worst"
and never moves off its own core is itself a face threat — exactly the
non-negotiable, lowball offer White et al. (2004) identify — so a high-FTS
participant was pushed into competing by a route that has nothing to do with
self-disclosure. Two: a ladder where only the participant loses reframes
disclosure as "giving in to them" rather than as buying credibility.

Three consequences, all deliberate:

- **JOINT IS the ladder.** One value per rung — 3,200 / 4,600 / 6,000, plus
  1,200 for impasse and 2,500 for an accepted misread — so JOINT alone
  identifies the tier reached. That is why §9.6 could delete UNLOCK,
  CONCEAL-PREMIUM, MAX-JOINT and `outcome`: they were four indicators computed
  off one number.
- **Disclosure is the only bottleneck to the maximum.** The counterpart
  proposes at its rung (`SCRIPT-PROPOSE-T{tier}`) rather than leaving the
  maximum to be discovered — so negotiation skill cannot be what separates
  outcomes, which is what makes the contrast interpretable.
- **Acceptance is the tier package EXACTLY, refused in both directions.** An
  over-ask asks for more credibility than was earned; an UNDER-ask is refused
  too (`SCRIPT-BALANCE`), so a participant's over-concession cannot drag the
  outcome below the rung they paid for. Ver.2.12 accepted under-asks.

**The counterpart's opening carries no package, and since Ver.2.16 it withholds
its own priority too** (§6.1). `SCRIPT-OPEN` gives the counterpart's WORK
reason and asks about the participant's SITUATION. It used to ask "what matters
most on your side, and why?", which was wrong twice over: it invites a bare
priority claim as the participant's first move — tier 2 — so the misread, the
whole point of the decoy, would rarely have fired at all; and naming its own
priority spares the participant meeting the decoy from the RECEIVING side,
which is the other half of what makes it legible. The first package anyone sees
is the symmetric tier one.

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

1. **opening** — its WORK reason and a question about the participant's
   situation, and **no package and no priority of its own** (`SCRIPT-OPEN`).
   Fixed.
2. **first reason opportunity** — it states its priority and asks for the
   participant's. This is the turn that opens the participant's own first
   chance to give a reason.
3. **lock** — a system recording moment. `counterpartStageAfter` walks
   1 → 2 → 4 → 5 and never serves it.
4. **disclosure** — the counterpart voices its own SB card, **once,
   unconditionally**.
5. **conditional trade** — bounded by the tier. This is where the misread, the
   one `ask_why`, `balance` and `propose_tier` all live.
6. **close** — acceptance, or impasse when the clock runs out.

**The counterpart's SB disclosure reverses a Ver.2.11 rule.** Ver.2.11
deliberately withheld it, on the grounds that reciprocal disclosure would prime
the very construct PERC measures. §6.3 requires it instead, for a reason that
outranks that: `SB` — whether the participant disclosed BEFORE hearing the
other side's confession — is RQ1's confirmatory outcome, and it is undefined
without a fixed reciprocity point.
The confound is controlled by making the disclosure **identical and
unconditional for everyone**: never mirrored to what the participant said,
never skipped, carrying no demand and no package. It changes no tier.

**The participant's conversation is free-form, bounded by a clock.** Ten
minutes in Direct, three in the Proxy arm's closing (`CLOSING_SECONDS`) — the
ground work there is already done. They write as many messages as they like and
may finish early. Running the clock to zero is an outcome; `onExpire` closes the
exchange as an impasse.

**The Proxy arm's closing conversation is CONDITIONAL** (§7). It is where
modify-or-reject leads; approving the proxies' package ends the task. That is
what makes `RATIFY` a real decision rather than a label on an ending everyone
reached anyway.

**When a closing conversation does happen, both arms end the same three ways**,
so "how did it end" is never a between-condition artefact:

1. a package the counterpart accepts by the ladder,
2. an explicit **"Accept their proposal"** button — deterministic, so no model
   ever reads the participant's words to decide whether they agreed,
3. the clock — one `SCRIPT-CLOSE` offer near the end, then impasse.

**The clock outranks the tier's own proposal.** Without `soft_close` a
participant who kept asking off-tier would meet the same refusal every turn and
run out at the 600 fallback — below the 1,600 a participant who said nothing
gets, inverting the ladder for whoever paid the most.

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

**Ver.2.20 §6.2a abolished the reason-card buttons, and this is the headline
change of the migration.** Through Ver.2.19 a Direct participant tagged each
message with the card they were drawing on and the tag set the tier. Now the
Direct arm and the Proxy arm's closing are **free conversation**: the
participant simply talks. Every participant message goes to a **separate,
single-purpose classifier** — prompt P5, `/api/classify-reason`,
`buildClassifierPrompt` — which returns one of `none / WR / PRI / SB` and
nothing else. `LABEL_TIER` maps that label onto the ladder and `foldTier`
raises the running tier.

**Why the buttons went, and it is two reasons.** Pressing "[sensitive
background]" is a more deliberate act than simply saying the thing, so the tag
risked a floor on the primary outcome. And — worse — it made Direct something
other than "just talking", so `Pooled Proxy − Direct` would have compared two
INTERFACES rather than two ways of being represented, which is the contrast the
whole study is built to make.

Five rules hold it in place, and each closes a specific way it could go wrong:

- **The classifier is not part of the negotiation.** It writes no text anyone
  sees, holds no conversation state, speaks for nobody, and never reaches the
  participant. The label goes to `machine.ts`, which decides the package as it
  always did. The counterpart's own model is never asked to judge an argument.
- **Ties go DOWNWARD.** The prompt instructs the lower label whenever two are
  in play. A missed SB is recoverable — the participant can say more, and the
  tier only ever rises. A concession granted on a misread cannot be taken back.
- **The tier only ever RISES**, enforced by `foldTier` in all three places that
  need it (the Direct loop, the Proxy closing, the route's own log). Two
  hand-written ternaries would eventually disagree.
- **A classifier failure returns `none`, never a guess.** A guessed SB would
  hand out the maximum package on a network error, in one arm only, on the
  primary outcome.
- **Every `{text, label, confidence}` is stored for post-hoc human re-coding**,
  reported as κ against the classifier with a sensitivity analysis excluding
  disagreements (§6.2). **Gate 19 requires κ ≥ .90**; below it the study
  switches to Wizard-of-Oz tagging (§13-24). Persistence lands with
  `/api/persist` — see docs/DATA_MODEL.md.

**The cost is real and is stated plainly rather than designed away: the failure
mode is invisible to the participant.** Someone whose SB is missed experiences
"I said it and it didn't land", with nothing on screen to tell them otherwise.
§6.2 accepts that because the cards are fixed and few, and gates it with the κ
requirement above. Do not add a confirmation affordance to "help" — a control
that tells the participant their disclosure registered is a card button again,
with the same deliberateness cost, and it would put the interface difference
back into `Pooled Proxy − Direct`.

**`tierOf` survives, and it is the PROXY path only.** There the participant's
checkboxes decide which card is voiced, so the layer is known without reading
anything — the function still reads LAYERS, never text. The Direct path and the
Proxy closing go through the classifier instead. In the Proxy closing the two
meet: the tier starts from what the proxy actually VOICED (not what was
authorized — a guardrail block can strip a reason, and assuming otherwise made
the rule inert for a whole arm once already) and is folded with whatever the
participant says in person. A confession made there is recorded as
`SB-TIMING = wrap_up`, and at that point the counterpart puts best↔best up
itself.

**The proxy's floor is tier 2, and it is a documented mechanical asymmetry**
(§6.5, §6.9 #1 and #12, §13-13②). `buildProxyPlan` folds `"priority"` in
unconditionally: a proxy is handed its principal's preferred package, so it
always knows which term matters more and says so — it states the priority and
declines the misread. It therefore cannot land on the bottom rung and cannot
accept a misread. **Only a Direct participant can do either.** This is not an
oversight to be tidied away: it puts a mechanical component into any Mode
difference in Points/JOINT, which is exactly why §9.3 keeps JOINT as a
SECONDARY outcome and `SB` — a disclosure decision available identically in
both arms — as the confirmatory one.

The live simulation found the other end of this wire the hard way: the route
derived the counterpart's tier straight from `tierOf` on the token log —
`work`, the misread's own trigger — so the counterpart offered the wrong-term
package to a proxy that had already named the priority, and the proxy, whose
instructions are to accept, took 600 instead of 2,300. An AI-AI exchange has no
participant in it to notice. Read the tier through the plan, not through the
log.

**The fixed scripts (§6.4)** are `DecidedAction` values, not prose in a
component: `open` (SCRIPT-OPEN), `state_priority`, `disclose_sb`, `ask_why`
(SCRIPT-ASKWHY, once), `misread` (SCRIPT-MISREAD, once per task),
`propose_tier` (SCRIPT-PROPOSE-T1/T2/T3), `balance` (SCRIPT-BALANCE),
`accept` / `accept_sb`, `nonum` (SCRIPT-NONUM), `soft_close` (SCRIPT-CLOSE),
`impasse` (SCRIPT-FALLBACK).

Ver.2.13 merged four names into `propose_tier`: SCRIPT-FAIR, SCRIPT-LIMIT,
SCRIPT-ACCEPT-SB and SCRIPT-PROPOSE-MAX were one move — "here is what this tier
buys" — at different depths, which under the symmetric rule differ only in the
rank they name. `balance` stayed separate because refusing a LOPSIDED package
is a different speech act, and it is the one a participant meets after an
over-ask *or* an over-concession.

**`misread` outranks `ask_why`, and the order is the point.** The counterpart
has just been given a reason, so asking "why does that matter?" would ignore
what it heard. The mismatch question comes later, when the participant holds
out for the core term anyway — and `ask_why` is then reached from two routes
that are the same speech act: no reason at all, and a priority claim that still
cannot be squared with the safe reason given.

**The no-numbers reminder is one-shot and reads the WHOLE history.** §8.1
forbids telling the other side your score; `mentionsScoreNumbers` screens for
it server-side and the counterpart reminds once, then ignores it. Reading only
the latest message missed a mention made during the fixed stages, where the
counterpart's move is already determined — so the reminder never fired at all.

**The proxy voices an authorized SB at its FIRST reason opportunity**
(`designatedReason`, §6.5), not after a challenge. `SB` is "was the
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

### The AI-Supplemented policy: it ABSTRACTS, it does not ADD

**Ver.2.20 deleted the role-plausible pool and its budget entirely** (§6.6).
Through Ver.2.19 the Explorer policy ADDED pre-approved general arguments
beside the principal's card, at most one per issue and two per task. That whole
apparatus — `designatedPool`, `voicedPoolId`, the per-issue budget, the
`pool:` prefix and its guardrail — is gone.

**What replaced it: the AI-Supplemented proxy REPLACES the sensitive card with
a fixed one-sentence abstraction and says it among two cover reasons.** The
abstraction keeps the KIND of fact and its ATTRIBUTION to the principal and
drops the event, the third party's words, and the concealment — "the office
days are something the team lead I represent has already spoken about upward,
so there is very little room to adjust them". The two covers are ordinary
role-plausible sentences. All three are said unlabelled, and **shuffled**.

Four things about it are load-bearing:

- **All twelve sentences are FIXED on the cards** (`abstract` and `cover` in
  `lib/tasks.ts`), not generated. The manipulation IS the wording: a model
  writing its own abstraction each turn would vary how much of the fact
  survives, and how much survives is the independent variable. The model only
  joins them.
- **Position must carry no signal**, hence the shuffle. If the abstraction were
  always first (or last), a receiver could sort the principal's own
  circumstance out of the three by layout alone, and `OTHER-AI2` — "could you
  tell which reasons the counterpart had selected" — would measure a formatting
  convention instead of the manipulation.
- **Both policies produce the SAME points.** They differ only in what the
  counterpart LEARNS. That is deliberate: a policy that reached further would
  confound `AI-Supplemented − User-Specified` with concession reach, and
  `buildProxyPlan` computes identically for both.
- **No policy may add a reason of its own any more.** `addedReasonSourceId`
  survives in the schema purely as a tripwire: any value in it is a
  `provenance_policy_violation` under EITHER policy, because the §6.6 sentences
  are supplied by the route and there is nothing legitimate left to put there.
  This is stricter than the rule it replaces, which policed *which* policy
  could add; the answer is now neither.

**The sentences are appended to the finished message, not requested in the
prompt, and that lesson carried over from the pool.** As an instruction the
addition competed with the card instruction on the same turn and lost about
three times in four, while the schedule spent the budget regardless — so a
dropped clause was recorded as voiced. The route places them itself.

**The live simulation caught the way this fails silently.**
`abstractedSentences` was computed, protected in the cap, and used for the
retry check — and never put into the prompt context, so P4 rendered "(none this
turn)" and the model improvised. The AI-Supplemented arm was running as a
paraphrase of User-Specified, with a plausible transcript and wrong data. If
the manipulation ever looks weak in a pilot, check that the sentences reach the
prompt before you touch the wording.

**Message SHAPE is enforced on the text, not asked for in a prompt.** Two
things travel together in `capMessageLength`, and both were prompt-only once
and both failed:

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
  AI-Supplemented reason turn at three sentences, and they run 303–340
  characters across the four cards before any reply clause; the User-Specified
  card is 280 exactly in one cell. Live runs came back with the abstraction
  alone and both covers dropped, which collapses the policy into a shorter
  User-Specified. Raised to 420. **The control was never the absolute number —
  it is that ONE cap applies to both policies**, and gate 9 reads realised
  lengths, not the cap. Lower it again only after checking the longest §6.6
  turn still fits.
- **The cut is taken at a bubble seam, and never from a clause that carries
  meaning.** `capMessageLength` takes protected clauses in PRIORITY ORDER.
  Under User-Specified that is the principal's card. Under AI-Supplemented the
  card is never said at all — the three §6.6 sentences ARE the message — so the
  **abstraction is protected first and the two covers after it**, for the same
  reason the card comes first: it is what the ladder is driven off, and losing
  a cover costs only some of the cover.

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
RECEIVES IT. This wire has now broken TWICE, once at each end.** A closing
conversation that loses the floor starts below what the participant just
watched the proxies reach: a 2,300 package on screen, then a 1,600 offer.

The first break was the route's, which sent `work`. The second was
`proxy-task.tsx`, which was still throwing the floor away after the route was
fixed, in three places at once: the state was typed `"none" | "work" |
"sensitive"`, the response was RE-DECLARED INLINE without `"priority"` — which
is why `tsc --noEmit` stayed clean and never saw the mismatch with the route's
own union — and the fold was a ternary collapsing everything below `sensitive`
to `work`. `TIER_LIMIT_INDEX` puts `work` at 2 and `priority` at 1, so those
are different option indices and different payoffs.

**Nothing in the test suite or the simulation could catch it**, and the reason
is worth remembering: `scripts/simulate-negotiation.mjs` preserves the value
correctly and asserts `voicedTier === "priority"`, so the app and the
simulation implemented DIFFERENT logic at the same point and only the
simulation was right. Every automated check passed while the Proxy arm quietly
paid a rung too little, on Points/JOINT, along the primary contrast.

Both ends use `foldTier` and the shared `ReasonTier` now. Do not re-type this
value locally, and do not fold it by hand — the type is the only thing that
makes the two ends agree, and a local union silently opts out of it.

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
**one** practice round → **Task 1 → Task 1 questions → Task 1 decision →
Task 1 REMARK** → **Task 2 → Task 2 questions → Task 2 decision → Task 2
REMARK** → wrap-up → debriefing.

The post-task decision screen is the one screen that differs by role: the
Leader decides the recommended bonus, the Member writes `RECV-EVAL` and then
waits while "the manager decides" — shown no number, ever. REMARK comes after
it, in both roles and both arms.

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

Inside a Direct task: cover → brief → **RISK** → what you want → "waiting for
the other participant" → negotiate → review.

Inside a Proxy task: cover → brief → **RISK** → **mandate (levels + reason
cards, one screen)** → check with your proxy → confirm → watch the two AI
Proxies → **RATIFY** → *(only if modify or reject)* handover → negotiate
directly → review.

**Neither arm has a card control inside the conversation any more.** Ver.2.20
removed it; both negotiation screens are a composer and nothing else. The
reason cards still exist and are still ticked — but on the MANDATE screen, in
the Proxy arm only, where authorizing a proxy is what they are for. A Direct
participant reads their cards in the briefing panel and then simply talks.

**The mandate is ONE screen: the levels on both terms and the reason
cards.** They were two screens in sequence, which made them two decisions
taken in order — the position fixed before the reasons were considered. The
gap this study is about is precisely that the second half was never asked, so
splitting them contradicted the contribution.

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
  bite Direct never had; editing instructions before anyone has spoken is
  just writing a mandate.
- **No unticked card, ever.** The route screens the generated text against the
  cards left unticked (`lib/ai/reason-leak.ts`) and substitutes a refusal.
  Hearing a sensitive card read aloud without authorizing it would stage the
  disclosure being measured, so a prompt instruction alone is not enough.

  **That screen is the one guardrail whose failure is invisible**, which is why
  it has its own test file (`tests/reason-leak.test.mjs`): a leak looks like an
  ordinary helpful answer and the participant would never know a card they
  withheld had been spoken back to them. It matches VOCABULARY, not sentences,
  because a leak arrives as a paraphrase; and it SUBTRACTS the sayable
  vocabulary first, because a forbidden card shares most of its words with the
  term it belongs to. Rewriting the Task A Member card in Ver.2.18 left only
  four distinctive words after that subtraction, against 9–11 for the others,
  so a faithful paraphrase could have carried the secret past it; it was
  respecified to eleven. **Re-run this test before anything else whenever an SB
  card is reworded.**

What it costs, and it is real: the Proxy arm gains screen time and a written
exchange Direct has no counterpart for. Read it as part of the manipulation,
and against the §10 gate 8 timing budget.

**The decision comes back to the participant: `RATIFY`** (§7, §9.3). The
proxies run ONCE — no revision, no second run — and then the participant
approves what they reached, asks for a change, or refuses it. Approving ends
the task. The other two open a three-minute conversation with the other
participant, with the proxies' full transcript on screen beside them.

**Ver.2.12 deleted a ratification screen, and bringing it back is not a
reversal of that reasoning.** That reasoning was right about the shape it had:
when BOTH arms ended with the participant agreeing a package in conversation,
asking "do you accept this?" afterwards made them re-decide what they had just
decided, and handed the Proxy arm a way to undo an agreement Direct could
not. §7 changes the shape — the conversation is no longer the default ending —
and the retained decision IS the construct this study is built on: delegation
of VOICE with retention of the DECISION (§2.6).

**Three rules the screen must keep.** It may not recommend an answer: the three
controls carry equal weight, none is pre-selected, and no copy suggests what a
sensible participant does — the distribution across the three is the finding.
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
mandate" in the Proxy arm and not in Direct. Asked cold, right after the
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
   get their own headings, borders and colours, on the briefing and on the
   mandate screen. The whole measure is which box a participant is willing to
   draw from; if the two read as one list, that decision stops being legible.
   It matters MORE now that the Direct arm has no picker: the briefing panel is
   the only place a Direct participant ever sees the two boxes, so it is the
   only place the distinction can be made visible to them at all.
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
reason opportunity, the counterpart discloses its own at stage 4, and the
best↔best trade lands. They are for reading the flow, not for exercising the
failure branches — the misread, in particular, never fires in a mockup, because
the ideal path never stops at the work reason.

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

**Why the gate is not per-turn, which was the first design and is wrong.**
Both facts were established by tracing the clients:

- A 503 from `/api/classify-reason` is **swallowed**. Both callers read
  `if (data.label) label = data.label` inside a try/catch, so a body with no
  `label` silently leaves the tier at `none` — the very silence the guard
  exists to break, one layer down.
- The Direct arm has **no error state at all**. Its counterpart fetch has no
  catch and falls through to "sorry, lost my train of thought there", so a
  mid-negotiation refusal would have a participant watch the counterpart
  apologise forever, forty minutes in, with half their data collected.

**`ModelNotConfiguredError` is a named class for one reason**: the classifier
must tell it apart from an ordinary model failure. `{label:"none"}` is correct
for a call that FAILED — recoverable, since the tier only rises and the
participant can say it again — but the same answer for a study with no model
at all would floor every message of every session in silence. Same shape,
opposite meaning, so they cannot share a catch.

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
| Rehearsal chat (participant ↔ own proxy) | `app/api/proxy-rehearsal/route.ts` · the rehearsal prompt in `lib/ai/prompts.ts` |
| The unticked-card screen for the rehearsal | `lib/ai/reason-leak.ts` — tested by `tests/reason-leak.test.mjs` |
| Atomic slot claim | `app/api/assign/route.ts` — `claimSlot` in `lib/assignment.ts` is the only thing that decides an assignment |
| Task payoffs, role stories, reason cards, the §6.6 abstractions and covers | `lib/tasks.ts` |
| Counterpart moves, the justification ladder, outcome coding | `lib/negotiation/machine.ts` |
| The scripted ideal exchanges for mockup mode | `lib/negotiation/script.ts` |
| The live end-to-end simulation | `scripts/simulate-negotiation.mjs` — `npm run simulate` |
| Model / reasoning effort, the live-study guard | `lib/ai/config.ts` |
| Launch readiness report and the entry gate | `app/api/preflight/route.ts` |
| Agent behavior rules (P0–P4, the rehearsal, the classifier) | `lib/ai/prompts.ts` |
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

Note that `lib/ai/prompts.ts` calls BOTH the rehearsal prompt and the
classifier "P5", following the design doc's own §12 numbering in each case.
They are different calls with different routes; read the section headers rather
than the label.

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

**Ver.2.20 was re-verified the same way** (`npm run simulate`, eleven runs, all
passing, plus 162 unit tests). **The simulation now drives the tier through the
REAL classifier — one live P5 call per participant message — because that is
the only automated check on it.** Deriving the tier from a card id there would
test a study that no longer exists. Two of the runs assert that the classifier
recognises a confession said in the participant's own words rather than the
card's, which is the whole thing the Direct arm now depends on.

What the runs are for, beyond the assertions: the symmetric ladder produces
exactly 3,000/3,000 with the SB, 2,300/2,300 on a bare priority claim and
1,600/1,600 on the work reason alone, in live prose; the misread fires on a
genuine WR-only run and reads as help rather than a lowball; the counterpart's
own SB disclosure reads as a person volunteering something rather than a system
reciting a card; the rewritten confessions land as things a colleague would
actually be reluctant to say; the AI-Supplemented turn carries the abstraction
AND both covers; and a mid-closing confession really does move the counterpart
to put the maximum up itself.

**The eleventh run asks the classifier directly**, because every Direct outcome
now rests on it and gate 19 puts a κ bar on it. Six cases, and the last two are
the ones §6.2 singles out: a DENIAL mentions every distinctive word of the card
while disclosing nothing ("it's not like the client complained about me"), and
a VAGUE HINT gestures at a secret without conveying it. Both must land below
`SB`. The asymmetry is real — a missed disclosure is recoverable, because the
participant can say more and the tier only rises, while a concession granted on
a misread cannot be taken back.

**Four defects came out of the Ver.2.20 runs and three were real** — the kind
that produce a plausible transcript and wrong data, which is why the run
exists. All three are recorded in the sections above: the counterpart misreading
its own proxy, the abstraction sentences never reaching the prompt, and
`voicedTier` not carrying the proxy's floor into the closing, plus the
280-character cap that could not fit a §6.6 turn. The fourth was a bad test
script — a participant who opens "the days are the big one" is making a priority
claim, and the classifier was right to say `PRI`.

Two earlier findings that still hold. **The simulation's seeded opening had
diverged from the app** — it was anchoring on the counterpart's own best
package after `openingLine` had moved to SCRIPT-OPEN, which meant the only
automated check on the live prose was checking a study nobody runs.
`counterpartOpening` is deleted so the two cannot drift again. And
**SCRIPT-BALANCE needed splitting**: it carries a judgement AND a package, and
asked as one sentence the model wrote a single 179-character bubble, over the
120-char rule that keeps the counterpart reading like a person typing.

**Some defects only a browser walk finds.** The last pass walked practice →
mandate → confirm → watch → RATIFY → reward → REMARK in both arms with mockup
mode on, and found six things no unit test or simulation could reach, because
they were in the SCRIPTED prose and the screens around it: first-person
proxies, a labelled disclosure, a seeded opening that still asked for the
priority, a missing §8.1 sentence on the instruction page, a stale Task B
title and role-story pronoun, and the dev panel's un-migrated slot. Walk the
flow after any migration; the tests do not read.

## Ver.2.20 migration status

Migrated in full, across seven design versions of which five change structure
rather than wording:

- **Ver.2.14** — REMARK and ATTR after each post-negotiation decision (§6.8,
  §9.4.9), and the §9.6 item cuts with their renumbering: PCR 7→6, PNPQ 4→3,
  OWN-AI 5→4, OTHER-AI 6→4, POWER 3→2, IMM 2→1. The four behavioural measures
  are untouched: `SB` / `SB-TIMING` / `Points·JOINT` / `RATIFY` (§9.3).
- **Ver.2.15** — the everyday-terms scenario: a project team at a company,
  team lead and senior team member; Task A "Next Quarter's Working
  Arrangements", Task B "Starting the New Project". Payoff spine unchanged.
- **Ver.2.16–2.17** — the decoy work reason, the four-rung ladder
  (1,600 / 1,600 / 2,300 / 3,000), `SCRIPT-MISREAD`, and the anchor-free,
  priority-free `SCRIPT-OPEN`.
- **Ver.2.18** — the condition rename (`direct` / `user_specified` /
  `ai_supplemented`), all four SB cards rewritten as things ALREADY DONE, and
  the single §5② evaluation guideline for both roles.
- **Ver.2.19** — the third-person representative voice for both proxies, with
  `relayed` written on every card.
- **Ver.2.20** — the card buttons abolished and the **P5 classifier** in their
  place (§6.2a); **AI-Supplemented rewritten to ABSTRACT rather than ADD**,
  with the role-plausible pool and its budgets deleted (§6.6); the message cap
  at 420; and the timing and pay recomputed (61 minutes, £8.25 + £1.00).

Carried forward from Ver.2.13 and still true: the symmetric ladder (§3.3,
§6.2), the six-stage script (§6.1), the counterpart's fixed SB disclosure
(§6.3), the consolidated fixed scripts (§6.4), the proxy's first-opportunity SB
schedule (§6.5), **RECV-EVAL** (§5), **RATIFY as its own screen** with the
conditional closing conversation (§7), and the removal of the range mandate
from both arms (§2.6, §8.6).

The §9 instrument is otherwise unchanged since Ver.2.12 — §9.4's item set
survived every revision but Ver.2.14's cuts, which is why `lib/measures.ts`
needed little beyond renumbering and the ATTR block.

Verified against the live model end to end — `npm run simulate`, eleven runs
through the real routes, with the classifier in the loop; see "Verified against
the live model" above.

**Still design-open (§9.8, §13), not implementation gaps:**

- the working values themselves: the outcome ladder (1,600 / 2,300 / 3,000),
  the fallback (600), the misread's 600/1,900, and the strength of the §5②
  decision guideline are all to be fixed at pilot
- §9.8-1: the three RECV-EVAL items are `[PROPOSED]` — wording and anchor style
  (7-point agreement vs evaluation) are not settled
- §9.8-5: `SB-TIMING`'s categories 3 and 4 are structurally exclusive by arm,
  so the χ² has zero cells by construction — the test's unit must be
  pre-specified
- §13.4: aligning PCR / PNPQ / PNOQ to the SVI's four factors, so a validated
  scale can be cited
- §13.5: the item wording is written in English against Korean drafts and
  needs a pass against the final translation
- §13-19: whether `SCRIPT-MISREAD` stays an OFFER or softens to a question,
  decided by the pilot's acceptance rate against gate 7

**§9.8-4 is RESOLVED.** It asked for the Direct operational definition of `SB`
when a participant describes the sensitive background without tagging the card.
There is no card to tag any more: the P5 classifier reads every message, and
the post-hoc human re-coding reported as κ (gate 19, ≥ .90 or Wizard-of-Oz) is
the sensitivity analysis §6.2 asked for. The question the old design could only
answer by convention is now answered by measurement.

## Still open

Nothing structural. What remains is values to fix and behaviour to observe:

- **Pilot-dependent numbers.** The fallback (600), the outcome ladder
  (1,600 / 2,300 / 3,000), the misread package, the strength of the §5②
  decision guideline, and the Prolific completion code.

  **The payment is settled**: £8.25 participation plus a £1.00 bonus is £9.25
  for a 61-minute study — £9.10 an hour, above Prolific's recommended fair-pay
  rate of £9.00 (their hard floor is £6.00/hour). GBP because Prolific pays in
  it. **The pay rose when the budget did, and the direction is the rule.**
  Ver.2.14's REMARK screen costs two minutes across the study; left at £8.00
  the rate would have fallen to £8.85/hour, below the recommended rate the
  listing is judged against, so the base moved. The number to adjust is always
  the PAY, never the advertised minutes: the estimate is derived from the
  screens that exist, and quoting less than the study takes underpays whoever
  is slower than it.

  The pound is held back and presented as something a Leader decides and a
  Member receives, and every participant is paid it in full — one of the four
  deceptions alongside the counterpart's existence, the upward evaluation and
  the parting comment, all retracted by name at `/debriefing`. It is held back
  rather than paid flat because gate 2's POWER2 asks whether outcomes that
  mattered depended on the other person's decisions, and a bonus the Member
  believes someone else is deciding IS that dependence.
  `tests/study-config.test.mjs` pins base plus bonus against the advertised
  total and both against the rate.

  On the impasse target (gate 6, under 10%): the ladder makes impasse much
  harder to reach than the old threshold rule did, because every rung is an
  acceptable agreement and even the unargued one (1,600) beats the fallback
  (600). The remaining routes are a participant who keeps asking off the ladder
  and refuses the counterpart's tier package until the clock runs out, and a
  participant who accepts the misread — both real behaviours worth measuring
  rather than bugs. Watch the rates rather than pre-emptively widening
  anything.

- **Timing.** `STAGE_MINUTES` sums to 61 minutes and the consent page
  advertises 61. (The design doc's §7 heading gives a looser rough estimate;
  this figure is summed from the screens that actually exist. Adopting the
  looser number would advertise less than the study takes.) `TOTAL_MINUTES` is
  derived from those same numbers and `timingIsHonest()` pins the relation —
  the advertised figure may round the budget DOWN by at most a minute and never
  further, because a listing that promises less than the study takes underpays
  anyone slower than the estimate and the fair-pay rate is computed from it.
  The two additions since Ver.2.13 are honest ones: `taskSurvey` at 7 minutes
  for about twenty-five ratings and seven written answers (it was 4, which
  understated the study by six minutes across the two tasks and therefore
  understated the pay owed for them), and `reward` at 2 for the decision plus
  REMARK. Gate 8 asks for a task median under 12 minutes. A Proxy task is the
  longer arm — the proxies' watching plus a 3-minute closing — but both clocks
  are caps, not targets. The pilot median decides this; the lever is the
  reply-delay range, never the advertised figure.

- **Whether the two arms are matched on the participant's own airtime.** A
  Direct participant writes the whole negotiation; a Proxy participant watches
  one and then writes a short closing. That asymmetry IS the design, but it
  means "how much did they say" is not a between-condition control, and any
  measure that behaves like a word count should be read with that in mind.

- **The proxy's tier-2 floor.** Only a Direct participant can reach the bottom
  rung or accept a misread, so Mode differences in Points/JOINT carry a
  mechanical component. It is documented (§13-13②) rather than fixed, and it is
  why `SB` is the confirmatory outcome and JOINT is secondary. Report it; do
  not quietly remove the floor to make the arms look symmetric, because a proxy
  that does not state its principal's priority is not a proxy.

- **Classifier agreement.** Gate 19's κ ≥ .90 is the thing that decides whether
  the P5 route survives contact with real participants. Until the pilot there
  is no evidence beyond the simulation's two assertions that a confession in
  the participant's own words is recognised. If it fails, the fallback is
  Wizard-of-Oz tagging (§13-24), which is a live-operations change, not a code
  change to plan for now.

- **Whether two issues survive the demand-characteristic check.** With only two
  terms each requirement is highly salient, and the suspicion probe may show
  participants guessed the design. Adding a term back would mean recomputing
  every payoff property above.

- **Whether the counterpart's SB disclosure primes PERC.** This is the known
  cost of the §6.3 rule, accepted because `SB` needs a fixed reciprocity point.
  It is constant across conditions, so it cannot produce a condition effect —
  but it can lift PERC and RISK uniformly, and RISK is gate 4's
  task-equivalence instrument. Check both tasks' RISK means against gate 4 in
  the pilot before reading anything into their level.

- **The failure branches have tests, but mostly at the machine level.**
  `tests/reason-rules.test.mjs` pins the ladder rungs in four cells, impasse,
  the one-shot reminders, and script–machine agreement;
  `tests/reason-leak.test.mjs` pins the rehearsal guardrail in both directions;
  the live simulation covers the WR-only path, the misread, and a mid-closing
  disclosure. What is still unexercised automatically is the INTERFACE around
  the failure branches — the emergency stop, and the clock actually running out
  on a real screen. Both were walked by hand, as were RATIFY's three branches:
  approve goes straight to review, modify keeps the package on the table,
  refuse clears it.

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
