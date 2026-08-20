"use client";

/**
 * Baseline task (Experimental Design Ver.2.4 §8 "Baseline task 흐름").
 *
 * The participant chooses each package and writes each message. Every proposal
 * they send is understood by the other side as their own position — that is
 * what makes this the benchmark the two Proxy policies are read against.
 *
 * FIVE STAGES, NOT A FREE CHAT. Both conditions run the same five stages, so
 * the trajectories line up message for message. The rules bind the counterpart
 * only: Design §4 is explicit that the participant's behaviour is not forced
 * ("참가자의 행동은 강제하지 않음"), and the counterpart leads the stages.
 *
 * The counterpart is presented as another participant. It is a controlled LLM
 * behind /api/counterpart whose moves are decided by the state machine, so
 * every participant meets the same behaviour.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OptionChips } from "@/components/issues";
import {
  CountdownTimer,
  MessageComposer,
  StageRail,
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";
import { BriefingPanel, TaskHeader, TaskLayout } from "@/components/session";
import { ActionBar } from "@/components/study-chrome";
import { Card, CardTitle, Page } from "@/components/ui";
import {
  useDevActions,
  useDevAutofill,
  useDevGate,
  useDevMockAi,
} from "@/lib/dev-mode";
import {
  NEGOTIATION_SECONDS,
  STAGES,
  STAGE_GOALS,
  STAGE_PROMPTS,
  counterpartStep,
} from "@/lib/negotiation/machine";
import { scriptedTask } from "@/lib/negotiation/script";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { counterpartDelayMs, nextHref } from "@/lib/study-config";
import { counterpartOpening, getTask, requirementIssue } from "@/lib/tasks";
import type { Package, Role, StageId, TaskId } from "@/lib/types";
import { ReviewPhase } from "./review";
import {
  Matchmaking,
  PreferenceForm,
  ReasonPicker,
  RiskForm,
  TaskBrief,
  type Preferences,
} from "./shared";

/**
 * The counterpart's opening, in words.
 *
 * Used when no scripted line is available — outside mockup mode the real
 * system generates this through `/api/counterpart`, but the participant must
 * never arrive at an empty conversation, because the fixed opening is the
 * anchor their reply is measured against.
 */
function openingLine(
  task: ReturnType<typeof getTask>,
  counterpartRole: Role,
): string {
  const opening = counterpartOpening(task, counterpartRole);
  const terms = task.issues
    .map((i) => i.options.find((o) => o.id === opening[i.id])?.label)
    .filter(Boolean)
    .join(", ");
  return `hi! good to be sorting this out. || my opening would be ${terms} — but tell me what matters most on your side.`;
}

type Phase =
  | "brief"
  | "prefs"
  | "risk"
  | "matchmaking"
  | "negotiate"
  | "review";

const PHASES: Phase[] = [
  "brief",
  "prefs",
  "risk",
  "matchmaking",
  "negotiate",
  "review",
];

/** Phase labels shown in the task header. Matchmaking has no step of its own. */
const STEP_LABELS = [
  "Your briefing",
  "What you want",
  "Before you start",
  "Negotiate",
  "Review",
];

const STEP_OF: Record<Phase, number> = {
  brief: 0,
  prefs: 1,
  risk: 2,
  matchmaking: 3,
  negotiate: 3,
  review: 4,
};

