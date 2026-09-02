/**
 * The negotiation state machine (Experimental Design Ver.2.12 §6).
 *
 * WHAT THIS OWNS, AND WHY IT MATTERS. The model decides nothing here. This
 * file decides WHAT happens — offer levels, concessions, acceptance,
 * termination — and the model only decides HOW it is said. Two participants
 * who behave identically get identical outcomes, which is what makes a
 * condition contrast interpretable when every primary outcome is a function
 * of behaviour.
 *
 * THE CREDIBILITY LADDER IS THE WHOLE ACCEPTANCE RULE (§3.3, §6.2). How far
 * the counterpart concedes on the participant's core issue is set by the best
 * reason the participant side has VOICED — nothing (cheap talk) → third
 * option, work reason → second option, sensitive background (a costly
 * confession) → best option — while the counterpart's own core issue is held
 * at its best option on every agreement path. The tier is decided from the
 * structured card log, never by asking a model to grade an argument, and it
 * is why negotiation skill cannot move the outcome: once the SB is voiced,
 * the counterpart will propose the best↔best package itself
 * (SCRIPT-PROPOSE-MAX) rather than leave the maximum to be discovered.
 *
 * The counterpart's six stages run once each, in order, one move per reply.
 * The participant writes freely inside the clock; the counterpart cannot skip
 * ahead, repeat itself, or accept before it has disclosed its own SB.
 */

import {
  counterpartOpening,
  counterRequirementIssue,
  optionIndex,
  preservesRequirement,
  rankedOptions,
  requirementIssue,
  scorePackage,
} from "../tasks";
import type {
  NegotiationTask,
  Package,
  ReasonCard,
  Role,
  StageId,
} from "../types";

// ---------------------------------------------------------------------------
// The credibility ladder
// ---------------------------------------------------------------------------

/** The three rungs, named after what was voiced (Ver.2.12 §3.3). */
export type ReasonTier = "none" | "work" | "sensitive";

/**
 * How deep into the participant's core issue the counterpart will concede,
 * as an index into that issue's options ranked best-first FOR THE PARTICIPANT.
 * 0 = the participant's best option; a package asking a rank BELOW the limit
 * is asking for more credibility than has been earned.
 */
export const TIER_LIMIT_INDEX: Record<ReasonTier, number> = {
  none: 2,
  work: 1,
  sensitive: 0,
};

/**
 * The higher of two tiers.
 *
 * The Proxy closing needs it: the ladder carries over from what the proxy
 * voiced and can only RISE when the participant tags a card in person. It is
 * one function because the same fold is read twice per turn — once for what
 * the counterpart sees, once for what `settle()` logs as an analysis variable
 * — and two hand-written ternaries would eventually disagree.
 */
export function foldTier(a: ReasonTier, b: ReasonTier): ReasonTier {
  if (a === "sensitive" || b === "sensitive") return "sensitive";
  if (a === "work" || b === "work") return "work";
  return "none";
}

/** The tier the voiced cards have earned. Reads layers, never text. */
export function tierOf(
  voiced: ReadonlyArray<Pick<ReasonCard, "layer">>,
): ReasonTier {
  if (voiced.some((c) => c.layer === "sensitive")) return "sensitive";
  if (voiced.some((c) => c.layer === "work")) return "work";
  return "none";
}

/**
 * The package the counterpart is willing to settle at under a tier: the
 * participant's core at the tier limit, the counterpart's core at its best.
 * This is its standing proposal from the trade stage on, and the package
 * SCRIPT-FAIR / SCRIPT-LIMIT names as the alternative.
 */
export function tierPackage(
  task: NegotiationTask,
  participantRole: Role,
  tier: ReasonTier,
): Package {
  const counterpartRole: Role =
    participantRole === "leader" ? "member" : "leader";
  const req = requirementIssue(task, participantRole);
  const theirs = counterRequirementIssue(task, participantRole);
  return {
    [req.id]: rankedOptions(task, req.id, participantRole)[
      TIER_LIMIT_INDEX[tier]
    ].id,
    [theirs.id]: rankedOptions(task, theirs.id, counterpartRole)[0].id,
  };
}

/** Best↔best — the full logroll, joint 6,000. The SB rung's package. */
export function maxPackage(
  task: NegotiationTask,
  participantRole: Role,
): Package {
  return tierPackage(task, participantRole, "sensitive");
}

/**
 * The acceptance judgement (Ver.2.12 §6.2):
 *   accept(package) iff the participant's core option is within the tier limit
 *   AND the counterpart's core option is the counterpart's best.
 */
