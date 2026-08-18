/**
 * Scripted transcripts for mockup mode.
 *
 * WHY THIS EXISTS. The point of the mockup is to walk the whole flow and see
 * what a participant sees — and half of what they see is a negotiation that
 * has already happened. A screen showing "[mock] lorem ipsum" tells you the
 * layout survives, but not whether the review screen reads sensibly, whether
 * the transcript is the right length, or whether a Leader can actually judge
 * a focal requirement from what is in front of them. So every condition ×
 * role × task combination has a written exchange, modelled on the worked
 * example in Methods ver.1.8 Appendix E8.
 *
 * These are the IDEAL trajectories: the logroll lands, the focal threshold
 * holds, the counterpart accepts at Stage 4. That is deliberate — the mockup
 * is for reading the flow, not for exercising the failure branches. Impasse
 * and threshold-breaking outcomes are reachable in mockup mode by picking a
 * different scenario in the dev panel.
 *
 * NOTHING HERE SHIPS TO PARTICIPANTS. It is reached only through mockup mode,
 * which is compiled out entirely when NEXT_PUBLIC_DEV_TOOLS=off.
 *
 * Message shape follows Appendix E1: 280 characters or fewer, neutral and
 * professional, three substantive offers per side (opening, counterpackage,
 * tentative), and no message that mentions points, rules, or the system.
 */

import { focalIssue, distributiveIssue, scopeIssue } from "../tasks";
import type {
  NegotiationTask,
  Package,
  RationaleFrame,
  Role,
  Speaker,
  StageId,
  TaskId,
} from "../types";

export interface ScriptedMessage {
  id: string;
  stage: StageId;
  speaker: Speaker;
  text: string;
  /** Package attached to this message, when it is an offer. */
  proposal?: Package;
  frame?: RationaleFrame;
  /**
   * Audit-only. Recorded so a researcher can trace which elements the Explorer
   * generated, and STRIPPED before anything reaches the participant — see
   * `visibleTranscript` below. This is the provenance rule from CLAUDE.md.
   */
  internalProvenance?: "principal_mandate" | "agent_option";
}

export interface ScriptedSession {
  messages: ScriptedMessage[];
  /** The package that goes to human review. */
  tentative: Package;
  agreed: boolean;
}

/** Counterpart persona for the Baseline condition (Appendix E7). */
export const COUNTERPART_PERSONA = {
  name: "Alex",
  /** Shown while the counterpart is composing. */
  typingLabel: "Alex is typing…",
} as const;

// ---------------------------------------------------------------------------
// Package shorthand
// ---------------------------------------------------------------------------

/** Builds a package from option positions (1-based, as participants see them). */
function pkg(
  task: NegotiationTask,
  scopeAt: number,
  focalAt: number,
  timingAt: number,
): Package {
  const s = scopeIssue(task);
  const f = focalIssue(task);
  const t = distributiveIssue(task);
  return {
    [s.id]: s.options[scopeAt - 1].id,
    [f.id]: f.options[focalAt - 1].id,
    [t.id]: t.options[timingAt - 1].id,
  };
}

/** Task-specific nouns, so one script serves both scenarios. */
function words(taskId: TaskId) {
  return taskId === "task_a"
    ? {
        scope: "pilot scope",
        focal: "remote days",
        timing: "launch date",
        focalAsk: "two remote days a week",
        focalPush: "one remote day or none",
        workReason:
          "Deep-focus configuration goes faster without office interruptions, and two remote days still keep the pilot on schedule.",
        practice:
          "Implementation-heavy phases often run on hybrid schedules — one option could be two remote days with a broader scope.",
        risk:
          "Uninterrupted configuration time reduces setup errors before answers reach customers.",
        leaderCare: "the showcase in Week 4",
        counterpartFocalAsk: "the on-site presence",
      }
    : {
        scope: "migration scope",
        focal: "the on-call cap",
        timing: "completion date",
        focalAsk: "an eight-hour weekly on-call cap",
        focalPush: "ten or twelve hours",
        workReason:
          "The recent incident followed a long stretch of after-hours coverage. A cap at eight hours keeps fatigue from adding risk to the migration.",
        practice:
          "Migrations this size typically bound on-call load — one option could be an eight-hour cap alongside a broader scope.",
        risk:
          "A bounded on-call load reduces fatigue-related errors during the riskiest weeks.",
        leaderCare: "the renewal review in Week 6",
        counterpartFocalAsk: "the coverage",
      };
}

// ---------------------------------------------------------------------------
// Member-side script (participant is the Member — the focal holder)
// ---------------------------------------------------------------------------

