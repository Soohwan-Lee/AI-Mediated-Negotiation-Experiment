/**
 * P5 — the reason classifier (Design Ver.2.26 §6.2a, §6.9a, §12 P5).
 *
 * WHAT IT IS FOR. In the Direct arm and the Proxy arm's five-minute closing
 * the participant simply talks: Ver.2.20 removed the reason-card buttons.
 * Something still has to decide which rung of the justification ladder they
 * have reached, and it may not be the counterpart's own model (§6.7). So every
 * participant message goes to this separate, single-purpose call, which returns
 * one of `none / WR / SB`, a `priority_claim` flag, a confidence, and what the
 * LATEST message did with the standing proposal.
 *
 * THE JUDGEMENT IS CUMULATIVE (Ver.2.21). The body carries EVERY message the
 * participant has sent in this task, in order, and the classifier answers with
 * the highest label reached so far. Judging one message at a time was the
 * wrong unit: a confession arrives split over two or three messages, and with
 * the ties-go-down rule on top none of them is an SB alone. That produces a
 * systematic floor on the Direct arm's disclosure rate, which would then be
 * read as the Proxy arm's protective effect.
 *
 * WHAT THIS ROUTE MUST NEVER DO. It writes no text the participant or the
 * counterpart sees, it holds no conversation state, and it takes no
 * negotiation decision — the label goes to `machine.ts`, which decides the
 * package as it always did. The response carries the label, the flag and the
 * confidence for the client to hold as the running tier; the participant is
 * never shown any of it, and there is no UI that could reveal it.
 *
 * THE STANCE IS RESOLVED SERVER-SIDE. The model answers in the task's own
 * words ("2 days", "1 of 4"); this route maps those onto option ids from the
 * task definition and drops anything that does not match. Free text from a
 * model never becomes an option id, and a partial counter — one issue named,
 * not the other — is not a package and is dropped whole.
 *
 * THE AUDIT IS THE POINT OF STORING IT. Every {text, label, confidence} is
 * kept so the Direct transcripts can be re-coded by hand afterwards and
 * reported as κ against this classifier, with a sensitivity analysis excluding
 * disagreements (§6.2). The authenticated server audit is persisted before
 * returning the classification, with a stable message key for later recoding.
 */

import { NextResponse } from "next/server";

import { classifyReason } from "@/lib/ai/client";
import { ModelNotConfiguredError } from "@/lib/ai/config";
import { getTask } from "@/lib/tasks";
import { beginNegotiationAudit } from "@/lib/server/negotiation-audit";
import type { NegotiationTask, Role, TaskId } from "@/lib/types";

// Same runtime and budget as the sibling AI routes. Without them this one ran
// on the default edge runtime and the default duration, so a slow classifier
// call could be cut short where the counterpart's own turn would not be — on
// the route the Direct arm's tier is decided by.
export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestBody {
  sessionIndex?: number;
  messageId?: string;
  taskId: TaskId;
  /** The participant's own role — the cards read are theirs. */
  role: Role;
  /** EVERY message the participant has sent this task, oldest first. */
  messages: string[];
}

/** Loose match on a label the model echoed back: case and spacing only. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Turn the model's words into option ids, or nothing.
 *
 * BOTH ISSUES OR NEITHER. A counter naming one term is not a package — the
 * machine's acceptance test compares complete packages — so a half-resolved
 * one is dropped rather than completed with a guess. A guess here would be the
 * model deciding a term of the agreement, which is the one thing §6.7 forbids.
 */
