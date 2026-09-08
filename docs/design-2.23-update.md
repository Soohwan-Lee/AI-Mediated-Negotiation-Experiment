# Experimental Design Ver.2.23 implementation update

Source checked: `N - Experimental Design (Ver.2.23).md`, last updated
2026-09-08, in the external research vault.

Implemented in this checkout:

- expanded the four WR cards to retain the full non-directional work context;
- aligned the four SB cards and their third-person Proxy relays with the
  canonical incidents;
- retained the two-rung T1/T2 package rule, cumulative P5 classification,
  Direct reciprocal disclosure, and Proxy fixed disclosure schedule;
- set Direct negotiation to 5 minutes and Proxy direct closing to 2 minutes;
- set the neutral practice to 2 minutes and removed artificial delay between
  watched Proxy messages;
- updated the advertised study defaults to 40 minutes, £6 base plus £1 total
  extra, £0.50 per task, and £7 total;
- resolved the common prompt conflict so human counterparts conceal the
  simulation while AI Proxies can identify themselves as Proxies as required.

Preserved invariants in the Direct negotiation and participant-led Proxy
closing flows:

- API failures do not advance transcript or agreement state;
- transcript turn contracts and one-shot script flags are unchanged;
- unchecked sensitive reasons remain forbidden;
- AI-Supplemented fixed frame, abstraction, and cover reasons are unchanged;
- no measure definitions or participant survey UI were changed here.

The external source document was read only and was not modified. Pre-existing
dirty documentation, `CLAUDE.md`, `src/app/api/proxy-negotiation/route.ts`, and
`tests/proxy-negotiation-route.test.mjs` were excluded from this update.

Stage 2 aligned the deployed questionnaires and their order with Ver.2.23,
including the 40-item Leader and 42-item Member quantitative totals. The four
English items not restated in Ver.2.23 (PCR6, PNPQ1, PNOQ1, and ATTR2) retain
their Ver.2.22 wording. Multi-section questionnaire routes now restore the
latest saved questionnaire section after reload; this does not claim broader
application hydration or persistence recovery.

Stage 3 clarifies the role and payment guidance, removes priority cues and the
obsolete main-study RISK presentation, labels negotiation points as non-cash,
and keeps disclosure guidance neutral. Before role assignment, the welcome
page shows only the guaranteed £6 base rate (£9.00/hour); the debrief explains
that bonus recommendations were scenario-only and everyone receives £7.

Final verification used an isolated worktree at code revision `098e259`, so
pre-existing dirty files could not affect the result. The committed tree passed
320 unit tests, the full ESLint suite, TypeScript checking, and a production
build with participant developer tools disabled. The shared checkout reported
323 tests because it also contains three uncommitted Proxy-route tests; those
tests and the corresponding dirty route were not part of this update.

Production-browser checks confirmed the Direct and Proxy questionnaire page
counts and ordering, no advancement on ordinary answer selection, restoration
of saved sections, intentional zero and maximum Leader recommendations, the
single Member evaluation, condition-specific ATTR items, and separate Proxy
interpretation pages. The first Proxy interpretation answer survived a reload
at the second page and both answers were saved cumulatively. Transcript review
preserved message splits; the wrap-up SUS3 follow-up was required only after a
Yes response, and CP referred only to Direct negotiation. The role and payment
diagrams were also inspected at 1440px without overflow.

Validation made no live model calls, created no production participant, and
made no Supabase integration changes. It verifies the committed application
behavior described above, not unrelated application-wide hydration or
persistence behavior.
