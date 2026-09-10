/**
 * Proxy-condition AI-AI negotiation — one turn per request.
 *
 * WHO DECIDES WHAT. `lib/negotiation/machine` decides the move: which package
 * goes on the table, which reason is voiced when, whether the counterpart
 * concedes, and where the exchange settles. The model is asked only to say
 * that move in the right voice.
 *
 * SEVEN TURNS, SHARED BY BOTH POLICIES (Ver.2.21 §6.10, `proxy-protocol.ts`).
 * Stage 3 is the decision lock, not a message.
 *
 *   0 counterpart proxy  intro + its principal's work reason + the question
 *   1 participant proxy  intro + the reason it is authorized to give
 *   2 counterpart proxy  its own principal's SB only after participant-side SB
 *   3 counterpart proxy  the tier package (T1 with no SB, T2 with one)
 *   4 participant proxy  with an SB: accept. Without: decline once and state
 *                        the priority
 *   5 counterpart proxy  with an SB: confirm. Without: ASKWHY and T1 again
 *   6 participant proxy  accept, and hand the package back for direct mutual confirmation
 *
 * BOTH POLICIES RUN THE SAME TURNS, and that is an exposure control (§7): if
 * one policy simply got more turns to speak in, any difference in what the
 * counterpart learns would be confounded with how much was said. They differ
 * only in the two added work-benefit arguments on each proxy's reason turn.
 *
 * ONE TURN PER REQUEST: the client drives the sequence, each request stays
 * well inside Vercel's 60s limit, and the waiting screen shows real progress.
 */

import { NextResponse } from "next/server";
import {
  PROXY_TURN_ORDER as TURN_ORDER,
  PROXY_TOTAL_TURNS as TOTAL_TURNS,
  PROXY_FIRST_REASON_TURN,
  PROXY_DECLINE_TURN,
} from "@/lib/negotiation/proxy-protocol";
import { generateAction } from "@/lib/ai/client";
import { beginNegotiationAudit } from "@/lib/server/negotiation-audit";
import { capMessageLength, validateAction } from "@/lib/ai/validator";
import { AI_WORK_BENEFITS_SOURCE_ID } from "@/lib/ai/schema";
import { NEGOTIATION } from "@/lib/study-config";
import {
  buildProxyPlan,
  counterpartStep,
  designatedReason,
  foldTier,
  proposalTierNumber,
  proxyAccepts,
  tierOf,
  type ReasonTier,
} from "@/lib/negotiation/machine";
import {
  cardOfLayer,
  counterRequirementIssue,
  getTask,
  requirementIssue,
} from "@/lib/tasks";
import {
  formatProxyReasonBubbles,
  renderProxyReason,
  type ProxyReasonPresentation,
} from "@/lib/proxy-reason-presentation";
import type {
  Mandate,
  NegotiationTask,
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
   * `reasonToken`. The tier needs the kind and the issue, and the server
   * recovers BOTH by re-hashing the known card ids (`resolveReasonTokens`), so
   * the client never holds either.
   */
  reasonsUsed?: string[];
}

/** The mandate, written out for the proxy's prompt. */
function mandateSummary(mandate: Mandate, taskId: TaskId): string {
  // Non-null: only reached from POST, which has already rejected an unknown id.
  const task = getTask(taskId)!;
  const byId = new Map(task.issues.map((i) => [i.id, i]));
  const label = (issueId: string, optionId: string | null) =>
    byId.get(issueId)?.options.find((o) => o.id === optionId)?.label ??
    "unspecified";

  return mandate.issues
    .map((m) => {
      const issue = byId.get(m.issueId);
      // The wish, not a floor (§8.6). Where it settles is the counterpart's
      // tier decision; the wish is what the proxy pushes towards and the line
      // above which it accepts.
      return `- ${issue?.label ?? m.issueId}: they would like ${label(m.issueId, m.preferredOptionId)}`;
    })
    .join("\n");
}

/**
 * The reason cards, split into what the proxy may say and what it may not.
 *
 * Unchecked facts never enter the rendering prompt. The machine chooses
 * the package without asking the language model to infer private priorities.
 *
 * THE WORK CARD IS ALWAYS AUTHORIZED (§8.7, Ver.2.21). The mandate screen
 * shows it ticked and locked, so it should always be in `authorizedReasonIds`
 * — but this folds it in regardless, because a client that dropped it would
 * create the "no reason at all" proxy path §8.7 deleted, and the participant
 * has no control that could have asked for it.
 */
