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
 * FOR THE MEMBER the number shown is a CONSTANT, identical in every condition.
 * It has to be: a bonus that varied with the negotiation would contaminate
 * every measure that follows it, and the second task's answers would be a
 * response to the first task's payout. It is presented as the Leader's
 * judgement, which is a deception, and it is disclosed at `/debriefing`.
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

/**
 * What a Member is told they received, out of 100.
 *
 * A fixed value, the same for every participant in every condition. Set a
 * little above the midpoint so it reads as a reasonable outcome rather than as
 * a punishment or a windfall — either extreme would provoke a reaction that
 * the following task's measures would then be picking up. Pending pilot
 * (Design §12).
 */
const MEMBER_FIXED_BONUS = 70;

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
        shownToMember: isLeader ? null : MEMBER_FIXED_BONUS,
      });
    }
    logEvent(
      "reward_decision",
      { amount: isLeader ? amount : MEMBER_FIXED_BONUS, decided: isLeader },
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
    const dollars =
      amount === null
        ? null
        : ((amount / 100) * Number(STUDY.bonusPerTaskUsd)).toFixed(2);

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
            {dollars !== null ? (
              <p className="mt-4 text-[0.875rem] text-[var(--ink-2)]">
                That is <strong className="text-[var(--ink)]">${dollars}</strong>{" "}
                of the ${STUDY.bonusPerTaskUsd} available for this task.
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

  // --- Member: wait, then see ----------------------------------------------
  const dollars = (
    (MEMBER_FIXED_BONUS / 100) *
    Number(STUDY.bonusPerTaskUsd)
  ).toFixed(2);

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
          <>
            <Card className="mb-5">
              <CardTitle hint={`Task ${taskIndex} of 2`}>
                💰 Your bonus for this task
              </CardTitle>
              <p className="prose-study text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
                The Leader has decided your bonus for this task, taking into
                account both how the negotiation turned out and how you
                conducted yourself.
              </p>
            </Card>

            <Card className="mb-5">
              <div className="py-4 text-center">
                <p className="tabular text-[2.5rem] font-semibold leading-none">
                  {MEMBER_FIXED_BONUS}
                  <span className="text-[1.25rem] text-[var(--ink-3)]">
                    {" "}
                    / 100
                  </span>
                </p>
                <p className="mt-2 text-[0.9375rem] text-[var(--ink-2)]">
                  ${dollars} of the ${STUDY.bonusPerTaskUsd} available for this
                  task
                </p>
              </div>
            </Card>
          </>
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
