"use client";

/**
 * Proxy task (Experimental Design Ver.2.4 §8 "Proxy task 흐름").
 *
 * Flow: cover → brief → RISK → mandate (levels + reasons) → confirm →
 *       matchmaking → WATCH the two AI Proxies negotiate → handover →
 *       negotiate directly → review.
 *
 * Four things in that line are recent and easy to write back the old way:
 *
 *  - RISK comes before the mandate, not after. It asks what the participant
 *    EXPECTS raising their requirement to cost, so asking it after the mandate
 *    would have them answer having already decided which sensitive cards to
 *    hand over and read the policy disclosure — a pre-task measure turned
 *    partly post-treatment, in one arm only. It is now asked straight after
 *    the briefing, which is where Baseline asks it too.
 *  - The mandate is ONE screen. Levels on both terms and the reason cards
 *    used to be two screens in sequence; deciding a position and deciding what
 *    may be said for it is one act, and that the second half was never asked
 *    is the gap this study is about.
 *  - The proxies run ONCE. There is no revision and no second run; the
 *    participant takes over and finishes the negotiation themselves, and what
 *    the two people agree is the result.
 *  - The review does not ratify. Both arms now end with the participant
 *    agreeing a package in conversation, so there is nothing left to approve.
 *
 * DECEPTION INTEGRITY: Delegate and Explorer render the SAME interface. The
 * only difference is what the backend permits the proxies to do. The
 * transcript never marks which reasons came from the participant's cards and
 * which from the plausible-reason pool — provenance is stripped server-side.
 * Nothing in this file may branch on `policy` except the value passed to the
 * API and to the scripted exchange used in mockup mode, and the one sentence
 * of policy disclosure, which Design §7 requires BOTH principals to be told.
 *
 * THE PARTICIPANT WATCHES. ver.1.8 hid the exchange behind a progress bar and
 * showed the transcript afterwards. Design §4 replaces that with live
 * spectating by both principals, which is not a presentation choice: the
 * social-cost measures ask how it felt to have this said on your behalf, and
 * that question means something different if you watched it happen than if you
 * read it later. The "they are watching this too" banner is part of the same
 * fact.
 */

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  SpectatorBanner,
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";
import {
  BriefingPanel,
  IssueReasonGroups,
  TaskCover,
  TaskHeader,
  TaskLayout,
} from "@/components/session";
import { ActionBar } from "@/components/study-chrome";
import { Callout, Card, CardTitle, Page, cx } from "@/components/ui";
import { MeasureBlock } from "@/components/measure";
import { m1Item } from "@/lib/measures";
import {
  useDevActions,
  useDevAutofill,
  useDevMockAi,
} from "@/lib/dev-mode";

import { scriptedTask } from "@/lib/negotiation/script";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { NEGOTIATION, nextHref, pauseMs } from "@/lib/study-config";
import {
  defaultAuthorizedReasonIds,
  getTask,
  reasonScope,
  requirementIssue,
} from "@/lib/tasks";
import type {
  Issue,
  IssueMandate,
  Mandate,
  Package,
  Role,
  StageId,
  TaskId,
} from "@/lib/types";
import { ReviewPhase } from "./review";
import {
  DirectNegotiation,
  Matchmaking,
  PreferenceForm,
  RehearsalChat,
  RiskForm,
  TaskBrief,
  TaskIntro,
  type Preferences,
} from "./shared";

/**
 * RISK COMES BEFORE THE MANDATE, and that ordering is not cosmetic.
 *
 * An earlier version of this file asked it after the mandate — so a Proxy
 * participant answered "raising this could make them think worse of me" having
 * ALREADY decided which sensitive cards to hand over, read the two-box framing
 * and been told the policy. That makes a pre-task measure partly
 * post-treatment in one arm only, and RISK is §10 gate 4's task-equivalence
 * instrument, so it cannot carry a condition effect.
 *
 * Merging the levels and the reason cards onto one screen made the old
 * placement unsafe even where it had been fine: after that screen is after the
 * mandate. Both arms now ask it in the same place, cold, straight after the
 * briefing:
 *
 *   Baseline: brief → RISK → levels → negotiate
 *   Proxy:    brief → RISK → levels + reasons → confirm → watch → negotiate
 */
type Phase =
  | "intro"
  | "brief"
  | "risk"
  | "mandate"
  | "rehearsal"
  | "confirm"
  | "matchmaking"
  | "watching"
  | "handover"
  | "negotiate"
  | "review";

const PHASES: Phase[] = [
  "intro",
  "brief",
  "risk",
  "mandate",
  "rehearsal",
  "confirm",
  "matchmaking",
  "watching",
  "handover",
  "negotiate",
  "review",
];

/**
 * The phases the progress bar counts. The cover is not one of them: it is the
 * screen you are on before the task starts, and filling the first segment
 * would make the bar read as part-done before anything had happened.
 */
const STEP_LABELS = [
  "Your briefing",
  "Before you start",
  "Your instructions",
  "Check with it",
  "Check and start",
  "Watch",
  "Talk it through",
  "Review",
];

