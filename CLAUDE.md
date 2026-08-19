# Project notes

Online experiment platform for a 2027 CHI submission on AI-mediated
negotiation. Source of truth for the design is `N - Methods (ver.1.8).md`.
This file records the constraints that are easy to break by accident.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · deploy to
Vercel · Supabase for persistence (planned, not wired) · `gpt-5.6-sol` for all
AI turns.

## Design in one paragraph

120 Prolific participants. Each does **one Baseline session and one Proxy
session** — never all three conditions. Proxy is either **Delegate** (may only
use what the participant entrusted) or **Explorer** (may also test package
combinations inside those limits and argue for them with role-generic
reasons, with no source labelling). Role is **Leader** (high power) or
**Member** (low power). Two structurally matched tasks, A and B. Comparisons
of interest: `Pooled Proxy − Baseline` and `Explorer − Delegate`, each crossed
with Role.

## The task, in numbers

Three terms, four options each. One is worth a lot to the Leader and little to
the Member (scope), one is the reverse and is the **focal requirement** the
study is about, and one is constant-sum (timing). Payoffs are in
`lib/tasks.ts` and these properties are load-bearing — if you change a number,
recheck all of them:

- individual maximum 6,300; joint range 4,800–7,800
- full logroll (scope O1 + focal O1) is the *only* point at joint 7,800;
  compromising everything in the middle gives 6,800
- reservation 2,500 each, so 24 of the 64 packages clear both sides, and 17 of
  those also hold the focal threshold — protecting the requirement and
  reaching agreement are compatible **by construction**
- focal adequacy threshold is Options 1–2. O1→O2 keeps it, O2→O3 breaks it,
  which is why the trajectory is reported as transitions and never summed

The focal is worth 3,000 on purpose. If it were cheap, giving it up would be
explicable as a sensible low-priority concession — exactly the thing this
study has to distinguish from withdrawal under evaluative pressure.

## Who decides what in a negotiation

`lib/negotiation/machine.ts` decides the moves: offer levels, concessions,
acceptance (T4 = 3,600 at stage 4, T5 = 2,600 at stage 5), and termination.
The model only says those moves in the right voice. Keep it that way. A
counterpart whose judgement is the model's is a different counterpart for
every participant, and it is the reason Methods §Outcome policy does not need
to randomize outcomes: identical behaviour already produces identical results.

Both conditions run the same **five stages** — opening, priorities and
reasons, the standardized challenge, a conditional trade, the tentative
package — one message per side each, ten in total, **counterpart first at
every stage**. That shared structure is what makes a Baseline transcript and a
Proxy transcript comparable, so a session may not skip stages or end early,
and the counterpart's fixed opening must be on screen before the participant
writes anything: it is the anchor their reply is measured against.

## Things the participant must never learn mid-study

These are load-bearing. Breaking any one invalidates the data.

1. **The counterpart is an AI.** It is presented as another Prolific
   participant ("Alex", Appendix E7). In the Proxy session, its assistant is
   presented as that person's assistant. Disclosed only at `/debriefing`.
2. **Which condition they are in.** Sessions are labelled "Session 1" and
   "Session 2", never "Baseline"/"Delegate"/"Explorer". The URL carries only
   the session index. Instructions describe both interface types generically.
3. **Which proposal elements the Explorer generated.** Internal provenance is
   recorded for audit and stripped server-side before the response leaves
   `/api/proxy-negotiation`. Delegate and Explorer render the *identical*
   interface — the difference lives entirely in the backend policy.
4. **That the reward decision is fake.** For Members it is a standardized
   number presented as the Leader's judgment. Disclosed at `/debriefing`.
5. **What the private reason is for.** A participant marks each reason card
   sayable or private, and that choice is a measure. The interface must never
   suggest one answer is expected — the defaults come from Appendix A8 (work
   reason sayable, private circumstance private) and nothing may nudge past
   them.

When adding any UI, check it against this list.

## Assignment (planned Supabase behavior)