export function acceptablePackage(
  task: NegotiationTask,
  participantRole: Role,
  pkg: Package | null | undefined,
  tier: ReasonTier,
): boolean {
  if (!pkg) return false;
  const counterpartRole: Role =
    participantRole === "leader" ? "member" : "leader";
  const req = requirementIssue(task, participantRole);
  const theirs = counterRequirementIssue(task, participantRole);
  const reqRank = rankedOptions(task, req.id, participantRole).findIndex(
    (o) => o.id === pkg[req.id],
  );
  if (reqRank < 0) return false;
  if (reqRank < TIER_LIMIT_INDEX[tier]) return false;
  return (
    pkg[theirs.id] === rankedOptions(task, theirs.id, counterpartRole)[0].id
  );
}

// ---------------------------------------------------------------------------
// Clocks
// ---------------------------------------------------------------------------

/** The Baseline negotiation clock (Design §2.3: 직접 협상 10분). */
export const NEGOTIATION_SECONDS = 10 * 60;

/** The Proxy arm's direct closing clock (Design §7: 직접 마무리 3분). */
export const CLOSING_SECONDS = 3 * 60;

/** Below this, the counterpart offers SCRIPT-CLOSE once. */
export const SOFT_CLOSE_SECONDS = 60;

// ---------------------------------------------------------------------------
// The participant's rule about numbers
// ---------------------------------------------------------------------------

/**
 * Does a participant message talk about the private score sheet? (§8.1: the
 * numbers may never be told to the other side; §6.2: first mention gets
 * SCRIPT-NONUM once, later mentions are ignored.)
 *
 * Deliberately coarse: shift counts are 1–4, so any 3+ digit number, or the
 * words "points"/"score", is score talk and nothing legitimate is. A lexical
 * screen is the right tool because the reminder is cheap and one-shot.
 */
export function mentionsScoreNumbers(text: string): boolean {
  return /\b\d{3,}\b/.test(text) || /\b(?:points?|score(?:s|board|sheet)?)\b/i.test(text);
}

// ---------------------------------------------------------------------------
// Counterpart behaviour
// ---------------------------------------------------------------------------

/**
 * Every move the counterpart is allowed to make, named. The name goes into
 * the transcript beside the rendered sentence (Design §6.7), so an audit can
 * check the wording against the decision without re-reading the rules.
 *
 * The SCRIPT-* fixed lines of §6.4 map onto these:
 *   ask_why → SCRIPT-ASKWHY · accept_sb → SCRIPT-ACCEPT-SB ·
 *   propose_max → SCRIPT-PROPOSE-MAX · counter_tier → SCRIPT-FAIR/LIMIT ·
 *   nonum → SCRIPT-NONUM · soft_close → SCRIPT-CLOSE ·
 *   impasse → SCRIPT-FALLBACK.
 */
export type DecidedAction =
  | "open"
  | "state_priority"
  | "disclose_sb"
  | "ask_why"
  | "counter_tier"
  | "accept"
  | "accept_sb"
  | "propose_max"
  | "nonum"
  | "soft_close"
  | "impasse";

export interface CounterpartDecision {
  stage: StageId;
  action: DecidedAction;
  /** The package the counterpart puts forward or accepts, if any. */
  proposal: Package | null;
  /** Does it accept what is on the table? */
  accepts: boolean;
  /** Set when the exchange ends without agreement. */
  impasse: boolean;
}

/**
 * State the counterpart reads, beyond the incoming package.
 *
 * `tier` is decided by the SYSTEM from the structured card log — which cards
 * were voiced, by the participant or their proxy — never by the model reading
 * the text (Design §6.2: LLM 비관여).
 */
export interface ExchangeState {
  tier: ReasonTier;
  /** SCRIPT-ASKWHY has been spent (it is asked once, §6.2). */
  askedWhy: boolean;
  /** SCRIPT-NONUM has been spent (once, then mentions are ignored). */
  numbersReminded: boolean;
  /** Did the participant's LAST message mention score numbers? */
  numbersMentionedNow?: boolean;
  secondsRemaining?: number;
  /** SCRIPT-CLOSE has been offered already. */
  softCloseOffered?: boolean;
}

