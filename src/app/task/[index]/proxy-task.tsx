"use client";

/**
 * Proxy task (Experimental Design Ver.2.20 §7–8).
 *
 * Flow: cover → brief → mandate (levels + reasons) → confirm →
 *       matchmaking → WATCH the two AI Proxies negotiate → ratify → review.
 *       Modification/refusal instead leads through a five-minute closing.
 *
 * Three things in that line are recent and easy to write back the old way:
 *
 *  - The mandate is ONE screen. Levels on both terms and the reason cards
 *    used to be two screens in sequence; deciding a position and deciding what
 *    may be said for it is one act, and that the second half was never asked
 *    is the gap this study is about.
 *  - The proxies run ONCE. There is no revision or second AI-AI run.
 *  - Ratification is separate from review. Approval finalizes the tentative
 *    package; only modification/refusal starts a direct closing conversation.
 *
 * DECEPTION INTEGRITY: User-Specified and AI-Supplemented render the SAME interface. The
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
import { useEffect, useRef, useState } from "react";
import { PROXY_TOTAL_TURNS as TOTAL_TURNS } from "@/lib/negotiation/proxy-protocol";
import {
  SpectatorBanner,
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";
import {
  BriefingPanel,
  POLICY_NOTE,
  ProxyIdentity,
  ReasonBox,
  SensitiveCaption,
  TaskCover,
  TaskHeader,
  TaskLayout,
} from "@/components/session";
import { ProxyFigure } from "@/components/proxy-art";
import { ActionBar } from "@/components/study-chrome";
import { Callout, Card, Page, cx } from "@/components/ui";
import {
  useDevActions,
  useDevAutofill,
  useDevMockAi,
} from "@/lib/dev-mode";

import {
  foldTier,
  type ReasonTier,
  type SbTiming,
} from "@/lib/negotiation/machine";
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
  NegotiationTask,
  Issue,
  IssueMandate,
  Mandate,
  Package,
  Role,
  StageId,
  TaskId,
} from "@/lib/types";
import { RatifyPhase, type RatifyChoice } from "./ratify";
import { ReviewPhase } from "./review";
import {
  DirectNegotiation,
  Matchmaking,
  PreferenceForm,
  TaskBrief,
  TaskIntro,
  type Preferences,
} from "./shared";

/** Ver.2.23 removes the pre-task RISK battery. */
type Phase =
  | "intro"
  | "brief"
  | "mandate"
  | "confirm"
  | "matchmaking"
  | "watching"
  | "ratify"
  | "handover"
  | "negotiate"
  | "review";

const PHASES: Phase[] = [
  "intro",
  "brief",
  "mandate",
  "confirm",
  "matchmaking",
  "watching",
  "ratify",
  "handover",
  "negotiate",
  "review",
];

/**
 * The phases the progress bar counts. The cover is not one of them: it is the
 * screen you are on before the task starts, and filling the first segment
 * would make the bar read as part-done before anything had happened.
 */
/**
 * The phases the progress bar counts.
 *
 * "Your decision" covers both the RATIFY screen and the closing conversation
 * that modify-or-reject leads to, because they are one step from the
 * participant's side — deciding what happens to the package — and an approver
 * never sees the second half. A separate segment for the conversation would
 * make the bar show a step that most participants skip.
 */
const STEP_LABELS = [
  "Your briefing",
  "Your instructions",
  "Check and start",
  "Watch",
  "Your decision",
  "Review",
];

/**
 * THE COVER'S WRITTEN STEP LIST IS GONE (round six). `TaskIntro` now draws
 * the steps in BOTH arms — `ProxyFlowSteps` here and `DirectFlowSteps` in the
 * Direct cover — so the list said on the cover exactly what the illustrated
 * cards below it already said. The phase names above still feed the header's
 * progress bar; only the cover's glossed copy of them went.
 */

/** Readable names for the dev panel's phase jumps. */
const PHASE_LABELS: Record<Phase, string> = {
  intro: "Start screen",
  brief: "Your briefing",
  mandate: "Your instructions",
  confirm: "Check and start",
  matchmaking: "Connecting",
  watching: "Watch",
  ratify: "Your decision",
  handover: "Handover",
  negotiate: "Talk it through",
  review: "Review",
};

/**
 * `SB` for the Proxy arm — the participant's FIRST DISCLOSURE CHOICE (§9.3).
 *
 * IT IS THE CHECKBOX, NOT WHAT THE PROXY MANAGED TO SAY. §6.3's ordering is
 * explicit that the participant "decides their own first reason — Proxy: the
 * checkbox, Direct: the first reason turn", and `SB` records that decision.
 * The Proxy arm's first reason opportunity IS the mandate, sealed at
 * DECISION-LOCK before anyone has spoken.
 *
 * This used to read `proxyVoicedTier === "sensitive"` — what the proxy
 * actually got out — and that is a different fact. A guardrail block or an
 * emergency stop can leave an authorized card unsaid, and coding those
 * participants as non-disclosers would put a machine failure inside RQ1's
 * confirmatory outcome, in one arm only, along the primary contrast. The
 * participant chose to disclose; whether the apparatus delivered it is the
 * apparatus's problem, and it is visible in `proxyVoicedTier` and the
 * transcript.
 *
 * `proxyVoicedTier` keeps its own job, which is the LADDER: what was voiced is
 * what the counterpart heard and what the closing conversation inherits. The
 * two are recorded separately so a divergence between them is legible rather
 * than silently folded into the primary measure.
 */