A pre-seeded `assignment_slots` table holds one row per planned participant,
each with a fixed `(proxy_policy, role, sequence_id)` and a `claimed` boolean.
On entry the server **atomically** claims the first unclaimed row and flips it
to true; the next participant takes the next false row. This keeps the four
`Proxy Policy × Role` cells and the four sequences balanced by construction,
with no runtime randomization.

The claim must use `FOR UPDATE SKIP LOCKED` (or an equivalent conditional
update) so two simultaneous participants cannot take the same slot. Assignment
is idempotent per participant key, so a refresh never reassigns.

Currently `lib/assignment.ts#claimSlot` is a deterministic local stand-in.
`/api/assign` is the swap point: replacing the body of `claimSlot` with the
RPC call is the whole change, because nothing else in the app decides an
assignment. Pages read it through `useParticipant`, and `resolveAssignment`
expands a claimed row into the two-session plan.

The dev panel's slot picker does **not** go through any of this. It swaps the
assignment the UI renders, in memory, for previewing; it never claims a slot
and never writes one. Keep it that way — a preview control that could consume
a real row would silently unbalance the design.

## Interface rules

Nine decisions the screens depend on. Breaking one is a regression even if it
compiles.

1. **Colour encodes visibility.** Cool white and navy are the shared table;
   sand is private to the participant. Never render a private value — a point
   total, a reservation position, a briefing — on a plain white card. The study
   is about what people are willing to expose, so "can they see this?" must
   never be a question the participant has to ask. Tokens in `globals.css`.
2. **Nothing starts answered.** `Scale` and `AmountScale` have no default
   position. A slider's midpoint gets submitted by everyone who does not
   engage, and is indistinguishable from a considered midpoint. Do not
   reintroduce a control with a starting value.
3. **One progress bar, derived from the URL.** `flowKeyFromPath` is the single
   source; pages never declare their own step. This is what makes progress
   assignment-order-proof — the URL carries only the session index.
4. **The study only moves forward, except where going back is harmless.**
   `NavigationGuard` absorbs the browser back press with a sentinel history
   entry — do not "fix" it by redirecting forward instead, because a session's
   phase is component state and a remount restarts the negotiation. The four
   steps a participant may return to are listed in `BACK_STEPS`
   (`lib/study-config.ts`), reached through the `BackButton` in the action bar.
   Anything reachable by Back must restore its saved answers with
   `useRestoreAnswers`, or Back is a trap that blanks the screen.
5. **The briefing is never taken away.** `SessionLayout` pins it beside the
   work from `lg` up and behind one tap below that, at every phase. Anything a
   participant is expected to negotiate from belongs in it.
6. **Items are data.** Every questionnaire item lives in `lib/measures.ts`;
   pages hold answers and never lay out a question. Item ids are the column
   names in the export and match Appendix D — renaming one renames a variable.
   `[FOCAL REQUIREMENT]` is substituted per task by `withFocal`, so one id
   covers both scenarios rather than two ids meaning the same thing.
7. **Two measures, and prose keeps its own.** Column widths are the
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
   plus fixed anchors plus fixed buttons needed 54rem and the session column
   is about 50rem, so "Strongly agree" hung outside the card. Rows flex, and
   the parts that cannot shrink are grids that fit their container.
8. **A cue points, it does not colour.** The one thing a screen is waiting for
   gets `.cue-ring` (an outline) and a `Cue` pill — "Your turn", "3 to
   answer", "Waiting for their reply". It may never change a card's surface,
   because the surface is what says who can see what is on it (rule 1), and it
   may never suggest an answer, only that one is expected. At most one ring on
   a screen; pills that count what is left may repeat.
9. **A session announces itself.** Every practice round and every session
   opens on a `SessionCover`: which of the two it is, whether it counts, what
   happens in it, how long it takes. It is a phase, not a route — the flow
   step still comes from the URL alone (rule 3) — and it is deliberately not
   counted as one of the session's own steps.

## Dev / mockup mode

