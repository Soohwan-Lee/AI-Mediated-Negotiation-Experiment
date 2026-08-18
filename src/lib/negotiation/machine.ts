/**
 * The negotiation state machine (Methods ver.1.8 §5, Appendix E2–E5).
 *
 * WHAT THIS OWNS, AND WHY IT MATTERS. Until ver.1.8 the model decided when to
 * concede, when to accept, and when to stop, which meant two participants who
 * behaved identically could get different outcomes — and the primary outcomes
 * are all functions of behaviour. So the split is: this file decides WHAT
 * happens (offer levels, concessions, acceptance, termination) and the model
 * only decides HOW it is said. Every participant meets the same counterpart.
 *
 * That split is also what makes randomizing outcomes unnecessary. Methods
 * §Outcome policy declines to assign success and failure precisely because a
 * deterministic counterpart already gives the stronger guarantee: same
 * behaviour, same result.
 *
 * The five stages run once each, in order. There is no free-running turn loop
 * to deadlock, so the "both sides restate the impasse for the remaining turns"
 * failure mode that the prompt-level pacing was patching over cannot occur.
 */

import {
  counterpartOpening,
  focalIssue,
  optionIndex,
  scopeIssue,
  distributiveIssue,
  scorePackage,
} from "../tasks";
import type {
  NegotiationTask,
  Package,
  Role,
  StageId,
} from "../types";

/**
 * Counterpart acceptance thresholds (Appendix E2).
 *
 * Working values, to be fixed after the pilot against a target impasse rate
 * below 10% (Methods §Appendix G). T4 is deliberately set so that a full
 * logroll — the other side's scope at Option 1 while holding your own focal at
 * Option 1 — scores 3,600 and is accepted: protecting the requirement while
 * giving away what the counterpart actually wants is structurally rewarded.
 */
export const ACCEPTANCE = {
  /** Stage 4: accept a counterpackage worth at least this much. */
  T4: 3600,
  /** Stage 5: the relaxed closing threshold. */
  T5: 2600,
} as const;

export const STAGES: readonly StageId[] = [1, 2, 3, 4, 5];

export const STAGE_LABELS: Record<StageId, string> = {
  1: "Opening package",
  2: "Priorities and reasons",
  3: "Their response",
  4: "Conditional trade",
  5: "Tentative agreement",
};

/**
 * What the participant (or their proxy) is being asked to do at each stage.
 * Identical wording across conditions — the stage structure is held constant
 * so transcripts are comparable, and nothing here may hint at the condition.
 */
export const STAGE_PROMPTS: Record<StageId, string> = {
  1: "Put a complete package on the table — one option on each of the three terms. You can highlight at most two of them in your message.",
  2: "They have asked what matters most to you. Answer, and ask what you want to know.",
  3: "They have pushed back on one of your terms. This turn is for your reply — you make your next offer at the following step.",
  4: "Now make your counterpackage. Tying one term to another is allowed: “if X holds, I can move on Y.”",
  5: "This is the package that goes to review.",
};

// ---------------------------------------------------------------------------
// Counterpart behaviour
// ---------------------------------------------------------------------------

export interface CounterpartDecision {
  stage: StageId;
  /** The package the counterpart puts forward, if it makes an offer. */
  proposal: Package | null;
  /** Does it accept what is on the table? */
  accepts: boolean;
  /** Score of the participant's package from the counterpart's side. */
  scoreOfIncoming: number;
  /** Set when the exchange ends without agreement. */
  impasse: boolean;
}

/**
 * One step down on an issue, from the counterpart's point of view.
 * Options are always ordered best-first for the role the issue favours, so a
 * concession is a move toward the far end of that role's preference.
 */
function concede(
  task: NegotiationTask,
  issueId: string,
  current: string,
  role: Role,
): string {
  const issue = task.issues.find((i) => i.id === issueId)!;
  const ranked = [...issue.options].sort(
    (a, b) => b.points[role] - a.points[role],
  );
  const at = ranked.findIndex((o) => o.id === current);
  return ranked[Math.min(at + 1, ranked.length - 1)].id;
}

