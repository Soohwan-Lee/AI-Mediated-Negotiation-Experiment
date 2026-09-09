# Design 2.21 alignment and participant flow

Source: `N - Experimental Design (Ver.2.21).md`, §14 changelog "Ver.2.20 →
Ver.2.21 (2026-09-07, 10차)" plus the 11th and 12th corrections recorded inside
§3.2, §3.3, §6.6, §8.6 and §8.7. The body and its explicit rules take
precedence over stale frontmatter and over repository notes written against
Ver.2.20.

Ver.2.21 is a **structural** revision, not a wording pass. It changes the
payoff table, the number of rungs on the justification ladder, what the work
reason does, who the AI-Supplemented proxy speaks as, when the counterpart
discloses, and what the classifier is asked. A screen or a test written against
Ver.2.20 is not merely out of date — it implements a different study.

## What changed

1. **Two-rung ladder, and no fallback** (§3.2, §3.3, §6.2). T1 = nothing, the
   work reason, or a bare priority claim → both cores at the third option,
   1,000 each, JOINT 2,000. T2 = the sensitive background or its §6.6
   abstraction → both cores at their best, 3,000 each, JOINT 6,000. Impasse is
   **0**. The `priority` tier value, `misread`, `misreadPackage`,
   `misreadOffered` and `SCRIPT-MISREAD` are deleted.
2. **Convex payoffs** (§3.2). Core column 3,000 / 1,600 / 600 / 0; non-core
   600 / 400 / 200 / 0; individual maximum 3,600. Only the best option solves
   the problem the SB describes; the non-core column stays deep enough to
   remain a trade rather than a giveaway.
3. **The work reason is non-directional** (§3.3, §4). All four WR cards say
   both terms matter and hide the priority. A counterpart who hears one has
   nothing to do but split the difference, so the decoy and its misread branch
   have no trigger and are gone.
4. **A bare priority claim buys one question.** It travels as `priority_claim`
   from the classifier and `priorityClaimed` on the exchange state, earns one
   `SCRIPT-ASKWHY`, and the counterpart then restates T1.
5. **Task B's Member issue is the weekly client report** (1 of 4 weeks to 4 of
   4), replacing urgent-call duty, with a new SB, abstraction, covers, role
   brief and objectives. The Member's two SBs are now parallel by role: in both
   tasks the client asked for the lead instead, and in both the participant
   never passed it on.
6. **Reciprocal disclosure in Direct** (§6.3). The counterpart voices its own
   SB only after the participant has voiced theirs, split into two or three
   short bubbles at sentence seams. Proxy observation keeps the fixed schedule.
   A WR-only Direct session never hears it.
7. **Cumulative classifier** (§6.2a). The route takes every participant message
   in the task and returns the highest label reached: `none | WR | SB`, with
   `priority_claim`, `confidence`, `stance` and optional `counter_terms`.
   Confidence below 0.6 while the label is under `SB` draws one
   `SCRIPT-CLARIFY` per tier.
8. **New fixed scripts** (§6.4): `SCRIPT-ASKSIT` (a first turn carrying no
   reason, once), `SCRIPT-CLARIFY`, `SCRIPT-NUDGE` (60 seconds of silence,
   once), `SCRIPT-CLOSE` at 90 seconds left. New wording for BALANCE, T1, T2,
   ASKWHY and OPEN.
9. **Early settlement** (§6.1 stage 6). A valid acceptance ends the task at
   once. An SB plus a valid T2 acceptance in the same turn produce one reply
   (`disclose_sb_and_accept`), rendered deterministically.
10. **The counterpart route returns no action name.** The response is
    `{ message, proposal, state, settled }`; `settled` is the outcome, never
    the move.
11. **The Proxy mandate has one decision** (§8.7). The work reason is a fixed
    utterance, shown ticked and locked; the sensitive checkbox is the whole
    choice, with a one-line ⚠ caption mirrored under the sensitive card in the
    Direct briefing panel. The proxy floor is T1 in both arms, retiring the
    §13-13② mode asymmetry.
12. **AI-Supplemented speaks as itself** (§6.6). A fixed `frame` sentence, then
    the abstraction and two covers as subjectless declaratives, shuffled, with
    no attribution to the principal. Covers are graded: cover ① (WR-grade) is
    appended on the T1-decline turn when the SB is unticked; cover ② (SB-grade)
    appears only beside the abstraction.
13. **The wish screen defaults to best-on-both** in both arms, with
    `WISH-DEV_t{n}` recording deviation (§8.6).
14. **§9 measures**: CP1–2 after PNOQ (Direct always; Proxy only when a closing
    conversation happened), IMM2 restored, the four-item SUS funnel
    (SUS0 → SUS1 → SUS2 → SUS3), M1 with four options plus a Direct-only "I did
    share it". §7 timing recomputed: budget 54, advertised 53, pay unchanged at
    £7.50 + £2.00 = £9.50 (£10.75/hour).

## Commits

In order, `0472372..HEAD`:

