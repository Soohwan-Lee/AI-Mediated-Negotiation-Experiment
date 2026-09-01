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
 * participant's core issue. Fixed turn order is what keeps Delegate and
 * Explorer matched on message count (pilot gate 9); the Explorer's two pool
 * clauses ride INSIDE turns 3 and 5, never as extra turns.
 *
 * ONE TURN PER REQUEST: the client drives the sequence, each request stays
 * well inside Vercel's 60s limit, and the waiting screen shows real progress.
 */

import { NextResponse } from "next/server";
import { generateAction } from "@/lib/ai/client";
import { validateAction } from "@/lib/ai/validator";
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
  plausibleReasons,
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
  policy: "delegate" | "explorer";
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
      const parts = [`open at ${label(m.issueId, m.preferredOptionId)}`];
      if (m.minimumOptionId) {
        parts.push(
          `may settle as far as ${label(m.issueId, m.minimumOptionId)} and no further`,
        );
      }
      return `- ${issue?.label ?? m.issueId}: ${parts.join(", ")}`;
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
 * any marker would label the Explorer's additions per message for the whole
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
 * Recovers each carried token's source — which card or pool item, which
 * issue, principal or pool — by re-hashing the known ids for this task and
 * role. The route is stateless; the mapping is rebuilt per request and
 * nothing kind- or issue-shaped ever travels to the client.
 */
function resolveReasonTokens(
  taskId: TaskId,
  role: Role,
  tokens: string[],
): Array<{
  key: string;
  sourceId: string;
  issueId: string | null;
  source: "principal" | "pool";
  layer: ReasonCard["layer"] | null;
}> {
  const byToken = new Map<
    string,
    {
      sourceId: string;
      issueId: string | null;
      source: "principal" | "pool";
      layer: ReasonCard["layer"] | null;
    }
  >();
  for (const card of getTask(taskId).roleBriefs[role].reasonCards) {
    byToken.set(reasonToken(card.id), {
      sourceId: card.id,
      issueId: card.issueId,
      source: "principal",
      layer: card.layer,
    });
  }
  plausibleReasons(taskId, role).forEach((item, i) => {
    byToken.set(reasonToken(`pool:${i}`), {
      sourceId: `pool:${i}`,
      issueId: item.issueId,
      source: "pool",
      layer: null,
    });
  });
  return tokens.flatMap((key) => {
    const hit = byToken.get(key);
    return hit ? [{ key, ...hit }] : [];
  });
}

/**
 * The pool item the Explorer adds this turn (Design §6.6: 삽입 여부는 state
 * machine이 지정, task당 최대 2회). SCHEDULED, NOT VOLUNTEERED: the schedule
 * places the core-support item inside turn 3 and the exchange item inside
 * turn 5, so the per-issue cap is satisfied by construction.
 */
function designatedPool(
  taskId: TaskId,
  role: Role,
  issueId: string | null,
  alreadyUsed: readonly string[],
): { id: string; text: string } | null {
  const pool = plausibleReasons(taskId, role);
  const index = pool.findIndex(
    (item, i) => item.issueId === issueId && !alreadyUsed.includes(`pool:${i}`),
  );
  return index === -1 ? null : { id: `pool:${index}`, text: pool[index].text };
}

