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

Preserved invariants:

- API failures remain recoverable and do not advance transcript, tier,
  disclosure, or agreement state;
- transcript turn contracts and one-shot script flags are unchanged;
- unchecked sensitive reasons remain forbidden;
- AI-Supplemented fixed frame, abstraction, cover reasons, and route-level
  frame recovery are unchanged;
- no measure definitions or participant survey UI were changed here.

The external source document was read only and was not modified. Pre-existing
dirty documentation, `CLAUDE.md`, `src/app/api/proxy-negotiation/route.ts`, and
`tests/proxy-negotiation-route.test.mjs` were excluded from this update.
