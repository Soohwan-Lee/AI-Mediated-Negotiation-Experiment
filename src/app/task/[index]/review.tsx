"use client";

/**
 * The review and ratification phase, shared by both conditions.
 *
 * TWO DECISIONS HAPPEN HERE, and keeping them apart is the whole point.
 *
 * First a response to THE OTHER SIDE'S requirement — accept it, keep it in
 * exchange for something, or ask for it to be reduced. Both roles answer it
 * now, because ver.2.4 gives both roles a requirement, so both are receivers
 * of one.
 *
 * Then everyone ratifies, revises once, or rejects. This is deliberately not
 * folded into the previous decision: the tentative package is coded for
 * whether each requirement survived REGARDLESS of ratification, because a
 * participant who refuses a package that broke their own threshold has not
 * failed to preserve it — they preserved it by refusing. Collapsing the two
 * would lose that distinction (Design §9.3.1).
 *
 * The transcript is here too, and the decision waits for its end to come into
 * view. Accepting an agreement without reading how it was reached would make
 * the representation and ownership items meaningless — and OWN-AI4
 * (over-reliance) is interpreted against exactly this: whether they looked.
 */

import { useEffect, useRef, useState } from "react";
import { Transcript, type DisplayMessage } from "@/components/negotiation";
import { BriefingPanel, TaskHeader, TaskLayout } from "@/components/session";
import { ActionBar } from "@/components/study-chrome";
import {
  Callout,
  Card,
  CardTitle,
  Field,
  Page,
  TextArea,
  cx,
} from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { useParticipant } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { ACCEPTANCE } from "@/lib/negotiation/machine";
import {
  counterRequirementIssue,
  preservesRequirement,
  requirementIssue,
  scorePackage,
} from "@/lib/tasks";
import type {
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

/**
 * How the participant responded to the other side's requirement.
 *
 *  accommodate  accepted as it stands
 *  trade        kept, but paid for elsewhere
 *  reduce       asked to go below it, or refused
 */
type RequirementResponse = "accommodate" | "trade" | "reduce";

export function ReviewPhase({
  taskIndex,
  task,
  role,
  steps,
  stepIndex,
  tentative,
  transcript,
  transcriptTitle,
  transcriptHint,
  revisionsUsed,
  isProxy,
  onRevise,
  onDone,
}: {
  taskIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  stepIndex: number;
  tentative: Package | null;
  transcript: DisplayMessage[];
  transcriptTitle: string;
  transcriptHint: string;
  /** How many revisions this task has already spent. Owned by the task. */
  revisionsUsed: number;
  /** Proxy tasks show the other participant's ratification message. */
  isProxy: boolean;
  /**
   * Send the package back once with the participant's instruction.
   *
   * Required, not optional. "Ratify / one revision / reject" is what makes
   * this bounded delegation rather than a rubber stamp — it is the commitment
   * authority the design keeps with the human and the instructions promise in
   * as many words. A revision that recorded the request and moved on
   * regardless would show the participant the control is cosmetic, which is
   * worse than not offering it.
   */
  onRevise: (note: string) => Promise<void> | void;
  onDone: () => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const mine = requirementIssue(task, role);
  const theirs = counterRequirementIssue(task, role);
  const counterpartRole: Role = role === "leader" ? "member" : "leader";

  const theirOption = tentative
    ? theirs.options.find((o) => o.id === tentative[theirs.id])
    : undefined;
  const heldMine = tentative
    ? preservesRequirement(task, role, tentative[mine.id])
    : false;

  /**
   * What the counterpart principal says, chosen by the same threshold the rest
   * of the exchange uses (Design §4 §"Proxy 조건에서 상대 참가자의 발화 수칙").
   *
   * These are the three templates §15 P2 renders. They are inlined here rather
   * than generated because the mockup has to read correctly offline; before
   * collection this should go through `/api/counterpart` with
   * `kind: "counterpart_principal"` so the voice matches the rest of the
   * exchange. The DECISION stays here either way — it is the state machine's,
   * not the model's.
   */
  const principalLine = !tentative
    ? "ah, that's a shame. || understood though — we'll go with the fallback plan then."
    : scorePackage(task, tentative, counterpartRole) >= ACCEPTANCE.T_FINAL
      ? "did you catch all that? || the package works on my end — approving from my side."
      : "hmm. || this one doesn't quite work for me — I'd rather take the fallback.";

  const [requirementResponse, setRequirementResponse] =
    useState<RequirementResponse | null>(null);
  const [choice, setChoice] = useState<RatificationChoice | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  // "One revision" is a real limit, not a phrase in a hint — so once it has
  // been used the option stops being offered.
  //
  // The count is owned by the TASK, not by this screen. A revision sends the
  // participant back into the negotiation and returns them here, which
  // remounts this component; a local counter reset to zero on the way and the
  // option came back, so the cap held only until someone used it.

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
    setRequirementResponse((c) => c ?? "accommodate");
    setChoice((c) => c ?? "ratify");
    // The gate is "have they read to the end"; in mockup mode nobody has, and
    // waiting for an intersection that will not happen would strand the walk.
    setTranscriptSeen(true);
  }, `review-t${taskIndex}`);

  const canDecide = useDevGate(transcriptSeen);
  const needsRequirementResponse = Boolean(theirOption);
  const canSubmit = useDevGate(
    transcriptSeen &&
      choice !== null &&
      (!needsRequirementResponse || requirementResponse !== null) &&
      (choice !== "request_revision" || revisionNote.trim().length > 0),
  );

  async function submit() {
    const decided = choice ?? (canSubmit ? "ratify" : null);
    if (!decided) return;

    if (participantKey) {
      await getStore().saveAgreement(participantKey, {
        sessionIndex: taskIndex,
        terms: task.issues.map((i) => ({
          issueId: i.id,
          optionId: tentative?.[i.id] ?? null,
          unresolved: !tentative?.[i.id],
        })),
        unresolvedIssueIds: tentative
          ? task.issues.filter((i) => !tentative[i.id]).map((i) => i.id)
          : task.issues.map((i) => i.id),
      });
      await getStore().saveRatification(participantKey, taskIndex, decided);
      await getStore().saveResponses(
        participantKey,
        `task_outcome_t${taskIndex}`,
        {
          choice: decided,
          revisionNote,
          // The uptake code and the preservation code are separate on purpose:
          // a refused package that held the threshold still counts as
          // preserved.
          requirementResponse,
          ownRequirementOptionId: tentative?.[mine.id] ?? null,
          ownRequirementPreserved: heldMine,
          theirRequirementOptionId: tentative?.[theirs.id] ?? null,
          theirRequirementPreserved: tentative
            ? preservesRequirement(task, counterpartRole, tentative[theirs.id])
            : false,
        },
      );
    }

    logEvent(
      "ratification_choice",
      { choice: decided, requirementResponse, revisionsUsed },
      { sessionIndex: taskIndex },
    );

    if (decided === "request_revision") {
      setChoice(null);
      setRevisionNote("");
      setTranscriptSeen(false);
      await onRevise(revisionNote);
      return;
    }

    logEvent("negotiation_ended", undefined, { sessionIndex: taskIndex });
    onDone();
  }

  return (
    <>
      <Page width="wide">
        <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
          <TaskHeader
            taskIndex={taskIndex}
            title="Where it landed"
            steps={steps}
            current={stepIndex}
          />

          <div className="mb-5">
            <Callout title="⏸ Nothing is settled until you say so">
              <p>
                This is the package on the table. It is not binding — you decide
                below whether it stands.
              </p>
            </Callout>
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <Card>
              <CardTitle>📦 Where each term landed</CardTitle>
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

          {/* The other participant's one line (Design §4 "잠정안 도출 후").
              In a Proxy task the counterpart principal is silent throughout the
              negotiation and speaks exactly once, here — which is what makes
              them a person who was watching rather than an absence.

              WHICH of the three templates they say is decided by the same
              threshold everything else uses, not by assumption. Approving
              unconditionally would have had them accept a package worth less
              than their own fallback, and staying silent at an impasse would
              have left the participant with no acknowledgement that anyone was
              on the other side at all. */}
          {isProxy ? (
            <Card className="mb-5">
              <CardTitle>💬 The other participant</CardTitle>
              <Transcript
                messages={[
                  {
                    id: "principal-ratify",
                    speaker: "counterpart_principal",
                    text: principalLine,
                  },
                ]}
                flow
              />
            </Card>
          ) : null}

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

          {/* The response to THE OTHER SIDE'S requirement. Both roles answer
              it: ver.2.4 gives each role a requirement, so each is also the
              receiver of one. */}
          {theirOption ? (
            <Card className="mb-5" id="q-requirement-response">
              <CardTitle
                hint={`They ended up at ${theirOption.label.toLowerCase()} on ${theirs.label.toLowerCase()}.`}
              >
                🤝 What do you want to do about what they asked for?
              </CardTitle>
              <div className="grid gap-2 sm:grid-cols-3">
                <DecisionButton
                  selected={requirementResponse === "accommodate"}
                  onClick={() => setRequirementResponse("accommodate")}
                  label="Accept it"
                  hint="Leave it where it is"
                />
                <DecisionButton
                  selected={requirementResponse === "trade"}
                  onClick={() => setRequirementResponse("trade")}
                  label="Accept, in exchange"
                  hint="Keep it, but give ground elsewhere"
                />
                <DecisionButton
                  selected={requirementResponse === "reduce"}
                  onClick={() => setRequirementResponse("reduce")}
                  label="Ask to reduce it"
                  hint="Push for a lower level"
                />
              </div>
            </Card>
          ) : null}

          <Card>
            <CardTitle>✅ Your decision</CardTitle>

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
              {RATIFY_OPTIONS.filter(
                ([value]) => value !== "request_revision" || revisionsUsed < 1,
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
        </TaskLayout>
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
              : needsRequirementResponse
                ? "Answer both questions above."
                : "Make a decision."
        }
      />
    </>
  );
}
