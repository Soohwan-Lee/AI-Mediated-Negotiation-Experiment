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
import { isProxyCondition, sessionPlan } from "@/lib/assignment";
import { useDevMode } from "@/lib/dev-mode";
import { readCheckGate, readStopReason } from "@/lib/check-gates";
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
  const [gateReady, setGateReady] = useState(false);

  useEffect(() => {
    if (!assignment || !participantKey) return;
    if (process.env.NODE_ENV !== "production" && devEnabled) {
      const id = window.setTimeout(() => setGateReady(true), 0);
      return () => window.clearTimeout(id);
    }

    const stopped = readStopReason(participantKey);
    if (stopped) {
      router.replace(`/study-stop?reason=${stopped}`);
      return;
    }

    const common = readCheckGate(participantKey, "common");
    const practice = readCheckGate(participantKey, `task-${taskIndex}`);
    if (common.status === "failed" || practice.status === "failed") {
      router.replace("/study-stop?reason=check");
      return;
    }
    if (common.status !== "passed") {
      writeFurthest(flowIndex("instruction"));
      router.replace("/instruction");
      return;
    }
    if (practice.status !== "passed") {
      const practiceKey = taskIndex === 1 ? "practice" : "practice-2";
      writeFurthest(flowIndex(practiceKey));
      router.replace(`/practice/${taskIndex}`);
      return;
    }
    const id = window.setTimeout(() => setGateReady(true), 0);
    return () => window.clearTimeout(id);
  }, [assignment, devEnabled, participantKey, router, taskIndex]);

  if (!assignment || !gateReady) {
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
