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
 *
 * IT IS PAGINATED, AND ONLY FORWARDS. As one screen this ran to about
 * twenty-five rating items plus seven required free-text answers for a Proxy
 * task, twice over — five screens of scrolling, which is where a paid worker
 * starts straight-lining the scale and typing "n/a". The split is at BLOCK
 * boundaries, so the §9.4 order is untouched: a part is a run of whole blocks
 * in the same fixed sequence, never a reshuffle.
 *
 * There is no way back between parts, and that is the same rule as the order
 * itself. The AI-Proxy blocks come last so that being asked about the other
 * side's proxy cannot colour the answers about the other side; letting someone
 * page back and revise their earlier answers after reading them would undo
 * exactly that.
 *
 * ONE ROUTE, so the progress bar still comes from the URL alone (Interface
 * rule 3) — the part index is component state and never a flow step.
 */

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { MeasureBlock, type Answers } from "@/components/measure";
import { ActionBar } from "@/components/study-chrome";
import { Card, Page } from "@/components/ui";
import { isProxyCondition, sessionPlan } from "@/lib/assignment";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import {
  blockForTask,
  dummyAnswer,
  m1Item,
  openEndedBlock,
  postTaskBlocks,
  requiredIds,
  type Block,
} from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { useRestoreAnswers } from "@/lib/saved-answers";
import { getStore } from "@/lib/store";
import { getTask } from "@/lib/tasks";
import { nextHref } from "@/lib/study-config";

/**
 * Cuts the blocks into parts of roughly `softMax` items, never splitting a
 * block.
 *
 * The cap is soft on purpose: a block longer than it becomes a part of its own
 * rather than being broken up, because a block is one instrument with one
 * response scale and one hint row. Overshooting by a few items costs a little
 * scrolling; splitting a scale across a page break costs the scale.
 */
function groupIntoParts(blocks: Block[], softMax: number): Block[][] {
  const parts: Block[][] = [];
  let currentPart: Block[] = [];
  let count = 0;
  for (const block of blocks) {
    if (currentPart.length > 0 && count + block.items.length > softMax) {
      parts.push(currentPart);
      currentPart = [];
      count = 0;
    }
    currentPart.push(block);
    count += block.items.length;
  }
  if (currentPart.length > 0) parts.push(currentPart);
  return parts;
}

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
  // `null` until the participant (or a restore) settles on one — see the note
  // where it is resolved.
  const [part, setPart] = useState<number | null>(null);
  const [returning, setReturning] = useState(false);

  // Reachable again via Back from the bonus screen (BACK_STEPS), and every
  // answer is component state — without this the return trip lands on an empty
  // form and silently discards a five-minute battery (Interface rule 4).
  useRestoreAnswers(`post_task_t${taskIndex}`, (saved) => {
    setAnswers((cur) => ({ ...saved, ...cur }));
    setReturning(true);
  });

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
          // Baseline answers M1 retrospectively here (§9.3); a Proxy
          // participant answered it at the mandate, where the decision was
          // made.
          ...(isProxy
            ? []
            : [
                {
                  id: "m1",
                  title: "One more question",
                  items: [m1Item("baseline")],
                } satisfies Block,
              ]),
        ].map((b) => blockForTask(b, taskIndex))
      : [];

  // Whole blocks, in the §9.4 order, cut into runs of at most this many items.
  // Splitting inside a block would separate a scale from its own hint row.
  const parts = groupIntoParts(blocks, 12);

  // COMING BACK LANDS ON THE LAST PART, not the first. Back from the bonus
  // screen remounts this page, so a part index starting at 0 would put the
  // participant on "Part 1 of 3" with every answer restored, a full form and a
  // "Next" button — three screens of already-answered questions to click
  // through to get out. Some would re-read and re-answer, which is the one
  // thing this page cannot allow: those re-answers happen AFTER the bonus
  // screen, so a §9.4 item specified as a judgement about the negotiation
  // alone would pick up the reward as well.
  //
  // Derived during render rather than set from an effect: the landing part is
  // a function of "did we restore answers" and how many parts there are, and
  // an effect that set it would cascade a second render on every arrival.
  const activePart =
    part ?? (returning && parts.length > 0 ? parts.length - 1 : 0);

  const current = parts[Math.min(activePart, parts.length - 1)] ?? [];
  const isLastPart = activePart >= parts.length - 1;

  const required = current.flatMap(requiredIds);

  // KEYED ON THE PART. `useDevAutofill` fires once per key, so a key that did
  // not change between parts would fill the first and leave every later part
  // empty — the documented footgun in lib/dev-mode.
  useDevAutofill(() => {
    const filled: Answers = {};
    for (const block of current) {
      for (const item of block.items) filled[item.id] = dummyAnswer(item);
    }
    setAnswers((prev) => ({ ...prev, ...filled }));
  }, `task-survey-${taskIndex}-${activePart}`);

  const missing = required.filter((id) => answers[id] === undefined);
  const canContinue = useDevGate(missing.length === 0);

  async function save() {
    if (!canContinue) return;

    // Persist at every part boundary, not only at the end: a part that is
    // answered and left is data, and the restore above has nothing to read
    // otherwise.
    if (participantKey) {
      await getStore().saveResponses(
        participantKey,
        `post_task_t${taskIndex}`,
        answers,
      );
    }

    if (!isLastPart) {
      setPart(activePart + 1);
      window.scrollTo({ top: 0 });
      return;
    }

    logEvent("survey_saved", { block: `post_task_t${taskIndex}` }, {
      sessionIndex: taskIndex,
    });
    router.push(nextHref(flowKey));
  }

  if (!assignment || !task) {
    return (
      <Page>
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm font-semibold text-slate-500">Loading survey questions…</p>
        </div>
      </Page>
    );
  }

  return (
    <>
      <Page>
        <Card className="mb-6 border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/30">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-extrabold text-indigo-900 shadow-2xs">
              📝 Post-Task Survey · Task {taskIndex}
            </span>
            {parts.length > 1 ? (
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                Section {activePart + 1} of {parts.length}
              </span>
            ) : null}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--ink)]">
            How Did Task {taskIndex} Go?
          </h1>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-700 font-medium">
            Please share your honest impressions of the negotiation you just concluded. There are no right or wrong answers.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>⏱</span>
            <span>{current.reduce((n, b) => n + b.items.length, 0)} questions on this screen (~1–2 minutes)</span>
          </div>
        </Card>

        <div className="space-y-5">
          {current.map((block) => (
            <MeasureBlock
              key={block.id}
              block={block}
              answers={answers}
              onChange={(id, value) =>
                setAnswers((prev) => ({ ...prev, [id]: value }))
              }
            />
          ))}
        </div>
      </Page>

      <ActionBar
        label={isLastPart ? "Submit Survey & Continue" : "Next Section →"}
        onClick={save}
        disabled={!canContinue}
        remaining={missing.length}
        firstUnansweredId={missing[0] ?? null}
        note={missing.length === 0 ? "✓ All questions answered" : ""}
      />
    </>
  );
}
