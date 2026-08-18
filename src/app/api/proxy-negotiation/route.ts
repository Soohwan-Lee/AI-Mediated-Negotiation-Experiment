/**
 * Proxy-condition AI-AI negotiation — one stage-turn per request.
 *
 * WHO DECIDES WHAT. `lib/negotiation/machine` decides the move: which package
 * goes on the table, whether the counterpart concedes, whether it accepts, and
 * when the exchange ends. The model is asked only to say that move in the
 * right voice. Termination used to be the model's call, and it showed — in
 * testing it "accepted" packages made entirely of its own opening terms after
 * two exchanges. Methods ver.1.8 §5 gives that job to the state machine, and
 * this route is where the handover happens.
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
import { focalIssue, getTask } from "@/lib/tasks";
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
  /** Reason card ids this side has already voiced, for the budget check. */
  reasonsUsed?: string[];
}

/**
 * The fixed turn order: each of the five stages carries one message from each
 * side, counterpart first, for ten messages in total (Appendix E1).
 *
 * A fixed order is what makes Delegate and Explorer comparable — the same
 * number of visible offers and the same message count, differing only in
 * which packages are tried (Methods §Delegate–Explorer matching).
 */
const TURN_ORDER: Array<{ stage: StageId; side: "counterpart" | "participant" }> =
  STAGES.flatMap((stage) => [
    { stage, side: "counterpart" as const },
    { stage, side: "participant" as const },
  ]);

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
      const parts = [
        `open at ${label(m.issueId, m.preferredOptionId)}`,
        `may concede to ${label(m.issueId, m.acceptableFloorOptionId)}`,
      ];
      if (m.hardBoundaryOptionId) {
        parts.push(
          `must never go past ${label(m.issueId, m.hardBoundaryOptionId)}`,
        );
      }
      return `- ${issue?.label ?? m.issueId}: ${parts.join(", ")}`;
    })
    .join("\n");
}

/** The reason cards and their permissions, for the proxy's prompt. */
function reasonsFor(
  taskId: TaskId,
  role: Role,
  mandate: Mandate,
) {
  const brief = getTask(taskId).roleBriefs[role];
  return (brief.focalReasons ?? []).map((card) => ({
    id: card.id,
    text: card.text,
    permission: mandate.reasonPermissions[card.id] ?? card.defaultPermission,
  }));
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
  const side = isParticipantSide ? "On my principal's behalf" : "On Alex's behalf";
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
  const plan = buildProxyPlan(
    task,
    body.participantRole,
    body.mandate,
    body.policy,
  );

  let proposal: Package | null = null;
  let decidedAction: string;
  let accepted = false;
  let impasse = false;

  if (isParticipantSide) {
    switch (stage) {
      case 1:
        proposal = plan.opening;
        decidedAction = "Open with your principal's preferred package.";
        break;
      case 2:
        // The Explorer's probe is floated in words only. It deliberately does
        // NOT become `proposal`, because `proposal` is what the counterpart
        // evaluates at stage 4 — and a probe is by definition not a
        // commitment ("one option could be…"). Sending it would give the
        // Explorer a fourth substantive package where the Delegate has three,
        // which §Delegate–Explorer matching forbids, and could flip the
        // acceptance test between conditions for identical mandates.
        proposal = null;
        decidedAction = plan.probe
          ? "Name the term that matters most, and float one alternative combination as an option rather than a position."
          : "Name the term that matters most, with one authorized reason.";
        break;
      case 3:
        decidedAction =
          "Acknowledge the pushback and say the term still holds, without making a new offer yet.";
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
    const incoming =
      stage >= 4 ? (body.lastParticipantPackage ?? plan.counterpackage) : null;
    const decision = counterpartStep(
      task,
      counterpartRole,
      stage,
      incoming,
      body.lastCounterpartPackage ?? null,
    );
    proposal = decision.proposal;
    accepted = decision.accepts;
    impasse = decision.impasse;

    decidedAction =
      stage === 1
        ? "Open with your own best package on all three terms."
        : stage === 2
          ? "Say which term matters most to you, and ask which matters most to them."
          : stage === 3
            ? `Send exactly this challenge, in your own words: "${task.standardizedChallenge}"`
            : stage === 4
              ? decision.accepts
                ? "Say the package they proposed works for you."
                : "Concede one step on the timing term and put that counteroffer forward."
              : decision.accepts
                ? "Record the tentative package and ask both sides to confirm."
                : "Say you cannot reach agreement on these terms.";
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
        reasons: isParticipantSide
          ? reasonsFor(body.taskId, body.participantRole, body.mandate)
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
      reasonsUsed: isParticipantSide ? (body.reasonsUsed ?? []) : undefined,
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
    // participant must not be able to tell an explored option from an
    // authorized one — that indistinguishability IS the Explorer condition
    // (Methods §Explorer Proxy, CLAUDE.md §3).
    const { internalProvenance, ...visible } = message;
    void internalProvenance;

    return NextResponse.json({
      turn,
      stage,
      message: visible,
      focalOption: proposal?.[focalIssue(task).id] ?? null,
      accepted,
      impasse,
      blocked,
      // So the client can carry the budget forward to the next turn.
      reasonUsed: action.reasonSourceId,
      guardrailViolations: validation.valid ? [] : validation.violations,
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
