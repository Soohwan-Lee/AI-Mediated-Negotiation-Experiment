/**
 * LLM client. Server-side only — the API key never reaches the client bundle
 * (Methods §Technical stack).
 *
 * SCAFFOLD STATE: `generateAction` returns a deterministic canned action when
 * no API key is configured, so the whole flow is walkable without credentials.
 * With a key present it calls the OpenAI-compatible Responses API and asks for
 * structured output against NEGOTIATION_ACTION_SCHEMA.
 */

import { AI_CONFIG, getApiKey } from "./config";
import { NEGOTIATION_ACTION_SCHEMA, type NegotiationAction } from "./schema";
import {
  buildSystemPrompt,
  STRUCTURED_OUTPUT_INSTRUCTION,
  type AgentKind,
  type PromptContext,
} from "./prompts";

export interface GenerateArgs {
  kind: AgentKind;
  ctx: PromptContext;
  /** Prior visible messages, oldest first. */
  history: Array<{ role: "assistant" | "user"; content: string }>;
}

export interface GenerateResult {
  action: NegotiationAction;
  /** True when the canned fallback was used instead of a real model call. */
  stubbed: boolean;
  raw?: unknown;
}

/** Used when no API key is configured, so the UI is still exercisable. */
function stubAction(ctx: PromptContext): NegotiationAction {
  const first = ctx.issues[0];
  return {
    actionType: "propose",
    issueTargets: first ? [first.id] : [],
    proposedTerms: first
      ? [{ issueId: first.id, optionId: first.options[0].id }]
      : [],
    conditionalLink: null,
    stage: ctx.stage,
    requirementStatus: "not_addressed",
    reasonSourceId: null,
    addedReasonSourceId: null,
    rationale:
      "[SCAFFOLD] No model configured. This is placeholder counterpart text so the interface can be reviewed end to end.",
    unresolved: false,
    internalProvenance: "principal_reason",
  };
}

export async function generateAction(
  args: GenerateArgs,
): Promise<GenerateResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { action: stubAction(args.ctx), stubbed: true };
  }

  const system = `${buildSystemPrompt(args.kind, args.ctx)}\n${STRUCTURED_OUTPUT_INSTRUCTION}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      // No `temperature`: this model family rejects it (see ai/config.ts).
      reasoning: { effort: AI_CONFIG.reasoningEffort },
      max_output_tokens: AI_CONFIG.maxOutputTokens,
      input: [
        { role: "system", content: system },
        ...args.history.map((m) => ({ role: m.role, content: m.content })),
      ],
      text: {
        format: {
          type: "json_schema",
          name: "negotiation_action",
          strict: true,
          schema: NEGOTIATION_ACTION_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `LLM request failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as ResponsesPayload;
  const text = extractOutputText(payload);

  if (!text) {
    throw new Error(
      `LLM returned no message content (status: ${payload.status ?? "unknown"})`,
    );
  }

  return {
    action: JSON.parse(text) as NegotiationAction,
    stubbed: false,
    raw: payload,
  };
}

/**
 * A plain-text turn, for the rehearsal conversation.
 *
 * Separate from `generateAction` because the rehearsal produces no negotiation
 * action: nothing is proposed, conceded or accepted, so there is no structured
 * move to validate and no schema to force. `lib/negotiation/machine` is not
 * involved at all — which is the point. The proxy is describing a mandate it
 * has been handed, and the state machine still owns every real decision.
 */
export async function generateText(args: {
  kind: AgentKind;
  ctx: PromptContext;
  history: Array<{ role: "assistant" | "user"; content: string }>;
}): Promise<{ text: string; stubbed: boolean }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      text: "[SCAFFOLD] No model configured, so I cannot answer properly yet. With a key set I would tell you what I will open with, how far I will go, and which of your reasons I may use.",
      stubbed: true,
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      // No `temperature` — see ai/config.ts.
      reasoning: { effort: AI_CONFIG.reasoningEffort },
      max_output_tokens: AI_CONFIG.maxOutputTokens,
      input: [
        { role: "system", content: buildSystemPrompt(args.kind, args.ctx) },
        ...args.history.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `LLM request failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as ResponsesPayload;
  const text = extractOutputText(payload);
  if (!text) {
    throw new Error(
      `LLM returned no message content (status: ${payload.status ?? "unknown"})`,
    );
  }
  return { text: text.trim(), stubbed: false };
}

interface ResponsesPayload {
  status?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}

/**
 * Pulls the assistant's text out of a Responses API payload.
 *
 * This model emits a `reasoning` block BEFORE the `message` block, so indexing
 * output[0] returns reasoning with no text. Select by block type instead.
 */
function extractOutputText(payload: ResponsesPayload): string {
  if (payload.output_text) return payload.output_text;

  const message = payload.output?.find((o) => o.type === "message");
  const chunk = message?.content?.find(
    (c) => c.type === "output_text" || typeof c.text === "string",
  );
  return chunk?.text ?? "";
}