A floating panel (bottom-right, or Ctrl/Cmd+Shift+D) makes the flow walkable
while the design is unsettled: it fills every screen on arrival, skips
required-field gating, jumps between pages *and* between the phases inside a
session, swaps the assignment (role · proxy policy · sequence) without clearing
storage, plays the negotiation instantly, and resets participant data.

**Mockup mode** (`autoFill`) is the one that matters for reading the flow.
Filling is not the same as skipping: skipping lets you past an empty screen and
leaves you looking at an empty screen, which tells you nothing about whether
the thing reads. With mockup mode on, every condition × role × task has a
written exchange in `lib/negotiation/script.ts` — modelled on the worked
example in Appendix E8, participant messages included — so the Baseline
composer arrives with the message for that stage already in it, the review
screen shows a real ten-message transcript and a real package, and pressing
Continue from the consent page to the completion code shows you what a
participant would actually see.

Those scripts are the *ideal* trajectories: the logroll lands, the threshold
holds, the counterpart accepts at stage 4. They are for reading the flow, not
for exercising the failure branches.

It is present by default on every build, including deployed ones, so the
layout can be checked wherever it happens to be running.

**Before recruiting: set `NEXT_PUBLIC_DEV_TOOLS=off` and redeploy.** The panel
names conditions and shows the assignment. The ON/OFF and "hide" controls in
the panel live in one browser's localStorage — they are conveniences for
whoever is looking, and they do not hide anything from a participant. Only the
variable does.

| Build | Panel |
|---|---|
| local / preview | present, dev mode on by default |
| live deployment (`NEXT_PUBLIC_VERCEL_ENV=production`) | present, dev mode **off** by default, with a warning in the panel |
| `NEXT_PUBLIC_DEV_TOOLS=off` | not loaded — the chunk is behind a dynamic import that is never reached, and no prerendered page references it |

Dev mode starts off on the live deployment so that a forgotten launch switch
costs a visible panel rather than a study collecting data with its validation
bypassed.

`?dev=1` / `?dev=0` in the URL forces the toggle. Ctrl/Cmd+Shift+D opens the
panel and brings it back after "Hide".

Wiring, when adding a page: gate the Continue button on
`useDevGate(complete)` rather than `complete`, register a filler with
`useDevAutofill`, and register phase jumps with `useDevActions` for state the
URL cannot reach. All of them are no-ops in a production build. See
`lib/dev-mode.tsx`.

`useDevAutofill` takes a second `key` argument. Pass one from anything that
changes without remounting — a session phase, a negotiation stage — or the
screen fills once and every screen after it inside the same component arrives
empty.

## Where to plug things in

| Task | File |
|---|---|
| Supabase persistence | `lib/store.ts` — write a `SupabaseStore`, change `getStore()` |
| Atomic slot claim | `app/api/assign/route.ts` |
| Task payoffs, role stories, reason cards | `lib/tasks.ts` |
| Counterpart moves, acceptance thresholds, concessions | `lib/negotiation/machine.ts` |
| The scripted ideal exchanges for mockup mode | `lib/negotiation/script.ts` |
| Model / temperature | `lib/ai/config.ts` |
| Agent behavior rules | `lib/ai/prompts.ts` |
| Guardrails | `lib/ai/validator.ts` |
| Timings, payment, IRB text, completion code | `lib/study-config.ts` |
| Questionnaire items, scales, response options | `lib/measures.ts` |
| Design tokens, type scale | `app/globals.css` |
| Controls (scale, chips, buttons, cards) | `components/ui.tsx` |
| Progress bar and sticky action bar | `components/study-chrome.tsx` |
| Briefing panel and session layout | `components/session.tsx` |
| Dev-mode gating, autofill, phase jumps | `lib/dev-mode.tsx` · `components/dev-panel.tsx` |

Pages never touch persistence or the network directly — they go through
`lib/store.ts` and `lib/participant-context.tsx`.

## Verified against the live model

