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
 *  - The mandate is ONE screen. Levels on all three terms and the reason cards
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
import { Callout, Card, CardTitle, Page } from "@/components/ui";
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
 * Total messages in the AI-AI exchange: one per side across the five stages.
 *
 * The PROXIES still run the fixed five-stage script — it is what makes their
 * conversations comparable, and they are not the ones on a clock. The free-form
 * timer applies to the participant's own conversation afterwards.
 */
const TOTAL_TURNS = 10;

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
const POLICY_DISCLOSURE: Record<"delegate" | "explorer", string> = {
  delegate:
    "Both AI Proxies in this task use only the reasons their own person selected. Nothing else will be said on your behalf.",
  explorer:
    "Both AI Proxies in this task may use the reasons their own person selected, plus general work arguments that anyone in that role could reasonably make. Which is which will not be marked.",
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
   * Whether the participant's own AI Proxy actually said a reason out loud.
   *
   * Recorded from the exchange rather than assumed, because an emergency stop
   * or a guardrail block can leave the proxy having voiced none — and the
   * reason-linked rule has to see the same fact the transcript shows.
   */
  const [proxyVoicedReason, setProxyVoicedReason] = useState(false);
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
      // The scripted exchange voices a work reason at stage 2 — unless it was
      // stopped before reaching it. Scoped to the requirement issue, same as
      // the live path: only a reason on the participant's own requirement
      // issue satisfies the reason-linked rule.
      setProxyVoicedReason(
        !stopped.current &&
          scripted.some(
            (m) =>
              m.speaker === "participant_proxy" &&
              m.reasonCardId &&
              reasonCards.find((c) => c.id === m.reasonCardId)?.issueId ===
                requirement.id,
          ),
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
          reasonToken?: string | null;
          reasonIssueId?: string | null;
          decidedAction?: string;
          stage?: number;
          requirementOption?: string | null;
          accepted?: boolean;
          impasse?: boolean;
          blocked?: boolean;
        };

        if (data.impasse) proxyImpasse = true;
        if (data.reasonToken) {
          reasonsUsed.push(data.reasonToken);
          // A token only exists when the proxy actually voiced something —
          // the route returns none for a blocked turn. ISSUE-SCOPED (ver.2.5):
          // the cards span all three issues now, so only a reason on the
          // participant's own requirement issue satisfies the reason-linked
          // rule the direct conversation inherits — a proxy that argued only
          // the timing term has not justified the requirement.
          if (
            data.message?.speaker === "participant_proxy" &&
            !data.blocked &&
            data.reasonIssueId === requirement.id
          ) {
            setProxyVoicedReason(true);
          }
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
        steps={STEP_LABELS}
        scene="proxy"
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

  /* THE MANDATE IS ONE SCREEN: the levels on all three terms, and which of the
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

    return (
      <>
        <Page width="wide">
          <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
            <TaskHeader
              taskIndex={taskIndex}
              title="Here is what your AI Proxy will do"
              steps={STEP_LABELS}
              current={STEP_OF.confirm}
            />

            {error ? (
              <div className="mb-5">
                <Callout tone="warning">
                  <p>{error}</p>
                </Callout>
              </div>
            ) : null}

            <Card className="mb-5">
              <CardTitle hint="Read this back. If it is not what you meant, change it before starting.">
                🤖 Your instructions, in its words
              </CardTitle>
              <ul className="space-y-3">
                {mandate.issues.map((im) => {
                  const issue = task.issues.find((i) => i.id === im.issueId)!;
                  return (
                    <li
                      key={im.issueId}
                      className="border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0"
                    >
                      <p className="text-[0.8125rem] font-semibold">
                        {issue.label}
                      </p>
                      <p className="max-w-prose text-[0.9375rem] text-[var(--ink-2)]">
                        {instructionSentence(issue, im)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card tone="private" className="mb-5 text-[var(--private-ink)]">
              <CardTitle>💬 What it may say about why</CardTitle>
              <div className="mb-4">
                <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]">
                  ✅ It may say these ({checked.length})
                </p>
                {checked.length ? (
                  <ul className="space-y-1.5">
                    {checked.map((c) => (
                      <li
                        key={c.id}
                        className="max-w-prose text-[0.8125rem] leading-relaxed"
                      >
                        {c.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[0.8125rem]">Nothing selected.</p>
                )}
              </div>
              {unchecked.length ? (
                <div>
                  <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]">
                    🔒 It will never say these ({unchecked.length})
                  </p>
                  <ul className="space-y-1.5 opacity-70">
                    {unchecked.map((c) => (
                      <li
                        key={c.id}
                        className="max-w-prose text-[0.8125rem] leading-relaxed"
                      >
                        {c.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          </TaskLayout>
        </Page>

        <ActionBar
          label="This is right — continue"
          onClick={async () => {
            if (participantKey) {
              await getStore().saveMandate(participantKey, mandate);
            }
            logEvent(
              "mandate_saved",
              {
                policy,
                // REASON-SCOPE: how much of their own case they handed over.
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
          note="Nothing is final until you review the result."
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
              className="rounded-[var(--radius)] px-3 py-2 text-[0.9375rem] font-medium text-[var(--ink-2)] hover:bg-[var(--surface-muted)]"
            >
              Change something
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
                <span className="shrink-0 tabular text-[0.8125rem] text-[var(--ink-2)]">
                  {progress.done} / {progress.total} messages
                </span>
              }
            />

            <Card className="mb-5 flex flex-col" padded={false}>
              <SpectatorBanner />
              <Transcript
                messages={transcript}
                /* `showStopped`, not `stopped.current` — a ref does not
                   trigger a render, so reading it here would leave the typing
                   indicator running after the participant pressed stop. */
                pending={!showStopped && progress.done < progress.total}
                emptyHint="The two AI Proxies are starting."
              />
            </Card>

            {/* Deliberately quiet: it is for the case where something has gone
                visibly wrong, not a second way to negotiate. */}
            <p className="text-center">
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
                className="text-[0.8125rem] text-[var(--ink-3)] underline underline-offset-4 hover:text-[var(--ink-2)] disabled:no-underline"
              >
                {showStopped ? "Stopping…" : "Stop this now"}
              </button>
            </p>
            <p className="mt-1.5 text-center text-[0.75rem] text-[var(--ink-3)]">
              Only if something looks wrong. You will still review whatever was
              reached.
            </p>
          </TaskLayout>
        </Page>

        <ActionBar
          note={`${POLICY_DISCLOSURE[policy].split(".")[0]}. You take over when they finish.`}
        />
      </>
    );
  }

  // --- handover -----------------------------------------------------------
  //
  // The screen between watching and talking. It exists because the change of
  // footing is the whole point of this condition and a silent switch would
  // waste it: up to here the participant has been a spectator, and from here
  // they are the one speaking. Naming that, and saying what carries over,
  // is what makes the direct conversation feel like a continuation rather
  // than a second unrelated task.
  if (phase === "handover") {
    return (
      <TaskCover
        eyebrow="Your turn now"
        title="Now you talk to them directly"
        /* The handover draws the DIRECT shape, not the proxy one — the proxies
           have finished and the rest of this task is the two people talking.
           Repeating the proxy picture here would say the opposite of what the
           screen exists to announce. */
        scene="direct"
        lead={
          <>
            <p>
              The two AI Proxies have finished.{" "}
              {tentative
                ? "They reached a package, which is on the next screen along with everything they said."
                : "They did not reach a package. Everything they said is on the next screen."}
            </p>
            <p>
              Nothing is settled. You and the other participant now talk
              directly — you write your own messages from here — and{" "}
              <strong>what the two of you agree is the result</strong>.
            </p>
          </>
        }
        steps={[
          "Read what the AI Proxies said — it stays on screen while you talk",
          "Message the other participant yourself",
          "Settle the three terms between you, or agree that you cannot",
        ]}
        minutes={10}
        note={
          <Callout title="⏱ Ten minutes">
            <p>
              That is the limit, not a target. Finish sooner if you are both
              happy.
            </p>
          </Callout>
        }
        actionLabel="Start talking to them"
        onStart={() => {
          setProxyTranscript(transcript);
          setMessages([]);
          setOffer(tentative ?? {});
          logEvent(
            "negotiation_started",
            {
              phase: "direct",
              // Whether the proxies handed over a package or an impasse. A
              // direct conversation that starts from nothing begins from a
              // harder position than one that starts from an agreed package,
              // and the two must be separable in the analysis rather than
              // pooled as "the Proxy arm".
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
        reasonAlreadyVoiced={proxyVoicedReason}
        messages={messages}
        setMessages={setMessages}
        offer={offer}
        setOffer={setOffer}
        onSettled={(pkg) => {
          setTentative(pkg);
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
      // The participant's OWN conversation, not the proxies'. Passing
      // `transcript` here showed them the AI-AI exchange under a caption
      // claiming it was theirs — so every item asking them to judge "what was
      // said" would have been answered against the wrong stimulus, and the
      // words they actually exchanged would never have been shown back.
      transcript={messages}
      proxyTranscript={proxyTranscript}
      isProxy
      transcriptTitle="Your conversation"
      transcriptHint="What you and the other participant said after the AI Proxies finished."
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

/**
 * "Which of your reasons may the AI Proxy say?"
 *
 * THIS SCREEN IS THE MEASURE. `REASON-SCOPE` is read straight off it: how many
 * cards, whether any sensitive one, and how far into the situation they went.
 * So the rules from Design §7 are constraints, not styling:
 *
 *  - the two boxes are visually separate, with their own headings;
 *  - work reasons start checked, sensitive ones start unchecked;
 *  - at least one work reason is required, and NO sensitive one ever is;
 *  - nothing on the screen suggests that checking more is the better answer.
 *
 * The last is the easiest to break by accident. A progress meter, a "you have
 * only shared one reason" nudge, or a sensitive box styled as an upsell would
 * all manufacture the disclosure the study is trying to observe.
 */
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
  const row = (card: { id: string; text: string }) => (
    <label className="flex cursor-pointer gap-2.5 rounded-[var(--radius)] p-1.5 hover:bg-[var(--surface)]/60">
      <input
        type="checkbox"
        checked={mandate.authorizedReasonIds.includes(card.id)}
        onChange={() => onToggle(card.id)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="max-w-prose text-[0.8125rem] leading-relaxed">
        {card.text}
      </span>
    </label>
  );

  return (
    <>
      <div className="mb-5">
        <Callout title="🤖 How this AI Proxy works">
          <p className="max-w-prose">{POLICY_DISCLOSURE[policy]}</p>
          <p className="mt-2 max-w-prose">
            It can put your reasons in its own words. It cannot invent a fact
            about you, and it will never say a reason you leave unticked.
          </p>
        </Callout>
      </div>

      {/* ONE BLOCK PER TERM, ALL THREE RENDERED IDENTICALLY (ver.2.5). The
          cards sit on all three issues now, so the earlier heading that named
          the requirement term is gone: with reasons attached to every term,
          naming one of them here would tell the participant which term the
          study is about (§5 principle 4, pilot gate 6). This is a validity
          constraint, not styling — do not "tidy" one block into prominence.

          The defaults do the quiet work: work reasons arrive ticked (and at
          least one must stay ticked), sensitive backgrounds arrive unticked
          and are never required. Nothing on this screen may suggest that
          ticking more is the better answer — how many they tick, and on which
          terms, IS the measure (REASON-SCOPE). */}
      <Card tone="private" className="text-[var(--private-ink)]">
        <CardTitle hint="Each term has a work reason and a piece of sensitive background. Tick what your AI Proxy may say; it uses judgement about when.">
          💬 What it may say about why
        </CardTitle>

        <p className="mb-3 max-w-prose text-[0.8125rem] leading-relaxed">
          Keep at least one work reason ticked.{" "}
          {task.roleBriefs[role].disclosureRisk} The sensitive backgrounds are
          yours to keep — leaving them all unticked is a normal choice.
        </p>

        <IssueReasonGroups task={task} role={role} renderCard={row} />
      </Card>
    </>
  );
}

/** Design §7: the mandate needs at least one work reason, and never a sensitive one. */
function hasWorkReason(
  task: ReturnType<typeof getTask>,
  role: Role,
  authorizedReasonIds: string[],
): boolean {
  return task.roleBriefs[role].reasonCards.some(
    (c) => c.layer === "work" && authorizedReasonIds.includes(c.id),
  );
}
