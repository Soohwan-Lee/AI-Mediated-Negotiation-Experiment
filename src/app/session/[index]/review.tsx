"use client";

/**
 * The review and ratification phase, shared by both conditions.
 *
 * TWO DECISIONS HAPPEN HERE, and keeping them apart is the whole point.
 *
 * A Leader first gives a STRUCTURED FOCAL RESPONSE — accommodate the other
 * side's difficult requirement, keep it but ask for something in exchange, or
 * ask for it to be reduced. That is Requirement Uptake, the third primary
 * outcome, and it is a judgement about the requirement rather than about the
 * package.
 *
 * Then EVERYONE ratifies, revises once, or rejects. This is deliberately not
 * folded into the previous decision: the tentative package is coded for
 * whether the focal threshold survived REGARDLESS of ratification, because a
 * participant who refuses a package that broke their threshold has not failed
 * to preserve it — they have preserved it by refusing. Collapsing the two
 * would lose that distinction (Methods ver.1.8 §Primary outcome 1).
 *
 * The transcript is here too, and the decision waits for its end to come into
 * view. Accepting an agreement without reading how it was reached would make
 * the ownership and representation items meaningless.
 */

import { useEffect, useRef, useState } from "react";
import { Transcript, type DisplayMessage } from "@/components/negotiation";
import { BriefingPanel, SessionHeader, SessionLayout } from "@/components/session";
import { ActionBar } from "@/components/study-chrome";
import { Callout, Card, CardTitle, Field, Page, TextArea, cx } from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { useParticipant } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { focalIssue, preservesFocalThreshold } from "@/lib/tasks";
import type {
  FocalResponse,
  NegotiationTask,
  Package,
  RatificationChoice,
  Role,
} from "@/lib/types";
import { DecisionButton, OutcomeValue, TermsList } from "./shared";

const RATIFY_OPTIONS: Array<[RatificationChoice, string, string]> = [
  ["ratify", "Accept it", "Settle on this package"],
  [
    "request_revision",
    "Ask for one change",
    "Send it back once with an instruction",
  ],
  ["reject", "Reject it", "End with no agreement"],
];

