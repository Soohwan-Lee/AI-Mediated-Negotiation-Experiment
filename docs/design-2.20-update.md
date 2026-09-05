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
- Full audit found two further live-route mismatches: counterpart AI-Supplemented turns were missing their fixed abstraction inputs; WR-only Proxy exchanges skipped MISREAD and cover 1. Correct these in a separate protocol commit before final browser review.