function resolveCounterTerms(
  task: NegotiationTask,
  spoken: Record<string, string>,
): Record<string, string> | null {
  const resolved: Record<string, string> = {};
  for (const issue of task.issues) {
    const key = Object.keys(spoken).find(
      (k) => normalise(k) === normalise(issue.label),
    );
    if (!key) return null;
    const option = issue.options.find(
      (o) => normalise(o.label) === normalise(spoken[key]),
    );
    if (!option) return null;
    resolved[issue.id] = option.id;
  }
  return resolved;
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
  if (body.role !== "leader" && body.role !== "member") {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }
  // An empty array is not a classifiable conversation, and a non-string entry
  // would be interpolated into the prompt as "[object Object]" — a silent
  // corruption of the input the whole Direct arm's tier is read from.
  if (
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    body.messages.some((m) => typeof m !== "string") ||
    body.messages.every((m) => !m.trim())
  ) {
    return NextResponse.json(
      { error: "messages must be a non-empty array of strings" },
      { status: 400 },
    );
  }

  try {
    const audit = await beginNegotiationAudit(request, body, "classifier");
    const result = await classifyReason({
      ctx: { task, role: body.role, messages: body.messages },
    });
    const latest = body.messages[body.messages.length - 1];
    // A conditional payment demand is safety-sensitive and mechanically
    // recognizable. Preserve P5's broader judgement, but do not let a missed
    // bonus flag turn "I agree if you guarantee £0.50" into an ordinary
    // conditional about the work terms.
    const bonusRequest =
      result.bonusRequest ||
      (result.stance === "conditional" &&
        /(?:\bbonus\b|\bpay(?:ment)?\b|£\s*\d)/i.test(latest));

    const counterTerms =
      result.stance === "counter"
        ? resolveCounterTerms(task, result.counterTerms)
        : null;
    await audit({ input: { messages: body.messages }, result: {
      ...result, bonusRequest, counterTerms,
    } });

    // THE AUDIT LINE (§6.2, gate 19). The latest message plus the CUMULATIVE
    // label, which is the pair a human re-coder is asked to reproduce. Written
    // here as an operational diagnostic; the private durable audit above is
    // the analysis record, not this process log or the client's copy.
    console.info(
      "[classify-reason] audit",
      JSON.stringify({
        text: latest,
        label: result.label,
        confidence: result.confidence,
        stance: result.stance,
        off_topic: result.offTopic,
        bonus_request: bonusRequest,
        rule_request: result.ruleRequest,
        conditional_acceptance: result.stance === "conditional",
        first_reason_opportunity: result.firstReasonOpportunity,
        withdrawal_request: result.withdrawalRequest,
      }),
    );

    return NextResponse.json({
      label: result.label,
      priority_claim: result.priorityClaim,
      confidence: result.confidence,
      stance: result.stance,
      off_topic: result.offTopic,
      bonus_request: bonusRequest,
      rule_request: result.ruleRequest,
      first_reason_opportunity: result.firstReasonOpportunity,
      withdrawal_request: result.withdrawalRequest,
      ...(counterTerms ? { counter_terms: counterTerms } : {}),
      // SURFACED BECAUSE `none` MEANS TWO THINGS AND κ CANNOT TELL THEM APART.
      // With no key, `classifyReason` answers `{label:"none", confidence:0,
      // stubbed:true}` — byte-identical to a genuine "no reason given" and to
      // the error branch below. Dropping the flag made a misconfigured
      // deployment look like a study where every participant happened to say
      // nothing: tier pinned at `none` for the whole Direct arm, with the
      // stored {text,label,confidence} log showing no trace of why.
      //
      // Gate 19's κ ≥ .90 is computed off that log, and the Wizard-of-Oz
      // fallback (§13-24) is triggered by it — so the one signal that would
      // ever fire the fallback was the one being discarded. Both sibling AI
      // routes already return this; this was the only one that did not, and
      // it is the one the primary outcome rests on.
      //
      // Not a leak: it says a model did not run, never which condition the
      // participant is in, and in a live study the guard makes this
      // unreachable anyway (503 below).
      stubbed: result.stubbed,
    });
  } catch (error) {
    // A misconfigured study and a transient model failure are both unavailable
    // turns. Neither is evidence that the participant gave no reason, so both
    // surface as non-2xx responses for the client's bounded recovery path.
    if (error instanceof ModelNotConfiguredError) {
      console.error("[classify-reason] model not configured", error);
      return NextResponse.json(
        { error: "Classifier unavailable" },
        { status: 503 },
      );
    }
    // A failed classification is not evidence for `none`. The client keeps
    // the turn staged and retries this non-2xx response without advancing the
    // ladder, transcript, or counterpart state.
    console.error("[classify-reason]", error);
    return NextResponse.json(
      { error: "Classification unavailable" },
      { status: 503 },
    );
  }
}
