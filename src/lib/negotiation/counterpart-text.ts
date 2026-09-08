import { cardOfLayer } from "../tasks";
import type { NegotiationTask, Package, Role } from "../types";

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
