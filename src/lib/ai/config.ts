/**
 * LLM configuration. Server-side only — never import from a client component.
 *
 * Methods §Agent architecture: the model snapshot is fixed for the duration of
 * data collection. If it changes mid-study, the collection batch must be split.
 */

export const AI_CONFIG = {
  /** Pinned model. Override via env without a code change. */
  model: process.env.OPENAI_MODEL ?? "gpt-5.6-sol",
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
  return process.env[AI_CONFIG.apiKeyEnvVar] ?? null;
}
