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

  /**
   * The furthest the proxy may go on an issue.
   *
   * The fall-through matters, and getting it wrong broke the Delegate arm.
   * "No boundary and no floor" is a participant saying they do not mind about
   * this term — the natural mandate for the issue they are willing to spend.
   * Falling back to their OPENING turned that into "never move", so a
   * Delegate conceded nothing on scope while an Explorer gave it away, and
   * the same participant with the same mandate got an agreement in one arm
   * and a rejection in the other. That is a mechanical difference between the
   * conditions, which is precisely what §Delegate–Explorer matching exists to
   * prevent.
   *
   * With nothing set, the limit is the worst option for the principal: they
   * declined to constrain it, so all of it is available to trade.
   */
  const limit = (issueId: string) => {
    const im = mandate.issues.find((i) => i.issueId === issueId);
    if (im?.hardBoundaryOptionId) return im.hardBoundaryOptionId;
    if (im?.acceptableFloorOptionId) return im.acceptableFloorOptionId;
    return worstFor(task, issueId, participantRole);
  };

  // The counterpackage: hold the focal at its limit and spend the other two
  // terms, but not past the point where the package is worth less to the
  // principal than walking away. Both policies compute it the same way,
  // because both are bound by the same mandate — a Delegate that could not
  // spend what the participant left open would be a broken control, not a
  // stricter one.
  //
  // WHERE THE POLICIES ACTUALLY DIFFER, then, is not how far the proxy may go
  // but what it puts on the table on the way: the Explorer floats an
  // additional combination as an option (stage 2) and may support it with an
  // argument anyone in the role could make. That difference is the
  // manipulation. Concession reach is not, and must not become one.
  const counterpackage = spendDownTo(
    task,
    participantRole,
    { ...opening, [focal.id]: limit(focal.id) },
    [scope.id, timing.id],
    limit,
  );

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

/**
 * Gives ground on `spendable` as far as the mandate allows, stopping before
 * the package drops below the principal's own fallback.
 *
 * No mandate field says "and don't accept less than walking away" because it
 * does not need to: refusing an agreement worth less than no agreement is not
 * a preference, it is what the fallback means. Spending every open term
 * without this produced packages the principal would rather have refused.
 *
 * Terms are spent in order of what they cost the principal per point the
 * counterpart gains — cheapest first, which is the logroll.
 */
function spendDownTo(
  task: NegotiationTask,
  principal: Role,
  from: Package,
  spendable: string[],
  limit: (issueId: string) => string,
): Package {
  const counterpart: Role = principal === "member" ? "leader" : "member";
  const pkg: Package = { ...from };

  const byCheapness = [...spendable].sort((a, b) => {
    const cost = (id: string) => {
      const issue = task.issues.find((i) => i.id === id)!;
      const best = Math.max(...issue.options.map((o) => o.points[principal]));
      const worst = Math.min(...issue.options.map((o) => o.points[principal]));
      const gain = Math.max(...issue.options.map((o) => o.points[counterpart]));
      return gain > 0 ? (best - worst) / gain : Number.POSITIVE_INFINITY;
    };
    return cost(a) - cost(b);
  });

  for (const issueId of byCheapness) {
    const issue = task.issues.find((i) => i.id === issueId)!;
    const target = limit(issueId);
    const order = [...issue.options].sort(
      (a, b) => b.points[principal] - a.points[principal],
    );
    const stop = order.findIndex((o) => o.id === target);
    const start = order.findIndex((o) => o.id === pkg[issueId]);

    // Step toward the limit while the package still beats the fallback.
    for (let at = start + 1; at <= stop; at += 1) {
      const next = { ...pkg, [issueId]: order[at].id };
      if (scorePackage(task, next, principal) < task.reservationPoints) break;
      pkg[issueId] = order[at].id;
    }
  }

  return pkg;
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

/** The option this role likes least — everything on the table to give away. */
function worstFor(
  task: NegotiationTask,
  issueId: string,
  role: Role,
): string {
  const issue = task.issues.find((i) => i.id === issueId)!;
  const ranked = [...issue.options].sort(
    (a, b) => b.points[role] - a.points[role],
  );
  return ranked[ranked.length - 1].id;
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
