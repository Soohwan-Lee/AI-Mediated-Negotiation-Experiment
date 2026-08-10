/**
 * Structured negotiation action schema.
 *
 * Methods §Agent architecture: agents return a validated JSON action FIRST and
 * the natural-language message is generated from it — not free text parsed
 * after the fact. The state machine, not the model, decides feasibility.
 */

export type ActionType =
  | "open"
  | "propose"
  | "counter"
  | "question"
  | "clarify"
  | "conditional_trade"
  | "accept"
  | "leave_unresolved";

export interface ProposedTerm {
  issueId: string;
  optionId: string;
}

export interface NegotiationAction {
  actionType: ActionType;
  /** Issues this action touches. */
  issueTargets: string[];
  proposedTerms: ProposedTerm[];
  /** "If you accept X, we can move on Y" — links two issues. */
  conditionalLink: { give: string[]; get: string[] } | null;
  /** Short rationale text used to generate the visible message. */
  rationale: string;
  unresolved: boolean;
  /**
   * Audit-only. Stored in the backend, never rendered to participants in the
   * Explorer condition (Methods §Explorer Proxy condition).
   */
  internalProvenance: "principal_mandate" | "agent_option";
}

/** JSON Schema passed to the model for structured output. */
export const NEGOTIATION_ACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "actionType",
    "issueTargets",
    "proposedTerms",
    "conditionalLink",
    "rationale",
    "unresolved",
    "internalProvenance",
  ],
  properties: {
    actionType: {
      type: "string",
      enum: [
        "open",
        "propose",
        "counter",
        "question",
        "clarify",
        "conditional_trade",
        "accept",
        "leave_unresolved",
      ],
    },
    issueTargets: { type: "array", items: { type: "string" } },
    proposedTerms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["issueId", "optionId"],
        properties: {
          issueId: { type: "string" },
          optionId: { type: "string" },
        },
      },
    },
    conditionalLink: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["give", "get"],
      properties: {
        give: { type: "array", items: { type: "string" } },
        get: { type: "array", items: { type: "string" } },
      },
    },
    rationale: { type: "string" },
    unresolved: { type: "boolean" },
    internalProvenance: {
      type: "string",
      enum: ["principal_mandate", "agent_option"],
    },
  },
} as const;