| Commit | What it did |
|---|---|
| `bd5f269` | Paced the Direct counterpart as a fast typist; rejected malformed rehearsal bodies with 400. |
| `3b5d4d4` | Paged the open-ended block three at a time; tagged every item with its id. |
| `c200753` | Gave the practice round a pointing coach. |
| `bbb2bfa` | Demoted the package selector to an optional drawer in both arms. |
| `6561f82` | Private ring on private practice surfaces; let M1 share the last open-ended page. |
| `ceb69b3` | Put the item id inside the item text, always visible. |
| `bfe0d4b` | The participant briefs a drawn AI representative. |
| `14af40e` | Closed five negotiation-state gaps and five backend gaps found by re-audit. |
| `7f1df95` | Proxy reads back in its own words; neutral banner; optional remark reply. |
| `e9a4d40` | Concise navigation reminders. |
| `02003f3` | Recover failed turns without advancing state. |
| `259d472` | Click-by-click practice tutorial with a pre-typed message and one moving cue. |
| `ebd95f1` | Per-policy explainer with the vacation-week example; symmetric disclosure wording (§8.7). |
| `4cd2540` | Full §8.7 AI-Supplemented disclosure wording. |
| `01a3f38` | **Stage N** — Ver.2.21 §9 items and §7 timing. |
| `2bb90c2` | **Stage K** — Ver.2.21 payoffs, cards and the two-tier ladder. |
| `feb3f25` | **Stage L** — Ver.2.21 prompts, cumulative classifier and two-tier routes. |
| `d14ba26` | **Stage M** — Ver.2.21 screens: fixed work reason, wish defaults, no fallback. |
| `66baf0f` | Refreshed the proxy transcript for Ver.2.21 wording. |
| `063440a` | Turn contract, bubble-split fallback, live-verified transcripts. |
| `2039fce` | Shared the bubble split; break at sentence seams. |
| `ebde1b6` | The work reason is authorized server-side. |

The four stage commits carry the design change. The rest are the interface and
robustness work that had to land with it, plus the audit fixes.

## Boundaries held

- Item ids and their §9.4 order are unchanged except for the additions above.
  Renaming an id renames a variable in the export.
- The counterpart's own model never judges an argument. The classifier decides
  the label; `machine.ts` decides the package; the model only says the move.
- The tier only rises, enforced by `foldTier` in the Direct loop, the Proxy
  closing and the route's own log.
- No screen names a condition, and the counterpart route returns no script
  name.
- Both proxy policies run the same number of turns and share one message cap
  (420 characters), so neither can simply say more than the other.
- RATIFY still finalizes on approval; only modification or refusal opens the
  three-minute closing.
- Existing pilot and IRB readiness gates remain in force. A passing software
  check is not classifier validation and not recruitment readiness.

## Verification

- `npx tsc --noEmit` — clean.
- `npx eslint src --max-warnings=0` — clean.
- `npm run test:units` — full suite passing, including new files for the
  classifier route, the counterpart route, the proxy-negotiation route, the
  turn contract, recoverable requests and the §9 measures.
- `npm run build` — production build passing.
- `npm run simulate` — **fourteen scenarios** against the live model
  (`gpt-5.6-terra`), with the real P5 classifier in the loop, one live call per
  participant turn. Transcripts are committed under `docs/transcripts/`.

The fourteen and what each pins:

| Scenario | Asserts |
|---|---|
| `direct-wr-only` | T1 1,000/1,000 **and** the counterpart's own SB never appears. |
| `direct-priority` | Exactly one `SCRIPT-ASKWHY`, then T1 again. |
| `direct-sb-own-words` | The confession in the participant's own words reaches `SB`; the counterpart reciprocates; T2 lands. |
| `direct-sb-split` | The same fact over three messages, none an SB alone, still reaches `SB`. This is the run that guards the cumulative rule. |
| `direct-asksit` | Exactly one `SCRIPT-ASKSIT`. |
| `direct-clarify` | Exactly one `SCRIPT-CLARIFY` rather than a silent miss. |
| `direct-nonum` | Exactly one `SCRIPT-NONUM`. |
| `proxy-user-sb` / `proxy-user-wr` | User-Specified at both rungs; the card relayed in the third person. |
| `proxy-supp-sb` | The frame plus all three sentences, no attribution, no event. |
| `proxy-supp-wr` | 1,000/1,000 with cover ① on the decline turn. |
| `closing-self-disclose` | The Proxy closing after a WR-only run reaches T2, `SB-TIMING = wrap_up`. |
| `rehearsal-leak` | The rehearsal proxy refuses an unticked SB. |
| `classifier-probe` | A denial and a vague hint both land below `SB`; a real counter resolves into levels. |

Turn recovery was verified separately in the browser and is recorded in
`docs/turn-recovery.md`: at most three attempts per request, the clock pausing
on the first failure, and exactly one participant message and one counterpart
reply committed per turn.

## Remaining recruitment gates

- Confirm participant timing in a pilot before trusting the 54-minute budget.
  The lever if it runs long is the reply-delay range, never the advertised
  figure.
- Gate 19's κ ≥ .90 for the classifier against human re-coding. The simulation
  is a smoke test, not an independent holdout validation. The fallback is
  Wizard-of-Oz tagging (§13-24), a live-operations change.
- §6.3 leaves an open analysis question this migration does not close: a
  WR-only Direct session never hears the counterpart's SB, so the PCR items
  about the other side's disclosure apply only on a path selected by the
  primary outcome. The analysis set and the old PRE/POST framing have to be
  pre-specified before the study runs.
- Persistence is still local. `/api/persist` does not exist yet, so the
  classifier log and the provenance audit have no destination outside
  `npm run simulate`. See `docs/DATA_MODEL.md`.
- Set `NEXT_PUBLIC_DEV_TOOLS=off`, the real Prolific completion code, and
  confirm the IRB exemption number before recruiting. `/api/preflight` checks
  all three.
