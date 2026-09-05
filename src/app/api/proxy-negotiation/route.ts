/**
 * Proxy-condition AI-AI negotiation — one turn per request.
 *
 * WHO DECIDES WHAT. `lib/negotiation/machine` decides the move: which package
 * goes on the table, which reason is voiced when, whether the counterpart
 * concedes, and where the exchange settles. The model is asked only to say
 * that move in the right voice.
 *
 * THE EXCHANGE IS EIGHT TURNS, four per side, walking Ver.2.12 §6.1's six
 * stages (stage 3 is the lock, a recording moment, not a message):
 *
 *   0 counterpart opens            1 participant proxy opens
 *   2 counterpart WR + asks        3 participant proxy voices its designated
 *                                    reason — the SB if authorized (§6.5),
 *                                    which is what makes PRE-RECIP-SB true
 *                                    for a participant who checked it
 *   4 counterpart discloses SB     5 participant proxy proposes the trade
 *   6 counterpart evaluates        7 participant proxy closes
 *
 * The counterpart's evaluation at turn 6 is the credibility ladder: the tier
 * earned by the reasons ACTUALLY voiced (recovered from the carried tokens,
 * pool arguments never counting) sets how far it concedes on the
 * participant's core issue. Fixed turn order is what keeps User-Specified and
 * AI-Supplemented matched on message count (pilot gate 9); the AI-Supplemented's two pool
 * clauses ride INSIDE turns 3 and 5, never as extra turns.
 *
 * ONE TURN PER REQUEST: the client drives the sequence, each request stays
 * well inside Vercel's 60s limit, and the waiting screen shows real progress.
 */

