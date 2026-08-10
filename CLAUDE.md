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
`/api/assign` is the swap point.

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
