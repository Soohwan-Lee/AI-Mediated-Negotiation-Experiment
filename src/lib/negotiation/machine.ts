/**
 * The negotiation state machine (Experimental Design Ver.2.21 §6).
 *
 * WHAT THIS OWNS, AND WHY IT MATTERS. The model decides nothing here. This
 * file decides WHAT happens — offer levels, concessions, acceptance,
 * termination — and the model only decides HOW it is said. Two participants
 * who behave identically get identical outcomes, which is what makes a
 * condition contrast interpretable when every primary outcome is a function
 * of behaviour.
 *
 * THE LADDER HAS TWO RUNGS (§3.3, §6.2, Ver.2.21 12th correction). How far the
 * counterpart concedes is set by ONE question: has the participant side voiced
 * the sensitive background?
 *
 *   no  (nothing, the work reason, or a bare priority claim) → 3rd option each
 *   yes (the SB, or the §6.6 abstraction)                    → best option each
 *
 * Both cores land on the SAME rank, so each rung pays 1,000 / 3,000 to each
 * side. Impasse pays nothing at all.
 *
 * WHY THE PRIORITY RUNG WENT. Ver.2.20 had a middle rung for "this term
 * matters more to me". Two things were wrong with it. A counterpart holding a
 * symmetric payoff sheet refusing a full trade that is also better for itself,
 * on the grounds that it had only heard a priority claim, is not behaving
 * rationally. And the proxy's floor was that rung while a Direct participant's
 * floor was the one below, which put a mechanical Mode difference straight into
 * Points and JOINT. With two rungs both arms floor at T1 and the asymmetry is
 * gone. A priority claim still earns one SCRIPT-ASKWHY — that question is where
 * the participant HEARS that a claim without a reason does not move anything.
 *
 * THE MISREAD IS GONE with the decoy that produced it. The work reason now says
 * "both of these are on my mind" rather than pointing at the wrong term, so
 * there is nothing for the counterpart to sincerely misread, and the 600/1,900
 * trap it created no longer exists.
 *
 * The participant writes freely inside the clock; the counterpart cannot skip
 * ahead, repeat a one-shot move, or disclose its own SB in Direct before the
 * participant has disclosed theirs.
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

/**
 * What the participant side has said, as the counterpart reads it (§3.3).
 *
 * THREE VALUES, TWO RUNGS. `none` and `work` are the same rung — the work
 * reason is true and safe and names BOTH terms, so hearing it tells the
 * counterpart nothing it can act on beyond splitting the difference. Only
 * `sensitive` moves anything.
 *
 * `work` is kept as a distinct value rather than folded into `none` because
 * the transcript records what was actually said, and "they gave a reason and
 * it did not help" is a different fact for the analysis from "they said
 * nothing".
 *
 * A bare priority claim is NOT a value here. Ver.2.21's 12th correction
 * removed the rung it used to buy; it now travels as `priorityClaimed` on the
 * exchange state, where its only effect is one SCRIPT-ASKWHY.
 */
export type ReasonTier = "none" | "work" | "sensitive";

/**
 * How deep into BOTH cores the counterpart will concede, as an index into the
 * options ranked best-first for whichever side owns that core. 0 = best.
 *
 * `none` and `work` share a rank (§3.3): a non-directional work reason leaves
 * the counterpart nothing to do but split the difference.
 */
export const TIER_LIMIT_INDEX: Record<ReasonTier, number> = {
  none: 2,
  work: 2,
  sensitive: 0,
};

/** Rank order for folding. Higher wins; the tier never falls (§6.2, §6.9 #3). */
const TIER_RANK: Record<ReasonTier, number> = {
  none: 0,
  work: 1,
  sensitive: 2,
};