/**
 * The cover's version of the step list, with the one-line gloss the practice
 * cover always had. Bare labels were indistinguishable to a first-time reader
 * ("Check and start" vs "Check with it"), and the cover is exactly the place
 * that gap costs something.
 */
const COVER_STEPS = [
  { label: "Your briefing", hint: "Read your side of the project." },
  { label: "Before you start", hint: "Two quick questions." },
  {
    label: "Your instructions",
    hint: "Tell your AI Proxy what you want, and what it may say for you.",
  },
  { label: "Check with it", hint: "Ask it anything — optional." },
  { label: "Check and start", hint: "Read your instructions back, then go." },
  { label: "Watch", hint: "The two AI Proxies talk. You watch live." },
  {
    label: "Talk it through",
    hint: "You take over and finish the conversation yourself.",
  },
  { label: "Review", hint: "See where it landed." },
];

/** Readable names for the dev panel's phase jumps. */
const PHASE_LABELS: Record<Phase, string> = {
  intro: "Start screen",
  brief: "Your briefing",
  risk: "Before you start",
  mandate: "Your instructions",
  rehearsal: "Check with it",
  confirm: "Check and start",
  matchmaking: "Connecting",
  watching: "Watch",
  handover: "Handover",
  negotiate: "Talk it through",
  review: "Review",
};

const STEP_OF: Record<Phase, number> = {
  /* The cover is not a counted step — see the note on STEP_LABELS. */
  intro: 0,
  brief: 0,
  risk: 1,
  mandate: 2,
  rehearsal: 3,
  confirm: 4,
  matchmaking: 5,
  watching: 5,
  handover: 6,
  negotiate: 6,
  review: 7,
};

/**
 * Total messages in the AI-AI exchange: four per side across the six stages
 * (stage 3 is the lock and carries no message). The PROXIES run the fixed
 * script — it is what makes their conversations comparable; the clock applies
 * to the participant's own closing conversation afterwards.
 */
const TOTAL_TURNS = 8;

/**
 * What each principal is told about the policy in force (Design §7, last
 * paragraph).
 *
 * BOTH sides are told the same thing, and they are told it before the task
 * starts. This is the one place the interface differs by policy, and it has to
 * — a participant who did not know their proxy might add arguments could not
 * meaningfully answer OTHER-AI4 about telling the sources apart. What stays
 * hidden is which individual reason came from where.
 */
/**
 * Design §7 requires the POLICY to be disclosed to both principals — it is what
 * makes OTHER-AI4 answerable — while the CONDITION NAME never is.
 *
 * The two strings are deliberately matched in length and shape. If one arm read
 * as a longer or more careful explanation than the other, the disclosure itself
 * would become a cue about which arm a participant is in, on the contrast
 * (`Explorer − Delegate`) it exists to support.
 *
 * The Explorer sentence used to end "Which is which will not be marked" — a
 * fragment whose referent a first-time reader has to reconstruct. It now says
 * what is not marked, in the same breath as what may be added.
 */
const POLICY_DISCLOSURE: Record<"delegate" | "explorer", string> = {
  delegate:
    "Both AI Proxies in this task say only the reasons their own person ticked. Nothing else is added, on either side.",
  explorer:
    "Both AI Proxies in this task may add general work points anyone in that role could make, on top of the reasons their own person ticked. Neither proxy marks which is which.",
};

function emptyMandate(
  task: ReturnType<typeof getTask>,
  role: Role,
  taskIndex: 1 | 2,
): Mandate {
  return {
    sessionIndex: taskIndex,
    issues: task.issues.map<IssueMandate>((issue) => ({
      issueId: issue.id,
      preferredOptionId: null,
      minimumOptionId: null,
    })),
    // Design §7: every work reason on, every sensitive one off. The defaults
    // are load-bearing and must not be "improved" — pre-checking a sensitive
    // card would manufacture the disclosure this study measures.
    authorizedReasonIds: defaultAuthorizedReasonIds(task, role),
    revisionCount: 0,
  };
}

/**
 * The instruction, in the words the proxy would use.
 *
 * Written back under every card so the participant can check what they have
 * actually said. Selections are easy to misread; a sentence is not.
 *
 * "Trade down" was the wrong phrase and had to go. Options are listed in the
 * order that favours whichever ROLE the term belongs to, so on the other
 * side's priority term a concession runs UP the list — and the sentence read
 * "I'll trade down to 4 reviews" for a floor that was in fact the most
 * generous position available. It now says which end it will settle at, which
 * is true whichever direction the list runs.
 */
function instructionSentence(issue: Issue, im: IssueMandate): string {
  const label = (id: string | null) =>
    issue.options.find((o) => o.id === id)?.label;

  const open = label(im.preferredOptionId);
  const floor = label(im.minimumOptionId);

  const parts: string[] = [];
  parts.push(open ? `I'll open by asking for ${open}.` : "I'll open on this term.");
  if (floor && floor !== open) {
    parts.push(`I'll settle as far as ${floor}, and no further.`);
  } else if (floor) {
    parts.push("I won't move from there.");
  }
  return parts.join(" ");
}