import { NextResponse } from "next/server";
import { generateAction } from "@/lib/ai/client";
import { capMessageLength, validateAction } from "@/lib/ai/validator";
import { NEGOTIATION } from "@/lib/study-config";
import {
  buildProxyPlan,
  counterpartStep,
  designatedReason,
  tierOf,
  type ReasonTier,
} from "@/lib/negotiation/machine";
import {
  cardOfLayer,
  counterRequirementIssue,
  getTask,
  abstractedReason,
  requirementIssue,
} from "@/lib/tasks";
import type {
  Mandate,
  Package,
  ReasonCard,
  Role,
  Speaker,
  StageId,
  TaskId,
  TranscriptMessage,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestBody {
  taskId: TaskId;
  participantRole: Role;
  policy: "user_specified" | "ai_supplemented";
  mandate: Mandate;
  sessionIndex: 1 | 2;
  /** 0-based index into the turn order above. */
  turn: number;
  /** Visible transcript so far, oldest first. */
  history?: Array<{ speaker: Speaker; text: string }>;
  /** The package each side last put on the table. */
  lastParticipantPackage?: Package | null;
  lastCounterpartPackage?: Package | null;
  /**
   * Opaque tokens for the reasons the participant side has already voiced.
   * Deliberately carries no indication of which kind each was — see
   * `reasonToken`. The tier and the pool budget need the kind and the issue,
   * and the server recovers BOTH by re-hashing the known card and pool ids
   * (`resolveReasonTokens`), so the client never holds either.
   */
  reasonsUsed?: string[];
}

type Turn = { stage: StageId; side: "counterpart" | "participant" };

const TURN_ORDER: Turn[] = [
  { stage: 1, side: "counterpart" },
  { stage: 1, side: "participant" },
  { stage: 2, side: "counterpart" },
  { stage: 2, side: "participant" },
  { stage: 4, side: "counterpart" },
  { stage: 5, side: "participant" },
  { stage: 5, side: "counterpart" },
  { stage: 6, side: "participant" },
];

const TOTAL_TURNS = TURN_ORDER.length;

/** The mandate, written out for the proxy's prompt. */
function mandateSummary(mandate: Mandate, taskId: TaskId): string {
  const task = getTask(taskId);
  const byId = new Map(task.issues.map((i) => [i.id, i]));
  const label = (issueId: string, optionId: string | null) =>
    byId.get(issueId)?.options.find((o) => o.id === optionId)?.label ??
    "unspecified";

  return mandate.issues
    .map((m) => {
      const issue = byId.get(m.issueId);
      // Opening level only (Ver.2.13 §8.6). Where it settles is the
      // counterpart's tier decision, not a range the principal set.
      return `- ${issue?.label ?? m.issueId}: open at ${label(m.issueId, m.preferredOptionId)}`;
    })
    .join("\n");
}

/**
 * The reason cards, split into what the proxy may say and what it may not.
 *
 * Both lists go into the prompt. Design §12 P3 requires the unchecked cards
 * to be present so the proxy can let them inform WHICH PACKAGE it chooses
 * while never putting them into words.
 */
function reasonsFor(taskId: TaskId, role: Role, mandate: Mandate) {
  const task = getTask(taskId);
  const cards = task.roleBriefs[role].reasonCards;
  const issueLabel = (issueId: string) =>
    task.issues.find((i) => i.id === issueId)?.label;
  const pick = (authorized: boolean) =>
    cards
      .filter((c) => mandate.authorizedReasonIds.includes(c.id) === authorized)
      .map((c) => ({
        id: c.id,
        text: c.text,
        issueLabel: issueLabel(c.issueId),
        sensitive: c.layer === "sensitive",
      }));
  return { authorized: pick(true), forbidden: pick(false) };
}

/**
 * What a proxy says when the model's wording was blocked: plain,
 * package-only, no rationale — a rationale is exactly the thing most likely
 * to have been blocked.
 */
function fallbackText(
  task: ReturnType<typeof getTask>,
  proposal: Package | null,
  isParticipantSide: boolean,
): string {
  const side = isParticipantSide
    ? "On my principal's behalf"
    : "On the other participant's behalf";
  if (!proposal) return `${side}: the position on the terms stands.`;
  const terms = task.issues
    .map((i) => i.options.find((o) => o.id === proposal[i.id])?.label)
    .filter(Boolean)
    .join(", ");
  return `${side}: ${terms}.`;
}

/**
 * A stable opaque token for a reason id.
 *
 * Not a security measure — the client is not an adversary — but the
 * difference between "the same reason as last turn" (which the budget needs)
 * and "this sentence came from the pool" (which the participant must not
 * learn). NO KIND MARKER, ever: the token is returned with every message, so
 * any marker would label the AI-Supplemented's additions per message for the whole
 * transcript — the judgement OTHER-AI4 asks the participant to make unaided.
 */
function reasonToken(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return `r${Math.abs(h) % 9973}`;
}

/**
 * Recovers each carried token's source — which card, which issue — by
 * re-hashing the known ids for this task and role. The route is stateless;
 * the mapping is rebuilt per request and nothing kind- or issue-shaped ever
 * travels to the client.
 */
function resolveReasonTokens(
  taskId: TaskId,
  role: Role,
  tokens: string[],
): Array<{
  key: string;
  sourceId: string;
  issueId: string | null;
  layer: ReasonCard["layer"] | null;
}> {
  const byToken = new Map<
    string,
    {
      sourceId: string;
      issueId: string | null;
      layer: ReasonCard["layer"] | null;
    }
  >();
  for (const card of getTask(taskId).roleBriefs[role].reasonCards) {
    byToken.set(reasonToken(card.id), {
      sourceId: card.id,
      issueId: card.issueId,
      layer: card.layer,
    });
  }
  return tokens.flatMap((key) => {
    const hit = byToken.get(key);
    return hit ? [{ key, ...hit }] : [];
  });
}

/**
 * Does this message carry the designated card's substance?
 *
 * Content-word overlap, not a substring: the proxies are REQUIRED to reframe
 * a card rather than quote it (§6.6), so an exact match would fail on every
 * correct message. A third of the card's distinctive words is deliberately
 * lenient — the check exists to catch a message that dropped the reason
 * entirely, and a false "it is there" costs far less than re-rolling good
 * reframings in front of a waiting participant.
 */
function mentionsCard(message: string, cardText: string): boolean {
  const words = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4),
    );
  const want = words(cardText);
  if (want.size === 0) return true;
  const have = words(message);
  let hits = 0;
  for (const w of want) if (have.has(w)) hits += 1;
  return hits / want.size >= 0.33;
}


