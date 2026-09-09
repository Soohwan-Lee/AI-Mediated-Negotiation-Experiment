# Experimental Design Ver.2.26 implementation update

Canonical source checked read-only: `N - Experimental Design (Ver.2.26).md`,
last updated 2026-09-09 in the external research vault. The active specification
in core §§2–9 and §12 governs over folded historical notes.

## Logic, timing, and prompt alignment

Planned stages:

1. Pin the current tier, disclosure, acceptance, timing, and payment rules with
   focused tests.
2. Extend the classifier and turn contract for off-topic, bonus, rule-change,
   conditional-acceptance, first-reason-opportunity, and withdrawal signals.
3. Route those signals through Direct and Proxy closing without letting
   malformed or out-of-scope content change packages, tiers, deadlines, or pay.
4. Align prompts, deterministic scripts, timers, and study-level constants.
5. Run focused tests, the full unit suite, type checking, lint, build, and a
   final diff review. Run only the separately approved bounded live smoke.

Implementation decisions:

- T1 remains 1,000 points each for no reason, WR-only, and a bare priority
  claim. Only an actually voiced SB or SB abstraction reaches T2 at 3,000 each.
- A Proxy participant who did not authorize SB initially can reach T2 by
  voicing the original SB in the optional direct closing. The original first
  disclosure choice remains false and the later disclosure is logged as
  wrap-up timing.
- Agreement requires an unconditional acceptance of the standing package.
  Conditional bonus demands, stale acceptances, malformed terms, and rule
  injection do not settle an exchange.
- Small talk and bonus-only messages do not consume the first reason
  opportunity. A substantive response or explicit refusal to share does.
  Mixed off-topic and valid SB content keeps the valid disclosure.
- Public compensation mentions such as £0.50 are not private point-score leaks.
  Chat cannot change the bonus recommendation, payment, timer, tier, or task
  terms.
- A withdrawal request takes the safe study-exit path. Technical failures keep
  the pending turn recoverable and do not consume negotiation time. The stop
  marker and withdrawal message/audit are saved without creating a completed,
  agreed, or impasse outcome.
- RATIFY's approve/change/decline controls remain behavioral actions. Redundant
  reflective prompt wording can be removed without deleting those controls.
- The obsolete `SCRIPT-FALLBACK` wording that promises a default arrangement
  conflicts with the active impasse-at-zero rule and must not be shown.
- P5's static rules/cards stay in the system message; cumulative participant
  text is sent separately as untrusted user content. Strict schema output is
  additionally checked for semantic shape, completion status, and unknown
  fields before any tier can move.
- `first_reason_opportunity` is an audit/lock signal. The separate
  `reasonlessTurns` counter controls one ASKSIT progression; weather and
  bonus-only turns advance neither, while explicit withholding consumes the
  first disclosure choice.
- Normal UI flow uses the classifier/mandate to set tier inputs, but the
  counterpart API still accepts a syntactically valid client-supplied tier and
  exchange state. Invalid tiers, packages, clocks, and conditional flags are
  rejected; full session-backed server authority remains outside this scoped
  update.
- Participant records, progress, stop/check gates, and the restored assignment
  are still backed by browser `localStorage`. They are not durable research
  storage and can be lost when site data is cleared or a different browser is
  used.
- `/api/assign` still hashes the participant key into a local 16-cell rotation.
  It is refresh-stable but does not atomically claim or balance recruitment
  slots. The planned Supabase assignment RPC and server persistence remain
  unwired.

Focused verification checklist:

- [x] WR-only, priority-only, and no-reason paths cannot produce T2.
- [x] A later direct-closing SB promotes the final tier without changing the
  original first-disclosure choice.
- [x] Impasse/no agreement yields zero; an agreement cannot silently become
  zero.
- [x] Accepting a stale T1 proposal after a T2 promotion does not settle.
- [x] Classifier failure neither elevates the tier nor loses the pending draft.
- [x] Off-topic, weather, bonus, and rule-change inputs cannot alter tiers,
  packages, deadlines, or payment.
- [x] A mixed SB plus off-topic message still registers the SB.
- [x] Direct and optional Proxy closing timers are both five minutes.
- [x] The study advertises 45 minutes and £7 base plus £1 extra, with £8 paid
  to completed participants.

## Source carryovers resolved

- Active §3.2 line 230 and §6.2/§6.9 require impasse/no agreement to score
  zero. Historical `SCRIPT-FALLBACK` wording at line 490 promises a default
  arrangement and is therefore not used.
- The source's generic approval/IRB placeholders in §2.1/§5 are older than the
  confirmed study status (notably lines 110 and 393). Code preserves the exemption wording and
  `UNISTIRB-26-073 -C`, UNIST, Soohwan Lee, and the existing researcher email.
- Historical measure names and prompts such as REMARK, FR, ICC4, ATTR, and the
  requirement-response self-report are not current. Active removals/mapping
  are stated at lines 182, 573, and 895. The implemented common checks are
  IC1–IC6 and the Ver.2.26 measure inventory maintained in the code.

## Verification record

