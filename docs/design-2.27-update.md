# Experimental Design Ver.2.27 implementation plan

## Scope and ownership

| Area | Owner | Planned change |
| --- | --- | --- |
| Counterpart disclosure and negotiation state | `design227_core` | Apply the Ver.2.27 reciprocal SB rule and make every Proxy observation continue into direct confirmation. |
| Participant-facing instructions and practice | `design227_ui` | Update Ver.2.27 copy, illustrations, roadmap, and the visible IC retry experience. |
| Gates and forward navigation | `design226_ui` | Replace terminal IC failure with unlimited retry-until-correct, preserve attempt records, migrate only old check-failure stops, and prevent route races. |
| Development assignments | `design226_ui` | Expose policy, role, mode order, and task order as independent controls while mapping to the four existing sequences. Keep all developer skips production-inert. |
| Task surveys | `design226_ui` | Place OED1, OEE1, and Proxy-only OEP1 together after BR1/FE1, with explicit submit, draft recovery, Previous, and whitespace validation. Keep OEC1 final. |
| Canonical Ver.2.27 document | `design226_ui` | Narrowly remove the separate Proxy approve/change/decline review and describe mandatory direct confirmation after observation, including P2, examples, and audit references. No unrelated measure or history edits. |

## Acceptance matrix

| Requirement | Acceptance check |
| --- | --- |
| Unlimited IC retry | Every wrong submission logs its attempt and shows the correct answer with a concise explanation inline. No attempt count routes to a stop page. Only a correct answer writes `passed`. |
| Legacy stop migration | A participant whose persisted stop reason is `check` can return to the relevant IC. A persisted `withdrawal` remains terminal. Migration is participant-scoped and does not clear unrelated data. |
| Gate sequencing | Missing common or mode-specific IC routes to the corresponding instruction or practice page without the navigation guard immediately advancing it again. Passed gates permit the intended task. |
| Development assignment controls | Dev panel independently selects Team Leader/Team Member, User-Specified/AI-Supplemented, Direct-first/Proxy-first, and Task-A-first/Task-B-first. Each combination maps to one existing `seq1`–`seq4`. |
| Dev isolation | Assignment overrides, skips, and jumps work only when development mode is compiled in. Participant production flow remains forward-only. |
| All 16 combinations | The 2 roles × 2 policies × 4 sequence combinations move from the matching practice to the matching main task without a bounce. |
| Task open-ended page | After BR1/FE1, one page contains OED1 and OEE1, plus OEP1 for Proxy. Codes remain visible. Drafts persist, Previous works, whitespace-only answers are incomplete, and one explicit submit advances. |
| Final reflection | OEC1 remains on the final survey page. |
| Point privacy | Participant copy continues to prohibit sharing numeric point values while allowing ordinary discussion of preferences and reasons. |
| Eligibility and role play | Platform copy reflects the latest English-eligibility and role-play instructions without changing the canonical document's U.S.-residence eligibility language in this narrow patch. |
| Default open context | Task entry opens with the situation, role, and private briefing context available before any disclosure decision. |
| Task stages and images | Each task presents the Ver.2.27 staged flow and its new task-specific situation and role image without leaking private counterpart information. |
| Direct interaction parity | Direct chat queues sends safely, shows per-bubble typing, and exposes a clear acceptance action; its practice rehearses the same controls without training a disclosure strategy. |
| Reciprocal disclosure cases | WR-only stays at T1 with no counterpart SB; authorized Proxy SB reaches T2 and triggers counterpart Proxy SB; late SB in direct closing reaches T2 and triggers counterpart human SB. No path reveals counterpart SB before participant-side SB. |
| Proxy confirmation | Canonical active-flow text has no separate provisional-agreement review action. Every Proxy participant observes the exchange and then directly converses with the counterpart for up to five minutes to confirm the agreement. |
| Canonical-file safety | Record baseline hash and mtime, recheck both immediately before patching, and stop if the participant-edited source changed. Patch only active flow, P2/examples, and audit references. |
| Verification | Run focused gate, assignment, navigation, and survey tests; TypeScript; scoped lint; `git diff --check`; and the coordinated full suite/build only when root releases it. Preserve the running server on port 3102. |

## Baseline

- Canonical source SHA-256: `f46848c70159ad02f7b1ec99721625a77ad70689d05d34a0fd36c0c6ad42a293`
- Canonical source mtime: `2026-09-10 01:25:53 +0900`
- Repository HEAD at planning: `53d3ae5`
- Existing unrelated work at planning: core negotiation files modified by another worker; `.omc/` untracked.

## Deliberately pending canonical alignment

This repository update also tracks newer implementation decisions for English eligibility, role-play copy, and FE1 presentation. The authorized canonical-document edit is limited to the active Proxy confirmation flow, so it must not change Ver.2.27's U.S.-residence eligibility text, IC exclusion language, or FE1 definition. Those differences remain explicit follow-up items rather than being silently described as fully aligned.