/**
 * The counterpart's next move (Ver.2.12 §6.1–6.3).
 *
 * `stage` is the counterpart's own position in ITS script. It advances one
 * step per reply — opening, its work reason plus the priority question, its
 * fixed SB disclosure, then the trade loop — so every participant meets the
 * same sequence however many messages they spend in between.
 *
 * THE SB DISCLOSURE IS UNCONDITIONAL. The counterpart voices its designated
 * SB card once, at stage 4, for every participant — never mirrored to what
 * the participant disclosed, never skipped (§6.3: the participant's choice
 * must not change what they receive). The system records PRE-RECIP-SB from
 * the message order, not here.
 *
 * FROM THE TRADE STAGE ON, every turn is the same judgement: the tier decides
 * the limit, the limit decides the standing proposal, and the standing
 * proposal only improves when the tier does. Once the SB tier is open the
 * counterpart proposes best↔best ITSELF if the participant has not — §3.3
 * makes SB voicing the only bottleneck to the maximum, so negotiation skill
 * cannot be what separates outcomes.
 */
export function counterpartStep(
  task: NegotiationTask,
  counterpartRole: Role,
  stage: StageId,
  incoming: Package | null,
  state: ExchangeState,
): CounterpartDecision {
  const participantRole: Role =
    counterpartRole === "leader" ? "member" : "leader";

  const base = { stage, impasse: false };

  switch (stage) {
    case 1:
      return {
        ...base,
        action: "open",
        proposal: counterpartOpening(task, counterpartRole),
        accepts: false,
      };

    case 2:
      // Its own work reason, and the question that opens the participant's
      // first reason opportunity. Position unchanged.
      return { ...base, action: "state_priority", proposal: null, accepts: false };

    case 3:
      // The lock is a recording moment, not a message; the stage walk never
      // serves it. Falling through to the disclosure keeps a miscounted caller
      // harmless.
      return { ...base, stage: 4, action: "disclose_sb", proposal: null, accepts: false };

    case 4:
      return { ...base, action: "disclose_sb", proposal: null, accepts: false };

    default: {
      // Stages 5–6: the trade loop.
      const expired =
        state.secondsRemaining !== undefined && state.secondsRemaining <= 0;
      if (expired) {
        return {
          ...base,
          stage: 6,
          action: "impasse",
          proposal: null,
          accepts: false,
          impasse: true,
        };
      }

      // The one-shot no-numbers reminder outranks everything except the end
      // of the clock: it answers the message that just arrived.
      if (state.numbersMentionedNow && !state.numbersReminded) {
        return { ...base, action: "nonum", proposal: null, accepts: false };
      }

      const acceptable = acceptablePackage(
        task,
        participantRole,
        incoming,
        state.tier,
      );
      const best = maxPackage(task, participantRole);
      const standing = tierPackage(task, participantRole, state.tier);

      // ANYTHING WITHIN TIER IS ACCEPTED, AT EVERY TIER, and the SB rung is
      // not an exception. An earlier version refused a within-tier package
      // under `sensitive` unless it was exactly best↔best — so a participant
      // who had paid the full face cost and then asked for LESS than they had
      // earned was turned down, on a package strictly better for the
      // counterpart. §3.3 opens the best option to them; it does not oblige
      // them to take it.
      if (acceptable) {
        return {
          ...base,
          stage: 6,
          action: state.tier === "sensitive" ? "accept_sb" : "accept",
          proposal: incoming,
          accepts: true,
        };
      }

      // THE CLOCK OUTRANKS THE LADDER'S UPGRADE OFFER. This check sits ahead
      // of `propose_max` deliberately: at the sensitive tier the counterpart
      // would otherwise re-propose the maximum on every remaining turn and
      // never offer to settle, so a maximum-disclosure participant who kept
      // asking for something out of tier could run the clock out and score the
      // 600 fallback — below the 1,000 a participant who said nothing gets.
      // That inverts the ladder for the people who paid the most, which is the
      // one thing the outcome table cannot do.
      if (
        state.secondsRemaining !== undefined &&
        state.secondsRemaining <= SOFT_CLOSE_SECONDS &&
        !state.softCloseOffered
      ) {
        return {
          ...base,
          stage: 6,
          action: "soft_close",
          // At the SB rung the thing to settle on is the maximum they earned.
          proposal: state.tier === "sensitive" ? best : standing,
          accepts: false,
        };
      }

      if (state.tier === "sensitive") {
        // §3.3: once the SB is voiced the maximum is not left to be found. An
        // out-of-tier ask is answered by proposing best↔best directly
        // (SCRIPT-PROPOSE-MAX) rather than by a bare refusal.
        return {
          ...base,
          action: "propose_max",
          proposal: best,
          accepts: false,
        };
      }

      // A reason-free over-ask gets one "why does that matter?" before the
      // tier is enforced (§6.2: 이유 요청 1회). Judgement deferred one turn.
      if (state.tier === "none" && !state.askedWhy) {
        return { ...base, action: "ask_why", proposal: null, accepts: false };
      }

      // Otherwise the tier speaks: reject the over-ask and put the standing
      // tier package forward (SCRIPT-FAIR / SCRIPT-LIMIT).
      return {
        ...base,
        action: "counter_tier",
        proposal: standing,
        accepts: false,
      };
    }
  }
}

