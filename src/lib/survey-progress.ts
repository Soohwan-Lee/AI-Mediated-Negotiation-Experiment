import type { SurveyResponses } from "./types";

export function isMissingResponse(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.trim() === "");
}

/**
 * Keeps a response block on its declared schema. This is intentionally not a
 * semantic migration: Ver.2.23 BG and post-task ids do not mean the same thing
 * as Ver.2.26 ids, so old values must never be silently relabelled.
 */
export function answersForIds(
  saved: SurveyResponses,
  allowedIds: string[],
): SurveyResponses {
  const allowed = new Set(allowedIds);
  return Object.fromEntries(
    Object.entries(saved).filter(([id]) => allowed.has(id)),
  );
}

/** Restore only progress created by an explicit submit button, never by typing. */
export function restoredSubmittedPart(
  pageCount: number,
  submittedParts: unknown,
): number {
  if (pageCount <= 0 || typeof submittedParts !== "number") return 0;
  return Math.min(Math.max(0, Math.trunc(submittedParts)), pageCount - 1);
}

/**
 * Explicit progress is an upper bound. If a participant revisits and clears
 * an earlier required answer, reload returns to that invalid section.
 */
export function restoredValidPart(
  pageIds: string[][],
  saved: SurveyResponses,
  submittedParts: unknown,
): number {
  const submitted = restoredSubmittedPart(pageIds.length, submittedParts);
  const firstInvalid = pageIds.findIndex((ids) =>
    ids.some((id) => isMissingResponse(saved[id])),
  );
  return firstInvalid === -1 ? submitted : Math.min(submitted, firstInvalid);
}

export function explicitlyCompleted(saved: SurveyResponses): boolean {
  return saved._completed === true;
}

/** Selects a landing page once from persisted answers, never from live edits. */
export function restoredSurveyPart(
  pageIds: string[][],
  saved: SurveyResponses,
): number {
  if (pageIds.length === 0) return 0;
  const firstIncomplete = pageIds.findIndex((ids) =>
    ids.some((id) => isMissingResponse(saved[id])),
  );
  return firstIncomplete === -1 ? pageIds.length - 1 : firstIncomplete;
}

export function surveyComplete(
  pageIds: string[][],
  saved: SurveyResponses,
): boolean {
  return pageIds.flat().every((id) => !isMissingResponse(saved[id]));
}
