/**
 * The negotiation state machine (Experimental Design Ver.2.4 §4).
 *
 * WHAT THIS OWNS, AND WHY IT MATTERS. The model decides nothing here. This
 * file decides WHAT happens — offer levels, concessions, acceptance,
 * termination — and the model only decides HOW it is said. Two participants
 * who behave identically get identical outcomes, which is what makes a
 * condition contrast interpretable when every primary outcome is a function
 * of behaviour.
 *
 * Design §4 states the split as a table ("LLM이 정하지 않는 것 / LLM이 하는
 * 것") and requires every turn to log the decided action beside the rendered
 * sentence, so pilot gate 9 can show the model never stepped outside it.
 *
 * The five stages run once each, in order. There is no free-running turn loop,
 * so an exchange cannot deadlock or spend its last turns restating an impasse.
 */

import {
  counterpartOpening,
  requirementIssue,
  counterRequirementIssue,
  optionIndex,
  distributiveIssue,
  preservesRequirement,
  scorePackage,
} from "../tasks";
import type { NegotiationTask, Package, Role, StageId } from "../types";

/**
 * Counterpart acceptance thresholds (Design §4 "이유 연동 수락 규칙").
 *
 * Working values, to be fixed after the pilot against a target impasse rate
 * below 10% (Design §10 gate 7). T_MID is deliberately set so that a full
 * logroll — giving the counterpart its own priority issue at Option 1 while
 * holding your requirement at Option 1 — scores 3,600 and is accepted:
 * protecting your requirement while giving away what they actually want is
 * structurally rewarded.
 *
 * T_FINAL sits below T_MID so a late concession can still close, which is the
 * lever on the impasse rate.
 */
export const ACCEPTANCE = {
  /** Stage 4, the conditional trade. */
  T_MID: 3600,
  /** Stage 5, the closing threshold. */
  T_FINAL: 2600,
} as const;

/**
 * How long a negotiation runs before the soft close (Design §8: "10분 타이머").
 *
 * The timer is a real constraint on the participant's pace, not a device to
 * force agreement: when it runs low the counterpart offers to settle on what
 * is already on the table (Design §4 "Soft close"), and an impasse remains a
 * legitimate ending.
 */
export const NEGOTIATION_SECONDS = 10 * 60;

/** Below this, the counterpart starts steering toward a close. */
export const SOFT_CLOSE_SECONDS = 90;

export const STAGES: readonly StageId[] = [1, 2, 3, 4, 5];

export const STAGE_LABELS: Record<StageId, string> = {
  1: "Opening offer",
  2: "Priorities and reasons",
  3: "Pushback",
  4: "Conditional trade",
  5: "Tentative agreement",
};

/**
 * What the participant (or their proxy) is being asked to do at each stage.
 *
 * Identical wording across conditions and across roles — the stage structure
 * is held constant so transcripts are comparable, and nothing here may hint at
 * the condition or at which term the study is about.
 */
export const STAGE_PROMPTS: Record<StageId, string> = {
  1: "Put a complete offer on the table — one option on each of the three terms. Say which ones matter most to you.",
  2: "Answer what they asked, and ask what you want to know about their side.",
  3: "They have asked you to lower one of your terms. This turn is for your reply — your next offer comes at the following step.",
  4: "Make your counter-offer. You can tie one term to another: “if X holds, I can move on Y.”",
  5: "This is the package that goes to review. Nothing is final until you approve it.",
};

/**
 * What each stage is for, in three or four words. Shown in the stage rail so
 * nobody has to infer where they are in a five-step exchange.
 */
export const STAGE_GOALS: Record<StageId, string> = {
  1: "Open with a full package",
  2: "Trade priorities and reasons",
  3: "Answer their pushback",
  4: "Offer a trade",
  5: "Settle on a package",
};

// ---------------------------------------------------------------------------
// Counterpart behaviour
// ---------------------------------------------------------------------------

/**
 * Every move the counterpart is allowed to make, named. The name goes into
 * the transcript beside the rendered sentence (Design §4), so an audit can
 * check the wording against the decision without re-reading the rules.
 */
export type DecidedAction =
  | "open"
  | "state_priority"
  | "challenge"
  | "request_reason"
  | "concede_distributive"
  | "accept"
  | "hold"
  | "soft_close"
  | "impasse";

