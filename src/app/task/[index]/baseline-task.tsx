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
  NUDGE_AFTER_SILENT_SECONDS,
  codeOutcome,
  counterpartStageAfter,
  counterpartStep,
  mentionsScoreNumbers,
  foldTier,
  LABEL_TIER,
  type ExchangeState,
  type ReasonTier,
  type SbTiming,
} from "@/lib/negotiation/machine";
import {
  INITIAL_EXCHANGE_STATE,
  foldExchangeState,
  isClassificationResponse,
  isCounterpartResponse,
  resolveCounterTerms,
  storedLabel,
  takeExchangeState,
  type ClassificationResponse,
  type ClassifierLogEntry,
  type CounterpartResponse,
  type HeldExchangeState,
} from "./turn-contract";
import {
  reciprocalAcceptanceText,
  seededOpeningText,
} from "@/lib/negotiation/counterpart-text";
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
  // SCRIPT-OPEN (§6.1, §6.4): the counterpart's own work reason — which since
  // Ver.2.21 is NON-DIRECTIONAL, "both of these are on my mind" — and the
  // question that invites the participant's situation. NO PACKAGE, and NO
  // STATEMENT OF ITS OWN PRIORITY.
  //
  // THE DECOY AND ITS MISREAD ARE GONE (Ver.2.21). The work reason no longer
  // points at the wrong term, so there is no wrong-term package to offer and
  // SCRIPT-MISREAD was deleted with it; a work reason now simply buys the same
  // rung as silence (§3.3). What survives from that design is the two
  // omissions above. Withholding its own priority is what leaves the
  // participant to start without knowing which term the other side needs, and
  // asking "what's the situation" rather than "what matters most on your side"
  // is what stops the screen inviting a bare priority claim as the opening
  // move — a claim that buys nothing and earns one SCRIPT-ASKWHY.
  //
  // IT USED TO OPEN ON ITS OWN BEST PACKAGE, and Ver.2.13 §2.6 removed that
  // deliberately: an opening of "my best, your worst" is a face threat in its
  // own right — the non-negotiable, lowball offer White et al. (2004) name —
  // and it made a high-FTS participant competitive by a route that has nothing
  // to do with disclosure. The first package the participant ever sees is now
  // the symmetric tier package, where both sides move equally.
  //
  // BUBBLED THROUGH THE SHARED HELPER (§12 P1). This pasted the work reason
  // card in whole, and the four cards run 225-277 characters, so the very
  // first message a Direct participant ever saw was one paragraph of that
  // length from someone they have been told is another participant. The route,
  // the mockup and the simulation each had their own copy of this line; three
  // were fixed before this one, which is exactly why it is one function now.
  const wr = cardOfLayer(task, counterpartRole, "work");
  return seededOpeningText(wr?.text, "what's the situation on your side?");
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
 * The staged turn.
 *
 * `texts` carries EVERY participant message in this task, in order, because
 * the classifier reads them cumulatively (§6.2a): people say a confession
 * across two or three messages, and judging each alone under the
 * "ambiguous goes lower" rule would put a systematic floor on Direct
 * disclosure — which would then read as the Proxy arm's protective effect.
 *
 * The wire shapes and their validators live in `./turn-contract`, imported by
 * this arm and by the Proxy arm's closing alike, because a difference between
 * the two lands on `Pooled Proxy − Direct` itself.
 */
interface StagedTurn {
  texts: string[];
  text: string;
  sentOffer: Package;
  sentPackage: Package | null;
  ownId: string;
  createdAt: string;
  secondsAtSend: number;
  classification?: ClassificationResponse;
}
/** Ver.2.23 removes the pre-task RISK battery. */
type Phase =
  | "intro"
  | "brief"
  | "prefs"
  | "matchmaking"
  | "negotiate"
  | "review";

const PHASES: Phase[] = [
  "intro",
  "brief",
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
  "What you want",
  "Negotiate",
  "Review",
];

