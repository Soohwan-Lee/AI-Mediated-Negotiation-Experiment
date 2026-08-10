/**
 * LLM configuration. Server-side only — never import from a client component.
 *
 * Methods §Agent architecture: the model snapshot is fixed for the duration of
 * data collection. If it changes mid-study, the collection batch must be split.
 */

export const AI_CONFIG = {
  /** Pinned model. Override via env without a code change. */
  model: process.env.OPENAI_MODEL ?? "gpt-5.6-sol",
  /** Low temperature for output consistency. Fixed after pilot. */
  temperature: 0.3,
  maxOutputTokens: 800,
  apiKeyEnvVar: "OPENAI_API_KEY",
} as const;

export function getApiKey(): string | null {
  return process.env[AI_CONFIG.apiKeyEnvVar] ?? null;
}
