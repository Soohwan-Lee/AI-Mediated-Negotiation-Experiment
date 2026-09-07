# Participant-facing UX refresh

## Goal

Make the study easier to understand on a first reading without changing its
conditions, instruments, ordering, payoff logic, or disclosure policy.

## Stage 1: IRB configuration

- Record UNIST's exemption determination and exemption number in the shared
  study constants, using exemption wording rather than approval wording.
- Include the exemption number in the diagnostic preflight response. The live
  entry gate continues to check model readiness; it does not broadly certify
  every recruitment dependency.
- Leave the Prolific completion code as a placeholder until the study is
  deployed in Prolific. The placeholder does not block entry.

## Stage 2: reading load and navigation

- Divide welcome information into short overview, privacy/rights, and consent
  screens on the same route. Consent is collected only on the final screen,
  after all required information has been shown.
- Remove repeated descriptions of the two tasks and use one consistent study
  overview.
- Keep local Back controls visible throughout instruction and task briefings.
  Do not add a Background-to-Consent route Back: the consent page claims the
  participant's assignment, so it is not a safe generic return destination.
- Replace stale practice wording about a removed negotiation floor.

Baseline before this stage: the single consent page contained 469 rendered
words (2,996 characters) and was 2,799 px tall in a 1,280 × 919 browser
viewport. After the split, the three pages contain 208, 185, and 121 rendered
words when measured at 1,280 × 800, and none has horizontal overflow. The
total includes short recap text on the final page; the maximum reading load at
one time fell by 56%.

## Stage 3: illustration and full-flow verification

- Replace schematic placeholder drawings with original, neutral workplace
  illustrations. Images must not imply a preferred trade, disclosure choice,
  or emotional evaluation.
- Verify both roles, both task orders, and both Proxy policies in a real
  browser, including Back behavior before the first pre-task measure.
- Recheck desktop viewport fit, focus visibility, reduced motion, production
  build, lint, and unit tests.

## Stage 4: guided practice

- Keep one practice round matched to the participant's first task interface.
- Divide the tutorial into four focused views: situation, choices, sample
  exchange, and the existing PRAC1 check. Show one active control at a time,
  return to the top on each transition, and preserve inputs when going Back.
- Require both practice choices and a completed local sample exchange before
  PRAC1. The sample exchange does not call the study model, and PRAC1's item,
  answer, and saved response remain unchanged.
- Keep both Proxy policies on the same practice interface and do not add a
  second practice round or a new study mechanic.

Browser verification covered the Direct flow as a Team Lead, the
User-Specified Proxy flow as a Senior Team Member, and the AI-Supplemented
assignment opening the same Proxy tutorial as a Team Lead. The checks included
disabled Continue states, role-appropriate practice reasons, sharing-control
on/off replies, wrong and correct PRAC1 attempts, Back-state preservation, and
top-of-step scrolling. No paid model request was made. TypeScript, lint, the
production build, and all 178 unit tests passed.

## Stage 5: at-a-glance private briefing

- Lead with a plain-language role label and keep seniority or experience in
  the supporting sentence instead of a large badge.
- Keep the participant's two goals visible, then organize the complete
  briefing into Situation, Points, and Reasons tabs. Practice briefings omit
  Reasons because they do not include prepared reason cards.
- Preserve every story paragraph, objective, option value, rationale, fallback,
  requirement note, disclosure warning, and work or sensitive reason. The
  compact point table changes spacing only and does not mark a preferred term
  or trade.
- Keep the private sand treatment and independently scrolling desktop rail.
  The mobile briefing remains a labelled drawer, and the tabs support arrow,
  Home, and End keys.

Focused browser checks covered the Team Lead at 1,280 × 800, the Team Member
at 1,024 × 768, and the mobile briefing drawer at 768 × 800. All showed the
expected role and sections without horizontal overflow. The desktop rail and
mobile drawer scrolled independently, Points opened by default, and Arrow,
Home, and End keys moved focus and selection between tabs. The implementation
was released in commit `6f817e9`.

## Stage 6: visual role and task guide

- Split the role and after-task responsibilities into separate reading pages,
  keeping every bonus, evaluation, and shared-instruction disclosure before
  the comprehension check.
- Add role-specific and task-specific editorial illustrations only where they
  establish who the participant is or what the two public conditions are.
  Images do not depict private reasons, points, outcomes, or a preferred trade.
- Clarify COMP2 as "Can either person make the final decision on both working
  conditions without the other person agreeing?" This wording change is
  explicitly authorized as a comprehension-only exception. Its ID, answer
  (`no`), construct, order, logging, and retry behavior remain unchanged.

Browser verification with autofill and validation bypass disabled confirmed
that Back returns from the check to Rules (page 4 of 4), preserves existing
answers, and resets the scroll position. A wrong COMP2 answer showed only its
remediation; Retry cleared only COMP2, and the revised `no` answer passed.

## Stage 7: confirmed point breakdown

- Show the participant's own point value for each agreed condition and a final
  total on the shared Direct and Proxy result screen. Do not show the other
  person's points, a joint score, or progress toward an ideal package.
- Keep Proxy packages explicitly provisional before approval. Running point
  changes are not shown during negotiation because proposals may still change
  and are not confirmed outcomes. The breakdown appears at the existing result
  timing, so the added salience should be watched during pilot usability checks.
- For no agreement, show the fallback total without inventing an issue-level
  breakdown. Describe values above, equal to, or below the fallback exactly
  and neutrally; points remain separate from the later bonus decision.

Focused browser checks covered both task illustrations at 1,280 × 800 and the
confirmed Team Lead result at 1,024 × 768. Both images were served through
Next image optimization at their full 3:2 aspect ratio. The result showed two
issue rows whose private point values summed to the final total, retained the
private sand treatment, and had no horizontal overflow.

## Stage 8: role clarity and persistent chat timing

- Use one clearly labelled person in each role illustration and keep the same
  character design across roles, so age or gender does not imply hierarchy.
- Name the two post-task paths separately: the Team Lead decides the Team
  Member's study bonus, while the Team Member sends an upward evaluation of
  the Team Lead to the project director. Working conditions still require both
  people to agree.
- Use `study bonus` consistently in participant-facing role, comprehension,
  and reward copy. This is a terminology clarification only; amounts, item IDs,
  correct answers, scoring, and payment logic are unchanged.
- Keep the single countdown in a shared negotiation toolbar above the chat and
  offer controls, so it remains visible while the document scrolls. Do not add
  a second timer or a live announcement.
- Append the stable `v=20260907b` revision to the four replaced illustration
  sources and allow it through Next image optimization, while preserving the
  unchanged workplace-story source without a query string.

Browser verification on 2026-09-07 kept the negotiation toolbar at 64 px below
the viewport top after scrolling to the page bottom at 1280×800, 1024×768, and
768×800. The same bottom-scroll check passed for the Proxy closing conversation
at 1280×800. At 768×800, the role art and explanation remained together in the
first view with no horizontal overflow. Raw and optimized requests for the
unchanged story and versioned role/task illustrations returned HTTP 200.

## Non-negotiable study boundaries

- Apart from the explicitly authorized COMP2 clarification in Stage 6 and the
  study-bonus terminology clarification in Stage 8, do not
  change questionnaire item text, IDs, or order.
- Keep sensitive disclosure optional and its notice neutral.
- Keep private and shared information visually distinct.
- Preserve `briefing -> RISK -> preference/mandate -> negotiation`.
- Preserve package scoring, fallback, ratification, and closing state logic.
