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

/**
 * The five stages still exist as the counterpart's SCRIPT, but they are no
 * longer a lockstep the participant is marched through.
 *
 * WHAT CHANGED AND WHY. Both conditions used to run exactly ten messages, one
 * per side per stage, with the participant's composer gated to one turn at a
 * time. That made transcripts trivially comparable and made the negotiation
 * feel like a form. The design's actual constraint is a ten-minute timer
 * (§8): finish early and that is fine.
 *
 * So the participant now writes freely, and the counterpart advances its own
 * script one move per reply. The control that matters is unchanged — every
 * participant still meets the same fixed opening, the same standardized
 * challenge, and the same acceptance thresholds, in the same order. What is no
 * longer fixed is how many messages the participant spends getting there,
 * which was never the manipulation.
 */
export const STAGES: readonly StageId[] = [1, 2, 3, 4, 5];

/**
 * How long a negotiation runs (Design §8: "10분 타이머").
 *
 * The timer is the only length constraint. When it runs low the counterpart
 * offers to settle on what is already on the table (§4 "Soft close"); an
 * impasse remains a legitimate ending, and so does finishing in three minutes.
 */

// ---------------------------------------------------------------------------
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
 * State the counterpart reads, beyond the package itself.
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
  /**
   * How many messages the participant has sent.
   *
   * The counterpart uses this only to decide when it is willing to CLOSE, not
   * what it is willing to accept: a package that clears the threshold is
   * accepted whenever it arrives, so a participant who opens with a good offer
   * can finish in two messages. What the count prevents is the counterpart
   * accepting its own opening before the participant has said anything.
   */
  participantMessageCount?: number;
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
 * The counterpart's next move (Design §4).
 *
 * `stage` is the counterpart's own position in ITS script, not a turn the
 * participant is locked into. It advances one step each time the counterpart
 * replies, so every participant meets the same sequence — fixed opening, then
 * priorities, then the standardized challenge, then a conditional trade — no
 * matter how many messages they spend in between.
 *
 * ACCEPTANCE IS NOT TIED TO THE SCRIPT. From the trade stage onward the
 * counterpart accepts any package that clears its threshold, so a participant
 * who opens well can settle in three messages and one who circles can take
 * ten. That is the free-form part; the thresholds are the controlled part.
 *
 * THE REASON REQUIREMENT applies wherever a concession is being asked for. If
 * the participant wants the counterpart to move on their requirement and has
 * never given a reason, the counterpart asks for one and defers judgement by
 * one turn — which is what keeps reasons mechanically consequential rather
 * than decorative.
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

  const timing = distributiveIssue(task);
  const requirement = requirementIssue(task, participantRole);

  /** Is the participant asking for something they have not justified? */
  const unexplainedAsk =
    !state.reasonGivenForRequirement &&
    asksForRequirementConcession(task, participantRole, incoming, held);

  /** The same package with the participant's requirement left where it is. */
  const withHeldRequirement = incoming
    ? { ...incoming, [requirement.id]: held[requirement.id] }
    : held;

  const softClose =
    state.secondsRemaining !== undefined &&
    state.secondsRemaining <= SOFT_CLOSE_SECONDS;

  switch (stage) {
    case 1:
      return { ...base, action: "open" as const, proposal: opening, accepts: false };

    case 2:
      // Explains its own priority and asks about theirs. Position unchanged.
      return {
        ...base,
        action: "state_priority" as const,
        proposal: null,
        accepts: false,
      };

    case 3:
      // The standardized challenge, and nothing else. It is a fixed stimulus,
      // so it is never bundled with a concession that would vary its strength.
      return {
        ...base,
        action: "challenge" as const,
        proposal: null,
        accepts: false,
      };

    default: {
      // Stages 4 and 5 are the same decision, taken repeatedly: evaluate what
      // is on the table, concede a step if it is not enough, and close when
      // the timer runs low. Collapsing them is what lets the exchange run to
      // whatever length the participant needs.
      //
      // The threshold relaxes once the counterpart has made its trade, which
      // is what T_FINAL is for — a late concession can still close.
      const threshold = stage >= 5 ? ACCEPTANCE.T_FINAL : ACCEPTANCE.T_MID;

      if (unexplainedAsk && !state.reasonAlreadyRequested) {
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

      if (score >= threshold && !unexplainedAsk) {
        return {
          ...base,
          action: (softClose ? "soft_close" : "accept") as DecidedAction,
          proposal: incoming,
          accepts: true,
        };
      }

      if (unexplainedAsk) {
        // The rule withholds the CONCESSION, not the agreement. If the rest of
        // the package is good enough, the counterpart takes it with the
        // requirement left where it stands — a real outcome with the
        // requirement not preserved, which is a different code from impasse.
        const heldScore = scorePackage(
          task,
          withHeldRequirement,
          counterpartRole,
        );
        if (heldScore >= threshold) {
          return {
            ...base,
            action: "hold" as const,
            proposal: withHeldRequirement,
            accepts: true,
          };
        }
      }

      // Out of time and still short: put the last position on the table and
      // let the participant decide, rather than running the clock out silently.
      if (softClose) {
        return {
          ...base,
          action: "impasse" as const,
          proposal: null,
          accepts: false,
          impasse: true,
        };
      }

      // Otherwise trade: concede a step on the distributive issue — the
      // cheapest currency it has, and the one that keeps the logroll open.
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
  }
}

/**
 * How far the counterpart's script has advanced after `replies` replies.
 *
 * It walks 1 → 2 → 3 → 4 and then stays at 5, because stages 4 and 5 are the
 * same decision taken repeatedly. Clamping rather than ending is what lets a
 * participant keep talking after the counterpart has made its trade.
 */
export function counterpartStageAfter(replies: number): StageId {
  return Math.min(replies + 1, 5) as StageId;
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
  const counterpartRole: Role =
    participantRole === "leader" ? "member" : "leader";

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

  // The counterpackage: spend the OTHER two terms first, and move the
  // requirement only if that was not enough.
  //
  // TWO THINGS HAVE TO BE TRUE HERE, and each was got wrong once.
  //
  // It must not spend the whole envelope. An early version stopped only at the
  // principal's fallback, which handed away the timing term as well as the
  // counterpart's priority issue and landed the principal a hundred points
  // above walking away, when a package worth far more was still acceptable. A
  // proxy that gives away everything it is permitted to give is not executing
  // a mandate, it is capitulating inside one — and both policies would have
  // done it equally, so the design would have measured delegation to a bad
  // negotiator rather than delegation as such.
  //
  // And it must not spend the requirement FIRST. The version after that seeded
  // the package with the requirement already at its mandated floor and then
  // excluded it from the spendable list, so the cheapest-first ordering that
  // is supposed to protect it never applied — it was gone before the
  // negotiation started. Requirement preservation is the study's primary
  // outcome and only the Proxy arm has code that can abandon it on its own, so
  // conceding it by default would put a mechanical difference straight into
  // `Pooled Proxy − Baseline`.
  //
  // The requirement is therefore the LAST currency. If the other two terms are
  // enough, it never moves at all.
  const spentOthers = spendDownTo(
    task,
    participantRole,
    opening,
    [theirs.id, timing.id],
    limit,
    ACCEPTANCE.T_MID,
  );

  const counterpackage =
    scorePackage(task, spentOthers, counterpartRole) >= ACCEPTANCE.T_MID
      ? spentOthers
      : spendDownTo(
          task,
          participantRole,
          spentOthers,
          [requirement.id, theirs.id, timing.id],
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

  const goodEnough = () =>
    enoughForCounterpart !== undefined &&
    scorePackage(task, pkg, counterpart) >= enoughForCounterpart;

  /**
   * The next single step available on an issue, and what it costs.
   *
   * Chosen STEP BY STEP rather than issue by issue. Ordering whole issues by
   * their overall cost ratio spent the distributive term to its floor once it
   * was picked, and on a constant-sum term every point the principal gives is
   * exactly one point the counterpart gains — so it is pure transfer, always
   * the worst rate available, and never the way to close a gap the integrative
   * terms could close more cheaply. Re-choosing after every step lets the
   * logroll take what it needs and stop.
   */
  const nextStep = (issueId: string) => {
    const issue = task.issues.find((i) => i.id === issueId)!;
    const order = [...issue.options].sort(
      (a, b) => b.points[principal] - a.points[principal],
    );
    const stop = order.findIndex((o) => o.id === limit(issueId));
    const at = order.findIndex((o) => o.id === pkg[issueId]);
    if (at < 0 || at >= stop) return null;

    const next = { ...pkg, [issueId]: order[at + 1].id };
    if (scorePackage(task, next, principal) < task.reservationPoints) {
      return null;
    }
    const cost =
      scorePackage(task, pkg, principal) - scorePackage(task, next, principal);
    const gain =
      scorePackage(task, next, counterpart) -
      scorePackage(task, pkg, counterpart);
    // A step that buys the counterpart nothing is never worth taking, whatever
    // it costs — that is what stopped the old loop giving away the timing term
    // for no return.
    if (gain <= 0) return null;
    return { issueId, optionId: order[at + 1].id, ratio: cost / gain };
  };

  // Take the cheapest available step, repeatedly, until the offer is good
  // enough or nothing worth spending is left.
  for (;;) {
    if (goodEnough()) break;
    const steps = spendable
      .map(nextStep)
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.ratio - b.ratio);
    if (!steps.length) break;
    pkg[steps[0].issueId] = steps[0].optionId;
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
