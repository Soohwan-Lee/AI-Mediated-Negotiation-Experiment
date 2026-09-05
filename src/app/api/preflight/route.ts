/**
 * Launch preflight: is this deployment actually fit to run participants?
 *
 * WHY THIS ROUTE EXISTS. The one failure that destroys a data collection run
 * without announcing itself is a missing `OPENAI_API_KEY`: `generateAction`
 * falls back to a canned "[SCAFFOLD] No model configured…" line, the route
 * answers 200, and the negotiation proceeds to a coded outcome. Every
 * downstream measure then records a judgement about a counterpart that never
 * spoke, and nothing in the UI or the export marks the session as void.
 *
 * `npm run simulate` cannot catch it, because it reads `.env.local` directly
 * and is therefore always configured. The gap is between "the code works" and
 * "the DEPLOYMENT is configured", and only the deployed process can answer
 * that. This route is how the researcher asks it, from a browser, in one GET,
 * before posting the study to Prolific.
 *
 * WHAT IT WILL NOT DO IS PRINT A SECRET. `keyConfigured` is a boolean derived
 * from presence; the key itself is never read into the response, not even
 * masked. A masked key is still a leak of its length and last characters.
 *
 * IT IS TOKEN-GATED, and the reason is the participant rather than an
 * attacker. Nothing here is a credential, but `model`, `reasoningEffort` and
 * the dev flags would tell a curious participant who opens their network tab
 * that the other party is a language model — which is the first thing on the
 * "must never learn mid-study" list. Set `PREFLIGHT_TOKEN` and call
 * `/api/preflight?token=…`. With no token configured the route answers only
 * when this is NOT a live study, so it stays a one-command check locally and
 * closes itself the moment the study goes live unconfigured.
 */

import { NextResponse } from "next/server";
import { AI_CONFIG, modelReadiness } from "@/lib/ai/config";
import { STUDY, timingIsHonest, TOTAL_MINUTES } from "@/lib/study-config";

export const runtime = "nodejs";
/** Env is read per request; a cached answer would report a stale deployment. */
export const dynamic = "force-dynamic";

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

export async function GET(request: Request) {
  const readiness = modelReadiness();
  const url = new URL(request.url);

  /**
   * THE ENTRY GATE, and it is deliberately a different shape from the report.
   *
   * `?gate=1` answers one boolean and nothing else — no model id, no env, no
   * check list — so the consent page can refuse to start an unservable study
   * without telling the participant anything about the machinery. It needs no
   * token for exactly that reason: there is nothing in the answer to protect.
   *
   * IT IS AT ENTRY RATHER THAN PER-TURN because of what the clients do with a
   * failure. A 503 from /api/classify-reason is SWALLOWED — both callers read
   * `if (data.label) label = data.label` inside a try/catch, so a body with no
   * label silently leaves the tier at `none`, which is the very silence this
   * guard exists to break. And the Direct arm has no error state at all: its
   * counterpart fetch has no catch and falls through to "sorry, lost my train
   * of thought there", so a mid-negotiation refusal would have a participant
   * watch the counterpart apologise forever, forty minutes in, with half their
   * data already recorded. Refusing before consent costs them nothing.
   */
  if (url.searchParams.get("gate") === "1") {
    return NextResponse.json(
      { ready: readiness.ready },
      { status: readiness.ready ? 200 : 503 },
    );
  }

  const expected = process.env.PREFLIGHT_TOKEN?.trim();
  const supplied = url.searchParams.get("token")?.trim();

  // Gate: a configured token must match. With no token set, the route is
  // available only while this is not a live study — so forgetting to set one
  // cannot expose the study's machinery to a participant.
  const authorised = expected ? supplied === expected : !readiness.live;
  if (!authorised) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const checks: Check[] = [
    {
      name: "model_configured",
      pass: readiness.keyConfigured,
      detail: readiness.keyConfigured
        ? `${AI_CONFIG.apiKeyEnvVar} is set.`
        : `${AI_CONFIG.apiKeyEnvVar} is MISSING — the counterpart would serve placeholder text.`,
    },
    {
      name: "dev_tools_off",
      pass: process.env.NEXT_PUBLIC_DEV_TOOLS === "off",
      detail:
        process.env.NEXT_PUBLIC_DEV_TOOLS === "off"
          ? "Dev panel is not loaded."
          : "Dev panel IS loaded. It names the conditions and shows the assignment — set NEXT_PUBLIC_DEV_TOOLS=off and redeploy before recruiting.",
    },
    {
      name: "completion_code_set",
      pass: !STUDY.prolificCompletionCode.startsWith("TBD"),
      detail: STUDY.prolificCompletionCode.startsWith("TBD")
        ? "Prolific completion code is still a placeholder — participants could not be credited."
        : "Completion code is set.",
    },
    {
      name: "irb_protocol_set",
      pass: !STUDY.irb.protocolNumber.startsWith("TBD"),
      detail: STUDY.irb.protocolNumber.startsWith("TBD")
        ? "IRB protocol number is still a placeholder."
        : "IRB protocol number is set.",
    },
    {
      name: "timing_honest",
      // The advertised figure may round the budget DOWN by at most a minute:
      // a listing that promises less than the study takes underpays whoever is
      // slower than the estimate, and the fair-pay rate is computed from it.
      pass: timingIsHonest(),
      detail: `Advertised ${STUDY.estimatedMinutes} min against a ${TOTAL_MINUTES} min budget.`,
    },
  ];

  const ready = checks.every((c) => c.pass);

  return NextResponse.json(
    {
      ready,
      // Not a check — context for reading the ones above.
      environment: {
        live: readiness.live,
        vercelEnv: process.env.VERCEL_ENV ?? null,
        devTools: process.env.NEXT_PUBLIC_DEV_TOOLS ?? "on",
        model: AI_CONFIG.model,
        reasoningEffort: AI_CONFIG.reasoningEffort,
      },
      checks,
      blocking: readiness.reason,
    },
    // THE STATUS FOLLOWS EVERY CHECK, not just the model. It used to follow
    // `readiness.ready` alone, so a deployment with the dev panel still
    // loaded and the completion code still `TBD` answered `"ready": false`
    // with HTTP 200 — and the comment right here promised a script could fail
    // on the status without parsing the body. It could not. The point of this
    // route is `curl -f` in a launch checklist, so the status has to mean what
    // the body says.
    { status: ready ? 200 : 503 },
  );
}
