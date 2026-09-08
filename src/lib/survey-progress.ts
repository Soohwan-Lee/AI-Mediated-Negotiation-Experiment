import type { SurveyResponses } from "./types";

/** Selects a landing page once from persisted answers, never from live edits. */
export function restoredSurveyPart(
  pageIds: string[][],
  saved: SurveyResponses,
): number {
  if (pageIds.length === 0) return 0;
  const firstIncomplete = pageIds.findIndex((ids) =>
    ids.some((id) => saved[id] === undefined || saved[id] === ""),
  );
  return firstIncomplete === -1 ? pageIds.length - 1 : firstIncomplete;
}
