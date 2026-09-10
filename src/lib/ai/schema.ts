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
  /** Which of the six stages this action belongs to. */
  stage: 1 | 2 | 3 | 4 | 5 | 6;
  /** Issues this action touches. */
  issueTargets: string[];
  proposedTerms: ProposedTerm[];
  /**
   * Which of the principal's own reason cards the visible rationale draws on,
   * if any — a card id, designated by the state machine (§6.5).
   *
   * Card ids only. The `pool:<n>` form went with the role-plausible pool
   * (Ver.2.20 §6.6), and the validator no longer lets any prefix through
   * unchecked: with no legitimate id able to carry one, a prefix is exactly the
   * shape a leak would take.
   */
  reasonSourceId: string | null;
  /**
   * Null unless the trusted AI-Supplemented renderer adds its two approved
   * public work-benefit arguments. Arbitrary model-authored source ids remain
   * guardrail violations.
   */
  addedReasonSourceId: string | null;
  /** Short rationale text used to generate the visible message. */
  rationale: string;
  unresolved: boolean;
  /** Audit-only and stripped from the participant-facing response. */
  internalProvenance:
    | "principal_reason"
    | "principal_reason_with_ai_work_benefits";
}

/** The only additive reason source the trusted policy renderer may attach. */
export const AI_WORK_BENEFITS_SOURCE_ID =
  "system:approved_work_benefits" as const;

/** JSON Schema passed to the model for structured output. */
export const NEGOTIATION_ACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "actionType",
    "stage",
    "reasonSourceId",
    "addedReasonSourceId",
    "issueTargets",
    "proposedTerms",
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
    stage: { type: "integer", enum: [1, 2, 3, 4, 5, 6] },
    reasonSourceId: { type: ["string", "null"] },
    addedReasonSourceId: { type: ["string", "null"] },
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
    rationale: { type: "string" },
    unresolved: { type: "boolean" },
    internalProvenance: {
      type: "string",
      enum: [
        "principal_reason",
        "principal_reason_with_ai_work_benefits",
      ],
    },
  },
} as const;