/**
 * The AI-Supplemented's one added clause for this turn (§6.6) is NOT requested in
 * the decidedAction — it is appended to the finished message instead.
 *
 * It rode in the instruction first, and lost. It competed with the card
 * instruction on the same turn, and a card instruction is the more forceful
 * one; the clause survived about one generation in four. Rewording both
 * helped and did not fix it, and softening the card instruction to make room
 * ("no other CARD") then cost the card itself: messages came back carrying
 * the added argument and not the principal's own reason.
 *
 * Both failures are validity defects rather than wording problems. The pool
 * clause IS the AI-Supplemented manipulation, and `voicedPoolId` spends the §6.6
 * budget from the SCHEDULE — so a dropped clause was recorded as voiced and
 * `AI-Supplemented - User-Specified` compared User-Specified against a mostly-User-Specified AI-Supplemented.
 * The card, meanwhile, drives the credibility ladder, so a dropped card
 * credited a participant with a disclosure nobody heard.
 *
 * Appending settles both: the model is asked for exactly one thing (its
 * principal's card), and the addition is placed afterwards, as its own
 * bubble, which is also how §6.6 describes it. `designatedPool` still decides
 * WHETHER and WHICH, so the per-issue and per-task budgets are unchanged.
 */

/**
 * Order the §6.6 sentences so their POSITION carries nothing.
 *
 * If the abstraction always came first (or last), a receiver could sort the
 * principal's own circumstance out of the three by layout alone, and
 * `OTHER-AI2` — "could you tell which reasons the counterpart had selected" —
 * would be measuring a formatting convention instead of the manipulation.
 */
function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A package's levels, written out for a decidedAction. Every move that
 * carries a package must name its levels — a move described only as "the
 * counterpackage" left the model inventing levels in live testing.
 */
