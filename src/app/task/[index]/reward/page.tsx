"use client";

/**
 * Ver.2.23 post-task sequence: the Leader recommends £0–£0.50, or the Member
 * submits one upward-evaluation rating; then REMARK, ATTR, and the condition-
 * specific interpretation question follow. Recommendations are observed
 * scenario decisions. Actual participant payment is fixed and disclosed at
 * debriefing.
 */

import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { ActionBar } from "@/components/study-chrome";
import { TranscriptReview } from "@/components/transcript-review";
import {
  Callout,
  Card,
  CardTitle,
  Page,
} from "@/components/ui";
import { MeasureBlock, type Answers } from "@/components/measure";
import { sessionPlan } from "@/lib/assignment";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import {
  BONUS_ITEM,
  RECV_EVAL_BLOCK,
  blockForTask,
  dummyAnswer,
  postCommentOpenBlocks,
  requiredIds,
} from "@/lib/measures";
import { RemarkPhase } from "../remark";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { getTask } from "@/lib/tasks";
import { STUDY, nextHref } from "@/lib/study-config";
import { restoredSurveyPart, surveyComplete } from "@/lib/survey-progress";

export default function TaskRewardPage({
  params,
}: {
  params: Promise<{ index: string }>;
}) {
  const { index } = use(params);
  const taskIndex = (Number(index) === 2 ? 2 : 1) as 1 | 2;
  const flowKey = taskIndex === 1 ? "reward-1" : "reward-2";
  usePageEnter(flowKey);

  const router = useRouter();
  const { assignment, participantKey, logEvent } = useParticipant();
  const [amount, setAmount] = useState<number | null>(null);
  const [amountConfirmed, setAmountConfirmed] = useState(false);
  /** Member: the upward evaluation, then the wait. */
  const [evalAnswers, setEvalAnswers] = useState<Answers>({});
  const [evalSubmitted, setEvalSubmitted] = useState(false);
  /**
   * REMARK comes LAST on this screen (§6.8 rule 4): every confirmatory measure
   * — PERC, PCR, PNPQ, PNOQ, OWN/OTHER-AI, and the decision above — is already
   * recorded, so a mildly negative comment cannot contaminate any of them.
   */
  const [showRemark, setShowRemark] = useState(false);
  const [showOpenAnswer, setShowOpenAnswer] = useState(false);
  const [openAnswers, setOpenAnswers] = useState<Answers>({});
  const [restoredOpenAnswers, setRestoredOpenAnswers] = useState<Answers>({});
  const [openPart, setOpenPart] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [restored, setRestored] = useState(false);
  /**
   * Did this task reach a package? REMARK's opener differs — "glad we got
   * that sorted" would be false after an impasse — and nothing else about the
   * comment varies (§6.8 rule 1).
   *
   * Read from the outcome row the review screen already wrote, rather than
   * threaded through the flow: this page is a separate route, so the
   * negotiation state is long gone by the time it renders.
   */
  const [agreed, setAgreed] = useState(true);

  const isLeader = assignment?.role === "leader";
  const plan = assignment ? sessionPlan(assignment, taskIndex) : null;
  const task = plan ? getTask(plan.taskId) : null;
  const isProxy = plan ? plan.condition !== "direct" : false;
  const openBlocks = useMemo(
    () => postCommentOpenBlocks(isProxy).map((block) => blockForTask(block, taskIndex)),
    [isProxy, taskIndex],
  );

  useEffect(() => {
    if (!participantKey) return;
    let live = true;
    void getStore()
      .loadResponses(participantKey, `task_outcome_t${taskIndex}`)
      .then((row) => {
        if (live && row) setAgreed(row.outcome === "agreement");
      });
    return () => {
      live = false;
    };
  }, [participantKey, taskIndex]);

  useEffect(() => {
    if (!participantKey || !plan) return;
    let active = true;
    void Promise.all([
      getStore().loadResponses(participantKey, `reward_t${taskIndex}`),
      getStore().loadResponses(participantKey, `recv_eval_t${taskIndex}`),
      getStore().loadResponses(participantKey, `attr_t${taskIndex}`),
      getStore().loadResponses(participantKey, `post_comment_open_t${taskIndex}`),
    ]).then(([reward, evaluation, attr, open]) => {
      if (!active) return;
      if (open) {
        setOpenAnswers(open);
        setRestoredOpenAnswers(open);
        const complete = surveyComplete(openBlocks.map(requiredIds), open);
        if (complete) {
          router.replace(nextHref(flowKey));
          return;
        }
        setShowOpenAnswer(true);
      } else if (attr) {
        setShowOpenAnswer(true);
      } else if (reward || evaluation) {
        if (reward && typeof reward[`BONUS_t${taskIndex}`] === "number") {
          setAmount(reward[`BONUS_t${taskIndex}`] as number);
          setAmountConfirmed(true);
        }
        if (evaluation) {
          setEvalAnswers(evaluation);
          setEvalSubmitted(true);
        }
        setShowRemark(true);
      }
      setRestored(true);
    });
    return () => { active = false; };
  }, [flowKey, openBlocks, participantKey, plan, router, taskIndex]);

  const evalBlock = blockForTask(RECV_EVAL_BLOCK, taskIndex);
  const evalRequired = requiredIds(evalBlock);
  const evalMissing = evalRequired.filter((id) => evalAnswers[id] === undefined);

  useDevAutofill(() => {
    setAmount(70);
    const filled: Answers = {};
    for (const item of evalBlock.items) filled[item.id] = dummyAnswer(item);
    setEvalAnswers((prev) => ({ ...prev, ...filled }));
  }, `reward-${taskIndex}`);

  const canContinue = useDevGate(isLeader ? amount !== null && amountConfirmed : evalSubmitted);
  const canSubmitEval = useDevGate(evalMissing.length === 0);

  async function submitEval() {
    if (!canSubmitEval || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      if (participantKey) {
        await getStore().saveResponses(participantKey, `recv_eval_t${taskIndex}`, evalAnswers);
      }
      logEvent("reward_decision", { kind: "recv_eval" }, { sessionIndex: taskIndex });
      setEvalSubmitted(true);
      setShowRemark(true);
      window.scrollTo({ top: 0 });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  /** The decision is recorded first, then REMARK is shown (§6.8 rule 4). */
  async function save() {
    if (!canContinue || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await persistDecision();
      setShowRemark(true);
      window.scrollTo({ top: 0 });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function persistDecision() {
    if (participantKey) {
      await getStore().saveResponses(participantKey, `reward_t${taskIndex}`, {
        role: assignment?.role ?? null,
        taskId: task?.id ?? null,
        // Only the Leader's value is data on this screen; the Member's
        // RECV-EVAL was saved when they submitted it.
        [`BONUS_t${taskIndex}`]: isLeader ? amount : null,
      });
    }
    logEvent(
      "reward_decision",
      { amount: isLeader ? amount : null, decided: isLeader },
      { sessionIndex: taskIndex },
    );
  }

  async function finishRemark(answers: Answers) {
    if (participantKey) {
      await getStore().saveResponses(
        participantKey,
        `attr_t${taskIndex}`,
        answers,
      );
    }
    setOpenPart(0);
    setShowOpenAnswer(true);
    window.scrollTo({ top: 0 });
  }

  const restoredOpenPart = restoredSurveyPart(
    openBlocks.map((block) => requiredIds(block)),
    restoredOpenAnswers,
  );
  const activeOpenPart = openPart ?? restoredOpenPart;
  const openBlock = openBlocks[activeOpenPart] ?? openBlocks[0];
  const openMissing = requiredIds(openBlock).filter((id) => openAnswers[id] === undefined || openAnswers[id] === "");
  const canSubmitOpen = useDevGate(openMissing.length === 0);

  useDevAutofill(() => {
    if (!showOpenAnswer) return;
    setOpenAnswers((previous) => ({
      ...previous,
      ...Object.fromEntries(openBlock.items.map((item) => [item.id, dummyAnswer(item)])),
    }));
  }, `reward-open-${taskIndex}-${showOpenAnswer}-${activeOpenPart}`);

  async function finishOpenAnswer() {
    if (!canSubmitOpen || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      if (participantKey) {
        await getStore().saveResponses(participantKey, `post_comment_open_t${taskIndex}`, openAnswers);
      }
      if (activeOpenPart < openBlocks.length - 1) {
        setOpenPart(activeOpenPart + 1);
        window.scrollTo({ top: 0 });
        return;
      }
      router.push(nextHref(flowKey));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (!assignment || !restored) {
    return <Page><p className="text-sm text-[var(--ink-2)]">Loading…</p></Page>;
  }

  if (showOpenAnswer) {
    return (
      <>
        <Page>
          <TranscriptReview participantKey={participantKey} taskIndex={taskIndex} />
          <MeasureBlock block={openBlock} answers={openAnswers} onChange={(id, value) => setOpenAnswers((previous) => ({ ...previous, [id]: value }))} />
        </Page>
        <ActionBar label={activeOpenPart < openBlocks.length - 1 ? "Next" : "Submit & Continue"} onClick={finishOpenAnswer} busy={busy} disabled={!canSubmitOpen} remaining={openMissing.length} firstUnansweredId={openMissing[0] ?? null} />
      </>
    );
  }

  if (showRemark) {
    return (
      <RemarkPhase
        taskIndex={taskIndex}
        isProxy={isProxy}
        agreed={agreed}
        onDone={finishRemark}
      />
    );
  }

  // `BONUS_ITEM` is an `Item` union, so `unit` is only present on the `amount`
  // variant. Narrowing here rather than casting keeps the item's shape the
  // single source of truth for its own wording.
  const bonusUnit = BONUS_ITEM.kind === "amount" ? BONUS_ITEM.unit : undefined;

  // --- Leader: decide -------------------------------------------------------
  if (isLeader) {
    const awarded =
      amount === null
        ? null
        : ((amount / 100) * Number(STUDY.bonusPerTask)).toFixed(2);

    return (
      <>
        <Page>
          <Card className="mb-6 border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/20">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-900 shadow-2xs">
                👑 Team Lead Decision · Task {taskIndex}
              </span>
              <span className="text-xs font-bold text-slate-500">
                Bonus Recommendation
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--ink)]">
              💰 Recommend the Member&apos;s Bonus
            </h1>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-700 font-medium">
              As the team lead, you recommend a bonus
              for this task. Please consider not only the negotiation result
              but <strong>the negotiation as a whole, and whether you would
              want to work with this person again</strong>.
            </p>
          </Card>

          <Card className="mb-6 border-slate-200" id={`q-${BONUS_ITEM.id}`}>
            <CardTitle hint={bonusUnit}>{BONUS_ITEM.text}</CardTitle>
            <div className="mt-5">
              <label htmlFor={`BONUS_t${taskIndex}`} className="sr-only">
                Bonus percentage from 0 to 100
              </label>
              <input
                id={`BONUS_t${taskIndex}`}
                type="range"
                min={0}
                max={100}
                step={1}
                value={amount ?? 0}
                onChange={(event) => {
                  setAmount(Number(event.target.value));
                  setAmountConfirmed(false);
                }}
                className="w-full accent-[var(--accent)]"
                aria-valuetext={amount === null ? "No value selected" : `${STUDY.currencySymbol}${awarded}`}
              />
              <div className="mt-2 flex justify-between text-xs font-semibold text-[var(--ink-3)]">
                <span>{STUDY.currencySymbol}0.00</span>
                <span>{STUDY.currencySymbol}{STUDY.bonusPerTask}</span>
              </div>
              {amount === null ? (
                <button
                  type="button"
                  onClick={() => setAmount(0)}
                  className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-[var(--accent)]"
                >
                  Choose {STUDY.currencySymbol}0.00
                </button>
              ) : null}
            </div>
            {awarded !== null ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Recommended Bonus Amount
                </p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono my-1">
                  {STUDY.currencySymbol}{awarded}
                </p>
                <p className="text-xs text-emerald-700">
                  out of {STUDY.currencySymbol}{STUDY.bonusPerTask} maximum available for Task {taskIndex}
                </p>
              </div>
            ) : null}
          </Card>

          <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">
            <input
              type="checkbox"
              checked={amountConfirmed}
              disabled={amount === null}
              onChange={(event) => setAmountConfirmed(event.target.checked)}
              className="mt-0.5 h-5 w-5 accent-[var(--accent)]"
            />
            <span>
              I intend to recommend {amount === null ? "the amount shown above" : `${STUDY.currencySymbol}${awarded}`} for this task.
            </span>
          </label>

          <Callout title="ℹ️ Independent Recommendation" tone="neutral">
            <p>
              This recommendation does not reduce your own payment.
            </p>
          </Callout>
        </Page>

        <ActionBar
          label="Confirm Bonus Recommendation"
          onClick={save}
          busy={busy}
          disabled={!canContinue}
          remaining={amount === null || !amountConfirmed ? 1 : 0}
          firstUnansweredId={amount === null ? `BONUS_t${taskIndex}` : null}
          note={amount === null ? "Choose a value, even if it is £0.00." : !amountConfirmed ? "Confirm the exact amount before continuing." : "Ready to confirm"}
        />
      </>
    );
  }

  // --- Member: evaluate the manager, then wait ------------------------------
  if (!evalSubmitted) {
    return (
      <>
        <Page>
          <Card className="mb-6 border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/20">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-900 shadow-2xs">
                📝 Upward Evaluation · Task {taskIndex}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--ink)]">
              Evaluate the Team Lead
            </h1>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-700 font-medium">
              Please provide your evaluation of the team lead, considering not
              only the negotiation result but <strong>the negotiation as a
              whole, and whether you would want to work with them
              again</strong>. It will be passed to the director.
            </p>
          </Card>

          <MeasureBlock
            block={evalBlock}
            answers={evalAnswers}
            onChange={(id, value) =>
              setEvalAnswers((prev) => ({ ...prev, [id]: value }))
            }
          />
        </Page>

        <ActionBar
          label="Submit Evaluation"
          onClick={submitEval}
          busy={busy}
          disabled={!canSubmitEval}
          remaining={evalMissing.length}
          firstUnansweredId={evalMissing[0] ?? null}
          note={evalMissing.length === 0 ? "✓ Ready to submit" : ""}
        />
      </>
    );
  }

  return <Page><p className="text-sm text-[var(--ink-2)]">Saving your evaluation…</p></Page>;
}
