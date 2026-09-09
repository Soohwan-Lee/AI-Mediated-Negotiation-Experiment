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
 *   2 counterpart proxy  its own principal's SB, on the FIXED schedule
 *   3 counterpart proxy  the tier package (T1 with no SB, T2 with one)
 *   4 participant proxy  with an SB: accept. Without: decline once and state
 *                        the priority (AI-Supplemented adds cover ① here)
 *   5 counterpart proxy  with an SB: confirm. Without: ASKWHY and T1 again
 *   6 participant proxy  accept, and hand the package back for RATIFY
 *
 * BOTH POLICIES RUN THE SAME TURNS, and that is an exposure control (§7): if
 * one policy simply got more turns to speak in, any difference in what the
 * counterpart learns would be confounded with how much was said. They differ
 * only in the WORDING of the participant proxy's reason turns.
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
import { capMessageLength, validateAction } from "@/lib/ai/validator";
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
  abstractedReason,
  requirementIssue,
} from "@/lib/tasks";
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
 * Both lists go into the prompt. Design §12 P3 requires the unchecked cards
 * to be present so the proxy can let them inform WHICH PACKAGE it chooses
 * while never putting them into words.
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
 * whole transcript — the judgement OTHER-AI4 asks the participant to make
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
 * Does this message carry the designated clause's substance?
 *
 * Content-word overlap, not a substring: the proxies are REQUIRED to reframe
 * a card rather than quote it (§6.5, §6.6), so an exact match would fail on
 * every correct message. A third of the clause's distinctive words is
 * deliberately lenient — the check exists to catch a message that dropped the
 * reason entirely, and a false "it is there" costs far less than re-rolling
 * good reframings in front of a waiting participant.
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
 * Did this message already carry the §6.6 frame?
 *
 * NOT `mentionsCard`, AND THE DIFFERENCE MATTERS. That function asks whether a
 * FACT survived, at a deliberately lenient third of its distinctive words. The
 * frame shares most of its vocabulary with any correct message on this turn —
 * "member", "represent", "presentations" — so it scored exactly 0.33 against a
 * message that did not contain it at all, and the insertion never fired.
 *
 * The frame's job is to present the sentences as a COUNTED set of reasons the
 * proxy is giving on its own account, so that is what is tested for: the count
 * phrase, plus a recommendation about the term. Both halves, because either
 * alone appears in messages that are not framed.
 */
function carriesFrame(message: string, frame: string): boolean {
  const counted = /\b(three|3)\s+reasons\b|\breasons are\b|\bfor three\b/i;
  if (!counted.test(message)) return false;
  // The recommendation: the model may paraphrase "I think the office days
  // should stay at four" freely, so this looks for the shape rather than the
  // wording, and falls back to the frame's own distinctive words.
  const recommends =
    /\bI think\b|\bshould (stay|come down|be|remain)\b|\blooking at\b|\bhaving (looked|reviewed)\b|\breviewed\b/i;
  if (recommends.test(message)) return true;
  const words = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 5),
    );
  const want = words(frame);
  if (want.size === 0) return true;
  const have = words(message);
  let hits = 0;
  for (const w of want) if (have.has(w)) hits += 1;
  return hits / want.size >= 0.6;
}