/**
 * The P5 classifier's labels, mapped onto the ladder (§6.2a).
 *
 * The classifier names what was SAID; this names what it BUYS. They are
 * separate on purpose — `WR` is a real thing to have said, and the log keeps
 * it for the audit, but it earns no more than silence.
 *
 * `PRI` IS AN ALIAS, NOT A LABEL. Ver.2.21 removed it from the classifier's
 * output in favour of a `priority_claim` flag beside the label. It is accepted
 * here mapping to `work`, so a stale client, a replayed log, or a model that
 * has not read the new prompt cannot crash a live turn or silently produce
 * `undefined` where a tier belongs.
 */
export const LABEL_TIER: Record<"none" | "WR" | "PRI" | "SB", ReasonTier> = {
  none: "none",
  WR: "work",
  PRI: "work",
  SB: "sensitive",
};

/**
 * The higher of two tiers.
 *
 * The Proxy closing needs it: the ladder carries over from what the proxy
 * voiced and can only RISE when the participant says more in person. It is
 * one function because the same fold is read twice per turn — once for what
 * the counterpart sees, once for what the outcome log records — and two
 * hand-written ternaries would eventually disagree.
 */
export function foldTier(a: ReasonTier, b: ReasonTier): ReasonTier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

/**
 * The tier a set of voiced cards has earned. Reads layers, never text.
 *
 * This is the PROXY path only — there the participant's checkbox decides which
 * card is voiced, so the kind is known without reading anything. The Direct
 * path and the Proxy closing go through the P5 classifier instead (§6.2a),
 * because Ver.2.20 removed the card buttons and the participant now simply
 * talks.
 */
export function tierOf(
  voiced: ReadonlyArray<Pick<ReasonCard, "layer">>,
): ReasonTier {
  if (voiced.some((c) => c.layer === "sensitive")) return "sensitive";
  if (voiced.some((c) => c.layer === "work")) return "work";
  return "none";
}

/**
 * The package the counterpart settles at under a tier — SYMMETRIC (§3.3).
 * Both cores land on the SAME rank: T1 the third option, T2 the best. 1,000 or
 * 3,000 EACH, joint 2,000 or 6,000.
 *
 * THIS REPLACED AN ASYMMETRIC POLICY AND THE REASON MATTERS. Ver.2.12 held the
 * counterpart's own core at its best on every path and conceded only on the
 * participant's. Two things were wrong with it (§2.6). One, a counterpart that
 * opens with "my best, your worst" and never moves off its own core is itself a
 * face threat — exactly the non-negotiable, lowball offer White et al. (2004)
 * identify — so a high-FTS participant was pushed into competing by a route
 * that has nothing to do with self-disclosure. Two, a ladder where only the
 * participant loses reframes disclosure as "giving in to them" rather than as
 * buying credibility.
 *
 * Under the symmetric rule JOINT is a function of the tier, so the outcome
 * measure IS the ladder — which is why §9.6 could drop UNLOCK,
 * CONCEAL-PREMIUM and MAX-JOINT — and the only face threat left inside the
 * negotiation is the participant's own disclosure. "I move as far as I
 * believe, and I ask for no more than I move."
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

/** Best↔best — the full trade, 3,000 each, joint 6,000. The SB rung. */
export function maxPackage(
  task: NegotiationTask,
  participantRole: Role,
): Package {
  return tierPackage(task, participantRole, "sensitive");
}

/**
 * The acceptance judgement (§6.2): the counterpart accepts EXACTLY the
 * symmetric package of the current tier, and nothing else.
 *
 * `accept(p) iff p == package(tier)`. Both directions are refused on purpose.
 * An over-ask is refused because it asks for more credibility than has been
 * earned. An UNDER-ask — a package worse for the participant than their tier
 * allows — is refused too (SCRIPT-BALANCE), so a participant who concedes more
 * than they had to cannot drag the outcome below the rung they paid for.
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

/** The Direct negotiation clock (Design §2.3: 직접 협상 10분). */
export const NEGOTIATION_SECONDS = 10 * 60;

/** The Proxy arm's direct closing clock (Design §7: 직접 마무리 3분). */
export const CLOSING_SECONDS = 3 * 60;

