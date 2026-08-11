"use client";

/**
 * Simulated reward decision (Methods §8).
 *
 * Leader: allocates a scenario bonus to the counterpart.
 * Member: is shown a standardized decision presented as the Leader's.
 *
 * This is a scenario-level consequence of the power manipulation. It does NOT
 * affect anyone's actual Prolific payment — for the Member this is the
 * deception that /debriefing must explicitly undo (Methods §9).
 *
 * The Member-facing amount is standardized across participants; the exact
 * value and presentation are fixed after pilot and preregistered.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { nextHref, stepNumber } from "@/lib/study-config";
import {
  Button,
  Card,
  Field,
  Likert,
  PageHeader,
  PageShell,
  ProgressBar,
  Slider,
  TextArea,
} from "@/components/ui";

/** PLACEHOLDER — fix after pilot and preregister. */
const SCENARIO_BONUS_POOL = 100;
const STANDARDIZED_MEMBER_AWARD = 60;

export default function RewardPage() {
  usePageEnter("reward");
  const router = useRouter();
  const { assignment, saveResponses, logEvent } = useParticipant();
  const [allocation, setAllocation] = useState(50);
  const [rationale, setRationale] = useState("");
  const [fairness, setFairness] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const isLeader = assignment?.role === "leader";

  useDevAutofill(() => {
    setFairness(4);
    setRationale("[dev] placeholder");
  });

  const canContinue = useDevGate(fairness !== null);

  async function handleNext() {
    setBusy(true);
    try {
      await saveResponses("reward_decision", {
        role: assignment?.role ?? null,
        allocation: isLeader ? allocation : STANDARDIZED_MEMBER_AWARD,
        rationale,
        fairness,
      });
      logEvent("reward_decision", {
        role: assignment?.role,
        allocation: isLeader ? allocation : STANDARDIZED_MEMBER_AWARD,
      });
      router.push(nextHref("reward"));
    } finally {
      setBusy(false);
    }
  }

  const { step, total } = stepNumber("reward");

  return (
    <PageShell>
      <ProgressBar step={step} total={total} label="Reward decision" />

      {isLeader ? (
        <>
          <PageHeader
            title="Your reward decision"
            subtitle="As the Project Leader, you decide how the scenario bonus is allocated."
          />
          <Card className="mb-6">
            <p className="mb-6 text-sm text-[var(--muted)]">
              A discretionary bonus pool of {SCENARIO_BONUS_POOL} points is
              available for this project. Decide how many points to award to the
              Team Member based on your assessment of their contribution.
            </p>

            <Field label="Points awarded to the Team Member" required>
              <Slider
                value={allocation}
                onChange={setAllocation}
                min={0}
                max={SCENARIO_BONUS_POOL}
                lowAnchor="0"
                highAnchor={String(SCENARIO_BONUS_POOL)}
              />
            </Field>

            <Field label="Briefly, what is the basis for your decision?">
              <TextArea
                value={rationale}
                onChange={setRationale}
                rows={3}
                placeholder="1–2 sentences."
              />
            </Field>
          </Card>
        </>
      ) : (
        <>
          <PageHeader
            title="The Project Leader's decision"
            subtitle="The Project Leader has made their reward decision regarding your contribution."
          />
          <Card className="mb-6">
            <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center">
              <p className="text-xs uppercase tracking-widest text-[var(--muted)]">
                Points awarded to you
              </p>
              <p className="mt-2 text-4xl font-semibold tabular-nums">
                {STANDARDIZED_MEMBER_AWARD}
                <span className="text-lg text-[var(--muted)]">
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
                placeholder="1–2 sentences."
              />
            </Field>
          </Card>
        </>
      )}

      <Card className="mb-8">
        <Likert
          id="reward_fairness"
          statement="This reward decision was fair."
          value={fairness}
          onChange={setFairness}
        />
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={busy || !canContinue}>
          {busy ? "Saving…" : "Continue"}
        </Button>
      </div>
    </PageShell>
  );
}
