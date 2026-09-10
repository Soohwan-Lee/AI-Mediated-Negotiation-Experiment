import { randomUUID } from "node:crypto";
import { AI_CONFIG } from "../ai/config";
import { assignmentOf, checkOrigin, database, participantFor, StudyError } from "./study-db";
import type { ProxyPolicy, Role, TaskId } from "../types";

export interface AuditIdentity {
  sessionIndex?: number;
  messageId?: string;
  taskId: TaskId;
  role: Role;
  policy?: ProxyPolicy;
  afterProxy?: boolean;
}

/** Authenticate before a paid call; persist its private audit before success.
 * Retry attempts append under the same message key, rather than overwriting.
 * Preview/mock traffic must never consume or write recruitment records.
 */
export async function beginNegotiationAudit(request: Request, identity: AuditIdentity,
  kind: "classifier" | "counterpart" | "proxy") {
  if (process.env.NEXT_PUBLIC_DEV_TOOLS !== "off") return async () => {};
  checkOrigin(request);
  if (![1, 2].includes(identity.sessionIndex ?? 0) ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(identity.messageId ?? "")) {
    throw new StudyError(400, "audit_identity_required");
  }
  const row = await participantFor(request);
  if (row.operational.consented !== true) throw new StudyError(403, "consent_required");
  const session = assignmentOf(row).sessions[identity.sessionIndex! - 1];
  if (session.taskId !== identity.taskId || row.role !== identity.role ||
    (identity.policy !== undefined && row.proxy_policy !== identity.policy) ||
    (kind === "proxy" && session.condition === "direct") ||
    (kind === "counterpart" && (session.condition !== "direct") !== Boolean(identity.afterProxy))) {
    throw new StudyError(409, "assignment_mismatch");
  }
  const attemptId = randomUUID();
  return async (details: Record<string, unknown>) => {
    await database("rpc/merge_task_audit", "POST", {
      p_participant_key: row.participant_key,
      p_task_index: identity.sessionIndex,
      p_audit_key: `${kind}:${identity.messageId}`,
      p_details: { attemptId, kind, messageId: identity.messageId,
        recordedAt: new Date().toISOString(), model: AI_CONFIG.model,
        reasoningEffort: AI_CONFIG.reasoningEffort, ...details },
    });
  };
}
