# Project notes

Online experiment platform for a 2027 CHI submission on AI-mediated
negotiation. Source of truth for the design is `N - Methods (ver.1.3).md`.
This file records the constraints that are easy to break by accident.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · deploy to
Vercel · Supabase for persistence (planned, not wired) · `gpt-5.6-sol` for all
AI turns.

## Design in one paragraph

120 Prolific participants. Each does **one Direct session and one Proxy
session** — never all three conditions. Proxy is either **Delegate** (may only
use what the participant entrusted) or **Explorer** (may also add
task-grounded options, with no source labelling). Role is **Leader** (high
power) or **Member** (low power). Two structurally matched tasks, A and B.
Comparisons of interest: `Pooled Proxy − Direct` and `Explorer − Delegate`,
each crossed with Role.

## Things the participant must never learn mid-study

These are load-bearing. Breaking any one invalidates the data.

1. **The counterpart is an AI.** It is presented as another Prolific
   participant. In the Proxy session, its assistant is presented as that
   person's assistant. Disclosed only at `/debriefing`.
2. **Which condition they are in.** Sessions are labelled "Session 1" and
   "Session 2", never "Direct"/"Delegate"/"Explorer". The URL carries only the
   session index. Instructions describe both interface types generically.
3. **Which proposal elements the Explorer generated.** Internal provenance is
   recorded for audit and stripped server-side before the response leaves
   `/api/proxy-negotiation`. Delegate and Explorer render the *identical*
   interface — the difference lives entirely in the backend policy.
4. **That the reward decision is fake.** For Members it is a standardized
   number presented as the Leader's judgment. Disclosed at `/debriefing`.

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

Six decisions the screens depend on. Breaking one is a regression even if it
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
   names in the export — renaming one renames a variable.

## Dev / mockup mode

A floating panel (bottom-right, or Ctrl/Cmd+Shift+D) makes the flow walkable
while the design is unsettled: it skips required-field gating, fills a page
with dummy answers, jumps between pages *and* between the phases inside a
session, swaps the assignment (role · proxy policy · sequence) without clearing
storage, fakes AI turns instantly, and resets participant data.

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
`useDevGate(complete)` rather than `complete`, register a dummy-answer filler
with `useDevAutofill`, and register phase jumps with `useDevActions` for state
the URL cannot reach. All of them are no-ops in a production build. See
`lib/dev-mode.tsx`.

## Where to plug things in

| Task | File |
|---|---|
| Supabase persistence | `lib/store.ts` — write a `SupabaseStore`, change `getStore()` |
| Atomic slot claim | `app/api/assign/route.ts` |
| Real task payoffs | `lib/tasks.ts` — shapes are stable, values are placeholders |
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
  inside Vercel's 60s Hobby limit, so the turn budget is a design choice
  rather than a timeout constraint, and the waiting screen shows real
  progress. Budget is 6 per side (12 total, ~100s measured).
- **Agents need pacing guidance, not just a turn count.** Given only
  "turns remaining" they restated their opening and then "accepted" a package
  containing none of the other side's terms. `pacingBlock()` in
  `lib/ai/prompts.ts` derives an opening / trading / closing phase from
  progress through the budget. With it, the exchange logrolls properly
  (trading timeline and review rights for workload and credit) and reports a
  genuine impasse instead of fake-accepting. This is prompt scaffolding
  standing in for the state machine — remove it when that lands.
- **The counterpart needs its own mandate.** Without one it mirrors whatever
  the participant's Proxy opens with instead of negotiating. See
  `counterpartMandateSummary` in `lib/tasks.ts` — placeholder derived from the
  role scorecard, to be replaced with the researcher-defined mandate.
- **Guardrail asymmetry confirmed.** The same unentrusted-issue action is
  blocked for Delegate and allowed for Explorer when marked as an agent
  option; red lines, fabricated personal facts, and invalid options all block.

## Still open (from Methods §B3)

**Negotiation state machine — the largest gap.** Termination is still decided
by the model. With the pacing phases in place the exchange is now sound, but
two symptoms remain that the state machine should own:

- When both sides reach a genuine impasse they spend the remaining turns
  restating it (turns 11–12 in testing were pure confirmation). The state
  machine should detect the deadlock and stop.
- Acceptance is not gated on reservation thresholds, so nothing structurally
  prevents a premature accept — the prompt currently discourages it.

Methods §Negotiation state machine requires the state machine to own
acceptance, concession points, and challenge timing so trajectories are
comparable across conditions. The candidate agreement on the review screen is
likewise derived from the mandate as a placeholder rather than from negotiated
terms.

Also open: task payoff matrices and BATNAs · turn budget and reasoning effort ·
whether Explorer options are pre-generated or validator-bounded at runtime ·
fixed vs. jittered counterpart delay · final IRB language, payment amount, and
Prolific completion code.

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
