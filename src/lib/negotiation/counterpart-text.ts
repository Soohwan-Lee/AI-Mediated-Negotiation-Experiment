import { cardOfLayer } from "../tasks";
import type { NegotiationTask, Package, Role } from "../types";

/** Keep reciprocal disclosure factual and the accepted package visible. */
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
  const words = sb.split(/\s+/);
  const bubbles: string[] = [];
  for (const word of words) {
    const next = bubbles.length ? `${bubbles[bubbles.length - 1]} ${word}` : word;
    if (bubbles.length && next.length > 112) bubbles.push(word);
    else if (bubbles.length) bubbles[bubbles.length - 1] = next;
    else bubbles.push(word);
  }
  bubbles.push(`With that out in the open, ${terms} works for me.`);
  return bubbles.join(" || ");
}
