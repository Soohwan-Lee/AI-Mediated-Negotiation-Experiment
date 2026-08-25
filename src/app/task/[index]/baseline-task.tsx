"use client";

/**
 * Baseline task (Experimental Design Ver.2.4 §8 "Baseline task 흐름").
 *
 * The participant chooses each package and writes each message. Every proposal
 * they send is understood by the other side as their own position — that is
 * what makes this the benchmark the two Proxy policies are read against.
 *
 * FREE CHAT ON A TEN-MINUTE CLOCK. The participant writes as much or as little
 * as they like and may finish early; Design §4 is explicit that their
 * behaviour is not forced ("참가자의 행동은 강제하지 않음"). What is fixed is
 * the COUNTERPART: it walks its five-stage script one move per reply, so every
 * participant meets the same opening, the same standardized challenge and the
 * same thresholds in the same order, however long they take.
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
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";
import { BriefingPanel, TaskHeader, TaskLayout } from "@/components/session";
import { ActionBar } from "@/components/study-chrome";
import { Card, CardTitle, Cue, Page } from "@/components/ui";
import {
  useDevActions,
  useDevAutofill,
  useDevGate,
  useDevMockAi,
} from "@/lib/dev-mode";
import {
  NEGOTIATION_SECONDS,
  counterpartStageAfter,
  counterpartStep,
} from "@/lib/negotiation/machine";
import { scriptedTask } from "@/lib/negotiation/script";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { counterpartDelayMs, nextHref } from "@/lib/study-config";
import { counterpartOpening, getTask, requirementIssue } from "@/lib/tasks";
import type { Package, Role, TaskId } from "@/lib/types";
import { ReviewPhase } from "./review";
import {
  Matchmaking,
  PreferenceForm,
  ReasonPicker,
  RiskForm,
  TaskBrief,
  TaskIntro,
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

/**
 * Stages the counterpart has already spent before its first live reply.
 *
 * One: the fixed opening, seeded on screen before the participant writes
 * anything (it is the anchor their reply is measured against). It is a real
 * stage-1 move, so the counterpart's first *reply* is stage 2 — otherwise it
 * re-serves stage 1 and repeats its opening word for word.
 *
 * The Proxy arm has the same idea at a different size: `DIRECT_STAGE_OFFSET`
 * is 3 there, because through its own proxy the counterpart has opened, stated
 * its priority and challenged before the direct conversation starts.
 */
const SEEDED_OPENING_STAGES = 1;

/**
 * RISK COMES BEFORE THE LEVELS SCREEN, in this arm and in the Proxy arm.
 *
 * RISK asks what the participant EXPECTS raising their requirement to cost, so
 * it has to be asked before anything about their own position is committed. It
 * used to sit after the preference screen, which was already safe — but the
 * Proxy arm now settles levels and reason cards on one screen, and asking RISK
 * after that would have a Proxy participant answer it having decided which
 * sensitive cards to hand over and read the policy disclosure. That makes a
 * pre-task measure partly post-treatment in one arm only, and RISK is §10 gate
 * 4's task-equivalence instrument, so it cannot carry a condition effect.
 *
 * Asking it straight after the briefing is what keeps the two arms identical
 * on this point: both are asked cold, with the situation read and nothing yet
 * decided.
 */
type Phase =
  | "intro"
  | "brief"
  | "risk"
  | "prefs"
  | "matchmaking"
  | "negotiate"
  | "review";

const PHASES: Phase[] = [
  "intro",
  "brief",
  "risk",
  "prefs",
  "matchmaking",
  "negotiate",
  "review",
];

/**
 * The phases the progress bar counts.
 *
 * The cover is not one of them: it is the screen you are on before the task
 * starts, and having it fill the first segment would make the bar read as
 * one-fifth done before anything had happened. Matchmaking has no step of its
 * own either — it is the same step as the negotiation it opens.
 */
const STEP_LABELS = [
  "Your briefing",
  "Before you start",
  "What you want",
  "Negotiate",
  "Review",
];

