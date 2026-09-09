import { cardOfLayer } from "../tasks";
import { compactChatBubbles } from "../ai/validator";
import type { NegotiationTask, Package, Role } from "../types";

/**
 * The per-bubble character limit P1's voice rule asks of the Direct
 * counterpart. The proxies deliberately do not observe it — they speak in
 * plain third-person sentences (§6.5, P3).
 */
export const P1_BUBBLE_CHARS = 170;

/**
 * Break a long card into chat bubbles AT SENTENCE SEAMS.
 *
 * WHY NOT A WORD BUDGET. This split used to accumulate words until it crossed
 * 112 characters and break wherever that landed, which put the seam in the
 * middle of a clause: "something I told the director was doable before I'd
 * checked with the team. The || director has already passed that answer
 * upward." Nobody types like that, and this is the counterpart's confession —
 * the one turn where reading like a person carries the whole "presented as
 * another participant" claim (P1). A mid-clause break is a stronger tell than
 * a long bubble.
 *
 * A sentence still over the limit on its own is left whole rather than cut:
 * losing half a fact is worse than a long bubble, and the cards are written as
 * speech, so their sentences are short enough in practice.
 */
export function splitIntoBubbles(text: string, limit = 120): string {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const bubbles: string[] = [];
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const last = bubbles[bubbles.length - 1];
    if (last && `${last} ${sentence}`.length <= limit) {
      bubbles[bubbles.length - 1] = `${last} ${sentence}`;
    } else {
      bubbles.push(sentence);
    }
  }
  return bubbles.join(" || ");
}

/**
 * Keep reciprocal disclosure factual and the accepted package visible.
 *
 * DETERMINISTIC ON PURPOSE (§6.1 stage 6). When an SB and a valid acceptance
 * arrive in the same turn, both the full card fact and the accepted levels have
 * to survive into one reply — free rendering plus a length cap could otherwise
 * trim one while keeping the other, and the client records settlement off this
 * turn.
 */
export function reciprocalAcceptanceText(
  task: NegotiationTask,
  counterpartRole: Role,
  proposal: Package,
): string {
  const sb = cardOfLayer(task, counterpartRole, "sensitive")?.text ?? "";
  const terms = task.issues
    .map((issue) => issue.options.find((option) => option.id === proposal[issue.id])?.label)
    .filter(Boolean)
    .join(", ");
  const acceptance = `With that out in the open, ${terms} works for me.`;
  return sb ? `${splitIntoBubbles(sb)} || ${acceptance}` : acceptance;
}

/**
 * The counterpart's work reason, broken into person-sized bubbles.
 *
 * Split at sentence seams, at the P1 limit rather than the default, so a card
 * breaks only where it must and whole sentences stay together.
 */
export function splitWorkReason(text: string | undefined): string | undefined {
  return text ? splitIntoBubbles(text, P1_BUBBLE_CHARS) : undefined;
}

/**
 * THE SEEDED OPENING — ONE COPY, CALLED FROM FOUR PLACES.
 *
 * SCRIPT-OPEN's first message existed as four hand-written copies: the
 * counterpart route's fallback, the mockup script, the simulation's seed, and
 * `baseline-task.tsx` — which is the one a real Direct participant actually
 * reads. Three of them pasted the work reason card in whole, and the four
 * Ver.2.21 cards run 225-277 characters, so the counterpart's FIRST words
 * arrived as a single paragraph of that length. That is how a system emits
 * text, not how a person types in a work chat, in the one message that has to
 * establish the counterpart as another participant (§12 P1) — the single thing
 * this arm cannot survive.
 *
 * `compactChatBubbles` downstream could never have fixed it: it MERGES bubbles
 * down to three and never splits an over-long one. So the split happens here,
 * and the whole seed then goes through the same compactor the live route
 * applies to every counterpart turn — giving the situation in two short
 * bubbles and the question as its own last one, which is what §6.1 stage 1 is.
 *
 * Four copies is also why the defect survived: the route was fixed first and
 * the participant-facing screen still had it. One function now, so a fix to
 * the shape cannot reach three call sites and miss the fourth.
 */
export function seededOpeningText(
  workReasonText: string | undefined,
  question: string,
  fallback = "there's a bit of pressure on my side this quarter.",
): string {
  const reason = workReasonText
    ? splitWorkReason(workReasonText)
    : fallback;
  return compactChatBubbles(
    `hi! good to be sorting this out. || ${reason} || ${question}`,
  );
}
