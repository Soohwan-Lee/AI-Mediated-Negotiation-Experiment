"use client";

/**
 * Where the task landed, shared by both conditions.
 *
 * THERE IS NO LONGER AN APPROVE/REJECT STEP, and its removal follows from the
 * ver.2.4 handover. Ratification made sense when the AI Proxies produced the
 * final package on their own and the participant had never spoken: something
 * had to stand between a machine's agreement and the participant's own. Now
 * both arms end with the participant themselves agreeing a package in
 * conversation, so asking "do you accept this?" immediately afterwards asks
 * them to re-decide what they have just decided. Worse, it offers a way to
 * undo an agreement that the other side has no matching way to undo, which is
 * not a control either arm's counterpart has.
 *
 * ONE JUDGEMENT REMAINS: what they want to do about THE OTHER SIDE'S
 * requirement. That is not a duplicate of the negotiation — it is the §9.3.1
 * uptake code, and reading it off the transcript afterwards would mean a coder
 * inferring an intention the participant can simply be asked for. Both roles
 * answer it, because ver.2.4 gives both roles a requirement.
 *
 * The outcome is therefore recorded straight from the package the two of them
 * reached. `ownRequirementPreserved` is coded from the package regardless of
 * how they feel about it, which is what §9.3.1 asks for.
 *
 * The transcript is here too, and the screen waits for its end to come into
 * view. Moving on without reading how it was reached would make the
 * representation and ownership items meaningless — and OWN-AI4
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
  Cue,
  Page,
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
import type { NegotiationTask, Package, Role } from "@/lib/types";
import {
  DecisionButton,
  OutcomeValue,
  ProxyTranscriptPanel,
  TermsList,
} from "./shared";

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
  proxyTranscript,
  isProxy,
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
  /**
   * The AI Proxies' exchange, in a Proxy task. Shown ALONGSIDE the
   * participant's own conversation, never instead of it.
   *
   * Both have to be here. The participant's own words are what the decision is
   * about; the proxies' are what several of the following items ask them to
   * judge — whether the other side's requirement read as genuinely theirs,
   * whether their own proxy represented them, who is answerable. Showing only
   * one makes half the questionnaire a memory test.
   */
  proxyTranscript?: DisplayMessage[];
  /** Proxy tasks show the other participant's closing message. */
  isProxy: boolean;
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

  // The question unlocks once the end of the transcript has been seen. A
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
    // The gate is "have they read to the end"; in mockup mode nobody has, and
    // waiting for an intersection that will not happen would strand the walk.
    setTranscriptSeen(true);
  }, `review-t${taskIndex}`);

  const canDecide = useDevGate(transcriptSeen);
  const needsRequirementResponse = Boolean(theirOption);
  const canSubmit = useDevGate(
    transcriptSeen && (!needsRequirementResponse || requirementResponse !== null),
  );

  async function submit() {
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
      await getStore().saveResponses(
        participantKey,
        `task_outcome_t${taskIndex}`,
        {
          // Whether the negotiation produced a package at all. This used to be
          // implicit in the ratification choice; with the choice gone it is
          // stated, because "no agreement" and "an agreement" are different
          // outcomes and every downstream measure needs to tell them apart.
          outcome: tentative ? "agreement" : "no_agreement",
          // The uptake code (§9.3.1). Asked rather than inferred, because a
          // coder reading the transcript would be guessing at an intention the
          // participant can be asked for directly.
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
      "task_outcome_recorded",
      {
        outcome: tentative ? "agreement" : "no_agreement",
        requirementResponse,
      },
      { sessionIndex: taskIndex },
    );

    // A Proxy task fires `negotiation_ended` more than once — once when the AI
    // Proxies finish, once when the direct conversation closes. The marker is
    // what keeps them apart; without it they are distinguishable only by
    // arrival order, and anything that counts or joins on the event
    // double-counts the Proxy arm against a Baseline arm that fires it fewer
    // times. This one closes the task itself.
    logEvent("negotiation_ended", { phase: "task_closed" }, {
      sessionIndex: taskIndex,
    });
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

          {/* This states the result; it does not ask for one. The participant
              settled these terms themselves a moment ago, so a screen that
              asked "do you accept this?" would be asking them to re-decide
              what they have just decided — see the note at the top of the
              file. */}
          <div className="mb-5">
            {tentative ? (
              <Callout title="✅ This is what the two of you agreed">
                <p>
                  The negotiation is over and this is where it settled. Below is
                  what it is worth to you, and everything that was said.
                </p>
              </Callout>
            ) : (
              <Callout title="🤝 You did not reach an agreement" tone="warning">
                <p>
                  The negotiation ended without a package, so the project falls
                  back to the limited plan and you take your fallback score.
                </p>
              </Callout>
            )}
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

          {/* The proxies' exchange, collapsed. Above the participant's own
              conversation because it came first, and collapsed because the
              decision below is about the conversation they had themselves. */}
          {proxyTranscript?.length ? (
            <ProxyTranscriptPanel transcript={proxyTranscript} />
          ) : null}

          <Card className="mb-5 flex flex-col" padded={false}>
            <div className="border-b border-[var(--line)] px-5 py-4">
              <h2 className="text-[0.95rem] font-semibold">{transcriptTitle}</h2>
              <p className="mt-1 max-w-prose text-[0.875rem] text-[var(--ink-2)]">
                {transcriptHint}{" "}
                {needsRequirementResponse
                  ? "Read to the end — the question below it opens once you have."
                  : "Read to the end before you continue."}
              </p>
            </div>
            <Transcript
              messages={transcript}
              emptyHint="No messages were exchanged."
              flow
              endRef={transcriptEndRef}
            />
          </Card>

          {/* The response to THE OTHER SIDE'S requirement — the one judgement
              left on this screen, and the §9.3.1 uptake code. Both roles
              answer it: ver.2.4 gives each role a requirement, so each is also
              the receiver of one.

              It carries the cue now that the approve/reject card is gone,
              which is also why it is inert until the transcript has been read:
              the question is about how they handled something specific that
              was said, so answering it without having read to the end would be
              answering about a conversation they had not looked at. */}
          {theirOption ? (
            <Card
              className="mb-5"
              id="q-requirement-response"
              cue={canDecide && requirementResponse === null}
            >
              <CardTitle
                hint={`They ended up at ${theirOption.label.toLowerCase()} on ${theirs.label.toLowerCase()}.`}
                aside={
                  canDecide && requirementResponse === null ? (
                    <Cue>Choose one</Cue>
                  ) : null
                }
              >
                🤝 What do you want to do about what they asked for?
              </CardTitle>

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
                  "grid gap-2 transition-opacity sm:grid-cols-3",
                  !canDecide && "pointer-events-none opacity-40",
                )}
                aria-disabled={!canDecide}
              >
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
              : "Answer the question above."
        }
      />
    </>
  );
}
