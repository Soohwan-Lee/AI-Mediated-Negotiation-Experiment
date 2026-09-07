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
 * the COUNTERPART: it uses the same standardized thresholds, while Direct
 * gates sensitive disclosure on participant disclosure and may settle before
 * later script positions.
 *
 * The counterpart is presented as another participant. It is a controlled LLM
 * behind /api/counterpart whose moves are decided by the state machine, so
 * every participant meets the same deterministic policy.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { reciprocalAcceptanceText } from "@/lib/negotiation/counterpart-text";
import { scriptedTask } from "@/lib/negotiation/script";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { awaitCounterpartDelay, nextHref } from "@/lib/study-config";
import { cardOfLayer, getTask, requirementIssue } from "@/lib/tasks";
import type { NegotiationTask, Package, Role, TaskId } from "@/lib/types";
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
  task: NegotiationTask,
  counterpartRole: Role,
): string {
  // SCRIPT-OPEN (Ver.2.16 §6.1, §6.4): the counterpart's own DECOY work
  // reason and the question that invites the participant's. NO PACKAGE, and
  // NO STATEMENT OF ITS OWN PRIORITY.
  //
  // The second omission is Ver.2.16's, and it puts the participant on the
  // RECEIVING end of the same decoy: hearing only a safe general reason, they
  // read the counterpart's priority as the obvious remedy for it, and the
  // counterpart's stage-4 SB is what corrects them. Gate 16 checks that
  // PCR1-2 rise across that disclosure. Asking "what matters most on your
  // side" here instead of "what's the situation" also invites a bare priority
  // claim as the first move, which is tier 2 — so the misread, the whole
  // point of the WR, would rarely fire at all.
  //
  // IT USED TO OPEN ON ITS OWN BEST PACKAGE, and Ver.2.13 §2.6 removed that
  // deliberately: an opening of "my best, your worst" is a face threat in its
  // own right — the non-negotiable, lowball offer White et al. (2004) name —
  // and it made a high-FTS participant competitive by a route that has nothing
  // to do with disclosure. The first package the participant ever sees is now
  // the symmetric tier package, where both sides move equally.
  const wr = cardOfLayer(task, counterpartRole, "work");
  return `hi! good to be sorting this out. || ${wr?.text ?? ""} || what's the situation on your side?`;
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
  { label: "Prepare", hint: "Read your briefing, answer two questions, and choose your starting goals." },
  { label: "Chat directly", hint: "Discuss the two conditions with the other participant." },
  { label: "Review", hint: "Check your final outcome, then answer questions about the task." },
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
 * SB-TIMING for the Direct arm. Under reciprocal disclosure, every
 * participant SB necessarily precedes the counterpart's SB; late disclosure
 * remains distinguishable in the message/reply log, not by falsely coding it
 * as post-counterpart. `SB` separately records whether the participant chose
 * it during the first reason opportunity.
 */
function sbTimingCode(
  sbVoicedAtReply: number | null,
): "none" | "before_counterpart" | "after_counterpart" {
  if (sbVoicedAtReply === null) return "none";
  return "before_counterpart";
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
  // Non-null: the route only renders a task page for a valid id, and `TaskId`
  // is the compile-time story — the lookup's `undefined` is for API callers
  // reading an id off a JSON body, which guard it themselves.
  const task = getTask(taskId)!;
  const requirement = requirementIssue(task, role);
  const counterpartRole: Role = role === "leader" ? "member" : "leader";

  const [phase, setPhase] = useState<Phase>("intro");
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [phase]);
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
  /** Synchronous settlement guard for timeout versus an in-flight reply. */
  const settledRef = useRef(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);
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
  const [misreadOffered, setMisreadOffered] = useState(false);
  const [numbersReminded, setNumbersReminded] = useState(false);
  /** Any participant message so far mentioned score numbers (one-shot pool). */
  const [numbersEver, setNumbersEver] = useState(false);
  const [softCloseOffered, setSoftCloseOffered] = useState(false);
  /** Direct counterpart SB is reciprocal and must be voiced at most once. */
  const [counterpartSbDisclosed, setCounterpartSbDisclosed] = useState(false);
  /**
   * When the participant first tagged their SB, in counterpart replies.
   * The primary SB outcome is still the first reason opportunity. Later SB is
   * kept in the turn log separately; under reciprocity it necessarily precedes
   * the counterpart's own SB.
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
    setTurnError(null);
    // Lock the composer before classification starts. The classifier is part
    // of this turn, and a second send while it is in flight would create two
    // replies from the same state.
    setPending(true);
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
    let confidence: number | undefined;
    if (!mockAi) {
      try {
        const res = await fetch("/api/classify-reason", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, role, message: text }),
        });
        const data = (await res.json()) as {
          label?: typeof label;
          confidence?: number;
        };
        if (data.label) label = data.label;
        confidence = data.confidence;
      } catch (error) {
        console.warn("[classify-reason] failed", error);
      }
    } else {
      // Only an exact scripted reason line gets its scripted card label.
      // Treating every typed mock message as SB made a plain "yes" trigger
      // sensitive reciprocity and hid the early-settlement path in previews.
      const mockedReason = script.messages.find(
        (message) =>
          message.speaker === "participant" &&
          message.text === text &&
          message.reasonCardId,
      );
      if (mockedReason?.reasonCardId) {
        label = cardOfLayer(task, role, "sensitive")?.id === mockedReason.reasonCardId
          ? "SB"
          : "WR";
      }
    }

    const tierNow: ReasonTier = foldTier(tier, LABEL_TIER[label]);
    setTier(tierNow);

    // The first SB-labelled message fixes timing. Reciprocity guarantees it
    // precedes counterpart SB; its reply index still says whether it was the
    // participant's first disclosure opportunity.
    const sbVoicedAtReplyNow =
      sbVoicedAtReply ?? (label === "SB" ? replies : null);
    if (sbVoicedAtReplyNow !== sbVoicedAtReply) {
      setSbVoicedAtReply(sbVoicedAtReplyNow);
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
        // The classifier's verdict on THIS message, stored per message. It is
        // the source of the post-hoc κ that gate 19 turns on (§6.2a) — and it
        // is never rendered, because showing a participant which of their
        // sentences "counted" tells them what the study rewards mid-study.
        reasonLabel: label,
        reasonConfidence: confidence,
      });
    }

    // The reply budget is counted from HERE, not from when the text came
    // back, so generation time is spent out of the delay rather than added to
    // it — and so mockup mode waits the same as a live run.
    const turnStartedAt = Date.now();
    try {
      let reply: string;
      let counterProposal: Package | null = null;

      // Where the counterpart is in ITS OWN script. Direct can skip the
      // sensitive-disclosure position or combine disclosure with acceptance;
      // the machine decides that from the explicit reciprocal policy.
      const stageNow = counterpartStageAfter(replies + SEEDED_OPENING_STAGES);

      const mentioned = numbersEver || mentionsScoreNumbers(text);
      if (mentioned !== numbersEver) setNumbersEver(mentioned);
      const decision = counterpartStep(task, counterpartRole, stageNow, sentOffer, {
        tier: tierNow,
        askedWhy,
        misreadOffered,
        numbersReminded,
        numbersMentionedNow: mentioned,
        secondsRemaining,
        softCloseOffered,
        disclosurePolicy: "reciprocal",
        counterpartSbDisclosed,
      });
      if (decision.action === "ask_why") setAskedWhy(true);
      if (decision.action === "nonum") setNumbersReminded(true);
      if (decision.action === "soft_close") setSoftCloseOffered(true);
      counterProposal = decision.proposal;

      if (mockAi) {
        const disclosure = script.messages.find(
          (m) => m.stage === 4 && m.speaker === "counterpart",
        )?.text;
        if (decision.action === "disclose_sb_and_accept") {
          reply = decision.proposal
            ? reciprocalAcceptanceText(task, counterpartRole, decision.proposal)
            : disclosure ?? "";
        } else if (decision.action === "disclose_sb") {
          reply = disclosure ?? "";
        } else if (decision.accepts) {
          const levels = decision.proposal
            ? task.issues
                .map((issue) =>
                  issue.options.find(
                    (option) => option.id === decision.proposal?.[issue.id],
                  )?.label,
                )
                .filter(Boolean)
                .join(", ")
            : "that package";
          reply = `that works for me. || let's go with ${levels}.`;
        } else {
          const scripted = script.messages.find(
            (m) =>
              m.stage === decision.stage && m.speaker === "counterpart",
          );
          reply = scripted?.text ?? "let's keep working through the terms.";
        }
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
            misreadOffered,
            numbersReminded,
            // Sent, not re-derived server-side: the client codes the outcome
            // from its own `counterpartStep`, so every input to that call has
            // to reach the route unchanged or the two can disagree about
            // whether the exchange was agreed.
            numbersMentionedNow: mentioned,
            secondsRemaining,
            softCloseOffered,
            disclosurePolicy: "reciprocal",
            counterpartSbDisclosed,
            history: next.map((m) => ({
              role: m.speaker === "participant" ? "user" : "assistant",
              content: m.text,
            })),
          }),
        });

        if (!res.ok) {
          throw new Error(`Counterpart request failed with ${res.status}`);
        }

        const data = (await res.json()) as {
          message?: string;
          proposal?: Package | null;
        };
        if (!data.message?.trim()) {
          throw new Error("Counterpart returned no message");
        }
        reply = data.message;
        // THE LOCAL DECISION'S PACKAGE, not the server's echo of it. Both
        // are produced by the same deterministic machine from the same
        // inputs, so they agree — but only the local one is guaranteed to be
        // the package this client just coded the outcome from. Preferring
        // the response meant the two arms resolved any divergence
        // DIFFERENTLY (the Proxy closing has always kept its local one),
        // which would put a mechanical asymmetry on `Pooled Proxy −
        // Direct` for a case that is supposed to be impossible.
        counterProposal = decision.proposal;

      }

      // The reply is delayed in proportion to its own length and jittered, so
      // the exchange does not answer a one-line question and a full
      // counterpackage in the same beat. Applied to BOTH branches from one
      // place: it used to sit inside the live branch only, which left mockup
      // mode — the default off-production, and so the thing anyone walking a
      // preview actually sees — answering in 400ms.
      await awaitCounterpartDelay(reply.length, turnStartedAt);
      // A timeout that won while this reply was in flight ends the exchange.
      // Do not append or persist a late message after that terminal event.
      if (settledRef.current) return;

      if (
        decision.action === "disclose_sb" ||
        decision.action === "disclose_sb_and_accept"
      ) {
        setCounterpartSbDisclosed(true);
      }
      if (decision.action === "misread") setMisreadOffered(true);

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
      if (
        !settledRef.current &&
        (decision.accepts || decision.impasse)
      ) {
        settledRef.current = true;
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
            sb: sbVoicedAtReplyNow !== null && sbVoicedAtReplyNow <= 1,
            sbTiming: sbTimingCode(sbVoicedAtReplyNow),
          },
          { sessionIndex: taskIndex },
        );
      }
    } catch (error) {
      console.error("[counterpart] turn failed", error);
      // Keep the participant's text available for a deliberate retry. No
      // reply, disclosure flag, or settlement is recorded on a failed turn.
      setDraft(text);
      setTurnError(
        "We couldn’t get a reply. Your message is still here. Please try sending it again.",
      );
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
        onBack={() => setPhase("intro")}
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
        <TaskLayout
          composerBelow
          briefing={<BriefingPanel task={task} role={role} />}
        >
          <TaskHeader
            taskIndex={taskIndex}
            title={task.title}
            steps={STEP_LABELS}
            current={STEP_OF.negotiate}
          />

          <div className="sticky top-[calc(var(--header-h)+0.25rem)] z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/95 px-4 py-3 shadow-sm backdrop-blur-md sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                  💬 Live Direct Negotiation
                </p>
                <p className="text-xs text-[var(--ink-2)] leading-relaxed break-words">
                  {settled === "agreed"
                    ? "✓ Both parties agreed on a complete package!"
                    : settled === "impasse"
                      ? "⚠️ The negotiation ended without an agreement."
                      : "Messages are sent directly to the other participant in real time."}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <CountdownTimer
                  seconds={NEGOTIATION_SECONDS}
                  running={!settled}
                  onTick={setSecondsRemaining}
                  onExpire={() => {
                    if (settledRef.current) return;
                    settledRef.current = true;
                    setTentative(null);
                    setSettled("impasse");
                    logEvent(
                      "negotiation_ended",
                      { phase: "direct", reason: "timeout" },
                      { sessionIndex: taskIndex },
                    );
                  }}
                />
                {settled ? null : pending ? (
                  <Cue tone="quiet">Waiting for reply…</Cue>
                ) : yourTurn ? (
                  <Cue>Your Turn</Cue>
                ) : (
                  <Cue tone="quiet">Select terms first</Cue>
                )}
              </div>
          </div>

          <Card className="mb-6 flex flex-col border-slate-200" padded={false}>
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
            {turnError ? (
              <p className="px-4 pb-4 text-sm text-red-700" role="alert">
                {turnError}
              </p>
            ) : null}
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
