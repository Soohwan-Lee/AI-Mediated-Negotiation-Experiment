"use client";

/**
 * Baseline session (Methods ver.1.8 §Baseline).
 *
 * The participant chooses each package and writes each message. Every proposal
 * they send is understood by the other side as their own official position —
 * that is what makes this the benchmark the two Proxy policies are read
 * against.
 *
 * FIVE STAGES, NOT A FREE CHAT. The old surface was an open conversation with
 * a turn counter, which meant a Baseline transcript and a Proxy transcript had
 * no common structure and could not be compared message for message. Both now
 * run the same five stages — opening, priorities, the standardized challenge,
 * a conditional trade, and the tentative package — so the trajectories line up
 * (Methods §Five-stage controlled interaction).
 *
 * The counterpart is presented as another participant. It is a controlled LLM
 * behind /api/counterpart whose moves are decided by the state machine, so
 * every participant meets the same behaviour.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OptionChips } from "@/components/issues";
import {
  MessageComposer,
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";
import { BriefingPanel, SessionHeader, SessionLayout } from "@/components/session";
import { ActionBar } from "@/components/study-chrome";
import { Callout, Card, CardTitle, Page } from "@/components/ui";
import { useDevActions, useDevAutofill, useDevGate, useDevMockAi } from "@/lib/dev-mode";
import { STAGES, STAGE_LABELS, STAGE_PROMPTS, counterpartStep } from "@/lib/negotiation/machine";
import { scriptedSession } from "@/lib/negotiation/script";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { NEGOTIATION, nextHref } from "@/lib/study-config";
import { counterpartOpening, focalIssue, getTask } from "@/lib/tasks";
import type { Package, Role, StageId, TaskId } from "@/lib/types";
import { ReviewPhase } from "./review";
import { PostTaskSurvey, PrivateTargetForm, SessionBrief } from "./shared";

type Phase = "brief" | "target" | "negotiate" | "review" | "post";

const PHASES: Phase[] = ["brief", "target", "negotiate", "review", "post"];
const STEP_LABELS = [
  "Your briefing",
  "Before you begin",
  "Negotiate",
  "Review",
  "Questions",
];

export function BaselineSession({
  sessionIndex,
  taskId,
  role,
}: {
  sessionIndex: 1 | 2;
  taskId: TaskId;
  role: Role;
}) {
  usePageEnter(`session-${sessionIndex}`);
  const router = useRouter();
  const { logEvent, participantKey } = useParticipant();
  const task = getTask(taskId);
  const focal = focalIssue(task);
  const counterpartRole: Role = role === "leader" ? "member" : "leader";

  const [phase, setPhase] = useState<Phase>("brief");
  const [stage, setStage] = useState<StageId>(1);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [offer, setOffer] = useState<Package>({});
  const [tentative, setTentative] = useState<Package | null>(null);
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
  const script = scriptedSession(task, role, "baseline");

  /** The scripted message this side would send at the current stage. */
  function scriptedOwnMessage(atStage: StageId) {
    return script.messages.find(
      (m) => m.stage === atStage && m.speaker === "participant",
    );
  }

  useDevActions(
    `session-${sessionIndex}`,
    PHASES.map((p, i) => ({
      id: p,
      label: STEP_LABELS[i],
      active: phase === p,
      run: () => {
        // Jumping straight to the review needs something to review, so the
        // scripted exchange is played in without waiting for it.
        if ((p === "review" || p === "post") && messages.length === 0) {
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
    const own = scriptedOwnMessage(stage);
    if (own) {
      setDraft(own.text);
      if (own.proposal) setOffer(own.proposal);
    }
  });

  async function send(text: string) {
    const own: DisplayMessage = {
      id: `p${messages.length}`,
      speaker: "participant",
      text,
    };
    const next = [...messages, own];
    setMessages(next);
    setDraft("");
    logEvent(
      "message_sent",
      { length: text.length, stage, focalOption: offer[focal.id] ?? null },
      { sessionIndex },
    );

    if (participantKey) {
      void getStore().appendMessage(participantKey, {
        id: own.id,
        sessionIndex,
        speaker: "participant",
        text,
        createdAt: new Date().toISOString(),
        stage,
        proposal: Object.keys(offer).length > 0 ? offer : undefined,
      });
    }

    setPending(true);
    try {
      let reply: string;
      let counterProposal: Package | null = null;

      if (mockAi) {
        const scripted = script.messages.find(
          (m) => m.stage === stage && m.speaker === "counterpart",
        );
        const decision = counterpartStep(
          task,
          counterpartRole,
          stage,
          offer,
          lastCounterpartPackage,
        );
        counterProposal = decision.proposal;
        reply =
          scripted?.text ??
          "Understood — let me come back to you on that.";
        await new Promise((r) => setTimeout(r, 400));
      } else {
        const res = await fetch("/api/counterpart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            participantRole: role,
            stage,
            incoming: offer,
            lastCounterpartPackage,
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
          "Sorry, I lost my train of thought — could you say that again?";
        counterProposal = data.proposal ?? null;

        // Appendix E7: a reply is delayed in proportion to its length, so the
        // exchange does not feel instantaneous the way a machine would.
        await new Promise((r) => setTimeout(r, NEGOTIATION.counterpartDelayMs));
      }

      if (counterProposal) setLastCounterpartPackage(counterProposal);

      const counter: DisplayMessage = {
        id: `c${next.length}`,
        speaker: "counterpart",
        text: reply,
      };
      setMessages((m) => [...m, counter]);

      if (participantKey) {
        void getStore().appendMessage(participantKey, {
          id: counter.id,
          sessionIndex,
          speaker: "counterpart",
          text: reply,
          createdAt: new Date().toISOString(),
          stage,
          proposal: counterProposal ?? undefined,
        });
      }

      if (stage >= 5) {
        setTentative(offer);
        setPhase("review");
      } else {
        setStage((s) => (s + 1) as StageId);
      }
    } finally {
      setPending(false);
    }
  }

  // --- phases -------------------------------------------------------------

  if (phase === "brief") {
    return (
      <SessionBrief
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        onContinue={() => setPhase("target")}
      />
    );
  }

  if (phase === "target") {
    return (
      <PrivateTargetForm
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        onContinue={() => {
          // The counterpart's opening is fixed and goes first, so the
          // participant is answering a position rather than inventing one.
          const opening = counterpartOpening(task, counterpartRole);
          setLastCounterpartPackage(opening);
          logEvent("negotiation_started", undefined, { sessionIndex });
          setPhase("negotiate");
        }}
      />
    );
  }

  if (phase === "review") {
    return (
      <ReviewPhase
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        stepIndex={3}
        tentative={tentative}
        transcript={messages}
        transcriptTitle="The conversation"
        transcriptHint="Everything the two of you said."
        onDone={() => setPhase("post")}
      />
    );
  }

  if (phase === "post") {
    return (
      <PostTaskSurvey
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        isProxy={false}
        steps={STEP_LABELS}
        onDone={() => {
          logEvent("page_complete", undefined, {
            page: `session-${sessionIndex}`,
            sessionIndex,
          });
          router.push(
            sessionIndex === 1 ? nextHref("session-1") : nextHref("session-2"),
          );
        }}
      />
    );
  }

  // --- negotiate ----------------------------------------------------------

  return (
    <>
      <Page width="wide">
        <SessionLayout briefing={<BriefingPanel task={task} role={role} />}>
          <SessionHeader
            sessionIndex={sessionIndex}
            title={task.title}
            steps={STEP_LABELS}
            current={2}
            aside={
              <span className="shrink-0 text-[0.8125rem] text-[var(--ink-2)]">
                Step{" "}
                <span className="tabular font-medium text-[var(--ink)]">
                  {stage}
                </span>{" "}
                of {STAGES.length}
              </span>
            }
          />

          <div className="mb-5">
            <Callout title={STAGE_LABELS[stage]}>
              <p className="max-w-prose">{STAGE_PROMPTS[stage]}</p>
            </Callout>
          </div>

          <Card className="mb-5 flex flex-col" padded={false}>
            <div className="border-b border-[var(--line)] px-4 py-3">
              <p className="text-[0.875rem] font-medium">
                Messages with the other party
              </p>
              <p className="text-[0.8125rem] text-[var(--ink-2)]">
                They can see everything you write here.
              </p>
            </div>
            <Transcript
              messages={messages}
              pending={pending}
              emptyHint="They open first. Your reply starts the exchange."
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
              Your current offer
            </CardTitle>
            <div className="space-y-4">
              {task.issues.map((issue) => (
                <div key={issue.id}>
                  <p className="mb-1.5 text-[0.8125rem] font-medium">
                    {issue.label}
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
        </SessionLayout>
      </Page>

      <ActionBar
        label="Finish this session"
        onClick={() => {
          setTentative(Object.keys(offer).length > 0 ? offer : null);
          setPhase("review");
        }}
        note={`${chosen} of ${task.issues.length} terms chosen`}
      />
    </>
  );
}
