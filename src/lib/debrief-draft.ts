const PREFIX = "amne:debrief-draft:";

function key(participantKey: string): string {
  return `${PREFIX}${participantKey}`;
}

export function readDebriefDraft(participantKey: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key(participantKey)) ?? "";
  } catch {
    return "";
  }
}

export function writeDebriefDraft(participantKey: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(participantKey), value);
  } catch {
    // An optional comment must not block completion when storage is unavailable.
  }
}
