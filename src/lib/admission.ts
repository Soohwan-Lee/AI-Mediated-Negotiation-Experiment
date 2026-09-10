import type { Assignment, ProlificContext } from "./types";

export interface Admission { assignment: Assignment; status: string; consented?: boolean }

/** No browser-generated identity is sent to production admission. */
export async function requestAdmission(prolific: ProlificContext): Promise<Admission> {
  const values = [prolific.prolificPid, prolific.studyId, prolific.sessionId];
  const hasAny = values.some(Boolean);
  if (hasAny && !values.every(value => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value))) {
    throw new Error("Please open the full study link from Prolific.");
  }
  const response = await fetch("/api/assign", {
    method: hasAny ? "POST" : "GET", credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    ...(hasAny ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(prolific) } : {}),
  });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 400
    ? "Please open the full study link from Prolific."
    : "We could not start or restore this study session. Please try again or contact the research team.");
  const data = await response.json() as Admission;
  if (!data.assignment?.participantKey || !["active", "completed"].includes(data.status)) {
    throw new Error("This study session has stopped and cannot be restarted. Please contact the research team.");
  }
  return data;
}
