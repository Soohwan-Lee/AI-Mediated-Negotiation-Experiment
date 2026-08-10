"use client";

/**
 * Phases shared by the Direct and Proxy sessions.
 *
 * The initial-preference form is the baseline for Preference Displacement and
 * AI Settlement Adoption, so it must be captured BEFORE the participant sees
 * any counterpart offer or proxy transcript (Methods §Main Sessions).
 */

import { useState } from "react";
import { useParticipant } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import type { NegotiationTask, Role } from "@/lib/types";
import {
  Button,
  Callout,
  Card,
  Field,
  PageHeader,
  PageShell,
  Select,
  Slider,
} from "@/components/ui";
import { IssueReference, RoleScorecard } from "@/components/negotiation";

// ---------------------------------------------------------------------------
// Phase: scenario brief
// ---------------------------------------------------------------------------

export function SessionBrief({
  sessionIndex,
  task,
  role,
  onContinue,
}: {
  sessionIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  onContinue: () => void;
}) {
  return (
    <PageShell>
      <PageHeader
        eyebrow={`Session ${sessionIndex} of 2`}
        title={task.title}
        subtitle="Read the situation and your confidential briefing before you begin."
      />

      <Card className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">The situation</h2>
        <p className="text-sm text-[var(--muted)]">{task.publicBrief}</p>
      </Card>

      <div className="mb-6">
        <RoleScorecard task={task} role={role} />
      </div>

      <div className="mb-8">
        <IssueReference issues={task.issues} role={role} showPoints />
      </div>

      <div className="flex justify-end">
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Phase: initial private preference
// ---------------------------------------------------------------------------

export function InitialPreferenceForm({
  sessionIndex,
  task,
  role,
  onContinue,
}: {
  sessionIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  onContinue: () => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const [ideal, setIdeal] = useState<Record<string, string>>({});
  const [redLine, setRedLine] = useState<Record<string, string>>({});
  const [importance, setImportance] = useState<Record<string, number>>(() =>
    Object.fromEntries(task.issues.map((i) => [i.id, 4])),
  );
  const [confidence, setConfidence] = useState(50);

  const complete = task.issues.every((i) => ideal[i.id]);

  async function save() {
    if (participantKey) {
      await getStore().saveResponses(
        participantKey,
        `initial_preference_s${sessionIndex}`,
        { ideal, redLine, importance, confidence, taskId: task.id, role },
      );
    }
    logEvent("initial_preference_saved", { taskId: task.id }, { sessionIndex });
    onContinue();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={`Session ${sessionIndex} of 2`}
        title="Before you start"
        subtitle="Record what you are aiming for. This is private and is not shared with the other party."
      />

      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold">
          For each issue, what is your ideal outcome and your limit?
        </h2>
        <div className="space-y-6">
          {task.issues.map((issue) => (
            <div
              key={issue.id}
              className="border-b border-[var(--border)] pb-6 last:border-b-0 last:pb-0"
            >
              <p className="mb-1 text-sm font-medium">{issue.label}</p>
              <p className="mb-3 text-xs text-[var(--muted)]">
                {issue.description}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your ideal outcome" required>
                  <Select
                    value={ideal[issue.id] ?? ""}
                    onChange={(v) =>
                      setIdeal((p) => ({ ...p, [issue.id]: v }))
                    }
                    options={issue.options.map((o) => ({
                      value: o.id,
                      label: o.label,
                    }))}
                  />
                </Field>
                <Field
                  label="Your limit"
                  hint="The least you would accept on this issue."
                >
                  <Select
                    value={redLine[issue.id] ?? ""}
                    onChange={(v) =>
                      setRedLine((p) => ({ ...p, [issue.id]: v }))
                    }
                    placeholder="No firm limit"
                    options={issue.options.map((o) => ({
                      value: o.id,
                      label: o.label,
                    }))}
                  />
                </Field>
              </div>

              <div className="mt-2">
                <label className="mb-1 block text-xs font-medium">
                  How important is this issue to you?
                </label>
                <Slider
                  value={importance[issue.id] ?? 4}
                  onChange={(v) =>
                    setImportance((p) => ({ ...p, [issue.id]: v }))
                  }
                  min={1}
                  max={7}
                  lowAnchor="Not important"
                  highAnchor="Extremely important"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-8">
        <Field
          label="How confident are you that you can reach an outcome you would accept?"
          required
        >
          <Slider
            value={confidence}
            onChange={setConfidence}
            lowAnchor="Not at all confident"
            highAnchor="Completely confident"
          />
        </Field>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">
          {complete ? "Ready to begin." : "Please choose an ideal outcome for each issue."}
        </p>
        <Button onClick={save} disabled={!complete}>
          Begin session
        </Button>
      </div>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Phase: final decision (Direct condition)
// ---------------------------------------------------------------------------

export function FinalDecision({
  sessionIndex,
  task,
  role,
  terms,
  confidence,
  onConfidenceChange,
  onDone,
}: {
  sessionIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  terms: Record<string, string>;
  confidence: number;
  onConfidenceChange: (v: number) => void;
  onDone: () => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const [choice, setChoice] = useState<"accept" | "reject" | null>(null);
  const anyTerms = Object.keys(terms).length > 0;

  async function submit() {
    if (!choice) return;
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
        choice === "accept" ? "ratify" : "reject",
      );
    }
    logEvent("ratification_choice", { choice }, { sessionIndex });
    logEvent("negotiation_ended", undefined, { sessionIndex });
    onDone();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={`Session ${sessionIndex} of 2`}
        title="Finalize this session"
        subtitle="Review where things landed and record your decision."
      />

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">The package on the table</h2>
        {anyTerms ? (
          <dl className="space-y-2 text-sm">
            {task.issues.map((issue) => {
              const opt = issue.options.find((o) => o.id === terms[issue.id]);
              return (
                <div
                  key={issue.id}
                  className="flex justify-between gap-4 border-b border-[var(--border)] pb-2 last:border-b-0"
                >
                  <dt className="text-[var(--muted)]">{issue.label}</dt>
                  <dd className="text-right font-medium">
                    {opt?.label ?? (
                      <span className="text-[var(--muted)]">Unresolved</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <Callout tone="warning">
            No package was agreed within the time available. This will be
            recorded as no agreement.
          </Callout>
        )}
      </Card>

      <Card className="mb-6">
        <Field label="Do you accept this outcome?" required>
          <div className="flex gap-3">
            <Button
              variant={choice === "accept" ? "primary" : "secondary"}
              onClick={() => setChoice("accept")}
              className="flex-1"
            >
              Accept
            </Button>
            <Button
              variant={choice === "reject" ? "primary" : "secondary"}
              onClick={() => setChoice("reject")}
              className="flex-1"
            >
              Reject
            </Button>
          </div>
        </Field>

        <Field label="How satisfied are you with this outcome?">
          <Slider
            value={confidence}
            onChange={onConfidenceChange}
            lowAnchor="Not at all"
            highAnchor="Extremely"
          />
        </Field>
      </Card>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={!choice}>
          {sessionIndex === 1 ? "Continue to next session" : "Continue"}
        </Button>
      </div>

      <p className="mt-4 text-right text-xs text-[var(--muted)]">
        Role: {role === "leader" ? "Project Leader" : "Team Member"}
      </p>
    </PageShell>
  );
}