/**
 * The counterpart's script position after it has spoken `repliesMade` times
 * (the seeded opening counts as one).
 *
 * 1 → 2 → 4 → 5, then 5 forever: stage 3 is the lock and is never served, and
 * from the trade stage on every turn is the same judgement. Stage 6 is not a
 * position in the walk — it is stamped by `counterpartStep` on the closing
 * actions (accept, soft_close, impasse).
 */
export function counterpartStageAfter(repliesMade: number): StageId {
  return ([1, 2, 4][repliesMade] ?? 5) as StageId;
}

/**
 * How many script positions the counterpart has already spent when the direct
 * closing of a Proxy task starts: through its own proxy it has opened, given
 * its work reason, and disclosed its SB — so its first direct reply is the
 * trade loop, never a re-run of the disclosure the participant just watched.
 */
export const DIRECT_STAGE_OFFSET = 3;

// ---------------------------------------------------------------------------
// Proxy behaviour (Design §6.5)
// ---------------------------------------------------------------------------

export interface ProxyPlan {
  /** What the participant's proxy opens with — the mandate's preferred levels. */
  opening: Package;
  /**
   * The conditional trade it proposes at stage 5: the counterpart's core at
   * their best, its own principal's core at the preferred level. Whether the
   * counterpart accepts is the tier's decision, not this plan's.
   */
  tradeProposal: Package;
  /** The tier the AUTHORIZED cards will earn once voiced on schedule. */
  tier: ReasonTier;
  /**
   * Where the AI-AI exchange settles: the tier package, unless the mandate's
   * minimum forbids it — then null, and the principals settle directly.
   */
  tentative: Package | null;
}

/**
 * Does a package respect the principal's own floor on their core issue?
 *
 * ONE DEFINITION, because both the plan builder and the proxy route's closing
 * turn ask it, and a mandate-floor check that drifted between them would
 * disagree about whether the proxies may settle — on the primary outcome,
 * in one arm only.
 */
export function withinMandate(
  task: NegotiationTask,
  participantRole: Role,
  minimumOptionId: string | null | undefined,
  pkg: Package,
): boolean {
  if (!minimumOptionId) return true;
  const req = requirementIssue(task, participantRole);
  const ranked = rankedOptions(task, req.id, participantRole);
  const minRank = ranked.findIndex((o) => o.id === minimumOptionId);
  const atRank = ranked.findIndex((o) => o.id === pkg[req.id]);
  if (minRank < 0 || atRank < 0) return true;
  return atRank <= minRank;
}

/**
 * Turns a mandate into the proxy's plan.
 *
 * BOTH POLICIES COMPUTE THIS IDENTICALLY. Design §2.3 defines Delegate and
 * Explorer as differing in REASON USE POLICY, not in what they will trade; a
 * policy that reached further would confound `Explorer − Delegate` with
 * concession reach.
 *
 * The plan is short because the ladder did the work the old spend-down loop
 * used to do: the settle point is a function of the tier, the tier is a
 * function of which cards are authorized (the schedule guarantees an
 * authorized card on the core issue is actually voiced — §6.5), and the only
 * mandate check left is whether the tier package clears the principal's own
 * minimum.
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
    authorizedReasonIds: readonly string[];
  },
): ProxyPlan {
  const req = requirementIssue(task, participantRole);
  const theirs = counterRequirementIssue(task, participantRole);
  const counterpartRole: Role =
    participantRole === "leader" ? "member" : "leader";

  const authorized = task.roleBriefs[participantRole].reasonCards.filter((c) =>
    mandate.authorizedReasonIds.includes(c.id),
  );
  const tier = tierOf(authorized);

  const ranked = rankedOptions(task, req.id, participantRole);
  const forIssue = (issueId: string) =>
    mandate.issues.find((i) => i.issueId === issueId);

  const preferred =
    forIssue(req.id)?.preferredOptionId ?? ranked[0].id;

  const opening: Package = Object.fromEntries(
    task.issues.map((i) => [
      i.id,
      forIssue(i.id)?.preferredOptionId ??
        rankedOptions(task, i.id, participantRole)[0].id,
    ]),
  );

  // The trade: hand the counterpart their core outright, ask for the
  // mandate's own goal. Giving the other side what they actually want is the
  // logroll, and it is the only currency there is.
  const tradeProposal: Package = {
    [req.id]: preferred,
    [theirs.id]: rankedOptions(task, theirs.id, counterpartRole)[0].id,
  };

  // Where the ladder says this exchange settles, unless the principal's own
  // minimum forbids taking it.
  const settle = tierPackage(task, participantRole, tier);
  const allowed = withinMandate(
    task,
    participantRole,
    forIssue(req.id)?.minimumOptionId,
    settle,
  );

  return {
    opening,
    tradeProposal,
    tier,
    tentative: allowed ? settle : null,
  };
}

/**
 * Which authorized card the participant's proxy voices at a given stage
 * (Ver.2.12 §6.5).
 *
 * THE SCHEDULE, NOT THE MODEL, DECIDES. If the principal checked the SB, the
 * proxy voices it at its FIRST reason opportunity — stage 2 — because
 * PRE-RECIP-SB (the confirmatory disclosure outcome) is "was the participant
 * side's SB out before the counterpart's SB", and the counterpart's SB lands
 * at stage 4. A schedule that held the SB back past stage 4 would record
 * every Proxy participant as non-reciprocal disclosure regardless of what
 * they authorized. If only the WR is checked, the WR is voiced there instead;
 * each card at most once per task, one reason per message.
 *
 * "Each card at most once" is THIS function's job: it never designates a card
 * in `alreadyVoiced`. Making repetition a validator violation instead would
 * strip the whole message to the package-only fallback and null its reason
 * token — a false "no reason was given" on the primary outcome.
 */
