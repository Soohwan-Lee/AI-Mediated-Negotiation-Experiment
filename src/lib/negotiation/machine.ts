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
 * The counterpart's five stages run once each, in order, one move per reply.
 * The participant is not on that leash — they write freely inside the ten
 * minutes — but the counterpart cannot skip ahead, repeat itself, or accept
 * before it has issued the standardized challenge.
 */

import {
  counterpartOpening,
  requirementIssue,
  counterRequirementIssue,
  optionIndex,
  preservesRequirement,
  reasonCards,
  scorePackage,
} from "../tasks";
import type {
  NegotiationTask,
  Package,
  ReasonCard,
  Role,
  StageId,
} from "../types";

/**
 * Counterpart acceptance thresholds (Design §4 "이유 연동 수락 규칙").
 *
 * Working values, to be fixed after the pilot against a target impasse rate
 * below 10% (Ver.2.11 §13.2 lists them as pilot-dependent). T_MID is set so
 * that a full logroll — giving the counterpart its own priority issue at
 * Option 1 while holding your requirement at Option 1 — is exactly accepted:
 * protecting your requirement while giving away what they actually want is
 * structurally rewarded.
 *
 * THESE SCALE WITH THE PAYOFF TABLE AND MUST BE RECHECKED WHENEVER IT MOVES.
 * They were 3,600 / 2,600 for the three-issue task, whose individual maximum
 * was 6,300. Ver.2.11's two-issue task tops out at 3,000 on any package the
 * counterpart will agree to, so the old T_MID was above everything reachable
 * and NOTHING could be accepted — every cell ran to impasse while each
 * component still looked correct in isolation. A threshold is only meaningful
 * relative to the scale it is measured on.
 *
 * T_FINAL sits below T_MID so a late concession can still close, which is the
 * lever on the impasse rate. It is held at the same fraction of T_MID as
 * before (roughly 0.72), which puts it one option-step down on the
 * counterpart's own priority issue.
 */
export const ACCEPTANCE = {
  /** Stage 4, the conditional trade. The full logroll, exactly. */
  T_MID: 3000,
  /** Stage 5, the closing threshold. */
  T_FINAL: 2000,
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
  | "concede_trade"
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

  const requirement = requirementIssue(task, participantRole);

  /** Is the participant asking for something they have not justified? */
  const unexplainedAsk =
    !state.reasonGivenForRequirement &&
    asksForRequirementConcession(task, participantRole, incoming, held);

  /**
   * The same package with the participant's requirement pulled back to the
   * level an unargued requirement earns.
   *
   * NOT the counterpart's own opening. `held` starts at the counterpart's best
   * package and only moves as it concedes, and with the timing term gone there
   * is nothing else for it to spend first — so holding at `held` left the
   * participant on 0, below their own 600 fallback, and a rational participant
   * would walk. That turns a WITHHELD CONCESSION into a punishment worse than
   * impasse, which is not what Design §4 asks for: the concession is withheld,
   * the agreement is not.
   *
   * Ver.2.11 §3.3 names the level directly. Without a reason the counterpart
   * comes to the THIRD option on the participant's requirement issue, which
   * pays the participant 1,000 against the 3,000 a reason earns — a real
   * agreement, clearly worse, and clearly better than no deal. (§3.3's middle
   * rung, the second option for a work reason, arrives with the tier ladder;
   * this keeps the two ends correct in the meantime.)
   */
  const unarguedLevel = (() => {
    const ranked = [...requirement.options].sort(
      (a, b) => b.points[participantRole] - a.points[participantRole],
    );
    return ranked[Math.min(2, ranked.length - 1)].id;
  })();
  const withHeldRequirement = {
    ...(incoming ?? held),
    [requirement.id]: unarguedLevel,
  };

  // "Late" means the clock is running out, in both arms. When no clock is
  // supplied — the mockup path, and any caller that does not track it — the
  // counterpart never treats the exchange as late, so it holds out for T_MID.
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
      // THE THRESHOLD RELAXES ON THE CLOCK, NOT ON THE TURN COUNT. T_FINAL is
      // the late-concession threshold, and "late" has to mean the same thing
      // in both arms. Tying it to the script position instead made the Proxy
      // arm relax after one direct message and Baseline after four, because
      // the Proxy counterpart resumes mid-script — so identical packages were
      // acceptable at different points depending on condition, which is a
      // mechanical difference along the primary contrast rather than the
      // manipulation.
      const threshold = softClose ? ACCEPTANCE.T_FINAL : ACCEPTANCE.T_MID;

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

      // THE REASON RULE OUTRANKS THE TRADE. With two issues the only thing the
      // counterpart can spend IS the participant's requirement issue, so an
      // ungated trade would hand over exactly the concession Design §4 says is
      // withheld until a reason is given — and the participant would get it by
      // waiting rather than by arguing. When the ask is still unexplained, hold
      // the position instead: a deal stays reachable at the held package, it
      // just is not one that gives the requirement away.
      if (unexplainedAsk) {
        return {
          ...base,
          action: "hold" as const,
          proposal: withHeldRequirement,
          accepts: false,
        };
      }

      // Otherwise trade: give a step on the PARTICIPANT'S priority issue.
      //
      // With two integrative issues that is the only currency there is, and it
      // is the logroll itself: the counterpart's own priority issue is the one
      // it is holding, so the only thing it can spend is the term the
      // participant cares about and it does not. Ver.2.11 §3.3 makes this the
      // mechanism rather than a fallback — the timing issue that used to be
      // spent here was constant-sum, so every point conceded was exactly one
      // point gained and it closed no gap the integrative terms could not close
      // more cheaply.
      return {
        ...base,
        action: "concede_trade" as const,
        proposal: {
          ...held,
          [requirement.id]: concede(
            task,
            requirement.id,
            held[requirement.id],
            counterpartRole,
          ),
        },
        accepts: false,
      };
    }
  }
}

