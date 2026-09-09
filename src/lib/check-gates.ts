export type CheckGateScope = "common" | `task-${1 | 2}`;
export type CheckGateStatus = "pending" | "passed" | "failed";

export interface CheckGateRecord {
  status: CheckGateStatus;
  attempts: number;
}

const PREFIX = "amne:check-gate:";

function key(participantKey: string, scope: CheckGateScope): string {
  return `${PREFIX}${participantKey}:${scope}`;
}

export function readCheckGate(participantKey: string, scope: CheckGateScope): CheckGateRecord {
  if (typeof window === "undefined") return { status: "pending", attempts: 0 };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key(participantKey, scope)) ?? "null") as Partial<CheckGateRecord> | null;
    if (!parsed || !["pending", "passed", "failed"].includes(parsed.status ?? "")) {
      return { status: "pending", attempts: 0 };
    }
    return {
      status: parsed.status as CheckGateStatus,
      attempts: Math.max(0, Number(parsed.attempts) || 0),
    };
  } catch {
    return { status: "pending", attempts: 0 };
  }
}

export function writeCheckGate(participantKey: string, scope: CheckGateScope, record: CheckGateRecord): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(participantKey, scope), JSON.stringify(record));
}

export type StopReason = "check" | "withdrawal";

export function readStopReason(participantKey: string): StopReason | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(`${PREFIX}${participantKey}:stopped`);
  return value === "check" || value === "withdrawal" ? value : null;
}

export function writeStopReason(participantKey: string, reason: StopReason): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${PREFIX}${participantKey}:stopped`, reason);
}