export function designatedReason(
  task: NegotiationTask,
  participantRole: Role,
  stage: StageId,
  authorizedReasonIds: readonly string[],
  alreadyVoiced: readonly string[] = [],
): ReasonCard | null {
  const req = requirementIssue(task, participantRole);
  const cards = task.roleBriefs[participantRole].reasonCards.filter(
    (c) =>
      c.issueId === req.id &&
      authorizedReasonIds.includes(c.id) &&
      !alreadyVoiced.includes(c.id),
  );
  if (stage < 2) return null;
  // The costliest authorized card leads; the WR follows on a later turn if
  // another reason moment arrives.
  return (
    cards.find((c) => c.layer === "sensitive") ??
    cards.find((c) => c.layer === "work") ??
    null
  );
}

// ---------------------------------------------------------------------------
// Outcome coding (Ver.2.12 §3.4)
// ---------------------------------------------------------------------------

export interface OutcomeCoding {
  agreed: boolean;
  /** UNLOCK: did the participant's core issue land on their best option? */
  unlocked: boolean;
  /** CONCEAL-PREMIUM: 3,000 − points earned on the own core issue. */
  concealPremium: number;
  /** Is the participant's requirement threshold (options 1–2) held? */
  requirementPreserved: boolean;
  /** Where the participant's core landed, as an option index (0-based). */
  requirementOptionIndex: number;
  participantPoints: number;
  counterpartPoints: number;
  /** JOINT: the two sides' points added. */
  jointPoints: number;
  /** MAX-JOINT: did the pair reach the global maximum, 6,000? */
  maxJoint: boolean;
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
  const req = requirementIssue(task, participantRole);

  // No agreement: both sides take the fallback. `clearsReservation` is false
  // rather than true — the participant did not clear their fallback, they
  // *received* it.
  if (!finalPackage || !agreed) {
    return {
      agreed: false,
      unlocked: false,
      concealPremium: 3000,
      requirementPreserved: false,
      requirementOptionIndex: -1,
      participantPoints: task.reservationPoints,
      counterpartPoints: task.reservationPoints,
      jointPoints: task.reservationPoints * 2,
      maxJoint: false,
      clearsReservation: false,
    };
  }

  const participantPoints = scorePackage(task, finalPackage, participantRole);
  const counterpartPoints = scorePackage(task, finalPackage, counterpartRole);
  const corePoints = (() => {
    const option = req.options.find((o) => o.id === finalPackage[req.id]);
    return option ? option.points[participantRole] : 0;
  })();
  const joint = participantPoints + counterpartPoints;

  return {
    agreed: true,
    unlocked:
      finalPackage[req.id] ===
      rankedOptions(task, req.id, participantRole)[0].id,
    concealPremium: 3000 - corePoints,
    requirementPreserved: preservesRequirement(
      task,
      participantRole,
      finalPackage[req.id] ?? null,
    ),
    requirementOptionIndex: optionIndex(
      task,
      req.id,
      finalPackage[req.id] ?? null,
    ),
    participantPoints,
    counterpartPoints,
    jointPoints: joint,
    maxJoint: joint === 6000,
    clearsReservation: participantPoints >= task.reservationPoints,
  };
}