const PHASE_LABELS: Record<Phase, string> = {
  intro: "Start screen",
  brief: "Your briefing",
  risk: "Before you start",
  prefs: "What you want",
  matchmaking: "Connecting",
  negotiate: "Negotiate",
  review: "Review",
};

const STEP_OF: Record<Phase, number> = {
  intro: 0,
  brief: 0,
  risk: 1,
  prefs: 2,
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

  const [phase, setPhase] = useState<Phase>("intro");
  /**
   * How many replies the counterpart has made. Its script position is derived
   * from this, so the participant can send as many messages as they like
   * without the counterpart skipping ahead or repeating itself.
   *
   * THE SEEDED OPENING IS NOT COUNTED HERE, and the two positions it produces
   * are deliberately different numbers:
   *
   *   - the counterpart has already SPOKEN stage 1 (the seeded opening), so
   *     its next move is stage 2 — `counterpartMoveStage` below;
   *   - the participant is replying TO that opening, so their script slot is
   *     stage 1 — `counterpartStageAfter(replies)`, used by the autofill.
   *
   * Conflating them is what produced two separate bugs. Deriving the
   * counterpart's move from `replies` alone re-served stage 1 and had it
   * repeat its opening word for word. "Fixing" that by seeding `replies` at 1
   * moved BOTH positions, so the mockup's `b1p` was skipped and the
   * standardized challenge arrived a message early — and CLAUDE.md is
   * explicit that the script and the machine must agree.
   */
  const [replies, setReplies] = useState(0);
  /** Set when the counterpart accepts or declares an impasse. */
  const [settled, setSettled] = useState<"agreed" | "impasse" | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [offer, setOffer] = useState<Package>({});
  const [tentative, setTentative] = useState<Package | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  /**
   * Seconds left on the ten-minute clock, mirrored into state.
   *
   * The counterpart reads it — a low clock is what makes it offer to settle —
   * so it cannot live only inside the timer component.
   */
  const [secondsRemaining, setSecondsRemaining] = useState(NEGOTIATION_SECONDS);
  const outOfTime = secondsRemaining <= 0;

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

  const [lastCounterpartPackage, setLastCounterpartPackage] =
    useState<Package | null>(null);

  const mockAi = useDevMockAi();

  // An opening package needs every term chosen; later stages may reply without
  // changing the offer. Computed here rather than beside the composer because
  // the phase branches below return early, and a hook cannot sit behind that.
  // A first message needs a complete package on the table; after that the
  // participant may write anything, including a reply that changes nothing.
  const chosen = task.issues.filter((i) => offer[i.id]).length;
  const complete = chosen === task.issues.length;
  // `settled` is OUTSIDE the dev gate on purpose. `useDevGate` exists to let a
  // walkthrough past an unfilled form, but "the conversation is over" is not a
  // validation to skip — bypassing it let the send loop keep firing after the
  // counterpart had accepted, which logged the same ending five times.
  const canSend = useDevGate(complete) && !settled;

  // The three states of the conversation, named once so the composer, the
  // terms card and the pill above them cannot disagree about which one it is.
  //
  // These are exact complements (`canSend` / `!canSend`), which is what keeps
  // interface rule 9's "at most one ring on a screen" true: the composer's cue
  // and the terms card's cue can never both be lit. That was already the case
  // when the cue was a flat outline and merely tidy; now that it is a diffuse
  // glow, two at once would read as a rendering fault, so it is worth stating
  // rather than leaving to be re-derived.
  const yourTurn = !pending && canSend;
  const needsTerms = !pending && !canSend;

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
      label: PHASE_LABELS[p],
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
  //
  // Keyed on `replies` WITHOUT the seeded-opening offset: the participant is
  // replying to the opening, so their first line is the script's stage-1
  // `b1p`. The counterpart's own move is a stage further on — see the note on
  // `replies`. Past the clamp the stage-5 close is used, for the same reason
  // the counterpart's lookup does it.
  useDevAutofill(() => {
    const stage = counterpartStageAfter(replies);
    const own =
      (stage === 4 && replies > 3
        ? script.messages.find(
            (m) => m.stage === 5 && m.speaker === "participant",
          )
        : undefined) ??
      script.messages.find(
        (m) => m.stage === stage && m.speaker === "participant",
      );
    if (own) {
      setDraft(own.text);
      if (own.proposal) setOffer(own.proposal);
      if (own.reasonCardId) setAttachedReasonId(own.reasonCardId);
    }
  }, `baseline-t${taskIndex}-${phase}-${replies}`);

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
        stage: counterpartStageAfter(replies),
        secondsRemaining,
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
        stage: counterpartStageAfter(replies),
        proposal: Object.keys(offer).length > 0 ? offer : undefined,
        reasonCardId: attachedReasonId ?? undefined,
      });
    }

    setPending(true);
    try {
      let reply: string;
      let counterProposal: Package | null = null;

      // The exchange state the counterpart reads. A reason counts as given
      // once the participant has attached a card ON THE REQUIREMENT ISSUE to
      // any message — the system decides this from the log, never the model
      // (Design §4 판정 주체). Issue-scoped since ver.2.5: the cards span all
      // three issues, and an argument about the timing term is not a reason
      // to concede the requirement.
      const exchangeState = {
        reasonGivenForRequirement: voiced.some(
          (id) =>
            task.roleBriefs[role].reasonCards.find((c) => c.id === id)
              ?.issueId === requirement.id,
        ),
        reasonAlreadyRequested: reasonRequested,
        secondsRemaining,
      };

      // Where the counterpart is in ITS OWN script. The participant is not
      // marched through stages any more — they write as much as they want
      // inside the ten minutes — but the counterpart still walks its fixed
      // sequence one move per reply, so every participant meets the same
      // opening, the same challenge and the same thresholds in the same order.
      //
      // `+ SEEDED_OPENING_STAGES` because the opening it already said IS stage
      // 1: without it the counterpart re-serves stage 1 and repeats itself
      // verbatim. The offset belongs HERE and not in `replies`, because the
      // participant's own script slot is still stage 1 — they are replying to
      // that opening. See the note on `replies`.
      const stageNow = counterpartStageAfter(replies + SEEDED_OPENING_STAGES);

      const decision = counterpartStep(
        task,
        counterpartRole,
        stageNow,
        offer,
        lastCounterpartPackage,
        exchangeState,
      );
      if (decision.awaitingReason) setReasonRequested(true);
      counterProposal = decision.proposal;

      if (mockAi) {
        // `counterpartStageAfter` clamps at 4, so a participant who keeps
        // talking after the trade meets stage 4 again — correct for the state
        // machine, where every turn from there is the same decision, but it
        // made the MOCKUP repeat one line verbatim. The script's stage-5
        // close is the line for that turn, so a second visit to the clamped
        // stage advances to it rather than saying the same thing twice.
        const atClamp = stageNow === 4 && replies + SEEDED_OPENING_STAGES > 3;
        const scripted =
          (atClamp
            ? script.messages.find(
                (m) => m.stage === 5 && m.speaker === "counterpart",
              )
            : undefined) ??
          script.messages.find(
            (m) => m.stage === stageNow && m.speaker === "counterpart",
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
            stage: stageNow,
            incoming: offer,
            lastCounterpartPackage,
            reasonGiven: exchangeState.reasonGivenForRequirement,
            reasonAlreadyRequested: exchangeState.reasonAlreadyRequested,
            secondsRemaining,
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
            stage: stageNow,
            proposal: counterProposal ?? undefined,
            decidedAction: decision.action,
          });
        }
      }

      setReplies((n) => n + 1);

      // An accepted package or an impasse ends the exchange. The participant
      // is not sent to the review immediately — they see the counterpart's
      // last message first, and a Continue button appears — because being
      // teleported off a screen mid-sentence reads as a bug.
      if (decision.accepts || decision.impasse) {
        setTentative(decision.accepts ? (decision.proposal ?? offer) : null);
        setSettled(decision.accepts ? "agreed" : "impasse");
        // Every ending logs, not only the timeout one — otherwise a started
        // event has no matching ended event on the ordinary paths.
        logEvent(
          "negotiation_ended",
          {
            phase: "baseline",
            reason: decision.accepts ? "agreed" : "impasse",
            replies: replies + 1,
            secondsRemaining,
          },
          { sessionIndex: taskIndex },
        );
      }
    } finally {
      setPending(false);
    }
  }

  // --- phases -------------------------------------------------------------

  if (phase === "intro") {
    return (
      <TaskIntro
        taskIndex={taskIndex}
        steps={STEP_LABELS}
        scene="direct"
        onStart={() => setPhase("brief")}
      />
    );
  }

  if (phase === "brief") {
    return (
      <TaskBrief
        taskIndex={taskIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        onContinue={() => setPhase("risk")}
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
          setPhase("matchmaking");
        }}
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
        isProxy={false}
        transcriptTitle="The conversation"
        transcriptHint="Everything the two of you said."
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
                  running={!settled}
                  onTick={setSecondsRemaining}
                  /* Running the clock out is an outcome, not a dead end. A
                     participant who stops typing at 00:00 used to be left on a
                     screen with no button and nothing to do — the exchange only
                     ended inside `send`, so someone who sent nothing was
                     stranded. Time expiring now closes the exchange the same
                     way an impasse does. */
                  onExpire={() => {
                    if (settled) return;
                    setTentative(null);
                    setSettled("impasse");
                    logEvent(
                      "negotiation_ended",
                      { phase: "baseline", reason: "timeout" },
                      { sessionIndex: taskIndex },
                    );
                  }}
                />
              </span>
            }
          />

          {/* Whose move it is, said in one place.
              The exchange answers itself several seconds later and the reply
              arrives at the bottom of a box the participant may have scrolled
              away from, so "am I waiting or are they" is a real question. The
              cue sits on whichever card is actually blocking: the composer
              when they can write, the terms when a first package has to be
              chosen before they can. */}
          {/* The ring goes on the COMPOSER inside this card, not on the card
              itself — see the matching note in `shared.tsx`. Two nested glows
              read as a rendering fault, and the composer is the control
              actually being waited on. */}
          <Card className="mb-5 flex flex-col" padded={false}>
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
              <div>
                <p className="text-[0.875rem] font-medium">
                  Messages with the other participant
                </p>
                <p className="text-[0.8125rem] text-[var(--ink-2)]">
                  {settled === "agreed"
                    ? "You have both settled on a package."
                    : settled === "impasse"
                      ? "The conversation ended without an agreement."
                      : "They can see everything you write here. Take as long as you need inside the ten minutes."}
                </p>
              </div>
              {settled ? null : pending ? (
                <Cue tone="quiet">Waiting for their reply</Cue>
              ) : yourTurn ? (
                <Cue>Your turn</Cue>
              ) : (
                <Cue tone="quiet">Choose your terms first</Cue>
              )}
            </div>
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
              cue={yourTurn}
              sendLabel="Send"
              placeholder={
                settled
                  ? "This conversation has finished."
                  : canSend
                    ? "Write your message…"
                    : "Choose an option on each term first."
              }
            />
          </Card>

          <Card cue={needsTerms}>
            <CardTitle
              hint="This is the package you are proposing. Update it as the conversation moves."
              aside={
                needsTerms ? (
                  <Cue>{task.issues.length - chosen} to choose</Cue>
                ) : null
              }
            >
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

      {/* The bar is where the exchange ends. There is no "finish early"
          shortcut mid-conversation — the participant either reaches an
          agreement, hits an impasse, or runs the clock down — but once one of
          those has happened, keeping them on the screen serves nobody. */}
      {settled ? (
        <ActionBar
          label="Continue"
          onClick={() => setPhase("review")}
          note={
            settled === "agreed"
              ? "You have a package to review."
              : "No agreement was reached."
          }
        />
      ) : (
        <ActionBar
          note={`${chosen} of ${task.issues.length} terms chosen${
            outOfTime ? " · time is up" : ""
          }`}
        />
      )}
    </>
  );
}
