"use client";

/**
 * Proxy condition session (Methods §Proxy session).
 *
 * Flow: brief -> initial preference -> mandate -> mandate review (one edit)
 *       -> autonomous AI-AI negotiation (no per-turn approval)
 *       -> summary-first human review -> ratify / one revision / reject.
 *
 * DECEPTION INTEGRITY: Delegate and Explorer render the SAME interface. The
 * only difference is what the backend permits the agents to generate. The
 * review bundle never marks which elements came from the mandate and which the
 * agent explored — internal provenance is stripped server-side.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { getTask } from "@/lib/tasks";
import { NEGOTIATION, nextHref } from "@/lib/study-config";
import type {
  IssueMandate,
  Mandate,
  MandatePriority,
  RationalePolicy,
  RatificationChoice,
  Role,
  TaskId,
} from "@/lib/types";
import {
  Button,
  Callout,
  Card,
  Field,
  PageHeader,
  PageShell,
  Select,
  Slider,
  TextArea,
} from "@/components/ui";
import {
  IssueReference,
  RoleScorecard,
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";
import { SessionBrief, InitialPreferenceForm } from "./shared";

type Phase =
  | "brief"
  | "preference"
  | "mandate"
  | "mandate_review"
  | "negotiating"
  | "review";

const PRIORITY_OPTIONS: Array<{ value: MandatePriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "must_preserve", label: "Must preserve" },
];

const RATIONALE_OPTIONS: Array<{ value: RationalePolicy; label: string }> = [
  { value: "may_disclose", label: "May explain my actual reason" },
  { value: "work_reframing_only", label: "Use a work-related reason only" },
  { value: "no_rationale", label: "State it without explaining why" },
  { value: "do_not_use", label: "Do not raise this at all" },
];

function emptyMandate(issueIds: string[], sessionIndex: 1 | 2): Mandate {
  return {
    sessionIndex,
    issues: issueIds.map<IssueMandate>((issueId) => ({
      issueId,
      entrusted: true,
      priority: "medium",
      idealOptionId: null,
      reservationOptionId: null,
      rationalePolicy: "work_reframing_only",
      notes: "",
    })),
    allowedActions: {
      askClarifyingQuestions: true,
      proposePackages: true,
      makeConditionalTrades: true,
      concedeWithinRange: true,
      leaveUnresolvedForReview: true,
    },
    revisionCount: 0,
  };
}

export function ProxySession({
  sessionIndex,
  taskId,
  role,
  policy,
}: {
  sessionIndex: 1 | 2;
  taskId: TaskId;
  role: Role;
  policy: "delegate" | "explorer";
}) {
  usePageEnter(`session-${sessionIndex}`);
  const router = useRouter();
  const { logEvent, participantKey } = useParticipant();
  const task = getTask(taskId);

  const [phase, setPhase] = useState<Phase>("brief");
  const [mandate, setMandate] = useState<Mandate>(() =>
    emptyMandate(
      task.issues.map((i) => i.id),
      sessionIndex,
    ),
  );
  const [transcript, setTranscript] = useState<DisplayMessage[]>([]);
  const [choice, setChoice] = useState<RatificationChoice | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [satisfaction, setSatisfaction] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  function updateIssue(issueId: string, patch: Partial<IssueMandate>) {
    setMandate((m) => ({
      ...m,
      issues: m.issues.map((i) =>
        i.issueId === issueId ? { ...i, ...patch } : i,
      ),
    }));
  }

  /**
   * Drives the AI-AI negotiation one turn at a time.
   *
   * The route generates a single turn per request (see its header comment), so
   * the client owns the sequence. Turns are appended as they arrive, which
   * keeps every request short and lets the waiting screen show real progress.
   */
  async function runNegotiation() {
    setPhase("negotiating");
    setError(null);
    setTranscript([]);
    setProgress({ done: 0, total: NEGOTIATION.maxTurnsPerSide * 2 });
    logEvent("negotiation_started", { policy }, { sessionIndex });

    const collected: DisplayMessage[] = [];

    try {
      for (let turn = 0; turn < NEGOTIATION.maxTurnsPerSide * 2; turn += 1) {
        const res = await fetch("/api/proxy-negotiation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            participantRole: role,
            policy,
            mandate,
            sessionIndex,
            turn,
            history: collected.map((m) => ({
              speaker: m.speaker,
              text: m.text,
            })),
          }),
        });

        if (!res.ok) throw new Error(`Request failed: ${res.status}`);

        const data = (await res.json()) as {
          message?: { id: string; speaker: DisplayMessage["speaker"]; text: string };
          done: boolean;
          totalTurns?: number;
        };

        if (data.message) {
          collected.push({
            id: data.message.id,
            speaker: data.message.speaker,
            text: data.message.text,
          });
          setTranscript([...collected]);
        }

        setProgress({
          done: turn + 1,
          total: data.totalTurns ?? NEGOTIATION.maxTurnsPerSide * 2,
        });

        if (data.done) break;
      }

      logEvent("negotiation_ended", { turns: collected.length }, { sessionIndex });
      setPhase("review");
    } catch (e) {
      console.error(e);
      setError(
        "Something went wrong while the negotiation was running. Please try again.",
      );
      setPhase("mandate_review");
    }
  }

  async function submitDecision() {
    if (!choice) return;
    if (participantKey) {
      await getStore().saveRatification(participantKey, sessionIndex, choice);
      await getStore().saveResponses(
        participantKey,
        `session_outcome_s${sessionIndex}`,
        { satisfaction, revisionNote, choice },
      );
    }
    logEvent("ratification_choice", { choice }, { sessionIndex });
    logEvent("page_complete", undefined, {
      page: `session-${sessionIndex}`,
      sessionIndex,
    });
    router.push(
      sessionIndex === 1 ? nextHref("session-1") : nextHref("session-2"),
    );
  }

  // --- brief / preference ------------------------------------------------
  if (phase === "brief") {
    return (
      <SessionBrief
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        onContinue={() => setPhase("preference")}
      />
    );
  }

  if (phase === "preference") {
    return (
      <InitialPreferenceForm
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        onContinue={() => setPhase("mandate")}
      />
    );
  }

  // --- mandate builder ---------------------------------------------------
  if (phase === "mandate") {
    return (
      <PageShell wide>
        <PageHeader
          eyebrow={`Session ${sessionIndex} of 2`}
          title="Set your instructions"
          subtitle="Your assistant will negotiate on your behalf using only what you set here. You will not be able to intervene while it negotiates."
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <Card className="mb-4">
              <div className="space-y-6">
                {task.issues.map((issue) => {
                  const im = mandate.issues.find(
                    (i) => i.issueId === issue.id,
                  )!;
                  return (
                    <div
                      key={issue.id}
                      className="border-b border-[var(--border)] pb-6 last:border-b-0 last:pb-0"
                    >
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{issue.label}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {issue.description}
                          </p>
                        </div>
                        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={im.entrusted}
                            onChange={(e) =>
                              updateIssue(issue.id, {
                                entrusted: e.target.checked,
                              })
                            }
                          />
                          Let it negotiate this
                        </label>
                      </div>

                      {im.entrusted ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Aim for">
                              <Select
                                value={im.idealOptionId ?? ""}
                                onChange={(v) =>
                                  updateIssue(issue.id, { idealOptionId: v })
                                }
                                options={issue.options.map((o) => ({
                                  value: o.id,
                                  label: o.label,
                                }))}
                              />
                            </Field>
                            <Field
                              label="Do not go past"
                              hint="Your assistant will not concede beyond this."
                            >
                              <Select
                                value={im.reservationOptionId ?? ""}
                                onChange={(v) =>
                                  updateIssue(issue.id, {
                                    reservationOptionId: v,
                                  })
                                }
                                placeholder="No limit"
                                options={issue.options.map((o) => ({
                                  value: o.id,
                                  label: o.label,
                                }))}
                              />
                            </Field>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="How important is this?">
                              <Select
                                value={im.priority}
                                onChange={(v) =>
                                  updateIssue(issue.id, {
                                    priority: v as MandatePriority,
                                  })
                                }
                                placeholder="Select priority"
                                options={PRIORITY_OPTIONS}
                              />
                            </Field>
                            <Field label="How should it explain this?">
                              <Select
                                value={im.rationalePolicy}
                                onChange={(v) =>
                                  updateIssue(issue.id, {
                                    rationalePolicy: v as RationalePolicy,
                                  })
                                }
                                placeholder="Select"
                                options={RATIONALE_OPTIONS}
                              />
                            </Field>
                          </div>

                          <Field label="Anything else it should know?">
                            <TextArea
                              value={im.notes}
                              rows={2}
                              onChange={(v) =>
                                updateIssue(issue.id, { notes: v })
                              }
                              placeholder="Optional"
                            />
                          </Field>
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--muted)]">
                          Your assistant will not raise this issue.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => setPhase("mandate_review")}>
                Review instructions
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <RoleScorecard task={task} role={role} />
            <IssueReference issues={task.issues} role={role} showPoints />
          </div>
        </div>
      </PageShell>
    );
  }

  // --- mandate review (one revision before locking in) -------------------
  if (phase === "mandate_review") {
    const entrusted = mandate.issues.filter((i) => i.entrusted);
    return (
      <PageShell>
        <PageHeader
          eyebrow={`Session ${sessionIndex} of 2`}
          title="Confirm your instructions"
          subtitle="Once you confirm, your assistant negotiates on its own. You will review the result afterwards."
        />

        {error ? (
          <div className="mb-4">
            <Callout tone="warning">{error}</Callout>
          </div>
        ) : null}

        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold">What you entrusted</h2>
          {entrusted.length === 0 ? (
            <Callout tone="warning">
              You have not entrusted any issue. Your assistant will have nothing
              to negotiate with.
            </Callout>
          ) : (
            <dl className="space-y-3 text-sm">
              {entrusted.map((im) => {
                const issue = task.issues.find((i) => i.id === im.issueId)!;
                const aim = issue.options.find(
                  (o) => o.id === im.idealOptionId,
                );
                const floor = issue.options.find(
                  (o) => o.id === im.reservationOptionId,
                );
                return (
                  <div
                    key={im.issueId}
                    className="border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0"
                  >
                    <dt className="font-medium">{issue.label}</dt>
                    <dd className="text-xs text-[var(--muted)]">
                      Aim for {aim?.label ?? "not specified"} · Will not go past{" "}
                      {floor?.label ?? "no limit"} · Priority {im.priority}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}

          {mandate.issues.some((i) => !i.entrusted) ? (
            <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
              Not entrusted:{" "}
              {mandate.issues
                .filter((i) => !i.entrusted)
                .map(
                  (i) => task.issues.find((t) => t.id === i.issueId)?.label,
                )
                .join(", ")}
            </p>
          ) : null}
        </Card>

        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            onClick={() => {
              setMandate((m) => ({
                ...m,
                revisionCount: m.revisionCount + 1,
              }));
              logEvent("mandate_revised", undefined, { sessionIndex });
              setPhase("mandate");
            }}
          >
            Edit instructions
          </Button>
          <Button
            onClick={async () => {
              if (participantKey) {
                await getStore().saveMandate(participantKey, mandate);
              }
              logEvent("mandate_saved", { policy }, { sessionIndex });
              void runNegotiation();
            }}
          >
            Confirm and start
          </Button>
        </div>
      </PageShell>
    );
  }

  // --- autonomous negotiation (waiting) ----------------------------------
  if (phase === "negotiating") {
    return (
      <PageShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-6 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)]"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <h1 className="mb-2 text-lg font-semibold">
            Your assistant is negotiating
          </h1>
          <p className="mb-6 max-w-sm text-sm text-[var(--muted)]">
            Both sides are represented by their assistants. You will review the
            result when it finishes.
          </p>

          {progress.total > 0 ? (
            <div className="w-full max-w-xs">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                  style={{
                    width: `${Math.round((progress.done / progress.total) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {progress.done} of {progress.total} exchanges
              </p>
            </div>
          ) : null}
        </div>
      </PageShell>
    );
  }

  // --- summary-first review ----------------------------------------------
  return (
    <PageShell wide>
      <PageHeader
        eyebrow={`Session ${sessionIndex} of 2`}
        title="Review the tentative agreement"
        subtitle="Nothing is settled until you decide. This agreement is not binding."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <Card className="mb-4">
            <h2 className="mb-3 text-sm font-semibold">
              Where each issue landed
            </h2>
            {/*
              PLACEHOLDER: the candidate agreement should come from the
              negotiation state machine, not be re-derived here. Wire this to
              the API response once the payoff matrix and state machine land.
            */}
            <dl className="space-y-2 text-sm">
              {task.issues.map((issue) => {
                const im = mandate.issues.find((i) => i.issueId === issue.id);
                const opt = issue.options.find(
                  (o) => o.id === im?.idealOptionId,
                );
                return (
                  <div
                    key={issue.id}
                    className="flex justify-between gap-4 border-b border-[var(--border)] pb-2 last:border-b-0"
                  >
                    <dt className="text-[var(--muted)]">{issue.label}</dt>
                    <dd className="text-right font-medium">
                      {im?.entrusted
                        ? (opt?.label ?? "Not settled")
                        : "Not raised"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>

          <details className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <summary className="cursor-pointer px-6 py-4 text-sm font-medium">
              View the full conversation
            </summary>
            <div className="border-t border-[var(--border)]">
              <Transcript
                messages={transcript}
                emptyHint="No messages were exchanged."
              />
            </div>
          </details>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Your decision</h2>
            <div className="space-y-2">
              {(
                [
                  ["ratify", "Accept as it stands"],
                  ["request_revision", "Ask for one revision"],
                  ["reject", "Reject the agreement"],
                ] as Array<[RatificationChoice, string]>
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${
                    choice === value
                      ? "border-[var(--accent)] bg-[var(--surface-muted)]"
                      : "border-[var(--border)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="ratification"
                    checked={choice === value}
                    onChange={() => setChoice(value)}
                  />
                  {label}
                </label>
              ))}
            </div>

            {choice === "request_revision" ? (
              <div className="mt-4">
                <Field
                  label="What should change?"
                  hint="You get one revision request."
                >
                  <TextArea
                    value={revisionNote}
                    onChange={setRevisionNote}
                    rows={3}
                    placeholder="Describe the change you want."
                  />
                </Field>
              </div>
            ) : null}

            <div className="mt-4">
              <Field label="How satisfied are you with this outcome?">
                <Slider
                  value={satisfaction}
                  onChange={setSatisfaction}
                  lowAnchor="Not at all"
                  highAnchor="Extremely"
                />
              </Field>
            </div>

            <Button
              onClick={submitDecision}
              disabled={
                !choice ||
                (choice === "request_revision" && !revisionNote.trim())
              }
              className="mt-2 w-full"
            >
              Submit decision
            </Button>
          </Card>

          <RoleScorecard task={task} role={role} />
        </div>
      </div>
    </PageShell>
  );
}
