/**
 * Rehearsal turn — the participant's OWN AI Proxy, answering questions about
 * its mandate before it negotiates anything.
 *
 * The participant sets a mandate, then asks the proxy what it will do with it:
 * what it will open with, where it will stop, which of their reasons it may
 * use, what it will say if the other side pushes back. Then they can change
 * the mandate and ask again. The proxies still run ONCE, afterwards.
 *
 * WHY THIS DOES NOT DISTURB THE DESIGN. It looks like a new conversation in a
 * study that is careful about how many conversations each arm gets, so the
 * limits matter more than the feature:
 *
 *  - NOT A NEGOTIATION. The counterpart is not in it and is never spoken for.
 *    Nothing is proposed to anyone, nothing is agreed, and no package leaves
 *    this route. `lib/negotiation/machine` is not called at all.
 *  - NOT A SECOND BITE. This is BEFORE the exchange, not after it. The deleted
 *    post-hoc revision let a Proxy participant re-run a finished negotiation,
 *    which is a bite Baseline never had. Editing your own instructions before
 *    anyone has spoken is the ordinary act of writing a mandate, and Baseline's
 *    equivalent is that a Baseline participant can plan freely before typing.
 *  - NO UNTICKED CARD, EVER. Enforced here on the generated text, not merely
 *    asked for in the prompt. A participant could otherwise hear a sensitive
 *    card spoken aloud without authorizing it, and whether they authorize it is
 *    the measure.
 *
 * WHAT IT DOES COST, stated plainly because it is real: the Proxy arm gains
 * screen time and a written exchange the Baseline arm has no counterpart for.
 * That is already true of the arm by construction (a Proxy participant watches
 * a negotiation Baseline does not have), and CLAUDE.md already flags participant
 * airtime as not a between-condition control. But it adds to the §10 gate 8
 * timing budget and it should be read as part of the manipulation rather than
 * as a neutral affordance.
 */

import { NextResponse } from "next/server";
import { generateText } from "@/lib/ai/client";
import { leaksForbiddenReason } from "@/lib/ai/reason-leak";
import { getTask, requirementIssue } from "@/lib/tasks";
import type { Mandate, Role, TaskId } from "@/lib/types";

export const runtime = "nodejs";

interface RequestBody {
  taskId: TaskId;
  /** The participant's own role — this proxy represents THEM. */
  role: Role;
  policy: "delegate" | "explorer";
  mandate: Mandate;
  /** Oldest first; the participant's new question is the last entry. */
  history: Array<{ role: "assistant" | "user"; content: string }>;
}

/** The mandate in words, for the prompt. */
function mandateSummary(
  task: ReturnType<typeof getTask>,
  mandate: Mandate,
): string {
  return mandate.issues
    .map((im) => {
      const issue = task.issues.find((i) => i.id === im.issueId);
      if (!issue) return null;
      const label = (id: string | null) =>
        issue.options.find((o) => o.id === id)?.label ?? "not set";
      return `- ${issue.label}: open at ${label(
        im.preferredOptionId,
      )}, settle no further than ${label(im.minimumOptionId)}`;
    })
    .filter(Boolean)
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
  const cards = task.roleBriefs[body.role].reasonCards;
  const authorized = cards.filter((c) =>
    body.mandate.authorizedReasonIds.includes(c.id),
  );
  const forbidden = cards.filter(
    (c) => !body.mandate.authorizedReasonIds.includes(c.id),
  );

  try {
    const { text, stubbed } = await generateText({
      kind: "rehearsal",
      ctx: {
        task,
        // This proxy represents the PARTICIPANT, so its role is theirs — the
        // opposite of every other agent in this codebase, all of which play
        // the counterpart. Getting this backwards would have it argue the
        // other side's case to its own principal.
        agentRole: body.role,
        issues: task.issues,
        stage: 1,
        decidedAction: "",
        mandateSummary: mandateSummary(task, body.mandate),
        authorizedReasons: authorized.map((c) => ({ id: c.id, text: c.text })),
        forbiddenReasons: forbidden.map((c) => ({ id: c.id, text: c.text })),
      },
      // Last eight turns. The participant's new question is the final entry,
      // so it needs no separate field — and must not be added twice.
      history: body.history.slice(-8),
    });

    // What the proxy is allowed to talk about: the reasons it may voice, plus
    // the terms themselves. Subtracted from each forbidden card so an ordinary
    // answer about an authorized reason cannot trip the check.
    const sayable = [
      ...authorized.map((c) => c.text),
      ...task.issues.map((i) => i.label),
      ...task.issues.map((i) => i.description),
    ];

    if (leaksForbiddenReason(text, forbidden, sayable)) {
      const requirement = requirementIssue(task, body.role);
      return NextResponse.json({
        text: `I have not been authorized to raise that, so I will not bring it up. What I can argue on ${requirement.label.toLowerCase()} is the reasons you have ticked — you can change which ones any time before we start.`,
        blocked: true,
        stubbed,
      });
    }

    return NextResponse.json({ text, blocked: false, stubbed });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Rehearsal turn failed",
      },
      { status: 502 },
    );
  }
}