/**
 * The ideal Member trajectory, in both Baseline and Proxy form.
 *
 * The arc is the one Appendix E8 walks through: open wide, name the focal as
 * the priority, absorb the standardized challenge without dropping below the
 * threshold, then buy it back by handing over the scope the counterpart
 * actually wants. Stage 4 lands at 3,700 for the counterpart, which clears
 * T4, so it accepts.
 */
function memberScript(
  task: NegotiationTask,
  mode: "baseline" | "delegate" | "explorer",
): ScriptedSession {
  const w = words(task.id);
  const own: Speaker = mode === "baseline" ? "participant" : "participant_proxy";
  const other: Speaker =
    mode === "baseline" ? "counterpart" : "counterpart_proxy";

  // Counterpart opens at its own best: scope O1, focal O4, timing O1.
  const theirOpening = pkg(task, 1, 4, 1);
  // Participant opens at scope O3, focal O1, timing O3.
  const myOpening = pkg(task, 3, 1, 3);
  // The trade: give scope O2 and timing O2, hold the focal at O2 (threshold).
  const myTrade = pkg(task, 2, 2, 2);

  const messages: ScriptedMessage[] = [
    {
      id: "s1a",
      stage: 1,
      speaker: other,
      proposal: theirOpening,
      text:
        mode === "baseline"
          ? `hi — good to be working on this. my opening: five workflows on ${w.scope}, no ${w.focal}, and the earliest ${w.timing}. breadth is what makes this worth doing for us.`
          : `Opening on behalf of ${COUNTERPART_PERSONA.name}: the widest ${w.scope}, no ${w.focal}, and the earliest ${w.timing}. Breadth and timing are the priorities on this side.`,
    },
    {
      id: "s1b",
      stage: 1,
      speaker: own,
      proposal: myOpening,
      frame: "risk_reduction",
      internalProvenance: "principal_mandate",
      text:
        mode === "baseline"
          ? `Thanks. My opening is a narrower ${w.scope}, ${w.focalAsk}, and a later ${w.timing}. ${w.risk}`
          : `Proposing a narrower ${w.scope}, ${w.focalAsk}, and a later ${w.timing}. ${w.risk}`,
    },
    {
      id: "s2a",
      stage: 2,
      speaker: other,
      text:
        mode === "baseline"
          ? `which of the three matters most to you? on my side it's ${w.scope} — i've committed to ${w.leaderCare} and breadth is what makes the case.`
          : `Which term matters most on your side? For ${COUNTERPART_PERSONA.name}, ${w.scope} is the priority — it is what makes the case at ${w.leaderCare}.`,
    },

    // The Explorer difference lives here: an extra, tentatively-framed option
    // supported by a role-generic argument. Same message count, same length.
    mode === "explorer"
      ? {
          id: "s2b",
          stage: 2,
          speaker: own,
          frame: "common_practice",
          internalProvenance: "agent_option",
          text: `${w.focal} matter most on this side. ${w.practice} Nothing settled — worth putting on the table.`,
        }
      : {
          id: "s2b",
          stage: 2,
          speaker: own,
          frame: "risk_reduction",
          internalProvenance: "principal_mandate",
          text:
            mode === "baseline"
              ? `${w.focal} matter most to me. ${w.workReason}`
              : `${w.focal} matter most on this side. ${w.workReason}`,
        },

    {
      id: "s3a",
      stage: 3,
      speaker: other,
      text: task.standardizedChallenge,
    },
    {
      id: "s3b",
      stage: 3,
      speaker: own,
      frame: "feasibility",
      internalProvenance: "principal_mandate",
      text: `I understand the pressure on ${w.counterpartFocalAsk}. ${w.focalAsk} is the level that keeps this workable — but the other two terms have room, and I would rather move there.`,
    },
    {
      id: "s4a",
      stage: 4,
      speaker: own,
      proposal: myTrade,
      frame: "conditional_exchange",
      internalProvenance: "principal_mandate",
      text: `Concretely: if ${w.focalAsk} holds, I can go to a wider ${w.scope} and an earlier ${w.timing}. That is the exchange I can make.`,
    },
    {
      id: "s4b",
      stage: 4,
      speaker: other,
      proposal: myTrade,
      text:
        mode === "baseline"
          ? `that works for me. the wider ${w.scope} and the earlier ${w.timing} are what i needed — i can live with ${w.focalAsk}.`
          : `That is workable for ${COUNTERPART_PERSONA.name}. The wider ${w.scope} and the earlier ${w.timing} cover the priorities on this side.`,
    },
    {
      id: "s5a",
      stage: 5,
      speaker: other,
      proposal: myTrade,
      text: `Recording the tentative package: a wider ${w.scope}, ${w.focalAsk}, and the middle ${w.timing}. Over to both sides to confirm.`,
    },
  ];

  return { messages, tentative: myTrade, agreed: true };
}

