/**
 * LLM client. Server-side only — the API key never reaches the client bundle
 * (Methods §Technical stack).
 *
 * SCAFFOLD STATE: `generateAction` returns a deterministic canned action when
 * no API key is configured, so the whole flow is walkable without credentials.
 * With a key present it calls the OpenAI-compatible Responses API and asks for
 * structured output against NEGOTIATION_ACTION_SCHEMA.
 */

import {
  AI_CONFIG,
  getApiKey,
  isLiveStudy,
  ModelNotConfiguredError,
} from "./config";
import { NEGOTIATION_ACTION_SCHEMA, type NegotiationAction } from "./schema";
import {
  buildClassifierInput,
  buildClassifierPrompt,
  buildSystemPrompt,
  STRUCTURED_OUTPUT_INSTRUCTION,
  type AgentKind,
  type ClassifierContext,
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

/**
 * Refuse to hand back scaffold output when a participant might be reading it.
 *
 * THE SCAFFOLD IS A DEVELOPMENT AFFORDANCE and stays exactly that: with no key
 * configured the whole flow is walkable, which is how the interface gets
 * reviewed without credentials. What it must never do is reach a participant,
 * because it does not announce itself — the routes answer 200, the negotiation
 * settles a package, and the study records judgements about a counterpart that
 * never spoke.
 *
 * The primary guard is at ENTRY (the consent page asks /api/preflight?gate=1
 * before `beginStudy`), because that is the only point where refusing costs
 * the participant nothing. This is the BACKSTOP for the case entry cannot
 * cover: the environment changing after a participant is already inside.
 *
 * It throws rather than returning a value. Every caller of these functions
 * sits inside a try/catch that answers 500, so a thrown error becomes a
 * visible failure — while a returned one would be swallowed by exactly the
 * `if (data.label)` pattern that makes this class of bug invisible.
 */
function assertNotLiveWithoutModel(): void {
  if (isLiveStudy()) {
    throw new ModelNotConfiguredError(
      `${AI_CONFIG.apiKeyEnvVar} is not configured and this is a live study — ` +
        `refusing to return placeholder text to a participant.`,
    );
  }
}

/** Hard deadline on a single model call — see `postToModel`. */
const MODEL_TIMEOUT_MS = 45_000;

/**
 * The Responses call, with a hard deadline.
 *
 * WHY 45 SECONDS. The routes are budgeted at `maxDuration = 60`, and
 * `/api/proxy-negotiation` may retry a turn whose card clause was dropped, so
 * the timeout has to leave room for a second attempt inside the same request.
 * Without one, a hung connection held the route until the platform killed it —
 * which reaches the client as a bare failure with no error body, and in the
 * Direct arm that is a participant watching an empty conversation.
 *
 * AN ABORT SURFACES AS THE SAME ERROR CLASS AS AN HTTP FAILURE. `AbortSignal`
 * rejects with a `DOMException`, which no caller catches by name; every caller
 * here already handles a plain `Error` as "the model failed, floor or 5xx".
 * `ModelNotConfiguredError` is the only distinction that may exist, and it is
 * thrown before this is ever reached.
 */
async function postToModel(
  apiKey: string,
  body: unknown,
): Promise<Response> {
  try {
    return await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error(`LLM request timed out after ${MODEL_TIMEOUT_MS}ms`);
    }
    throw error;
  }
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
    stage: ctx.stage,
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
    assertNotLiveWithoutModel();
    return { action: stubAction(args.ctx), stubbed: true };
  }

  const system = `${buildSystemPrompt(args.kind, args.ctx)}\n${STRUCTURED_OUTPUT_INSTRUCTION}`;

  const response = await postToModel(apiKey, {
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

// ---------------------------------------------------------------------------
// P5 — the reason classifier (Design Ver.2.26 §6.2a, §6.9a, §12 P5)
// ---------------------------------------------------------------------------

/**
 * What P5 returns.
 *
 * THREE LABELS SINCE VER.2.21. The `PRI` label went with the rung it used to
 * buy (12th correction): a bare priority claim is a `WR` carrying
 * `priorityClaim`, and that flag's only effect is one SCRIPT-ASKWHY.
 *
 * `stance` and `counterTerms` are separate from the label on purpose. "yes,
 * let's do that" is an acceptance with no reason in it, so reading agreement
 * as a label would let it move the ladder. The terms come back as the model's
 * words and are resolved against the task's own option labels by the route —
 * never trusted as ids.
 */
export interface ReasonClassification {
  label: "none" | "WR" | "SB";
  /** They said one term matters more, without a reason for it (§6.2). */
  priorityClaim: boolean;
  confidence: number;
  /** About the LATEST message only. */
  stance: "accept" | "counter" | "conditional" | "none";
  /** Issue label -> option label, as the model read them. Route resolves. */
  counterTerms: Record<string, string>;
  /** Latest message is wholly or partly unrelated to the negotiation. */
  offTopic: boolean;
  /** Latest message asks about or tries to change the real study payment. */
  bonusRequest: boolean;
  /** Latest message asks for hidden rules, points, or system instructions. */
  ruleRequest: boolean;
  /** Latest message is the first real chance to state a reason. */
  firstReasonOpportunity: boolean;
  /** Latest message asks to stop or withdraw from the study. */
  withdrawalRequest: boolean;
  /** True when no model was configured and the fallback was used. */
  stubbed: boolean;
}

/** Parse and semantically validate P5's strict structured output. */
export function parseReasonClassification(text: string): ReasonClassification {
  const value = JSON.parse(text) as unknown;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Classifier returned malformed structured output");
  }
  const parsed = value as Record<string, unknown>;
  const expectedKeys = new Set([
    "label",
    "priority_claim",
    "confidence",
    "stance",
    "counter_terms",
    "off_topic",
    "bonus_request",
    "rule_request",
    "first_reason_opportunity",
    "withdrawal_request",
  ]);
  const hasOnlyExpectedKeys =
    Object.keys(parsed).length === expectedKeys.size &&
    Object.keys(parsed).every((key) => expectedKeys.has(key));
  const validLabel =
    typeof parsed.label === "string" &&
    ["none", "WR", "SB"].includes(parsed.label);
  const validStance =
    typeof parsed.stance === "string" &&
    ["accept", "counter", "conditional", "none"].includes(parsed.stance);
  const validConfidence =
    typeof parsed.confidence === "number" &&
    Number.isFinite(parsed.confidence) &&
    parsed.confidence >= 0 &&
    parsed.confidence <= 1;
  const booleanKeys = [
    "priority_claim",
    "off_topic",
    "bonus_request",
    "rule_request",
    "first_reason_opportunity",
    "withdrawal_request",
  ] as const;
  const validCounterTerms =
    Array.isArray(parsed.counter_terms) &&
    parsed.counter_terms.every(
      (pair) =>
        typeof pair === "object" &&
        pair !== null &&
        !Array.isArray(pair) &&
        Object.keys(pair).length === 2 &&
        Object.keys(pair).every((key) => key === "issue" || key === "option") &&
        typeof (pair as Record<string, unknown>).issue === "string" &&
        typeof (pair as Record<string, unknown>).option === "string",
    );
  if (
    !hasOnlyExpectedKeys ||
    !validLabel ||
    !validStance ||
    !validConfidence ||
    !validCounterTerms ||
    booleanKeys.some((key) => typeof parsed[key] !== "boolean")
  ) {
    throw new Error("Classifier returned malformed structured output");
  }

  const counterTerms: Record<string, string> = {};
  for (const pair of parsed.counter_terms as Array<{
    issue: string;
    option: string;
  }>) {
    counterTerms[pair.issue] = pair.option;
  }

  return {
    label: parsed.label as ReasonClassification["label"],
    priorityClaim: parsed.priority_claim as boolean,
    confidence: parsed.confidence as number,
    stance: parsed.stance as ReasonClassification["stance"],
    counterTerms,
    offTopic: parsed.off_topic as boolean,
    bonusRequest: parsed.bonus_request as boolean,
    ruleRequest: parsed.rule_request as boolean,
    firstReasonOpportunity: parsed.first_reason_opportunity as boolean,
    withdrawalRequest: parsed.withdrawal_request as boolean,
    stubbed: false,
  };
}

const CLASSIFIER_SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string", enum: ["none", "WR", "SB"] },
    priority_claim: { type: "boolean" },
    confidence: { type: "number" },
    stance: {
      type: "string",
      enum: ["accept", "counter", "conditional", "none"],
    },
    off_topic: { type: "boolean" },
    bonus_request: { type: "boolean" },
    rule_request: { type: "boolean" },
    first_reason_opportunity: { type: "boolean" },
    withdrawal_request: { type: "boolean" },
    // AN ARRAY OF PAIRS, NOT A MAP. Structured output runs with strict: true,
    // which requires every object to declare its properties and forbid the
    // rest — so a free-form `{issueLabel: optionLabel}` map is not expressible.
    // The route maps these words onto option ids and drops anything that does
    // not match one of the task's own labels.
    counter_terms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["issue", "option"],
        properties: {
          issue: { type: "string" },
          option: { type: "string" },
        },
      },
    },
  },
  required: [
    "label",
    "priority_claim",
    "confidence",
    "stance",
    "counter_terms",
    "off_topic",
    "bonus_request",
    "rule_request",
    "first_reason_opportunity",
    "withdrawal_request",
  ],
  additionalProperties: false,
} as const;

