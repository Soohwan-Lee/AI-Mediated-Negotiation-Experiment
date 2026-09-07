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
 *    which is a bite Direct never had. Editing your own instructions before
 *    anyone has spoken is the ordinary act of writing a mandate, and Direct's
 *    equivalent is that a Direct participant can plan freely before typing.
 *  - NO UNTICKED CARD, EVER. Enforced here on the generated text, not merely
 *    asked for in the prompt. A participant could otherwise hear a sensitive
 *    card spoken aloud without authorizing it, and whether they authorize it is
 *    the measure.
 *
 * WHAT IT DOES COST, stated plainly because it is real: the Proxy arm gains
 * screen time and a written exchange the Direct arm has no counterpart for.
 * That is already true of the arm by construction (a Proxy participant watches
 * a negotiation Direct does not have), and CLAUDE.md already flags participant
 * airtime as not a between-condition control. But it adds to the §10 gate 8
 * timing budget and it should be read as part of the manipulation rather than
 * as a neutral affordance.
 */

import { NextResponse } from "next/server";
import { generateText } from "@/lib/ai/client";
import { leaksForbiddenReason } from "@/lib/ai/reason-leak";
import { getTask, requirementIssue } from "@/lib/tasks";
import type { Mandate, NegotiationTask, Role, TaskId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestBody {
  taskId: TaskId;
  /** The participant's own role — this proxy represents THEM. */
  role: Role;
  policy: "user_specified" | "ai_supplemented";
  mandate: Mandate;
  /** Oldest first; the participant's new question is the last entry. */
  history: Array<{ role: "assistant" | "user"; content: string }>;
}

/** The mandate in words, for the prompt. */
function mandateSummary(
  task: NegotiationTask,
  mandate: Mandate,
): string {
  return mandate.issues
    .map((im) => {
      const issue = task.issues.find((i) => i.id === im.issueId);
      if (!issue) return null;
      const label = (id: string | null) =>
        issue.options.find((o) => o.id === id)?.label ?? "not set";
      return `- ${issue.label}: open at ${label(im.preferredOptionId)}`;
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

  // The guard the other four routes have and this one did not. `getTask`
  // returns `undefined` for an unknown id, so the next line dereferenced it
  // OUTSIDE the try below — an unhandled exception and a bare 500 with no JSON
  // body, where every sibling answers a clean 400.
  const task = getTask(body.taskId);
  if (!task) {
    return NextResponse.json({ error: "Unknown task" }, { status: 400 });
  }
  const brief = task.roleBriefs[body.role];
  if (!brief) {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }
  // The policy decides which prompt this proxy speaks under, so an unknown one
  // would silently pick a behaviour rather than fail.
  if (
    body.policy !== "user_specified" &&
    body.policy !== "ai_supplemented"
  ) {
    return NextResponse.json({ error: "Unknown policy" }, { status: 400 });
  }
  // The same shape guard the siblings have. Without it a body missing
  // `mandate` or `mandate.issues` reached `.map` on undefined and came back as
  // a 502 through the catch below — an operator reading the log saw "the proxy
  // could not answer" where the truth was a malformed request.
  if (
    typeof body.mandate !== "object" ||
    body.mandate === null ||
    !Array.isArray(body.mandate.issues) ||
    !Array.isArray(body.mandate.authorizedReasonIds)
  ) {
    return NextResponse.json(
      { error: "mandate.issues and mandate.authorizedReasonIds are required" },
      { status: 400 },
    );
  }
  // Each entry is checked too, not just the array: a turn with the wrong
  // shape ({speaker, text}) went through to the model as role "" and came back
  // as a 400 from OpenAI, which the catch below reported as a 502.
  if (
    !Array.isArray(body.history) ||
    !body.history.every(
      (h) =>
        h &&
        (h.role === "user" || h.role === "assistant") &&
        typeof h.content === "string" &&
        h.content.trim().length > 0,
    )
  ) {
    return NextResponse.json(
      { error: "history must be an array of {role, content} turns" },
      { status: 400 },
    );
  }
  const cards = brief.reasonCards;
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
    // THE MESSAGE GOES ON A PARTICIPANT'S SCREEN, so it cannot be the
    // exception's own. `RehearsalChat` renders `data.error` verbatim
    // (shared.tsx), and the strings reaching here are written for operators:
    // "OPENAI_API_KEY is not configured and this is a live study…" from the
    // live-study guard, and "LLM request failed: 401 …" with the provider's
    // body from the client. Either one tells the reader that their
    // counterpart's side of this study is a language model — the first item on
    // the "must never learn mid-study" list — and the second can carry
    // provider detail with it.
    //
    // The real message is logged instead, where the operator needs it.
    console.error("[proxy-rehearsal]", error);
    return NextResponse.json(
      { error: "Your proxy could not answer just now. Please try again." },
      { status: 502 },
    );
  }
}
