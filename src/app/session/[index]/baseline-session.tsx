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
import { counterpartDelayMs, nextHref } from "@/lib/study-config";
import { counterpartOpening, focalIssue, getTask } from "@/lib/tasks";
import type { Package, Role, StageId, TaskId } from "@/lib/types";
import { ReviewPhase } from "./review";
import { PostTaskSurvey, PrivateTargetForm, SessionBrief } from "./shared";

/**
 * The counterpart's opening, in words.
 *
 * Used when no scripted line is available — outside mockup mode the real
 * system would generate this through `/api/counterpart` at stage 1, but the
 * participant must never arrive at an empty conversation, because the fixed
 * opening is the anchor their reply is measured against.
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
  return `hi — good to be working on this. my opening would be ${terms}. keen to hear what matters most on your side.`;
}

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
  }, `baseline-s${sessionIndex}-${phase}-${stage}`);

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

      // Appendix E1 gives each stage one message per side, counterpart first.
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

      if (mockAi) {
        const scripted = script.messages.find(
          (m) => m.stage === counterpartStageNow && m.speaker === "counterpart",
        );
        const decision = counterpartStep(
          task,
          counterpartRole,
          counterpartStageNow,
          offer,
          lastCounterpartPackage,
        );
        counterProposal = decision.proposal;
        // Stages 1-4 never end the exchange, so there is no impasse branch to
        // take here: the counterpart's closing test runs at stage 5, above.
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

        // Appendix E7: the reply is delayed in proportion to its own length
        // and jittered, so the exchange does not answer a one-line question
        // and a full counterpackage in the same beat — which is what a
        // machine does and a person does not.
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
            sessionIndex,
            speaker: "counterpart",
            text: reply,
            createdAt: new Date().toISOString(),
            stage,
            proposal: counterProposal ?? undefined,
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
          // The counterpart opens, and its opening is FIXED (Appendix E2: its
          // own best package on all three terms). Every participant therefore
          // answers the same anchor, which is what makes their replies
          // comparable — and it is the same order the Proxy sessions run, so
          // Baseline and Proxy transcripts line up stage for stage.
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
        revisionsUsed={revisionsUsed}
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
          logEvent("mandate_revised", { note, fromReview: true }, { sessionIndex });
        }}
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
            // "Round", not "Step": the header above counts the phases of the
            // session, and two counters both called step, both currently
            // reading 3, are a way to make a participant think they have lost
            // their place. A round here is one message each way.
            aside={
              <span className="shrink-0 text-[0.8125rem] text-[var(--ink-2)]">
                Round{" "}
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

      {/* No "finish early" control.
          The five stages have to be walked, because the trajectory this study
          measures is made of the transitions between them — what was opened
          with, what survived the standardized challenge, what reached the
          final package. An action bar that jumped to the review from stage 1
          would produce a session with an opening and a final position and
          nothing in between, and it would do so precisely for the
          participants least engaged with the negotiation. The session ends
          when the last message is sent. */}
      <ActionBar
        note={`${chosen} of ${task.issues.length} terms chosen · round ${stage} of ${STAGES.length}`}
      />
    </>
  );
}
