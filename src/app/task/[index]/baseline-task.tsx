"use client";

/**
 * Direct task (Experimental Design Ver.2.4 §8 "Direct task 흐름").
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
  mentionsScoreNumbers,
  foldTier,
  LABEL_TIER,
  type ReasonTier,
} from "@/lib/negotiation/machine";
import { scriptedTask } from "@/lib/negotiation/script";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { counterpartDelayMs, nextHref } from "@/lib/study-config";
import { cardOfLayer, getTask, requirementIssue } from "@/lib/tasks";
import type { Package, Role, TaskId } from "@/lib/types";
import { ReviewPhase } from "./review";
import {
  Matchmaking,
  PreferenceForm,
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
  // SCRIPT-OPEN (Ver.2.13 §6.1, §6.4): the counterpart's own work reason and
  // the question that invites the participant's. NO PACKAGE.
  //
  // IT USED TO OPEN ON ITS OWN BEST PACKAGE, and Ver.2.13 §2.6 removed that
  // deliberately: an opening of "my best, your worst" is a face threat in its
  // own right — the non-negotiable, lowball offer White et al. (2004) name —
  // and it made a high-FTS participant competitive by a route that has nothing
  // to do with disclosure. The first package the participant ever sees is now
  // the symmetric tier package, where both sides move equally.
  const wr = cardOfLayer(task, counterpartRole, "work");
  return `hi! good to be sorting this out. || ${wr?.text ?? ""} || what matters most on your side, and why?`;
}

/**
 * Stages the counterpart has already spent before its first live reply.
 *
 * One: the fixed opening, seeded on screen before the participant writes
 * anything, so they never arrive at an empty conversation. It is a real
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

/** The cover's glossed step list — see the note in proxy-task.tsx. */
const COVER_STEPS = [
  { label: "Your briefing", hint: "Read your side of the project." },
  { label: "Before you start", hint: "Two quick questions." },
  {
    label: "What you want",
    hint: "Choose what you would like on each of the two terms.",
  },
  {
    label: "Negotiate",
    hint: "Chat with the other participant and settle both terms.",
  },
  { label: "Review", hint: "See where it landed." },
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

/** Entry preferences as a package (nulls dropped). */
/**
 * SB-TIMING (Ver.2.13 §9.3) for the Direct arm, from the reply index the
 * participant's SB was tagged at.
 *
 * THE BOUNDARY IS A FIXED SCRIPT POSITION, not something the participant can
 * move. The counterpart discloses its own SB on its SECOND live reply, so a
 * tag at reply 0 or 1 is out before it and anything later is after. That also
 * makes `SB` — the primary outcome — the "before" category alone.
 *
 * Direct has no closing stage, so category "wrap_up" is unreachable here;
 * §9.8-5 flags that as a structural zero cell for the χ², not a coding gap.
 */
function sbTimingCode(
  sbVoicedAtReply: number | null,
): "none" | "before_counterpart" | "after_counterpart" {
  if (sbVoicedAtReply === null) return "none";
  return sbVoicedAtReply <= 1 ? "before_counterpart" : "after_counterpart";
}

function toPackage(
  chosen: Record<string, string | null>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(chosen).filter(([, v]) => v) as Array<[string, string]>,
  );
}

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
   * The rung the participant's own words have reached so far (§6.2a).
   *
   * THERE IS NO CARD BUTTON ANY MORE. Ver.2.20 removed it: pressing
   * "[sensitive background]" is a more deliberate act than saying the thing,
   * which risked a floor on the primary outcome, and it made the Direct arm
   * something other than "just talking" — so `Pooled Proxy − Direct` would
   * have compared two interfaces rather than two ways of being represented.
   *
   * The tier now comes from the P5 classifier, one call per message, and it
   * ONLY EVER RISES (§6.2). `foldTier` is what enforces that: a participant
   * who discloses and then changes the subject keeps the rung they paid for.
   */
  const [tier, setTier] = useState<ReasonTier>("none");
  /** SCRIPT-ASKWHY / SCRIPT-NONUM / SCRIPT-CLOSE are each one-shot (§6.2). */
  const [askedWhy, setAskedWhy] = useState(false);
  const [numbersReminded, setNumbersReminded] = useState(false);
  /** Any participant message so far mentioned score numbers (one-shot pool). */
  const [numbersEver, setNumbersEver] = useState(false);
  const [softCloseOffered, setSoftCloseOffered] = useState(false);
  /**
   * When the participant first tagged their SB, in counterpart replies.
   * PRE-RECIP-SB (§9.3) is "was their SB out before the counterpart's stage-4
   * disclosure" — and the disclosure is the counterpart's SECOND live reply,
   * so the comparison is against that fixed position.
   */
  const [sbVoicedAtReply, setSbVoicedAtReply] = useState<number | null>(null);


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
  const script = scriptedTask(task, role, "direct");

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
    // The participant's script slots run 1 (answer the opening), 2 (their
    // first reason — the SB in the ideal path), 5 (the trade), then the
    // stage-6 close for anything after.
    const slot = ([1, 2, 5][replies] ?? 6) as number;
    const own = script.messages.find(
      (m) => m.stage === slot && m.speaker === "participant",
    );
    if (own) {
      setDraft(own.text);
      if (own.proposal) setOffer(own.proposal);
    }
  }, `baseline-t${taskIndex}-${phase}-${replies}`);

  async function send(text: string, sentOffer: Package = offer) {
    const own: DisplayMessage = {
      id: `p${messages.length}`,
      speaker: "participant",
      text,
    };
    const next = [...messages, own];
    setMessages(next);
    setDraft("");

    /**
     * THE CLASSIFIER DECIDES THE RUNG, AND THE COUNTERPART'S OWN MODEL NEVER
     * DOES (§6.2a, §6.7). This is a separate single-purpose call that writes
     * nothing anyone sees; its one label becomes the tier, and `machine.ts`
     * decides the package from it exactly as it did from a checkbox.
     *
     * A FAILURE FLOORS RATHER THAN GUESSES. The route answers `none` when the
     * model errors, and the fold below means a floor costs the participant
     * only this turn — they can say it again. A guess in the other direction
     * would hand out the maximum package on a network error.
     */
    let label: "none" | "WR" | "PRI" | "SB" = "none";
    if (!mockAi) {
      try {
        const res = await fetch("/api/classify-reason", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, role, message: text }),
        });
        const data = (await res.json()) as { label?: typeof label };
        if (data.label) label = data.label;
      } catch (error) {
        console.warn("[classify-reason] failed", error);
      }
    } else if (script.messages.some((m) => m.speaker === "participant")) {
      // Mockup mode walks the IDEAL trajectory, so the scripted participant
      // messages are the ones that carry the SB. Classifying them live would
      // spend a model call to re-derive what the script already fixes.
      label = "SB";
    }

    const tierNow: ReasonTier = foldTier(tier, LABEL_TIER[label]);
    setTier(tierNow);

    // SB (§9.3) is "was the participant's SB out before the counterpart's
    // stage-4 disclosure" — so it is the first message the classifier reads
    // as SB that fixes it, whatever they say afterwards.
    if (label === "SB" && sbVoicedAtReply === null) {
      setSbVoicedAtReply(replies);
    }

    logEvent(
      "message_sent",
      {
        length: text.length,
        stage: counterpartStageAfter(replies),
        secondsRemaining,
        requirementOption: sentOffer[requirement.id] ?? null,
        // The classifier's verdict on THIS message, stored per message for
        // the post-hoc human re-coding and the κ that gate 19 turns on
        // (§6.2). Not shown to anyone.
        reasonLabel: label,
        tier: tierNow,
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
        proposal: Object.keys(sentOffer).length > 0 ? sentOffer : undefined,
      });
    }

    setPending(true);
    try {
      let reply: string;
      let counterProposal: Package | null = null;

      // Where the counterpart is in ITS OWN script: the seeded opening was
      // stage 1, so its live replies walk 2 (its WR + the reason question),
      // 4 (its fixed SB disclosure), then the trade loop.
      const stageNow = counterpartStageAfter(replies + SEEDED_OPENING_STAGES);

      const mentioned = numbersEver || mentionsScoreNumbers(text);
      if (mentioned !== numbersEver) setNumbersEver(mentioned);
      const decision = counterpartStep(task, counterpartRole, stageNow, sentOffer, {
        tier: tierNow,
        askedWhy,
        numbersReminded,
        numbersMentionedNow: mentioned,
        secondsRemaining,
        softCloseOffered,
      });
      if (decision.action === "ask_why") setAskedWhy(true);
      if (decision.action === "nonum") setNumbersReminded(true);
      if (decision.action === "soft_close") setSoftCloseOffered(true);
      counterProposal = decision.proposal;

      if (mockAi) {
        // The scripted line for the decision's stage; the accept line doubles
        // as the close.
        const scripted =
          script.messages.find(
            (m) =>
              m.stage === decision.stage && m.speaker === "counterpart",
          ) ??
          script.messages.find(
            (m) => m.stage === 6 && m.speaker === "counterpart",
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
            incoming: sentOffer,
            tier: tierNow,
            askedWhy,
            numbersReminded,
            // Sent, not re-derived server-side: the client codes the outcome
            // from its own `counterpartStep`, so every input to that call has
            // to reach the route unchanged or the two can disagree about
            // whether the exchange was agreed.
            numbersMentionedNow: mentioned,
            secondsRemaining,
            softCloseOffered,
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
        // THE LOCAL DECISION'S PACKAGE, not the server's echo of it. Both
        // are produced by the same deterministic machine from the same
        // inputs, so they agree — but only the local one is guaranteed to be
        // the package this client just coded the outcome from. Preferring
        // the response meant the two arms resolved any divergence
        // DIFFERENTLY (the Proxy closing has always kept its local one),
        // which would put a mechanical asymmetry on `Pooled Proxy −
        // Direct` for a case that is supposed to be impossible.
        counterProposal = decision.proposal;

        // The reply is delayed in proportion to its own length and jittered,
        // so the exchange does not answer a one-line question and a full
        // counterpackage in the same beat.
        await new Promise((r) =>
          setTimeout(r, counterpartDelayMs(reply.length)),
        );
      }

      // The visible package card follows the counterproposal, so "accept the
      // package on the table" always names what the button actually sends.
      // Same defect and same fix as the Proxy arm's closing — fixed in both
      // so the two arms cannot differ on how an agreement gets committed.
      if (counterProposal) {
        setLastCounterpartPackage(counterProposal);
        setOffer(counterProposal);
      }

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
            stage: decision.stage,
            proposal: counterProposal ?? undefined,
            decidedAction: decision.action,
          });
        }
      }

      setReplies((n) => n + 1);

      // An accepted package or an impasse ends the exchange. The participant
      // sees the counterpart's last message first, and a Continue button
      // appears.
      if (decision.accepts || decision.impasse) {
        setTentative(decision.accepts ? (decision.proposal ?? sentOffer) : null);
        setSettled(decision.accepts ? "agreed" : "impasse");
        logEvent(
          "negotiation_ended",
          {
            phase: "direct",
            reason: decision.accepts ? "agreed" : "impasse",
            replies: replies + 1,
            secondsRemaining,
            tier: tierNow,
            sb: sbVoicedAtReply !== null && sbVoicedAtReply <= 1,
            sbTiming: sbTimingCode(sbVoicedAtReply),
          },
          { sessionIndex: taskIndex },
        );
      }
    } finally {
      setPending(false);
    }
  }

  /**
   * The explicit accept: take the counterpart's standing proposal as-is.
   * Deterministic, and the same control the Proxy arm's closing has, so the
   * two arms end the same three ways — a package the counterpart accepts,
   * this button, or the clock.
   */
  function acceptStanding() {
    if (!lastCounterpartPackage || pending || settled) return;
    setOffer(lastCounterpartPackage);
    void send(
      "that works for me — let's go with that.",
      lastCounterpartPackage,
    );
  }

  // --- phases -------------------------------------------------------------

  if (phase === "intro") {
    return (
      <TaskIntro
        taskIndex={taskIndex}
        steps={COVER_STEPS}
        scene="direct"
        /* The shorter arm: one conversation. */
        minutes={12}
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
          // 1: its own best package on both terms). Every participant
          // therefore answers the same anchor, which is what makes their
          // replies comparable — and it is the same order the Proxy tasks run,
          // so Direct and Proxy transcripts line up stage for stage.
          //
          // Seeding the message here rather than waiting for the first send is
          // the point: otherwise the participant opens into nothing and the
          // anchor never existed.
          // No package travels with the opening any more, so there is nothing
          // standing to answer — `lastCounterpartPackage` stays null until the
          // counterpart proposes at its rung.
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
          // DECISION-LOCK (Ver.2.12 §6.1): from here the participant's
          // disclosure choices are made live, against the clock; the entry
          // preferences are already saved.
          logEvent("decision_locked", undefined, { sessionIndex: taskIndex });
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
        hoped={prefs ? toPackage(prefs.preferred) : null}
        behaviour={{
          // No proxy ran, so there is nothing to ratify.
          ratify: null,
          sb: sbVoicedAtReply !== null && sbVoicedAtReply <= 1,
          sbTiming: sbTimingCode(sbVoicedAtReply),
        }}
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
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                <span aria-hidden>⏱</span>
                <CountdownTimer
                  seconds={NEGOTIATION_SECONDS}
                  running={!settled}
                  onTick={setSecondsRemaining}
                  onExpire={() => {
                    if (settled) return;
                    setTentative(null);
                    setSettled("impasse");
                    logEvent(
                      "negotiation_ended",
                      { phase: "direct", reason: "timeout" },
                      { sessionIndex: taskIndex },
                    );
                  }}
                />
              </span>
            }
          />

          <Card className="mb-6 flex flex-col overflow-hidden border-slate-200" padded={false}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5">
              <div>
                <p className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                  💬 Live Direct Negotiation
                </p>
                <p className="text-xs text-[var(--ink-2)]">
                  {settled === "agreed"
                    ? "✓ Both parties agreed on a complete package!"
                    : settled === "impasse"
                      ? "⚠️ The negotiation ended without an agreement."
                      : "Messages are sent directly to the other participant in real time."}
                </p>
              </div>
              {settled ? null : pending ? (
                <Cue tone="quiet">Waiting for reply…</Cue>
              ) : yourTurn ? (
                <Cue>Your Turn</Cue>
              ) : (
                <Cue tone="quiet">Select terms first</Cue>
              )}
            </div>
            <Transcript
              messages={messages}
              pending={pending}
              emptyHint="The other side opens first. Your reply will start the live exchange."
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
                  ? "This conversation has concluded."
                  : canSend
                    ? "Type your message here…"
                    : "Please choose an option for both terms below first."
              }
            />
          </Card>

          {!settled && lastCounterpartPackage ? (
            <div className="mb-6">
              <button
                type="button"
                onClick={acceptStanding}
                disabled={pending}
                className="rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-2xs transition-colors hover:bg-emerald-100 disabled:opacity-50"
              >
                ✓ Accept their latest proposal as it stands
              </button>
            </div>
          ) : null}

          <Card cue={needsTerms} className="mb-6">
            <CardTitle
              hint="Select options below to build or modify your current proposal:"
              aside={
                needsTerms ? (
                  <Cue>{task.issues.length - chosen} term(s) left</Cue>
                ) : null
              }
            >
              📦 Your Active Offer Package
            </CardTitle>
            <div className="space-y-4 mt-3">
              {task.issues.map((issue) => (
                <div key={issue.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                  <div className="mb-2">
                    <p className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                      {issue.label}
                    </p>
                  </div>
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

      {settled ? (
        <ActionBar
          label="Continue to Review"
          onClick={() => {
            logEvent("page_complete", undefined, {
              page: `task-${taskIndex}-negotiate`,
              sessionIndex: taskIndex,
            });
            setPhase("review");
          }}
          note={
            settled === "agreed"
              ? "✓ Agreement reached! Proceed to review."
              : "⚠️ Negotiation concluded. Proceed to review."
          }
        />
      ) : (
        <ActionBar
          note={`${chosen} of ${task.issues.length} terms selected${
            outOfTime ? " · time expired" : ""
          }`}
        />
      )}
    </>
  );
}