Tested end to end against `gpt-5.6-sol` (2026-08-11). Findings worth keeping:

- **No `temperature`.** This model family rejects the parameter with a 400.
  Use `reasoning.effort` instead — see `lib/ai/config.ts`.
- **Reasoning block comes first.** The Responses payload emits a `reasoning`
  block before the `message` block, so `output[0]` has no text. Select by
  `type === "message"`. Also keep `max_output_tokens` generous, since reasoning
  tokens draw from the same budget and a tight cap returns `incomplete` with
  no message at all.
- **~7.5s per AI turn**, so `/api/proxy-negotiation` generates **one turn per
  request** and the client drives the sequence. Each invocation stays well
  inside Vercel's 60s Hobby limit, and the waiting screen shows real progress.
  Ten messages is roughly 75s of waiting.
- **The model must not be given the judgement.** Told only how many turns were
  left, the agents restated their openings and then "accepted" packages
  containing none of the other side's terms. A pacing block in the prompt
  patched the symptom for a while; ver.1.8 removed the cause by giving the
  moves to `lib/negotiation/machine.ts`. If an exchange ever starts behaving
  oddly again, check whether something has quietly handed a decision back to
  the model.
- **The counterpart needs its own mandate.** Without one it mirrors whatever
  the participant's Proxy opens with instead of negotiating. It now has one by
  construction: `counterpartOpening` plus the acceptance thresholds in the
  state machine.
- **Guardrail asymmetry confirmed.** Red lines, fabricated personal facts, and
  invalid options all block. Two checks are specific to ver.1.8: a reason the
  participant marked private may not be voiced under *either* policy, and the
  `common practice` frame is Explorer-only, since it is the framing that
  carries the source ambiguity.

## Still open (from Methods §Appendix G)

Nothing structural. What remains is values to fix and one piece of behaviour
to decide:

- **Pilot-dependent numbers.** Reservation value (2,500), the counterpart's
  acceptance thresholds (T4 = 3,600 / T5 = 2,600, targeting an impasse rate
  below 10%), the bonus conversion, the advertised time and payment, and the
  Prolific completion code.
- **The timing does not close.** `STAGE_MINUTES` sums to about 49 against the
  spec's 40-45, mostly because waiting is expensive: ~75s watching an AI-AI
  exchange, and 40-125s of counterpart reply delays in a Baseline session.
  The levers are the E7 delay range and the turn budget — not the advertised
  figure, which must not drift below what the study actually takes.
- **Whether three issues survive the demand-characteristic check.** With only
  three terms the focal one is salient, and the suspicion probe may show that
  participants guessed the design. The preregistered fallback is a fourth
  (distributive) issue, which would mean recomputing every payoff property
  listed above.
- **Yoked receiver stimuli — the largest remaining gap.** A Leader
  participant is a receiver: what they see IS the stimulus, and ver.1.8 calls
  it the core causal control for the receiver-side outcomes. It has to be
  pre-produced, reviewed, and played back identically under Delegate and
  Explorer. Live sessions generate each turn from the model instead. The
  packages are already identical (the state machine fixes them) and
  `leaderScript` is the yoked content, so the remaining work is to write and
  review those transcripts and serve them from `/api/proxy-negotiation` for
  Leader participants. Until then the `Explorer − Delegate` contrast on
  Attributional Leakage carries whatever wording the model produced.
- **Nothing exercises the failure branches automatically.** Impasse, the
  emergency stop, and the one revision all work when driven by hand, but
  mockup mode only carries the ideal trajectories, so a regression in any of
  them would be quiet. Worth a test before collection.
- Fixed vs. jittered counterpart delay · final IRB language · whether the
  private reason may be switched to sayable at all (default: allowed, starts
  private).

## Conventions

- Keep placeholder content marked `[PLACEHOLDER]` or `TBD` so it is greppable.
- Anything that would leak the design gets a comment explaining why it is
  written that way — the next person will not have this context.
- `npm run build` and `npx eslint src --max-warnings=0` must pass before commit.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
