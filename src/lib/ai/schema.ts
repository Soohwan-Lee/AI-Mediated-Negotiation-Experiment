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
   * Which of the principal's own reason cards the visible rationale draws on,
   * if any — a card id, designated by the state machine (Design §7 ver.2.6).
   *
   * A `pool:<n>` id may still appear here for the Explorer's exchange
   * argument, which links terms rather than arguing for one and so has no
   * principal card to sit beside.
   */
  reasonSourceId: string | null;
  /**
   * Explorer only: a pre-approved role-plausible argument added ALONGSIDE the
   * card in `reasonSourceId`, inside the same message.
   *
   * WHY THIS IS A SECOND FIELD. Ver.2.5 deliberately used one field, on the
   * grounds that a second one "the model could fill in inconsistently with the
   * first" was a liability. Ver.2.6 removes that premise — the state machine
   * designates both, so neither is the model's choice — and makes the single
   * field actively wrong: §7 now requires the pool clause to be ADDITIVE, in
   * the same message as the principal's reason. With one slot the two compete,
   * and both outcomes corrupt the primary contrast. Put the pool id in it and
   * the principal's card goes unrecorded, and the message's issue becomes the
   * pool item's — which for each role's exchange argument is null, so the
   * requirement's reason is never registered and the Explorer arm arrives at
   * the direct conversation flagged reasonless where the Delegate arm does
   * not. Put the card id in it and the pool reason is invisible to the budget,
   * so the one-per-issue and two-per-task caps gate 10 rests on stop binding.
   */
  addedReasonSourceId: string | null;
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
    "addedReasonSourceId",
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
