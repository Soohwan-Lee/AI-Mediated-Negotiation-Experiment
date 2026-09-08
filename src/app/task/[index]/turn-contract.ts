/**
 * The wire shapes the two participant-facing negotiations share, and the
 * validators that keep a malformed response from advancing the ladder.
 *
 * WHY THIS IS ONE FILE RATHER THAN TWO COPIES. The Direct arm and the Proxy
 * arm's three-minute closing are the two places a participant speaks for
 * themselves. Any difference between them lands directly on
 * `Pooled Proxy − Direct`, which is the contrast the whole study is built to
 * make — so the request bodies, the response guards and the fold rules are
 * declared once and imported by both. They drifted before, on `voicedTier`,
 * and the type was the only thing that could have caught it.
 */

import type { ExchangeState, ReasonTier } from "@/lib/negotiation/machine";
import type { Package } from "@/lib/types";

/**
 * The classifier's label set (§6.2a, Ver.2.21).
 *
 * `PRI` IS GONE FROM THE OUTPUT and survives here as an accepted alias. A bare
 * priority claim is now a `WR` label carrying `priority_claim: true`, because
 * the rung it used to buy was deleted — but a stale route, a replayed log or a
 * model that has not read the new prompt can still send it, and a validator
 * that rejected it would put a live turn into the recovery path over a value
 * `LABEL_TIER` already maps correctly.
 */
export type ReasonLabel = "none" | "WR" | "PRI" | "SB";

/** Whether the participant's message agreed, counter-proposed, or neither. */
export type ReasonStance = "accept" | "counter" | "none";

/**
 * P5's answer, read CUMULATIVELY over every message the participant has sent
 * in this task (§6.2a).
 *
 * ONE MESSAGE AT A TIME WAS THE WRONG UNIT. People say a confession across two
 * or three messages — "actually, after the last presentation" / "the client
 * pulled me aside" / "I never passed it on" — and no one of those is the whole
 * fact. Judging each alone, under a rule that resolves ambiguity DOWNWARD,
 * puts a systematic floor on Direct disclosure, which would then read as the
 * Proxy arm's protective effect. So the client sends the whole list every
 * time and the label is the highest rung reached so far.
 */
export interface ClassificationResponse {
  label: ReasonLabel;
  /** A priority claim with no reason behind it: one SCRIPT-ASKWHY, no rung. */
  priority_claim?: boolean;
  confidence?: number;
  stance?: ReasonStance;
  /** The package read off an explicit counter-proposal, if there was one. */
  counter_terms?: Record<string, string>;
  /** True when no model ran — see the note in the classify route. */
  stubbed?: boolean;
}

/**
 * The counterpart route's answer.
 *
 * THE DECIDED ACTION IS NOT IN IT, AND THAT IS THE POINT. `propose_tier`,
 * `ask_why`, `disclose_sb` and the rest are the names of a SCRIPT, and a
 * participant who opens their network tab and sees one has learned that the
 * other party is machinery — the first thing on CLAUDE.md's "must never learn"
 * list, and the one this arm cannot survive. So the wire carries what the
 * client actually needs and nothing that names the move:
 *
 *   message   the bubbles, already joined with " || " and capped
 *   proposal  the package the counterpart put up or accepted
 *   state     the FULL advanced state, one-shot flags already folded in
 *   settled   how the exchange ended, or null if it has not
 *
 * `settled: "agreed"` also arrives on the combined disclose-and-accept turn,
 * which is why the client must not look for an acceptance action to know the
 * task is over.
 */
export interface CounterpartResponse {
  message: string;
  proposal?: Package | null;
  /** The exchange state the route advanced. REPLACE what you hold with it. */
  state?: ExchangeState;
  /** How the exchange ended, or null while it continues. */
  settled?: "agreed" | "impasse" | null;
}

export function isClassificationResponse(
  value: unknown,
): value is ClassificationResponse {
  if (typeof value !== "object" || value === null || !("label" in value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (!["none", "WR", "PRI", "SB"].includes(String(v.label))) return false;
  if (
    v.confidence !== undefined &&
    (typeof v.confidence !== "number" ||
      !Number.isFinite(v.confidence) ||
      v.confidence < 0 ||
      v.confidence > 1)
  ) {
    return false;
  }
  if (
    v.stance !== undefined &&
    !["accept", "counter", "none"].includes(String(v.stance))
  ) {
    return false;
  }
  if (v.priority_claim !== undefined && typeof v.priority_claim !== "boolean") {
    return false;
  }
  if (
    v.counter_terms !== undefined &&
    (typeof v.counter_terms !== "object" || v.counter_terms === null)
  ) {
    return false;
  }
  return true;
}

export function isCounterpartResponse(
  value: unknown,
): value is CounterpartResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.message !== "string" || v.message.trim().length === 0) {
    return false;
  }
  // `settled` stops the clock and codes the outcome, so a value outside the
  // union is refused rather than read as "still going": a typo would silently
  // run a finished exchange to the timer and record an impasse the counterpart
  // never declared.
  if (
    v.settled !== undefined &&
    v.settled !== null &&
    v.settled !== "agreed" &&
    v.settled !== "impasse"
  ) {
    return false;
  }
  return true;
}

/**
 * A counter-proposal, kept only if it names EVERY term with a real option.
 *
 * A half package is not a position anyone can answer, and the machine would
 * read it as a lopsided proposal (SCRIPT-BALANCE) rather than as talk — so a
 * partial or misspelled extraction is dropped rather than half-applied. The
 * participant is not told: the drawer and the Accept button are still there,
 * and telling them "I could not read your proposal" would be coaching them
 * toward the drawer on a screen whose subject is the conversation.
 */