function poolClause(item: { text: string } | null): string {
  if (!item) return "";
  return ` In the same message, add this one further argument as a short clause: "${item.text}"`;
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
    (r) => r.source === "principal" && r.issueId === yourRequirement.id,
  );
  const voicedCardIds = resolvedHistory
    .filter((r) => r.source === "principal")
    .map((r) => r.sourceId);
  const usedPoolIds = resolvedHistory
    .filter((r) => r.source === "pool")
    .map((r) => r.sourceId);
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
  /** The Explorer's added clause for this turn, when the schedule places one.
   * Boxed so the assignment inside `addPool` survives TS narrowing. */
  const poolBox: { item: { id: string; text: string } | null } = { item: null };
  let accepted = false;
  let impasse = false;
  /** The machine's move, stored beside the sentence for the audit. */
  let counterpartAction: string | null = null;

  const addPool = (issueId: string | null) => {
    if (!isParticipantSide || body.policy !== "explorer") return "";
    poolBox.item = designatedPool(
      body.taskId,
      body.participantRole,
      issueId,
      usedPoolIds,
    );
    return poolClause(poolBox.item);
  };

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
        const reasonClause = designatedCard
          ? ` To make credible why, give exactly this authorized reason and no other: "${designatedCard.text}"`
          : " Give no reason beyond naming the priority — none has been authorized.";
        decidedAction = `Answer their question: say that ${yourRequirement.label.toLowerCase()} is your principal's priority.${reasonClause}${addPool(yourRequirement.id)}`;
        break;
      }
      case 5:
        proposal = plan.tradeProposal;
        decidedAction = `Propose this conditional exchange, naming these exact levels and no others: ${packageSentence(task, plan.tradeProposal)}. Say plainly that your principal offers ${theirRequirement.label.toLowerCase()} at that level in exchange for holding ${yourRequirement.label.toLowerCase()}.${addPool(null)}`;
        break;
      default: {
        // Turn 7 — the close, answering the counterpart's turn-6 decision.
        const decision = evaluate();
        if (decision.accepts) {
          proposal = decision.proposal;
          decidedAction = `Confirm the tentative package — ${packageSentence(task, decision.proposal!)} — and say the two principals will close it directly; nothing binds until both confirm.`;
        } else if (decision.action === "propose_max") {
          // The counterpart itself proposed best↔best (SB voiced). Taking a
          // better-than-asked package is within any mandate.
          proposal = decision.proposal;
          accepted = true;
          decidedAction = `Say their proposal works for your principal, and record it as the tentative package: ${packageSentence(task, decision.proposal!)}. The principals close it directly.`;
        } else {
          // counter_tier. Take it provisionally if it clears the mandate's
          // minimum on the core issue; otherwise leave it for the principals.
          const standing = decision.proposal!;
          const minimumId =
            body.mandate.issues.find((i) => i.issueId === yourRequirement.id)
              ?.minimumOptionId ?? null;
          const order = [...yourRequirement.options].sort(
            (a, b) =>
              b.points[body.participantRole] - a.points[body.participantRole],
          );
          const withinMandate =
            !minimumId ||
            order.findIndex((o) => o.id === standing[yourRequirement.id]) <=
              order.findIndex((o) => o.id === minimumId);
          if (withinMandate) {
            proposal = standing;
            decidedAction = `Say their counterproposal can work provisionally — record ${packageSentence(task, standing)} as the tentative package for the two principals to close directly.`;
          } else {
            impasse = true;
            decidedAction = `Say their proposal on ${yourRequirement.label.toLowerCase()} is below what your principal instructed you to accept, so the two principals will need to settle this directly. Do not agree to anything.`;
          }
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
        decidedAction = `Open with your principal's best package on both terms, naming these exact levels: ${packageSentence(task, decision.proposal!)}.`;
        break;
      }
      case 2: {
        // The counterpart's WR, fixed and identical for everyone, plus the
        // question that opens the participant side's reason opportunity.
        const wr = cardOfLayer(task, counterpartRole, "work");
        counterpartAction = "state_priority";
        decidedAction = `Say that ${theirRequirement.label.toLowerCase()} is your principal's priority, giving exactly this reason: "${wr?.text ?? ""}". Then ask what makes the other side's priority so important to their principal.`;
        break;
      }
      case 4: {
        // The fixed SB disclosure (§6.3): once, unconditionally, for every
        // participant, never mirrored to what the participant side said, and
        // carrying no package and no demand.
        const sb = cardOfLayer(task, counterpartRole, "sensitive");
        counterpartAction = "disclose_sb";
        decidedAction = `Share your principal's own background: they have authorized you to say exactly this, in your own words, keeping every fact: "${sb?.text ?? ""}". Attach no demand and no package to it, and do not ask the other side to reciprocate.`;
        break;
      }
      default: {
        // Turn 6 — the evaluation, by the ladder.
        const decision = evaluate();
        proposal = decision.proposal;
        accepted = decision.accepts;
        counterpartAction = decision.action;
        const levels = decision.proposal
          ? packageSentence(task, decision.proposal)
          : null;
        switch (decision.action) {
          case "accept_sb":
            decidedAction = `Say you did not know that was the situation, that this arrangement is better for both sides than forcing it, and accept exactly these levels: ${levels}.`;
            break;
          case "accept":
            decidedAction = `Say the package they proposed works for your principal, naming exactly these levels: ${levels}.`;
            break;
          case "propose_max":
            decidedAction = `Say that given what they shared, a fuller exchange makes more sense — propose exactly these levels and no others: ${levels}. Frame it as: their principal takes what they need on ${yourRequirement.label.toLowerCase()}, and yours asks for ${theirRequirement.label.toLowerCase()} in return.`;
            break;
          default:
            // counter_tier: SCRIPT-FAIR / SCRIPT-LIMIT.
            decidedAction = `Say that on general grounds alone you cannot go all the way on ${yourRequirement.label.toLowerCase()}, and offer this instead, naming exactly these levels: ${levels}.`;
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
    const { action, stubbed } = await generateAction({
      kind: body.policy,
      ctx: {
        task,
        agentRole: actorRole,
        issues: task.issues,
        stage,
        decidedAction,
        mandateSummary: isParticipantSide
          ? mandateSummary(body.mandate, body.taskId)
          : undefined,
        authorizedReasons: isParticipantSide
          ? reasonsFor(body.taskId, body.participantRole, body.mandate)
              .authorized
          : undefined,
        forbiddenReasons: isParticipantSide
          ? reasonsFor(body.taskId, body.participantRole, body.mandate).forbidden
          : undefined,
        // The pool goes only to the participant's own proxy under Explorer.
        // The counterpart proxy's words are not a measured variable, so it is
        // not given extra latitude to spend.
        plausibleReasons:
          isParticipantSide && body.policy === "explorer"
            ? plausibleReasons(body.taskId, body.participantRole)
            : undefined,
      },
      history,
    });

    // On the participant side the SCHEDULE is the record, not the model's
    // self-report: a model returning a different card id is a reporting
    // error, and budgeting off it could leave a voiced reason unrecorded.
    const voicedReasonId = isParticipantSide
      ? (designatedCard?.id ?? null)
      : null;
    const voicedPoolId = isParticipantSide
      ? (poolBox.item?.id ?? null)
      : null;

    const validation = validateAction(action, {
      issues: task.issues,
      mandate: isParticipantSide ? body.mandate : undefined,
      policy: body.policy,
      actorRole,
      stage,
      reasonsUsed: isParticipantSide ? resolvedHistory : undefined,
      reasonKey: voicedReasonId ? reasonToken(voicedReasonId) : null,
      reasonIssueId: designatedCard?.issueId ?? null,
      addedReasonKey: voicedPoolId ? reasonToken(voicedPoolId) : null,
      addedReasonIssueId: null,
    });

    // A blocked action loses its WORDING, not the move behind it — dropping
    // the turn would take the machine's package with it.
    const blocked =
      !validation.valid && validation.disposition === "regenerate";

    const text = blocked
      ? fallbackText(task, proposal, isParticipantSide)
      : action.rationale;

    const message: TranscriptMessage = {
      id: `m${turn}`,
      sessionIndex: body.sessionIndex,
      speaker: isParticipantSide ? "participant_proxy" : "counterpart_proxy",
      text,
      createdAt: new Date().toISOString(),
      stage,
      ...(proposal ? { proposal } : {}),
      internalProvenance: action.internalProvenance,
    };

    // Provenance is stripped before the response leaves the server: the
    // participant must not be able to tell a pool reason from one of their
    // own — that indistinguishability IS the Explorer condition.
    const { internalProvenance, ...visible } = message;
    void internalProvenance;

    return NextResponse.json({
      turn,
      stage,
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
      // Explorer's added turns in the network tab. `resolveReasonTokens`
      // drops decoys server-side, so they spend no budget.
      reasonTokens: [
        isParticipantSide && !blocked && voicedReasonId
          ? reasonToken(voicedReasonId)
          : reasonToken(`nil:a:${turn}`),
        isParticipantSide && !blocked && voicedPoolId
          ? reasonToken(voicedPoolId)
          : reasonToken(`nil:b:${turn}`),
      ],
      // What the participant's own proxy voiced THIS TURN, as a tier rung.
      // The direct closing needs it to carry the credibility ladder over —
      // and it must reflect what was actually said, not what was authorized:
      // a guardrail block strips the reason, and assuming it was voiced made
      // the rule inert for every Proxy participant once before. Not a leak:
      // it describes the participant's own card, identically under both
      // policies.
      voicedTier:
        !blocked && isParticipantSide && designatedCard
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
