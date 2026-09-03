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
 * confession) → best option — and BOTH cores land on the same rank, so each
 * rung pays 1,600 / 2,300 / 3,000 to each side (Ver.2.13 §3.3). The tier is
 * decided from the structured card log, never by asking a model to grade an
 * argument, and it is why negotiation skill cannot move the outcome: the
 * counterpart proposes at its own rung (SCRIPT-PROPOSE-T{tier}) rather than
 * leaving the maximum to be discovered.
 *
 * The counterpart's six stages run once each, in order, one move per reply.
 * The participant writes freely inside the clock; the counterpart cannot skip
 * ahead, repeat itself, or accept before it has disclosed its own SB.
 */

import {
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
 * The package the counterpart settles at under a tier — SYMMETRIC (Ver.2.13
 * §3.3). Both cores land on the SAME rank: tier 1 the third option, tier 2 the
 * second, tier 3 the best. 1,600 / 2,300 / 3,000 EACH, joint 3,200 / 4,600 /
 * 6,000.
 *
 * THIS REPLACED AN ASYMMETRIC POLICY AND THE REASON MATTERS. Ver.2.12 held the
 * counterpart's own core at its best on every path and conceded only on the
 * participant's (participant 1,000/2,000/3,000 against counterpart
 * 3,600/3,300/3,000). Two things were wrong with it (§2.6). One, a counterpart
 * that opens with "my best, your worst" and never moves off its own core is
 * itself a face threat — exactly the non-negotiable, lowball offer White et al.
 * (2004) identify — so a high-FTS participant was pushed into competing by a
 * route that has nothing to do with self-disclosure. Two, a ladder where only
 * the participant loses reframes disclosure as "giving in to them" rather than
 * as buying credibility.
 *
 * Under the symmetric rule JOINT is a monotone function of the tier, so the
 * outcome measure IS the credibility ladder (which is why Ver.2.13 could drop
 * UNLOCK, CONCEAL-PREMIUM and MAX-JOINT — JOINT encodes all three), and the
 * only face threat left inside the negotiation is the participant's own
 * disclosure. "I move as far as I believe, and I ask for no more than I move."
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
  const rank = TIER_LIMIT_INDEX[tier];
  return {
    [req.id]: rankedOptions(task, req.id, participantRole)[rank].id,
    [theirs.id]: rankedOptions(task, theirs.id, counterpartRole)[rank].id,
  };
}

/** Best↔best — the full logroll, 3,000 each, joint 6,000. The SB rung. */
export function maxPackage(
  task: NegotiationTask,
  participantRole: Role,
): Package {
  return tierPackage(task, participantRole, "sensitive");
}

/**
 * The acceptance judgement (Ver.2.13 §6.2): the counterpart accepts EXACTLY
 * the symmetric package of the current tier, and nothing else.
 *
 * `accept(p) iff p == package(tier)`. Both directions are refused on purpose,
 * and the second one is the change from Ver.2.12. An over-ask is refused
 * because it asks for more credibility than has been earned. An UNDER-ask —
 * a package worse for the participant than their tier allows — is refused too
 * (SCRIPT-BALANCE), so a participant who concedes more than they had to
 * cannot drag the outcome below the rung they paid for. Ver.2.12 accepted
 * those, which let a participant's over-concession mix into the primary
 * outcome; §6.2 now closes that.
 */
