"use client";

/**
 * Phases shared by the Baseline and Proxy sessions.
 *
 * The initial-preference form is the baseline for Preference Displacement and
 * AI Settlement Adoption, so it must be captured BEFORE the participant sees
 * any counterpart offer or proxy transcript (Methods §Main Sessions). Nothing
 * on that screen may show the counterpart's position.
 *
 * The brief is the one phase that puts the briefing in the main column: it is
 * being read for the first time. From the next phase on it lives in the rail,
 * so it is never taken away.
 */

import { useState } from "react";
import { BriefingPanel, SessionHeader, SessionLayout } from "@/components/session";
import { OptionChips } from "@/components/issues";
import { ActionBar } from "@/components/study-chrome";
import {
  Callout,
  Card,
  CardTitle,
  Page,
  Scale,
} from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { useParticipant } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import type { NegotiationTask, Role } from "@/lib/types";

// ---------------------------------------------------------------------------
// Phase: scenario brief
// ---------------------------------------------------------------------------

export function SessionBrief({
  sessionIndex,
  task,
  role,
  steps,
  onContinue,
}: {
  sessionIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  onContinue: () => void;
}) {
  return (
    <>
      <Page width="wide">
        <SessionHeader
          sessionIndex={sessionIndex}
          title={task.title}
          steps={steps}
          current={0}
        />

        <Card className="mb-5">
          <CardTitle>The situation</CardTitle>
          {/* The scenario is read once and carefully, so it keeps a reading
              measure even though the session column is wide. */}
          <p className="max-w-prose text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            {task.publicBrief}
          </p>
          <p className="mt-3 text-[0.875rem] text-[var(--ink-3)]">
            Both sides can see this much. What follows is yours alone.
          </p>
        </Card>

        <BriefingPanel task={task} role={role} />
      </Page>

      <ActionBar
        label="I've read my briefing"
        onClick={onContinue}
        note="It stays available for the whole session."
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Phase: initial private preference
// ---------------------------------------------------------------------------

export function InitialPreferenceForm({
  sessionIndex,
  task,
  role,
  steps,
  onContinue,
}: {
  sessionIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  onContinue: () => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const [ideal, setIdeal] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState<Record<string, string>>({});
  const [importance, setImportance] = useState<Record<string, number>>({});
  const [confidence, setConfidence] = useState<number | null>(null);

  useDevAutofill(() => {
    setIdeal(
      Object.fromEntries(task.issues.map((i) => [i.id, i.options[0].id])),
    );
    setLimit(
      Object.fromEntries(
        task.issues.map((i) => [i.id, i.options[i.options.length - 1].id]),
      ),
    );
    setImportance(Object.fromEntries(task.issues.map((i) => [i.id, 4])));
    setConfidence(4);
  });

  const missing = [
    ...task.issues.filter((i) => !ideal[i.id]).map((i) => `ideal-${i.id}`),
    ...task.issues
      .filter((i) => importance[i.id] === undefined)
      .map((i) => `importance-${i.id}`),
    ...(confidence === null ? ["confidence"] : []),
  ];
  const canContinue = useDevGate(missing.length === 0);

  async function save() {
    if (!canContinue) return;
    if (participantKey) {
      await getStore().saveResponses(
        participantKey,
        `initial_preference_s${sessionIndex}`,
        { ideal, redLine: limit, importance, confidence, taskId: task.id, role },
      );
    }
    logEvent("initial_preference_saved", { taskId: task.id }, { sessionIndex });
    onContinue();
  }

  return (
    <>
      <Page width="wide">
        <SessionLayout briefing={<BriefingPanel task={task} role={role} />}>
          <SessionHeader
            sessionIndex={sessionIndex}
            title="What are you aiming for?"
            steps={steps}
            current={1}
          />

          <div className="mb-5">
            <Callout tone="private" title="This stays private">
              <p>
                Nothing here is shown to the other party. It is recorded so we
                can compare what you wanted with how things turned out.
              </p>
            </Callout>
          </div>

          <div className="space-y-4">
            {task.issues.map((issue) => (
              <Card key={issue.id} id={`q-ideal-${issue.id}`}>
                <div className="mb-4">
                  <p className="text-[0.9375rem] font-semibold">
                    {issue.label}
                  </p>
                  <p className="text-[0.875rem] text-[var(--ink-2)]">
                    {issue.description}
                  </p>
                </div>

                <p className="mb-1.5 text-[0.8125rem] font-medium">
                  What you would like
                </p>
                <div className="mb-4">
                  <OptionChips
                    issue={issue}
                    role={role}
                    name={`ideal-${issue.id}`}
                    value={ideal[issue.id] ?? null}
                    onChange={(v) =>
                      setIdeal((p) => ({ ...p, [issue.id]: v }))
                    }
                  />
                </div>

                <p className="mb-1.5 text-[0.8125rem] font-medium">
                  The least you would accept
                  <span className="ml-2 font-normal text-[var(--ink-3)]">
                    optional
                  </span>
                </p>
                <div className="mb-5">
                  <OptionChips
                    issue={issue}
                    role={role}
                    name={`limit-${issue.id}`}
                    value={limit[issue.id] ?? null}
                    onChange={(v) =>
                      setLimit((p) => ({ ...p, [issue.id]: v }))
                    }
                    allowNone
                    noneLabel="No firm limit"
                  />
                </div>

                <Scale
                  id={`importance-${issue.id}`}
                  statement="How important is this issue to you?"
                  value={importance[issue.id] ?? null}
                  onChange={(v) =>
                    setImportance((p) => ({ ...p, [issue.id]: v }))
                  }
                  lowAnchor="Not important"
                  highAnchor="Extremely"
                  compact
                />
              </Card>
            ))}

            <Card>
              <Scale
                id="confidence"
                statement="How confident are you that you can reach an outcome you would accept?"
                value={confidence}
                onChange={setConfidence}
                lowAnchor="Not at all"
                highAnchor="Completely"
                compact
              />
            </Card>
          </div>
        </SessionLayout>
      </Page>

      <ActionBar
        label="Start the session"
        onClick={save}
        disabled={!canContinue}
        remaining={missing.length}
        firstUnansweredId={missing[0] ?? null}
        note={missing.length === 0 ? "Ready." : ""}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Phase: final decision (Baseline condition)
// ---------------------------------------------------------------------------

export function FinalDecision({
  sessionIndex,
  task,
  role,
  steps,
  terms,
  onDone,
}: {
  sessionIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  terms: Record<string, string>;
  onDone: () => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const [choice, setChoice] = useState<"accept" | "reject" | null>(null);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);

  useDevAutofill(() => {
    setChoice("accept");
    setSatisfaction(4);
  });

  const canSubmit = useDevGate(choice !== null && satisfaction !== null);
  const anyTerms = Object.keys(terms).length > 0;

  async function submit() {
    // `canSubmit` is the real condition outside dev mode, so this falls back
    // only when validation is being bypassed.
    const decided = choice ?? (canSubmit ? "accept" : null);
    if (!decided) return;

    if (participantKey) {
      await getStore().saveAgreement(participantKey, {
        sessionIndex,
        terms: task.issues.map((i) => ({
          issueId: i.id,
          optionId: terms[i.id] ?? null,
          unresolved: !terms[i.id],
        })),
        unresolvedIssueIds: task.issues
          .filter((i) => !terms[i.id])
          .map((i) => i.id),
      });
      await getStore().saveRatification(
        participantKey,
        sessionIndex,
        decided === "accept" ? "ratify" : "reject",
      );
      await getStore().saveResponses(
        participantKey,
        `session_outcome_s${sessionIndex}`,
        { satisfaction, choice: decided },
      );
    }

    logEvent("ratification_choice", { choice: decided }, { sessionIndex });
    logEvent("negotiation_ended", undefined, { sessionIndex });
    onDone();
  }

  return (
    <>
      <Page width="wide">
        <SessionLayout briefing={<BriefingPanel task={task} role={role} />}>
          <SessionHeader
            sessionIndex={sessionIndex}
            title="Where it landed"
            steps={steps}
            current={steps.length - 1}
          />

          <Card className="mb-5">
            <CardTitle>The package on the table</CardTitle>
            {anyTerms ? (
              <TermsList task={task} terms={terms} />
            ) : (
              <Callout tone="warning">
                <p>
                  No package was agreed in the time available. This is recorded
                  as no agreement.
                </p>
              </Callout>
            )}
          </Card>

          <Card className="mb-5">
            <CardTitle>Do you accept this outcome?</CardTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <DecisionButton
                selected={choice === "accept"}
                onClick={() => setChoice("accept")}
                label="Accept"
                hint="Settle on this package"
              />
              <DecisionButton
                selected={choice === "reject"}
                onClick={() => setChoice("reject")}
                label="Reject"
                hint="End with no agreement"
              />
            </div>
          </Card>

          <Card>
            <Scale
              id="satisfaction"
              statement="How satisfied are you with this outcome?"
              value={satisfaction}
              onChange={setSatisfaction}
              lowAnchor="Not at all"
              highAnchor="Extremely"
              compact
            />
          </Card>
        </SessionLayout>
      </Page>

      <ActionBar
        label={sessionIndex === 1 ? "Continue to the next session" : "Continue"}
        onClick={submit}
        disabled={!canSubmit}
        note={canSubmit ? "" : "Choose accept or reject, and rate the outcome."}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

export function TermsList({
  task,
  terms,
}: {
  task: NegotiationTask;
  terms: Record<string, string | null | undefined>;
}) {
  return (
    <dl className="divide-y divide-[var(--line)]">
      {task.issues.map((issue) => {
        const option = issue.options.find((o) => o.id === terms[issue.id]);
        return (
          <div
            key={issue.id}
            className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
          >
            <dt className="text-[0.875rem] text-[var(--ink-2)]">
              {issue.label}
            </dt>
            <dd className="text-right text-[0.9375rem] font-medium">
              {option?.label ?? (
                <span className="font-normal text-[var(--ink-3)]">
                  Not settled
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function DecisionButton({
  selected,
  onClick,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        selected
          ? "rounded-[var(--radius)] border-2 border-[var(--accent)] bg-[var(--accent-soft)] p-3.5 text-left"
          : "rounded-[var(--radius)] border-2 border-[var(--line)] p-3.5 text-left transition-colors hover:border-[var(--ink-3)]"
      }
    >
      <span className="block text-[0.9375rem] font-semibold">{label}</span>
      <span className="block text-[0.8125rem] text-[var(--ink-2)]">{hint}</span>
    </button>
  );
}