export function ReviewPhase({
  sessionIndex,
  task,
  role,
  steps,
  stepIndex,
  tentative,
  transcript,
  /** Proxy sessions show the exchange as something that already happened. */
  transcriptTitle,
  transcriptHint,
  onDone,
}: {
  sessionIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  stepIndex: number;
  tentative: Package | null;
  transcript: DisplayMessage[];
  transcriptTitle: string;
  transcriptHint: string;
  onDone: () => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const focal = focalIssue(task);
  const focalOption = tentative
    ? focal.options.find((o) => o.id === tentative[focal.id])
    : undefined;
  const held = tentative
    ? preservesFocalThreshold(task, tentative[focal.id])
    : false;

  const [focalResponse, setFocalResponse] = useState<FocalResponse | null>(null);
  const [choice, setChoice] = useState<RatificationChoice | null>(null);
  const [revisionNote, setRevisionNote] = useState("");

  const isReceiver = role === "leader";

  // The decision unlocks once the end of the transcript has been seen. A
  // marker is used rather than a scroll position because a short transcript
  // may already be fully visible, and that counts as read.
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
  }, [transcriptSeen]);

  useDevAutofill(() => {
    setFocalResponse((c) => c ?? "accommodate");
    setChoice((c) => c ?? "ratify");
    // The gate is "have they read to the end"; in mockup mode nobody has, and
    // waiting for an intersection that will not happen would strand the walk.
    setTranscriptSeen(true);
  }, `review-s${sessionIndex}`);

  const canDecide = useDevGate(transcriptSeen);
  const canSubmit = useDevGate(
    transcriptSeen &&
      choice !== null &&
      (!isReceiver || focalResponse !== null) &&
      (choice !== "request_revision" || revisionNote.trim().length > 0),
  );

  async function submit() {
    const decided = choice ?? (canSubmit ? "ratify" : null);
    if (!decided) return;

    if (participantKey) {
      await getStore().saveAgreement(participantKey, {
        sessionIndex,
        terms: task.issues.map((i) => ({
          issueId: i.id,
          optionId: tentative?.[i.id] ?? null,
          unresolved: !tentative?.[i.id],
        })),
        unresolvedIssueIds: tentative
          ? task.issues.filter((i) => !tentative[i.id]).map((i) => i.id)
          : task.issues.map((i) => i.id),
      });
      await getStore().saveRatification(participantKey, sessionIndex, decided);
      await getStore().saveResponses(
        participantKey,
        `session_outcome_s${sessionIndex}`,
        {
          choice: decided,
          revisionNote,
          // UPTAKE and SURV-FINAL are separate codes on purpose: a refused
          // package that held the threshold still counts as preserved.
          focalResponse,
          focalOptionId: tentative?.[focal.id] ?? null,
          focalPreserved: held,
        },
      );
    }

    logEvent(
      "ratification_choice",
      { choice: decided, focalResponse },
      { sessionIndex },
    );
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
            current={stepIndex}
          />

          <div className="mb-5">
            <Callout title="Nothing is settled until you say so">
              <p>
                This is the package on the table. It is not binding — you decide
                below whether it stands.
              </p>
            </Callout>
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <Card>
              <CardTitle>Where each term landed</CardTitle>
              {tentative ? (
                <TermsList task={task} terms={tentative} />
              ) : (
                <Callout tone="warning">
                  <p>No package was agreed. This is recorded as no agreement.</p>
                </Callout>
              )}
            </Card>
            <OutcomeValue task={task} terms={tentative} role={role} />
          </div>

          <Card className="mb-5 flex flex-col" padded={false}>
            <div className="border-b border-[var(--line)] px-5 py-4">
              <h2 className="text-[0.95rem] font-semibold">{transcriptTitle}</h2>
              <p className="mt-1 max-w-prose text-[0.875rem] text-[var(--ink-2)]">
                {transcriptHint} Read it before you decide — the decision below
                unlocks at the end.
              </p>
            </div>
            <Transcript
              messages={transcript}
              emptyHint="No messages were exchanged."
              flow
              endRef={transcriptEndRef}
            />
          </Card>

          {/* Requirement Uptake. Leaders only — it asks what to do about the
              other side's difficult requirement, which is not a decision the
              Member is in a position to make about their own. */}
          {isReceiver && focalOption ? (
            <Card className="mb-5" id="q-focal-response">
              <CardTitle
                hint={`They asked for ${focalOption.label.toLowerCase()} on ${focal.label.toLowerCase()}.`}
              >
                What do you want to do about that request?
              </CardTitle>
              <div className="grid gap-2 sm:grid-cols-3">
                <DecisionButton
                  selected={focalResponse === "accommodate"}
                  onClick={() => setFocalResponse("accommodate")}
                  label="Accept it"
                  hint="Leave it where it is"
                />
                <DecisionButton
                  selected={focalResponse === "trade"}
                  onClick={() => setFocalResponse("trade")}
                  label="Accept, in exchange"
                  hint="Keep it, but give ground elsewhere"
                />
                <DecisionButton
                  selected={focalResponse === "reduce"}
                  onClick={() => setFocalResponse("reduce")}
                  label="Ask to reduce it"
                  hint="Push for a lower level"
                />
              </div>
            </Card>
          ) : null}

          <Card>
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
              {RATIFY_OPTIONS.map(([value, label, hint]) => (
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
        </SessionLayout>
      </Page>

      <ActionBar
        label="Continue"
        onClick={submit}
        disabled={!canSubmit}
        note={
          !canDecide
            ? "Read the conversation to the end first."
            : canSubmit
              ? ""
              : isReceiver
                ? "Answer both questions above."
                : "Make a decision."
        }
      />
    </>
  );
}
