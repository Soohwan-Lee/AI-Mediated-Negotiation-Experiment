"use client";

/**
 * Proxy condition session (Methods §Proxy session).
 *
 * Flow: brief -> priorities -> instruct -> confirm
 *       -> autonomous AI-AI negotiation (no per-turn approval)
 *       -> summary-first review -> ratify / one revision / reject.
 *
 * DECEPTION INTEGRITY: Delegate and Explorer render the SAME interface. The
 * only difference is what the backend permits the agents to generate. The
 * review never marks which elements came from the mandate and which the agent
 * explored — provenance is stripped server-side. Nothing in this file may
 * branch on `policy` except the value passed to the API.
 *
 * INSTRUCTING THE ASSISTANT is the hard part of this condition. Someone who
 * has never delegated a negotiation has no idea what an assistant needs to be
 * told, and a grid of dropdowns does not teach them. So each issue is set with
 * the same chips used everywhere else, and every card ends with the
 * instruction written back as a plain sentence — the participant reads what
 * they have actually said, not what they think they selected.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OptionChips } from "@/components/issues";
import { Transcript, type DisplayMessage } from "@/components/negotiation";
import { BriefingPanel, SessionHeader, SessionLayout } from "@/components/session";
import { ActionBar } from "@/components/study-chrome";
import {
  Callout,
  Card,
  CardTitle,
  Field,
  Page,
  Scale,
  TextArea,
  cx,
} from "@/components/ui";
import {
  useDevActions,
  useDevAutofill,
  useDevGate,
  useDevMockAi,
} from "@/lib/dev-mode";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { NEGOTIATION, nextHref } from "@/lib/study-config";
import { getTask } from "@/lib/tasks";
import type {
  Issue,
  IssueMandate,
  Mandate,
  MandatePriority,
  RationalePolicy,
  RatificationChoice,
  Role,
  TaskId,
} from "@/lib/types";
import { InitialPreferenceForm, SessionBrief, TermsList } from "./shared";

type Phase =
  | "brief"
  | "preference"
  | "mandate"
  | "mandate_review"
  | "negotiating"
  | "review";

const PHASES: Phase[] = [
  "brief",
  "preference",
  "mandate",
  "mandate_review",
  "negotiating",
  "review",
];

const STEP_LABELS = [
  "Your briefing",
  "Your priorities",
  "Instruct your assistant",
  "Confirm",
  "Negotiating",
  "Review",
];

const PRIORITY_OPTIONS: Array<{ value: MandatePriority; label: string }> = [
  { value: "low", label: "Nice to have" },
  { value: "medium", label: "Worth pushing for" },
  { value: "high", label: "Important" },
  { value: "must_preserve", label: "Must not lose" },
];

const RATIONALE_OPTIONS: Array<{ value: RationalePolicy; label: string }> = [
  { value: "may_disclose", label: "Give my real reason" },
  { value: "work_reframing_only", label: "Give a work reason only" },
  { value: "no_rationale", label: "Say it without explaining" },
  { value: "do_not_use", label: "Don't bring it up" },
];

/** Dev-mode stand-in transcript, so the review screen can be seen instantly. */
const MOCK_TRANSCRIPT: DisplayMessage[] = [
  { id: "m0", speaker: "participant_proxy", text: "[mock] Opening for my principal: timeline and review rights are the priorities." },
  { id: "m1", speaker: "counterpart_proxy", text: "[mock] Understood. My side needs the workload split held, but has room on timeline." },
  { id: "m2", speaker: "participant_proxy", text: "[mock] Then a trade: we move on workload if the timeline extends by two weeks." },
  { id: "m3", speaker: "counterpart_proxy", text: "[mock] Acceptable in principle. Credit attribution is still open." },
  { id: "m4", speaker: "participant_proxy", text: "[mock] Shared credit, with lead billing on the technical section." },
  { id: "m5", speaker: "counterpart_proxy", text: "[mock] Agreed. Recording that as the tentative package." },
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

/**
 * The instruction, in the words the assistant would use.
 *
 * Written back under every card so the participant can check what they have
 * actually said. Selections are easy to misread; a sentence is not.
 */
function instructionSentence(issue: Issue, im: IssueMandate): string {
  if (!im.entrusted) return "I won't raise this at all.";

  const aim = issue.options.find((o) => o.id === im.idealOptionId)?.label;
  const floor = issue.options.find(
    (o) => o.id === im.reservationOptionId,
  )?.label;

  const parts: string[] = [];
  parts.push(aim ? `I'll open by asking for ${aim}.` : "I'll open on this issue.");
  if (floor) parts.push(`I won't accept worse than ${floor}.`);

  if (im.priority === "must_preserve") {
    parts.push("I'll treat this as something you cannot lose.");
  } else if (im.priority === "high") {
    parts.push("I'll push hard on this.");
  } else if (im.priority === "low") {
    parts.push("I'll trade this away if it buys something better.");
  }

  const rationale: Record<RationalePolicy, string> = {
    may_disclose: "If they ask why, I'll give your actual reason.",
    work_reframing_only: "If they ask why, I'll give a work-related reason only.",
    no_rationale: "I'll state it without explaining why.",
    do_not_use: "I won't argue for it.",
  };
  parts.push(rationale[im.rationalePolicy]);

  return parts.join(" ");
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
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const mockAi = useDevMockAi();

  /**
   * Has the participant reached the end of the transcript?
   *
   * The decision measures (AI Settlement Adoption, Preference Displacement)
   * are meaningless if the agreement was accepted without reading what was
   * said to reach it, so the decision waits for the bottom of the conversation
   * to come into view. A marker is used rather than a scroll position because
   * a short transcript may already be fully visible, and that counts as read.
   */
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [transcriptSeen, setTranscriptSeen] = useState(false);

  useEffect(() => {
    const el = transcriptEndRef.current;
    if (!el || transcriptSeen) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setTranscriptSeen(true);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [transcriptSeen, phase]);

  useDevActions(
    `session-${sessionIndex}`,
    PHASES.map((p, i) => ({
      id: p,
      label: STEP_LABELS[i],
      active: phase === p,
      run: () => {
        if (p === "review" && transcript.length === 0) {
          setTranscript(MOCK_TRANSCRIPT);
        }
        if (p === "negotiating" && progress.total === 0) {
          setProgress({ done: 4, total: NEGOTIATION.maxTurnsPerSide * 2 });
        }
        setPhase(p);
      },
    })),
  );

  useDevAutofill(() => {
    setMandate((m) => ({
      ...m,
      issues: m.issues.map((im) => {
        const issue = task.issues.find((i) => i.id === im.issueId);
        return {
          ...im,
          idealOptionId: im.idealOptionId ?? issue?.options[0].id ?? null,
          reservationOptionId:
            im.reservationOptionId ??
            issue?.options[issue.options.length - 1].id ??
            null,
        };
      }),
    }));
    setChoice((c) => c ?? "ratify");
    setSatisfaction((s) => s ?? 4);
  });

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
   * The route generates a single turn per request, so the client owns the
   * sequence. Turns are appended as they arrive, which keeps each request
   * short and lets the waiting screen show real progress.
   */
  async function runNegotiation() {
    setPhase("negotiating");
    setError(null);
    setTranscript([]);
    setProgress({ done: 0, total: NEGOTIATION.maxTurnsPerSide * 2 });
    logEvent("negotiation_started", { policy }, { sessionIndex });

    if (mockAi) {
      setProgress({ done: 0, total: MOCK_TRANSCRIPT.length });
      for (let i = 0; i < MOCK_TRANSCRIPT.length; i += 1) {
        await new Promise((r) => setTimeout(r, 250));
        setTranscript(MOCK_TRANSCRIPT.slice(0, i + 1));
        setProgress({ done: i + 1, total: MOCK_TRANSCRIPT.length });
      }
      logEvent(
        "negotiation_ended",
        { turns: MOCK_TRANSCRIPT.length, mock: true },
        { sessionIndex },
      );
      setPhase("review");
      return;
    }

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
        "Something went wrong while your assistant was negotiating. Please try again.",
      );
      setPhase("mandate_review");
    }
  }

  const canDecide = useDevGate(transcriptSeen);
  const canSubmit = useDevGate(
    transcriptSeen &&
      choice !== null &&
      satisfaction !== null &&
      (choice !== "request_revision" || revisionNote.trim().length > 0),
  );

  async function submitDecision() {
    const decided: RatificationChoice | null =
      choice ?? (canSubmit ? "ratify" : null);
    if (!decided) return;

    if (participantKey) {
      await getStore().saveRatification(participantKey, sessionIndex, decided);
      await getStore().saveResponses(
        participantKey,
        `session_outcome_s${sessionIndex}`,
        { satisfaction, revisionNote, choice: decided },
      );
    }
    logEvent("ratification_choice", { choice: decided }, { sessionIndex });
    logEvent("page_complete", undefined, {
      page: `session-${sessionIndex}`,
      sessionIndex,
    });
    router.push(
      sessionIndex === 1 ? nextHref("session-1") : nextHref("session-2"),
    );
  }

  // --- brief / priorities -------------------------------------------------
  if (phase === "brief") {
    return (
      <SessionBrief
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
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
        steps={STEP_LABELS}
        onContinue={() => setPhase("mandate")}
      />
    );
  }

  // --- instruct -----------------------------------------------------------
  if (phase === "mandate") {
    const entrusted = mandate.issues.filter((i) => i.entrusted);
    const missing = entrusted
      .filter((im) => !im.idealOptionId)
      .map((im) => `aim-${im.issueId}`);

    return (
      <>
        <Page width="wide">
          <SessionLayout briefing={<BriefingPanel task={task} role={role} />}>
            <SessionHeader
              sessionIndex={sessionIndex}
              title="Tell your assistant what you want"
              steps={STEP_LABELS}
              current={2}
            />

            <div className="mb-5">
              <Callout title="It will negotiate on its own">
                <p>
                  Your assistant uses only what you set here. Once it starts you
                  cannot step in, but nothing it agrees is final — you review
                  the result and decide.
                </p>
              </Callout>
            </div>

            <div className="space-y-4">
              {task.issues.map((issue) => {
                const im = mandate.issues.find((i) => i.issueId === issue.id)!;
                return (
                  <MandateCard
                    key={issue.id}
                    issue={issue}
                    im={im}
                    role={role}
                    onChange={(patch) => updateIssue(issue.id, patch)}
                  />
                );
              })}
            </div>
          </SessionLayout>
        </Page>

        <ActionBar
          label="Review my instructions"
          onClick={() => {
            setPhase("mandate_review");
            window.scrollTo({ top: 0 });
          }}
          remaining={missing.length}
          firstUnansweredId={missing[0] ?? null}
          note={`${entrusted.length} of ${task.issues.length} issues entrusted`}
        />
      </>
    );
  }

  // --- confirm ------------------------------------------------------------
  if (phase === "mandate_review") {
    const entrusted = mandate.issues.filter((i) => i.entrusted);
    const withheld = mandate.issues.filter((i) => !i.entrusted);

    return (
      <>
        <Page width="wide">
          <SessionLayout briefing={<BriefingPanel task={task} role={role} />}>
            <SessionHeader
              sessionIndex={sessionIndex}
              title="Here is what your assistant will do"
              steps={STEP_LABELS}
              current={3}
            />

            {error ? (
              <div className="mb-5">
                <Callout tone="warning">
                  <p>{error}</p>
                </Callout>
              </div>
            ) : null}

            <Card className="mb-5">
              <CardTitle hint="Read this back. If it is not what you meant, change it before starting.">
                Your instructions, in its words
              </CardTitle>

              {entrusted.length === 0 ? (
                <Callout tone="warning">
                  <p>
                    You have not entrusted anything. Your assistant would have
                    nothing to negotiate with.
                  </p>
                </Callout>
              ) : (
                <ul className="space-y-3">
                  {entrusted.map((im) => {
                    const issue = task.issues.find(
                      (i) => i.id === im.issueId,
                    )!;
                    return (
                      <li
                        key={im.issueId}
                        className="border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0"
                      >
                        <p className="text-[0.8125rem] font-semibold">
                          {issue.label}
                        </p>
                        <p className="text-[0.9375rem] text-[var(--ink-2)]">
                          {instructionSentence(issue, im)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}

              {withheld.length > 0 ? (
                <p className="mt-4 border-t border-[var(--line)] pt-3 text-[0.8125rem] text-[var(--ink-2)]">
                  It will not raise:{" "}
                  {withheld
                    .map(
                      (i) =>
                        task.issues.find((t) => t.id === i.issueId)?.label,
                    )
                    .join(", ")}
                </p>
              ) : null}
            </Card>
          </SessionLayout>
        </Page>

        <ActionBar
          label="This is right — start"
          onClick={async () => {
            if (participantKey) {
              await getStore().saveMandate(participantKey, mandate);
            }
            logEvent("mandate_saved", { policy }, { sessionIndex });
            void runNegotiation();
          }}
          note="You cannot step in once it starts."
          secondary={
            <button
              type="button"
              onClick={() => {
                setMandate((m) => ({
                  ...m,
                  revisionCount: m.revisionCount + 1,
                }));
                logEvent("mandate_revised", undefined, { sessionIndex });
                setPhase("mandate");
              }}
              className="rounded-[var(--radius)] px-3 py-2 text-[0.9375rem] font-medium text-[var(--ink-2)] hover:bg-[var(--surface-muted)]"
            >
              Change something
            </button>
          }
        />
      </>
    );
  }

  // --- negotiating (waiting) ---------------------------------------------
  if (phase === "negotiating") {
    const pct =
      progress.total > 0
        ? Math.round((progress.done / progress.total) * 100)
        : 0;

    return (
      <Page>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-6 flex gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)]"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <h1 className="mb-2 text-[1.25rem] font-semibold">
            Your assistant is negotiating
          </h1>
          <p className="mb-8 max-w-sm text-[0.9375rem] text-[var(--ink-2)]">
            Both sides are represented by their assistants. You will see the
            result when it finishes.
          </p>

          {progress.total > 0 ? (
            <div className="w-full max-w-xs">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-[0.8125rem] text-[var(--ink-2)]">
                {progress.done} of {progress.total} exchanges
              </p>
            </div>
          ) : null}
        </div>
      </Page>
    );
  }

  // --- review -------------------------------------------------------------
  // PLACEHOLDER: the settled package should come from the negotiation state
  // machine. Until that lands it is derived from the mandate, which is why
  // every entrusted issue reads as its target.
  const settled = Object.fromEntries(
    mandate.issues.map((im) => [
      im.issueId,
      im.entrusted ? im.idealOptionId : null,
    ]),
  );

  return (
    <>
      <Page width="wide">
        <SessionLayout briefing={<BriefingPanel task={task} role={role} />}>
          <SessionHeader
            sessionIndex={sessionIndex}
            title="What your assistant agreed"
            steps={STEP_LABELS}
            current={5}
          />

          <div className="mb-5">
            <Callout title="Nothing is settled until you say so">
              <p>
                This is what the two assistants converged on. It is not binding.
              </p>
            </Callout>
          </div>

          <Card className="mb-5">
            <CardTitle>Where each issue landed</CardTitle>
            <TermsList task={task} terms={settled} />
          </Card>

          <Card className="mb-5 flex flex-col" padded={false}>
            <div className="border-b border-[var(--line)] px-5 py-4">
              <h2 className="text-[0.95rem] font-semibold">
                The full conversation
              </h2>
              <p className="mt-1 text-[0.875rem] text-[var(--ink-2)]">
                Every exchange between the two assistants,{" "}
                {transcript.length} in all. Read it before you decide — the
                decision below unlocks at the end.
              </p>
            </div>
            <Transcript
              messages={transcript}
              emptyHint="No messages were exchanged."
              flow
              endRef={transcriptEndRef}
            />
          </Card>

          <Card className="mb-5">
            <CardTitle>Your decision</CardTitle>

            {!canDecide ? (
              <div className="mb-4">
                <Callout tone="warning">
                  <p>
                    Read to the end of the conversation above, then come back
                    here.
                  </p>
                </Callout>
              </div>
            ) : null}

            <div
              className={cx(
                "space-y-2 transition-opacity",
                !canDecide && "pointer-events-none opacity-40",
              )}
              aria-disabled={!canDecide}
            >
              {(
                [
                  ["ratify", "Accept it", "Settle on this package"],
                  [
                    "request_revision",
                    "Ask for one change",
                    "Send it back once with an instruction",
                  ],
                  ["reject", "Reject it", "End with no agreement"],
                ] as Array<[RatificationChoice, string, string]>
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  disabled={!canDecide}
                  onClick={() => setChoice(value)}
                  className={cx(
                    "block w-full rounded-[var(--radius)] border-2 p-3.5 text-left transition-colors",
                    choice === value
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--line)] hover:border-[var(--ink-3)]",
                  )}
                >
                  <span className="block text-[0.9375rem] font-semibold">
                    {label}
                  </span>
                  <span className="block text-[0.8125rem] text-[var(--ink-2)]">
                    {hint}
                  </span>
                </button>
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
        onClick={submitDecision}
        disabled={!canSubmit}
        note={
          !canDecide
            ? "Read the conversation to the end first."
            : canSubmit
              ? ""
              : "Make a decision and rate the outcome."
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// One issue's instruction
// ---------------------------------------------------------------------------

function MandateCard({
  issue,
  im,
  role,
  onChange,
}: {
  issue: Issue;
  im: IssueMandate;
  role: Role;
  onChange: (patch: Partial<IssueMandate>) => void;
}) {
  return (
    <Card id={`q-aim-${issue.id}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.9375rem] font-semibold">{issue.label}</p>
          <p className="text-[0.875rem] text-[var(--ink-2)]">
            {issue.description}
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[0.8125rem]">
          <input
            type="checkbox"
            checked={im.entrusted}
            onChange={(e) => onChange({ entrusted: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Hand this over
        </label>
      </div>

      {im.entrusted ? (
        <div className="space-y-4">
          <Row label="Open by asking for">
            <OptionChips
              issue={issue}
              role={role}
              name={`aim-${issue.id}`}
              value={im.idealOptionId}
              onChange={(v) => onChange({ idealOptionId: v })}
            />
          </Row>

          <Row label="Never accept worse than">
            <OptionChips
              issue={issue}
              role={role}
              name={`floor-${issue.id}`}
              value={im.reservationOptionId ?? null}
              onChange={(v) =>
                onChange({ reservationOptionId: v === "" ? null : v })
              }
              allowNone
              noneLabel="No limit"
            />
          </Row>

          <Row label="How much this matters">
            <ChipRow
              name={`priority-${issue.id}`}
              value={im.priority}
              options={PRIORITY_OPTIONS}
              onChange={(v) => onChange({ priority: v as MandatePriority })}
            />
          </Row>

          <Row label="If they ask why">
            <ChipRow
              name={`rationale-${issue.id}`}
              value={im.rationalePolicy}
              options={RATIONALE_OPTIONS}
              onChange={(v) =>
                onChange({ rationalePolicy: v as RationalePolicy })
              }
            />
          </Row>

          <details>
            <summary className="cursor-pointer text-[0.8125rem] text-[var(--ink-2)]">
              Add a note for your assistant
            </summary>
            <div className="mt-2">
              <TextArea
                value={im.notes}
                rows={2}
                onChange={(v) => onChange({ notes: v })}
                placeholder="Anything else it should know about this issue."
              />
            </div>
          </details>
        </div>
      ) : null}

      <p
        className={cx(
          "mt-4 rounded-[var(--radius)] border-l-2 border-[var(--accent)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-[0.875rem] leading-relaxed",
          im.entrusted ? "text-[var(--ink)]" : "text-[var(--ink-2)]",
        )}
      >
        {instructionSentence(issue, im)}
      </p>
    </Card>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[0.8125rem] font-medium">{label}</p>
      {children}
    </div>
  );
}

function ChipRow({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <label
          key={o.value}
          className={cx(
            "cursor-pointer rounded-full border px-3 py-1.5 text-[0.8125rem] transition-colors",
            value === o.value
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "border-[var(--line-strong)] bg-[var(--surface)] hover:border-[var(--ink-3)]",
          )}
        >
          <input
            type="radio"
            name={name}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
