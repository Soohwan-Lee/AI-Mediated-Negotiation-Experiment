"use client";

/**
 * Simulated reward decision (Methods ver.1.8 §Compensation and ethics).
 *
 * Leader: sees the per-session bonus allocations they already made and gives
 * one overall decision. Member: is shown a standardized decision presented as
 * the Leader's.
 *
 * WHY THIS IS NOT BONUS1. The receiver-side bonus item (Appendix D6) is asked
 * once per session, right after the negotiation it is a judgement about — that
 * is the measure. This page is the scenario-level consequence of the power
 * manipulation and, for the Member, the deception that /debriefing has to
 * undo. Asking the same question twice would produce two columns that mean
 * different things under one name, so the Leader's screen here says plainly
 * that it is the overall decision.
 *
 * This is a scenario-level consequence of the power manipulation. It does NOT
 * affect anyone's actual Prolific payment — for the Member this is the
 * deception that /debriefing must explicitly undo (Methods §9).
 *
 * The Member-facing amount is standardized across participants; the exact
 * value and presentation are fixed after pilot and preregistered.
 *
 * The allocation is a set of discrete amounts with none preselected. As a
 * slider it started at the midpoint, so "half the pool" was the reading for
 * both a considered even split and a participant who never touched the
 * control — two very different things landing in the same cell.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionBar, BackButton } from "@/components/study-chrome";
import {
  AmountScale,
  Card,
  CardTitle,
  Field,
  Page,
  PageHeader,
  Scale,
  TextArea,
} from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { useRestoreAnswers } from "@/lib/saved-answers";
import { nextHref } from "@/lib/study-config";

/** PLACEHOLDER — fix after pilot and preregister. */
const SCENARIO_BONUS_POOL = 100;
const STANDARDIZED_MEMBER_AWARD = 60;

export default function RewardPage() {
  usePageEnter("reward");
  const router = useRouter();
  const { assignment, saveResponses, logEvent } = useParticipant();
  const [allocation, setAllocation] = useState<number | null>(null);
  const [rationale, setRationale] = useState("");
  const [fairness, setFairness] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const isLeader = assignment?.role === "leader";

  // Left and re-entered via Back from here to the manipulation check.
  useRestoreAnswers("reward_decision", (saved) => {
    if (typeof saved.allocation === "number") setAllocation(saved.allocation);
    if (typeof saved.fairness === "number") setFairness(saved.fairness);
    if (typeof saved.rationale === "string") setRationale(saved.rationale);
  });

  useDevAutofill(() => {
    setFairness(4);
    setAllocation(50);
    setRationale("[dev] placeholder");
  });

  const complete = fairness !== null && (!isLeader || allocation !== null);
  const canContinue = useDevGate(complete);

  const awarded = isLeader ? (allocation ?? 0) : STANDARDIZED_MEMBER_AWARD;

  async function handleNext() {
    if (!canContinue) return;
    setBusy(true);
    try {
      await saveResponses("reward_decision", {
        role: assignment?.role ?? null,
        allocation: awarded,
        rationale,
        fairness,
      });
      logEvent("reward_decision", {
        role: assignment?.role,
        allocation: awarded,
      });
      router.push(nextHref("reward"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Page>
        {isLeader ? (
          <>
            <PageHeader
              eyebrow="Your authority in this scenario"
              title="Your reward decision"
              subtitle="As the Project Leader, you make the final call on the scenario bonus, taking both projects together."
            />

            <Card className="mb-5">
              <CardTitle
                hint={`A discretionary pool of ${SCENARIO_BONUS_POOL} points, across both projects.`}
              >
                Points awarded to the Team Member
              </CardTitle>

              <AmountScale
                id="allocation"
                value={allocation}
                onChange={setAllocation}
                max={SCENARIO_BONUS_POOL}
                step={10}
                unit={`out of ${SCENARIO_BONUS_POOL}, based on your assessment of their contribution`}
              />

              <div className="mt-6">
                <Field label="Briefly, what is your decision based on?">
                  <TextArea
                    value={rationale}
                    onChange={setRationale}
                    rows={3}
                    placeholder="A sentence or two."
                  />
                </Field>
              </div>
            </Card>
          </>
        ) : (
          <>
            <PageHeader
              eyebrow="The other party's decision"
              title="The Project Leader's reward decision"
              subtitle="The Project Leader has decided how the scenario bonus is split."
            />

            <Card className="mb-5">
              <div className="mb-6 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-muted)] py-8 text-center">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--ink-3)]">
                  Points awarded to you
                </p>
                <p className="tabular mt-2 text-5xl font-semibold">
                  {STANDARDIZED_MEMBER_AWARD}
                  <span className="text-xl font-normal text-[var(--ink-3)]">
                    {" "}
                    / {SCENARIO_BONUS_POOL}
                  </span>
                </p>
              </div>

              <Field label="How do you feel about this decision?">
                <TextArea
                  value={rationale}
                  onChange={setRationale}
                  rows={3}
                  placeholder="A sentence or two."
                />
              </Field>
            </Card>
          </>
        )}

        <Card>
          <Scale
            id="reward_fairness"
            statement="This reward decision was fair."
            value={fairness}
            onChange={setFairness}
            compact
          />
        </Card>
      </Page>

      <ActionBar
        label="Continue"
        onClick={handleNext}
        disabled={!canContinue}
        busy={busy}
        note={complete ? "" : "A rating is needed to continue."}
        secondary={<BackButton from="reward" />}
      />
    </>
  );
}