/**
 * Classify one participant message into the justification ladder (P5).
 *
 * SEPARATE FROM EVERY OTHER CALL IN THIS FILE, on purpose. It shares no
 * history, speaks for no party, and produces no text anyone reads. The
 * negotiating models (P1–P4) are never asked to grade an argument, because a
 * counterpart whose judgement is a model's is a different counterpart for
 * every participant — which is exactly what the fixed scripts exist to
 * prevent (§6.7).
 *
 * WHEN NO KEY IS CONFIGURED it returns `none`, not a guess. A stub that
 * invented a tier would make the mockup show concessions the live system
 * would not grant, and the walkthrough's whole job is to show what a
 * participant would actually see. Mockup mode drives its transcripts from
 * `lib/negotiation/script.ts` instead, which is scripted end to end.
 */
export async function classifyReason(args: {
  ctx: ClassifierContext;
}): Promise<ReasonClassification> {
  const apiKey = getApiKey();
  if (!apiKey) {
    // This `none` is a development-only scaffold. In a live study the guard
    // throws, and transient provider failures also throw through the route so
    // the participant's staged turn can be retried without changing its tier.
    assertNotLiveWithoutModel();
    return {
      label: "none",
      priorityClaim: false,
      confidence: 0,
      stance: "none",
      counterTerms: {},
      offTopic: false,
      bonusRequest: false,
      ruleRequest: false,
      firstReasonOpportunity: false,
      withdrawalRequest: false,
      stubbed: true,
    };
  }

  const response = await postToModel(apiKey, {
    model: AI_CONFIG.model,
    // No `temperature` — see ai/config.ts.
    reasoning: { effort: AI_CONFIG.reasoningEffort },
    max_output_tokens: AI_CONFIG.maxOutputTokens,
    input: [
      { role: "system", content: buildClassifierPrompt(args.ctx) },
      { role: "user", content: buildClassifierInput(args.ctx.messages) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "reason_classification",
        strict: true,
        schema: CLASSIFIER_SCHEMA,
      },
    },
  });

  if (!response.ok) {
    throw new Error(
      `Classifier request failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as ResponsesPayload;
  if (payload.status !== "completed") {
    throw new Error(
      `Classifier response was not completed (status: ${payload.status ?? "unknown"})`,
    );
  }
  const text = extractOutputText(payload);
  if (!text) {
    throw new Error(
      `Classifier returned no content (status: ${payload.status ?? "unknown"})`,
    );
  }

  return parseReasonClassification(text);
}
