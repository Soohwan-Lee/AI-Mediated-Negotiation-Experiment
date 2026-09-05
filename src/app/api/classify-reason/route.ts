/**
 * P5 — the reason classifier (Design Ver.2.20 §6.2a).
 *
 * WHAT IT IS FOR. In the Direct arm and the Proxy arm's three-minute closing
 * the participant simply talks: Ver.2.20 removed the reason-card buttons.
 * Something still has to decide which rung of the justification ladder each
 * message reached, and it may not be the counterpart's own model (§6.7). So
 * every participant message goes to this separate, single-purpose call, which
 * returns one of `none / WR / PRI / SB` and nothing else.
 *
 * WHY THE BUTTONS WENT. Pressing "[sensitive background]" is a more
 * deliberate act than saying the thing out loud, so the tag risked a floor on
 * the primary outcome — and it made the Direct arm something other than "just
 * talking", which would have turned `Pooled Proxy − Direct` into a contrast
 * between two interfaces rather than between speaking for yourself and having
 * someone speak for you.
 *
 * WHAT THIS ROUTE MUST NEVER DO. It writes no text the participant or the
 * counterpart sees, it holds no conversation state, and it takes no
 * negotiation decision — the label goes to `machine.ts`, which decides the
 * package as it always did. The response carries the label and confidence for
 * the client to hold as the running tier; the participant is never shown it,
 * and there is no UI that could reveal it.
 *
 * THE AUDIT IS THE POINT OF STORING IT. Every {text, label, confidence} is
 * kept so the Direct transcripts can be re-coded by hand afterwards and
 * reported as κ against this classifier, with a sensitivity analysis
 * excluding disagreements (§6.2). Gate 19 requires κ ≥ .90; below it the
 * study switches to Wizard-of-Oz tagging (§13-24). Persistence lands with
 * `/api/persist` — see docs/DATA_MODEL.md.
 */

import { NextResponse } from "next/server";

import { classifyReason } from "@/lib/ai/client";
import { ModelNotConfiguredError } from "@/lib/ai/config";
import { getTask } from "@/lib/tasks";
import type { Role, TaskId } from "@/lib/types";

interface RequestBody {
  taskId: TaskId;
  /** The participant's own role — the cards read are theirs. */
  role: Role;
  message: string;
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
  if (typeof body.message !== "string" || !body.message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  try {
    const result = await classifyReason({
      ctx: { task, role: body.role, message: body.message },
    });
    return NextResponse.json({
      label: result.label,
      confidence: result.confidence,
      // SURFACED BECAUSE `none` MEANS TWO THINGS AND κ CANNOT TELL THEM APART.
      // With no key, `classifyReason` answers `{label:"none", confidence:0,
      // stubbed:true}` — byte-identical to a genuine "no reason given" and to
      // the error branch below. Dropping the flag made a misconfigured
      // deployment look like a study where every participant happened to say
      // nothing: tier pinned at `none` (1,600) for the whole Direct arm, with
      // the stored {text,label,confidence} log showing no trace of why.
      //
      // Gate 19's κ ≥ .90 is computed off that log, and the Wizard-of-Oz
      // fallback (§13-24) is triggered by it — so the one signal that would
      // ever fire the fallback was the one being discarded. Both sibling AI
      // routes already return this; this was the only one that did not, and
      // it is the one the primary outcome rests on.
      //
      // Not a leak: it says a model did not run, never which condition the
      // participant is in, and in a live study the guard makes this
      // unreachable anyway (503 above).
      stubbed: result.stubbed,
    });
  } catch (error) {
    // A MISCONFIGURED STUDY IS NOT A FAILED CLASSIFICATION, and the two must
    // not share an answer. `none` is right for a model call that failed —
    // recoverable, because the tier only rises and the participant can say it
    // again. Returning `none` because there is NO MODEL AT ALL would floor
    // every message of every session in silence, which is precisely the
    // invisible failure the guard exists to break. It surfaces as a 503.
    if (error instanceof ModelNotConfiguredError) {
      console.error("[classify-reason] model not configured", error);
      return NextResponse.json(
        { error: "Classifier unavailable" },
        { status: 503 },
      );
    }
    // A FAILED CLASSIFICATION IS `none`, NEVER A GUESS. The tier only ever
    // rises (§6.2), so a floor here costs the participant nothing they cannot
    // recover by saying more — while a guessed SB would hand out the maximum
    // package on a network error, in one arm only, on the primary outcome.
    console.error("[classify-reason]", error);
    return NextResponse.json({ label: "none", confidence: 0 });
  }
}