function reasonsFor(taskId: TaskId, role: Role, mandate: Mandate) {
  // Non-null: only reached from POST, which has already rejected an unknown id.
  const task = getTask(taskId)!;
  const cards = task.roleBriefs[role].reasonCards;
  const issueLabel = (issueId: string) =>
    task.issues.find((i) => i.id === issueId)?.label;
  const allowed = (c: ReasonCard) =>
    c.layer === "work" || mandate.authorizedReasonIds.includes(c.id);
  const pick = (authorized: boolean) =>
    cards
      .filter((c) => allowed(c) === authorized)
      .map((c) => ({
        id: c.id,
        text: c.text,
        issueLabel: issueLabel(c.issueId),
        sensitive: c.layer === "sensitive",
      }));
  return { authorized: pick(true), forbidden: pick(false) };
}

/**
 * The card ids this proxy may voice: the work card always, the sensitive one
 * only when checked. `designatedReason` reads this rather than the raw
 * mandate, for the §8.7 reason above.
 */
function effectiveAuthorizedIds(
  task: NegotiationTask,
  role: Role,
  mandate: Mandate,
): string[] {
  const work = cardOfLayer(task, role, "work");
  const ids = new Set(mandate.authorizedReasonIds);
  if (work) ids.add(work.id);
  return [...ids];
}

/**
 * What a proxy says when the model's wording was blocked: plain,
 * package-only, no rationale — a rationale is exactly the thing most likely
 * to have been blocked.
 */