export function acceptablePackage(
  task: NegotiationTask,
  participantRole: Role,
  pkg: Package | null | undefined,
  tier: ReasonTier,
): boolean {
  if (!pkg) return false;
  const target = tierPackage(task, participantRole, tier);
  return task.issues.every((issue) => pkg[issue.id] === target[issue.id]);
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
 *   open → SCRIPT-OPEN · ask_why → SCRIPT-ASKWHY ·
 *   propose_tier → SCRIPT-PROPOSE-T1/T2/T3 · balance → SCRIPT-BALANCE ·
 *   nonum → SCRIPT-NONUM · soft_close → SCRIPT-CLOSE ·
 *   impasse → SCRIPT-FALLBACK.
 *
 * Ver.2.13 consolidated the proposal scripts. SCRIPT-FAIR/LIMIT/ACCEPT-SB/
 * PROPOSE-MAX were four names for one move — "here is the package this tier
 * buys" — which under the symmetric rule differ only in the rank they name, so
 * `propose_tier` carries the tier and the renderer picks the wording. What is
 * NOT merged is `balance`: refusing a package because it is lopsided is a
 * different speech act from proposing at a rung, and it is the one the
 * participant meets after an over-ask or an over-concession.
 */
export type DecidedAction =
  | "open"
  | "state_priority"
  | "disclose_sb"
  | "ask_why"
  | "propose_tier"
  | "balance"
  | "accept"
  | "accept_sb"
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
      // SCRIPT-OPEN: its own work reason and the question that invites the
      // participant's. NO PACKAGE (Ver.2.13 §6.1). Ver.2.12 opened on the
      // counterpart's own best package — "my best, your worst" — which §2.6
      // identifies as a face threat in its own right: the non-negotiable
      // opening offer that makes a high-FTS participant competitive by a route
      // unrelated to disclosure. The first number on the table is now the
      // symmetric tier package, so every package the participant ever sees
      // moves both sides equally.
      return { ...base, action: "open", proposal: null, accepts: false };

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

      const standing = tierPackage(task, participantRole, state.tier);
      const acceptable = acceptablePackage(
        task,
        participantRole,
        incoming,
        state.tier,
      );

      // THE TIER PACKAGE, AND ONLY IT, IS ACCEPTED (Ver.2.13 §6.2). Both
      // directions are refused below: an over-ask asks for credibility not
      // earned, and an under-ask would let a participant's over-concession
      // into the outcome. The distinction the two rungs still carry is the
      // WORDING — accept_sb frames the close as an update on what was
      // disclosed — so the tier is read once here rather than in the renderer.
      if (acceptable) {
        return {
          ...base,
          stage: 6,
          action: state.tier === "sensitive" ? "accept_sb" : "accept",
          proposal: incoming,
          accepts: true,
        };
      }

      // THE CLOCK OUTRANKS THE TIER'S OWN PROPOSAL. Without this, a
      // participant who kept asking off-tier would meet the same refusal every
      // turn and run out the clock at the 600 fallback — below the 1,600 a
      // participant who said nothing gets, inverting the ladder for whoever
      // paid the most. SCRIPT-CLOSE puts the tier package up once, near the
      // end, as something to settle on.
      if (
        state.secondsRemaining !== undefined &&
        state.secondsRemaining <= SOFT_CLOSE_SECONDS &&
        !state.softCloseOffered
      ) {
        return {
          ...base,
          stage: 6,
          action: "soft_close",
          proposal: standing,
          accepts: false,
        };
      }

      // A reason-free over-ask gets one "why does that matter?" before the
      // tier is enforced (§6.2: 이유 요청 1회). Judgement deferred one turn.
      if (state.tier === "none" && !state.askedWhy) {
        return { ...base, action: "ask_why", proposal: null, accepts: false };
      }

      // Something is on the table and it is not the tier package: name it as
      // lopsided and re-put the symmetric one (SCRIPT-BALANCE). With nothing
      // on the table the counterpart simply proposes at its rung
      // (SCRIPT-PROPOSE-T{tier}) — §3.3 leaves the maximum to be PROPOSED, not
      // discovered, so SB voicing is the only bottleneck and negotiation skill
      // cannot separate outcomes.
      return {
        ...base,
        action: incoming ? "balance" : "propose_tier",
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
   * Where the AI-AI exchange settles — the tier package. Always reached: the
   * mandate carries no floor that could block it (Ver.2.13 §2.6). Kept
   * nullable because an emergency stop can end the exchange before the proxies
   * arrive anywhere.
   */
  tentative: Package | null;
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

  // Where the ladder says this exchange settles. It ALWAYS settles now
  // (Ver.2.13 §2.6): the range mandate — a floor the proxy may not cross — is
  // gone. It could not change the outcome, because the counterpart's policy is
  // decisive; all it could do was manufacture an impasse and mix mandate-setting
  // skill into the result. This study's construct is delegation of VOICE with
  // RETENTION OF THE DECISION, so the participant's control sits before (which
  // reasons) and after (RATIFY), not in a range.
  return {
    opening,
    tradeProposal,
    tier,
    tentative: tierPackage(task, participantRole, tier),
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
// Outcome coding (Ver.2.13 §3.4, §9.3)
// ---------------------------------------------------------------------------

/**
 * The outcome, reduced to what Ver.2.13 names.
 *
 * §9.6 DELETED UNLOCK, CONCEAL-PREMIUM, MAX-JOINT AND agreement/no_agreement,
 * and it is not a simplification for its own sake: under the symmetric package
 * rule JOINT takes exactly four values — 3,200 / 4,600 / 6,000 / 1,200 — one
 * per rung of the credibility ladder plus impasse. So JOINT alone identifies
 * the tier reached, whether the best package was opened (6,000), what
 * concealment cost (the gap between rungs) and whether there was an agreement
 * (1,200 = none). Four derived indicators computed off one number are four
 * chances for them to disagree, not four measures.
 *
 * `requirementPreserved` and `requirementOptionIndex` survive because they are
 * not analysis variables: the review screen states where the participant's own
 * core landed against what they hoped for (§7), and that is a screen, not a
 * measure.
 */
export interface OutcomeCoding {
  agreed: boolean;
  /** Is the participant's requirement threshold (options 1-2) held? */
  requirementPreserved: boolean;
  /** Where the participant's core landed, as an option index (0-based). */
  requirementOptionIndex: number;
  participantPoints: number;
  counterpartPoints: number;
  /** JOINT: the two sides' points added — 3,200 / 4,600 / 6,000 / 1,200. */
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
  const req = requirementIssue(task, participantRole);

  // No agreement: both sides take the fallback. `clearsReservation` is false
  // rather than true — the participant did not clear their fallback, they
  // *received* it.
  if (!finalPackage || !agreed) {
    return {
      agreed: false,
      requirementPreserved: false,
      requirementOptionIndex: -1,
      participantPoints: task.reservationPoints,
      counterpartPoints: task.reservationPoints,
      jointPoints: task.reservationPoints * 2,
      clearsReservation: false,
    };
  }

  const participantPoints = scorePackage(task, finalPackage, participantRole);
  const counterpartPoints = scorePackage(task, finalPackage, counterpartRole);

  return {
    agreed: true,
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
    jointPoints: participantPoints + counterpartPoints,
    clearsReservation: participantPoints >= task.reservationPoints,
  };
}