export function resolveCounterTerms(
  issues: ReadonlyArray<Issueish>,
  terms: Record<string, string> | undefined,
): Package | null {
  if (!terms) return null;
  const resolved: Package = {};
  for (const issue of issues) {
    const optionId = terms[issue.id];
    if (!optionId) return null;
    if (!issue.options.some((o) => o.id === optionId)) return null;
    resolved[issue.id] = optionId;
  }
  return resolved;
}

interface Issueish {
  id: string;
  options: ReadonlyArray<{ id: string }>;
}


/**
 * The exchange flags a client holds between turns.
 *
 * Held as one object because the route now returns the advanced copy and the
 * client replaces what it holds — a field-by-field merge would silently drop
 * whichever flag was added last, which is exactly how the one-shot scripts
 * (ASKSIT, CLARIFY, NUDGE) become no-shot or every-turn.
 */
export type HeldExchangeState = Pick<
  ExchangeState,
  | "askedWhy"
  | "askSitUsed"
  | "reasonlessTurns"
  | "clarifyUsedForTier"
  | "nudgeUsed"
  | "numbersReminded"
  | "softCloseOffered"
  | "counterpartSbDisclosed"
>;

export const INITIAL_EXCHANGE_STATE: HeldExchangeState = {
  askedWhy: false,
  askSitUsed: false,
  reasonlessTurns: 0,
  clarifyUsedForTier: null,
  nudgeUsed: false,
  numbersReminded: false,
  softCloseOffered: false,
  counterpartSbDisclosed: false,
};

/**
 * Take the route's advanced state as the client's new state.
 *
 * THE ROUTE OWNS THE FOLD (Ver.2.21 contract). It runs the machine, it knows
 * which move it made, and it folds every one-shot flag before answering — so
 * the client replaces what it holds rather than merging. Merging would be the
 * client re-deriving a decision the route deliberately does not tell it, and
 * that is exactly the shape of the `voicedTier` failure: two ends computing
 * one value, agreeing in the tests, disagreeing in production.
 *
 * The `previous` argument is the fallback for a response that omits the block
 * entirely. Keeping the old state is the safe direction: every field in it is
 * either a latch that has already fired or a counter, so carrying it forward
 * can only make the counterpart repeat itself less, never more. Inventing a
 * fresh one would unspend every script at once.
 */
export function takeExchangeState(
  returned: ExchangeState | undefined,
  previous: HeldExchangeState,
): HeldExchangeState {
  if (!returned) return previous;
  return {
    askedWhy: Boolean(returned.askedWhy),
    askSitUsed: Boolean(returned.askSitUsed),
    nudgeUsed: Boolean(returned.nudgeUsed),
    numbersReminded: Boolean(returned.numbersReminded),
    softCloseOffered: Boolean(returned.softCloseOffered),
    counterpartSbDisclosed: Boolean(returned.counterpartSbDisclosed),
    reasonlessTurns: returned.reasonlessTurns ?? 0,
    clarifyUsedForTier: returned.clarifyUsedForTier ?? null,
  };
}

/**
 * The same fold, for MOCKUP MODE ONLY.
 *
 * A mockup never calls the route, so nothing advances the state for it. The
 * flags are folded here from the local decision instead — which is legitimate
 * there and only there, because the whole point of a mockup is to show the
 * screens a live run would produce, and `tests/reason-rules.test.mjs` pins the
 * script and the machine to each other in every cell.
 *
 * Never reachable from a live turn: the live path calls `takeExchangeState`.
 */
export function foldExchangeState(
  held: HeldExchangeState,
  returned: Partial<ExchangeState> | undefined,
  local: Partial<HeldExchangeState>,
): HeldExchangeState {
  const latch = (
    key: keyof Pick<
      HeldExchangeState,
      | "askedWhy"
      | "askSitUsed"
      | "nudgeUsed"
      | "numbersReminded"
      | "softCloseOffered"
      | "counterpartSbDisclosed"
    >,
  ) =>
    Boolean(held[key]) || Boolean(returned?.[key]) || Boolean(local[key]);

  return {
    askedWhy: latch("askedWhy"),
    askSitUsed: latch("askSitUsed"),
    nudgeUsed: latch("nudgeUsed"),
    numbersReminded: latch("numbersReminded"),
    softCloseOffered: latch("softCloseOffered"),
    counterpartSbDisclosed: latch("counterpartSbDisclosed"),
    reasonlessTurns:
      local.reasonlessTurns ??
      returned?.reasonlessTurns ??
      held.reasonlessTurns ??
      0,
    clarifyUsedForTier:
      local.clarifyUsedForTier !== undefined
        ? local.clarifyUsedForTier
        : (returned?.clarifyUsedForTier ?? held.clarifyUsedForTier ?? null),
  };
}

/** One stored classifier judgement, kept for the gate-19 κ (§6.2). */
export interface ClassifierLogEntry {
  text: string;
  label: ReasonLabel;
  confidence: number | null;
  stance: ReasonStance;
  priorityClaim: boolean;
  tier: ReasonTier;
  /** Which message index in this task's participant list it was read over. */
  messageIndex: number;
  createdAt: string;
}

/**
 * The label as the transcript stores it (`Message.reasonLabel`).
 *
 * `PRI` COLLAPSES TO `WR`, which is not a loss: Ver.2.21 made a bare priority
 * claim a `WR` label carrying `priority_claim`, and the flag is stored beside
 * the message on the classifier log. Keeping a fourth stored value would leave
 * the human re-coders of gate 19's κ scoring against a label the prompt no
 * longer emits.
 */
export function storedLabel(label: ReasonLabel): "none" | "WR" | "SB" {
  return label === "PRI" ? "WR" : label;
}