const PHASE_LABELS: Record<Phase, string> = {
  intro: "Start screen",
  brief: "Your briefing",
  prefs: "What you want",
  matchmaking: "Connecting",
  negotiate: "Negotiate",
  review: "Review",
};

/**
 * `SB-TIMING` for the Direct arm (§9.3, §6.9 #10-#11).
 *
 * THE LOCK IS THE FIRST REASON TURN, not the first message (§6.1 stage 2-3).
 * A participant whose opening is a greeting or a bare demand has not spent
 * their reason opportunity: the counterpart asks once with SCRIPT-ASKSIT and
 * waits, and only a second reasonless turn settles it as "no reason". So
 * `sbFirstChoice` — which is `SB`, the confirmatory outcome — is whether the
 * SB was out when that turn ended, and it is the machine's answer, not a
 * reply count.
 *
 * A confession made after the lock still raises the tier and still pays
 * 3,000; it is recorded as `later_turn` and `SB` stays 0 (§6.9 #11).
 */
function sbTimingCode(
  sbFirstChoice: boolean,
  sbEverVoiced: boolean,
): SbTiming {
  if (sbFirstChoice) return "first_chance";
  return sbEverVoiced ? "later_turn" : "never";
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
  prefs: 1,
  matchmaking: 2,
  negotiate: 2,
  review: 3,
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
  /**
   * The classifier's `priority_claim` flag (§6.2). It buys no rung — Ver.2.21
   * deleted the one it used to — and its whole effect is one SCRIPT-ASKWHY,
   * which is where the participant HEARS that a claim without a reason moves
   * nothing.
   */
  const [priorityClaimed, setPriorityClaimed] = useState(false);
  /** Confidence in the CURRENT label, for SCRIPT-CLARIFY (§6.2). */
  const [labelConfidence, setLabelConfidence] = useState<number | undefined>(
    undefined,
  );
  /**
   * The one-shot script flags, held as ONE object.
   *
   * The counterpart route returns the state it advanced and the client
   * replaces what it holds; eight separate `useState` calls are what made a
   * field get dropped on the merge last time, which turns a one-shot script
   * into a no-shot or an every-turn one. Identical to the Proxy arm's closing
   * (`shared.tsx`), which is the point.
   */
  const [exchange, setExchange] = useState<HeldExchangeState>(
    INITIAL_EXCHANGE_STATE,
  );
  /** Any participant message so far mentioned score numbers (one-shot pool). */
  const [numbersEver, setNumbersEver] = useState(false);
  /**
   * `SB` — was the participant's sensitive background out when their FIRST
   * REASON TURN ended (§6.1 stage 3, §9.3)?
   *
   * NOT "was it in the first message". The first reason turn runs until a
   * reason actually appears: a greeting or a bare demand gets SCRIPT-ASKSIT
   * and the turn continues. So the lock is taken on the turn where the label
   * first rises above `none`, or on the second reasonless turn, whichever
   * comes first — and `machine.ts` decides which of those happened through
   * `reasonlessTurns` and the ask-sit action.
   */
  const [sbFirstChoice, setSbFirstChoice] = useState<boolean | null>(null);
  /** Did the participant ever voice it, at any point? Feeds `later_turn`. */
  const [sbEverVoiced, setSbEverVoiced] = useState(false);
  /** Every participant message, in order, for the CUMULATIVE classifier. */
  const participantTexts = useRef<string[]>([]);
  /** The stored `{text, label, confidence, stance}` log, for gate 19's κ. */
  const classifierLog = useRef<ClassifierLogEntry[]>([]);
  /** When the participant last sent anything, for the client-timed nudge. */
  const lastParticipantAt = useRef<number>(Date.now());
  const nudgeRequested = useRef(false);
  /** A message that arrived while a turn was in flight, waiting to be folded. */
  const queuedText = useRef<string | null>(null);


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
    /**
     * THE PARTICIPANT'S OWN SCRIPTED MESSAGES, IN ORDER, not by stage index.
     *
     * It used to look each one up by a hard-coded stage — `[1, 2, 5][replies]`
     * — which broke silently the moment Ver.2.21 rewrote the Direct script:
     * the participant's first turn is stage 2 there (their first REASON
     * opportunity, §6.1), so slot 1 found nothing and the composer arrived
     * empty on the one screen the mockup exists to show. Reading the script's
     * own participant turns in order cannot drift with the stage numbering
     * again.
     */
    const own = script.messages.filter((m) => m.speaker === "participant");
    const next = own[replies] ?? own[own.length - 1];
    if (next) {
      setDraft(next.text);
      if (next.proposal) setOffer(next.proposal);
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
          let label: ClassificationResponse["label"] = "none";
          const mockedReason = script.messages.find(
            (message) => message.speaker === "participant" &&
              message.text === turn.text && message.reasonCardId,
          );
          if (mockedReason?.reasonCardId) {
            label = cardOfLayer(task, role, "sensitive")?.id === mockedReason.reasonCardId
              ? "SB"
              : "WR";
          }
          classification = { label, stance: "none" };
        } else {
          classification = await fetchJsonWithRetry<ClassificationResponse>(
            "/api/classify-reason",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // THE WHOLE LIST, EVERY TIME (§6.2a). See `StagedTurn.texts`.
              body: JSON.stringify({ taskId, role, messages: turn.texts }),
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

      const {
        label,
        confidence,
        stubbed: classifierStubbed = false,
        stance = "none",
        priority_claim: priorityNow = false,
      } = classification;
      const tierNow: ReasonTier = foldTier(tier, LABEL_TIER[label]);
      const priorityClaimedNow = priorityClaimed || priorityNow;
      const sbEverNow = sbEverVoiced || label === "SB";

      /**
       * STANCE, RESOLVED BEFORE THE MACHINE SEES IT (§6.2, §6.9 #18).
       *
       * `accept` means the participant agreed in words to what is on the
       * table, so the standing package travels as their offer — the same
       * thing the Accept button does, by the same deterministic route.
       * `counter` means they named terms in prose, treated exactly like a
       * package from the drawer. Neither hands the model a decision: the
       * classifier reports what was said, `machine.ts` decides what it buys.
       */
      const counterPackage = resolveCounterTerms(
        task.issues,
        classification.counter_terms,
      );
      const incoming: Package | null =
        stance === "accept" && lastCounterpartPackage
          ? lastCounterpartPackage
          : stance === "counter" && counterPackage
            ? counterPackage
            : turn.sentPackage;

      const own: DisplayMessage = {
        id: turn.ownId,
        speaker: "participant",
        text: turn.text,
      };
      const next = [...messages, own];
      const turnStartedAt = Date.now();
      let reply: string;
      let counterProposal: Package | null = null;
      let nextState: HeldExchangeState;
      let settledNow: "agreed" | "impasse" | null;

      // Where the counterpart is in ITS OWN script. Direct can skip the
      // sensitive-disclosure position or combine disclosure with acceptance;
      // the machine decides that from the explicit reciprocal policy.
      const stageNow = counterpartStageAfter(replies + SEEDED_OPENING_STAGES);

      const mentioned = numbersEver || mentionsScoreNumbers(turn.text);
      const stateForTurn: ExchangeState = {
        ...exchange,
        tier: tierNow,
        disclosurePolicy: "reciprocal",
        priorityClaimed: priorityClaimedNow,
        labelConfidence: confidence,
        // A turn carrying a message is not a silent one, whatever the nudge
        // timer thought a moment ago.
        participantSilent: false,
        numbersMentionedNow: mentioned,
        secondsRemaining: turn.secondsAtSend,
      };

      if (mockAi) {
        /**
         * MOCKUP MODE IS THE ONE PLACE THIS CLIENT RUNS THE MACHINE ITSELF.
         *
         * It never calls the route, so there is no `state` and no `settled` to
         * read — the scripted reply has to be chosen from something, and the
         * machine is the only thing that agrees with what the live path would
         * have done. `tests/reason-rules.test.mjs` pins that agreement in every
         * cell, which is what makes a mockup a preview of this study rather
         * than of a different one.
         *
         * The LIVE path below must not do this. See the note there.
         */
        const decision = counterpartStep(
          task,
          counterpartRole,
          stageNow,
          incoming,
          stateForTurn,
        );
        counterProposal = decision.proposal;
        nextState = foldExchangeState(exchange, undefined, {
          askedWhy: decision.action === "ask_why",
          askSitUsed: decision.action === "ask_sit",
          nudgeUsed: decision.action === "nudge",
          numbersReminded: decision.action === "nonum",
          softCloseOffered: decision.action === "soft_close",
          counterpartSbDisclosed:
            decision.action === "disclose_sb" ||
            decision.action === "disclose_sb_and_accept",
          reasonlessTurns:
            tierNow === "none" ? (exchange.reasonlessTurns ?? 0) + 1 : 0,
          clarifyUsedForTier:
            decision.action === "clarify" ? tierNow : exchange.clarifyUsedForTier,
        });
        settledNow = decision.impasse
          ? "impasse"
          : decision.accepts
            ? "agreed"
            : null;
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
              incoming,
              afterProxy: false,
              history: next.map((m) => ({
                role: m.speaker === "participant" ? "user" : "assistant",
                content: m.text,
              })),
              // THE WHOLE EXCHANGE STATE, sent and replaced. Every input the
              // client coded its own outcome from has to reach the route
              // unchanged, or the two can disagree about whether the exchange
              // was agreed.
              ...stateForTurn,
            }),
          },
          {
            signal: controller.signal,
            onFailure: failedAttempt,
            validate: isCounterpartResponse,
          },
        );
        reply = data.message;
        /**
         * THE ROUTE'S ANSWER IS THE AUTHORITY, AND THE CLIENT DOES NOT
         * RE-DERIVE IT (Ver.2.21 contract).
         *
         * The response carries the message, the package, the FULL advanced
         * state with every one-shot flag already folded in, and `settled`.
         * It deliberately does NOT carry the decided action: a network tab
         * showing `propose_tier` or `ask_why` tells the participant the other
         * party is a script, which is the one thing this arm cannot survive
         * (§8.1, "the counterpart is an AI").
         *
         * So nothing here branches on which script fired. The bubbles render
         * from `message` alone, the clock stops on `settled`, and the flags
         * are REPLACED rather than merged — a local fold would be the client
         * re-deriving a decision it was deliberately not told, which is how
         * the two ends of `voicedTier` drifted apart once already.
         */
        counterProposal = data.proposal ?? null;
        nextState = takeExchangeState(data.state, exchange);
        settledNow = data.settled ?? null;
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
      setPriorityClaimed(priorityClaimedNow);
      setLabelConfidence(confidence);
      setSbEverVoiced(sbEverNow);
      setNumbersEver(mentioned);

      /**
       * THE LOCK, AND IT IS TAKEN HERE (§6.1 stage 3, §9.3).
       *
       * §6.1 puts the turn boundary at "the moment the counterpart's reply
       * renders", and stage 3 records at that boundary whether the participant
       * side's SB was out. This is that moment: both requests have returned,
       * the visible delay has elapsed, and the reply is about to be committed
       * to the transcript.
       *
       * THE FIRST REASON TURN IS NOT THE FIRST MESSAGE. It runs until a reason
       * actually appears — a greeting or a bare demand does not spend it,
       * because the counterpart answers that with SCRIPT-ASKSIT and waits
       * (§6.1 stage 2). Only a second consecutive reasonless turn settles it
       * as "no reason given". So the lock falls on whichever comes first:
       *
       *   - this turn's cumulative label rose to WR or SB, or
       *   - `reasonlessTurns` has reached 2.
       *
       * `SB` is then simply whether the rung reached at that moment is the
       * sensitive one. Coding it off the first message instead would record
       * every participant who says hello first as a non-discloser, which is a
       * floor on the study's confirmatory outcome.
       *
       * IT IS TAKEN ONCE AND NEVER RE-TAKEN. `sbFirstChoice` stays null until
       * the boundary and holds its value afterwards; a later confession raises
       * the tier and pays 3,000, but is `later_turn`, not `first_chance`
       * (§6.9 #11).
       *
       * `reasonlessTurns` is read from the state the route just advanced, not
       * recounted here — the route folded it from the same cumulative tier, and
       * two ends counting one number is the shape of every drift in this file.
       */
      const reasonlessNow = nextState.reasonlessTurns ?? 0;
      const lockTaken = label !== "none" || reasonlessNow >= 2;
      const sbFirstChoiceNow =
        sbFirstChoice ?? (lockTaken ? tierNow === "sensitive" : null);
      if (sbFirstChoice === null && sbFirstChoiceNow !== null) {
        setSbFirstChoice(sbFirstChoiceNow);
        // `decision_locked` is the existing event for "a disclosure choice
        // is now fixed"; the Proxy arm writes it at DECISION-LOCK, where the
        // checkbox is sealed. `phase` says which of the two this is, so the
        // export can tell the Direct lock from the Proxy one without a new
        // event type in `lib/types.ts`.
        logEvent(
          "decision_locked",
          {
            phase: "first_reason_turn",
            sb: sbFirstChoiceNow,
            tier: tierNow,
            reasonlessTurns: reasonlessNow,
          },
          { sessionIndex: taskIndex },
        );
      }

      // THE ROUTE'S STATE, TAKEN WHOLE. It folded every one-shot flag from the
      // move it actually made; re-deriving them here would be this client
      // guessing at a decision the wire deliberately does not name. Mockup mode
      // reaches the same object through `foldExchangeState` above, which is the
      // only place a local fold is legitimate.
      setExchange(nextState);

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
      nudgeRequested.current = false;

      classifierLog.current = [
        ...classifierLog.current,
        {
          text: turn.text,
          label,
          confidence: confidence ?? null,
          stance,
          priorityClaim: priorityNow,
          tier: tierNow,
          messageIndex: turn.texts.length - 1,
          createdAt: turn.createdAt,
        },
      ];

      logEvent(
        "message_sent",
        {
          length: turn.text.length,
          stage: counterpartStageAfter(replies),
          secondsRemaining: turn.secondsAtSend,
          requirementOption: turn.sentOffer[requirement.id] ?? null,
          reasonLabel: label,
          reasonConfidence: confidence,
          reasonStance: stance,
          priorityClaim: priorityNow,
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
          reasonLabel: storedLabel(label),
          reasonConfidence: confidence,
        });
        // NO `decidedAction` ON THE COUNTERPART'S ROW. The route no longer
        // sends the script name and this client no longer knows it — which is
        // the point: the audit's copy of the decided action is written
        // server-side, where it cannot reach a participant's network tab
        // (§6.7, and CLAUDE.md's rule 1).
        void getStore().appendMessage(participantKey, {
          id: counter.id,
          sessionIndex: taskIndex,
          speaker: "counterpart",
          text: reply,
          createdAt,
          stage: stageNow,
          proposal: counterProposal ?? undefined,
        });
      }

      finishRecovery();

      // THE EXCHANGE ENDS ON `settled`, NEVER ON AN ACTION NAME. It arrives on
      // the combined disclose-and-accept turn too, which is exactly why looking
      // for an "accept" move would miss the one case §6.1 stage 6 added: a
      // participant who discloses and agrees in the same message gets one reply
      // carrying both, and that reply is the end of the task.
      if (!settledRef.current && settledNow) {
        const pkg =
          settledNow === "agreed" ? (counterProposal ?? incoming) : null;
        settledRef.current = true;
        setTentative(pkg);
        setSettled(settledNow);
        endTask(settledNow, pkg, settledNow, {
          replies: replies + 1,
          tier: tierNow,
          sbFirstChoice: sbFirstChoiceNow,
          sbEverVoiced: sbEverNow,
          priorityClaimed: priorityClaimedNow,
        });
      } else if (!settledRef.current && expiryPending.current) {
        settledRef.current = true;
        setTentative(null);
        setSettled("impasse");
        endTask("impasse", null, "timeout", {
          replies: replies + 1,
          tier: tierNow,
          sbFirstChoice: sbFirstChoiceNow,
          sbEverVoiced: sbEverNow,
          priorityClaimed: priorityClaimedNow,
        });
      } else if (queuedText.current !== null) {
        // A message arrived while this reply was still on the wire and could
        // not be folded into it. Send it now rather than dropping it — the
        // participant pressed send and watched their words disappear
        // otherwise.
        const queued = queuedText.current;
        queuedText.current = null;
        void send(queued);
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

  /**
   * Everything §9.3 and §6.2 need from this task, written once when the
   * exchange ends.
   *
   * ONE WRITE, NOT ONE PER FIELD, and the classifier log travels with it: gate
   * 19's κ is computed off `{text, label, confidence}` for every participant
   * message, and a per-message write would put a request on the wire on every
   * turn — a timing tell as well as a stall.
   */
  function endTask(
    kind: "agreed" | "impasse",
    pkg: Package | null,
    reason: string,
    committed: {
      replies: number;
      tier: ReasonTier;
      sbFirstChoice: boolean | null;
      sbEverVoiced: boolean;
      priorityClaimed: boolean;
    },
  ) {
    // THE OUTCOME IS CODED BY THE MACHINE, not by this screen. `codeOutcome`
    // owns "no agreement is worth nothing" (§3.2) and the requirement
    // trajectory the review screen reads.
    const outcome = codeOutcome(task, role, pkg, kind === "agreed");
    const sb = Boolean(committed.sbFirstChoice);
    const sbTiming = sbTimingCode(sb, committed.sbEverVoiced);
    logEvent(
      "negotiation_ended",
      {
        phase: "direct",
        reason,
        replies: committed.replies,
        secondsRemaining,
        tier: committed.tier,
        priorityClaimed: committed.priorityClaimed,
        sb,
        sbTiming,
        outcome,
      },
      { sessionIndex: taskIndex },
    );
    if (!participantKey) return;
    void getStore().saveResponses(
      participantKey,
      `negotiation_t${taskIndex}`,
      {
        taskId,
        role,
        phase: "direct",
        tier: committed.tier,
        [`SB_t${taskIndex}`]: sb,
        [`SB-TIMING_t${taskIndex}`]: sbTiming,
        sbFirstChoice: sb,
        sbTiming,
        priorityClaimed: committed.priorityClaimed,
        // JSON, NOT NESTED OBJECTS. `ResponseValue` is deliberately flat —
        // one row per item id is what makes the export a table — so the two
        // structured records travel as text and are parsed by the analysis.
        classifierLog: JSON.stringify(classifierLog.current),
        outcome: JSON.stringify(outcome),
        participantPoints: outcome.participantPoints,
        jointPoints: outcome.jointPoints,
      },
    );
  }

  /**
   * SCRIPT-NUDGE, timed on the CLIENT (§6.2, §6.9 #17).
   *
   * The counterpart has nothing to answer — no package arrived, no reason was
   * given — so there is no turn to hang the nudge on. The client watches the
   * silence instead, asks for exactly one nudge turn, and then the counterpart
   * simply waits, which is what §6.9 #17 describes. It runs through the same
   * `counterpartStep` as everything else, so the machine still owns whether
   * the nudge is available.
   */
  async function runNudge() {
    if (settledRef.current || pending || stagedTurn) return;
    if (exchange.nudgeUsed || nudgeRequested.current) return;
    nudgeRequested.current = true;
    const generation = turnGeneration.current + 1;
    turnGeneration.current = generation;
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    try {
      const stageNow = counterpartStageAfter(replies + SEEDED_OPENING_STAGES);
      const stateForTurn: ExchangeState = {
        ...exchange,
        tier,
        disclosurePolicy: "reciprocal",
        priorityClaimed,
        labelConfidence,
        participantSilent: true,
        numbersMentionedNow: false,
        secondsRemaining,
      };
      let reply: string;
      let nextState: HeldExchangeState;
      let proposalNow: Package | null = null;
      let settledNow: "agreed" | "impasse" | null = null;
      if (mockAi) {
        // Mockup mode has no route, so the machine answers — and it may
        // legitimately decline: the nudge sits below SCRIPT-CLOSE in the guard
        // order, so near the end of the clock a silence is answered by the
        // closing offer instead.
        const decision = counterpartStep(
          task,
          counterpartRole,
          stageNow,
          null,
          stateForTurn,
        );
        if (decision.action !== "nudge") return;
        reply = "still there? || no rush — say whatever comes to mind.";
        nextState = foldExchangeState(exchange, undefined, { nudgeUsed: true });
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
              incoming: null,
              afterProxy: false,
              history: messages.map((m) => ({
                role: m.speaker === "participant" ? "user" : "assistant",
                content: m.text,
              })),
              ...stateForTurn,
            }),
          },
          { signal: controller.signal, validate: isCounterpartResponse },
        );
        /**
         * WHATEVER COMES BACK IS THE TURN, and this client does not check
         * which script it was.
         *
         * The request is only made when the state's own preconditions hold —
         * silent past the threshold, the nudge unspent, nothing on the table —
         * so the machine has a nudge available. But SCRIPT-CLOSE outranks it
         * (see the guard order in `counterpartStep`), so near the end of the
         * clock a silence is correctly answered with the closing offer
         * instead. That is the right move to show, not a case to suppress:
         * suppressing it would leave a silent participant with no closing
         * offer at all, which is the route to an impasse worth nothing.
         */
        reply = data.message;
        proposalNow = data.proposal ?? null;
        nextState = takeExchangeState(data.state, exchange);
        settledNow = data.settled ?? null;
      }
      if (!mounted.current || generation !== turnGeneration.current || settledRef.current) {
        return;
      }
      const counter: DisplayMessage = {
        id: `c-nudge${messages.length}`,
        speaker: "counterpart",
        text: reply,
      };
      setMessages((prev) => [...prev, counter]);
      setExchange(nextState);
      // A closing offer arriving here carries a package, and it has to reach
      // the Accept button like any other — otherwise the one move that rescues
      // a silent participant from a zero would be visible and unacceptable.
      if (proposalNow) {
        setLastCounterpartPackage(proposalNow);
        setStandingTier(tier);
        setOffer(proposalNow);
        if (!openedOnCounterProposal.current) {
          openedOnCounterProposal.current = true;
          setProposalOpen(true);
        }
      }
      if (participantKey) {
        void getStore().appendMessage(participantKey, {
          id: counter.id,
          sessionIndex: taskIndex,
          speaker: "counterpart",
          text: reply,
          createdAt: new Date().toISOString(),
          stage: stageNow,
          proposal: proposalNow ?? undefined,
        });
      }
      if (!settledRef.current && settledNow) {
        settledRef.current = true;
        setTentative(settledNow === "agreed" ? proposalNow : null);
        setSettled(settledNow);
        endTask(settledNow, settledNow === "agreed" ? proposalNow : null, settledNow, {
          replies,
          tier,
          sbFirstChoice,
          sbEverVoiced,
          priorityClaimed,
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // A failed nudge is not worth a recovery banner: nothing the participant
      // did is waiting on it, and the retry path is for their own messages.
      console.error("[nudge]", error);
      nudgeRequested.current = false;
    } finally {
      if (mounted.current && generation === turnGeneration.current) {
        setPending(false);
        activeRequest.current = null;
      }
    }
  }

  /**
   * Send a participant message.
   *
   * THE TURN BOUNDARY IS THE MOMENT THE REPLY RENDERS (§6.1 stage 3), so a
   * message sent while the counterpart's delay is still running is FOLDED
   * INTO THE SAME TURN: the pending reply is cancelled, the whole message list
   * is re-classified, and the counterpart answers the new state once.
   *
   * That is what makes the LOCK land on everything the participant said in
   * their first reason turn rather than on whichever fragment arrived first —
   * and `SB` is exactly that lock. Without it, someone who writes a confession
   * as "actually, there's something" then "the client asked for the lead" is
   * recorded as a non-discloser on the strength of the first half.
   *
   * One in-flight request at a time, always: a second is queued, never
   * dropped. Identical to the Proxy arm's closing.
   */
  async function send(text: string, sentOffer: Package = offer) {
    if (settledRef.current) return;
    lastParticipantAt.current = Date.now();
    nudgeRequested.current = false;

    if (pending || stagedTurn) {
      const inFlight = stagedTurn;
      if (inFlight) {
        turnGeneration.current += 1;
        activeRequest.current?.abort();
        activeRequest.current = null;
        participantTexts.current = [...participantTexts.current, text];
        const merged: StagedTurn = {
          texts: [...participantTexts.current],
          text,
          sentOffer: { ...sentOffer },
          sentPackage:
            Object.keys(sentOffer).length > 0 ? { ...sentOffer } : null,
          ownId: `p${messages.length + 1}`,
          createdAt: new Date().toISOString(),
          secondsAtSend: secondsRemaining,
        };
        // The first message's bubble goes up now; it was never committed,
        // because its own turn had not finished.
        setMessages((prev) => [
          ...prev,
          { id: inFlight.ownId, speaker: "participant", text: inFlight.text },
        ]);
        setStagedTurn(merged);
        setDraft("");
        await runStagedTurn(merged);
        return;
      }
      queuedText.current = text;
      setDraft("");
      return;
    }

    participantTexts.current = [...participantTexts.current, text];
    const immutableOffer = { ...sentOffer };
    const turn: StagedTurn = {
      texts: [...participantTexts.current],
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
        scene="direct"
        /* NO `minutes` OVERRIDE (round six). Both covers now read
           `STAGE_MINUTES.task`, so the two arms quote the same figure on the
           screen where a participant decides whether to go on. The two arms
           differing here — 7 against the Proxy cover's 5 — was an exposure
           difference on the primary contrast, and the two overrides had drifted
           into contradicting their own comments: this one called Direct "the
           shorter arm" while quoting the larger number. */
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
          sb: Boolean(sbFirstChoice),
          sbTiming: sbTimingCode(Boolean(sbFirstChoice), sbEverVoiced),
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
                      ? "⚠️ Time ran out. Nothing is settled, so you both score 0 for this task."
                      : "Messages are sent directly to the other participant in real time."}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <CountdownTimer
                  seconds={NEGOTIATION_SECONDS}
                  running={!settled && !recovering}
                  paused={recovering}
                  onTick={(remaining) => {
                    setSecondsRemaining(remaining);
                    // SCRIPT-NUDGE is client-timed because a silence produces
                    // no turn to hang it on (§6.9 #17). Requested once; the
                    // machine's `nudgeUsed` decides whether it is still
                    // available. Identical to the Proxy arm's closing.
                    if (
                      !settledRef.current &&
                      !pending &&
                      !stagedTurn &&
                      !exchange.nudgeUsed &&
                      !nudgeRequested.current &&
                      Date.now() - lastParticipantAt.current >=
                        NUDGE_AFTER_SILENT_SECONDS * 1000
                    ) {
                      void runNudge();
                    }
                  }}
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
              value={stagedTurn && pending ? draft : (stagedTurn?.text ?? draft)}
              onChange={setDraft}
              onSend={send}
              /* THE COMPOSER STAYS OPEN WHILE THE REPLY IS COMING (§6.1
                 stage 3). What arrives before the reply renders is folded into
                 the same turn; a locked composer would make the turn boundary
                 the moment of SENDING rather than the moment of ANSWERING,
                 and the LOCK — `SB`, the confirmatory outcome — is taken at
                 the end of the turn. Same in the Proxy arm's closing. */
              disabled={!canSend}
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
              : "⚠️ No agreement — 0 points for this task. Proceed to review."
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
