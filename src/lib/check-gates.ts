import { markTaskInterrupted, readTaskRun } from "./task-run";
import { readFurthest } from "./flow-position";
import { FLOW, flowIndex, type FlowKey } from "./study-config";

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
    const attempts = Math.max(0, Number(parsed.attempts) || 0);
    if (parsed.status === "failed") {
      const migrated: CheckGateRecord = { status: "pending", attempts };
      window.localStorage.setItem(key(participantKey, scope), JSON.stringify(migrated));
      return migrated;
    }
    return { status: parsed.status as CheckGateStatus, attempts };
  } catch {
    return { status: "pending", attempts: 0 };
  }
}

export function writeCheckGate(participantKey: string, scope: CheckGateScope, record: CheckGateRecord): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(participantKey, scope), JSON.stringify(record));
}

export type StopReason = "check" | "withdrawal" | "technical";

export function readStopReason(participantKey: string): StopReason | null {
  if (typeof window === "undefined") return null;
  try {
    const stopKey = `${PREFIX}${participantKey}:stopped`;
    const value = window.localStorage.getItem(stopKey);
    if (value === "check") {
      window.localStorage.removeItem(stopKey);
      return null;
    }
    return value === "withdrawal" || value === "technical" ? value : null;
  } catch {
    return null;
  }
}

export function writeStopReason(participantKey: string, reason: StopReason): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${PREFIX}${participantKey}:stopped`, reason);
  } catch {
    // The caller still routes directly to the stop page for this session.
  }
}

export type TaskGateRedirect =
  | { href: "/study-stop?reason=withdrawal" }
  | { href: "/study-stop?reason=technical" }
  | { href: string; preserveFurthest: true }
  | { href: "/instruction"; furthestKey: "instruction" }
  | { href: `/practice/${1 | 2}`; furthestKey: "practice" | "practice-2" };

/** One gate decision shared by typed-URL navigation and the task route itself. */
export function taskGateRedirect(
  participantKey: string,
  taskIndex: 1 | 2,
): TaskGateRedirect | null {
  const stopped = readStopReason(participantKey);
  if (stopped === "withdrawal") return { href: "/study-stop?reason=withdrawal" };
  if (stopped === "technical") return { href: "/study-stop?reason=technical" };

  const taskRun = readTaskRun(participantKey, taskIndex);
  if (taskRun?.status === "active") {
    markTaskInterrupted(participantKey, taskIndex);
    writeStopReason(participantKey, "technical");
    return { href: "/study-stop?reason=technical" };
  }
  if (taskRun?.status === "interrupted") {
    writeStopReason(participantKey, "technical");
    return { href: "/study-stop?reason=technical" };
  }
  if (taskRun?.status === "completed") {
    const surveyKey = `survey-${taskIndex}` as FlowKey;
    let furthest = 0;
    try {
      furthest = readFurthest();
    } catch {
      // Fall back to the task's questionnaire when browser storage is blocked.
    }
    const targetIndex = Math.min(
      Math.max(flowIndex(surveyKey), furthest),
      FLOW.length - 1,
    );
    return {
      href: FLOW[targetIndex]?.href ?? `/task/${taskIndex}/survey`,
      preserveFurthest: true,
    };
  }
  if (readCheckGate(participantKey, "common").status !== "passed") {
    return { href: "/instruction", furthestKey: "instruction" };
  }
  if (readCheckGate(participantKey, `task-${taskIndex}`).status !== "passed") {
    return taskIndex === 1
      ? { href: "/practice/1", furthestKey: "practice" }
      : { href: "/practice/2", furthestKey: "practice-2" };
  }
  return null;
}
