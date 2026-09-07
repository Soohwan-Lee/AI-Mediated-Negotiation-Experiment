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
 * The one block that IS split is the free-text one, three questions to a page.
 * A rating block is kept whole because it is one instrument with one response
 * scale and one hint row; a written-answer block has neither, so nothing breaks
 * when it is cut, and seven essay boxes on one page is precisely the screen the
 * pagination exists to prevent. The order inside it is still untouched.
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
 * A written answer costs far more than a rating, so a block of them is capped
 * far lower than a block of scales.
 *
 * Three free-text boxes is about what fits on one screen without the last one
 * being answered from below the fold. Seven of them — the AI-Supplemented set —
 * on one page after a negotiation is where "two or three sentences" turns into
 * "n/a".
 */
const TEXT_ITEMS_PER_PART = 3;

/**
 * How many items a block may have and still share a page with the last
 * free-text slice before it. One page-turn for a single question (Direct's
 * M1, which follows the open-ended block) is worse than one extra choice row
 * under three text boxes.
 */
const TRAILING_JOIN_MAX = 2;

/** A block whose items are ALL free text, e.g. `open_ended`. */
function isTextBlock(block: Block): boolean {
  return (
    block.items.length > 0 && block.items.every((item) => item.kind === "text")
  );
}

/**
 * Cuts one all-text block into slices of at most `TEXT_ITEMS_PER_PART`, in
 * order, each carrying the block's own title and hint.
 *
 * The id is suffixed so React keys stay unique across the slices; nothing reads
 * a block id back, and the ITEM ids — which are the export's column names —
 * are untouched.
 */
function sliceTextBlock(block: Block): Block[] {
  const slices: Block[] = [];
  for (let i = 0; i < block.items.length; i += TEXT_ITEMS_PER_PART) {
    const items = block.items.slice(i, i + TEXT_ITEMS_PER_PART);
    const ids = new Set(items.map((item) => item.id));
    slices.push({
      ...block,
      id: `${block.id}__${slices.length + 1}`,
      items,
      // `optional` is an id list, so it has to be narrowed with the items or a
      // slice would count a neighbour's optional item as still outstanding.
      optional: block.optional?.filter((id) => ids.has(id)),
    });
  }
  return slices;
}

/**
 * Cuts the blocks into parts of roughly `softMax` items, never splitting a
 * RATING block.
 *
 * The cap is soft on purpose: a rating block longer than it becomes a part of
 * its own rather than being broken up, because a block is one instrument with
 * one response scale and one hint row. Overshooting by a few items costs a
 * little scrolling; splitting a scale across a page break costs the scale.
 *
 * AN ALL-TEXT BLOCK IS THE EXCEPTION and is split, at most
 * `TEXT_ITEMS_PER_PART` to a page, each page repeating the title and hint. It
 * has no shared response scale to break — every item is its own textarea with
 * its own prompt — so the reason the rest are kept whole does not apply, while
 * the reason for paginating at all applies to it hardest. It is also never
 * merged with a neighbouring block: a page mixing seven-point rows with essay
 * boxes reads as one is optional.
 *
 * Order is preserved exactly in both cases, so the fixed §9.4 sequence is
 * untouched and the page is still forward-only.
 */
function groupIntoParts(blocks: Block[], softMax: number): Block[][] {
  const parts: Block[][] = [];
  let currentPart: Block[] = [];
  let count = 0;

  const flush = () => {
    if (currentPart.length > 0) parts.push(currentPart);
    currentPart = [];
    count = 0;
  };

  for (const block of blocks) {
    if (isTextBlock(block)) {
      flush();
      const slices = sliceTextBlock(block);
      for (const slice of slices.slice(0, -1)) parts.push([slice]);
      // The LAST slice stays open, so a short block that follows — Direct's
      // one-item M1 — can ride on it instead of turning a page for a single
      // question. Anything longer than `TRAILING_JOIN_MAX` flushes as usual.
      currentPart = [slices[slices.length - 1]];
      count = softMax - TRAILING_JOIN_MAX;
      continue;
    }
    if (currentPart.length > 0 && count + block.items.length > softMax) flush();
    currentPart.push(block);
    count += block.items.length;
  }
  flush();
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
          // the AI-Supplemented's two extra questions (OE-P6/P7) are the only data
          // source that separates its policy's two elements (Design §9.4.7).
          openEndedBlock(task, assignment.role, plan.condition),
          // Direct answers M1 retrospectively here (§9.3); a Proxy
          // participant answered it at the mandate, where the decision was
          // made.
          ...(isProxy
            ? []
            : [
                {
                  id: "m1",
                  title: "One more question",
                  items: [m1Item("direct")],
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