/** Below this, the counterpart offers SCRIPT-CLOSE once (§6.2: 남은 시간 90초). */
export const SOFT_CLOSE_SECONDS = 90;

/**
 * How long the counterpart waits on a silent participant before SCRIPT-NUDGE
 * (§6.2, §6.9 #17). The client watches the clock and sets `participantSilent`;
 * the machine owns whether the nudge is still available.
 */
export const NUDGE_AFTER_SILENT_SECONDS = 60;

/**
 * Below this the classifier's own answer is treated as too uncertain to act on
 * (§6.2): the counterpart asks once with SCRIPT-CLARIFY instead of proposing.
 *
 * The point is to turn a missed disclosure from a failure the participant
 * cannot see into a visible request for more. It only applies below the SB
 * label — there is nothing above `sensitive` to clarify towards.
 */
export const CLARIFY_CONFIDENCE_FLOOR = 0.6;

// ---------------------------------------------------------------------------
// The participant's rule about numbers
// ---------------------------------------------------------------------------

/**
 * Does a participant message talk about the private score sheet? (§8.1: the
 * numbers may never be told to the other side; §6.2: first mention gets
 * SCRIPT-NONUM once, later mentions are ignored.)
 *
 * Deliberately coarse: option counts are 1–4, so any 3+ digit number, or the
 * words "points"/"score", is score talk and nothing legitimate is. A lexical
 * screen is the right tool because the reminder is cheap and one-shot.
 */