/**
 * How far the counterpart's script has advanced after `replies` replies.
 *
 * It walks 1 → 2 → 3 → 4 and then stays at 4, because from the trade onward
 * every turn is the same decision. Clamping rather than ending is what lets a
 * participant keep talking after the counterpart has made its trade.
 *
 * Stage 5 is no longer a position the walk reaches: what used to distinguish
 * it — the relaxed threshold — is now decided by the clock, so that both arms
 * relax at the same moment rather than after a different number of messages.
 */
export function counterpartStageAfter(replies: number): StageId {
  return Math.min(replies + 1, 4) as StageId;
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
 * Which authorized card the proxy voices at a given stage (Design §7 ver.2.6
 * "발화 이유 선택 규칙").
 *
 * WHY THIS IS NOT THE MODEL'S CHOICE ANY MORE. Until ver.2.6 the instruction
 * read "state your priority, with one authorized reason" and the model picked
 * which. That broke the measure in a way nothing in the transcript showed: the
 * work reasons arrive ticked by default, so a model asked to choose almost
 * always chose one, and the OLD cap — at most one reason kind per issue for
 * the whole task — then made that first pick permanent. A participant who
 * deliberately ticked a sensitive background on their requirement issue got a
 * proxy that never said it. REASON-SCOPE recorded a disclosure the negotiation
 * never contained, and the whole point of the mandate screen is that ticking a
 * sensitive card IS the disclosure decision.
 *
 * So the schedule is fixed here, and it escalates — the general argument
 * first, the costly one after the challenge:
 *
 *  - stage 2, own requirement issue: the WR (the SB only if the WR is
 *    unticked, since something must be said).
 *  - stage 4, after the challenge: the SB if it is ticked, otherwise the WR
 *    again in different words.
 *  - any other issue, when it is used as grounds for a trade: that issue's SB
 *    if ticked, otherwise its WR.
 *
 * This mirrors the counterpart's own script, so both sides escalate at the
 * same point and the two arms stay comparable.
 *
 * A ticked card on the requirement issue is therefore GUARANTEED to be voiced.
 * Cards on the other two issues are voiced only when that issue carries a
 * trade, which is why the log of what was actually said is reported separately
 * from what was authorized.
 *
 * "EACH CARD AT MOST ONCE" IS THIS FUNCTION'S JOB, NOT THE VALIDATOR'S. The
 * cap is expressed by never designating a card that has already been voiced —
 * pass `alreadyVoiced` and it falls through to the other layer, or to nothing.
 * Making it a validator rejection instead would be actively harmful: a budget
 * violation is a hard code, so the whole message would be replaced by the
 * package-only fallback and its reason token nulled. On the turn that carried
 * the requirement's reason that sets `reasonAlreadyVoiced` false for the
 * direct conversation, and the counterpart then demands a reason for a
 * requirement its own proxy has already argued — the exact inert-rule bug
 * CLAUDE.md records as fixed once already. A schedule that simply does not
 * repeat itself needs no punishment for repeating itself.
 */
export function designatedReason(
  task: NegotiationTask,
  participantRole: Role,
  stage: StageId,
  authorizedReasonIds: readonly string[],
  options: { issueId?: string; alreadyVoiced?: readonly string[] } = {},
): ReasonCard | null {
  const { issueId, alreadyVoiced = [] } = options;
  const requirement = requirementIssue(task, participantRole);
  const target = issueId ?? requirement.id;
  const cards = reasonCards(task, participantRole).filter(
    (c) =>
      c.issueId === target &&
      authorizedReasonIds.includes(c.id) &&
      !alreadyVoiced.includes(c.id),
  );
  const work = cards.find((c) => c.layer === "work") ?? null;
  const sensitive = cards.find((c) => c.layer === "sensitive") ?? null;

  // Stage 2 opens with the general argument; the sensitive one is held back
  // unless it is the only thing authorized on this issue.
  //
  // A GUARDRAIL-BLOCKED STAGE 2 COSTS THE WORK REASON PERMANENTLY. A blocked
  // turn returns no token, so `alreadyVoiced` stays empty — but stage 4 asks
  // for `sensitive ?? work` and takes the sensitive card, never falling back.
  // That is the right way round: the disclosure being measured is never
  // starved, and only the general argument is lost. Do not read the
  // `alreadyVoiced` parameter as making the schedule self-healing.
  if (stage <= 2 && target === requirement.id) return work ?? sensitive;

  // From the challenge onward the costly reason is spent, on any issue.
  return sensitive ?? work;
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
  // principal's fallback, which handed away the other term as well as the
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
  // The requirement is therefore the LAST currency. With two issues that means
  // the proxy offers the counterpart's own priority term first, and only
  // touches the requirement if that was not enough — which on the standard
  // mandate is never, because handing the other side their priority outright is
  // already worth T_MID to them.
  const spentOthers = spendDownTo(
    task,
    participantRole,
    opening,
    [theirs.id],
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
          [requirement.id, theirs.id],
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
