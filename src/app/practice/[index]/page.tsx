"use client";

/**
 * Practice router.
 *
 * Like the task router, the URL carries only the INDEX. Which arm the round
 * rehearses is resolved from the participant's assignment, so the address bar
 * cannot leak the design ("Things the participant must never learn" #2): a
 * participant who reads `/practice/2` learns which task is next and nothing
 * about which condition either task is.
 */

import { use } from "react";
import { sessionFingerprint } from "@/lib/assignment";
import { useParticipant } from "@/lib/participant-context";
import { PracticeRound } from "./practice-round";

export default function PracticePage({
  params,
}: {
  params: Promise<{ index: string }>;
}) {
  const { index } = use(params);
  const taskIndex = (Number(index) === 2 ? 2 : 1) as 1 | 2;
  const { assignment } = useParticipant();
  const fingerprint = assignment
    ? sessionFingerprint(assignment, taskIndex)
    : `practice-${taskIndex}-loading`;
  return <PracticeRound key={fingerprint} taskIndex={taskIndex} />;
}
