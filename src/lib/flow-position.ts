/**
 * How far through the flow this browser has got.
 *
 * Shared by the navigation guard, which bounces arrivals at an earlier step
 * forward, and by the Back control, which has to lower the mark or the guard
 * would immediately undo a deliberate step back.
 */

const FURTHEST_KEY = "amne:furthest";
const FURTHEST_IDENTITY_KEY = "amne:furthest-identity";
const SESSION_KEY = "amne:session";

/** Keep the browser-wide progress mark attached to one admitted attempt. */
export function setFlowPositionIdentity(participantKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const scopedIdentity = window.localStorage.getItem(FURTHEST_IDENTITY_KEY);
    let previousIdentity = scopedIdentity;

    // Preserve a participant already in flight when this scoped key is first
    // deployed. The existing session record identifies that legacy mark.
    if (!previousIdentity) {
      let session: { participantKey?: unknown } | null = null;
      try {
        session = JSON.parse(
          window.localStorage.getItem(SESSION_KEY) ?? "null",
        ) as { participantKey?: unknown } | null;
      } catch {
        // A malformed legacy session cannot safely own the progress mark.
      }
      previousIdentity =
        typeof session?.participantKey === "string"
          ? session.participantKey
          : null;
    }

    if (previousIdentity !== participantKey) {
      window.localStorage.removeItem(FURTHEST_KEY);
    }
    window.localStorage.setItem(FURTHEST_IDENTITY_KEY, participantKey);
  } catch {
    // Navigation still works from its neutral position when storage is blocked.
  }
}

export function readFurthest(): number {
  if (typeof window === "undefined") return 0;
  const stored = Number(window.localStorage.getItem(FURTHEST_KEY) ?? "0");
  return Number.isFinite(stored) ? stored : 0;
}

export function writeFurthest(index: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FURTHEST_KEY, String(index));
}