function proxySbFirstChoice(
  authorizedReasonIds: readonly string[],
  reasonCards: ReadonlyArray<{ id: string; layer: string }>,
): boolean {
  return reasonCards.some(
    (c) => c.layer === "sensitive" && authorizedReasonIds.includes(c.id),
  );
}

/**
 * `SB-TIMING` (§9.3) for the Proxy arm.
 *
 * Two channels, and they are ordered. A ticked SB is voiced at the proxy's
 * FIRST reason opportunity (§6.5), which is this arm's lock — so a ticker is
 * `first_chance` whatever happens afterwards. Only a participant who did NOT
 * tick can reach `wrap_up`, by saying it themselves in the five-minute
 * closing (§6.9 #2).
 *
 * IT READS THE CHECKBOX, for the same reason `SB` does: the timing categories
 * partition the disclosure DECISION, so a ticker whose card was blocked
 * belongs in `first_chance` beside every other ticker, not in `never` beside
 * people who chose not to disclose at all.
 *
 * `later_turn` is unreachable in this arm: a Proxy participant's only free
 * speech is the closing, which is its own category. §9.8-5 flags that
 * structural zero for the χ²'s unit.
 *
 * The union is the machine's `SbTiming`, not a local one. A locally declared
 * copy is how `voicedTier` drifted from the route's own type without `tsc`
 * ever seeing it.
 */
function proxySbTiming(
  sbFirstChoice: boolean,
  selfDisclosedInClosing: boolean,
): SbTiming {
  if (sbFirstChoice) return "first_chance";
  return selfDisclosedInClosing ? "wrap_up" : "never";
}

const STEP_OF: Record<Phase, number> = {
  /* The cover is not a counted step — see the note on STEP_LABELS. */
  intro: 0,
  brief: 0,
  mandate: 1,
  confirm: 2,
  matchmaking: 3,
  watching: 3,
  ratify: 4,
  handover: 4,
  negotiate: 4,
  review: 5,
};

/**
 * Total messages in the AI-AI exchange: four per side across the six stages
 * (stage 3 is the lock and carries no message). The PROXIES run the fixed
 * script — it is what makes their conversations comparable; the clock applies
 * to the participant's own closing conversation afterwards.
 */


/**
 * The policy disclosure (Design §7) lives with `ProxyIdentity` in
 * components/session.tsx, because both the mandate and the confirm screen
 * show it inside that block. It is the ONE sentence that differs
 * between the two policies; the CONDITION NAME never appears anywhere.
 */