function packageSentence(
  task: ReturnType<typeof getTask>,
  pkg: Package,
): string {
  return task.issues
    .map((issue) => {
      const label = issue.options.find((o) => o.id === pkg[issue.id])?.label;
      return `${label ?? "unspecified"} on ${issue.label.toLowerCase()}`;
    })
    .join(", ");
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const task = getTask(body.taskId);
  if (!task) {
    return NextResponse.json({ error: "Unknown task" }, { status: 400 });
  }

  const turn = Number.isInteger(body.turn) ? body.turn : 0;
  if (turn < 0 || turn >= TOTAL_TURNS) {
    return NextResponse.json(
      { error: `turn must be between 0 and ${TOTAL_TURNS - 1}` },
      { status: 400 },
    );
  }

  const counterpartRole: Role =
    body.participantRole === "leader" ? "member" : "leader";
  const { stage, side } = TURN_ORDER[turn];
  const isParticipantSide = side === "participant";
  const actorRole = isParticipantSide ? body.participantRole : counterpartRole;

  // --- the state machine decides the move -------------------------------
  // Both policies build the SAME plan: Design §2.3 puts the difference in
  // reason use, not concession reach.
  const plan = buildProxyPlan(task, body.participantRole, body.mandate);

  const yourRequirement = requirementIssue(task, body.participantRole);
  const theirRequirement = counterRequirementIssue(task, body.participantRole);

  /**
   * The participant side's voiced history, recovered from the carried
   * tokens. The credibility tier reads the VOICED principal cards — a card
   * that was authorized but stripped by a guardrail block earns nothing, and
   * a pool argument is not the principal's reason and never counts (§6.6).
   */
  const resolvedHistory = resolveReasonTokens(
    body.taskId,
    body.participantRole,
    body.reasonsUsed ?? [],
  );
  const voicedCards = resolvedHistory.filter(
    (r) => r.issueId === yourRequirement.id,
  );
  const voicedCardIds = resolvedHistory.map((r) => r.sourceId);
  const tier: ReasonTier = tierOf(
    voicedCards.map((c) => ({ layer: c.layer ?? "work" })),
  );

  /**
   * The counterpart's turn-6 evaluation — recomputed identically at turn 7,
   * because the route is stateless and the participant proxy's close has to
   * answer the same decision the counterpart just rendered.
   */
  const evaluate = () =>
    counterpartStep(
      task,
      counterpartRole,
      5,
      body.lastParticipantPackage ?? plan.tradeProposal,
      {
        tier,
        // The AI-AI exchange has no spare turn for a deferred "why?", so the
        // grace question is spent: the ladder answers directly.
        askedWhy: true,
        numbersReminded: true,
      },
    );

  let proposal: Package | null = null;
  let decidedAction: string;
  /** The card the schedule told this turn to voice (participant side). */
  let designatedCard: ReasonCard | null = null;
  /**
   * The §6.6 sentences an AI-Supplemented proxy renders INSTEAD of the
   * designated sensitive card — the abstraction plus its two covers, shuffled
   * so the abstraction's position carries no signal.
   */
  let abstractedSentences: string[] | null = null;
  let accepted = false;
  /**
   * The AI-AI exchange no longer has a way to end without a package
   * (Ver.2.13 §2.6): the range mandate that could forbid the tier package is
   * gone, so the proxies always settle at the rung the reasons earned. The
   * field stays in the response because the client's loop reads it, and
   * because an emergency stop still ends an exchange without one.
   */
  const impasse = false;
  /** The machine's move, stored beside the sentence for the audit. */
  let counterpartAction: string | null = null;
  /**
   * The stage the model is told and validated against. Usually the turn
   * table's; a closing decision (accept / accept_sb) is stamped stage 6 by
   * the machine, and telling the model "stage 5" while it performs a close
   * produced stage_mismatch blocks in live runs.
   */
  let effectiveStage: StageId = stage;

  if (isParticipantSide) {
    switch (turn) {
      case 1:
        proposal = plan.opening;
        decidedAction = `Open with your principal's preferred package, naming these exact levels: ${packageSentence(task, plan.opening)}.`;
        break;
      case 3: {
        // The first reason opportunity (§6.5): the SB if the principal
        // checked it, otherwise the WR. This is the turn PRE-RECIP-SB reads —
        // it lands before the counterpart's stage-4 disclosure.
        designatedCard = designatedReason(
          task,
          body.participantRole,
          2,
          body.mandate.authorizedReasonIds,
          voicedCardIds,
        );
        // AI-SUPPLEMENTED REPLACES THE CARD, IT DOES NOT DECORATE IT (§6.6).
        // When the designated card is the sensitive one, the proxy renders the
        // fixed abstraction plus two covers instead of the card's own text.
        // The order is shuffled so that position never marks which sentence is
        // the principal's — if the abstraction always came first or last, a
        // receiver could sort them without reading, and OTHER-AI2 would be
        // measuring a layout convention rather than the manipulation.
        const abstracted =
          body.policy === "ai_supplemented" && designatedCard
            ? abstractedReason(designatedCard)
            : null;
        if (abstracted) {
          abstractedSentences = shuffle([
            abstracted.abstract,
            ...abstracted.cover,
          ]);
        }
        const reasonClause = abstractedSentences
          ? ` Render the sentences you are given, all three, as one message under a single frame.`
          : designatedCard
            ? ` To make credible why, give exactly this authorized reason and no other: "${designatedCard.text}"`
            : " Give no reason beyond naming the priority — none has been authorized.";
        decidedAction = `Answer their question: say that ${yourRequirement.label.toLowerCase()} is your principal's priority.${reasonClause}`;
        break;
      }
      case 5:
        proposal = plan.tradeProposal;
        decidedAction = `Propose this conditional exchange, naming these exact levels and no others: ${packageSentence(task, plan.tradeProposal)}. Say plainly that your principal offers ${theirRequirement.label.toLowerCase()} at that level in exchange for holding ${yourRequirement.label.toLowerCase()}.`;
        break;
      default: {
        // Turn 7 — the close, answering the counterpart's turn-6 decision.
        const decision = evaluate();
        if (decision.accepts) {
          proposal = decision.proposal;
          decidedAction = `Confirm the tentative package — ${packageSentence(task, decision.proposal!)} — and say the two principals will close it directly; nothing binds until both confirm.`;
        } else {
          // The counterpart put its symmetric tier package forward. The proxy
          // takes it provisionally — ALWAYS. There is no mandate floor it
          // could fail (Ver.2.13 §2.6): the participant's control is the
          // reason checkboxes before and RATIFY after, so nothing here is the
          // proxy's to refuse on their behalf.
          proposal = decision.proposal;
          accepted = true;
          decidedAction = `Say their proposal works for your principal, and record it as the tentative package: ${packageSentence(task, decision.proposal!)}. The principals confirm it themselves; nothing binds until they do.`;
        }
        break;
      }
    }
  } else {
    switch (turn) {
      case 0: {
        const decision = counterpartStep(task, counterpartRole, 1, null, {
          tier,
          askedWhy: true,
          numbersReminded: true,
        });
        proposal = decision.proposal;
        counterpartAction = decision.action;
        // SCRIPT-OPEN (Ver.2.13 §6.1): the reason and the question, no
        // package. The anchor opening is gone — see the machine's stage 1.
        const openWr = cardOfLayer(task, counterpartRole, "work");
        decidedAction = `Open the exchange. Give your principal's reason by conveying exactly this and nothing more: "${openWr?.text ?? ""}". Then ask which term matters most to the other principal, and why. Propose no levels this turn.`;
        break;
      }
      case 2: {
        // The counterpart's WR, fixed and identical for everyone, plus the
        // question that opens the participant side's reason opportunity.
        const wr = cardOfLayer(task, counterpartRole, "work");
        counterpartAction = "state_priority";
        // The card already states the priority — see the note in the
        // counterpart route about doubled phrasing.
        decidedAction = `Convey your principal's priority with exactly this, and nothing more: "${wr?.text ?? ""}". Then ask what makes the other side's priority so important to their principal.`;
        break;
      }
      case 4: {
        // The fixed SB disclosure (§6.3): once, unconditionally, for every
        // participant, never mirrored to what the participant side said, and
        // carrying no package and no demand.
        const sb = cardOfLayer(task, counterpartRole, "sensitive");
        counterpartAction = "disclose_sb";
        decidedAction = `Share your principal's own background: they have authorized you to say exactly this, in your own words, keeping every fact: "${sb?.text ?? ""}". Attach no demand and no package to it, and do not ask the other side to reciprocate.`;
        // The proxy register is plain sentences rather than chat bubbles, so
        // no split instruction here — see the counterpart route for why the
        // human-voiced disclosure needs one.
        break;
      }
      default: {
        // Turn 6 — the evaluation, by the ladder.
        const decision = evaluate();
        proposal = decision.proposal;
        accepted = decision.accepts;
        counterpartAction = decision.action;
        effectiveStage = decision.stage;
        const levels = decision.proposal
          ? packageSentence(task, decision.proposal)
          : null;
        switch (decision.action) {
          case "accept_sb":
            decidedAction = `Accept exactly these levels: ${levels}. Frame it as an update on what their principal shared — now that you know the situation, this is what makes sense for both sides.`;
            break;
          case "accept":
            decidedAction = `Say the package they proposed works for your principal, naming exactly these levels: ${levels}.`;
            break;
          case "propose_tier":
            // SCRIPT-PROPOSE-T1/T2/T3 — the same move at three depths.
            decidedAction =
              tier === "sensitive"
                ? `Say that what they shared changes the picture, and propose exactly these levels and no others: ${levels}. Frame it as both principals getting what they most need — theirs on ${yourRequirement.label.toLowerCase()}, yours on ${theirRequirement.label.toLowerCase()}.`
                : tier === "work"
                  ? `Say that on that reasoning your principal can move further, and propose exactly these levels and no others: ${levels} — the same amount of movement from each side.`
                  : `Say that neither principal knows much about the other's situation yet, so propose meeting in the middle for now: exactly these levels and no others: ${levels}.`;
            break;
          default:
            // SCRIPT-BALANCE — one side moved further than the other.
            decidedAction = `Say their proposal has one side moving further than the other. Then, in a separate short sentence, put this forward instead, naming exactly these levels: ${levels}.`;
            break;
        }
        break;
      }
    }
  }

  // --- the model says it ------------------------------------------------
  const history = (body.history ?? []).map((m) => ({
    role:
      (m.speaker === "participant_proxy") === isParticipantSide
        ? ("assistant" as const)
        : ("user" as const),
    content: m.text,
  }));

  try {
    // One pass: it returns both halves, and calling it twice repeated a
    // `getTask` plus two filters and two maps on every request.
    const mandateReasons = isParticipantSide
      ? reasonsFor(body.taskId, body.participantRole, body.mandate)
      : null;

    const generate = (correction = "") =>
      generateAction({
      kind: body.policy,
      ctx: {
        task,
        agentRole: actorRole,
        issues: task.issues,
        stage: effectiveStage,
        decidedAction: decidedAction + correction,
        mandateSummary: isParticipantSide
          ? mandateSummary(body.mandate, body.taskId)
          : undefined,
        authorizedReasons: isParticipantSide ? mandateReasons?.authorized : undefined,
        forbiddenReasons: isParticipantSide ? mandateReasons?.forbidden : undefined,
        // THE MODEL IS NO LONGER SHOWN THE POOL. The clause is appended to the
        // finished message instead, so listing it here only offered the model
        // a second thing it might say INSTEAD of its principal's card — and
        // measured live it took that option: on the reason turn the card
        // survived 4 of 4 User-Specified generations against 1 of 4 AI-Supplemented ones.
        // A failure that fires in one arm only, on the reason turn, biases
        // `AI-Supplemented - User-Specified` itself.
        //
        // The User-Specified-side guardrail is unaffected: it reads the action's
        // own `pool:` fields, which a User-Specified never had the pool to fill.
        },
      history,
    });

    /**
     * ONE retry when the designated card went unsaid.
     *
     * The schedule records the card as voiced and the credibility ladder is
     * driven off that record, so a message that quietly omitted it credited
     * the participant with a disclosure nobody ever heard — the ladder's
     * primary outcome, wrong, with nothing in the log to show it. Measured
     * live it happened in roughly one generation in four.
     *
     * A RETRY, NOT A VIOLATION. Marking it hard would swap the whole message
     * for the package-only fallback, which on the reason turn is worse than
     * the problem: the fallback carries no reason at all and nulls the reason
     * token, handing the direct conversation a false "no reason was given".
     * And it cannot simply be appended, because §6.5 requires the proxy to
     * re-voice a card in its own representative voice rather than read it
     * out — pasting the card's own first-person words would break the third
     * person the whole delegation is visible through. Asking again is the
     * only move that keeps both.
     *
     * One retry, not a loop: each turn is a live request in front of a
     * waiting participant, and a second failure is rare enough to accept.
     */
    /**
     * WHAT THIS TURN HAD TO SAY, which is policy-dependent.
     *
     * Under User-Specified it is the card, re-voiced. Under AI-Supplemented
     * the card is never said at all — the §6.6 abstraction stands in for it —
     * so checking for the card's own words there would fail every correct
     * message and retry until it produced a wrong one.
     */
    const requiredText = abstractedSentences
      ? (designatedCard?.abstract ?? null)
      : (designatedCard?.text ?? null);

    let { action, stubbed } = await generate();
    if (
      isParticipantSide &&
      requiredText &&
      !mentionsCard(action.rationale, requiredText)
    ) {
      // The retry says WHAT WENT WRONG rather than repeating the same ask. A
      // bare second roll failed too in live runs — the model does not know it
      // omitted anything, so an identical prompt reproduces the omission.
      //
      // AND IT NEVER TAKES THE TURN DOWN WITH IT. This route already spends
      // ~7.5s on one generation inside Vercel's 60s limit, and a second call
      // is a second chance to time out: one live run lost a whole turn to an
      // ETIMEDOUT raised HERE, after the first generation had already come
      // back perfectly usable. A retry that can fail worse than not retrying
      // is not worth having, so a throw leaves the first attempt standing.
      try {
        const second = await generate(
          ` YOUR LAST ATTEMPT LEFT THE REASON OUT. The message is not acceptable without it. Carry this into the body of the message, in your own representative voice: "${requiredText}"`,
        );
        if (mentionsCard(second.action.rationale, requiredText)) {
          action = second.action;
          stubbed = second.stubbed;
        }
      } catch (retryError) {
        // Logged, not raised: the first attempt is still a valid message.
        console.warn("[proxy-negotiation] card retry failed", retryError);
      }
    }

    // On the participant side the SCHEDULE is the record, not the model's
    // self-report: a model returning a different card id is a reporting
    // error, and budgeting off it could leave a voiced reason unrecorded.
    const voicedReasonId = isParticipantSide
      ? (designatedCard?.id ?? null)
      : null;
    const validation = validateAction(action, {
      issues: task.issues,
      mandate: isParticipantSide ? body.mandate : undefined,
      policy: body.policy,
      actorRole,
      stage: effectiveStage,
      reasonsUsed: isParticipantSide ? resolvedHistory : undefined,
      reasonKey: voicedReasonId ? reasonToken(voicedReasonId) : null,
      reasonIssueId: designatedCard?.issueId ?? null,
      addedReasonKey: null,
      addedReasonIssueId: null,
    });

    // A blocked action loses its WORDING, not the move behind it — dropping
    // the turn would take the machine's package with it.
    const blocked =
      !validation.valid && validation.disposition === "regenerate";

    // WHAT MUST SURVIVE THE CAP, IN PRIORITY ORDER.
    //
    // Under User-Specified that is the principal's card. Under
    // AI-Supplemented the card is never said at all — the three §6.6
    // sentences ARE the message — so the abstraction is protected first and
    // the two covers after it.
    //
    // The ordering is load-bearing and was learned the hard way. Cutting from
    // the end removed whichever clause the model wrote last; protecting the
    // wrong one pushed the reason out while the schedule still recorded it as
    // voiced, so a participant was credited with a disclosure nobody heard.
    // The abstraction comes first for the same reason the card does: it is
    // what the ladder is driven off, and losing a cover sentence costs only
    // some of the cover.
    //
    // Matching is by CONTENT OVERLAP, never containment — a User-Specified
    // proxy is required to re-voice its card rather than quote it, so a
    // containment match would find the verbatim sentences every time and the
    // re-voiced card never.
    const protectedClauses = blocked
      ? null
      : abstractedSentences
        ? abstractedSentences.slice().sort((a, b) => {
            const abstractText = designatedCard?.abstract ?? "";
            return (
              (b === abstractText ? 1 : 0) - (a === abstractText ? 1 : 0)
            );
          })
        : [designatedCard?.text ?? null];

    const text = capMessageLength(
      blocked
        ? fallbackText(task, proposal, isParticipantSide)
        : action.rationale,
      NEGOTIATION.maxMessageChars,
      protectedClauses,
    );

    const message: TranscriptMessage = {
      id: `m${turn}`,
      sessionIndex: body.sessionIndex,
      speaker: isParticipantSide ? "participant_proxy" : "counterpart_proxy",
      text,
      createdAt: new Date().toISOString(),
      stage: effectiveStage,
      ...(proposal ? { proposal } : {}),
      internalProvenance: action.internalProvenance,
    };

    // Provenance is stripped before the response leaves the server: the
    // participant must not be able to tell a pool reason from one of their
    // own — that indistinguishability IS the AI-Supplemented condition.
    const { internalProvenance, ...visible } = message;
    void internalProvenance;

    return NextResponse.json({
      turn,
      stage: effectiveStage,
      message: visible,
      requirementOption: proposal?.[yourRequirement.id] ?? null,
      // The decided move, in machine vocabulary, so the client can store it
      // beside the rendered sentence for the audit. Defensible in the Proxy
      // arm: the participant knows both sides are AI Proxies.
      decidedAction: counterpartAction,
      accepted,
      impasse,
      blocked,
      // FIXED WIDTH, ALWAYS TWO opaque hashes, decoys filling empty slots —
      // presence, absence, or count of real tokens would each name the
      // AI-Supplemented's added turns in the network tab. `resolveReasonTokens`
      // drops decoys server-side, so they spend no budget.
      reasonTokens: [
        isParticipantSide && !blocked && voicedReasonId
          ? reasonToken(voicedReasonId)
          : reasonToken(`nil:a:${turn}`),
        // Always a decoy now. Ver.2.20 has no second reason id to carry — the
        // AI-Supplemented policy replaces the card rather than adding beside
        // it — but the RESPONSE SHAPE must not change, so the slot is padded.
        // An array that were one element under one policy and two under the
        // other is a per-message tell of exactly the kind §7 forbids.
        reasonToken(`nil:b:${turn}`),
      ],
      // What the participant's own proxy voiced THIS TURN, as a tier rung.
      // The direct closing needs it to carry the credibility ladder over —
      // and it must reflect what was actually said, not what was authorized:
      // a guardrail block strips the reason, and assuming it was voiced made
      // the rule inert for every Proxy participant once before. Not a leak:
      // it describes the participant's own card, identically under both
      // policies.
      //
      // SCOPED TO THE REQUIREMENT ISSUE, like every sibling computation
      // (`resolveReasonTokens` here, `personallyVoiced` in the direct
      // closing, the Direct picker). Inert today because
      // `designatedReason` already filters by issue and both cards sit on
      // the requirement term — but unscoped it is the one place a card added
      // on the OTHER term would hand the direct phase a tier the machine's
      // own log refuses to grant.
      voicedTier:
        !blocked &&
        isParticipantSide &&
        designatedCard &&
        designatedCard.issueId === yourRequirement.id
          ? designatedCard.layer === "sensitive"
            ? "sensitive"
            : "work"
          : "none",
      // Violation CODES only — details name red lines and withheld cards.
      guardrailViolations: validation.valid
        ? []
        : validation.violations.map((v) => v.code),
      done: turn + 1 >= TOTAL_TURNS,
      totalTurns: TOTAL_TURNS,
      stubbed,
    });
  } catch (error) {
    console.error("[proxy-negotiation]", error);
    return NextResponse.json(
      { error: "Proxy negotiation failed" },
      { status: 500 },
    );
  }
}
