# Production reliability verification, 2026-09-11

## Status

This document records a researcher-run **TEST ONLY** verification of the public study and the matching local reliability checks. It is evidence about routing, model use, persistence, and recovery behavior. It is not recruitment authorization, classifier validation, payment verification, or evidence that a real participant received a completion code.

The verified public Direct and Proxy paths used OpenAI rather than the development mock. The application also retained the intended fixed Proxy rationale policy. Real model calls therefore occurred, but not every sentence visible in Proxy was free-form model wording.

## Public end-to-end evidence

- Direct: a WR-only negotiation completed with a 1,000-point outcome. The server audit recorded generateAction with model gpt-5.6-terra.
- Proxy: all seven scheduled Proxy turns completed on the public deployment. Each turn produced a server audit entry for generateAction with model gpt-5.6-terra; no API response was marked as stubbed.
- The Proxy mandate authorized only the fixed WR rationale for the tested request. Participant-visible Proxy reasons followed the canonical study policy. The model was called on every turn, but the route deliberately canonicalized scheduled rationale text instead of exposing arbitrary generated wording.
- In the following human negotiation, a sensitive-background message was classified as SB with confidence 0.99 and stubbed false. The counterpart reciprocated with the assigned SB disclosure. A revised package produced a confirmed 3,000-point result.
- Stored Task 1 metrics show completed, 1,000 points, work tier, and no SB disclosure.
- Stored Task 2 metrics show completed, 3,000 points, sensitive tier, SB timing at wrap-up, seven Proxy turns, and four human turns. Its sb field remains false because that field records the first-chance authorization choice, not whether SB was ever disclosed. The later actual disclosure is evidenced by SB timing, participant first-SB time, the stored chat, and the live classifier result.
- The complete flow reached the public completion screen and reported that the server saved the test. The participant row was completed with a completion timestamp; its slot was assigned and completed. Both task reports had all three submission flags. Required background, RSC1-RSC4, ICC1-ICC3, open-response, final wrap-up, and debrief data were present. Proxy-only measures remained null for Direct and were populated for Proxy; OEC1 was stored only for Task 2 as designed.
- The full live browser run produced no application JavaScript errors. The only observed console error was a missing favicon request.

## Post-deployment routing evidence

Commits f0601d8 and 0a2f1e3, covering the gate-routing correction and 65-second request deadline, reached a successful Vercel deployment on the same public alias.

- Public preflight returned ready true.
- A fresh public browser showed an incorrect IC1 answer, accepted the corrected common answer on attempt 1, and entered Proxy practice.
- The same browser completed the genuine Proxy practice interaction, including the watched exchange, confirmation, Send, Accept, an incorrect IC6 answer, the intended Try once more remediation, and a corrected answer on attempt 2. It then reached the Task 1 main heading.
- The post-deployment routing check used a narrowly mocked synthetic assignment only to select AI-Supplemented, member, sequence 4. It did not seed comprehension gates or write to the database.
- The full live-model study was not repeated after these two narrow commits. The post-deployment evidence confirms the public alias, preflight, corrected routing, and genuine practice controls, not another paid main-task model run.

## What the implementation guarantees

- The negotiation state machine, not the language model, decides concessions, acceptance, termination, and the recorded package.
- Missing credentials are rejected in the recruitment configuration. Provider errors, network failures, non-2xx responses, invalid JSON, and incomplete response payloads do not become successful canned negotiation turns.
- Participant-facing requests use three bounded attempts. When all attempts fail, Direct preserves the staged message and offers Retry; the watched Proxy exchange stops as a technical interruption. Optional nudge failure may be skipped, but it does not replace or commit a participant turn.
- Some successful model responses are replaced with prescribed text when the protocol requires canonical disclosure, boundary, acceptance, impasse, or fixed Proxy rationale wording. This is study scripting and output validation, not a provider-error fallback.
- Practice interactions are local scripted examples. Practice-matrix success therefore verifies practice flow and condition routing, not paid model use.

## Reliability correction

The browser request timeout was increased from 20 seconds to 65 seconds while keeping three attempts and the existing backoff. The server model request remains bounded at 45 seconds and the server function at 60 seconds. The browser now waits long enough to receive the server's own retryable result instead of abandoning a still-running paid call and starting an overlapping retry.

Focused recovery, lifecycle, and turn-contract tests passed 43/43. The full local suite passed 528 tests, including the PGlite database checks. TypeScript and the production build passed. Lint reported no errors and one pre-existing warning.

The correction is deployed in commit 0a2f1e3, and the public routing and practice checks passed afterward. A forced 45-second provider-failure injection was not performed, so deployed timeout behavior is supported by code, tests, build, and deployment status rather than a deliberately stalled paid request.

## Persistence and reset evidence

Server audit rows preserve the configured model, reasoning effort, generated action details, selected action, and validation or blocking result. They do not currently preserve the OpenAI response ID or token usage, so an audit row alone is not independent billing-level proof of a provider completion. The public browser behavior, non-stubbed responses, and matching audit sequence provide the end-to-end evidence reported above.

Three earlier researcher test attempts were exported before selective deletion. Each was removed in its own identity-checked transaction. The completed public verification attempt was then exported separately with its participant row, two self-report rows, two task-metric rows, 16 chat-message rows, and assignment slot before it was removed in its own identity-checked transaction.

Final remote verification found 180 assignment seeds, zero assigned slots, zero completed slots, and zero rows in study participants, self reports, task metrics, and chat messages. The complete assignment-factor hash was unchanged. No assignment seed row was deleted. Private checksum manifests, backups, and default-rollback restore scripts remain available to the researcher.

## Remaining boundaries

- A successful preflight proves that required configuration and storage checks pass; it does not probe OpenAI provider health.
- VERCEL_ENV=production or NEXT_PUBLIC_DEV_TOOLS=off activates the live guard. A custom non-Vercel production deployment that sets neither signal could use non-live scaffold behavior and must not be used for recruitment.
- Model-generated Proxy fields can still affect output validation and whether a scheduled reason is blocked, even though visible rationale wording is canonical.
- The public completion screen and stored test completion do not verify Prolific payment or a real participant completion-code handoff.
- Automated practice coverage is separate from the public live-model evidence and does not show that all 32 task views made paid main-task model calls.

## Final automated snapshot

- Full local suite: 528 passed, including PGlite; TypeScript and production build passed; lint had zero errors and one pre-existing warning.
- Genuine practice matrix: all 16 assignment cells and 32 practice views passed with no failures or escaped flows. Assignment and persistence APIs were mocked, the common gate was preseeded, and each task gate was created by the genuine Read, Goals, mode-specific practice, comprehension, and Start Task path. The test context also suppressed before-unload prompts.
- Independent cover matrix: all 32 task views matched the expected assignment, mode, Task A or B scenario, role, and private-caption combination.
- Public live-model run: complete Direct and Proxy main-task flow, surveys, persistence, and test completion passed.
- Final database reset: 180 unassigned and uncompleted seeds; zero rows in all four attempt and analysis tables.

Local ignored screenshots retained for researcher review; they are not tracked repository links:

- `output/playwright/live-deployment-complete-20260911.png`
- `output/playwright/deployed-routing-fixed-20260911.png`
