"use client";

/**
 * Task router.
 *
 * The URL carries only the task INDEX (1 or 2), never the condition. Which
 * surface renders is resolved from the participant's assignment, so the
 * address bar cannot leak the design.
 */

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParticipant } from "@/lib/participant-context";
import { isProxyCondition, sessionFingerprint, sessionPlan } from "@/lib/assignment";
import { useDevMode } from "@/lib/dev-mode";
import { taskGateRedirect } from "@/lib/check-gates";
import { writeFurthest } from "@/lib/flow-position";
import { flowIndex } from "@/lib/study-config";
import { Page } from "@/components/ui";
import { BaselineTask } from "./baseline-task";
import { ProxyTask } from "./proxy-task";

export default function TaskPage({
  params,
}: {
  params: Promise<{ index: string }>;
}) {
  const { index } = use(params);
  const taskIndex = (Number(index) === 2 ? 2 : 1) as 1 | 2;
  const { assignment, participantKey } = useParticipant();
  const router = useRouter();
  const { enabled: devEnabled } = useDevMode();
  const plan = assignment ? sessionPlan(assignment, taskIndex) : null;
  const assignmentFingerprint = assignment
    ? sessionFingerprint(assignment, taskIndex)
    : null;
  const [gateReadyFor, setGateReadyFor] = useState<string | null>(null);

  useEffect(() => {
    if (!assignment || !assignmentFingerprint) return;
    if (devEnabled) {
      const id = window.setTimeout(
        () => setGateReadyFor(assignmentFingerprint),
        0,
      );
      return () => window.clearTimeout(id);
    }
    if (!participantKey) return;

    const redirect = taskGateRedirect(participantKey, taskIndex);
    if (redirect) {
      if ("furthestKey" in redirect) {
        writeFurthest(flowIndex(redirect.furthestKey));
      }
      router.replace(redirect.href);
      return;
    }
    const id = window.setTimeout(
      () => setGateReadyFor(assignmentFingerprint),
      0,
    );
    return () => window.clearTimeout(id);
  }, [assignment, assignmentFingerprint, devEnabled, participantKey, router, taskIndex]);

  if (!assignment || !plan || gateReadyFor !== assignmentFingerprint) {
    return (
      <Page>
        <p className="text-sm text-[var(--ink-2)]">Loading your task…</p>
      </Page>
    );
  }

  return isProxyCondition(plan.condition) ? (
    <ProxyTask
      taskIndex={taskIndex}
      taskId={plan.taskId}
      role={assignment.role}
      policy={plan.condition === "ai_supplemented" ? "ai_supplemented" : "user_specified"}
    />
  ) : (
    <BaselineTask
      taskIndex={taskIndex}
      taskId={plan.taskId}
      role={assignment.role}
    />
  );
}