## Verification checkpoint

- Gate and survey unit coverage: 24 focused checks passed before integration; the expanded routing, survey, and reciprocal-disclosure selection passed 238/238 checks with the repository TypeScript loader.
- Static checks: `npx tsc --noEmit` and scoped ESLint passed.
- Development routing: a live browser session on port 3102 exercised all 16 role × policy × sequence assignments. Each selector preview, Task 1 practice mode, Task 1 route, and Task A/B briefing matched, with no instruction bounce.
- Open-ended flow: the Proxy task showed OED1, OEE1, and OEP1 together. Whitespace kept Submit disabled; drafts restored after reload; Previous returned to FE1; explicit submit stored `_submitted_parts: 1` and `_completed: true` before advancing.
- Development persistence: consent-free previews use the isolated `P-devpreview` key. An existing real participant key remains unchanged even when a slot override is active.
- Reciprocal-disclosure review: WR-only route tests exclude both sensitive cards and settle at T1; an authorized and actually voiced participant SB permits one policy-matched counterpart SB and T2; a later direct-confirmation SB can raise a WR-only Proxy session to T2 with `SB-TIMING = wrap_up`. `reasonLabel` is cumulative across messages, while the latest acceptance stance remains separate, so an acceptance record carrying `SB` does not mean that the acceptance message itself disclosed it.
- Canonical source: baseline SHA-256 `f46848c70159ad02f7b1ec99721625a77ad70689d05d34a0fd36c0c6ad42a293`, mtime `2026-09-10 01:25:53 +0900`, size 290,528 bytes. The narrow active-flow patch changed 37 lines in place and aligned IC6 exactly with the implemented instrument; vault Git retains the original. No vault commit or push was made.

## Integrated verification

- Implementation commits: `bbf1e2e` (reciprocal disclosure and direct confirmation), `efcdccc` (superseded typing waits), `2dcf377` (gates, dev routing, and combined task reflection), and `bfe86c1` (participant-facing Ver.2.27 UI and practice).
- The integrated tree passed 409/409 unit tests, `npx tsc --noEmit`, and the production build. Global ESLint reported zero errors and one pre-existing unused-code warning.
- Production preflight on port 3104 returned `ready: true`. A fresh production browser session had no hydration or page errors; the only console error was the existing missing `favicon.ico` request.
- Production Task 2 main-entry coverage checked both modes: `seq1` (User-Specified, Team Leader) reached the Proxy cover and Task B briefing, then switching to Proxy-first `seq2` remounted Task 2 as Direct and reached the same Task B briefing without an instruction bounce. Public and private images loaded, including the private-comic evidence at `output/playwright/design227-production-private.png`, with no horizontal overflow at 1280 px.
- Browser coverage remains narrower than the assignment tests: all 16 combinations were checked through Task 1 practice, Task 1 entry, and Task A/B briefing. Task 2 received the two representative main-entry checks above; this is not a claim that all 16 Task 2 routes or 32 complete task flows were exercised in a browser.
- At 1280 × 720, the scrolled production chat kept the timer visible and the expanded “Your Situation” panel usable. At 1024 × 768, Task 2 kept its current-task label visible, allowed the details panel to open, and had no horizontal overflow.
- A production AI-Supplemented, Proxy-first practice run used mock AI with autofill on and validation skipping off. Send produced the counterpart reply, Accept unlocked at the intended point, three wrong IC6 attempts each showed inline correction without stopping the study, and the fourth correct attempt advanced to the Task 1 main screen.
- The 16 live classifier fixtures returned the expected labels without retry. This is a bounded implementation smoke check, not evidence of classifier accuracy or the planned validation threshold.
- Browser negotiation evidence covered WR-only settlement at 1,000 points, late direct-confirmation SB settlement at 3,000 points with `SB: false` and `SB-TIMING: wrap_up`, and rapid input handling that preserved the first-reason boundary. The cumulative `reasonLabel` records everything conveyed so far; the latest message stance is stored separately.

## Launch limits

- Response, event, and assignment persistence still uses the browser-local store. It is not durable recruitment storage and does not support recovery on another browser or device.
- Atomic Supabase assignment claiming is designed but not wired. The current local assignment fallback is suitable for development verification, not balanced live recruitment.
- The final Prolific completion-code, withdrawal, and payment operations remain pending the approved launch configuration. The platform must not infer or promise those outcomes.
- Developer tools are intentionally compiled into the present deployment for user testing. They must be compiled out or otherwise made unavailable before participant recruitment.
- Completed development responses are keyed by task index and can be reused after changing the dev slot. Use the existing Reset control before an independent full-cell run. Do not silently clear a real participant session or treat slot switching as fresh persisted data.
- These limits mean the current build is ready for controlled researcher and user testing, not recruitment launch.