export function BaselineTask({
  taskIndex,
  taskId,
  role,
}: {
  taskIndex: 1 | 2;
  taskId: TaskId;
  role: Role;
}) {
  usePageEnter(`task-${taskIndex}`);
  const router = useRouter();
  const { logEvent, participantKey } = useParticipant();
  const task = getTask(taskId);
  const requirement = requirementIssue(task, role);
  const counterpartRole: Role = role === "leader" ? "member" : "leader";

  const [phase, setPhase] = useState<Phase>("brief");
  const [stage, setStage] = useState<StageId>(1);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [offer, setOffer] = useState<Package>({});
  const [tentative, setTentative] = useState<Package | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [outOfTime, setOutOfTime] = useState(false);

  /**
   * Which reason card, if any, the participant attached to this message.
   *
   * Not decoration. Design §4's reason-linked acceptance rule needs a
   * deterministic answer to "has a reason been given for this requirement",
   * and asking a model to judge whether free text contained a good argument
   * would put the judgement back with the model. A structured attachment keeps
   * it with the system — and it is also the Baseline analogue of the Proxy
   * mandate's checked cards, so the voiced-reason log has the same shape in
   * both conditions.
   */
  const [attachedReasonId, setAttachedReasonId] = useState<string | null>(null);
  const [voicedReasonIds, setVoicedReasonIds] = useState<string[]>([]);
  const [reasonRequested, setReasonRequested] = useState(false);

  /**
   * Revisions spent. Held here rather than on the review screen because a
   * revision sends the participant back into the conversation and returns
   * them, remounting that screen — a counter living there reset on the way and
   * the one-revision cap held only until someone used it.
   */
  const [revisionsUsed, setRevisionsUsed] = useState(0);
  const [lastCounterpartPackage, setLastCounterpartPackage] =
    useState<Package | null>(null);

  const mockAi = useDevMockAi();

  // An opening package needs every term chosen; later stages may reply without
  // changing the offer. Computed here rather than beside the composer because
  // the phase branches below return early, and a hook cannot sit behind that.
  const chosen = task.issues.filter((i) => offer[i.id]).length;
  const canSend = useDevGate(chosen === task.issues.length || stage !== 1);

  /**
   * The written exchange for this cell, used in mockup mode.
   *
   * Both sides are scripted, including the participant's own messages — the
   * point of the mockup is to see the screens as they will actually read, and
   * an empty composer on stage 4 tells you nothing about whether the review
   * screen that follows makes sense.
   */
  const script = scriptedTask(task, role, "baseline");

  useDevActions(
    `task-${taskIndex}`,
    PHASES.map((p) => ({
      id: p,
      label: p,
      active: phase === p,
      run: () => {
        // Jumping straight to the review needs something to review, so the
        // scripted exchange is played in without waiting for it.
        if (p === "review" && messages.length === 0) {
          setMessages(
            script.messages.map((m) => ({
              id: m.id,
              speaker: m.speaker,
              text: m.text,
            })),
          );
          setTentative(script.tentative);
          setOffer(script.tentative);
        }
        setPhase(p);
      },
    })),
  );

  // Pre-fills the composer and the package selector for the current stage.
  useDevAutofill(() => {
    const own = script.messages.find(
      (m) => m.stage === stage && m.speaker === "participant",
    );
    if (own) {
      setDraft(own.text);
      if (own.proposal) setOffer(own.proposal);
      if (own.reasonCardId) setAttachedReasonId(own.reasonCardId);
    }
  }, `baseline-t${taskIndex}-${phase}-${stage}`);

  async function send(text: string) {
    const own: DisplayMessage = {
      id: `p${messages.length}`,
      speaker: "participant",
      text,
    };
    const next = [...messages, own];
    setMessages(next);
    setDraft("");

    const voiced = attachedReasonId
      ? [...new Set([...voicedReasonIds, attachedReasonId])]
      : voicedReasonIds;
    setVoicedReasonIds(voiced);
    setAttachedReasonId(null);

    logEvent(
      "message_sent",
      {
        length: text.length,
        stage,
        requirementOption: offer[requirement.id] ?? null,
        reasonCardId: attachedReasonId,
      },
      { sessionIndex: taskIndex },
    );

    if (participantKey) {
      void getStore().appendMessage(participantKey, {
        id: own.id,
        sessionIndex: taskIndex,
        speaker: "participant",
        text,
        createdAt: new Date().toISOString(),
        stage,
        proposal: Object.keys(offer).length > 0 ? offer : undefined,
        reasonCardId: attachedReasonId ?? undefined,
      });
    }

    setPending(true);
    try {
      let reply: string;
      let counterProposal: Package | null = null;

      // The exchange state the acceptance rule reads. A reason counts as given
      // once the participant has attached any card to any message — the system
      // decides this from the log, never the model (Design §4 판정 주체).
      const exchangeState = {
        reasonGivenForRequirement: voiced.length > 0,
        reasonAlreadyRequested: reasonRequested,
      };

      // Design §4 gives each stage one message per side, counterpart first.
      // The counterpart's stage-1 line was the opening the participant replied
      // to, so what follows their stage-N message is the counterpart's
      // stage-(N+1) line — and after stage 5 there is none: the tentative
      // package closes the exchange at ten messages.
      //
      // Returning here rather than generating and then declining to show the
      // result is the point. Deciding this from whether a reply came back
      // empty worked in mockup mode and not in the live path, where a missing
      // message falls back to a non-empty string and the transcript ran to
      // eleven.
      if (stage >= 5) {
        // The counterpart still runs its closing test, it just does not speak
        // again. An impasse is a real outcome: recording the participant's
        // last offer as a tentative agreement when the counterpart rejected it
        // would invent an agreement that never happened.
        const decision = counterpartStep(
          task,
          counterpartRole,
          5,
          offer,
          lastCounterpartPackage,
          exchangeState,
        );
        setTentative(decision.impasse ? null : offer);
        setPhase("review");
        return;
      }

      // Which of the counterpart's five turns comes next.
      //
      // Not the participant's current stage. Its stage-1 line was the opening
      // they are replying to, so what follows their stage-N message is the
      // counterpart's stage-(N+1) turn. Getting this wrong put the
      // standardized challenge — a stage-3 move — one stage late, after the
      // participant had already replied to a challenge nobody had made.
      const counterpartStageNow = (stage + 1) as StageId;

      const decision = counterpartStep(
        task,
        counterpartRole,
        counterpartStageNow,
        offer,
        lastCounterpartPackage,
        exchangeState,
      );
      if (decision.awaitingReason) setReasonRequested(true);
      counterProposal = decision.proposal;

      if (mockAi) {
        const scripted = script.messages.find(
          (m) => m.stage === counterpartStageNow && m.speaker === "counterpart",
        );
        reply = scripted?.text ?? "";
        await new Promise((r) => setTimeout(r, 400));
      } else {
        const res = await fetch("/api/counterpart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            participantRole: role,
            stage: counterpartStageNow,
            incoming: offer,
            lastCounterpartPackage,
            reasonGiven: exchangeState.reasonGivenForRequirement,
            reasonAlreadyRequested: exchangeState.reasonAlreadyRequested,
            history: next.map((m) => ({
              role: m.speaker === "participant" ? "user" : "assistant",
              content: m.text,
            })),
          }),
        });

        const data = (await res.json()) as {
          message?: string;
          proposal?: Package | null;
        };
        reply =
          data.message ??
          "sorry, lost my train of thought there — could you say that again?";
        counterProposal = data.proposal ?? null;

        // The reply is delayed in proportion to its own length and jittered,
        // so the exchange does not answer a one-line question and a full
        // counterpackage in the same beat — which is what a machine does and a
        // person does not.
        await new Promise((r) =>
          setTimeout(r, counterpartDelayMs(reply.length)),
        );
      }

      if (counterProposal) setLastCounterpartPackage(counterProposal);

      if (reply) {
        const counter: DisplayMessage = {
          id: `c${next.length}`,
          speaker: "counterpart",
          text: reply,
        };
        setMessages((m) => [...m, counter]);

        if (participantKey) {
          void getStore().appendMessage(participantKey, {
            id: counter.id,
            sessionIndex: taskIndex,
            speaker: "counterpart",
            text: reply,
            createdAt: new Date().toISOString(),
            stage: counterpartStageNow,
            proposal: counterProposal ?? undefined,
            decidedAction: decision.action,
          });
        }
      }

      setStage((s) => (s + 1) as StageId);
    } finally {
      setPending(false);
    }
  }

  // --- phases -------------------------------------------------------------

  if (phase === "brief") {
    return (
      <TaskBrief
        taskIndex={taskIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        onContinue={() => setPhase("prefs")}
      />
    );
  }

  if (phase === "prefs") {
    return (
      <PreferenceForm
        taskIndex={taskIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        stepIndex={STEP_OF.prefs}
        isProxy={false}
        onContinue={(p) => {
          setPrefs(p);
          // The offer selector starts where they said they wanted to be, so
          // the first package is a considered position rather than whatever
          // the empty control produced.
          setOffer(
            Object.fromEntries(
              task.issues
                .map((i) => [i.id, p.preferred[i.id]])
                .filter(([, v]) => v) as Array<[string, string]>,
            ),
          );
          setPhase("risk");
        }}
      />
    );
  }

  if (phase === "risk") {
    return (
      <RiskForm
        taskIndex={taskIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        stepIndex={STEP_OF.risk}
        onContinue={() => setPhase("matchmaking")}
      />
    );
  }

  if (phase === "matchmaking") {
    return (
      <Matchmaking
        onReady={() => {
          // The counterpart opens, and its opening is FIXED (Design §4 stage
          // 1: its own best package on all three terms). Every participant
          // therefore answers the same anchor, which is what makes their
          // replies comparable — and it is the same order the Proxy tasks run,
          // so Baseline and Proxy transcripts line up stage for stage.
          //
          // Seeding the message here rather than waiting for the first send is
          // the point: otherwise the participant opens into nothing and the
          // anchor never existed.
          const opening = counterpartOpening(task, counterpartRole);
          setLastCounterpartPackage(opening);
          const scripted = script.messages.find(
            (m) => m.stage === 1 && m.speaker === "counterpart",
          );
          setMessages([
            {
              id: "c-open",
              speaker: "counterpart",
              text: scripted?.text ?? openingLine(task, counterpartRole),
            },
          ]);
          logEvent("negotiation_started", undefined, {
            sessionIndex: taskIndex,
          });
          setPhase("negotiate");
        }}
      />
    );
  }

  if (phase === "review") {
    return (
      <ReviewPhase
        taskIndex={taskIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        stepIndex={STEP_OF.review}
        tentative={tentative}
        transcript={messages}
        revisionsUsed={revisionsUsed}
        isProxy={false}
        transcriptTitle="The conversation"
        transcriptHint="Everything the two of you said."
        onRevise={(note) => {
          // Sending it back means saying so yourself: the participant returns
          // to the conversation with one more turn to put a different package
          // on the table. One revision only — the review screen stops offering
          // it after the first.
          setRevisionsUsed((n) => n + 1);
          setDraft(note);
          setStage(5);
          setPhase("negotiate");
          logEvent("mandate_revised", { note, fromReview: true }, {
            sessionIndex: taskIndex,
          });
        }}
        onDone={() => {
          logEvent("page_complete", undefined, {
            page: `task-${taskIndex}`,
            sessionIndex: taskIndex,
          });
          router.push(nextHref(taskIndex === 1 ? "task-1" : "task-2"));
        }}
      />
    );
  }

  // --- negotiate ----------------------------------------------------------

  return (
    <>
      <Page width="wide">
        <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
          <TaskHeader
            taskIndex={taskIndex}
            title={task.title}
            steps={STEP_LABELS}
            current={STEP_OF.negotiate}
            aside={
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1 text-[0.8125rem] text-[var(--ink-2)]">
                <span aria-hidden>⏱</span>
                <CountdownTimer
                  seconds={NEGOTIATION_SECONDS}
                  running={!outOfTime}
                  onExpire={() => setOutOfTime(true)}
                />
              </span>
            }
          />

          <Card className="mb-5 flex flex-col" padded={false}>
            <StageRail
              stage={stage}
              goals={STAGE_GOALS}
              note={outOfTime ? "Time is up — send your last message." : undefined}
            />
            <p className="border-b border-[var(--line)] px-4 py-2.5 text-[0.8125rem] text-[var(--ink-2)]">
              {STAGE_PROMPTS[stage]}
            </p>
            <Transcript
              messages={messages}
              pending={pending}
              emptyHint="They open first. Your reply starts the exchange."
            />

            <ReasonPicker
              task={task}
              role={role}
              value={attachedReasonId}
              onChange={setAttachedReasonId}
              alreadyVoiced={voicedReasonIds}
            />

            <MessageComposer
              value={draft}
              onChange={setDraft}
              onSend={send}
              disabled={pending || !canSend}
              sendLabel={stage >= 5 ? "Send and finish" : "Send"}
              placeholder={
                canSend
                  ? "Write your message…"
                  : "Choose an option on each term first."
              }
            />
          </Card>

          <Card>
            <CardTitle hint="This is the package you are proposing. Update it as the conversation moves.">
              📦 Your current offer
            </CardTitle>
            <div className="space-y-4">
              {task.issues.map((issue) => (
                <div key={issue.id}>
                  <p className="mb-1.5 text-[0.8125rem] font-medium">
                    {issue.label}
                    {prefs?.minimum[issue.id] ? (
                      <span className="ml-2 font-normal text-[var(--ink-3)]">
                        least you would take:{" "}
                        {
                          issue.options.find(
                            (o) => o.id === prefs.minimum[issue.id],
                          )?.label
                        }
                      </span>
                    ) : null}
                  </p>
                  <OptionChips
                    issue={issue}
                    role={role}
                    name={`offer-${issue.id}`}
                    value={offer[issue.id] ?? null}
                    onChange={(v) =>
                      setOffer((prev) => ({ ...prev, [issue.id]: v }))
                    }
                    allowNone
                    noneLabel="Not specified"
                  />
                </div>
              ))}
            </div>
          </Card>
        </TaskLayout>
      </Page>

      {/* No "finish early" control.
          The five stages have to be walked, because the trajectory this study
          measures is made of the transitions between them — what was opened
          with, what survived the standardized challenge, what reached the
          final package. An action bar that jumped to the review from stage 1
          would produce a task with an opening and a final position and nothing
          in between, and it would do so precisely for the participants least
          engaged with the negotiation. The task ends when the last message is
          sent. */}
      <ActionBar
        note={`${chosen} of ${task.issues.length} terms chosen · step ${stage} of ${STAGES.length}`}
      />
    </>
  );
}
