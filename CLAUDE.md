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

## Still open (from Methods §B3)

Task payoff matrices and BATNAs · negotiation state machine (the review screen
currently derives terms from the mandate as a placeholder) · turn budget and
temperature · whether Explorer options are pre-generated or validator-bounded
at runtime · fixed vs. jittered counterpart delay · final IRB language,
payment amount, and Prolific completion code.

## Conventions

- Keep placeholder content marked `[PLACEHOLDER]` or `TBD` so it is greppable.
- Anything that would leak the design gets a comment explaining why it is
  written that way — the next person will not have this context.
- `npm run build` and `npx eslint src --max-warnings=0` must pass before commit.
