import { getStore } from "./store";

export type TaskRunStatus = "active" | "completed" | "interrupted";

export interface TaskRunRecord {
  status: TaskRunStatus;
  startedAt: string;
  completedAt?: string;
  interruptedAt?: string;
}

const PREFIX = "amne:task-run:";

function key(participantKey: string, index: 1 | 2): string {
  return `${PREFIX}${participantKey}:${index}`;
}

function isTaskRunRecord(value: unknown): value is TaskRunRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<TaskRunRecord>;
  return (
    ["active", "completed", "interrupted"].includes(record.status ?? "") &&
    typeof record.startedAt === "string"
  );
}

export function readTaskRun(
  participantKey: string,
  index: 1 | 2,
): TaskRunRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(key(participantKey, index)) ?? "null",
    ) as unknown;
    return isTaskRunRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeTaskRun(
  participantKey: string,
  index: 1 | 2,
  record: TaskRunRecord,
): TaskRunRecord | null {
  if (typeof window === "undefined") return null;
  try {
    window.localStorage.setItem(key(participantKey, index), JSON.stringify(record));
  } catch {
    return null;
  }

  void getStore()
    .saveResponses(participantKey, `task_run_t${index}`, { ...record })
    .catch(() => undefined);
  return record;
}

export function markTaskStarted(
  participantKey: string,
  index: 1 | 2,
): TaskRunRecord | null {
  const existing = readTaskRun(participantKey, index);
  if (existing) return existing;
  return writeTaskRun(participantKey, index, {
    status: "active",
    startedAt: new Date().toISOString(),
  });
}

export function markTaskCompleted(
  participantKey: string,
  index: 1 | 2,
): TaskRunRecord | null {
  const existing = readTaskRun(participantKey, index);
  if (!existing || existing.status === "interrupted") return existing;
  if (existing.status === "completed") return existing;
  return writeTaskRun(participantKey, index, {
    ...existing,
    status: "completed",
    completedAt: new Date().toISOString(),
  });
}

export function markTaskInterrupted(
  participantKey: string,
  index: 1 | 2,
): TaskRunRecord | null {
  const existing = readTaskRun(participantKey, index);
  if (!existing || existing.status === "completed") return existing;
  if (existing.status === "interrupted") return existing;
  return writeTaskRun(participantKey, index, {
    ...existing,
    status: "interrupted",
    interruptedAt: new Date().toISOString(),
  });
}