export interface CounterpartDecision {
  stage: StageId;
  action: DecidedAction;
  /** The package the counterpart puts forward, if it makes an offer. */
  proposal: Package | null;
  /** Does it accept what is on the table? */
  accepts: boolean;
  /** Score of the participant's package from the counterpart's side. */
  scoreOfIncoming: number;
  /** Set when the exchange ends without agreement. */
  impasse: boolean;
  /**
   * True when the counterpart is withholding a concession because no reason
   * has been given for the requirement being asked for (Design §4 이유 요건).
   * Judgement is deferred once, not refused.
   */
  awaitingReason: boolean;
}

/**
 * State the acceptance rule reads, beyond the package itself.
 *
 * `reasonGivenForRequirement` is decided by the system from the structured
 * action log — was a reason card voiced, or (in Baseline) did the participant
 * attach one to a message — never by asking the model to judge whether an
 * argument was any good. Design §4 is explicit that quality judgement is not
 * introduced, so the rule stays deterministic; the effect of a reason's
 * content lives in the perception measures instead.
 */
export interface ExchangeState {
  reasonGivenForRequirement: boolean;
  /** Whether the one-turn grace period has already been spent. */
  reasonAlreadyRequested: boolean;
  secondsRemaining?: number;
}

/**
 * One step down on an issue, from the conceding role's point of view.
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
 * Is the incoming package asking the counterpart to give ground on the
 * participant's requirement issue, relative to where the counterpart stands?
 *
 * This is what the reason requirement attaches to. Asking for something the
 * counterpart has already conceded is not a request, and should not trigger a
 * demand for justification.
 */
function asksForRequirementConcession(
  task: NegotiationTask,
  participantRole: Role,
  incoming: Package | null,
  held: Package,
): boolean {
  if (!incoming) return false;
  const counterpartRole: Role =
    participantRole === "leader" ? "member" : "leader";
  const issue = requirementIssue(task, participantRole);
  const asked = incoming[issue.id];
  const standing = held[issue.id];
  if (!asked || !standing) return false;
  const rank = (id: string) =>
    [...issue.options]
      .sort((a, b) => b.points[counterpartRole] - a.points[counterpartRole])
      .findIndex((o) => o.id === id);
  // A higher rank number is worse for the counterpart, so asking for a worse
  // position than it currently holds is asking it to concede.
  return rank(asked) > rank(standing);
}

/**
 * The counterpart's move at one stage (Design §4).
 *
 * Stage 3 makes no offer at all — the standardized challenge occupies that
 * turn on its own, so the challenge is a fixed stimulus rather than something
 * bundled with a concession that would vary its strength.
 *
 * THE REASON REQUIREMENT is applied at stage 4. If the participant is asking
 * the counterpart to move on their requirement and has never given a reason
 * for it, the counterpart asks for one and defers judgement by one turn. This
 * is what keeps reasons mechanically consequential rather than decorative —
 * Design §4 introduces it precisely because a task settled by option-swapping
 * alone would disconnect the outcome from the thing the study manipulates.
 */
