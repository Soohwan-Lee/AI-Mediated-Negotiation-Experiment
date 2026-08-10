/**
 * Proxy-condition AI-AI negotiation.
 *
 * Runs the participant's Proxy against the counterpart's Proxy for a fixed
 * turn budget, validating each structured action before it enters the
 * transcript. Both sides use the same policy in a given session (Methods
 * §Overall design: "one Proxy condition applies symmetrically to both sides").
 *
 * SCAFFOLD STATE: the loop and validation gate are real; without an API key
 * the underlying client returns canned actions so the review UI is walkable.
 */

import { NextResponse } from "next/server";
import { generateAction } from "@/lib/ai/client";
import { validateAction } from "@/lib/ai/validator";
import { counterpartMandateSummary, getTask } from "@/lib/tasks";
import { NEGOTIATION } from "@/lib/study-config";
import type {
  Mandate,
  Role,
  Speaker,
  TaskId,
  TranscriptMessage,
} from "@/lib/types";

export const runtime = "nodejs";
/**
 * ONE TURN PER REQUEST. The client calls this repeatedly, passing the turn
 * index and the transcript so far, until the response reports `done`.
 *
 * This keeps each invocation at roughly one model call (~7.5s measured), well
 * inside Vercel's 60s Hobby function limit, so the turn budget can grow
 * without hitting a timeout. It also lets the waiting screen show real
 * progress instead of a blind spinner.
 */
export const maxDuration = 60;

interface RequestBody {
  taskId: TaskId;
  participantRole: Role;
  policy: "delegate" | "explorer";
  mandate: Mandate;
  sessionIndex: 1 | 2;
  /** 0-based index of the turn to generate. */
  turn: number;
  /** Visible transcript so far, oldest first. */
  history?: Array<{ speaker: Speaker; text: string }>;
}

/** Total turns across both sides. */
const TOTAL_TURNS = NEGOTIATION.maxTurnsPerSide * 2;

function mandateSummary(mandate: Mandate, taskId: TaskId): string {
  const task = getTask(taskId);
  const byId = new Map(task.issues.map((i) => [i.id, i]));
  return mandate.issues
    .filter((m) => m.entrusted)
    .map((m) => {
      const issue = byId.get(m.issueId);
      const ideal = issue?.options.find((o) => o.id === m.idealOptionId)?.label;
      const floor = issue?.options.find(
        (o) => o.id === m.reservationOptionId,
      )?.label;
      return `- ${issue?.label ?? m.issueId}: priority=${m.priority}, ideal=${ideal ?? "unspecified"}, will not go past=${floor ?? "unspecified"}, rationale policy=${m.rationalePolicy}${m.notes ? `, note="${m.notes}"` : ""}`;
    })
    .join("\n");
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

  const counterpartRole: Role =
    body.participantRole === "leader" ? "member" : "leader";
  const turn = Number.isInteger(body.turn) ? body.turn : 0;
  if (turn < 0 || turn >= TOTAL_TURNS) {
    return NextResponse.json(
      { error: `turn must be between 0 and ${TOTAL_TURNS - 1}` },
      { status: 400 },
    );
  }

  // Even turns are the participant's Proxy, odd turns the counterpart's.
  const isParticipantSide = turn % 2 === 0;
  const actorRole = isParticipantSide ? body.participantRole : counterpartRole;

  // Rebuild model history from the visible transcript, seen from the acting
  // side: this agent's own prior messages are "assistant", the other side's
  // are "user".
  const history = (body.history ?? []).map((m) => ({
    role: (m.speaker === "participant_proxy") === isParticipantSide
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
        mandateSummary: isParticipantSide
          ? mandateSummary(body.mandate, body.taskId)
          : // Researcher-defined and held constant across conditions. Without
            // its own mandate the counterpart Proxy mirrors whatever the
            // participant's Proxy opens with instead of negotiating.
            counterpartMandateSummary(body.taskId, counterpartRole),
        turnsRemaining: TOTAL_TURNS - turn,
        totalTurns: TOTAL_TURNS,
      },
      history,
    });

    const validation = validateAction(action, {
      issues: task.issues,
      mandate: isParticipantSide ? body.mandate : undefined,
      policy: body.policy,
      actorRole,
    });

    // Methods §Guardrail and validation: invalid actions never reach the
    // transcript. A production implementation retries generation once before
    // falling back to marking the issue unresolved.
    if (!validation.valid && validation.disposition === "regenerate") {
      return NextResponse.json({
        turn,
        skipped: true,
        guardrailViolations: validation.violations,
        done: turn + 1 >= TOTAL_TURNS,
        stubbed,
      });
    }

    // TODO(supabase): persist the structured action, internal provenance, and
    // validator result here. They must not travel to the client.
    const message: TranscriptMessage = {
      id: `m${turn}`,
      sessionIndex: body.sessionIndex,
      speaker: isParticipantSide ? "participant_proxy" : "counterpart_proxy",
      text: action.rationale,
      createdAt: new Date().toISOString(),
      internalProvenance: action.internalProvenance,
    };

    // TODO(state-machine): termination is currently decided by the model,
    // which in testing accepted a package on its own terms after two
    // exchanges. Methods §Negotiation state machine requires the state machine
    // to own this: acceptance should be gated on the offer clearing both
    // sides' reservation thresholds, with fixed challenge and concession
    // points so trajectories are comparable across conditions.
    const accepted = action.actionType === "accept";

    // Provenance is stripped before the response leaves the server — the
    // participant must not be able to distinguish agent options from entrusted
    // content (Methods §Explorer Proxy condition).
    const { internalProvenance, ...visible } = message;
    void internalProvenance;

    return NextResponse.json({
      turn,
      message: visible,
      guardrailViolations: validation.valid ? [] : validation.violations,
      done: accepted || turn + 1 >= TOTAL_TURNS,
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
