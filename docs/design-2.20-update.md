# Design 2.20 alignment and participant flow

Source: `N - Experimental Design (Ver.2.20).md`, including the 2026-09-06 correction. The body and explicit rules take precedence over its stale frontmatter and repository migration notes.

## Plan and commits

1. Align behavior: ratification, optional reason authorization, Leader abstractions, and the demand-focused REMARK. Check compensation against §2/§5. Verify deterministic rules with unit tests and production build.
2. Simplify orientation: separate workplace setting, role/evaluation, and negotiation rules; divide each task briefing into shared setting, private background, and points/reasons. Keep the same content and sequence in both modes, before RISK. Use neutral illustrations without revealing the trade or suggesting disclosure.
3. Review the complete flow in the browser, check both roles/tasks/policies and ratification branches, document verification, and push all stage commits.

## Boundaries

- Preserve payoff tables, fixed reason cards, classifier separation, monotone tiers, counterpart disclosure schedule, and measurement item IDs/order.
- Both reason checkboxes can be cleared (§6.9 #12); defaults remain work on, sensitive off.
- Approval finalizes the tentative package; modification/refusal alone lead to the three-minute closing (§7).
- REMARK concerns the demands, not a generated speaking style (§6.8, September 6 correction).
- Leader abstractions retain the principal's prior judgment (§6.6 table), without exposing the full private story.
- Existing pilot/IRB readiness gates remain in force. A successful software check is not a classifier-validation or recruitment-readiness claim.

## Verification

- Source also adds COMP4 (optional disclosure and later evaluation); included in the common comprehension check.
- Payment aligned to £7.50 base + £1 per task (£9.50 fixed total). Retained a conservative 61-minute screen budget after removing mandatory closing, rather than claiming the document's 45–50 minute target is measured. Pilot timing must settle the final advertised duration.
- Stage 1: production build and ESLint passed. Unit checks include all four task/role cells with neither reason authorized.
- Stage 2: common guide split into three pages with a neutral four-panel workplace illustration. Task briefings split into four pages (setting, private story, points, reasons) shared by both modes; all precede RISK. Back navigation is limited to the reading sequence. Production build and ESLint passed.
- Stage 3 (`f99e3e2`): corrected counterpart AI-Supplemented summary/cover inputs and the WR-only MISREAD → priority + cover 1 sequence. Both policies now share nine messages. The server, client, mock transcript, and simulation use the same schedule length. A false-positive score detector (`key point`) and surplus short chat bubbles were also corrected without dropping disclosure facts.
- Final live-model simulation: **11/11 scenarios passed**, including four Proxy trajectories, two closing paths, Direct SB/WR/no-score-talk paths, unauthorized-disclosure refusal, and six classifier probes. The generated transcripts are in `docs/transcripts/`. These are smoke tests, not independent classifier holdout validation.
- Final software checks: **175/175 unit tests**, production build, and ESLint (zero warnings/errors). `git diff --check` passed after trimming generated transcript whitespace.
- Browser: followed the common guide and practice, Direct Task 1 → review → survey → bonus → REMARK → Proxy Task 2 → approval → review → survey → bonus → REMARK → wrap-up → debriefing → completion, using isolated local developer/mock data. Approval skipped closing as intended; separate modification/refusal checks reached their respective handover and three-minute chat screens.
- Browser briefing matrix: both roles × all four task/mode orders (eight previews, covering both policies), all four briefing pages, at 1440 × 1000. No horizontal overflow. Screenshots are local under ignored `output/playwright/`. Both reason permissions can be cleared with required-field bypass turned **off**, and the mandate still continues normally.
- Final flow repair: every Direct/Proxy phase now starts at the top of the page; Next's smooth-scroll declaration is explicit. This prevents the decision screen from opening halfway down after spectating.

## Remaining recruitment gates

- Confirm participant timing in a pilot before replacing the conservative 61-minute budget with the design's 45–50 minute target.
- Complete independent classifier validation and the design's manipulation/realism/deception checks. Mock browser runs do not test persistence to a production backend or actual payment delivery.
- The existing comprehension UI logs attempts and permits further remediation; operational handling of a second failure (including exclusion and participant payment) still needs a defined screen-out workflow before recruitment. This update does not invent a new exclusion/payment policy.
