# Project notes

Online experiment platform for a 2027 CHI submission on AI-mediated
negotiation. Source of truth for the design is
`N - Experimental Design (Ver.2.4).md`. This file records the constraints that
are easy to break by accident.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · deploy to
Vercel · Supabase for persistence (planned, not wired) · `gpt-5.6-sol` at low
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

Both conditions run the same **five stages** — opening, priorities and reasons,
the standardized challenge, a conditional trade, the tentative package — one
message per side each, ten in total, **counterpart first at every stage**. That
shared structure is what makes a Baseline transcript and a Proxy transcript
comparable, so a task may not skip stages or end early, and the counterpart's
fixed opening must be on screen before the participant writes anything: it is
the anchor their reply is measured against.

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
answer.

## Things the participant must never learn mid-study

These are load-bearing. Breaking any one invalidates the data.

1. **The counterpart is an AI.** It is presented as another Prolific
   participant ("Alex"). In the Proxy task, its AI Proxy is presented as that
   person's. Disclosed only at `/debriefing`.
2. **Which condition they are in.** Tasks are labelled "Task 1" and "Task 2",
   never "Baseline"/"Delegate"/"Explorer". The URL carries only the task index.
   The *policy* is disclosed (both principals are told whether pool reasons are
   in use — §7 requires it, and OTHER-AI4 is unanswerable otherwise); the
   *condition name* never is.
3. **Which individual reasons came from the Explorer pool.** Internal
   provenance is recorded for audit and stripped server-side before the
   response leaves `/api/proxy-negotiation`. `DisplayMessage` has no field for
   it, so a transcript component cannot render it even by accident.
4. **That the Member's bonus is fixed.** It is a constant, identical in every
   condition, presented as the Leader's judgement. Disclosed at `/debriefing`.
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

Inside a task: brief → preferences (→ reason cards → confirm, in Proxy) → RISK
→ "waiting for the other participant" → negotiate or watch → review.

## Interface rules

Eight decisions the screens depend on. Breaking one is a regression even if it
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
   are mostly forms. Prose does not follow the column: `.prose-study` and
   `max-w-prose` hold it near 70 characters.

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
3,200 for the speaker and 4,100 for the other side, which is what
`buildProxyPlan` independently produces from the standard mandate. A mockup
showing a package the real system would never reach is a mockup of a different
study — and levels named in a message are read from the package that message
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
| Supabase persistence | `lib/store.ts` — write a `SupabaseStore`, change `getStore()` |
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

Tested end to end against `gpt-5.6-sol` (2026-08-11). Findings worth keeping:

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

## Still open

Nothing structural. What remains is values to fix and behaviour to exercise:

- **Pilot-dependent numbers.** Reservation (2,500), acceptance thresholds
  (T_MID = 3,600 / T_FINAL = 2,600, targeting impasse below 10%), the Member's
  fixed bonus (70/100), the advertised time and payment, and the Prolific
  completion code.
- **Timing.** `STAGE_MINUTES` sums to about 55 minutes, which is what the
  consent page advertises. Design §10 gate 8 asks for a task median under 12
  minutes; the 10-minute negotiation cap plus briefing, mandate and review sits
  above that, and the pilot decides whether the lever is the reply-delay range
  or the turn budget. Not the advertised figure, which must not drift below
  what the study actually takes.
- **Whether three issues survive the demand-characteristic check.** With only
  three terms each requirement is salient, and the suspicion probe may show
  that participants guessed the design. The preregistered fallback is a fourth
  (distributive) issue, which would mean recomputing every payoff property
  listed above.
- **Nothing exercises the failure branches automatically.** Impasse, the
  emergency stop, the reason-request branch and the one revision all work when
  driven by hand, but mockup mode carries only the ideal trajectories, so a
  regression in any of them would be quiet. Worth a test before collection.
- **The counterpart principal's ratification line is hardcoded** in
  `review.tsx` rather than rendered through P2. Fine for the mockup; it should
  go through `/api/counterpart` with `kind: "counterpart_principal"` before
  collection, so its voice matches the rest of the exchange.
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
