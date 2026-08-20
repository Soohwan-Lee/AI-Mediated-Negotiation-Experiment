"use client";

/**
 * Task router.
 *
 * The URL carries only the task INDEX (1 or 2), never the condition. Which
 * surface renders is resolved from the participant's assignment, so the
 * address bar cannot leak the design.
 */

import { use } from "react";
import { useParticipant } from "@/lib/participant-context";
import { isProxyCondition, sessionPlan } from "@/lib/assignment";
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
  const { assignment } = useParticipant();

  if (!assignment) {
    return (
      <Page>
        <p className="text-sm text-[var(--ink-2)]">Loading your task…</p>
      </Page>
    );
  }

  const plan = sessionPlan(assignment, taskIndex);

  return isProxyCondition(plan.condition) ? (
    <ProxyTask
      taskIndex={taskIndex}
      taskId={plan.taskId}
      role={assignment.role}
      policy={plan.condition === "explorer" ? "explorer" : "delegate"}
    />
  ) : (
    <BaselineTask
      taskIndex={taskIndex}
      taskId={plan.taskId}
      role={assignment.role}
    />
  );
}