/**
 * Order the §6.6 sentences so their POSITION carries nothing.
 *
 * If the abstraction always came first (or last), a receiver could sort the
 * principal's own circumstance out of the three by layout alone, and
 * `OTHER-AI2` — "could you tell which reasons the counterpart had selected" —
 * would be measuring a formatting convention instead of the manipulation.
 *
 * THE FRAME IS NOT SHUFFLED. It is the proxy's own opening line and always
 * leads: "Looking at the side of the team member I represent, I think... Three
 * reasons —". It says nothing about any of the three and is identical whether
 * or not the abstraction is among them.
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
function packageSentence(task: NegotiationTask, pkg: Package): string {
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
        disclosurePolicy: "fixed",
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
  /**
   * The §6.6 sentences an AI-Supplemented proxy renders INSTEAD of the
   * designated sensitive card — the abstraction plus its two covers, shuffled
   * so the abstraction's position carries no signal.
   */
  let abstractedSentences: string[] | null = null;
  /** The frame those sentences sit under — the proxy's own assessment. */
  let supplementedFrame: string | null = null;
  /** Cover ① on the decline turn, when no SB was authorized (§6.6 rule b). */
  let supplementalReason: string | null = null;
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

      // AI-SUPPLEMENTED REPLACES THE CARD, IT DOES NOT DECORATE IT (§6.6).
      // When the designated card is the sensitive one, the proxy renders its
      // own frame plus the fixed abstraction and two covers instead of the
      // card's text. The three are shuffled so position never marks which is
      // the principal's — if the abstraction always came first or last, a
      // receiver could sort them without reading, and OTHER-AI2 would be
      // measuring a layout convention rather than the manipulation.
      const abstracted =
        body.policy === "ai_supplemented" &&
        designatedCard?.layer === "sensitive"
          ? abstractedReason(designatedCard)
          : null;
      if (abstracted) {
        supplementedFrame = abstracted.frame;
        abstractedSentences = shuffle([
          abstracted.abstract,
          ...abstracted.cover,
        ]);
      }

      if (abstractedSentences) {
        decidedAction = `Introduce yourself as the AI Proxy negotiating for ${principal} you represent, and answer their question. Then give your own assessment: open with the frame you are given, and render the three sentences you are given, in the order given, as one natural message. They are plain statements with no attribution — never say who told you any of them. Propose no levels this turn.`;
      } else if (designatedCard?.layer === "sensitive") {
        decidedAction = `Introduce yourself as the AI Proxy negotiating for ${principal} you represent, and answer their question. Relay exactly this authorized background, in your own representative voice, keeping every fact — the event, the third party, and the fact it was not passed on: "${designatedCard.text}". Do not add that the term cannot be changed. Propose no levels this turn.`;
      } else {
        decidedAction = `Introduce yourself as the AI Proxy negotiating for ${principal} you represent, and answer their question with this work reason and nothing more: "${designatedCard?.text ?? cardOfLayer(task, body.participantRole, "work")?.text ?? ""}". Do not say yet which term matters more. Propose no levels this turn.`;
      }
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
        if (body.policy === "ai_supplemented") {
          // §6.6 RULE (b), and it is the one place the policy difference shows
          // on the WR-only path. Cover ① is WR-GRADE role generality — it
          // cannot move the tier, and is said as the PROXY's own view rather
          // than as anything the principal said. Fixed, not shuffled: there is
          // only one, and sessions have to be comparable.
          supplementalReason =
            cardOfLayer(task, body.participantRole, "sensitive")?.cover?.[0] ??
            null;
          if (supplementalReason) {
            decidedAction += ` Then add this as your own view, prefaced that way ("and in my view..."): "${supplementalReason}". Do not present it as anything your principal told you, and add no private fact.`;
          }
        }
      }
    } else {
      // The last participant turn — the close, answering the counterpart's
      // previous decision. The proxy takes what is on the table as the
      // tentative package: there is no mandate floor it could fail (§2.6), and
      // the participant's control is the checkbox before and RATIFY after.
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
        disclosurePolicy: "fixed",
        askedWhy: true,
        numbersReminded: true,
      });
      proposal = decision.proposal;
      counterpartAction = decision.action;
      // SCRIPT-OPEN (§6.1, §6.4): its principal's work reason — which names
      // BOTH terms — and the question. No package and no priority of its own.
      const openWr = cardOfLayer(task, counterpartRole, "work");
      decidedAction = `Open the exchange. Introduce yourself as the AI Proxy negotiating for the ${counterpartRole === "leader" ? "team lead" : "team member"} you represent. Give their reason by conveying exactly this and nothing more: "${openWr?.text ?? ""}". Do NOT say which of the two terms matters most to them. Then ask what the situation is on the other side. Propose no levels this turn.`;
    } else if (turn === 2) {
      // THE FIXED SB DISCLOSURE (§6.3). While the participant is WATCHING, the
      // counterpart proxy always discloses — Direct's reciprocity rule does
      // NOT apply here — so a Proxy participant's receiver experience is the
      // same in every cell.
      const sb = cardOfLayer(task, counterpartRole, "sensitive");
      designatedCard = sb ?? null;
      counterpartAction = "disclose_sb";
      // THE COUNTERPART PROXY USES THE SAME POLICY'S FORM. Under
      // AI-Supplemented the participant is a RECEIVER of an abstraction, which
      // is what OTHER-AI2 and OTHER-AI3 ask about; relaying the counterpart's
      // card whole here would leave that half of the manipulation unrun.
      const summarized =
        body.policy === "ai_supplemented" && sb ? abstractedReason(sb) : null;
      if (summarized) {
        supplementedFrame = summarized.frame;
        abstractedSentences = shuffle([
          summarized.abstract,
          ...summarized.cover,
        ]);
        decidedAction = `Give your own assessment of your principal's side: open with the frame you are given, then render the three sentences you are given, in the order given, as one natural message. They are plain statements with no attribution — never say who told you any of them, and never restore the full private story. Attach no package and no request.`;
      } else {
        decidedAction = `Share your principal's own background: they have authorized you to say exactly this, in your own representative voice, keeping every fact: "${sb?.text ?? ""}". Attach no demand and no package to it, do not ask the other side to reciprocate, and do not add that the term cannot be changed.`;
      }
      // The proxy register is plain sentences rather than chat bubbles, so no
      // split instruction here — see the counterpart route for why the
      // human-voiced disclosure needs one.
    } else if (turn === 3) {
      // The tier package: T1 with no SB, T2 with one. Proposed rather than
      // left to be discovered (§3.3), so SB voicing is the only bottleneck to
      // the maximum and negotiation skill cannot separate outcomes.
      const decision = counterpartStep(task, counterpartRole, 5, null, {
        tier,
        disclosurePolicy: "fixed",
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
            ? mandateReasons?.authorized
            : undefined,
          forbiddenReasons: isParticipantSide
            ? mandateReasons?.forbidden
            : undefined,
          // THE §6.6 FRAME AND SENTENCES, WHEN THIS TURN RENDERS THEM. Handed
          // over already shuffled: the abstraction's POSITION must carry no
          // information, or a receiver could sort the principal's own
          // circumstance out of the three by layout alone and OTHER-AI2 would
          // be measuring a formatting convention.
          //
          // They REPLACE the card here rather than being appended afterwards,
          // because under §6.6 the three sentences ARE the message — there is
          // no card text for them to sit beside.
          //
          // This is the wire that broke silently once: the sentences were
          // computed, protected in the cap and used for the retry check, and
          // never put into the prompt — so P4 rendered "(none this turn)" and
          // the model improvised. The AI-Supplemented arm ran as a paraphrase
          // of User-Specified with a plausible transcript and wrong data.
          supplementedFrame: supplementedFrame ?? undefined,
          abstractedSentences: abstractedSentences ?? undefined,
        },
        history,
      });

    /**
     * WHAT THIS TURN HAD TO SAY, which is policy-dependent.
     *
     * Under User-Specified it is the card, re-voiced. Under AI-Supplemented the
     * card is never said at all — the §6.6 abstraction stands in for it — so
     * checking for the card's own words there would fail every correct message
     * and retry until it produced a wrong one.
     */
    const requiredText =
      supplementalReason ??
      (abstractedSentences
        ? (designatedCard?.abstract ?? null)
        : (designatedCard?.text ?? null));

    let { action, stubbed } = await generate();

    /**
     * ONE RETRY WHEN THE DESIGNATED CLAUSE WENT UNSAID.
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
     * person the whole delegation is visible through.
     *
     * One retry, not a loop: each turn is a live request in front of a
     * waiting participant, and a second failure is rare enough to accept.
     */
    if (requiredText && !mentionsCard(action.rationale, requiredText)) {
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

    // WHAT MUST SURVIVE THE CAP, IN PRIORITY ORDER.
    //
    // Under User-Specified that is the principal's card. Under
    // AI-Supplemented the card is never said at all — the three §6.6
    // sentences ARE the message — so the ABSTRACTION is protected first and
    // the two covers after it.
    //
    // The ordering is load-bearing and was learned the hard way. Cutting from
    // the end removed whichever clause the model wrote last; protecting the
    // wrong one pushed the reason out while the schedule still recorded it as
    // voiced, so a participant was credited with a disclosure nobody heard.
    // The abstraction comes first for the same reason the card does: it is
    // what the ladder is driven off, and losing a cover costs only some of the
    // cover. The FRAME is short and is not protected — it carries no fact.
    //
    // Matching is by CONTENT OVERLAP, never containment — a User-Specified
    // proxy is required to re-voice its card rather than quote it, so a
    // containment match would find the verbatim sentences every time and the
    // re-voiced card never.
    const protectedClauses = blocked
      ? null
      : abstractedSentences
        ? [
            designatedCard?.abstract ?? null,
            ...abstractedSentences.filter(
              (s) => s !== designatedCard?.abstract,
            ),
          ]
        : [designatedCard?.text ?? null, supplementalReason];

    /**
     * THE FRAME IS PLACED, NOT REQUESTED — the same lesson as the §6.6
     * sentences themselves.
     *
     * Measured live it went missing in 3 of 8 generations: the turn already
     * asks the proxy to introduce itself, and the frame competed with that
     * instruction and lost. That is exactly how the Ver.2.14 pool clause
     * failed, and the fix there was the same one — the route places it.
     *
     * IT IS NOT COSMETIC. The frame is what makes the three sentences read as
     * the PROXY'S OWN ASSESSMENT rather than a relay ("Looking at the side of
     * the team lead I represent, I think the office days should stay at four.
     * Three reasons —"). Without it the abstraction arrives as a bare
     * statement among two others with no speaker attached, and §6.6's whole
     * point is that an AI is recommending this on its own account. Whether
     * responsibility still lands on the principal is what OTHER-AI4 and ATTR2
     * measure, so a message missing the frame is measuring something else.
     *
     * Prepended only when the model did not produce it, matched by overlap
     * because the proxy paraphrases. It goes AFTER any self-introduction, so
     * the message still opens the way a representative would.
     */
    const framed = (rendered: string): string => {
      if (!supplementedFrame || blocked) return rendered;
      if (carriesFrame(rendered, supplementedFrame)) return rendered;
      const bubbles = rendered
        .split("||")
        .map((b) => b.trim())
        .filter(Boolean);
      const intro = bubbles[0] && /\bProxy\b/i.test(bubbles[0]) ? 1 : 0;
      bubbles.splice(intro, 0, supplementedFrame);
      return bubbles.join(" || ");
    };

    const text = capMessageLength(
      blocked
        ? fallbackText(task, proposal, isParticipantSide)
        : framed(action.rationale),
      NEGOTIATION.maxMessageChars,
      // THE FRAME IS PROTECTED LAST, BEHIND THE ABSTRACTION AND THE COVERS.
      // Order here is priority, and the abstraction is what the ladder is
      // driven off — putting the frame ahead of it would let the cap drop the
      // participant's own disclosure while the schedule recorded it as voiced,
      // which is the precise inversion this list exists to prevent. A message
      // that keeps all three sentences and loses the frame is a worse message;
      // one that keeps the frame and loses the abstraction is wrong data.
      supplementedFrame && protectedClauses
        ? [...protectedClauses, supplementedFrame]
        : protectedClauses,
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
    // participant must not be able to tell an abstraction from a cover — that
    // indistinguishability IS the AI-Supplemented condition.
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
        // Always a decoy. There is no second reason id to carry — the
        // AI-Supplemented policy replaces the card rather than adding beside
        // it — but the RESPONSE SHAPE must not change, so the slot is padded.
        // An array that were one element under one policy and two under the
        // other is a per-message tell of exactly the kind §7 forbids.
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
