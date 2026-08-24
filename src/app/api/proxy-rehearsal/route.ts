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
import { getTask, requirementIssue } from "@/lib/tasks";
import type { Mandate, Role, TaskId } from "@/lib/types";

export const runtime = "nodejs";

interface RequestBody {
  taskId: TaskId;
  /** The participant's own role — this proxy represents THEM. */
  role: Role;
  policy: "delegate" | "explorer";
  mandate: Mandate;
  history: Array<{ role: "assistant" | "user"; content: string }>;
  question: string;
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

/**
 * Does the reply reproduce a reason the participant did not authorize?
 *
 * A content check on the generated text, because the prompt asking for it is
 * not a guarantee. Matching is on distinctive words from each forbidden card
 * rather than the whole sentence: the proxy is explicitly allowed to paraphrase
 * what it MAY say, so a leak will be a paraphrase too. The bar is deliberately
 * low-precision — a false positive costs one regeneration-free fallback, a
 * false negative shows the participant a disclosure they refused.
 */
function leaksForbiddenReason(
  text: string,
  forbidden: Array<{ id: string; text: string }>,
): boolean {
  const haystack = text.toLowerCase();
  const STOP = new Set([
    "about", "after", "again", "also", "anything", "because", "been", "before",
    "could", "every", "from", "have", "here", "into", "just", "know", "known",
    "made", "make", "makes", "many", "more", "most", "much", "only", "over",
    "same", "should", "some", "something", "still", "take", "takes", "than",
    "that", "their", "them", "then", "there", "these", "they", "this", "those",
    "very", "were", "what", "when", "which", "with", "would", "your", "yours",
  ]);
  for (const card of forbidden) {
    const words = card.text
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOP.has(w));
    if (words.length === 0) continue;
    const hits = words.filter((w) => haystack.includes(w)).length;
    // Half the distinctive words of a card, or three of them, is a paraphrase
    // of that card rather than a coincidence of vocabulary.
    if (hits >= Math.max(3, Math.ceil(words.length / 2))) return true;
  }
  return false;
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
      history: body.history.slice(-8),
      // The question is appended by the caller as the last history entry.
    });

    if (leaksForbiddenReason(text, forbidden)) {
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
