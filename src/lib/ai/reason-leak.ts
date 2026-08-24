/**
 * "Does this text reproduce a reason the participant did not authorize?"
 *
 * Used by the rehearsal route on the proxy's generated reply. It lives here
 * rather than in the route so it can be tested directly (`npm run test:units`)
 * — this is the one guardrail whose failure is invisible in the interface: a
 * leak looks like an ordinary helpful answer, and the participant would never
 * know a card they withheld had been spoken back to them.
 *
 * WHY VOCABULARY AND NOT SENTENCES. The proxy is explicitly allowed to
 * paraphrase what it MAY say, so a leak arrives as a paraphrase too. Matching
 * whole sentences would catch only a verbatim copy, which is the one form a
 * model is least likely to produce.
 *
 * THE SUBTRACTION IS THE WHOLE TRICK, and without it the check was worse than
 * useless. A forbidden card shares most of its words with the things the proxy
 * is supposed to discuss — the term's own name, and the work reasons it may
 * voice. Scored naively, "without protected time the schedule slips and quality
 * suffers" — a legitimate answer about an AUTHORIZED reason — matched the
 * sensitive card "Without protected time, you are afraid the same mistake will
 * happen again", because the overlap is exactly the words the participant wants
 * said. Each forbidden card is therefore reduced to the words appearing in it
 * and nowhere in the sayable vocabulary. What is left could only have come from
 * the card.
 *
 * A FIXED THRESHOLD, NOT A PROPORTION. Scaling with card length let the long
 * cards hide: the sensitive cards run to a sentence or two, so "half the
 * distinctive words" was four or five, and a faithful one-clause paraphrase
 * carrying three of them passed. Two distinctive words is a deliberately low
 * bar — a false positive costs one substituted sentence, a false negative shows
 * the participant a disclosure they refused.
 *
 * A lexical screen is a floor, not a ceiling (the same caveat as
 * `ai/validator.ts`). Before data collection this should be paired with a
 * model-based check.
 */

const STOP = new Set([
  "about", "after", "again", "also", "anything", "because", "been", "before",
  "could", "every", "from", "have", "here", "into", "just", "know", "known",
  "made", "make", "makes", "many", "more", "most", "much", "only", "over",
  "same", "should", "some", "something", "still", "take", "takes", "than",
  "that", "their", "them", "then", "there", "these", "they", "this", "those",
  "very", "were", "what", "when", "which", "with", "would", "your", "yours",
]);

/** Content words long enough to carry meaning on their own. */
function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !STOP.has(w));
}

/** Two words that could only have come from the card itself. */
const THRESHOLD = 2;

export function leaksForbiddenReason(
  text: string,
  forbidden: Array<{ id: string; text: string }>,
  /**
   * Everything the proxy may legitimately talk about: the authorized reason
   * cards, and the issue labels and descriptions. Subtracted from each
   * forbidden card before scoring.
   */
  sayable: string[],
): boolean {
  const haystack = text.toLowerCase();
  const allowed = new Set(sayable.flatMap(contentWords));

  for (const card of forbidden) {
    const distinctive = [...new Set(contentWords(card.text))].filter(
      (w) => !allowed.has(w),
    );
    // Nothing distinctive left to judge on: this card's whole vocabulary is
    // shared with things the proxy may legitimately say, so any match would be
    // a false positive by construction.
    if (distinctive.length < THRESHOLD) continue;
    const hits = distinctive.filter((w) => haystack.includes(w)).length;
    if (hits >= THRESHOLD) return true;
  }
  return false;
}
