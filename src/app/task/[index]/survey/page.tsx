"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { MeasureBlock, type Answers } from "@/components/measure";
import { ActionBar } from "@/components/study-chrome";
import { TranscriptReview } from "@/components/transcript-review";
import { Card, Page } from "@/components/ui";
import { isProxyCondition, sessionPlan } from "@/lib/assignment";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import {
  PROXY_EXPERIENCE_BLOCKS,
  blockForTask,
  disclosureOpenBlock,
  dummyAnswer,
  experienceBlocks,
  requiredIds,
  type Block,
} from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { nextHref } from "@/lib/study-config";
import { restoredSurveyPart } from "@/lib/survey-progress";

export default function TaskSurveyPage({ params }: { params: Promise<{ index: string }> }) {
  const { index } = use(params);
  const taskIndex = (Number(index) === 2 ? 2 : 1) as 1 | 2;
  const flowKey = taskIndex === 1 ? "survey-1" : "survey-2";
  usePageEnter(flowKey);

  const router = useRouter();
  const { assignment, participantKey, logEvent } = useParticipant();
  const [answers, setAnswers] = useState<Answers>({});
  const [part, setPart] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [restoreReady, setRestoreReady] = useState(false);
  const [restoredAnswers, setRestoredAnswers] = useState<Answers>({});

  const plan = assignment ? sessionPlan(assignment, taskIndex) : null;
  const isProxy = plan ? isProxyCondition(plan.condition) : false;
  const rawParts: Block[][] = assignment
    ? [
        [experienceBlocks(assignment.role)[0]],
        [experienceBlocks(assignment.role)[1]],
        [experienceBlocks(assignment.role)[2]],
        ...(isProxy ? [PROXY_EXPERIENCE_BLOCKS] : []),
        [disclosureOpenBlock(isProxy)],
      ]
    : [];
  const parts = rawParts.map((blocks) => blocks.map((block) => blockForTask(block, taskIndex)));

  useEffect(() => {
    if (!participantKey) return;
    let active = true;
    void getStore().loadResponses(participantKey, `post_task_t${taskIndex}`).then((saved) => {
      if (!active) return;
      const snapshot = saved ?? {};
      setRestoredAnswers(snapshot);
      setAnswers((current) => ({ ...snapshot, ...current }));
      setRestoreReady(true);
    });
    return () => { active = false; };
  }, [participantKey, taskIndex]);

  const restoredPart = restoredSurveyPart(
    parts.map((page) => page.flatMap(requiredIds)),
    restoredAnswers,
  );
  const activePart = part ?? restoredPart;
  const current = restoreReady ? (parts[activePart] ?? []) : [];
  const isLast = activePart === parts.length - 1;
  const required = current.flatMap(requiredIds);
  const missing = required.filter((id) => answers[id] === undefined || answers[id] === "");
  const canContinue = useDevGate(missing.length === 0);

  useDevAutofill(() => {
    const filled: Answers = {};
    for (const block of current) {
      for (const item of block.items) filled[item.id] = dummyAnswer(item);
    }
    setAnswers((previous) => ({ ...previous, ...filled }));
  }, `task-survey-${taskIndex}-${restoreReady ? activePart : "loading"}`);

  async function save() {
    if (!canContinue || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      if (participantKey) {
        await getStore().saveResponses(participantKey, `post_task_t${taskIndex}`, answers);
      }
      if (!isLast) {
        setPart(activePart + 1);
        window.scrollTo({ top: 0 });
        return;
      }
      logEvent("survey_saved", { block: `post_task_t${taskIndex}` }, { sessionIndex: taskIndex });
      router.push(nextHref(flowKey));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (!assignment || !plan || !restoreReady) {
    return <Page><p className="text-sm text-[var(--ink-2)]">Loading survey questions…</p></Page>;
  }

  const showingOpenAnswer = current.some((block) => block.id.startsWith("disclosure_open"));
  const showingProxyExperience = current.some((block) => block.id.startsWith("own_ai"));

  return (
    <>
      <Page>
        <Card className="mb-6 border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/30">
          <p className="text-xs font-extrabold text-indigo-900">Task {taskIndex} · Section {activePart + 1} of {parts.length}</p>
          <h1 className="mt-2 text-xl font-black tracking-tight text-[var(--ink)] sm:text-2xl">
            {showingOpenAnswer ? "Your decision about sharing" : showingProxyExperience ? "Your experience with the AI Proxies" : "Your negotiation experience"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Please answer about the negotiation you just completed. There are no right or wrong answers.
          </p>
        </Card>

        {showingOpenAnswer ? (
          <TranscriptReview participantKey={participantKey} taskIndex={taskIndex} />
        ) : null}

        {current.map((block) => (
          <MeasureBlock
            key={block.id}
            block={block}
            answers={answers}
            onChange={(id, value) => setAnswers((previous) => ({ ...previous, [id]: value }))}
          />
        ))}
      </Page>

      <ActionBar
        label={isLast ? "Submit & Continue" : "Next Section"}
        onClick={save}
        busy={busy}
        disabled={!canContinue}
        remaining={missing.length}
        firstUnansweredId={missing[0] ?? null}
        note={missing.length === 0 ? "Ready to continue" : ""}
      />
    </>
  );
}