/**
 * The counterpart's move at one stage (Appendix E2, mirrored by E3).
 *
 * Stage 3 makes no offer at all — the standardized challenge occupies that
 * turn on its own, so that the challenge is a fixed stimulus rather than
 * something bundled with a concession that would vary its strength.
 */
export function counterpartStep(
  task: NegotiationTask,
  counterpartRole: Role,
  stage: StageId,
  incoming: Package | null,
  lastCounterpartPackage: Package | null,
): CounterpartDecision {
  const opening = counterpartOpening(task, counterpartRole);
  const held = lastCounterpartPackage ?? opening;
  const score = incoming ? scorePackage(task, incoming, counterpartRole) : 0;

  switch (stage) {
    case 1:
      return {
        stage,
        proposal: opening,
        accepts: false,
        scoreOfIncoming: score,
        impasse: false,
      };

    case 2:
      // Explains its own priority and asks about yours. Position unchanged.
      return {
        stage,
        proposal: null,
        accepts: false,
        scoreOfIncoming: score,
        impasse: false,
      };

    case 3:
      // The standardized focal challenge, and nothing else.
      return {
        stage,
        proposal: null,
        accepts: false,
        scoreOfIncoming: score,
        impasse: false,
      };

    case 4: {
      if (score >= ACCEPTANCE.T4) {
        return {
          stage,
          proposal: incoming,
          accepts: true,
          scoreOfIncoming: score,
          impasse: false,
        };
      }
      // Otherwise concede one step on the distributive issue — the cheapest
      // currency it has, and the one that keeps the logroll path open.
      const timing = distributiveIssue(task);
      return {
        stage,
        proposal: {
          ...held,
          [timing.id]: concede(task, timing.id, held[timing.id], counterpartRole),
        },
        accepts: false,
        scoreOfIncoming: score,
        impasse: false,
      };
    }

    case 5: {
      const accepts = score >= ACCEPTANCE.T5;
      return {
        stage,
        proposal: accepts ? incoming : null,
        accepts,
        scoreOfIncoming: score,
        impasse: !accepts,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Proxy behaviour (Appendix E4 / E5)
// ---------------------------------------------------------------------------

export interface ProxyPlan {
  /** What the proxy proposes at each stage where it makes an offer. */
  opening: Package;
  counterpackage: Package;
  tentative: Package;
  /** Explorer only: the package it floats as "one option could be…". */
  probe: Package | null;
}

/**
 * Turns a mandate into the three packages the proxy will actually put forward.
 *
 * DELEGATE executes the participant's own concession path: it opens at their
 * preferred package and, when challenged, spends the issues they marked as
 * having room, never crossing a hard boundary.
 *
 * EXPLORER has the same boundaries but picks its trial order by joint value
 * instead — which is why it converges on the logroll (give scope, hold focal)
 * rather than on whatever order the participant happened to write down.
 *
 * Both produce the same NUMBER of visible offers. The difference is which
 * packages get tried and how they are framed, never how much airtime they get
 * (Methods §Delegate–Explorer matching).
 */
export function buildProxyPlan(
  task: NegotiationTask,
  participantRole: Role,
  mandate: {
    issues: Array<{
      issueId: string;
      preferredOptionId: string | null;
      acceptableFloorOptionId: string | null;
      hardBoundaryOptionId: string | null;
    }>;
  },
  policy: "delegate" | "explorer",
): ProxyPlan {
  const counterpartRole: Role =
    participantRole === "member" ? "leader" : "member";
  const focal = focalIssue(task);
  const scope = scopeIssue(task);
  const timing = distributiveIssue(task);

  const pick = (issueId: string, which: "preferred" | "floor" | "boundary") => {
    const im = mandate.issues.find((i) => i.issueId === issueId);
    const issue = task.issues.find((i) => i.id === issueId)!;
    const chosen =
      which === "preferred"
        ? im?.preferredOptionId
        : which === "floor"
          ? im?.acceptableFloorOptionId
          : im?.hardBoundaryOptionId;
    return chosen ?? issue.options[0].id;
  };

  const opening: Package = Object.fromEntries(
    task.issues.map((i) => [i.id, pick(i.id, "preferred")]),
  );

  /** The most the proxy may give away on an issue without breaking a boundary. */
  const limit = (issueId: string) => {
    const im = mandate.issues.find((i) => i.issueId === issueId);
    return (
      im?.hardBoundaryOptionId ??
      im?.acceptableFloorOptionId ??
      pick(issueId, "preferred")
    );
  };

  // The counterpackage: hold the focal at its limit, spend scope and timing.
  // This is the logroll, and it is the same shape under both policies — what
  // differs is that Delegate reaches it by following the participant's stated
  // order and Explorer by trying the highest-joint-value combination first.
  const counterpackage: Package = {
    ...opening,
    [focal.id]: limit(focal.id),
    [scope.id]:
      policy === "explorer"
        ? // Explorer gives the counterpart its best scope outright, because
          // that is what buys the focal. Within the authorized range: the
          // participant left scope open, and giving more of it is never a
          // boundary violation.
          bestFor(task, scope.id, counterpartRole)
        : limit(scope.id),
    [timing.id]: limit(timing.id),
  };

  const tentative = counterpackage;

  const probe: Package | null =
    policy === "explorer"
      ? {
          ...opening,
          [focal.id]: limit(focal.id),
          [scope.id]: bestFor(task, scope.id, counterpartRole),
        }
      : null;

  return { opening, counterpackage, tentative, probe };
}

function bestFor(
  task: NegotiationTask,
  issueId: string,
  role: Role,
): string {
  const issue = task.issues.find((i) => i.id === issueId)!;
  return [...issue.options].sort((a, b) => b.points[role] - a.points[role])[0]
    .id;
}

// ---------------------------------------------------------------------------
// Outcome coding
// ---------------------------------------------------------------------------

export interface OutcomeCoding {
  agreed: boolean;
  /** Behavioural code SURV-FINAL — is the focal threshold in the final package? */
  focalPreserved: boolean;
  /** Where the focal landed, as an option index (0-based). */
  focalOptionIndex: number;
  participantPoints: number;
  counterpartPoints: number;
  jointPoints: number;
  /** Did the participant clear their fallback? */
  clearsReservation: boolean;
}

export function codeOutcome(
  task: NegotiationTask,
  participantRole: Role,
  finalPackage: Package | null,
  agreed: boolean,
): OutcomeCoding {
  const counterpartRole: Role =
    participantRole === "member" ? "leader" : "member";
  const focal = focalIssue(task);

  // No agreement: both sides take the fallback. `clearsReservation` is false
  // rather than true — the participant did not clear their fallback, they
  // *received* it, and reading "above your fallback" on an impasse screen
  // would tell them the opposite of what happened.
  if (!finalPackage) {
    return {
      agreed: false,
      focalPreserved: false,
      focalOptionIndex: -1,
      participantPoints: task.reservationPoints,
      counterpartPoints: task.reservationPoints,
      jointPoints: task.reservationPoints * 2,
      clearsReservation: false,
    };
  }

  const participantPoints = scorePackage(task, finalPackage, participantRole);
  const counterpartPoints = scorePackage(task, finalPackage, counterpartRole);
  const index = optionIndex(task, focal.id, finalPackage[focal.id] ?? null);

  return {
    agreed,
    focalPreserved: index >= 0 && index <= (focal.focalThresholdIndex ?? 1),
    focalOptionIndex: index,
    participantPoints,
    counterpartPoints,
    jointPoints: participantPoints + counterpartPoints,
    clearsReservation: participantPoints >= task.reservationPoints,
  };
}
