# Direct reciprocal disclosure update

**Superseded in part by Ver.2.21.** This note was written when reciprocal
disclosure landed on its own, ahead of the rest of the migration, and it said
so: the repository at the time still carried the Ver.2.20 cards, payoffs and
MISREAD branch. Those have since been replaced — see `docs/design-2.21-update.md`
for the full record. The disclosure rule this note describes is unchanged and
still correct; the MISREAD paragraphs no longer describe anything that exists.

## What still holds

Direct negotiation uses a reciprocal disclosure policy. The simulated
counterpart opens with its work reason and discloses its sensitive background
only after the participant discloses theirs. If the package currently on the
table is valid for the participant's information tier, the counterpart accepts
it immediately. A sensitive-tier acceptance combines the counterpart's
disclosure and the exact accepted package in the same reply
(`disclose_sb_and_accept`, rendered by `reciprocalAcceptanceText`).

Proxy negotiation retains the fixed disclosure schedule. Its state-machine
calls pass `disclosurePolicy: "fixed"` explicitly.

The primary `SB` outcome remains whether the participant disclosed at the first
reason opportunity. Later disclosure is available in the per-message reason
label and the ordered classifier log. **The legacy timing enum must not be read
as "after counterpart SB" under reciprocal Direct disclosure** — under this
policy there is no such event in Direct, because the counterpart never
discloses first. Final analysis re-codes category ③ from the raw logs as "later
than the first reason opportunity". See `docs/DATA_MODEL.md`.

The counterpart disclosure and settlement guards are durable for the mounted
task session, including retries after a failed reply. Restoring a partially
completed Direct conversation after a hard page reload remains a pre-existing
unsupported path.

## What no longer applies

The MISREAD branch is deleted (Ver.2.21 §3.3). There is no displayed misread
offer to track and no standing misread package to accept, because a
non-directional work reason gives the counterpart nothing to sincerely
misread. The two-rung ladder replaced the four-rung one, and impasse pays 0
rather than 600.

## Verification at the time

Covered all task and role cells, early acceptance, work-only and sensitive
paths, missing and refused offers, deadline and score reminders, Proxy
fixed-schedule regressions, forbidden sensitive reason leakage, and exact
combined disclosure-plus-acceptance text. No live paid model call was used for
that verification. The Ver.2.21 live-model runs are recorded in
`docs/design-2.21-update.md`.
