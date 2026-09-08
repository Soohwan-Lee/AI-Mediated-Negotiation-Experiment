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
import { NavigationNotice } from "@/components/navigation-notice";
import {
  CountdownTimer,
  MessageComposer,
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";
import { BriefingPanel, TaskHeader, TaskLayout } from "@/components/session";
import { ActionBar } from "@/components/study-chrome";
import { Card, Cue, Page } from "@/components/ui";
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
import { fetchJsonWithRetry } from "@/lib/negotiation/recoverable-request";
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

type ReasonLabel = "none" | "WR" | "PRI" | "SB";

interface StagedTurn {
  text: string;
  sentOffer: Package;
  sentPackage: Package | null;
  ownId: string;
  createdAt: string;
  secondsAtSend: number;
  classification?: ClassificationResponse;
}

interface ClassificationResponse {
  label: ReasonLabel;
  confidence?: number;
  stubbed?: boolean;
}

interface CounterpartResponse {
  message: string;
  proposal?: Package | null;
}

function isClassificationResponse(value: unknown): value is ClassificationResponse {
  if (typeof value !== "object" || value === null || !("label" in value)) return false;
  if (!["none", "WR", "PRI", "SB"].includes(String(value.label))) return false;
  if ("confidence" in value && value.confidence !== undefined &&
      (typeof value.confidence !== "number" || !Number.isFinite(value.confidence) ||
       value.confidence < 0 || value.confidence > 1)) return false;
  return true;
}

function isCounterpartResponse(value: unknown): value is CounterpartResponse {
  return typeof value === "object" && value !== null &&
    "message" in value && typeof value.message === "string" &&
    value.message.trim().length > 0;
}

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
  const [stagedTurn, setStagedTurn] = useState<StagedTurn | null>(null);
  const [recovering, setRecovering] = useState(false);
  const recoveryStartedAt = useRef<number | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const turnGeneration = useRef(0);
  const mounted = useRef(true);
  const expiryPending = useRef(false);
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
  /**
   * The rung the standing package was put up at.
   *
   * "✓ Accept the package on the table" sends that package back through the
   * machine, which accepts only the CURRENT tier's package. Once a message
   * raises the tier the package still on screen is superseded: the machine
   * answers `propose_tier` with `accepts: false` and the button silently does
   * nothing, on the one control that exists so no model has to read the
   * participant's words to decide whether they agreed.
   *
   * Cleared only when a counterpart turn brings NO replacement package and
   * the tier has moved past this rung — a turn carrying a proposal replaces
   * it anyway, and an unmoved tier leaves it acceptable. Same rule and same
   * wording in the Proxy arm's closing (shared.tsx): these are the two places
   * a participant speaks for themselves, so a difference lands on
   * `Pooled Proxy − Direct`.
   */
  const [standingTier, setStandingTier] = useState<ReasonTier>("none");
  /**
   * The proposal drawer opens ONCE, by itself, the first time the counterpart
   * puts a package on the table — so countering it is one click away rather
   * than a thing to go looking for. It is not forced open again after that:
   * a participant who closed it has said they are talking, not proposing, and
   * re-opening the drawer under them on every counterpart turn would put the
   * selector back at the centre of the screen, which is what this change
   * exists to undo.
   */
  const [proposalOpen, setProposalOpen] = useState(false);
  const openedOnCounterProposal = useRef(false);

  const mockAi = useDevMockAi();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      turnGeneration.current += 1;
      activeRequest.current?.abort();
    };
  }, []);

  // THE PACKAGE IS OPTIONAL, AND THAT IS THE POINT OF THE DEMOTION. A message
  // may carry no package at all: the participant is talking, and talking is
  // what the classifier reads and the ladder is driven off. What is still
  // refused is a HALF package — one term chosen and the other left blank —
  // because that is not a position anyone can answer, and the counterpart
  // would read it as a lopsided proposal (SCRIPT-BALANCE) rather than as talk.
  //
  // Computed here rather than beside the composer because the phase branches
  // below return early, and a hook cannot sit behind that.
  const chosen = task.issues.filter((i) => offer[i.id]).length;
  const complete = chosen === task.issues.length;
  const partial = chosen > 0 && !complete;
  /**
   * WHAT WILL TRAVEL WITH THE NEXT MESSAGE, said on the closed drawer.
   *
   * Collapsing the selector without this makes the attachment INVISIBLE: the
   * levels are pre-filled from the preference screen, so a participant who
   * never opens the drawer would send a package they had not seen attached.
   * That is a worse fault than the prominence this change exists to fix — a
   * prominent control at least tells you what it is about to do.
   *
   * Read in `task.issues` order and off each issue's own options, which is
   * exactly what `OptionChips` renders below, so the sentence and the chips
   * can never name the levels in a different order.
   */
  const attachedSummary = partial
    ? "Choose both terms, or neither."
    : complete
      ? `Attached to your next message: ${task.issues
          .map(
            (issue) =>
              issue.options.find((o) => o.id === offer[issue.id])?.label ?? "",
          )
          .filter(Boolean)
          .join(" · ")}`
      : "No proposal attached — you are just talking.";
  // `settled` is OUTSIDE the dev gate on purpose. `useDevGate` exists to let a
  // walkthrough past an unfilled form, but "the conversation is over" is not a
  // validation to skip — bypassing it let the send loop keep firing after the
  // counterpart had accepted, which logged the same ending five times.
  const canSend = useDevGate(!partial) && !settled;

  // ONE CUE ON THE SCREEN, AND IT IS THE COMPOSER'S (interface rule 9).
  //
  // This used to be a pair of exact complements — the composer lit when the
  // package was complete, the package card lit when it was not — which kept
  // "at most one ring" true by never letting both be unlit at once. That is
  // no longer the shape of the rule: a package is optional now, so the thing
  // the screen is waiting for is always the same thing, a message. The
  // package card is not waiting for anything and carries no ring and no pill.
  //
  // A half package is the one state that blocks the send, and it is answered
  // by a quiet inline sentence under the chips rather than by a cue: a cue
  // says "this is what the screen wants next", and what the screen wants is
  // still a message, not a second chip.
  const yourTurn = !pending && canSend;

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

  function beginRecovery() {
    if (recoveryStartedAt.current !== null) return;
    recoveryStartedAt.current = Date.now();
    setRecovering(true);
  }

  function finishRecovery() {
    const startedAt = recoveryStartedAt.current;
    if (startedAt === null) return;
    recoveryStartedAt.current = null;
    setRecovering(false);
    logEvent(
      "technical_pause",
      { durationMs: Date.now() - startedAt },
      { sessionIndex: taskIndex },
    );
  }

  async function runStagedTurn(initialTurn: StagedTurn) {
    const generation = turnGeneration.current + 1;
    turnGeneration.current = generation;
    const controller = new AbortController();
    activeRequest.current?.abort();
    activeRequest.current = controller;
    setPending(true);
    setTurnError(null);
    let turn = initialTurn;

    const failedAttempt = () => {
      if (mounted.current && generation === turnGeneration.current && !settledRef.current) {
        beginRecovery();
      }
    };

    try {
      let classification = turn.classification;
      if (!classification) {
        if (mockAi) {
          let label: ReasonLabel = "none";
          const mockedReason = script.messages.find(
            (message) => message.speaker === "participant" &&
              message.text === turn.text && message.reasonCardId,
          );
          if (mockedReason?.reasonCardId) {
            label = cardOfLayer(task, role, "sensitive")?.id === mockedReason.reasonCardId
              ? "SB"
              : "WR";
          }
          classification = { label };
        } else {
          classification = await fetchJsonWithRetry<ClassificationResponse>(
            "/api/classify-reason",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taskId, role, message: turn.text }),
            },
            {
              signal: controller.signal,
              onFailure: failedAttempt,
              validate: isClassificationResponse,
            },
          );
        }
        turn = { ...turn, classification };
        if (mounted.current && generation === turnGeneration.current) {
          setStagedTurn(turn);
        }
      }

      const { label, confidence, stubbed: classifierStubbed = false } = classification;
      const tierNow: ReasonTier = foldTier(tier, LABEL_TIER[label]);
      const sbVoicedAtReplyNow = sbVoicedAtReply ?? (label === "SB" ? replies : null);
      const own: DisplayMessage = {
        id: turn.ownId,
        speaker: "participant",
        text: turn.text,
      };
      const next = [...messages, own];
      const turnStartedAt = Date.now();
      let reply: string;
      let counterProposal: Package | null = null;

      // Where the counterpart is in ITS OWN script. Direct can skip the
      // sensitive-disclosure position or combine disclosure with acceptance;
      // the machine decides that from the explicit reciprocal policy.
      const stageNow = counterpartStageAfter(replies + SEEDED_OPENING_STAGES);

      const mentioned = numbersEver || mentionsScoreNumbers(turn.text);
      const decision = counterpartStep(task, counterpartRole, stageNow, turn.sentPackage, {
        tier: tierNow,
        askedWhy,
        misreadOffered,
        numbersReminded,
        numbersMentionedNow: mentioned,
        secondsRemaining: turn.secondsAtSend,
        softCloseOffered,
        disclosurePolicy: "reciprocal",
        counterpartSbDisclosed,
      });
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
        const data = await fetchJsonWithRetry<CounterpartResponse>(
          "/api/counterpart",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            taskId,
            participantRole: role,
            stage: stageNow,
            incoming: turn.sentPackage,
            tier: tierNow,
            askedWhy,
            misreadOffered,
            numbersReminded,
            // Sent, not re-derived server-side: the client codes the outcome
            // from its own `counterpartStep`, so every input to that call has
            // to reach the route unchanged or the two can disagree about
            // whether the exchange was agreed.
            numbersMentionedNow: mentioned,
            secondsRemaining: turn.secondsAtSend,
            softCloseOffered,
            disclosurePolicy: "reciprocal",
            counterpartSbDisclosed,
            history: next.map((m) => ({
              role: m.speaker === "participant" ? "user" : "assistant",
              content: m.text,
            })),
            }),
          },
          {
            signal: controller.signal,
            onFailure: failedAttempt,
            validate: isCounterpartResponse,
          },
        );
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
      if (!mounted.current || generation !== turnGeneration.current || settledRef.current) return;

      // Commit the staged turn only after both requests and the visible delay
      // succeed. Until here, retrying cannot duplicate a message, disclosure,
      // state-machine flag, event, or stored transcript row.
      setTier(tierNow);
      setSbVoicedAtReply(sbVoicedAtReplyNow);
      setNumbersEver(mentioned);
      if (decision.action === "ask_why") setAskedWhy(true);
      if (decision.action === "nonum") setNumbersReminded(true);
      if (decision.action === "soft_close") setSoftCloseOffered(true);

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
        setStandingTier(tierNow);
        setOffer(counterProposal);
        // The drawer opens itself the FIRST time a package arrives, so
        // countering it is one click away rather than something to go
        // looking for. Once only — see `openedOnCounterProposal`.
        if (!openedOnCounterProposal.current) {
          openedOnCounterProposal.current = true;
          setProposalOpen(true);
        }
      } else if (tierNow !== standingTier) {
        // See `standingTier`: nothing came back to replace it and the rung has
        // moved, so what is on screen can no longer be accepted. Take the
        // button away rather than leave one that does nothing.
        setLastCounterpartPackage(null);
        setStandingTier(tierNow);
      }

      const counter: DisplayMessage = {
        id: `c${next.length}`,
        speaker: "counterpart",
        text: reply,
      };
      setMessages([...next, counter]);
      setReplies((n) => n + 1);
      setStagedTurn(null);
      setDraft("");
      setTurnError(null);

      logEvent(
        "message_sent",
        {
          length: turn.text.length,
          stage: counterpartStageAfter(replies),
          secondsRemaining: turn.secondsAtSend,
          requirementOption: turn.sentOffer[requirement.id] ?? null,
          reasonLabel: label,
          reasonConfidence: confidence,
          classifierStubbed,
          tier: tierNow,
        },
        { sessionIndex: taskIndex },
      );

      if (participantKey) {
        const createdAt = new Date().toISOString();
        void getStore().appendMessage(participantKey, {
          id: own.id,
          sessionIndex: taskIndex,
          speaker: "participant",
          text: turn.text,
          createdAt: turn.createdAt,
          stage: counterpartStageAfter(replies),
          proposal: turn.sentPackage ?? undefined,
          reasonLabel: label,
          reasonConfidence: confidence,
        });
        void getStore().appendMessage(participantKey, {
          id: counter.id,
          sessionIndex: taskIndex,
          speaker: "counterpart",
          text: reply,
          createdAt,
          stage: decision.stage,
          proposal: counterProposal ?? undefined,
          decidedAction: decision.action,
        });
      }

      finishRecovery();

      // An accepted package or an impasse ends the exchange. The participant
      // sees the counterpart's last message first, and a Continue button
      // appears.
      if (!settledRef.current && (decision.accepts || decision.impasse)) {
        settledRef.current = true;
        setTentative(decision.accepts ? (decision.proposal ?? turn.sentPackage) : null);
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
      } else if (!settledRef.current && expiryPending.current) {
        settledRef.current = true;
        setTentative(null);
        setSettled("impasse");
        logEvent(
          "negotiation_ended",
          { phase: "direct", reason: "timeout" },
          { sessionIndex: taskIndex },
        );
      }
    } catch (error) {
      if (!mounted.current || generation !== turnGeneration.current || settledRef.current) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("[turn] recovery required", error);
      beginRecovery();
      setStagedTurn(turn);
      setTurnError("Your message is still here. Select Retry.");
    } finally {
      if (mounted.current && generation === turnGeneration.current) {
        setPending(false);
        activeRequest.current = null;
      }
    }
  }

  async function send(text: string, sentOffer: Package = offer) {
    if (pending || stagedTurn || settledRef.current) return;
    const immutableOffer = { ...sentOffer };
    const turn: StagedTurn = {
      text,
      sentOffer: immutableOffer,
      sentPackage: Object.keys(immutableOffer).length > 0 ? immutableOffer : null,
      ownId: `p${messages.length}`,
      createdAt: new Date().toISOString(),
      secondsAtSend: secondsRemaining,
    };
    setStagedTurn(turn);
    setDraft("");
    await runStagedTurn(turn);
  }

  /**
   * The explicit accept: take the counterpart's standing proposal as-is.
   * Deterministic, and the same control the Proxy arm's closing has, so the
   * two arms end the same three ways — a package the counterpart accepts,
   * this button, or the clock.
   */
  function acceptStanding() {
    if (!lastCounterpartPackage || pending || stagedTurn || settled) return;
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

          <NavigationNotice className="mb-3" />

          <div className="sticky top-[calc(var(--header-h)+0.25rem)] z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/95 px-4 py-3 shadow-sm backdrop-blur-md sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                  {/* NOT "Direct" — the arm names are never on screen (§8.1,
                      "which condition they are in"). The Proxy arm's closing
                      banner says "Close It Together" for the same reason: both
                      describe what is happening on the screen, neither names
                      the condition. */}
                  💬 Live Negotiation
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
                  running={!settled && !recovering}
                  paused={recovering}
                  onTick={setSecondsRemaining}
                  onExpire={() => {
                    if (settledRef.current) return;
                    if (activeRequest.current || stagedTurn) {
                      expiryPending.current = true;
                      return;
                    }
                    settledRef.current = true;
                    turnGeneration.current += 1;
                    setTentative(null);
                    setSettled("impasse");
                    logEvent(
                      "negotiation_ended",
                      { phase: "direct", reason: "timeout" },
                      { sessionIndex: taskIndex },
                    );
                  }}
                />
                {settled ? null : recovering && pending ? (
                  <Cue tone="quiet">Reconnecting…</Cue>
                ) : recovering ? null : pending ? (
                  <Cue tone="quiet">Waiting for reply…</Cue>
                ) : yourTurn ? (
                  <Cue>Your Turn</Cue>
                ) : null}
              </div>
              {turnError ? (
                <div
                  className="flex basis-full flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
                  role="alert"
                >
                  <p className="text-sm font-medium text-red-800">{turnError}</p>
                  <button
                    type="button"
                    onClick={() => stagedTurn && void runStagedTurn(stagedTurn)}
                    disabled={pending || !stagedTurn}
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-bold text-red-800 disabled:opacity-50"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
          </div>

          <Card className="mb-6 flex flex-col border-slate-200" padded={false}>
            <Transcript
              messages={messages}
              pending={pending}
              emptyHint="The other side opens first. Your reply will start the live exchange."
            />

            <MessageComposer
              value={stagedTurn?.text ?? draft}
              onChange={setDraft}
              onSend={send}
              disabled={pending || Boolean(stagedTurn) || !canSend}
              cue={yourTurn}
              sendLabel="Send"
              placeholder={
                settled
                  ? "This conversation has concluded."
                  : canSend
                    ? "Type your message here…"
                    : "Choose both terms below, or neither, before sending."
              }
            />
          </Card>

          {!settled && lastCounterpartPackage ? (
            <div className="mb-6">
              <button
                type="button"
                onClick={acceptStanding}
                disabled={pending || Boolean(stagedTurn)}
                className="rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-2xs transition-colors hover:bg-emerald-100 disabled:opacity-50"
              >
                ✓ Accept their latest proposal as it stands
              </button>
            </div>
          ) : null}

          {/* THE PROPOSAL SELECTOR, DEMOTED (Ver.2.20 round two).

              It sits BELOW the composer and starts collapsed, because the
              conversation is the task and a chip grid above the transcript
              read as the thing being asked for. It cannot be REMOVED: it is
              the only channel by which the participant's package reaches
              `machine.ts`, and reading a package out of their prose would
              hand a negotiation decision to a model (§6.7).

              It is `<details>` rather than state for the same reason the
              briefing panel's sections are: a live negotiation re-renders on
              every tick and every bubble, find-in-page still reaches a closed
              section, and the open/closed state survives without a hook.
              `open` is controlled here only so the drawer can open itself
              once when a package first arrives. */}
          <details
            open={proposalOpen}
            onToggle={(e) => setProposalOpen(e.currentTarget.open)}
            className="mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]"
          >
            <summary className="cursor-pointer list-none rounded-[var(--radius-lg)] px-5 py-4 sm:px-7">
              <span className="flex items-center justify-between gap-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold leading-snug tracking-tight text-[var(--ink)] sm:text-lg">
                    📦 Attach a proposal (optional)
                  </span>
                  {/* LIVE, not a static hint: this is the only place a
                      participant with the drawer shut can see what their next
                      message will carry. */}
                  <span className="mt-1 block text-sm leading-relaxed text-[var(--ink-3)]">
                    {attachedSummary}
                  </span>
                </span>
                <span className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--ink-2)]">
                  {proposalOpen ? "▲ Hide" : "▼ Show"}
                </span>
              </span>
            </summary>
            <fieldset
              disabled={pending || Boolean(stagedTurn)}
              className="space-y-4 px-5 pb-5 disabled:opacity-60 sm:px-7 sm:pb-7"
            >
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
              {/* A HALF PACKAGE IS THE ONE BLOCKED STATE, and it is said
                  quietly — in the SUMMARY, which is visible whether the
                  drawer is open or shut, rather than here where a participant
                  with it closed would never see why their composer had gone
                  quiet. No cue ring and no pill: a cue names the thing the
                  screen is waiting for, and the screen is waiting for a
                  message, not for a second chip (interface rule 9). */}
            </fieldset>
          </details>
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
        // NO TERM COUNT HERE ANY MORE. "x of 2 terms selected" told the
        // participant, on the one persistent bar of the screen, that
        // selecting terms was the outstanding business. It is optional now.
        <ActionBar note={outOfTime ? "Time expired" : undefined} />
      )}
    </>
  );
}
