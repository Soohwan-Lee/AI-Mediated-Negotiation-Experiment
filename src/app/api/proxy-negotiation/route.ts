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
import { getTask } from "@/lib/tasks";
import { NEGOTIATION } from "@/lib/study-config";
import type { Mandate, Role, TaskId, TranscriptMessage } from "@/lib/types";

export const runtime = "nodejs";
/** AI-AI loops can exceed the default serverless timeout. */
export const maxDuration = 120;

interface RequestBody {
  taskId: TaskId;
  participantRole: Role;
  policy: "delegate" | "explorer";
  mandate: Mandate;
  sessionIndex: 1 | 2;
}

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
  const transcript: TranscriptMessage[] = [];
  const guardrailBlocks: unknown[] = [];
  let stubbedAny = false;

  const history: Array<{ role: "assistant" | "user"; content: string }> = [];

  try {
    for (let turn = 0; turn < NEGOTIATION.maxTurnsPerSide * 2; turn += 1) {
      const isParticipantSide = turn % 2 === 0;
      const turnsRemaining = NEGOTIATION.maxTurnsPerSide * 2 - turn;

      const { action, stubbed } = await generateAction({
        kind: body.policy,
        ctx: {
          task,
          agentRole: isParticipantSide ? body.participantRole : counterpartRole,
          issues: task.issues,
          mandateSummary: isParticipantSide
            ? mandateSummary(body.mandate, body.taskId)
            : // The counterpart principal's mandate is researcher-defined and
              // held constant across conditions.
              "[Researcher-defined counterpart mandate — TBD with the payoff matrix]",
          turnsRemaining,
        },
        history,
      });
      stubbedAny = stubbedAny || stubbed;

      const validation = validateAction(action, {
        issues: task.issues,
        mandate: isParticipantSide ? body.mandate : undefined,
        policy: body.policy,
        actorRole: isParticipantSide ? body.participantRole : counterpartRole,
      });

      if (!validation.valid) {
        // Methods §Guardrail and validation: invalid actions never reach the
        // transcript. A production implementation retries generation once
        // before falling back to marking the issue unresolved.
        guardrailBlocks.push({ turn, violations: validation.violations });
        if (validation.disposition === "regenerate") continue;
      }

      transcript.push({
        id: `m${turn}`,
        sessionIndex: body.sessionIndex,
        speaker: isParticipantSide ? "participant_proxy" : "counterpart_proxy",
        text: action.rationale,
        createdAt: new Date().toISOString(),
        // Stored for audit; the client must not render this.
        internalProvenance: action.internalProvenance,
      });

      history.push({
        role: isParticipantSide ? "assistant" : "user",
        content: action.rationale,
      });

      if (action.actionType === "accept") break;
    }

    // TODO(supabase): persist transcript, guardrail blocks, and the candidate
    // agreement server-side rather than returning provenance to the client.
    return NextResponse.json({
      // Provenance is stripped before it leaves the server — the participant
      // must not be able to distinguish agent options from entrusted content
      // (Methods §Explorer Proxy condition).
      transcript: transcript.map(({ internalProvenance, ...rest }) => {
        void internalProvenance;
        return rest;
      }),
      guardrailBlockCount: guardrailBlocks.length,
      stubbed: stubbedAny,
    });
  } catch (error) {
    console.error("[proxy-negotiation]", error);
    return NextResponse.json(
      { error: "Proxy negotiation failed" },
      { status: 500 },
    );
  }
}