function emptyMandate(
  task: NegotiationTask,
  role: Role,
  taskIndex: 1 | 2,
): Mandate {
  return {
    sessionIndex: taskIndex,
    issues: task.issues.map<IssueMandate>((issue) => ({
      issueId: issue.id,
      preferredOptionId: null,
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
 * It says what the proxy will OPEN with and nothing about where it will
 * settle, because the participant no longer sets that (Ver.2.13 §2.6) — and
 * a sentence promising a floor the mandate does not carry would be worse than
 * no sentence at all.
 */
function instructionSentence(issue: Issue, im: IssueMandate): string {
  const label = (id: string | null) =>
    issue.options.find((o) => o.id === id)?.label;

  const open = label(im.preferredOptionId);
  return open
    ? `I'll open by asking for ${open}.`
    : "I'll open on this term.";
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
  policy: "user_specified" | "ai_supplemented";
}) {
  usePageEnter(`task-${taskIndex}`);
  const router = useRouter();
  const { logEvent, participantKey } = useParticipant();
  // Non-null: the route only renders a task page for a valid id, and `TaskId`
  // is the compile-time story — the lookup's `undefined` is for API callers
  // reading an id off a JSON body, which guard it themselves.
  const task = getTask(taskId)!;
  const requirement = requirementIssue(task, role);
  const reasonCards = task.roleBriefs[role].reasonCards;

  // "intro", not "brief". This started on the brief and so the Proxy arm's
  // cover was unreachable — `phase === "intro"` was rendered but never true,
  // while the Direct arm opened on its cover as intended. That put a whole
  // orientation screen (the step list, the time estimate, "neither of you can
  // settle anything alone") in one condition and not the other, which is a
  // between-condition difference in what participants were told before the
  // task rather than a layout slip.
  const [phase, setPhase] = useState<Phase>("intro");
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [phase]);
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
  const [proxyVoicedTier, setProxyVoicedTier] = useState<ReasonTier>("none");
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
  /**
   * Whether the participant has used the sensitive checkbox themselves.
   *
   * DEV-MODE BOOKKEEPING ONLY, and deliberately a ref outside the mandate:
   * nothing in the ladder, the outcome row, the route or the export reads it,
   * and `authorizedReasonIds` remains the single thing that decides what the
   * proxy may say. Its whole job is to stop mockup mode's autofill from
   * re-ticking a box the participant has deliberately cleared — the panel's
   * "Fill this page" button re-runs that filler on demand, and before this
   * flag it silently restored the SB, so an unticked mandate still played the
   * confession and still settled at 3,000. A ref rather than state because the
   * autofill's updater reads it and a re-render is neither needed nor wanted.
   */
  const sbTouched = useRef(false);
  /**
   * RATIFY (§9.3) — recorded on the decision screen, not inferred afterwards.
   * A participant who asked for a change and then agreed the very same package
   * is a modifier, and coding them off the final package would call them an
   * approver.
   */
  const [ratify, setRatify] = useState<RatifyChoice | null>(null);
  /** What the closing conversation produced, for the outcome row (§9.3). */
  const [closing, setClosing] = useState<{ selfDisclosed: boolean } | null>(
    null,
  );

  const mockAi = useDevMockAi();
  /**
   * THE MOCKUP EXCHANGE FOLLOWS THE MANDATE, and this argument is the whole of
   * that. `scriptedTask` used to be called without it, so every Proxy cell
   * played the SB exchange whatever the participant had authorized: unticking
   * the sensitive box changed the mandate screen and nothing after it — the
   * proxy still confessed on screen and the task still settled at the SB rung,
   * 3,000/3,000, out of a WR-only mandate. That is RQ1's confirmatory outcome
   * reading the wrong value, in the arm the study is about.
   *
   * It is derived from `sbFirstChoice` — the same checkbox the outcome row
   * records — so the transcript, the tier and `SB` cannot disagree about what
   * the participant authorized.
   */
  /**
   * `SB` — the participant's first disclosure choice, which in this arm is the
   * mandate checkbox (§6.3, §9.3). Sealed at DECISION-LOCK and read from the
   * mandate rather than from the transcript; see `proxySbFirstChoice`.
   */
  const sbFirstChoice = proxySbFirstChoice(
    mandate.authorizedReasonIds,
    reasonCards,
  );
  const script = scriptedTask(task, role, policy, sbFirstChoice);

  useDevActions(
    `task-${taskIndex}`,
    PHASES.map((p) => ({
      id: p,
      label: PHASE_LABELS[p],
      active: phase === p,
      run: () => {
        // EVERY PHASE PAST THE EXCHANGE NEEDS THE EXCHANGE. Jumping straight
        // to `handover` or `direct` left the transcript empty, so the handover
        // screen read "They did not reach agreement" and the direct closing
        // opened with no standing package and the bottom rung of the ladder —
        // a mockup of a failed negotiation, on the screens most worth reading.
        // Only `review` was seeded, which hid it: that screen was the one
        // being checked.
        const needsExchange =
          p === "ratify" ||
          p === "handover" ||
          p === "negotiate" ||
          p === "review";
        if (needsExchange && transcript.length === 0) {
          setTranscript(
            script.messages.map((m) => ({
              id: m.id,
              speaker: m.speaker,
              text: m.text,
            })),
          );
          setTentative(script.tentative);
          // The tier the closing inherits is READ OFF THE SCRIPT THAT ACTUALLY
          // PLAYED, never assumed to be the SB rung. The script now follows the
          // mandate, so a jump taken from a WR-only mandate seeds `work` and
          // the T1 package together — the same pair `runNegotiation` derives
          // when it plays the same script. Assuming `sensitive` here would put
          // the closing conversation a rung above the exchange the participant
          // just watched, which is the wire CLAUDE.md records breaking twice.
          setProxyVoicedTier(
            script.messages.some(
              (m) =>
                m.speaker === "participant_proxy" &&
                m.reasonCardId &&
                reasonCards.find((c) => c.id === m.reasonCardId)?.layer ===
                  "sensitive",
            )
              ? "sensitive"
              : "work",
          );
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
      // THE SB TICK IS A DEFAULT HERE, NEVER AN OVERRIDE — and the difference
      // is the validity of the arm.
      //
      // Mockup mode walks the SB rung by default, because that is the ideal
      // trajectory the scripts are for. But this used to union the sensitive
      // card in every time it ran, and the dev panel's "Fill this page" button
      // re-runs it on demand: a participant (or a PI reading the flow) who
      // unticked the box and then filled the screen again had it silently
      // ticked back, watched their proxy confess, and settled at 3,000 out of
      // a WR-only mandate.
      //
      // `sbTouched` records that the checkbox has been used at all, so the
      // default applies only while the participant has not decided. Once they
      // have, their decision stands — and `scriptedTask` now plays the WR-only
      // exchange for it, which settles at T1 where the ladder says it should.
      authorizedReasonIds: sbTouched.current
        ? m.authorizedReasonIds
        : [
            ...new Set([
              ...m.authorizedReasonIds,
              ...reasonCards
                .filter((c) => c.layer === "sensitive")
                .map((c) => c.id),
            ]),
          ],
      issues: m.issues.map((im) => {
        const issue = task.issues.find((i) => i.id === im.issueId)!;
        const best = [...issue.options].sort(
          (a, b) => b.points[role] - a.points[role],
        )[0];
        return {
          ...im,
          preferredOptionId: im.preferredOptionId ?? best.id,
        };
      }),
    }));
  }, `mandate-t${taskIndex}`);

  function toggleReason(cardId: string) {
    // The participant has now decided the checkbox themselves, so the dev
    // autofill's default must not be reapplied over the top of it.
    sbTouched.current = true;
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
      /** How many messages actually reached the screen before any stop. */
      let playedCount = 0;
      for (let i = 0; i < scripted.length; i += 1) {
        if (stopped.current) break;
        // Shortened in mockup mode: the point there is to read the flow, and
        // a real 8-12 second gap times ten would make that unusable. But 400ms
        // was too short to READ, which defeats the same purpose from the other
        // side — the messages stacked faster than the eye follows. ~2s is the
        // compromise: fast enough to walk the flow, slow enough to watch it.
        await new Promise((r) => setTimeout(r, 1700 + Math.random() * 800));
        setTranscript(
          scripted.slice(0, i + 1).map((m) => ({
            id: m.id,
            speaker: m.speaker,
            text: m.text,
          })),
        );
        setProgress({ done: i + 1, total: scripted.length });
        playedCount = i + 1;
      }
      // A stopped negotiation has no agreement — that is what stopping it
      // means. Handing the participant the package the exchange was heading
      // for would make the stop cosmetic.
      setTentative(stopped.current ? null : script.tentative);
      // The tier is read from the voiced card's layer, scoped to the
      // participant's own core issue, exactly as the live path does.
      //
      // A STOP DOES NOT ERASE WHAT WAS ALREADY SAID. This read `stopped ? []`,
      // which zeroed the tier however late the stop came — so stopping at
      // message 7 of 8, with the SB voiced and visible on screen, left the
      // mockup's counterpart refusing a package the live build accepts. The
      // live path never had this: it accumulates the tier per turn and a stop
      // just breaks the loop. Slicing to the messages actually PLAYED is what
      // makes the two agree, which CLAUDE.md requires of the scripts.
      const played = stopped.current
        ? scripted.slice(0, playedCount)
        : scripted;
      const voicedLayers = played
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
      setPhase("ratify");
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
    // agreement while Direct recorded it correctly, leaving the two arms
    // disagreeing about what an impasse is.
    let proxyImpasse = false;
    /**
     * Where the requirement stood at each of the proxy's turns.
     *
     * The Direct task gets this for free — the participant sends the
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
    // were, since that would name the AI-Supplemented's additions. The server
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
          // THE FULL LADDER, `priority` INCLUDED. This was re-declared here
          // without it, so the compiler never saw the mismatch with the
          // server's own union and the fold below silently downgraded the
          // proxy's floor. Typed off `ReasonTier` now so the two cannot drift.
          voicedTier?: ReasonTier;
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
          // `foldTier`, NOT A HAND-WRITTEN TERNARY. The ternary collapsed
          // everything that was not `sensitive` down to `work`, which threw
          // away the proxy's tier-2 floor (§6.5, §6.9 #1): `TIER_LIMIT_INDEX`
          // puts `work` at 2 and `priority` at 1, so they are different rungs.
          //
          // WHAT IT COST, and the server's own comment beside `voicedTier`
          // describes it: a participant who authorized no sensitive card
          // watched their proxies settle at 2,300/2,300, took over at RATIFY,
          // and was offered 1,600 — below the package still on screen. The
          // server half of this was fixed; this half was not, and no type
          // error could show it because the response was re-declared above
          // without `priority`. CLAUDE.md warns that two hand-written
          // ternaries would eventually disagree; they did.
          const voiced = data.voicedTier;
          if (voiced) setProxyVoicedTier((prev) => foldTier(prev, voiced));
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
          // fact audit (target zero, gate 9), and the check that User-Specified and
          // AI-Supplemented are matched on message count and length (gate 10). Both
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
      setPhase("ratify");
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
        scene="proxy"
        /* NO `minutes` OVERRIDE (round six) — see the note on the Direct
           cover. Both read `STAGE_MINUTES.task`. */
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
        /* One muted line rather than the numbered list this replaced: the
           sequence is orientation, and a three-item list at the top of the
           screen competes with the decision the screen is actually for. */
        /* THE REPRESENTATIVE ASKS, AND THE SCREEN ANSWERS. The two sections
           below it — the term cards and the reason cards — are the two halves
           of the question it puts here, which is the whole point of the merge:
           deciding a position and deciding what may be said for it is ONE act.

           WHAT THIS LINE MAY NOT DO. It may not say which reason works, or
           which one it would prefer, or that saying more helps: disclosure is
           the primary outcome and the ladder is never taught (§8.1). "Whatever
           you leave out, I never say" is the only promise it makes about the
           reasons, and it is symmetric — it describes the mechanism, not a
           direction. */
        identity={
          <ProxyIdentity
            policy={policy}
            scene="briefing"
            /* OPEN HERE AND NOWHERE ELSE. This is the screen where the
               reasons are actually ticked, so the rule governing what happens
               to them belongs in front of the participant rather than behind a
               click. The later screens leave it closed: by then it has been
               read, and the decision on those screens is a different one. */
            explainerOpen
            status="Waiting for your instructions"
            /* ONE SENTENCE. This ran to three paragraphs restating what the
               two sections below already say, on a screen whose length was
               itself the problem: the decision is two controls, and the copy
               above them was longer than both. What it still has to do is name
               the two things being asked for, because a participant who is not
               told the work reason always goes would read the single checkbox
               as the whole of what gets said. It names them and stops, and it
               says nothing about which answer to give. */
            speech={
              <p>
                I will speak for you. Pick your goal on each issue and tell me
                whether I may share your sensitive background.
              </p>
            }
            /* Ver.2.24 removed the rehearsal screen, and this line promised
               it: "you can question me" named a step the participant will
               never reach. What is left is the sequence that actually runs. */
            footnote="After this: you watch the whole exchange, then you decide what happens to whatever we reach."
          />
        }
        reasonsComplete={true}
        /* Levels already entrusted, so returning here from the confirm screen
           restores them (interface rule 4). The mandate is the parent's state
           and survives the remount; `PreferenceForm`'s own state does not. */
        initial={{
          preferred: Object.fromEntries(
            mandate.issues.map((im) => [im.issueId, im.preferredOptionId]),
          ),
        }}
        reasons={
          <ReasonMandateSection
            task={task}
            role={role}
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
            })),
          }));
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
    const confirmReady = true;

    return (
      <>
        <Page width="wide">
          <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
            <TaskHeader
              taskIndex={taskIndex}
              title="Authorize your AI Proxy"
              steps={STEP_LABELS}
              current={STEP_OF.confirm}
            />

            {/* THE REPRESENTATIVE READS THE BRIEF BACK. Same figure as the
                mandate screen, now acknowledging what it was given.
                The sheet below is the same acknowledgement itemised, so a
                participant can check the summary against the detail.

                WHAT THIS ACKNOWLEDGEMENT MAY CONTAIN. Only what was
                AUTHORIZED — a count of the ticked reasons and the fact of the
                position — and never the CONTENT of an unticked card, in quote
                or in paraphrase. Reading a withheld card back to the
                participant, even to promise silence about it, would put the
                sentence on screen one more time at the moment they are
                deciding, which is the disclosure decision being nudged.

                The closing line is FIXED and identical in all four cells and
                both policies. It is deliberately not tiered to how much was
                ticked: "you've given me plenty" or "that's not much to work
                with" would both be evaluations of the primary outcome, said by
                the interface, right before it is recorded. */}
            <div className="mb-6">
              <ProxyIdentity
                policy={policy}
                status="Ready when you are"
                speech={
                  <>
                    {/* IT COUNTED THE TICKED CARDS, and there is nothing left
                        to count: the work reason always goes and the sensitive
                        background is one checkbox (§8.7). Both branches are
                        the same length and neither grades the choice — "you've
                        given me plenty" or "that's not much to work with"
                        would be the interface evaluating the primary outcome
                        at the moment before it is recorded. */}
                    <p>
                      Understood. I&rsquo;ll open where you told me to on both
                      conditions, give your work reason, and say which one
                      matters more to you.
                    </p>
                    <p className="mt-2 font-semibold">
                      {sbChecked
                        ? "I'll pass on your sensitive background too, the way I described. Everything else stays with me."
                        : "Your sensitive background stays with me. I never bring it up, in any form."}
                    </p>
                  </>
                }
              />
            </div>

            {error ? (
              <div className="mb-6">
                <Callout tone="warning" title="Notice">
                  <p>{error}</p>
                </Callout>
              </div>
            ) : null}

            {/* ONE SHEET, THREE CLAUSES. These were two stacked cards, which
                read as two more forms to check; a participant authorizing a
                representative is signing off one instruction, so it is drawn
                as one document with a heading strip and numbered clauses. The
                Authorize button below then reads as signing THIS.

                INTERFACE RULE 1 STILL DECIDES THE SURFACES. The position is a
                thing the other side will hear, so it sits on the shared white
                surface; the reason cards are private to the participant and
                stay on the sand surface, inside the sheet. The rule is about
                what a colour SAYS, not about which card a thing lives in, so
                merging the cards must not merge the surfaces. */}
            <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 ring-1 ring-indigo-100"
                >
                  <ProxyFigure side="mine" size={20} />
                </span>
                <p className="text-[0.6875rem] font-extrabold uppercase tracking-wider text-[var(--ink-3)]">
                  Instructions to my AI Proxy · Task {taskIndex}
                </p>
              </div>

              <ol className="divide-y divide-slate-200">
                <li className="px-4 py-4 sm:px-5 sm:py-5">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-extrabold text-[var(--ink-2)]"
                    >
                      1
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--ink)]">
                        The position it will hold
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--ink-3)]">
                        What your proxy will aim for on each condition.
                      </p>
                      <ul className="mt-3 space-y-2.5">
                        {mandate.issues.map((im) => {
                          const issue = task.issues.find(
                            (i) => i.id === im.issueId,
                          )!;
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
                    </div>
                  </div>
                </li>

                <li className="bg-amber-50/50 px-4 py-4 text-[var(--private-ink)] sm:px-5 sm:py-5">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-extrabold text-amber-900"
                    >
                      2
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--private-strong)]">
                        What it may say for you
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--private-ink)]/80">
                        Your work reason always goes across. The sensitive
                        background goes only if you ticked it.
                      </p>
                      <ul className="mt-3 space-y-2">
                        {checked.map((c) => {
                          /* WHAT THIS ROW MAY SHOW, AND IT DIFFERS BY POLICY.
                             §8.7 is explicit that the added sentences are NOT
                             shown before the exchange — "보탤 문장은 협상 전에
                             따로 보여 드리지 않습니다" — and the abstraction is
                             one of them. So under AI-Supplemented the ticked
                             SB is described by its FORM, never quoted: the
                             participant learns their background travels as a
                             one-sentence assessment of the proxy's own, among
                             reasons the proxy supplies, and finds out what it
                             actually said by watching.

                             Quoting it here would also give the abstraction
                             two exposures where User-Specified's relay has
                             one, and OTHER-AI2 asks the receiving side to tell
                             the three sentences apart. The manipulation is the
                             wording; showing the wording twice is not the same
                             stimulus.

                             Under User-Specified the row is the `relayed`
                             text, not the card's own: Ver.2.19 requires a
                             proxy to speak in the third person, and showing
                             the card verbatim would have the proxy claim the
                             participant's confession as its own. The MANDATE
                             screen's checkbox cards stay as `text` — that is
                             the participant's own briefing, in their voice. */
                          const abstracted =
                            policy === "ai_supplemented" &&
                            c.layer === "sensitive";
                          return (
                            <li
                              key={c.id}
                              className="rounded-lg border border-emerald-200 bg-white/80 p-2.5 text-xs sm:text-sm leading-relaxed text-slate-800"
                            >
                              {abstracted ? (
                                <>
                                  <span className="mb-1 block text-[0.6875rem] font-bold uppercase tracking-wide text-emerald-800">
                                    Your sensitive background
                                  </span>
                                  <span className="block italic text-slate-700">
                                    Given as my own assessment, in one
                                    sentence, among reasons of my own. You will
                                    see the wording when we talk.
                                  </span>
                                </>
                              ) : (
                                (c.relayed ?? c.text)
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </li>

                {unchecked.length ? (
                  <li className="bg-amber-50/50 px-4 py-4 text-[var(--private-ink)] sm:px-5 sm:py-5">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-extrabold text-amber-900"
                      >
                        3
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[var(--private-strong)]">
                          What it will keep to itself
                        </p>
                        {/* With the work reason fixed (§8.7), the only card
                            that can appear here is the sensitive one — so the
                            singular is right and the plural read as though
                            something else had been withheld too. */}
                        <p className="mt-0.5 text-xs text-[var(--private-ink)]/80">
                          You left this unticked. Your proxy never brings it
                          up, in any form.
                        </p>
                        <ul className="mt-3 space-y-1.5 opacity-80">
                          {unchecked.map((c) => (
                            <li
                              key={c.id}
                              className="rounded-lg border border-slate-200 bg-white/50 p-2 text-xs leading-relaxed text-slate-600"
                            >
                              {c.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </li>
                ) : null}
              </ol>
            </div>

          </TaskLayout>
        </Page>

        <ActionBar
          label="Authorize my AI Proxy and start"
          disabled={!confirmReady}
          onClick={async () => {
            if (!confirmReady) return;
            if (participantKey) {
              await getStore().saveMandate(participantKey, mandate);
            }
            // DECISION-LOCK (Ver.2.12 §6.1): the mandate is fixed before
            // anyone has spoken and cannot be revised after hearing the
            // counterpart.
            // DECISION-LOCK is this arm's first-reason-turn boundary: the
            // checkbox is sealed here and `SB` is decided by it (§6.1, §9.3).
            // `phase` distinguishes it from the Direct arm's lock, which the
            // same event name carries at the end of the first reason turn.
            logEvent("decision_locked", {
              phase: "mandate",
              sb: sbFirstChoice,
            }, {
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
              },
              { sessionIndex: taskIndex },
            );
            setPhase("matchmaking");
          }}
          note="Your proxy meets the other participant's proxy next, and you watch the whole exchange."
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
              ← Change my instructions
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

            {/* AT THE TABLE. The same figure the participant briefed, now
                opposite the other side's — so "my representative is speaking
                for me right now" is a picture rather than an inference from a
                transcript. Both figures are drawn identically apart from the
                warm accent on the participant's own; the other side's proxy is
                not a different KIND of agent, and §9.4 asks about both.

                NO CUE RING (rule 9): this screen is not waiting for the
                participant to do anything. The one live signal is the message
                counter in the header, which counts rather than prompts. */}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
              <div className="mb-3 flex items-center justify-center gap-8 sm:gap-14">
                <div className="flex flex-col items-center text-center">
                  <ProxyFigure side="mine" size={58} speaking />
                  <span className="mt-1.5 text-xs font-extrabold text-[var(--ink-2)]">
                    Your AI Proxy
                  </span>
                </div>
                <div aria-hidden className="flex flex-col items-center gap-1 pb-6">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-[var(--ink-4)]">
                    at the table
                  </span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <ProxyFigure side="theirs" size={58} speaking />
                  <span className="mt-1.5 text-xs font-extrabold text-[var(--ink-2)]">
                    Their AI Proxy
                  </span>
                </div>
              </div>
              <p className="text-center text-xs leading-relaxed text-[var(--ink-3)] sm:text-sm">
                Your proxy is speaking for you now. You cannot step in, but you
                decide what happens to whatever they reach.
              </p>
            </div>

            <Card className="mb-6 flex flex-col overflow-hidden border-slate-200" padded={false}>
              <SpectatorBanner />
              <Transcript
                messages={transcript}
                pending={!showStopped && progress.done < progress.total}
                // Whichever proxy has NOT just spoken is the one being waited
                // on. Both are openly AI, so neither is shown as "typing".
                pendingSpeaker={
                  transcript[transcript.length - 1]?.speaker ===
                  "participant_proxy"
                    ? "counterpart_proxy"
                    : "participant_proxy"
                }
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
                Only use if something goes wrong. Your proxy steps back and you take over yourself.
              </p>
            </div>
          </TaskLayout>
        </Page>

        <ActionBar
          /* `POLICY_NOTE`, not the first sentence of `POLICY_DISCLOSURE`:
             the disclosure's second clause is the one saying the rule is the
             SAME on both sides, and this is the screen where the participant
             is watching the other side's proxy speak. Slicing at the first
             period would drop exactly that half. */
          note={`${POLICY_NOTE[policy]} You decide whether to accept what they reach.`}
        />
      </>
    );
  }

  // --- RATIFY: the decision the participant kept (Ver.2.13 §7) ------------
  if (phase === "ratify") {
    return (
      <RatifyPhase
        taskIndex={taskIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        stepIndex={STEP_OF.ratify}
        tentative={tentative}
        proxyTranscript={transcript}
        onDecide={(choice) => {
          setRatify(choice);
          // Design §7: approval finalizes; only modification/refusal opens chat.
          if (choice === "approved_as_is" && tentative) {
            setProxyTranscript(transcript);
            setClosing({ selfDisclosed: false });
            logEvent("task_outcome_recorded", {
              sb: sbFirstChoice,
              sbTiming: proxySbTiming(sbFirstChoice, false),
              // What the proxy actually got out, recorded BESIDE the choice
              // rather than instead of it: a divergence between the two is a
              // guardrail block or an emergency stop, and it has to stay
              // legible instead of being folded into the primary measure.
              proxyVoicedTier,
            }, { sessionIndex: taskIndex });
            setPhase("review");
          } else {
            setPhase("handover");
          }
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  // Only modification/refusal leads here (Design §7).
  if (phase === "handover") {
    const refused = ratify === "rejected";
    return (
      <TaskCover
        eyebrow="Your closing conversation"
        title={refused ? "Discuss a new package" : "Discuss your changes"}
        /* THE SCENE IS THE DIRECT ONE, and that is the point: from here the
           proxies are done and the two people talk. The representative gets
           one closing line above it — it opened the delegation, so it closes
           it rather than simply vanishing — but it is drawn small and beside
           the text, not as the hero of a screen it is leaving. */
        scene="direct"
        lead={
          <>
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 sm:p-3.5">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-indigo-100"
              >
                <ProxyFigure side="mine" size={26} />
              </span>
              <div className="min-w-0">
                <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-indigo-700">
                  Your AI Proxy
                </p>
                {/* Fixed wording in both branches apart from the clause naming
                    what the participant chose, which is their own decision
                    read back and not an evaluation of it. No thanks, no
                    apology, no assessment of how it went: RATIFY's three
                    options carry equal weight and the screen after it may not
                    grade the one that was taken. */}
                <p className="mt-0.5 text-sm leading-relaxed text-indigo-950">
                  {refused
                    ? "That is me done, then. I have stepped back and nothing is agreed. You take it from here. You are speaking for yourself now."
                    : "That is me done, then. I have stepped back and left the package on the table. You take it from here. You are speaking for yourself now."}
                </p>
              </div>
            </div>
            <p className="text-base leading-relaxed text-slate-700">
              {refused
                ? "You refused the proposed package. Nothing is agreed. You will now discuss both conditions with the other participant yourself."
                : "You asked to change the proposed package. Tell the other participant what you would like to change."}
            </p>
          </>
        }
        steps={[
          { label: "Review the exchange", hint: "The AI Proxies' conversation stays available above your chat." },
          { label: "Make your proposal", hint: "Choose one option for each condition and write your message." },
          { label: "Agree on both conditions", hint: "If time runs out without agreement, nothing is settled and you both score 0 for this task." },
        ]}
        minutes={2}
        actionLabel="Start the closing conversation"
        onStart={() => {
          setProxyTranscript(transcript);
          setMessages([]);
          // A REFUSAL LEAVES NOTHING ON THE TABLE. Carrying the proxies'
          // package into the composer would put back exactly what the
          // participant just refused, and the counterpart would read it as
          // their standing offer.
          setOffer(refused ? {} : (tentative ?? {}));
          logEvent(
            "negotiation_started",
            {
              phase: "direct",
              ratify,
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
        // A REFUSAL LEAVES NOTHING STANDING. Passing the refused package as
        // the opening would put back exactly what the participant just
        // refused, and the counterpart would treat it as an offer on the
        // table (Ver.2.13 §7).
        openingPackage={ratify === "rejected" ? null : tentative}
        refused={ratify === "rejected"}
        proxyVoicedTier={proxyVoicedTier}
        /* `SB` is the checkbox, decided at DECISION-LOCK — see
           `proxySbFirstChoice`. The closing cannot change it; a confession
           made there is `wrap_up`. */
        sbFirstChoice={sbFirstChoice}
        messages={messages}
        setMessages={setMessages}
        offer={offer}
        setOffer={setOffer}
        onSettled={(pkg, meta) => {
          setTentative(pkg);
          setClosing({ selfDisclosed: meta.selfDisclosed });
          logEvent(
            "task_outcome_recorded",
            {
              sb: sbFirstChoice,
              sbTiming: proxySbTiming(sbFirstChoice, meta.selfDisclosed),
              proxyVoicedTier,
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
      hoped={Object.fromEntries(
        mandate.issues
          .filter((im) => im.preferredOptionId)
          .map((im) => [im.issueId, im.preferredOptionId as string]),
      )}
      behaviour={{
        ratify,
        // SB in this arm is the CHECKBOX (§6.3, §9.3) — the participant's own
        // first disclosure choice, sealed at DECISION-LOCK. Not
        // `proxyVoicedTier`: that is what the apparatus managed to say, and a
        // guardrail block would otherwise recode a discloser as a
        // non-discloser inside RQ1's confirmatory outcome. See
        // `proxySbFirstChoice`.
        sb: sbFirstChoice,
        sbTiming: proxySbTiming(
          sbFirstChoice,
          Boolean(closing?.selfDisclosed),
        ),
      }}
      transcript={messages}
      proxyTranscript={proxyTranscript}
      isProxy
      /* "Your Direct Conversation" named the CONDITION. The heading only has
         to distinguish this transcript from the proxies' one collapsed above
         it, which "with the other participant" does without borrowing an arm
         name. */
      transcriptTitle="Your Conversation With the Other Participant"
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
// The reason section of the mandate screen
// ---------------------------------------------------------------------------

/**
 * What the participant decides about their reasons — which since Ver.2.21 is
 * ONE thing (§8.7).
 *
 * THE WORK REASON IS NO LONGER A CHOICE. It used to be a checkbox, on by
 * default. Two things were wrong with that. It cannot change the outcome — a
 * non-directional work reason buys the same rung as silence (§3.3) — so
 * unticking it was a decision with no consequence; and unticking it created a
 * "proxy that gives no reason at all", a path with no counterpart in Direct
 * (the old §6.9 #12), which muddied what M1 was asking about. It is now a
 * fixed utterance, shown ticked and locked, and the participant's whole
 * decision is the sensitive background.
 *
 * THE ⚠ CAPTION IS §8.1's COMMON NOTICE, CUT TO ONE LINE. It appears on the
 * SB and never on the work reason, so which card carries a cost is visible at
 * the moment of ticking. The same sentence appears under the SB card in the
 * Direct arm's briefing panel — both arms, same words — because the notice is
 * common to both by design and a caption in one arm only would be an exposure
 * difference on the primary outcome.
 *
 * WHAT IT MAY NOT DO. It may not forecast a bad outcome, add a confirmation
 * step, or say that sharing helps or hurts on balance. §8.1's researcher note
 * is explicit: no role-specific warning, no confirmation pop-up, and no
 * suggestion that any one answer is the sensible one. Disclosure is the
 * primary outcome; naming a right answer would stage it.
 */
function ReasonMandateSection({
  task,
  role,
  mandate,
  onToggle,
}: {
  task: NegotiationTask;
  role: Role;
  mandate: Mandate;
  onToggle: (cardId: string) => void;
}) {
  const cards = task.roleBriefs[role].reasonCards;
  const workCards = cards.filter((c) => c.layer === "work");
  const sensitiveCards = cards.filter((c) => c.layer === "sensitive");

  return (
    <Card tone="private" className="border-amber-300 bg-amber-50/50 text-[var(--private-ink)]">
      {/* ONE LINE, AND NO HEADING. This carried a section heading plus a
          four-line paragraph saying what the two labelled boxes below it
          already say for themselves. The mandate screen's length was the
          complaint, and this was most of it.

          WHAT SURVIVES IS THE MECHANISM: always, only-if-ticked. That much
          cannot go, because a participant not told the work reason always
          goes would read the one checkbox as the whole of what gets said. It
          is symmetric between the two answers and recommends neither, which
          is what §8.1 requires of any copy near this control. */}
      <p className="mb-4 text-xs sm:text-sm leading-relaxed text-amber-950 font-medium">
        Your work reason always goes across. The sensitive background only goes
        if you tick it.
      </p>

      {/* THE SPLIT STAYS (interface rule 6). Two boxes, two colours, two
          headings — the sensitive one ROSE — because which box a participant
          is willing to draw from is the whole measure, and a single list would
          make that decision illegible. */}
      {/* NO WRAPPER PANEL AROUND THE TWO BOXES (round six). It was a slate
          card holding a white box holding a white row, inside this amber card
          — four nested surfaces to show two reasons. `IssueReasonGroups` lost
          the same wrapper for the same reason: rule 6 wants the two boxes
          separate from EACH OTHER, which their own borders and colours do,
          and a container around both works against that. */}
      <div>
        <ReasonBox title="Work reason" cards={workCards}>
          {(card) => (
            /* LOCKED AND TICKED, and it says which it is. A disabled checkbox
               with no label reads as a control that failed to load; "Always
               shared" says the state is the design rather than a thing the
               participant forgot to change. It is not a `<label>` and carries
               no click target — there is nothing here to press. */
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 shadow-2xs">
              <input
                type="checkbox"
                checked
                disabled
                readOnly
                aria-label="Work reason — always shared"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-slate-500"
              />
              <span className="min-w-0 flex-1">
                <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[0.6875rem] font-bold text-slate-700">
                  <span aria-hidden>🔓</span>
                  Always shared
                </span>
                <span className="block text-xs sm:text-sm leading-relaxed text-slate-800 font-medium">
                  {card.text}
                </span>
              </span>
            </div>
          )}
        </ReasonBox>

        <ReasonBox title="Sensitive background" cards={sensitiveCards} sensitive>
          {(card) => {
            const checked = mandate.authorizedReasonIds.includes(card.id);
            return (
              <div>
                {/* BOTH STATES ARE LABELLED, deliberately. A badge that
                    appears only when ticked makes ticking look like the
                    completed answer and an untouched row look unfinished,
                    which is a nudge toward disclosure on exactly the outcome
                    the study measures. */}
                <label
                  className={cx(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all shadow-2xs",
                    checked
                      ? "border-rose-400 bg-white text-rose-950 ring-2 ring-rose-400/20"
                      : "border-rose-200 bg-white/70 hover:border-rose-300",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(card.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-rose-300 text-rose-600 accent-rose-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx(
                        "mb-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-bold",
                        checked
                          ? "border-rose-300 bg-rose-50 text-rose-800"
                          : "border-slate-200 bg-slate-50 text-slate-600",
                      )}
                    >
                      <span aria-hidden>{checked ? "🤖" : "🚫"}</span>
                      {checked
                        ? "Your proxy may share this"
                        : "Your proxy will not share this"}
                    </span>
                    <span className="block text-xs sm:text-sm leading-relaxed text-slate-800 font-medium">
                      {card.text}
                    </span>
                  </span>
                </label>
                {/* THE CAPTION SITS UNDER THE CHECKBOX, not inside the label:
                    it describes what ticking would mean, and putting it inside
                    the click target would make reading it and pressing it the
                    same gesture. No ring and no animation — rule 9 reserves
                    the cue for the one thing a screen is waiting for, and this
                    box is not waiting. */}
                <SensitiveCaption className="mt-1.5 px-1" />
              </div>
            );
          }}
        </ReasonBox>
      </div>
    </Card>
  );
}
