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
words and are 1,219 px, 1,134 px, and 983 px tall in the same viewport. None
has horizontal overflow. The total includes short recap text on the final page;
the maximum reading load at one time fell by 56%.

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
- Turn the practice into a friendly, explicit tutorial with numbered prompts,
  a strong current-action cue, and immediate explanations after each action.
- Keep both Proxy policies on the same practice interface and do not add a
  second practice round or a new study mechanic.

## Non-negotiable study boundaries

- Do not change questionnaire item text, IDs, or order.
- Keep sensitive disclosure optional and its notice neutral.
- Keep private and shared information visually distinct.
- Preserve `briefing -> RISK -> preference/mandate -> negotiation`.
- Preserve package scoring, fallback, ratification, and closing state logic.