function fallbackText(
  task: NegotiationTask,
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
 * difference between "the same reason as last turn" (which the tier needs)
 * and "this sentence was the sensitive one" (which the participant must not
 * learn). NO KIND MARKER, ever: the token is returned with every message, so
 * any marker would label the AI-Supplemented's abstraction per message for the
 * whole transcript, so receiver-side judgements are not cued by the wire
 * unaided.
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
  for (const card of getTask(taskId)!.roleBriefs[role].reasonCards) {
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
 * A package's levels, written out for a decidedAction. Every move that
 * carries a package must name its levels — a move described only as "the
 * counterpackage" left the model inventing levels in live testing.
 */
function packageSentence(task: NegotiationTask, pkg: Package): string {
  return task.issues
    .map((issue) => {
      const label = issue.options.find((o) => o.id === pkg[issue.id])?.label;
      return `${label ?? "unspecified"} on ${issue.label.toLowerCase()}`;
    })
    .join(", ");
}

function validProxyPackage(
  task: NegotiationTask,
  value: unknown,
): value is Package | null | undefined {
  if (value === undefined || value === null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const pack = value as Record<string, unknown>;
  if (Object.keys(pack).length !== task.issues.length) return false;
  return task.issues.every(
    (issue) =>
      typeof pack[issue.id] === "string" &&
      issue.options.some((option) => option.id === pack[issue.id]),
  );
}

function validMandate(
  task: NegotiationTask,
  role: Role,
  sessionIndex: 1 | 2,
  value: unknown,
): value is Mandate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const mandate = value as Record<string, unknown>;
  if (mandate.sessionIndex !== sessionIndex) return false;
  if (!Number.isInteger(mandate.revisionCount) || Number(mandate.revisionCount) < 0) {
    return false;
  }
  if (!Array.isArray(mandate.issues) || mandate.issues.length !== task.issues.length) {
    return false;
  }
  const issueRows = mandate.issues as Array<Record<string, unknown>>;
  if (issueRows.some((row) => typeof row !== "object" || row === null)) return false;
  const seenIssues = new Set(issueRows.map((row) => row.issueId));
  if (seenIssues.size !== task.issues.length) return false;
  if (
    task.issues.some((issue) => {
      const row = issueRows.find((candidate) => candidate.issueId === issue.id);
      return (
        !row ||
        typeof row.preferredOptionId !== "string" ||
        !issue.options.some((option) => option.id === row.preferredOptionId)
      );
    })
  ) {
    return false;
  }
  if (!Array.isArray(mandate.authorizedReasonIds)) return false;
  const authorized = mandate.authorizedReasonIds;
  if (authorized.some((id) => typeof id !== "string")) return false;
  if (new Set(authorized).size !== authorized.length) return false;
  const ownCardIds = new Set(task.roleBriefs[role].reasonCards.map((card) => card.id));
  return authorized.every((id) => ownCardIds.has(id));
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const task = getTask(body.taskId);
  if (!task) {
    return NextResponse.json({ error: "Unknown task" }, { status: 400 });
  }
  // A bad role reaches `requirementIssue`'s non-null assertion and 500s with
  // no JSON body, where every sibling route answers a clean 400.
  if (body.participantRole !== "leader" && body.participantRole !== "member") {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }
  if (
    body.policy !== "user_specified" &&
    body.policy !== "ai_supplemented"
  ) {
    return NextResponse.json({ error: "Unknown policy" }, { status: 400 });
  }
  if (body.sessionIndex !== 1 && body.sessionIndex !== 2) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }
  if (!validMandate(task, body.participantRole, body.sessionIndex, body.mandate)) {
    return NextResponse.json({ error: "Invalid mandate" }, { status: 400 });
  }
  if (
    body.history !== undefined &&
    (!Array.isArray(body.history) ||
      body.history.some(
        (entry) =>
          typeof entry !== "object" ||
          entry === null ||
          ![
            "participant",
            "counterpart",
            "participant_proxy",
            "counterpart_proxy",
            "counterpart_principal",
            "system",
          ].includes(entry.speaker) ||
          typeof entry.text !== "string",
      ))
  ) {
    return NextResponse.json({ error: "Invalid history" }, { status: 400 });
  }
  if (
    !validProxyPackage(task, body.lastParticipantPackage) ||
    !validProxyPackage(task, body.lastCounterpartPackage)
  ) {
    return NextResponse.json({ error: "Invalid package" }, { status: 400 });
  }
  if (
    body.reasonsUsed !== undefined &&
    (!Array.isArray(body.reasonsUsed) ||
      body.reasonsUsed.some((token) => typeof token !== "string"))
  ) {
    return NextResponse.json({ error: "Invalid reason history" }, { status: 400 });
  }

  const turn = body.turn;
  if (!Number.isInteger(turn) || turn < 0 || turn >= TOTAL_TURNS) {
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
  const authorizedIds = effectiveAuthorizedIds(
    task,
    body.participantRole,
    body.mandate,
  );

  const yourRequirement = requirementIssue(task, body.participantRole);
  const theirRequirement = counterRequirementIssue(task, body.participantRole);

  /**
   * The participant side's voiced history, recovered from the carried tokens.
   *
   * THE TIER READS WHAT WAS VOICED, NOT WHAT WAS AUTHORIZED. A card that was
   * checked but stripped by a guardrail block earns nothing, and assuming
   * otherwise made the rule inert for a whole arm once already. The proxy's
   * own floor is folded in separately below.
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

  /**
   * THE TIER, AND THE PROXY'S FLOOR IS T1 (Ver.2.21, 12th correction).
   *
   * Through Ver.2.20 this folded in a `priority` rung, because a proxy holds
   * its principal's preferred package and so always knows which term matters
   * more and says so. That put the proxy's floor a rung above a Direct
   * participant's and a mechanical Mode difference straight into Points and
   * JOINT. With the priority rung gone the proxy still states the priority and
   * still declines the first T1 offer; it simply earns nothing for it, and both
   * arms floor at the same rung — which is what removed the old §13-13②.
   *
   * `work` is folded in unconditionally because the work reason is a FIXED
   * utterance (§8.7): the proxy says it whether or not the id reached here.
   */
  const tier: ReasonTier = foldTier(
    tierOf(voicedCards.map((c) => ({ layer: c.layer ?? "work" }))),
    "work",
  );

  /**
   * The counterpart's evaluation at turn 5 — recomputed identically at turn 6,
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
        disclosurePolicy: "reciprocal",
        counterpartSbDisclosed: true,
        // The AI-AI exchange spends its one ASKWHY at turn 5 by script, not by
        // the machine's own bookkeeping, so the flag is set here.
        askedWhy: true,
        numbersReminded: true,
      },
    );

  let proposal: Package | null = null;
  let decidedAction: string;
  /** The card the schedule told this turn to voice (participant side). */
  let designatedCard: ReasonCard | null = null;
  /** Trusted visible wording for the designated reason, if this turn has one. */
  let reasonPresentation: ProxyReasonPresentation | null = null;
  let accepted = false;
  /**
   * The AI-AI exchange has no way to end without a package (§2.6): the range
   * mandate that could forbid the tier package is gone, so the proxies always
   * settle at the rung the reasons earned. The field stays in the response
   * because the client's loop reads it, and because an emergency stop still
   * ends an exchange without one.
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

  const principal =
    body.participantRole === "leader" ? "the team lead" : "the team member";

  if (isParticipantSide) {
    if (turn === PROXY_FIRST_REASON_TURN) {
      // THE FIRST REASON OPPORTUNITY (§6.5). The SB if the principal checked
      // it, otherwise the WR. `SB` — the confirmatory disclosure outcome —
      // records whether the participant side's SB was out at THIS turn, so a
      // schedule that held it back would record every Proxy participant as a
      // non-discloser regardless of what they authorized.
      designatedCard = designatedReason(
        task,
        body.participantRole,
        2,
        authorizedIds,
        voicedCardIds,
      );
      proposal = plan.opening;

      designatedCard ??= cardOfLayer(
        task,
        body.participantRole,
        "work",
      ) ?? null;
      if (designatedCard) {
        reasonPresentation = renderProxyReason(
          task,
          body.participantRole,
          designatedCard,
          body.policy,
        );
      }
      decidedAction = `Introduce yourself as the AI Proxy negotiating for ${principal} you represent, answer their question, and use the complete required reason presentation exactly as supplied. Keep its base unchanged. If it includes an AI addition, keep the transition and both benefits in order. Propose no levels this turn.`;
    } else if (turn === PROXY_DECLINE_TURN) {
      // The counterpart has put its tier package up. With an SB authorized the
      // exchange is already at T2 and the proxy simply accepts; without one it
      // declines ONCE and states the priority — which buys nothing (§3.3) but
      // is what a proxy holding its principal's wish would say.
      const decision = evaluate();
      const offered = decision.proposal;
      const takesIt = proxyAccepts(
        task,
        body.participantRole,
        offered,
        plan,
        tier === "sensitive" ? 0 : 1,
      );

      if (takesIt && offered) {
        proposal = offered;
        accepted = true;
        effectiveStage = 6;
        decidedAction = `Say that what they have put forward works for ${principal} you represent, naming exactly these levels: ${packageSentence(task, offered)}. Say you will take it back to them as a provisional package; nothing binds until they confirm it.`;
      } else {
        proposal = plan.tradeProposal;
        decidedAction = `Decline the package they just put forward — say it is not what ${principal} you represent was hoping for — and say plainly that ${yourRequirement.label.toLowerCase()} matters more to them than ${theirRequirement.label.toLowerCase()}. Give no new background. Keep it to two short sentences.`;
      }
    } else {
      // The last participant turn — the close, answering the counterpart's
      // previous decision. The proxy takes what is on the table as the
      // tentative package: there is no mandate floor it could fail (§2.6), and
      // the participant confirms the final terms directly afterwards.
      const decision = evaluate();
      const settle = decision.proposal ?? plan.tentative;
      proposal = settle;
      accepted = true;
      effectiveStage = 6;
      decidedAction = settle
        ? `Say their proposal works for ${principal} you represent, and record it as the tentative package: ${packageSentence(task, settle)}. Say that ${principal} you represent reviews and decides; nothing binds until they confirm it.`
        : `Say you will take the position back to ${principal} you represent for their decision; nothing binds until they confirm it.`;
    }
  } else {
    if (turn === 0) {
      const decision = counterpartStep(task, counterpartRole, 1, null, {
        tier,
        disclosurePolicy: "reciprocal",
        askedWhy: true,
        numbersReminded: true,
      });
      proposal = decision.proposal;
      counterpartAction = decision.action;
      // SCRIPT-OPEN (§6.1, §6.4): its principal's work reason — which names
      // BOTH terms — and the question. No package and no priority of its own.
      const openWr = cardOfLayer(task, counterpartRole, "work");
      designatedCard = openWr ?? null;
      const participantSb = cardOfLayer(
        task,
        body.participantRole,
        "sensitive",
      );
      const participantSbAuthorized = Boolean(
        participantSb && authorizedIds.includes(participantSb.id),
      );
      if (openWr) {
        reasonPresentation = renderProxyReason(
          task,
          counterpartRole,
          openWr,
          body.policy === "ai_supplemented" && participantSbAuthorized
            ? "user_specified"
            : body.policy,
        );
      }
      decidedAction = `Open the exchange. Introduce yourself as the AI Proxy negotiating for the ${counterpartRole === "leader" ? "team lead" : "team member"} you represent. Use the complete required reason presentation exactly as supplied, then ask what the situation is on the other side. Do not say which term matters most and propose no levels this turn.`;
    } else if (turn === 2 && tier !== "sensitive") {
      // No participant SB was actually voiced. Keep this matched turn WR-only.
      counterpartAction = "acknowledge_work";
      effectiveStage = 5;
      decidedAction = "Acknowledge that both terms matter on both sides. Say you can work toward a balanced package. Give no new reason, background, priority, or private fact, and attach no package yet.";
    } else if (turn === 2) {
      // Participant-side SB was actually voiced, so reciprocate once.
      const sb = cardOfLayer(task, counterpartRole, "sensitive");
      designatedCard = sb ?? null;
      counterpartAction = "disclose_sb";
      if (sb) {
        reasonPresentation = renderProxyReason(
          task,
          counterpartRole,
          sb,
          body.policy,
        );
      }
      decidedAction = `Use the complete required reason presentation exactly as supplied, keeping its factual base unchanged. If it includes an AI addition, keep the transition and both benefits in order. Attach no package or request, and do not add that the term cannot be changed.`;
      // The proxy register is plain sentences rather than chat bubbles, so no
      // split instruction here — see the counterpart route for why the
      // human-voiced disclosure needs one.
    } else if (turn === 3) {
      // The tier package: T1 with no SB, T2 with one. Proposed rather than
      // left to be discovered (§3.3), so SB voicing is the only bottleneck to
      // the maximum and negotiation skill cannot separate outcomes.
      const decision = counterpartStep(task, counterpartRole, 5, null, {
        tier,
        disclosurePolicy: "reciprocal",
        counterpartSbDisclosed: true,
        askedWhy: true,
        numbersReminded: true,
      });
      proposal = decision.proposal;
      counterpartAction = decision.action;
      decidedAction =
        proposalTierNumber(tier) === 2
          ? `Say that what they shared changes the picture, and propose exactly these levels and no others: ${packageSentence(task, proposal!)}. Frame it as both principals getting what they most need — theirs on ${yourRequirement.label.toLowerCase()}, yours on ${theirRequirement.label.toLowerCase()}. Do not ask for any more private detail.`
          : `Say that if both terms matter on their side too, the fair thing is for each principal to move halfway, and propose exactly these levels and no others: ${packageSentence(task, proposal!)}.`;
    } else {
      // Turn 5 — the counterpart's answer to the participant proxy's move.
      // With an SB it confirms; without one it asks why, once, and puts the
      // same T1 package back up (§6.10).
      const decision = evaluate();
      proposal = decision.proposal;
      accepted = decision.accepts;
      counterpartAction = decision.action;
      effectiveStage = decision.stage;
      const levels = decision.proposal
        ? packageSentence(task, decision.proposal)
        : null;

      if (tier !== "sensitive") {
        // SCRIPT-ASKWHY, in the representative's third person (§6.4): "the
        // team lead I represent would have to be able to explain it upward".
        counterpartAction = "ask_why";
        decidedAction = `They have said ${yourRequirement.label.toLowerCase()} matters more to their principal but have not said why. Say you understand that, and that you would like to hear the reason — the ${counterpartRole === "leader" ? "team lead" : "team member"} you represent has to be able to explain it upward. Then say that until then this stays on the table: ${levels}. Ask once, without pressing.`;
      } else if (decision.accepts) {
        decidedAction = `Accept exactly these levels: ${levels}. Frame it as an update on what came out about their principal's side — now that you know the situation, this is what makes sense for both principals.`;
      } else {
        decidedAction = `Say their proposal has one principal moving further than the other. Then, in a separate short sentence, put this forward instead, naming exactly these levels: ${levels}.`;
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
    const audit = await beginNegotiationAudit(request, { ...body,
      role: body.participantRole, messageId: `m${turn}` }, "proxy");
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
          authorizedReasons: isParticipantSide
            ? mandateReasons?.authorized.filter((reason) =>
                reason.id === designatedCard?.id,
              )
            : undefined,
          // Unchecked facts never enter a language-generation prompt.
          forbiddenReasons: undefined,
          reasonPresentation: reasonPresentation ?? undefined,
        },
        history,
      });

    const generated = await generate();
    const stubbed = generated.stubbed;
    // Visible reason content and provenance come only from the trusted task
    // renderer. Model omissions, paraphrases, and invented facts cannot change
    // either policy or claim a disclosure that was never actually shown.
    const actorPrincipal = actorRole === "leader" ? "team lead" : "team member";
    const reasonBubbles = reasonPresentation
      ? [
          ...(turn === 0 || turn === PROXY_FIRST_REASON_TURN
            ? [`I am the AI Proxy negotiating for the ${actorPrincipal} I represent.`]
            : []),
          formatProxyReasonBubbles(reasonPresentation),
          ...(turn === 0 ? ["What is the situation on your side?"] : []),
        ].join(" || ")
      : null;
    const levels = proposal ? packageSentence(task, proposal) : "";
    const scheduledText =
      turn === 2
        ? "Both terms matter on both sides. We can work toward a balanced package."
        : turn === PROXY_DECLINE_TURN && !accepted
          ? `That is not what the ${actorPrincipal} I represent was hoping for. ${yourRequirement.label} matters more to them than ${theirRequirement.label.toLowerCase()}.`
          : turn === 5 && tier !== "sensitive"
            ? `I understand that it matters more to them. What is the reason? The ${actorPrincipal} I represent needs to be able to explain it upward. || Until then, this stays on the table: ${levels}.`
            : accepted
              ? `These terms work for the ${actorPrincipal} I represent: ${levels}. || This is a tentative package for both principals to review and confirm.`
              : `I propose these terms: ${levels}.`;
    const action = {
      ...generated.action,
      rationale: reasonBubbles ?? scheduledText,
      reasonSourceId: designatedCard?.id ?? null,
      addedReasonSourceId: reasonPresentation?.addition
        ? AI_WORK_BENEFITS_SOURCE_ID
        : null,
      internalProvenance: reasonPresentation?.addition
        ? "principal_reason_with_ai_work_benefits" as const
        : "principal_reason" as const,
    };

    // On the participant side the SCHEDULE is the record, not the model's
    // self-report: a model returning a different card id is a reporting
    // error, and reading the tier off it could leave a voiced reason
    // unrecorded.
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
      // The work card is a fixed utterance (§8.7); the mandate may not carry
      // its id, so the validator is told what this proxy may actually say.
      authorizedReasonIds: isParticipantSide ? authorizedIds : undefined,
    });

    // A blocked action loses its WORDING, not the move behind it — dropping
    // the turn would take the machine's package with it.
    const blocked =
      !validation.valid && validation.disposition === "regenerate";

    // Canonical reason bubbles are exempt from the ordinary conversational
    // cap: every authorized fact and both benefits must survive in full.
    const text = blocked
      ? capMessageLength(
          fallbackText(task, proposal, isParticipantSide),
          NEGOTIATION.maxMessageChars,
        )
      : action.rationale;

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

    await audit({ input: body, generatedAction: generated.action, action,
      validation, blocked, message, reasonCardId: designatedCard?.id ?? null,
      decidedAction: counterpartAction, accepted, impasse, tier });

    // Keep internal source bookkeeping server-side.
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
      // presence, absence, or count of real tokens would each name the turns
      // that carried a reason in the network tab. `resolveReasonTokens` drops
      // decoys server-side, so they spend no budget and satisfy no rule.
      reasonTokens: [
        isParticipantSide && !blocked && voicedReasonId
          ? reasonToken(voicedReasonId)
          : reasonToken(`nil:a:${turn}`),
        // Public work benefits are not a second private reason or tier credit.
        reasonToken(`nil:b:${turn}`),
      ],
      // WHAT THE PARTICIPANT'S OWN PROXY VOICED THIS TURN, as a tier rung.
      // The direct closing needs it to carry the credibility ladder over — and
      // it must reflect what was actually SAID, not what was authorized: a
      // guardrail block strips the reason, and assuming it was voiced made the
      // rule inert for every Proxy participant once before. Not a leak: it
      // describes the participant's own card, identically under both policies.
      //
      // SCOPED TO THE REQUIREMENT ISSUE, like every sibling computation. Inert
      // today because `designatedReason` already filters by issue and both
      // cards sit on the requirement term — but unscoped it is the one place a
      // card added on the OTHER term would hand the closing a tier the
      // machine's own log refuses to grant.
      //
      // THE FLOOR IS `work`, NOT `priority` (Ver.2.21). The proxy always says
      // the work reason (§8.7) and always states the priority, and neither
      // moves the ladder any more — so the rung it hands to the closing is T1
      // unless the SB was actually voiced. Both ends use `foldTier` and the
      // shared `ReasonTier`; do not re-type this value locally.
      voicedTier: foldTier(
        !blocked &&
          isParticipantSide &&
          designatedCard &&
          designatedCard.issueId === yourRequirement.id
          ? designatedCard.layer === "sensitive"
            ? "sensitive"
            : "work"
          : "none",
        isParticipantSide ? "work" : "none",
      ),
      // Violation CODES only — details name withheld cards.
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