export function counterpartStep(
  task: NegotiationTask,
  counterpartRole: Role,
  stage: StageId,
  incoming: Package | null,
  lastCounterpartPackage: Package | null,
  state: ExchangeState = {
    reasonGivenForRequirement: true,
    reasonAlreadyRequested: false,
  },
): CounterpartDecision {
  const participantRole: Role =
    counterpartRole === "leader" ? "member" : "leader";
  const opening = counterpartOpening(task, counterpartRole);
  const held = lastCounterpartPackage ?? opening;
  const score = incoming ? scorePackage(task, incoming, counterpartRole) : 0;

  const base = {
    stage,
    scoreOfIncoming: score,
    impasse: false,
    awaitingReason: false,
  };

  switch (stage) {
    case 1:
      return { ...base, action: "open" as const, proposal: opening, accepts: false };

    case 2:
      // Explains its own priority and asks about yours. Position unchanged.
      return {
        ...base,
        action: "state_priority" as const,
        proposal: null,
        accepts: false,
      };

    case 3:
      // The standardized challenge, and nothing else.
      return {
        ...base,
        action: "challenge" as const,
        proposal: null,
        accepts: false,
      };

    case 4: {
      const needsReason =
        !state.reasonGivenForRequirement &&
        !state.reasonAlreadyRequested &&
        asksForRequirementConcession(task, participantRole, incoming, held);

      if (needsReason) {
        // Defer judgement by exactly one turn and ask why. The package is not
        // rejected — it has not been evaluated yet.
        return {
          ...base,
          action: "request_reason" as const,
          proposal: null,
          accepts: false,
          awaitingReason: true,
        };
      }

      if (score >= ACCEPTANCE.T_MID && state.reasonGivenForRequirement) {
        return {
          ...base,
          action: "accept" as const,
          proposal: incoming,
          accepts: true,
        };
      }

      if (score >= ACCEPTANCE.T_MID) {
        // Generous package, unexplained requirement: the counterpart takes the
        // terms it was offered but holds the requirement where it stands. The
        // rule is "no concession without a reason", not "no agreement without
        // a reason" — refusing a package that clears the threshold outright
        // would make the reason rule a second acceptance test, which is not
        // what Design §4 specifies.
        const issue = requirementIssue(task, participantRole);
        const withHeldRequirement = {
          ...(incoming as Package),
          [issue.id]: held[issue.id],
        };
        return {
          ...base,
          action: "hold" as const,
          proposal: withHeldRequirement,
          accepts: false,
        };
      }

      // Otherwise trade: concede a step on the distributive issue — the
      // cheapest currency it has, and the one that keeps the logroll open.
      const timing = distributiveIssue(task);
      return {
        ...base,
        action: "concede_distributive" as const,
        proposal: {
          ...held,
          [timing.id]: concede(task, timing.id, held[timing.id], counterpartRole),
        },
        accepts: false,
      };
    }

    case 5: {
      const softClose =
        state.secondsRemaining !== undefined &&
        state.secondsRemaining <= SOFT_CLOSE_SECONDS;

      if (score >= ACCEPTANCE.T_FINAL) {
        return {
          ...base,
          action: (softClose ? "soft_close" : "accept") as DecidedAction,
          proposal: incoming,
          accepts: true,
        };
      }
      return {
        ...base,
        action: "impasse" as const,
        proposal: null,
        accepts: false,
        impasse: true,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Proxy behaviour (Design §4, §7)
// ---------------------------------------------------------------------------

export interface ProxyPlan {
  /** What the proxy proposes at each stage where it makes an offer. */
  opening: Package;
  counterpackage: Package;
  tentative: Package;
}

/**
 * Turns a mandate into the packages the proxy will put forward.
 *
 * BOTH POLICIES COMPUTE THIS IDENTICALLY. That is deliberate and it is the
 * heart of the design: Design §7 defines Delegate and Explorer as differing in
 * REASON USE POLICY, not in what they are willing to trade. If an Explorer
 * could reach further than a Delegate, the `Explorer − Delegate` contrast
 * would be confounded by concession reach, and no perception measure could
 * separate the two.
 *
 * The Explorer difference lives entirely in which reasons it may voice — see
 * `plausibleReasons` in lib/tasks — and Design §7's exposure control requires
 * the extra reason to fit INSIDE the scheduled stage message, never as an
 * extra turn.
 */
export function buildProxyPlan(
  task: NegotiationTask,
  participantRole: Role,
  mandate: {
    issues: Array<{
      issueId: string;
      preferredOptionId: string | null;
      minimumOptionId: string | null;
    }>;
  },
): ProxyPlan {
  const requirement = requirementIssue(task, participantRole);
  const theirs = counterRequirementIssue(task, participantRole);
  const timing = distributiveIssue(task);

  const preferred = (issueId: string) => {
    const im = mandate.issues.find((i) => i.issueId === issueId);
    return im?.preferredOptionId ?? bestFor(task, issueId, participantRole);
  };

  /**
   * The furthest the proxy may go on an issue.
   *
   * The fall-through matters. A participant who set no minimum on a term is
   * saying they do not mind about it — the natural mandate for the term they
   * are willing to spend. Falling back to their OPENING would turn that into
   * "never move", which is a broken proxy rather than a cautious one, and it
   * once produced an agreement in one arm and a rejection in the other for
   * the same mandate.
   */
  const limit = (issueId: string) => {
    const im = mandate.issues.find((i) => i.issueId === issueId);
    return im?.minimumOptionId ?? worstFor(task, issueId, participantRole);
  };

  const opening: Package = Object.fromEntries(
    task.issues.map((i) => [i.id, preferred(i.id)]),
  );

  // The counterpackage: hold the requirement at its stated floor and spend the
  // other two terms — but only as far as it takes to make the offer
  // acceptable, not as far as the mandate would allow.
  //
  // SPENDING THE WHOLE ENVELOPE IS A BUG, NOT CAUTION. An earlier version
  // stopped only at the principal's fallback, which handed away the timing
  // term as well as the counterpart's priority issue and landed the principal
  // on 2,600 — a hundred points above walking away — when holding the
  // requirement and keeping timing at the midpoint scores 3,600 for the
  // principal and is still accepted. A proxy that gives away everything it is
  // permitted to give is not executing a mandate; it is capitulating inside
  // one, and both policies would have done it equally, so the whole design
  // would have measured delegation to a bad negotiator.
  const counterpackage = spendDownTo(
    task,
    participantRole,
    { ...opening, [requirement.id]: limit(requirement.id) },
    [theirs.id, timing.id],
    limit,
    ACCEPTANCE.T_MID,
  );

  return { opening, counterpackage, tentative: counterpackage };
}

/**
 * Gives ground on `spendable` until the offer is good enough for the other
 * side, then stops.
 *
 * TWO STOP CONDITIONS, and both matter:
 *
 *  - `enoughForCounterpart` — once the package clears the counterpart's
 *    acceptance threshold, further concessions buy nothing. This is what makes
 *    the proxy a negotiator rather than a capitulator.
 *  - the principal's own fallback — no mandate field says "and don't accept
 *    less than walking away" because it does not need to: refusing an
 *    agreement worth less than no agreement is not a preference, it is what
 *    the fallback means.
 *
 * Terms are spent in order of what they cost the principal per point the
 * counterpart gains — cheapest first, which is the logroll. Spending in that
 * order is why the requirement survives: the cheap terms are enough.
 */
function spendDownTo(
  task: NegotiationTask,
  principal: Role,
  from: Package,
  spendable: string[],
  limit: (issueId: string) => string,
  enoughForCounterpart?: number,
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

  const goodEnough = () =>
    enoughForCounterpart !== undefined &&
    scorePackage(task, pkg, counterpart) >= enoughForCounterpart;

  for (const issueId of byCheapness) {
    if (goodEnough()) break;

    const issue = task.issues.find((i) => i.id === issueId)!;
    const target = limit(issueId);
    const order = [...issue.options].sort(
      (a, b) => b.points[principal] - a.points[principal],
    );
    const stop = order.findIndex((o) => o.id === target);
    const start = order.findIndex((o) => o.id === pkg[issueId]);

    for (let at = start + 1; at <= stop; at += 1) {
      const next = { ...pkg, [issueId]: order[at].id };
      if (scorePackage(task, next, principal) < task.reservationPoints) break;
      pkg[issueId] = order[at].id;
      if (goodEnough()) break;
    }
  }

  return pkg;
}

function bestFor(task: NegotiationTask, issueId: string, role: Role): string {
  const issue = task.issues.find((i) => i.id === issueId)!;
  return [...issue.options].sort((a, b) => b.points[role] - a.points[role])[0]
    .id;
}

/** The option this role likes least — everything on the table to give away. */
function worstFor(task: NegotiationTask, issueId: string, role: Role): string {
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
  /** Is the participant's own requirement threshold in the final package? */
  requirementPreserved: boolean;
  /** Is the counterpart's requirement threshold in it? */
  counterRequirementPreserved: boolean;
  /** Where the participant's requirement landed, as an option index (0-based). */
  requirementOptionIndex: number;
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
  const requirement = requirementIssue(task, participantRole);
  const theirs = counterRequirementIssue(task, participantRole);

  // No agreement: both sides take the fallback. `clearsReservation` is false
  // rather than true — the participant did not clear their fallback, they
  // *received* it, and reading "above your fallback" on an impasse screen
  // would tell them the opposite of what happened.
  if (!finalPackage) {
    return {
      agreed: false,
      requirementPreserved: false,
      counterRequirementPreserved: false,
      requirementOptionIndex: -1,
      participantPoints: task.reservationPoints,
      counterpartPoints: task.reservationPoints,
      jointPoints: task.reservationPoints * 2,
      clearsReservation: false,
    };
  }

  const participantPoints = scorePackage(task, finalPackage, participantRole);
  const counterpartPoints = scorePackage(task, finalPackage, counterpartRole);
  const index = optionIndex(
    task,
    requirement.id,
    finalPackage[requirement.id] ?? null,
  );

  return {
    agreed,
    requirementPreserved: preservesRequirement(
      task,
      participantRole,
      finalPackage[requirement.id] ?? null,
    ),
    counterRequirementPreserved: preservesRequirement(
      task,
      counterpartRole,
      finalPackage[theirs.id] ?? null,
    ),
    requirementOptionIndex: index,
    participantPoints,
    counterpartPoints,
    jointPoints: participantPoints + counterpartPoints,
    clearsReservation: participantPoints >= task.reservationPoints,
  };
}
