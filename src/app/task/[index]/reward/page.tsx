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
import { sessionPlan } from "@/lib/assignment";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { BONUS_ITEM } from "@/lib/measures";
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
  const [revealed, setRevealed] = useState(false);

  const isLeader = assignment?.role === "leader";
  const plan = assignment ? sessionPlan(assignment, taskIndex) : null;
  const task = plan ? getTask(plan.taskId) : null;

  // The Member's wait while "the other participant decides" (Design §8).
  useEffect(() => {
    if (isLeader || !assignment) return;
    const id = window.setTimeout(
      () => setRevealed(true),
      pauseMs(NEGOTIATION.matchmakingMs),
    );
    return () => window.clearTimeout(id);
  }, [isLeader, assignment]);

  useDevAutofill(() => setAmount(70), `reward-${taskIndex}`);

  const canContinue = useDevGate(isLeader ? amount !== null : revealed);

  async function save() {
    if (!canContinue) return;
    if (participantKey) {
      await getStore().saveResponses(participantKey, `reward_t${taskIndex}`, {
        role: assignment?.role ?? null,
        taskId: task?.id ?? null,
        // Only the Leader's value is data. The Member's is a stimulus, stored
        // so the export can show what they were told.
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
          <Card className="mb-5">
            <CardTitle hint={`Task ${taskIndex} of 2`}>
              💰 Your bonus decision
            </CardTitle>
            <p className="prose-study text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
              As the Leader on this project, you decide the bonus the other
              participant receives for this task. Weigh up not only how the
              negotiation turned out, but also how they conducted themselves
              during it.
            </p>
          </Card>

          <Card className="mb-5" id={`q-${BONUS_ITEM.id}`}>
            <CardTitle hint={bonusUnit}>{BONUS_ITEM.text}</CardTitle>
            <AmountScale
              id={`BONUS_t${taskIndex}`}
              value={amount}
              onChange={setAmount}
              step={5}
            />
            {awarded !== null ? (
              <p className="mt-4 text-[0.875rem] text-[var(--ink-2)]">
                That is{" "}
                <strong className="text-[var(--ink)]">
                  {STUDY.currencySymbol}
                  {awarded}
                </strong>{" "}
                of the {STUDY.currencySymbol}
                {STUDY.bonusPerTask} available for this task.
              </p>
            ) : null}
          </Card>

          <Callout>
            <p>
              This is your decision alone. It is applied to their payment for
              this task.
            </p>
          </Callout>
        </Page>

        <ActionBar
          label="Confirm this bonus"
          onClick={save}
          disabled={!canContinue}
          remaining={amount === null ? 1 : 0}
          firstUnansweredId={amount === null ? `BONUS_t${taskIndex}` : null}
          note={amount === null ? "Choose an amount." : ""}
        />
      </>
    );
  }

  // --- Member: wait, then move on ------------------------------------------
  //
  // The wait is the whole screen. What a Member experiences here is that
  // something of theirs is in someone else's hands — which is what POWER3
  // asks about — and then the study continues without telling them the
  // outcome. No figure is shown at any point.
  return (
    <>
      <Page>
        {!revealed ? (
          <div className="flex min-h-[45vh] flex-col items-center justify-center text-center">
            <span aria-hidden className="mb-5 inline-flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)]"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
            <p className="text-[1.0625rem] font-semibold">
              The other participant is deciding your bonus…
            </p>
            <p className="mt-1.5 max-w-prose text-[0.875rem] text-[var(--ink-2)]">
              They are the Leader on this project, so this decision is theirs.
            </p>
          </div>
        ) : (
          <Card className="mb-5">
            <CardTitle hint={`Task ${taskIndex} of 2`}>
              💰 Their decision is in
            </CardTitle>
            <p className="prose-study text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
              The Leader has decided your bonus for this task. Bonuses are added
              to your Prolific payment once the study closes, so there is
              nothing to do with it now.
            </p>
          </Card>
        )}
      </Page>

      <ActionBar
        label="Continue"
        onClick={save}
        disabled={!canContinue}
        note={revealed ? "" : "Waiting for their decision."}
      />
    </>
  );
}
