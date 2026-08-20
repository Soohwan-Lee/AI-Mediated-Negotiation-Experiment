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
  /** Which of the five stages this action belongs to. */
  stage: 1 | 2 | 3 | 4 | 5;
  /** Issues this action touches. */
  issueTargets: string[];
  proposedTerms: ProposedTerm[];
  /** "If you accept X, we can move on Y" — links two issues. */
  conditionalLink: { give: string[]; get: string[] } | null;
  /** Where this side's requirement stands after this action. */
  requirementStatus: "held" | "traded" | "reduced" | "not_addressed";
  /**
   * Which reason the visible rationale draws on, if any.
   *
   * A card id for one of the principal's own cards, or `pool:<n>` for a
   * pre-approved role-plausible argument. The prefix is what lets the
   * validator enforce that only an Explorer may use the pool, without needing
   * a second field the model could fill in inconsistently with the first.
   */
  reasonSourceId: string | null;
  /** Short rationale text used to generate the visible message. */
  rationale: string;
  unresolved: boolean;
  /**
   * Audit-only. Stored in the backend, never rendered to participants in the
   * Explorer condition (Design §7 "이유 출처 표시").
   */
  internalProvenance: "principal_reason" | "pool_reason";
}

/** JSON Schema passed to the model for structured output. */
export const NEGOTIATION_ACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "actionType",
    "stage",
    "requirementStatus",
    "reasonSourceId",
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
    stage: { type: "integer", enum: [1, 2, 3, 4, 5] },
    requirementStatus: {
      type: "string",
      enum: ["held", "traded", "reduced", "not_addressed"],
    },
    reasonSourceId: { type: ["string", "null"] },
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
      enum: ["principal_reason", "pool_reason"],
    },
  },
} as const;
