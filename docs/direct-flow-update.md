# Direct reciprocal disclosure update

Direct negotiation now uses a reciprocal disclosure policy. The simulated
counterpart opens with its work reason and discloses its sensitive background
only after the participant discloses theirs. If the package currently on the
table is valid for the participant's information tier, the counterpart can
accept it immediately. A sensitive-tier acceptance combines the counterpart's
disclosure and the exact accepted package in the same reply.

Proxy negotiation retains the fixed disclosure schedule. Its state-machine
calls pass `disclosurePolicy: "fixed"` explicitly.

This repository still uses the Ver.2.20 cards, payoffs, and MISREAD branch.
Those are intentionally unchanged; the broader Ver.2.21 work-in-progress is
not an implementation specification for this patch. Direct tracks a displayed
MISREAD offer so that accepting that standing package remains valid.

The primary `SB` outcome remains whether the participant disclosed at the
first reason opportunity. Later disclosure is available in the per-message
reason label and turn logs. The legacy timing enum should not be interpreted
as "after counterpart SB" under reciprocal Direct disclosure; final analysis
should re-code the raw logs.

The counterpart disclosure and settlement guards are durable for the mounted
task session, including retries after a failed reply. Restoring a partially
completed Direct conversation after a hard page reload remains a pre-existing
unsupported path.

Verification covered all task and role cells, early acceptance, work-only and
sensitive paths, missing and refused offers, deadline and score reminders,
MISREAD acceptance, Proxy fixed-schedule regressions, forbidden sensitive
reason leakage, and exact combined disclosure-plus-acceptance text. No live
paid model call was used for this verification.