// ---------------------------------------------------------------------------
// Leader-side script (participant is the Leader — the receiver)
// ---------------------------------------------------------------------------

/**
 * The yoked receiver stimulus (Methods ver.1.8 §Yoked receiver stimuli).
 *
 * A Leader participant sees the SAME content under Delegate and Explorer —
 * the same packages, the same focal message, the same tentative outcome at
 * the same level of favourability. Only the condition notice differs. That
 * identity is the causal control behind the attribution and uptake outcomes,
 * so the script must not branch on policy here, and does not.
 */
function leaderScript(
  task: NegotiationTask,
  mode: "baseline" | "delegate" | "explorer",
): ScriptedSession {
  const w = words(task.id);
  const own: Speaker = mode === "baseline" ? "participant" : "participant_proxy";
  const other: Speaker =
    mode === "baseline" ? "counterpart" : "counterpart_proxy";

  // Mirror of E3: the counterpart Member opens at scope O4, focal O1, timing O4.
  const theirOpening = pkg(task, 4, 1, 4);
  const myOpening = pkg(task, 1, 4, 1);
  // The tentative outcome is fixed at "moderately favourable" and is identical
  // across conditions — a constant, not a randomized draw.
  const settled = pkg(task, 2, 2, 2);

  const messages: ScriptedMessage[] = [
    {
      id: "l1a",
      stage: 1,
      speaker: own,
      proposal: myOpening,
      text: `Opening: the widest ${w.scope}, no change to ${w.focal}, and the earliest ${w.timing}. Breadth is what makes this worth doing.`,
    },
    {
      id: "l1b",
      stage: 1,
      speaker: other,
      proposal: theirOpening,
      text:
        mode === "baseline"
          ? `thanks. mine is a narrower ${w.scope}, ${w.focalAsk}, and a later ${w.timing}. i'd want to explain the middle one.`
          : `On behalf of ${COUNTERPART_PERSONA.name}: a narrower ${w.scope}, ${w.focalAsk}, and a later ${w.timing}.`,
    },
    {
      id: "l2a",
      stage: 2,
      speaker: other,
      frame: "risk_reduction",
      text:
        mode === "baseline"
          ? `${w.focalAsk} is the one i really need. ${w.risk} which of the three matters most on your side?`
          : `${w.focalAsk} is the priority on this side. ${w.risk} Which term matters most to you?`,
    },
    {
      id: "l2b",
      stage: 2,
      speaker: own,
      text: `${w.scope} is what matters most to me — it is what I can show at ${w.leaderCare}.`,
    },
    {
      id: "l3a",
      stage: 3,
      speaker: own,
      text: task.standardizedChallenge,
    },
    {
      id: "l3b",
      stage: 3,
      speaker: other,
      frame: "feasibility",
      text: `I understand the pressure there. ${w.focalAsk} is the level that keeps this workable — but the other two terms have room.`,
    },
    {
      id: "l4a",
      stage: 4,
      speaker: other,
      proposal: settled,
      frame: "conditional_exchange",
      text: `Concretely: if ${w.focalAsk} holds, a wider ${w.scope} and an earlier ${w.timing} are available. That is the exchange on offer.`,
    },
    {
      id: "l4b",
      stage: 4,
      speaker: own,
      proposal: settled,
      text: `That is workable. The wider ${w.scope} and the earlier ${w.timing} are what I needed.`,
    },
    {
      id: "l5a",
      stage: 5,
      speaker: other,
      proposal: settled,
      text: `Recording the tentative package: a wider ${w.scope}, ${w.focalAsk}, and the middle ${w.timing}. Over to both sides to confirm.`,
    },
  ];

  return { messages, tentative: settled, agreed: true };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function scriptedSession(
  task: NegotiationTask,
  role: Role,
  mode: "baseline" | "delegate" | "explorer",
): ScriptedSession {
  return role === "member"
    ? memberScript(task, mode)
    : leaderScript(task, mode);
}

/**
 * The transcript as the participant may see it.
 *
 * Provenance is dropped here rather than at the render site, so that no screen
 * can accidentally receive it. In the real system the same stripping happens
 * server-side before the response leaves `/api/proxy-negotiation`; this is the
 * mockup's equivalent, and the property it guarantees is the same one:
 * Delegate and Explorer render identically, and which elements the Explorer
 * generated is never recoverable from the interface.
 */
export function visibleTranscript(
  session: ScriptedSession,
): Array<{
  id: string;
  stage: StageId;
  speaker: Speaker;
  text: string;
  proposal?: Package;
}> {
  return session.messages.map(({ id, stage, speaker, text, proposal }) => ({
    id,
    stage,
    speaker,
    text,
    ...(proposal ? { proposal } : {}),
  }));
}
