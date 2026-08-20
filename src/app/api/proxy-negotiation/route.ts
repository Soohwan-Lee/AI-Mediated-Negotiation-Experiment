/**
 * Proxy-condition AI-AI negotiation — one stage-turn per request.
 *
 * WHO DECIDES WHAT. `lib/negotiation/machine` decides the move: which package
 * goes on the table, whether the counterpart concedes, whether it accepts, and
 * when the exchange ends. The model is asked only to say that move in the
 * right voice. Termination used to be the model's call, and it showed — in
 * testing it "accepted" packages made entirely of its own opening terms after
 * two exchanges. Design §4 gives that job to the state machine, and this route
 * is where the handover happens.
 *
 * ONE TURN PER REQUEST. The client calls this repeatedly with the stage index
 * and the transcript so far. Each invocation is roughly one model call (~7.5s
 * measured against gpt-5.6-sol), well inside Vercel's 60s Hobby limit, and it
 * lets the waiting screen show real progress rather than a blind spinner.
 */

import { NextResponse } from "next/server";
import { generateAction } from "@/lib/ai/client";
import { validateAction } from "@/lib/ai/validator";
import { buildProxyPlan, counterpartStep, STAGES } from "@/lib/negotiation/machine";
import {
  counterRequirementIssue,
  getTask,
  plausibleReasons,
  requirementIssue,
} from "@/lib/tasks";
import type {
  Mandate,
  Package,
  Role,
  Speaker,
  StageId,
  TaskId,
  TranscriptMessage,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * WHY THERE IS NO YOKED-TRANSCRIPT BRANCH HERE.
 *
 * ver.1.8 required pre-produced, condition-identical receiver stimuli, because
 * only one role was a sender and the other's screen WAS the stimulus. Design
 * Ver.2.4 §13 drops that requirement, and role symmetry is the reason: both
 * roles now hold a requirement, mandate a proxy, and receive the other side's
 * case, so there is no receiver-only arm left to hold constant.
 *
 * What still has to be matched across policies is message count and length
 * (pilot gate 10), and that is enforced structurally — the turn order below is
 * identical for both, and the Explorer's extra reason must fit inside its
 * scheduled message rather than adding a turn.
 */

interface RequestBody {
  taskId: TaskId;
  participantRole: Role;
  policy: "delegate" | "explorer";
  mandate: Mandate;
  sessionIndex: 1 | 2;
  /** 0-based index into the turn order below. */
  turn: number;
  /** Visible transcript so far, oldest first. */
  history?: Array<{ speaker: Speaker; text: string }>;
  /** The package each side last put on the table. */
  lastParticipantPackage?: Package | null;
  lastCounterpartPackage?: Package | null;
  /**
   * Opaque tokens for the reasons this side has already voiced, for the
   * budget check. Deliberately carries no indication of which kind each was —
   * see `reasonToken`.
   */
  reasonsUsed?: string[];
  /**
   * How many pool reasons this side has already spent.
   *
   * A COUNT, not a list. The Explorer's pool allowance is one per task and the
   * route is stateless, so the client has to carry something — but a count
   * cannot be attached to any particular message, where a marked token could.
   */
  poolReasonsUsed?: number;
}

/**
 * The fixed turn order: each of the five stages carries one message from each
 * side, counterpart first, for ten messages in total (Design §4).
 *
 * A fixed order is what makes Delegate and Explorer comparable — the same
 * number of visible offers and the same message count, differing only in which
 * REASONS are voiced (Design §7 노출량 통제, pilot gate 10).
 *
 * STAGE 4 IS THE ONE EXCEPTION, and it has to be. Everywhere else the
 * counterpart leads, which is what anchors the participant's side. But stage 4
 * is the conditional trade: the counterpart's move there is to EVALUATE the
 * counterpackage against T_MID, and going first meant it evaluated a package
 * that had not been sent yet — the participant proxy's stage-1 opening, worth
 * nothing to it. The Proxy arm could therefore never accept at T_MID and
 * always fell through to T_FINAL at stage 5, while Baseline (where the
 * participant sends within the stage before the counterpart replies) accepted
 * at T_MID normally.
 *
 * That is a mechanical difference in counterpart acceptance behaviour between
 * the two arms of `Pooled Proxy − Baseline`, which is exactly what the fixed
 * rules exist to prevent. Swapping the two turns at stage 4 makes the proxy
 * exchange evaluate the same package at the same threshold as Baseline does.
 */
type Turn = { stage: StageId; side: "counterpart" | "participant" };

const TURN_ORDER: Turn[] = STAGES.flatMap((stage): Turn[] =>
  stage === 4
    ? [
        { stage, side: "participant" },
        { stage, side: "counterpart" },
      ]
    : [
        { stage, side: "counterpart" },
        { stage, side: "participant" },
      ],
);

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
 * Both lists go into the prompt. Sending only the authorized ones would look
 * tidier and would be wrong: Design §15 P3 requires the unchecked cards to be
 * present so the proxy can let them inform WHICH PACKAGE it chooses while
 * never putting them into words. A proxy that had not been told about a
 * withheld circumstance could not act on it at all, which is a different
 * policy from the one being tested.
 */
function reasonsFor(taskId: TaskId, role: Role, mandate: Mandate) {
  const cards = getTask(taskId).roleBriefs[role].reasonCards;
  const pick = (authorized: boolean) =>
    cards
      .filter(
        (c) => mandate.authorizedReasonIds.includes(c.id) === authorized,
      )
      .map((c) => ({ id: c.id, text: c.text }));
  return { authorized: pick(true), forbidden: pick(false) };
}

/**
 * What a proxy says when the model's wording was blocked.
 *
 * Plain, package-only, and carrying no rationale at all — a rationale is
 * exactly the thing most likely to have been blocked, so the safe fallback
 * states the position and nothing else.
 */
function fallbackText(
  task: ReturnType<typeof getTask>,
  stage: StageId,
  proposal: Package | null,
  isParticipantSide: boolean,
): string {
  const side = isParticipantSide
    ? "On my principal's behalf"
    : "On the other participant's behalf";
  if (!proposal) {
    return stage === 3
      ? `${side}: noted. The position on that term stands.`
      : `${side}: no change to the position this turn.`;
  }
  const terms = task.issues
    .map((i) => i.options.find((o) => o.id === proposal[i.id])?.label)
    .filter(Boolean)
    .join(", ");
  return `${side}: ${terms}.`;
}

/**
 * A stable opaque token for a reason id.
 *
 * Not a security measure — the client is not an adversary — but the difference
 * between "the same reason as last turn" (which the budget needs) and "this
 * sentence came from the pool" (which the participant must not learn).
 *
 * NO KIND MARKER. An earlier version prefixed pool reasons with `pool` so the
 * separate budgets could be counted client-side, with a comment claiming that
 * was safe because the token is opaque. It was not: the token is returned with
 * EVERY message, so the prefix said "the reason in this particular message was
 * added by the AI" — per message, for the whole transcript. That is precisely
 * the judgement OTHER-AI4 asks the participant to make unaided, and it is the
 * Explorer manipulation itself.
 *
 * The kind stays server-side (`poolReasonsUsed` below), which the budget can
 * reconstruct without the client ever holding it.
 */
function reasonToken(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return `r${Math.abs(h) % 9973}`;
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
  // Both policies build the SAME plan. Design §7 puts the difference in reason
  // use, not concession reach — see the note on `buildProxyPlan`.
  const plan = buildProxyPlan(task, body.participantRole, body.mandate);

  const yourRequirement = requirementIssue(task, body.participantRole);
  const theirRequirement = counterRequirementIssue(task, body.participantRole);

  let proposal: Package | null = null;
  let decidedAction: string;
  let accepted = false;
  let impasse = false;
  /** The machine's move, stored beside the sentence for the gate-9 audit. */
  let counterpartAction: string | null = null;

  if (isParticipantSide) {
    switch (stage) {
      case 1:
        proposal = plan.opening;
        decidedAction = "Open with your principal's preferred package.";
        break;
      case 2:
        // No package this turn. The Explorer's extra latitude is over WORDS,
        // not offers: giving it a fourth substantive package where the
        // Delegate has three would make the two policies differ in what they
        // put on the table, and could flip the acceptance test between
        // conditions for identical mandates.
        proposal = null;
        decidedAction = `Say that ${yourRequirement.label.toLowerCase()} is your principal's priority, with one authorized reason. Ask which term matters most to them.`;
        break;
      case 3:
        // Both sides challenge, once each (Design §4 stage 3). The
        // participant's proxy sends the challenge aimed at the COUNTERPART'S
        // requirement.
        decidedAction = `Send exactly this challenge, in your own words: "${task.standardizedChallenge[counterpartRole]}"`;
        break;
      case 4:
        proposal = plan.counterpackage;
        decidedAction =
          "Put the counterpackage forward: hold the priority term, give ground on the others, and say so explicitly as an exchange.";
        break;
      case 5:
        proposal = plan.tentative;
        decidedAction = "Confirm the package that goes to review.";
        break;
    }
  } else {
    // What the counterpart is being asked to evaluate. At stage 4 the
    // participant's proxy has just spoken (see TURN_ORDER), so this is their
    // actual counterpackage; the fallback covers a turn arriving out of order.
    const incoming =
      stage >= 4 ? (body.lastParticipantPackage ?? plan.counterpackage) : null;
    // A reason HAS been given by this point in a Proxy exchange: the
    // participant's proxy voices one at stage 2 from the cards they checked,
    // and the mandate screen requires at least one work card. So the
    // reason-linked rule cannot bite here the way it can in Baseline, where
    // the participant may simply never attach one.
    const decision = counterpartStep(
      task,
      counterpartRole,
      stage,
      incoming,
      body.lastCounterpartPackage ?? null,
      {
        reasonGivenForRequirement: (body.reasonsUsed ?? []).length > 0,
        reasonAlreadyRequested: false,
      },
    );
    proposal = decision.proposal;
    accepted = decision.accepts;
    impasse = decision.impasse;
    counterpartAction = decision.action;

    decidedAction = ((): string => {
      switch (decision.action) {
        case "open":
          return "Open with your own best package on all three terms.";
        case "state_priority":
          return `Say that ${theirRequirement.label.toLowerCase()} is your principal's priority, with one reason about the work. Ask which term matters most to them.`;
        case "challenge":
          // The mirror of the participant proxy's stage-3 move: this one is
          // aimed at the PARTICIPANT'S requirement.
          return `Send exactly this challenge, in your own words: "${task.standardizedChallenge[body.participantRole]}"`;
        case "request_reason":
          return `Ask why ${yourRequirement.label.toLowerCase()} matters so much to their principal. Make no new offer this turn.`;
        case "accept":
        case "soft_close":
          return stage >= 5
            ? "Record the tentative package and ask both principals to review it."
            : "Say the package they proposed works for your principal.";
        case "hold":
          return `Say most of the package works, but ${yourRequirement.label.toLowerCase()} stays where it is for now.`;
        case "concede_distributive":
          return "Give a step on the timing term and put that counteroffer forward.";
        case "impasse":
          return "Say you cannot reach agreement on these terms.";
      }
    })();
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
        // The counterpart proxy runs the same policy in the fiction, but its
        // words are not a measured variable, so it is not given extra latitude
        // to spend.
        plausibleReasons:
          isParticipantSide && body.policy === "explorer"
            ? plausibleReasons(body.taskId, body.participantRole)
            : undefined,
      },
      history,
    });

    const validation = validateAction(action, {
      issues: task.issues,
      mandate: isParticipantSide ? body.mandate : undefined,
      policy: body.policy,
      actorRole,
      stage,
      // The budget spans the whole task, so the client carries the history —
      // this route is stateless and one action cannot know what came before.
      //
      // The history arrives as opaque tokens (they went out that way, so the
      // Explorer's additions are not named in the network tab), so the current
      // action is tokenised to match. The budget only needs "is this the same
      // reason as one already used", which survives the mapping.
      reasonsUsed: isParticipantSide ? (body.reasonsUsed ?? []) : undefined,
      reasonKey: action.reasonSourceId
        ? reasonToken(action.reasonSourceId)
        : null,
      poolReasonsUsed: isParticipantSide ? (body.poolReasonsUsed ?? 0) : 0,
    });

    // A blocked action loses its WORDING, not the move behind it.
    //
    // Dropping the turn entirely — which is what returning `skipped` did —
    // took the state machine's package with it, because the package rides on
    // the message. The exchange then had a hole where a stage should be, the
    // counterpart evaluated a stale package at stage 4, and the participant
    // saw nine messages instead of ten. Appendix E6 asks for a deterministic
    // fallback action, so that is what a block produces.
    const blocked =
      !validation.valid && validation.disposition === "regenerate";

    const text = blocked
      ? fallbackText(task, stage, proposal, isParticipantSide)
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

    // Provenance is stripped before the response leaves the server. The
    // participant must not be able to tell a pool reason from one of their
    // own — that indistinguishability IS the Explorer condition, and OTHER-AI4
    // asks them to try (Design §7, CLAUDE.md §3).
    const { internalProvenance, ...visible } = message;
    void internalProvenance;

    return NextResponse.json({
      turn,
      stage,
      message: visible,
      requirementOption: proposal?.[yourRequirement.id] ?? null,
      // The decided move, in machine vocabulary, so the client can store it
      // beside the rendered sentence — Design §4 requires the pair for the
      // gate-9 audit, and there is nowhere else to record it until Supabase is
      // wired.
      //
      // Unlike the Baseline route this is defensible: in a Proxy task the
      // participant already knows both sides are AI Proxies, so "the system
      // decided to concede on timing" reveals nothing they were not told. It
      // must still never carry provenance — see `reasonToken`.
      decidedAction: counterpartAction,
      accepted,
      impasse,
      blocked,
      // The budget is a COUNT, and the client only needs the count.
      //
      // Returning the card id itself was a provenance leak: under Explorer a
      // `pool:` prefix in the network tab names exactly which messages the AI
      // added, which is the judgement OTHER-AI4 asks the participant to make
      // unaided. An opaque token keeps distinct reasons distinguishable from
      // each other without saying what any of them is.
      reasonToken: action.reasonSourceId
        ? reasonToken(action.reasonSourceId)
        : null,
      // A bare count, so the client can carry the pool allowance forward
      // without holding anything that ties a kind to a message.
      poolReasonsUsed:
        (body.poolReasonsUsed ?? 0) +
        (action.reasonSourceId?.startsWith("pool:") ? 1 : 0),
      // Violation CODES only. The details name red lines, withheld reason
      // cards and the validator's reasoning — a participant who opened the
      // network tab and found "disclosure_permission_violation: reason a_m_s2
      // was not checked" would have been shown the card they withheld.
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
