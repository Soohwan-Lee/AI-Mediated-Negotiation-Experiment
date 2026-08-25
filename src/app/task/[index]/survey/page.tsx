"use client";

/**
 * The questions that follow one task (Experimental Design Ver.2.4 §9.4).
 *
 * WHY THIS IS PER-TASK AND NOT AT THE END. Every item here is a judgement
 * about ONE negotiation — how it felt to ask, how the other person came
 * across, what their AI Proxy was like. Asked after a second, differently
 * conditioned negotiation, a single answer would blend the two conditions and
 * the within-participant contrast would be unrecoverable.
 *
 * THE ORDER OF THE BLOCKS IS FIXED by §9.4 and is not a layout choice: PERC,
 * then the counterpart, then process, then outcome, and only then the two AI
 * blocks. Asking about the other side's AI Proxy before asking about the other
 * side would tell the participant what to notice about them.
 *
 * Item ids are suffixed `_t1` / `_t2`. The same construct measured after two
 * differently conditioned tasks is two observations, not one, and they cannot
 * share a column.
 */

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { MeasureBlock, type Answers } from "@/components/measure";
import { ActionBar } from "@/components/study-chrome";
import { Card, CardTitle, Page } from "@/components/ui";
import { isProxyCondition, sessionPlan } from "@/lib/assignment";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import {
  blockForTask,
  dummyAnswer,
  openEndedBlock,
  postTaskBlocks,
  requiredIds,
  type Block,
} from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { getTask } from "@/lib/tasks";
import { nextHref } from "@/lib/study-config";

export default function TaskSurveyPage({
  params,
}: {
  params: Promise<{ index: string }>;
}) {
  const { index } = use(params);
  const taskIndex = (Number(index) === 2 ? 2 : 1) as 1 | 2;
  const flowKey = taskIndex === 1 ? "survey-1" : "survey-2";
  usePageEnter(flowKey);

  const router = useRouter();
  const { assignment, participantKey, logEvent } = useParticipant();
  const [answers, setAnswers] = useState<Answers>({});

  const plan = assignment ? sessionPlan(assignment, taskIndex) : null;
  const isProxy = plan ? isProxyCondition(plan.condition) : false;
  const task = plan ? getTask(plan.taskId) : null;

  const blocks: Block[] =
    assignment && task && plan
      ? [
          ...postTaskBlocks(isProxy),
          // The open-ended set depends on the CONDITION, not just proxy-ness:
          // the Explorer's two extra questions (OE-P6/P7) are the only data
          // source that separates its policy's two elements (Design §9.4.7).
          openEndedBlock(task, assignment.role, plan.condition),
        ].map((b) => blockForTask(b, taskIndex))
      : [];

  const required = blocks.flatMap(requiredIds);

  useDevAutofill(() => {
    const filled: Answers = {};
    for (const block of blocks) {
      for (const item of block.items) filled[item.id] = dummyAnswer(item);
    }
    setAnswers(filled);
  }, `task-survey-${taskIndex}-${blocks.length}`);

  const missing = required.filter((id) => answers[id] === undefined);
  const canContinue = useDevGate(missing.length === 0);

  async function save() {
    if (!canContinue) return;
    if (participantKey) {
      await getStore().saveResponses(
        participantKey,
        `post_task_t${taskIndex}`,
        answers,
      );
    }
    logEvent("survey_saved", { block: `post_task_t${taskIndex}` }, {
      sessionIndex: taskIndex,
    });
    router.push(nextHref(flowKey));
  }

  if (!assignment || !task) {
    return (
      <Page>
        <p className="text-sm text-[var(--ink-2)]">Loading…</p>
      </Page>
    );
  }

  return (
    <>
      <Page>
        <Card className="mb-6">
          <CardTitle hint="These are about the negotiation you just finished — not about the study as a whole.">
            📝 A few questions about Task {taskIndex}
          </CardTitle>
          <p className="prose-study text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            There are no right answers. Answer for how it actually went, not how
            you think it should have gone.
          </p>
          {/* Sets the length expectation up front. This page is the longest
              single screen in the study; arriving on it blind is where a
              tired participant starts straight-lining, and knowing the size
              of the ask is the cheapest thing that helps. */}
          <p className="mt-2 text-[0.8125rem] text-[var(--ink-3)]">
            {blocks.reduce((n, b) => n + b.items.length, 0)} questions —
            usually 4–5 minutes.
          </p>
        </Card>

        {blocks.map((block) => (
          <MeasureBlock
            key={block.id}
            block={block}
            answers={answers}
            onChange={(id, value) =>
              setAnswers((prev) => ({ ...prev, [id]: value }))
            }
          />
        ))}
      </Page>

      <ActionBar
        label="Continue"
        onClick={save}
        disabled={!canContinue}
        remaining={missing.length}
        firstUnansweredId={missing[0] ?? null}
        note={missing.length === 0 ? "All answered." : ""}
      />
    </>
  );
}