export function mentionsScoreNumbers(text: string): boolean {
  return /\b\d{3,}\b/.test(text) || /\b(?:points|score(?:s|board|sheet)?)\b/i.test(text) || /\b(?:\d+|one)\s+point\b/i.test(text);
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
 *   open → SCRIPT-OPEN · ask_sit → SCRIPT-ASKSIT · ask_why → SCRIPT-ASKWHY ·
 *   clarify → SCRIPT-CLARIFY · nudge → SCRIPT-NUDGE ·
 *   propose_tier → SCRIPT-PROPOSE-T1/T2 · balance → SCRIPT-BALANCE ·
 *   nonum → SCRIPT-NONUM · soft_close → SCRIPT-CLOSE ·
 *   impasse → SCRIPT-FALLBACK.
 *
 * WHAT VER.2.21 REMOVED. `misread` went with the decoy (there is nothing to
 * misread about a work reason that names both terms), and `state_priority`
 * went with it: SCRIPT-OPEN carries the work reason AND the question, and the
 * counterpart never announces which term it needs — the participant has to
 * start without knowing (§3.3, §6.4).
 *
 * WHAT IT ADDED. `ask_sit` for a first message carrying no reason at all,
 * `clarify` for a classifier answer too uncertain to act on, and `nudge` for
 * silence. All three exist for the same reason: a participant who says nothing
 * usable should meet a visible question rather than an invisible failure.
 *
 * `disclose_sb_and_accept` is the one combined action. §6.1 stage 6 requires
 * that an SB and a valid T2 acceptance arriving in the same turn produce ONE
 * reply carrying both — otherwise a participant who discloses and agrees in one
 * message has to sit through a disclosure turn before their own agreement is
 * answered.
 */
export type DecidedAction =
  | "open"
  | "ask_sit"
  | "disclose_sb"
  | "ask_why"
  | "clarify"
  | "nudge"
  | "propose_tier"
  | "balance"
  | "accept"
  | "accept_sb"
  | "disclose_sb_and_accept"
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
 * `tier` is decided by the SYSTEM — the participant's checkbox under Proxy,
 * the P5 classifier under Direct — never by the model reading the text
 * (Design §6.2: LLM 비관여).
 */
export interface ExchangeState {
  tier: ReasonTier;
  /**
   * Direct gates the counterpart's sensitive background on reciprocity.
   * Proxy observation keeps the fixed disclosure schedule.
   */
  disclosurePolicy?: "reciprocal" | "fixed";
  /** Has the counterpart already voiced its sensitive background? */
  counterpartSbDisclosed?: boolean;
  /**
   * The classifier's `priority_claim` flag (§6.2): they have said one term
   * matters more, without a reason for it. It does not move the tier; it earns
   * exactly one SCRIPT-ASKWHY.
   */
  priorityClaimed?: boolean;
  /** SCRIPT-ASKWHY has been spent (it is asked once, §6.2). */
  askedWhy: boolean;
  /** SCRIPT-ASKSIT has been spent (once, §6.1 stage 2). */
  askSitUsed?: boolean;
  /**
   * How many participant turns in a row have carried no reason at all. Two
   * settles it as "no reason" and the counterpart moves on (§6.1 stage 2).
   */
  reasonlessTurns?: number;
  /**
   * The classifier's confidence in the CURRENT label, when it is below the SB
   * rung. Under `CLARIFY_CONFIDENCE_FLOOR` the counterpart asks once rather
   * than proposing (§6.2).
   */
  labelConfidence?: number;
  /**
   * SCRIPT-CLARIFY is once PER TIER, not once per task: a participant who
   * clarifies their way up to `work` may still be vague about an SB later, and
   * that is the case the script exists for. Holds the tier the clarify was
   * spent at.
   */
  clarifyUsedForTier?: ReasonTier | null;
  /** SCRIPT-NUDGE has been spent (once, §6.9 #17). */
  nudgeUsed?: boolean;
  /** The participant has been silent past `NUDGE_AFTER_SILENT_SECONDS`. */
  participantSilent?: boolean;
  /** SCRIPT-NONUM has been spent (once, then mentions are ignored). */
  numbersReminded: boolean;
  /** Did the participant's LAST message mention score numbers? */
  numbersMentionedNow?: boolean;
  secondsRemaining?: number;
  /** SCRIPT-CLOSE has been offered already. */
  softCloseOffered?: boolean;
}

/**
 * The counterpart's next move (§6.1–6.3).
 *
 * `stage` is the counterpart's own position in ITS script. Proxy observation
 * advances through the fixed opening, work reason, SB disclosure and trade
 * loop. Direct uses the same positions, but its disclosure is RECIPROCAL: the
 * SB move only happens once the participant has disclosed, and it can be
 * combined with acceptance.
 *
 * FROM THE TRADE STAGE ON, every turn is the same judgement: the tier decides
 * the limit, the limit decides the standing proposal, and the standing
 * proposal only improves when the tier does. Once the SB tier is open the
 * counterpart proposes best↔best ITSELF if the participant has not — §3.3
 * makes SB voicing the only bottleneck to the maximum, so negotiation skill
 * cannot be what separates outcomes.
 *
 * THE ORDER OF THE GUARDS IS THE DESIGN. Expiry, then the acceptance that
 * outranks it, then the no-numbers reminder, then reciprocal disclosure, then
 * acceptance, then the clock's soft close, then the questions (clarify, why,
 * situation), then the proposal. Each is commented where it sits.
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

  const reciprocal = state.disclosurePolicy === "reciprocal";
  const expired =
    state.secondsRemaining !== undefined && state.secondsRemaining <= 0;
  const needsNumberReminder =
    state.numbersMentionedNow && !state.numbersReminded;
  const acceptable = acceptablePackage(
    task,
    participantRole,
    incoming,
    state.tier,
  );

  /** SCRIPT-CLARIFY: uncertain, below SB, and not yet spent at this tier. */
  const needsClarify =
    state.tier !== "sensitive" &&
    state.labelConfidence !== undefined &&
    state.labelConfidence < CLARIFY_CONFIDENCE_FLOOR &&
    state.clarifyUsedForTier !== state.tier;

  const closingAction = (): DecidedAction =>
    state.tier === "sensitive" && reciprocal && !state.counterpartSbDisclosed
      ? "disclose_sb_and_accept"
      : state.tier === "sensitive"
        ? "accept_sb"
        : "accept";

  /**
   * A valid acceptance ends the task at once (§6.1 stage 6): no intermediate
   * disclosure stage is forced. At the sensitive rung the counterpart
   * reciprocates and accepts in one reply, so a real agreement never creates a
   * mandatory extra turn.
   *
   * ACCEPTANCE OUTRANKS THE CLOCK, and only here. `secondsRemaining` is read
   * BEFORE the reply delay, so a participant who puts the tier package up in
   * the last seconds has genuinely made an acceptable offer and would otherwise
   * be answered with an impasse worth nothing — decided by when the message
   * happened to land.
   */
  const settle = (): CounterpartDecision | null => {
    if (expired && !acceptable) {
      return {
        ...base,
        stage: 6,
        action: "impasse",
        proposal: null,
        accepts: false,
        impasse: true,
      };
    }
    // Past zero the reminder yields to an acceptable package: there is no later
    // turn left to accept in, and the reminder would cost the rung.
    if (needsNumberReminder && !(expired && acceptable)) {
      return { ...base, action: "nonum", proposal: null, accepts: false };
    }
    if (!acceptable) return null;
    return {
      ...base,
      stage: 6,
      action: closingAction(),
      proposal: incoming,
      accepts: true,
    };
  };

  switch (stage) {
    case 1:
      // SCRIPT-OPEN: its own work reason — "both of these are on my mind" —
      // and the question that invites the participant's situation. NO PACKAGE
      // and NO PRIORITY of its own (§6.1, §6.4). Ver.2.12 opened on the
      // counterpart's own best package, which §2.6 identifies as a face threat
      // in its own right. Withholding its priority is what leaves the
      // participant to start without knowing which term the other side needs.
      return { ...base, action: "open", proposal: null, accepts: false };

    case 2: {
      const close = settle();
      if (close) return close;
      // SCRIPT-ASKSIT: the participant's first message carried no reason at
      // all, so the counterpart asks once about their situation and waits
      // (§6.1 stage 2). A second reasonless turn settles it as "no reason" and
      // the trade loop takes over.
      if (
        state.tier === "none" &&
        !state.askSitUsed &&
        (state.reasonlessTurns ?? 0) < 2
      ) {
        return { ...base, action: "ask_sit", proposal: null, accepts: false };
      }
      return counterpartStep(task, counterpartRole, 5, incoming, state);
    }

    case 3:
      // The lock is a recording moment, not a message; the stage walk never
      // serves it. Falling through keeps a miscounted caller harmless.
      return counterpartStep(task, counterpartRole, 4, incoming, state);

    case 4: {
      if (reciprocal) {
        const close = settle();
        if (close) return close;
        // RECIPROCAL DISCLOSURE (§6.3, Ver.2.21). In Direct the counterpart
        // voices its own SB only after the participant has voiced theirs. A
        // WR-only path never hears it, which is what makes `SB` a disclosure
        // decision rather than a response to one.
        if (state.tier !== "sensitive" || state.counterpartSbDisclosed) {
          return counterpartStep(task, counterpartRole, 5, incoming, state);
        }
      }
      return { ...base, action: "disclose_sb", proposal: null, accepts: false };
    }

    default: {
      // Stages 5–6: the trade loop.
      if (expired && !acceptable) {
        return {
          ...base,
          stage: 6,
          action: "impasse",
          proposal: null,
          accepts: false,
          impasse: true,
        };
      }

      // The one-shot no-numbers reminder outranks everything except the end of
      // the clock: it answers the message that just arrived. Past zero it
      // yields to an acceptable package, because there is no later turn left to
      // accept in and the reminder would cost the participant the rung.
      if (needsNumberReminder && !(expired && acceptable)) {
        return { ...base, action: "nonum", proposal: null, accepts: false };
      }

      // Reciprocal disclosure, before anything else the sensitive rung does.
      if (
        reciprocal &&
        state.tier === "sensitive" &&
        !state.counterpartSbDisclosed
      ) {
        const close = settle();
        if (close) return close;
        return {
          ...base,
          action: "disclose_sb",
          proposal: null,
          accepts: false,
        };
      }

      const standing = tierPackage(task, participantRole, state.tier);

      // THE TIER PACKAGE, AND ONLY IT, IS ACCEPTED (§6.2). Both directions are
      // refused: an over-ask asks for credibility not earned, and an under-ask
      // would let a participant's over-concession into the outcome. The
      // distinction the two rungs still carry is the WORDING — accept_sb frames
      // the close as an update on what was disclosed — so the tier is read once
      // here rather than in the renderer.
      if (acceptable) {
        return {
          ...base,
          stage: 6,
          action: closingAction(),
          proposal: incoming,
          accepts: true,
        };
      }

      // THE CLOCK OUTRANKS THE TIER'S OWN PROPOSAL. Without this, a participant
      // who kept asking off-tier would meet the same refusal every turn and run
      // out at nothing — below the 1,000 a participant who said nothing gets,
      // inverting the ladder for whoever paid the most. SCRIPT-CLOSE puts the
      // tier package up once, near the end, as something to settle on.
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

      // SCRIPT-NUDGE (§6.9 #17). Nothing has arrived for a minute, so there is
      // no package to answer and no new reason to weigh. Asked once, then the
      // counterpart simply waits.
      if (state.participantSilent && !state.nudgeUsed && !incoming) {
        return { ...base, action: "nudge", proposal: null, accepts: false };
      }

      // SCRIPT-CLARIFY (§6.2). The classifier is not confident and the label is
      // below SB, so rather than settle for a rung that may be wrong the
      // counterpart asks for more. It takes precedence over balancing and
      // proposing on this turn, and it is spent once per tier.
      //
      // This is the whole mitigation for the design's one invisible failure
      // mode: a participant whose disclosure was missed otherwise experiences
      // "I said it and it did not land" with nothing on screen to tell them.
      if (needsClarify) {
        return { ...base, action: "clarify", proposal: null, accepts: false };
      }

      // ONE "why that term specifically?" (§6.2, §6.9 #9, SCRIPT-ASKWHY).
      //
      // ITS ONLY TRIGGER IS A PRIORITY CLAIM. Asking "why does that one matter
      // more?" of someone who has not said one matters more is a question about
      // something they never claimed. A participant who simply repeats a demand
      // with no reason gets SCRIPT-ASKSIT once and then the T1 package (§6.9
      // #7), and BALANCE after that — never this.
      //
      // It is where "a claim without a reason moves nothing" is said out loud
      // rather than left to be inferred, so the T1 package stays on the table
      // alongside it.
      if (
        state.tier !== "sensitive" &&
        state.priorityClaimed &&
        !state.askedWhy
      ) {
        return {
          ...base,
          action: "ask_why",
          proposal: standing,
          accepts: false,
        };
      }

      // Something is on the table and it is not the tier package: name it as
      // lopsided and re-put the symmetric one (SCRIPT-BALANCE). With nothing on
      // the table the counterpart simply proposes at its rung
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
 * Which tier a `propose_tier` decision is proposing at, as the 1-or-2 the
 * SCRIPT-PROPOSE-T{n} names carry.
 *
 * One function rather than a ternary at each call site: the renderer, the
 * audit log and the tests all have to agree on which script a decision maps to,
 * and the ladder has been renumbered twice.
 */
export function proposalTierNumber(tier: ReasonTier): 1 | 2 {
  return tier === "sensitive" ? 2 : 1;
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
 * its work reason and disclosed its SB — so its first direct reply is the trade
 * loop, never a re-run of the disclosure the participant just watched.
 *
 * The closing must therefore be started with `counterpartSbDisclosed: true`
 * even though the counterpart has said nothing in person: the disclosure
 * happened on screen, through its proxy, and repeating it would give the Proxy
 * arm two disclosures where Direct has one.
 */
export const DIRECT_STAGE_OFFSET = 3;

// ---------------------------------------------------------------------------
// Proxy behaviour (Design §6.5)
// ---------------------------------------------------------------------------

export interface ProxyPlan {
  /** What the participant's proxy opens with — the mandate's preferred levels. */
  opening: Package;
  /**
   * The conditional trade it proposes: the counterpart's core at their best,
   * its own principal's core at the preferred level. Whether the counterpart
   * accepts is the tier's decision, not this plan's.
   */
  tradeProposal: Package;
  /** The tier the AUTHORIZED cards will earn once voiced on schedule. */
  tier: ReasonTier;
  /**
   * What the participant's own wish package is worth TO THEM (§8.6). The proxy
   * accepts anything at least this good and escalates otherwise; the screen's
   * default is both terms at their best, which no package can match, so a
   * participant who leaves it alone gets a proxy that pushes to the ceiling its
   * reasons allow.
   */
  wishScore: number;
  /**
   * Where the AI-AI exchange settles — the tier package. Always reached: the
   * mandate carries no floor that could block it (§2.6). Kept nullable because
   * an emergency stop can end the exchange before the proxies arrive anywhere.
   */
  tentative: Package | null;
}

/**
 * Turns a mandate into the proxy's plan.
 *
 * BOTH POLICIES COMPUTE THIS IDENTICALLY. Design §2.3 defines User-Specified
 * and AI-Supplemented as differing in REASON USE POLICY, not in what they will
 * trade; a policy that reached further would confound
 * `AI-Supplemented − User-Specified` with concession reach.
 *
 * THE PROXY'S FLOOR IS T1, THE SAME AS DIRECT'S (Ver.2.21, 12th correction).
 * Through Ver.2.20 this folded `"priority"` in unconditionally, because a proxy
 * holds its principal's preferred package and therefore always knows which term
 * matters more and says so — which put the proxy's floor a rung above a Direct
 * participant's and a mechanical Mode difference straight into Points and
 * JOINT (the old §13-13②). With the priority rung gone, the proxy still states
 * the priority and still declines the counterpart's first T1 offer; it simply
 * does not earn anything for it, and both arms floor at the same rung.
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

  // The work reason is always voiced (§8.7), so the only thing the mandate can
  // change is whether the SB is. `tierOf` reads the authorized layers; the WR
  // is folded in unconditionally because the proxy says it whether or not the
  // id reached this function.
  const tier = foldTier(tierOf(authorized), "work");

  const ranked = rankedOptions(task, req.id, participantRole);
  const forIssue = (issueId: string) =>
    mandate.issues.find((i) => i.issueId === issueId);

  const preferred = forIssue(req.id)?.preferredOptionId ?? ranked[0].id;

  const opening: Package = Object.fromEntries(
    task.issues.map((i) => [
      i.id,
      forIssue(i.id)?.preferredOptionId ??
        rankedOptions(task, i.id, participantRole)[0].id,
    ]),
  );

  // The trade: hand the counterpart their core outright, ask for the mandate's
  // own goal. Giving the other side what they actually want is the logroll, and
  // it is the only currency there is.
  const tradeProposal: Package = {
    [req.id]: preferred,
    [theirs.id]: rankedOptions(task, theirs.id, counterpartRole)[0].id,
  };

  return {
    opening,
    tradeProposal,
    tier,
    wishScore: scorePackage(task, opening, participantRole),
    // Where the ladder says this exchange settles. It ALWAYS settles now
    // (§2.6): the range mandate — a floor the proxy may not cross — is gone. It
    // could not change the outcome, because the counterpart's policy is
    // decisive; all it could do was manufacture an impasse and mix
    // mandate-setting skill into the result.
    tentative: tierPackage(task, participantRole, tier),
  };
}

/**
 * Should the participant's proxy accept what the counterpart has put up?
 * (§6.5, §8.6, Ver.2.21 11th correction.)
 *
 * The wish package is the proxy's target AND its acceptance line: anything
 * worth at least as much to the principal is taken. Below that it keeps
 * pushing while it still has a reason left to use, and when it runs out it
 * takes the package on the table as a tentative one for the participant to
 * ratify.
 *
 * The screen's default wish is both terms at their best — 3,600, more than any
 * package the counterpart will ever offer — so a participant who leaves it
 * alone gets a proxy that goes to the ceiling its reasons allow and then brings
 * back what it reached. Lowering the wish only changes how much the proxy says
 * on the way, never the score: under the two-rung ladder the SB checkbox
 * decides that on its own.
 */
export function proxyAccepts(
  task: NegotiationTask,
  participantRole: Role,
  offered: Package | null | undefined,
  plan: Pick<ProxyPlan, "wishScore">,
  reasonsRemaining: number,
): boolean {
  if (!offered) return false;
  if (scorePackage(task, offered, participantRole) >= plan.wishScore) {
    return true;
  }
  // Nothing left to say: take what is on the table as the tentative package
  // (§8.6). The participant decides at RATIFY.
  return reasonsRemaining <= 0;
}

/**
 * Which authorized card the participant's proxy voices at a given stage
 * (§6.5).
 *
 * THE SCHEDULE, NOT THE MODEL, DECIDES. If the principal checked the SB, the
 * proxy voices it at its FIRST reason opportunity — stage 2 — because `SB`
 * (the confirmatory disclosure outcome) records whether the participant side's
 * SB was out at that first opportunity. A schedule that held it back would
 * record every Proxy participant as a non-discloser regardless of what they
 * authorized. If only the WR is checked, the WR is voiced there instead; each
 * card at most once per task, one reason per message.
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
// Outcome coding (§3.4, §9.3)
// ---------------------------------------------------------------------------

/**
 * When the participant side's sensitive background reached the other side
 * (`SB-TIMING`, §9.3, §6.9).
 *
 *  never          — it was never voiced.
 *  first_chance   — at the first reason opportunity: the Direct LOCK turn, or
 *                   the Proxy checkbox, which is that arm's first opportunity
 *                   by construction.
 *  later_turn     — a later Direct turn, after the lock. `SB` stays 0 and the
 *                   score still rises (§6.9 #11).
 *  wrap_up        — in the Proxy arm's three-minute closing, in the
 *                   participant's own words (§6.9 #2).
 *
 * Categories 3 and 4 are structurally exclusive by arm, which §9.8-5 flags:
 * the χ² has zero cells by construction and its unit has to be pre-specified.
 */
export type SbTiming = "never" | "first_chance" | "later_turn" | "wrap_up";

/**
 * The outcome, reduced to what the design names.
 *
 * §9.6 DELETED UNLOCK, CONCEAL-PREMIUM, MAX-JOINT AND agreement/no_agreement,
 * and it is not a simplification for its own sake: under the symmetric package
 * rule JOINT takes exactly three values — 2,000 / 6,000 / 0 — one per rung of
 * the ladder plus impasse. So JOINT alone identifies the tier reached, whether
 * the best package was opened (6,000) and whether there was an agreement
 * (0 = none). Three derived indicators computed off one number are three
 * chances for them to disagree, not three measures.
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
  /** JOINT: the two sides' points added — 2,000 / 6,000 / 0. */
  jointPoints: number;
  /**
   * Did the participant come out above the no-agreement figure? With no
   * agreement worth 0 since Ver.2.21, every agreement does.
   */
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

  // NO AGREEMENT IS WORTH NOTHING (§3.2, 11th correction). There is no fallback
  // package to fall back to, so both sides score zero and `clearsReservation`
  // is false — they did not clear the figure, they landed on it.
  if (!finalPackage || !agreed) {
    return {
      agreed: false,
      requirementPreserved: false,
      requirementOptionIndex: -1,
      participantPoints: 0,
      counterpartPoints: 0,
      jointPoints: 0,
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
    clearsReservation: participantPoints > task.reservationPoints,
  };
}