- Focused logic/parser/API suite: 275/275 passed before final integration
  checks. It covers both tasks/roles, both Proxy policies, WR-only approval,
  later direct SB promotion, stale T1 rejection, malformed requests,
  conditional follow-up, withdrawal routing, and quiet Direct timeout storage.
- Approved live smoke used `gpt-5.6-terra`, synthetic text only, no persistence,
  and 18 actual API attempts (16 initial fixtures plus two targeted rechecks;
  no automatic retries). Initial call latency ranged from 1.7s to 9.8s.
- Initial P5 fixtures passed 11/12. The missed case correctly returned
  `stance=conditional` but missed `bonus_request` for “I agree if you guarantee
  £0.50.” The prompt and route safety backstop were tightened. A targeted live
  route recheck then returned both flags in 5.7s; the counterpart route returned
  no agreement, retained both pending-condition flags, made no bonus promise,
  and used no em dash in 3.2s.
- Four initial counterpart render fixtures respected the role-specific payment
  boundary and made no payment promise. Two were initially marked failed by an
  overly literal smoke regex despite semantically correct wording; this was a
  harness check issue, not a rendered-policy failure.
- Latest integration checks: TypeScript passed, `git diff --check` passed, and
  the full unit suite passed 386/386. ESLint reported zero errors and one
  pre-existing unused-import warning in `scripts/simulate-negotiation.mjs`.
  The production build also passed with participant dev tools disabled.
- Production-mode browser QA at 1,280 × 720 confirmed the sticky negotiation
  timer remained below the site header with no horizontal overflow. A quiet
  Direct timeout reached Review and persisted an impasse with zero participant
  and joint points, `SB=false`, and `SB-TIMING=never`.
- The same browser QA deliberately returned HTTP 503 for the optional silence
  nudge and exposed two client defects: briefing time counted as chat silence,
  and a fully exhausted request was re-armed on every timer tick. Direct now
  starts its silence window when matchmaking completes. Direct and Proxy
  closing both latch the nudge attempt before requesting it, so a failed
  optional nudge is skipped after bounded request exhaustion while the normal
  clock and quiet-timeout path continue. Regression tests also verify that a
  participant message does not re-arm the nudge.
- In a bounded synthetic Direct rerun, more than the nudge threshold was spent
  before chat and the request count was still zero on entry. Silence then made
  exactly three mocked HTTP 503 requests. The next 30 virtual seconds made no
  new request, and timeout persisted an impasse with zero points and an empty
  classifier log. No model call was made. A later accelerated-clock run did
  record the new `technical_pause` lifecycle, but it did not provide a
  reliable browser measurement of the countdown freeze: `clock.pauseAt`
  stalled in the harness and accelerated React scheduling made the remaining
  timing comparison inconclusive. Timer pause during nudge recovery is
  therefore supported by the shared recovery wiring and regression tests, not
  claimed as browser-observed timing evidence.
- Isolated production-mode survey QA used synthetic browser-local data and no
  model calls. It covered common and task-specific understanding checks,
  inline remediation and two-attempt persistence, every Direct and Proxy
  single-page measure inventory, incomplete and whitespace blocking, draft
  restoration, explicit submission without auto-advance, bonus decisions,
  open-ended Previous/reload recovery, the final survey, and the £8 debriefing
  total. The survey run reported no browser console errors or warnings.

## Post-deployment record

- Vercel GitHub deployment `6351619800` completed successfully. The public
  alias, `/api/preflight?gate=1`, and a newly optimized Ver.2.26 illustration
  returned HTTP 200; the preflight response was `{ "ready": true }`.
- A fresh public production session still displayed the `DEV OFF` control.
  This means that build did not receive the exact public dev-tools-off setting.
  The available access did not reveal whether the stored value is absent,
  misspelled, or attached to the wrong Vercel scope, so the record does not
  infer which configuration error occurred.

## Launch limits still open

- **Recruitment blocker:** set `NEXT_PUBLIC_DEV_TOOLS=off` exactly in the
  Vercel Production environment and create a new deployment. Confirm in a
  fresh public session that the developer panel/control is neither downloaded
  nor accessible before recruiting participants.
- The public preflight gate checks model configuration only. A successful
  `{ "ready": true }` response is not evidence that dev tools, persistence,
  assignment, Prolific completion, or the rest of launch readiness is safe.
- Active Direct and Proxy negotiation phase/state is not hydrated after a page
  reload. Stable assignment and restored survey drafts do not mean that a live
  chat can resume safely.
- Runtime research records remain in browser `localStorage`; Supabase
  persistence and the atomic balanced assignment claim are not wired.
- A syntactically valid crafted client request can still supply tier/exchange
  state to the counterpart route. Full session-backed server authority is not
  implemented.
- The Prolific completion code is still TBD. A failed understanding check uses
  a contact-only stop screen because no Prolific termination, exclusion, or
  payment policy has been supplied. The application must not invent one.
- The 45-minute estimate and £7 plus £1 payment copy are aligned in this
  repository. The corresponding Prolific listing settings were not changed or
  verified here.

The canonical vault, Supabase schema, environment values, and unrelated files
are outside this implementation.