export function ProxyTask({
  taskIndex,
  taskId,
  role,
  policy,
}: {
  taskIndex: 1 | 2;
  taskId: TaskId;
  role: Role;
  policy: "delegate" | "explorer";
}) {
  usePageEnter(`task-${taskIndex}`);
  const router = useRouter();
  const { logEvent, participantKey } = useParticipant();
  const task = getTask(taskId);
  const requirement = requirementIssue(task, role);
  const reasonCards = task.roleBriefs[role].reasonCards;

  // "intro", not "brief". This started on the brief and so the Proxy arm's
  // cover was unreachable — `phase === "intro"` was rendered but never true,
  // while the Baseline arm opened on its cover as intended. That put a whole
  // orientation screen (the step list, the time estimate, "neither of you can
  // settle anything alone") in one condition and not the other, which is a
  // between-condition difference in what participants were told before the
  // task rather than a layout slip.
  const [phase, setPhase] = useState<Phase>("intro");
  const [mandate, setMandate] = useState<Mandate>(() =>
    emptyMandate(task, role, taskIndex),
  );
  const [transcript, setTranscript] = useState<DisplayMessage[]>([]);
  /**
   * The AI Proxies' conversation, frozen when the participant takes over.
   *
   * A separate copy rather than reusing `transcript`, because the direct
   * conversation is a different exchange and mixing them would make the
   * transcript the participant re-reads change under them as they talk.
   */
  const [proxyTranscript, setProxyTranscript] = useState<DisplayMessage[]>([]);
  /** The participant's own messages, once they take over. */
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  /** The package on the table in the direct conversation. */
  const [offer, setOffer] = useState<Package>({});
  /**
   * The credibility tier the participant's own AI Proxy actually EARNED out
   * loud (Ver.2.12 §6.2) — "sensitive" only if the SB was really voiced.
   * Recorded from the exchange rather than assumed, because an emergency stop
   * or a guardrail block can leave an authorized card unsaid, and the ladder
   * has to see the same fact the transcript shows.
   */
  const [proxyVoicedTier, setProxyVoicedTier] = useState<
    "none" | "work" | "sensitive"
  >("none");
  const [tentative, setTentative] = useState<Package | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: TOTAL_TURNS });
  /**
   * Emergency stop. Not a pause button: the participant is told they cannot
   * step in, and a way out is what makes that promise bearable if something
   * visibly goes wrong.
   *
   * A ref, because the negotiation loop reads it between turns and state
   * captured in that closure would be stale.
   */
  const stopped = useRef(false);
  const [showStopped, setShowStopped] = useState(false);
  /** M1 (§9.3): asked right after the mandate, of non-disclosers only. */
  const [m1Answer, setM1Answer] = useState<string | null>(null);

  const mockAi = useDevMockAi();
  const script = scriptedTask(task, role, policy);

  useDevActions(
    `task-${taskIndex}`,
    PHASES.map((p) => ({
      id: p,
      label: PHASE_LABELS[p],
      active: phase === p,
      run: () => {
        if (p === "review" && transcript.length === 0) {
          setTranscript(
            script.messages.map((m) => ({
              id: m.id,
              speaker: m.speaker,
              text: m.text,
            })),
          );
          setTentative(script.tentative);
        }
        setPhase(p);
      },
    })),
  );

  /**
   * Mockup mode fills the mandate the way a considered participant would: open
   * at your own best level on every term, let the proxy give away the terms
   * you can spend, and put the floor on your requirement term at its
   * threshold. That combination is what makes the logroll available — the
   * proxy has two terms to trade and a line to hold on the one that matters.
   *
   * "Your own best level" is not `options[0]`: options are ordered best-first
   * for whichever ROLE the term favours, so on the other side's priority term
   * the list starts at the option worth nothing to this participant.
   */
  useDevAutofill(() => {
    setMandate((m) => ({
      ...m,
      // The mockup walks the SB rung of the ladder: the scripted exchange
      // voices the sensitive card, so the mandate must authorize it or the
      // mockup would show a disclosure the mandate forbids.
      authorizedReasonIds: [
        ...new Set([
          ...m.authorizedReasonIds,
          ...reasonCards
            .filter((c) => c.layer === "sensitive")
            .map((c) => c.id),
        ]),
      ],
      issues: m.issues.map((im) => {
        const issue = task.issues.find((i) => i.id === im.issueId)!;
        const isRequirement = issue.id === requirement.id;
        const byValue = [...issue.options].sort(
          (a, b) => b.points[role] - a.points[role],
        );
        const threshold =
          byValue[issue.requirementThresholdIndex ?? 1] ?? byValue[1];
        return {
          ...im,
          preferredOptionId: im.preferredOptionId ?? byValue[0].id,
          minimumOptionId:
            im.minimumOptionId ??
            (isRequirement ? threshold.id : byValue[byValue.length - 1].id),
        };
      }),
    }));
  }, `mandate-t${taskIndex}`);

  function toggleReason(cardId: string) {
    setMandate((m) => ({
      ...m,
      authorizedReasonIds: m.authorizedReasonIds.includes(cardId)
        ? m.authorizedReasonIds.filter((id) => id !== cardId)
        : [...m.authorizedReasonIds, cardId],
    }));
  }

  /**
   * Drives the AI-AI negotiation one stage-turn at a time.
   *
   * The route generates a single turn per request, so the client owns the
   * sequence. Turns are appended as they arrive, which is what makes live
   * spectating possible at all, and what keeps each request short.
   */
  async function runNegotiation() {
    setPhase("watching");
    setError(null);
    setTranscript([]);
    setProgress({ done: 0, total: TOTAL_TURNS });
    stopped.current = false;
    setShowStopped(false);
    logEvent("negotiation_started", { policy }, { sessionIndex: taskIndex });

    if (mockAi) {
      const scripted = script.messages;
      setProgress({ done: 0, total: scripted.length });
      for (let i = 0; i < scripted.length; i += 1) {
        if (stopped.current) break;
        // Short in mockup mode: the point is to read the flow, and a real
        // 8-12 second gap times ten would make that unusable.
        await new Promise((r) => setTimeout(r, 400));
        setTranscript(
          scripted.slice(0, i + 1).map((m) => ({
            id: m.id,
            speaker: m.speaker,
            text: m.text,
          })),
        );
        setProgress({ done: i + 1, total: scripted.length });
      }
      // A stopped negotiation has no agreement — that is what stopping it
      // means. Handing the participant the package the exchange was heading
      // for would make the stop cosmetic.
      setTentative(stopped.current ? null : script.tentative);
      // The scripted exchange voices the SB at the first reason opportunity —
      // unless it was stopped before reaching it. The tier is read from the
      // voiced card's layer, scoped to the participant's own core issue,
      // exactly as the live path does.
      const voicedLayers = stopped.current
        ? []
        : scripted
            .filter((m) => m.speaker === "participant_proxy" && m.reasonCardId)
            .map((m) => reasonCards.find((c) => c.id === m.reasonCardId))
            .filter(
              (c): c is NonNullable<typeof c> =>
                Boolean(c) && c!.issueId === requirement.id,
            );
      setProxyVoicedTier(
        voicedLayers.some((c) => c.layer === "sensitive")
          ? "sensitive"
          : voicedLayers.length
            ? "work"
            : "none",
      );
      logEvent(
        "negotiation_ended",
        {
          phase: "proxy",
          turns: scripted.length,
          mock: true,
          emergencyStop: stopped.current,
          requirementByStage: scripted
            .filter((m) => m.speaker === "participant_proxy" && m.proposal)
            .map((m) => ({
              stage: m.stage,
              optionId: m.proposal?.[requirement.id] ?? null,
            })),
        },
        { sessionIndex: taskIndex },
      );
      setPhase("handover");
      return;
    }

    const collected: DisplayMessage[] = [];
    let lastParticipantPackage: Package | null = null;
    let lastCounterpartPackage: Package | null = null;
    let settled: Package | null = null;
    // The counterpart's closing test can reject the final package. Reading it
    // matters: without this the participant's own proxy's stage-5 proposal was
    // the last one carrying a package, so a refusal was silently recorded as a
    // tentative agreement — and a Proxy impasse would have been recoded as an
    // agreement while Baseline recorded it correctly, leaving the two arms
    // disagreeing about what an impasse is.
    let proxyImpasse = false;
    /**
     * Where the requirement stood at each of the proxy's turns.
     *
     * The Baseline task gets this for free — the participant sends the
     * messages, so each one is logged with the level it carried. A Proxy task
     * has no participant messages at all, so without recording it here the
     * trajectory would jump from what was entrusted straight to the final
     * package, and the two middle transitions Design §9.3.1 asks to be
     * reported — opening advocacy, and retention after the challenge — would
     * not exist for half the design.
     */
    const requirementByStage: Array<{
      stage: number;
      optionId: string | null;
    }> = [];
    // Opaque tokens for the reasons this side has voiced. The budgets are
    // whole-task limits and the route is stateless, so the history lives
    // here — but the client is deliberately not told WHICH reasons they
    // were, since that would name the Explorer's additions. The server
    // recovers each token's issue and kind for itself by re-hashing the
    // known ids.
    const reasonsUsed: string[] = [];

    try {
      for (let turn = 0; turn < TOTAL_TURNS; turn += 1) {
        if (stopped.current) break;
        const res = await fetch("/api/proxy-negotiation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            participantRole: role,
            policy,
            mandate,
            sessionIndex: taskIndex,
            turn,
            lastParticipantPackage,
            lastCounterpartPackage,
            reasonsUsed,
            history: collected.map((m) => ({
              speaker: m.speaker,
              text: m.text,
            })),
          }),
        });

        if (!res.ok) throw new Error(`Request failed: ${res.status}`);

        const data = (await res.json()) as {
          message?: {
            id: string;
            speaker: DisplayMessage["speaker"];
            text: string;
            proposal?: Package;
          };
          done: boolean;
          totalTurns?: number;
          reasonTokens?: string[];
          voicedTier?: "none" | "work" | "sensitive";
          decidedAction?: string;
          stage?: number;
          requirementOption?: string | null;
          accepted?: boolean;
          impasse?: boolean;
          blocked?: boolean;
        };

        if (data.impasse) proxyImpasse = true;
        // A fixed-width pair of opaque hashes every turn, carrying nothing
        // that says which is which — or whether either is real. Decoys are
        // dropped server-side, so pushing all of them is correct.
        if (data.reasonTokens?.length) reasonsUsed.push(...data.reasonTokens);

        // THE SERVER DECIDES THIS, not the client: the tier rung this turn's
        // voiced card earned, from the principal's CARD alone — never a pool
        // argument. The direct closing inherits the folded maximum, so a
        // wrong answer here changes the primary outcome.
        if (
          data.message?.speaker === "participant_proxy" &&
          data.voicedTier &&
          data.voicedTier !== "none"
        ) {
          setProxyVoicedTier((prev) =>
            prev === "sensitive" || data.voicedTier === "sensitive"
              ? "sensitive"
              : "work",
          );
        }

        if (
          data.message?.speaker === "participant_proxy" &&
          data.stage !== undefined
        ) {
          requirementByStage.push({
            stage: data.stage,
            optionId: data.requirementOption ?? null,
          });
        }

        if (data.message) {
          collected.push({
            id: data.message.id,
            speaker: data.message.speaker,
            text: data.message.text,
          });
          setTranscript([...collected]);

          // Persist the message text, not only the trajectory.
          //
          // Two pilot gates need the actual words: the fabricated-personal-
          // fact audit (target zero, gate 9), and the check that Delegate and
          // Explorer are matched on message count and length (gate 10). Both
          // are about what was said, and both were unrunnable while the proxy
          // transcript lived only in React state and vanished on submit.
          if (participantKey) {
            void getStore().appendMessage(participantKey, {
              id: data.message.id,
              sessionIndex: taskIndex,
              speaker: data.message.speaker,
              text: data.message.text,
              createdAt: new Date().toISOString(),
              ...(data.stage ? { stage: data.stage as StageId } : {}),
              ...(data.decidedAction
                ? { decidedAction: data.decidedAction }
                : {}),
              ...(data.message.proposal
                ? { proposal: data.message.proposal }
                : {}),
            });
          }

          if (data.message.proposal) {
            if (data.message.speaker === "participant_proxy") {
              lastParticipantPackage = data.message.proposal;
            } else {
              lastCounterpartPackage = data.message.proposal;
            }
            settled = data.message.proposal;
          }
        }

        setProgress({ done: turn + 1, total: data.totalTurns ?? TOTAL_TURNS });
        if (data.done) break;

        // The 8-12 second gap between messages (Design §8). It is not padding:
        // ten messages arriving as fast as the model can produce them is not
        // something a participant can follow, and following it is the point of
        // spectating.
        if (!stopped.current) {
          await new Promise((r) =>
            setTimeout(r, pauseMs(NEGOTIATION.proxyMessageGap)),
          );
        }
      }

      setTentative(stopped.current || proxyImpasse ? null : settled);
      logEvent(
        "negotiation_ended",
        {
          phase: "proxy",
          turns: collected.length,
          emergencyStop: stopped.current,
          impasse: proxyImpasse,
          // The trajectory's middle: what the proxy opened on the requirement
          // term (stage 1) and where it stood after the challenge (stage 4).
          requirementByStage,
        },
        { sessionIndex: taskIndex },
      );
      setPhase("handover");
    } catch (e) {
      console.error(e);
      setError(
        "Something went wrong while your AI Proxy was negotiating. Please try again.",
      );
      setPhase("confirm");
    }
  }

  // --- cover / brief / preferences ----------------------------------------
  if (phase === "intro") {
    return (
      <TaskIntro
        taskIndex={taskIndex}
        steps={COVER_STEPS}
        scene="proxy"
        /* The longer arm: two conversations where Baseline has one. */
        minutes={15}
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
        onContinue={() => setPhase("mandate")}
      />
    );
  }

  /* THE MANDATE IS ONE SCREEN: the levels on both terms, and which of the
     participant's reasons the proxy may say. It was two screens in sequence,
     and merging them is the point of the study rather than a tidy-up —
     deciding a position and deciding what may be said for it is one act, and
     the gap in prior work is that the second half was never asked at all.
     `PreferenceForm` owns the layout; the reason section is passed in and
     renders below the three term cards, never inside one of them, so no term
     is visibly singled out (Design §5 principle 4). */
  if (phase === "mandate") {
    return (
      <PreferenceForm
        taskIndex={taskIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        stepIndex={STEP_OF.mandate}
        isProxy
        reasonsComplete={hasWorkReason(task, role, mandate.authorizedReasonIds)}
        /* Levels already entrusted, so returning here from the rehearsal
           restores them (interface rule 4). The mandate is the parent's state
           and survives the remount; `PreferenceForm`'s own state does not. */
        initial={{
          preferred: Object.fromEntries(
            mandate.issues.map((im) => [im.issueId, im.preferredOptionId]),
          ),
          minimum: Object.fromEntries(
            mandate.issues.map((im) => [im.issueId, im.minimumOptionId]),
          ),
        }}
        reasons={
          <ReasonMandateSection
            task={task}
            role={role}
            policy={policy}
            mandate={mandate}
            onToggle={toggleReason}
          />
        }
        onContinue={(p: Preferences) => {
          setMandate((m) => ({
            ...m,
            issues: m.issues.map((im) => ({
              ...im,
              preferredOptionId: p.preferred[im.issueId] ?? null,
              minimumOptionId: p.minimum[im.issueId] ?? null,
            })),
          }));
          setPhase("rehearsal");
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  /* Questioning your own proxy before it runs. Optional, and before anything
     has been said to anyone — see `RehearsalChat`. */
  if (phase === "rehearsal") {
    return (
      <RehearsalChat
        taskIndex={taskIndex}
        task={task}
        role={role}
        policy={policy}
        mandate={mandate}
        steps={STEP_LABELS}
        stepIndex={STEP_OF.rehearsal}
        onBackToMandate={() => {
          setMandate((m) => ({ ...m, revisionCount: m.revisionCount + 1 }));
          logEvent("mandate_revised", undefined, { sessionIndex: taskIndex });
          setPhase("mandate");
          window.scrollTo({ top: 0 });
        }}
        onContinue={() => {
          setPhase("confirm");
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  // --- confirm ------------------------------------------------------------
  if (phase === "confirm") {
    const checked = reasonCards.filter((c) =>
      mandate.authorizedReasonIds.includes(c.id),
    );
    const unchecked = reasonCards.filter(
      (c) => !mandate.authorizedReasonIds.includes(c.id),
    );

    const sbChecked = reasonCards.some(
      (c) =>
        c.layer === "sensitive" && mandate.authorizedReasonIds.includes(c.id),
    );
    const m1Block = {
      id: "m1",
      title: "One quick question",
      items: [{ ...m1Item("proxy"), id: `M1_t${taskIndex}` }],
    };
    const needsM1 = !sbChecked && m1Answer === null;
    const confirmReady = !needsM1;

    return (
      <>
        <Page width="wide">
          <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
            <TaskHeader
              taskIndex={taskIndex}
              title="Review AI Proxy Mandate Instructions"
              steps={STEP_LABELS}
              current={STEP_OF.confirm}
            />

            {error ? (
              <div className="mb-6">
                <Callout tone="warning" title="Notice">
                  <p>{error}</p>
                </Callout>
              </div>
            ) : null}

            <Card className="mb-6 border-slate-200 bg-white">
              <CardTitle hint="Verify how your AI Proxy will represent your goals:">
                🤖 Proxy Position Bounds & Opening Strategy
              </CardTitle>
              <ul className="space-y-3.5 mt-3">
                {mandate.issues.map((im) => {
                  const issue = task.issues.find((i) => i.id === im.issueId)!;
                  return (
                    <li
                      key={im.issueId}
                      className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5"
                    >
                      <p className="text-xs sm:text-sm font-bold text-[var(--ink)] mb-1">
                        {issue.label}
                      </p>
                      <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
                        {instructionSentence(issue, im)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card tone="private" className="mb-6 border-amber-300 bg-amber-50/50 text-[var(--private-ink)]">
              <CardTitle hint="Authorized vs confidential background details:">
                💬 Permitted Rationale Disclosure
              </CardTitle>
              <div className="mb-4 mt-2">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                  ✅ Permitted to voice ({checked.length})
                </p>
                {checked.length ? (
                  <ul className="space-y-2">
                    {checked.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-lg bg-white/80 border border-emerald-200 p-2.5 text-xs sm:text-sm leading-relaxed text-slate-800"
                      >
                        {c.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic">No reasons selected.</p>
                )}
              </div>
              {unchecked.length ? (
                <div>
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    🔒 Strictly Confidential — Never Voiced ({unchecked.length})
                  </p>
                  <ul className="space-y-1.5 opacity-80">
                    {unchecked.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-lg bg-white/50 border border-slate-200 p-2 text-xs text-slate-600 leading-relaxed"
                      >
                        {c.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>

            {!sbChecked ? (
              <div className="mb-6">
                <MeasureBlock
                  block={m1Block}
                  answers={
                    m1Answer === null
                      ? {}
                      : { [`M1_t${taskIndex}`]: m1Answer }
                  }
                  onChange={(_, value) => setM1Answer(String(value))}
                />
              </div>
            ) : null}
          </TaskLayout>
        </Page>

        <ActionBar
          label="Confirm and Launch Proxy Negotiation"
          disabled={!confirmReady}
          onClick={async () => {
            if (!confirmReady) return;
            if (participantKey) {
              await getStore().saveMandate(participantKey, mandate);
              if (m1Answer !== null) {
                await getStore().saveResponses(participantKey, `m1_t${taskIndex}`, {
                  [`M1_t${taskIndex}`]: m1Answer,
                });
              }
            }
            // DECISION-LOCK (Ver.2.12 §6.1): the mandate is fixed before
            // anyone has spoken and cannot be revised after hearing the
            // counterpart.
            logEvent("decision_locked", undefined, {
              sessionIndex: taskIndex,
            });
            logEvent(
              "mandate_saved",
              {
                policy,
                reasonScope: reasonScope(
                  task,
                  role,
                  mandate.authorizedReasonIds,
                ),
                authorizedReasonIds: mandate.authorizedReasonIds,
                requirementMinimum:
                  mandate.issues.find((i) => i.issueId === requirement.id)
                    ?.minimumOptionId ?? null,
              },
              { sessionIndex: taskIndex },
            );
            setPhase("matchmaking");
          }}
          note="💡 You will spectate live and take over directly afterwards."
          secondary={
            <button
              type="button"
              onClick={() => {
                setMandate((m) => ({
                  ...m,
                  revisionCount: m.revisionCount + 1,
                }));
                logEvent("mandate_revised", undefined, {
                  sessionIndex: taskIndex,
                });
                setPhase("mandate");
              }}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              ← Edit Instructions
            </button>
          }
        />
      </>
    );
  }

  if (phase === "matchmaking") {
    return <Matchmaking onReady={() => void runNegotiation()} />;
  }

  // --- watching -----------------------------------------------------------
  if (phase === "watching") {
    return (
      <>
        <Page width="wide">
          <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
            <TaskHeader
              taskIndex={taskIndex}
              title={task.title}
              steps={STEP_LABELS}
              current={STEP_OF.watching}
              aside={
                <span className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900 shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                  <span>{progress.done} / {progress.total} messages</span>
                </span>
              }
            />

            <Card className="mb-6 flex flex-col overflow-hidden border-slate-200" padded={false}>
              <SpectatorBanner />
              <Transcript
                messages={transcript}
                pending={!showStopped && progress.done < progress.total}
                emptyHint="The two AI Proxies are initiating negotiations…"
              />
            </Card>

            <div className="text-center py-2">
              <button
                type="button"
                onClick={() => {
                  stopped.current = true;
                  setShowStopped(true);
                  logEvent(
                    "negotiation_ended",
                    { phase: "proxy", emergencyStop: true, atTurn: progress.done },
                    { sessionIndex: taskIndex },
                  );
                }}
                disabled={showStopped}
                className="text-xs text-slate-500 underline underline-offset-4 hover:text-slate-700 transition-colors disabled:no-underline disabled:opacity-50"
              >
                {showStopped ? "Stopping proxy exchange…" : "Emergency: Stop proxy exchange"}
              </button>
              <p className="mt-1 text-2xs text-slate-400">
                Only use if something goes wrong. You will proceed to direct handover.
              </p>
            </div>
          </TaskLayout>
        </Page>

        <ActionBar
          note={`${POLICY_DISCLOSURE[policy].split(".")[0]}. You will take over once they conclude.`}
        />
      </>
    );
  }

  // --- handover -----------------------------------------------------------
  if (phase === "handover") {
    return (
      <TaskCover
        eyebrow="Phase Transition · Direct Handover"
        title="Take Over and Finish Directly"
        scene="direct"
        lead={
          <>
            <p className="mb-2 text-slate-800 font-medium">
              The AI Proxies have finished their preliminary exchange.{" "}
              {tentative
                ? "They reached a tentative package, which is displayed on screen."
                : "They did not reach agreement. The full exchange history is available for your review."}
            </p>
            <p className="text-slate-600 text-sm">
              Nothing is finalized yet. You now talk directly with the other participant —{" "}
              <strong>what you both agree together in direct chat is the final outcome</strong>.
            </p>
          </>
        }
        steps={[
          { label: "Check what the proxies reached", hint: "Their full exchange stays pinned above the chat" },
          { label: "Talk to the other participant", hint: "Confirm it, adjust it, or add anything in your own words" },
          { label: "Settle it", hint: "Accept the package, agree a different one, or decline" },
        ]}
        minutes={3}
        note={
          <Callout title="⏱ 3 minutes to close" tone="neutral">
            <p>
              This is a short closing conversation, since the ground work is
              done. You can accept in one click, or talk it through first. If
              the clock runs out with nothing agreed, the fallback applies.
            </p>
          </Callout>
        }
        actionLabel="Start the closing conversation"
        onStart={() => {
          setProxyTranscript(transcript);
          setMessages([]);
          setOffer(tentative ?? {});
          logEvent(
            "negotiation_started",
            {
              phase: "direct",
              proxyOutcome: tentative ? "package" : "no_package",
              proxyMessages: transcript.length,
            },
            { sessionIndex: taskIndex },
          );
          setPhase("negotiate");
        }}
      />
    );
  }

  // --- direct negotiation -------------------------------------------------
  if (phase === "negotiate") {
    return (
      <DirectNegotiation
        taskIndex={taskIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        stepIndex={STEP_OF.negotiate}
        proxyTranscript={proxyTranscript}
        openingPackage={tentative}
        proxyVoicedTier={proxyVoicedTier}
        messages={messages}
        setMessages={setMessages}
        offer={offer}
        setOffer={setOffer}
        onSettled={(pkg, meta) => {
          setTentative(pkg);
          // §9.3: RATIFY (what happened to the proxies' tentative package),
          // SELF-DISCLOSE (the SB tagged in the participant's own voice), and
          // POST-RECIP-SB (a new SB after the counterpart's disclosure, which
          // in this arm happened during the watched exchange).
          logEvent(
            "task_outcome_recorded",
            {
              ratify: meta.ratify,
              selfDisclosed: meta.selfDisclosed,
              postRecipSb: meta.postRecipSb,
              preRecipSb: proxyVoicedTier === "sensitive",
              sbVoiced:
                proxyVoicedTier === "sensitive" || meta.selfDisclosed,
            },
            { sessionIndex: taskIndex },
          );
          setPhase("review");
        }}
      />
    );
  }

  // --- review -------------------------------------------------------------
  return (
    <ReviewPhase
      taskIndex={taskIndex}
      task={task}
      role={role}
      steps={STEP_LABELS}
      stepIndex={STEP_OF.review}
      tentative={tentative}
      transcript={messages}
      proxyTranscript={proxyTranscript}
      isProxy
      transcriptTitle="Your Direct Conversation"
      transcriptHint="What you and the other participant discussed after taking over from the AI Proxies."
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

// ---------------------------------------------------------------------------
// The reason-card screen
// ---------------------------------------------------------------------------

function ReasonMandateSection({
  task,
  role,
  policy,
  mandate,
  onToggle,
}: {
  task: ReturnType<typeof getTask>;
  role: Role;
  policy: "delegate" | "explorer";
  mandate: Mandate;
  onToggle: (cardId: string) => void;
}) {
  const row = (card: { id: string; text: string }) => {
    const checked = mandate.authorizedReasonIds.includes(card.id);
    return (
      <label
        className={cx(
          "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all shadow-2xs",
          checked
            ? "border-blue-500 bg-blue-50/80 text-blue-950 ring-2 ring-blue-500/20"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(card.id)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 accent-blue-600"
        />
        <span className="text-xs sm:text-sm leading-relaxed text-slate-800 font-medium">
          {card.text}
        </span>
      </label>
    );
  };

  return (
    <>
      <div className="mb-6">
        <Callout title="🤖 What your AI Proxy will do with this" tone="neutral">
          {/* The policy disclosure alone assumed the participant already knew
              what a proxy does with a mandate. §7 requires the POLICY to be
              stated; it does not forbid saying plainly what happens next, and a
              participant who has to infer the mechanics is guessing at the
              thing the study asks them to decide about. The three steps are
              the interface's own sequence, so they name no condition. */}
          <ol className="mb-2.5 space-y-1 text-xs sm:text-sm leading-relaxed text-slate-800">
            <li>
              <strong>1.</strong> It opens by asking for your best goal, and never
              agrees to less than your walkaway limit.
            </li>
            <li>
              <strong>2.</strong> When the other side pushes back, it argues using
              the reasons you tick below — and only those.
            </li>
            <li>
              <strong>3.</strong> You watch the whole exchange, then finish the
              conversation yourself.
            </li>
          </ol>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-800">{POLICY_DISCLOSURE[policy]}</p>
          <p className="mt-2 text-xs text-slate-600">
            It puts things in its own words, but it will never state a reason you
            leave unticked.
          </p>
        </Callout>
      </div>

      <Card tone="private" className="border-amber-300 bg-amber-50/50 text-[var(--private-ink)]">
        <CardTitle hint="You hold a work reason and a piece of confidential background. Select what may be said on your behalf:">
          💬 Permitted Reasons Mandate
        </CardTitle>

        <p className="mb-4 text-xs sm:text-sm leading-relaxed text-amber-950 font-medium">
          💡 Keep at least one work reason selected. {task.roleBriefs[role].disclosureRisk} Sensitive background details are strictly optional to authorize.
        </p>

        <IssueReasonGroups task={task} role={role} renderCard={row} />
      </Card>
    </>
  );
}

function hasWorkReason(
  task: ReturnType<typeof getTask>,
  role: Role,
  authorizedReasonIds: string[],
): boolean {
  return task.roleBriefs[role].reasonCards.some(
    (c) => c.layer === "work" && authorizedReasonIds.includes(c.id),
  );
}
