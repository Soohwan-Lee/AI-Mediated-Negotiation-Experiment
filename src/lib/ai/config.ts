/**
 * LLM configuration. Server-side only — never import from a client component.
 *
 * Methods §Agent architecture: the model snapshot is fixed for the duration of
 * data collection. If it changes mid-study, the collection batch must be split.
 */

export const AI_CONFIG = {
  /**
   * Pinned model. Override via env without a code change.
   *
   * WHY `terra` RATHER THAN `sol`. Both were run against the real routes on
   * the same prompts (2026-08-26). They are API-identical — same Responses
   * shape, same refusal of `temperature`, same reasoning-block-first ordering
   * — and produced equivalent proxy messages: the same package sentence, the
   * same three-part depersonalisation of a sensitive card, the same bubble
   * split. `terra` is the cheaper snapshot at that quality, and per-turn
   * latency was no worse (~3.5–4.2s against ~4.7–5.6s).
   *
   * The snapshot is fixed for the duration of data collection either way. If
   * this changes mid-study, the collection batch must be split — so change it
   * before the pilot or not at all.
   */
  model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
  /**
   * Reasoning effort. This model family does NOT accept `temperature` — it is
   * fixed at 1.0 server-side and sending it returns a 400. Output consistency
   * is controlled through reasoning effort and the strict output schema
   * instead. Fix this value after pilot and hold it for data collection.
   */
  reasoningEffort: "low" as "low" | "medium" | "high",
  /**
   * Must comfortably exceed the visible message length: reasoning tokens are
   * drawn from the same budget, and a too-small cap returns status
   * "incomplete" with no message block.
   */
  maxOutputTokens: 3000,
  apiKeyEnvVar: "OPENAI_API_KEY",
} as const;

export function getApiKey(): string | null {
  const raw = process.env[AI_CONFIG.apiKeyEnvVar];
  // TRIMMED, AND EMPTY COUNTS AS ABSENT. `OPENAI_API_KEY=` with nothing after
  // it is how this actually goes wrong — a variable present in the dashboard
  // but blank reads as a set string, which would pass a plain null check and
  // then fail at the API. It is also exactly what `.env.local` produces when
  // the value is deleted but the line is left behind.
  const key = raw?.trim();
  return key ? key : null;
}

/**
 * Thrown when a live study has no model configured.
 *
 * A NAMED CLASS BECAUSE THE ROUTES MUST TELL IT APART from an ordinary model
 * failure. `/api/classify-reason` answers a failed call with
 * `{label:"none"}` on purpose — the tier only rises, so a floor costs the
 * participant nothing they cannot recover by saying more. But that same
 * answer for a MISCONFIGURED STUDY would bury the one signal there is: every
 * message floored, silently, with the negotiation running on regardless.
 * Same shape, opposite meaning, so the two cannot share a catch.
 */
export class ModelNotConfiguredError extends Error {
  readonly code = "model_not_configured";
  constructor(message: string) {
    super(message);
    this.name = "ModelNotConfiguredError";
  }
}

/**
 * Is a real participant possibly on the other end of this process?
 *
 * TWO INDEPENDENT SIGNALS, EITHER ONE SUFFICIENT, because they fail in
 * opposite directions and the cost of the two mistakes is not symmetric.
 *
 * - `NEXT_PUBLIC_DEV_TOOLS === "off"` is the switch the launch checklist
 *   tells the researcher to throw before recruiting. It is inlined at build
 *   time and is also readable here on the server.
 * - `VERCEL_ENV === "production"` is the deployment itself saying so, and it
 *   catches the case the first one misses: the checklist step was forgotten.
 *
 * ERRING TOWARD REFUSAL IS THE WHOLE POINT. A false positive costs a
 * researcher one confusing error on a local production build, and the fix is
 * to set the key. A false negative costs a full data collection run in which
 * every participant negotiated against placeholder text and nothing said so.
 */
export function isLiveStudy(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEV_TOOLS === "off" ||
    process.env.VERCEL_ENV === "production"
  );
}

export interface ModelReadiness {
  /** Safe to run a participant through this process. */
  ready: boolean;
  /** A key is configured (never the key itself). */
  keyConfigured: boolean;
  /** A participant may be on the other end — see `isLiveStudy`. */
  live: boolean;
  /** Why not ready, in plain words. Null when ready. */
  reason: string | null;
}

/**
 * Whether this process may serve a participant, and why not if it may not.
 *
 * THE FAILURE THIS EXISTS FOR IS A SILENT ONE. With no key, `generateAction`
 * returns a canned "[SCAFFOLD] No model configured…" action and the route
 * answers 200. The negotiation then RUNS: packages settle, the ladder codes
 * an outcome, the questionnaire records judgements about a counterpart that
 * never said anything. Nothing on screen, in the transcript, or in the export
 * marks the session as void — the study looks like it worked.
 *
 * `npm run simulate` cannot catch it either, because it reads `.env.local`
 * directly and so is always configured. The only place this is detectable is
 * the deployed process itself, which is why the check lives here.
 *
 * The scaffold stays available when this is NOT a live study: walking the
 * flow without credentials is what it is for.
 */
export function modelReadiness(): ModelReadiness {
  const keyConfigured = getApiKey() !== null;
  const live = isLiveStudy();
  if (keyConfigured) {
    return { ready: true, keyConfigured, live, reason: null };
  }
  return {
    ready: !live,
    keyConfigured,
    live,
    reason: live
      ? `${AI_CONFIG.apiKeyEnvVar} is not set, and this is a live study ` +
        `(NEXT_PUBLIC_DEV_TOOLS=off or VERCEL_ENV=production). Refusing to ` +
        `serve placeholder counterpart text to a participant.`
      : null,
  };
}
