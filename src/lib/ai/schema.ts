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
   * A TRIPWIRE, not a slot to fill. Always null in correct output.
   *
   * Ver.2.20 abolished the role-plausible pool: neither policy adds a reason of
   * its own any more. AI-Supplemented REPLACES the sensitive card with the
   * fixed §6.6 sentences, and those are supplied by the route rather than
   * invented by the model — so there is nothing legitimate to put here, under
   * either policy, and any value is a `provenance_policy_violation`. The field
   * survives precisely so a model that invents a reason is caught saying so,
   * rather than doing it silently in the rationale.
   */
  addedReasonSourceId: string | null;
  /** Short rationale text used to generate the visible message. */
  rationale: string;
  unresolved: boolean;
  /**
   * Audit-only. Stored in the backend, never rendered to participants in the
   * AI-Supplemented condition (Design §7 "이유 출처 표시").
   *
   * ONE VALUE SINCE VER.2.20. The role-plausible pool is gone (§6.6): the
   * AI-Supplemented policy no longer ADDS a reason beside the principal's
   * card, it REPLACES the card with the fixed abstraction and two covers, all
   * three supplied by the route. So every message draws on the principal, and
   * a model that wanted to claim otherwise no longer has a value to claim it
   * with — which is the point of narrowing the enum rather than leaving a
   * dead one in place.
   */
  internalProvenance: "principal_reason";
}

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
      enum: ["principal_reason"],
    },
  },
} as const;
