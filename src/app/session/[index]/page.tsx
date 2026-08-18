"use client";

/**
 * Main session router.
 *
 * The URL carries only the session INDEX (1 or 2), never the condition. Which
 * surface renders is resolved from the participant's assignment, so the
 * address bar cannot leak the design (Methods §Controlled counterpart and
 * participant belief).
 */

import { use } from "react";
import { useParticipant } from "@/lib/participant-context";
import { isProxyCondition, sessionPlan } from "@/lib/assignment";
import { Page } from "@/components/ui";
import { BaselineSession } from "./baseline-session";
import { ProxySession } from "./proxy-session";

export default function SessionPage({
  params,
}: {
  params: Promise<{ index: string }>;
}) {
  const { index } = use(params);
  const sessionIndex = (Number(index) === 2 ? 2 : 1) as 1 | 2;
  const { assignment } = useParticipant();

  if (!assignment) {
    return (
      <Page>
        <p className="text-sm text-[var(--ink-2)]">Loading your session…</p>
      </Page>
    );
  }

  const plan = sessionPlan(assignment, sessionIndex);

  return isProxyCondition(plan.condition) ? (
    <ProxySession
      sessionIndex={sessionIndex}
      taskId={plan.taskId}
      role={assignment.role}
      policy={plan.condition === "explorer" ? "explorer" : "delegate"}
    />
  ) : (
    <BaselineSession
      sessionIndex={sessionIndex}
      taskId={plan.taskId}
      role={assignment.role}
    />
  );
}
