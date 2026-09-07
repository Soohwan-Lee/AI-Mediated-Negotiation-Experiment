export type FallbackComparison = "above" | "equal" | "below";

/** Exact relationship to the fallback, used only for participant-facing copy. */
export function comparePointsToFallback(
  points: number,
  fallback: number,
): FallbackComparison {
  if (points > fallback) return "above";
  if (points < fallback) return "below";
  return "equal";
}
