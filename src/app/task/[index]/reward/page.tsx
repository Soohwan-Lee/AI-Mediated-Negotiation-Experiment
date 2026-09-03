"use client";

/**
 * The reward decision after one task (Experimental Design Ver.2.4 §8, §9.4.8).
 *
 * THE ONLY SCREEN THAT DIFFERS BY ROLE, and the asymmetry is the manipulation:
 * a Leader decides the Member's bonus for this task, and a Member receives one.
 * That is what makes the Leader's reward power real rather than asserted, and
 * POWER2 at the end of the study is the check that it landed.
 *
 * FOR THE LEADER this is a behavioural outcome (`BONUS`), not a survey item.
 * The instruction is fixed wording from §8 and names both the negotiation
 * result AND how the other person came across, because a bonus decided on
 * points alone would measure nothing about the interaction — which is the part
 * this study is about.
 *
 * FOR THE MEMBER THERE IS NO NUMBER. They see that a decision is being made,
 * and then the study moves on.
 *
 * This replaces a fixed 70/100 presented as the Leader's judgement, and it is
 * a better design in three separate ways.
 *
 *  - It removes a deception rather than managing one. A constant dressed as a
 *    judgement had to be disclosed at `/debriefing`; there is now nothing to
 *    disclose except that the counterpart was not a person, which is disclosed
 *    anyway. (Members are still told explicitly that no bonus decision was
 *    made about them, because the waiting screen implies one was.)
 *  - It removes a tell. The same 70 arriving after two visibly different
 *    negotiations says the number is fixed, and a participant who notices that
 *    has noticed the study is not what it claims.
 *  - It removes a contaminant. A payout seen after Task 1 is a response the
 *    Task 2 measures would pick up; the whole reason the number had to be
 *    constant was to stop it varying, and not showing one stops it entirely.
 *
 * WHAT THE WAIT IS STILL DOING. POWER3 asks whether outcomes that mattered
 * depended on the other person's decisions, and it is the Member-side half of
 * gate 2's manipulation check. Waiting while someone else decides your bonus
 * IS that experience — the number was never what made the power real, the
 * dependence was. The Leader's actual choice is still recorded as `BONUS`; it
 * simply never travels to the Member.
 */

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ActionBar } from "@/components/study-chrome";
import {
  AmountScale,
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
  requiredIds,
} from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { getTask } from "@/lib/tasks";
import { NEGOTIATION, STUDY, nextHref, pauseMs } from "@/lib/study-config";

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
  /** Member: the upward evaluation, then the wait. */
  const [evalAnswers, setEvalAnswers] = useState<Answers>({});
  const [evalSubmitted, setEvalSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const isLeader = assignment?.role === "leader";
  const plan = assignment ? sessionPlan(assignment, taskIndex) : null;
  const task = plan ? getTask(plan.taskId) : null;

  // The Member's wait starts only after their evaluation is in — the §7
  // order is RECV-EVAL first, then "the Leader is deciding…".
  useEffect(() => {
    if (isLeader || !assignment || !evalSubmitted) return;
    const id = window.setTimeout(
      () => setRevealed(true),
      pauseMs(NEGOTIATION.matchmakingMs),
    );
    return () => window.clearTimeout(id);
  }, [isLeader, assignment, evalSubmitted]);

  const evalBlock = blockForTask(RECV_EVAL_BLOCK, taskIndex);
  const evalRequired = requiredIds(evalBlock);
  const evalMissing = evalRequired.filter((id) => evalAnswers[id] === undefined);

  useDevAutofill(() => {
    setAmount(70);
    const filled: Answers = {};
    for (const item of evalBlock.items) filled[item.id] = dummyAnswer(item);
    setEvalAnswers((prev) => ({ ...prev, ...filled }));
  }, `reward-${taskIndex}`);

  const canContinue = useDevGate(isLeader ? amount !== null : revealed);
  const canSubmitEval = useDevGate(evalMissing.length === 0);

  async function submitEval() {
    if (!canSubmitEval) return;
    if (participantKey) {
      await getStore().saveResponses(
        participantKey,
        `recv_eval_t${taskIndex}`,
        evalAnswers,
      );
    }
    logEvent("reward_decision", { kind: "recv_eval" }, {
      sessionIndex: taskIndex,
    });
    setEvalSubmitted(true);
    window.scrollTo({ top: 0 });
  }

  async function save() {
    if (!canContinue) return;
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
    router.push(nextHref(flowKey));
  }

  if (!assignment) {
    return (
      <Page>
        <p className="text-sm text-[var(--ink-2)]">Loading…</p>
      </Page>
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
                👑 Manager Decision · Task {taskIndex}
              </span>
              <span className="text-xs font-bold text-slate-500">
                Bonus Allocation
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--ink)]">
              💰 Decide the Member&apos;s Bonus
            </h1>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-700 font-medium">
              As the team lead, you decide the recommended performance bonus
              for the Member for this task. Please consider the negotiation
              result <strong>together with what you learned during the
              negotiation about their work reliability and availability</strong>.
            </p>
          </Card>

          <Card className="mb-6 border-slate-200" id={`q-${BONUS_ITEM.id}`}>
            <CardTitle hint={bonusUnit}>{BONUS_ITEM.text}</CardTitle>
            <div className="mt-3">
              <AmountScale
                id={`BONUS_t${taskIndex}`}
                value={amount}
                onChange={setAmount}
                step={5}
              />
            </div>
            {awarded !== null ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Allocated Bonus Amount
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

          <Callout title="ℹ️ Independent Allocation" tone="neutral">
            <p>
              This is your independent decision as Leader. Awarded bonuses are added directly to the participant&apos;s Prolific compensation.
            </p>
          </Callout>
        </Page>

        <ActionBar
          label="Confirm Bonus Allocation"
          onClick={save}
          disabled={!canContinue}
          remaining={amount === null ? 1 : 0}
          firstUnansweredId={amount === null ? `BONUS_t${taskIndex}` : null}
          note={amount === null ? "⚠️ Please select a bonus percentage." : "✓ Ready to confirm"}
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
              Evaluate the Manager
            </h1>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-700 font-medium">
              Please write your evaluation of the manager, considering{" "}
              <strong>the judgement and operational competence you saw during
              the negotiation</strong>. It will be passed to the district
              manager.
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
          disabled={!canSubmitEval}
          remaining={evalMissing.length}
          firstUnansweredId={evalMissing[0] ?? null}
          note={evalMissing.length === 0 ? "✓ Ready to submit" : ""}
        />
      </>
    );
  }

  return (
    <>
      <Page>
        {!revealed ? (
          <div className="flex min-h-[45vh] flex-col items-center justify-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-2xl shadow-sm">
              ⏳
            </div>
            <span aria-hidden className="mb-4 inline-flex gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2.5 w-2.5 animate-bounce rounded-full bg-[var(--accent)]"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
            <p className="text-lg sm:text-xl font-bold text-slate-900">
              The manager is deciding your performance bonus…
            </p>
            <p className="mt-2 max-w-prose text-xs sm:text-sm text-slate-600">
              They were asked to consider the negotiation result together with
              what they learned during the negotiation.
            </p>
          </div>
        ) : (
          <Card className="mb-6 border-slate-200 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-900">
                ✓ Recorded
              </span>
            </div>
            <CardTitle hint={`Task ${taskIndex} of 2`}>
              Decision Submitted
            </CardTitle>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-700 font-medium">
              The manager has submitted their bonus decision for Task {taskIndex}.
              Any awarded bonus is added to your Prolific payment once the whole
              study concludes.
            </p>
          </Card>
        )}
      </Page>

      <ActionBar
        label="Continue to Next Step"
        onClick={save}
        disabled={!canContinue}
        note={revealed ? "✓ Ready to proceed" : "Waiting for the decision…"}
      />
    </>
  );
}
