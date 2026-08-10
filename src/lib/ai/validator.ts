/**
 * Backend guardrail validator (Methods §Guardrail and validation).
 *
 * Every structured action passes through here before it is allowed into the
 * transcript. Invalid actions are never rendered — the agent is asked to
 * regenerate, or the issue is marked unresolved. Every block is logged.
 *
 * This is the component that makes Delegate and Explorer genuinely different
 * conditions rather than two prompts that happen to differ, so it is
 * deliberately independent of the model output.
 */

import type { Issue, Mandate, Role } from "../types";
import type { NegotiationAction } from "./schema";

export type ViolationCode =
  | "unknown_issue"
  | "unknown_option"
  | "unauthorized_issue"
  | "red_line_violation"
  | "concession_envelope_violation"
  | "fabricated_personal_fact"
  | "impossible_resource_promise"
  | "role_authority_violation"
  | "agent_option_not_allowed";

export interface Violation {
  code: ViolationCode;
  detail: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
  /** What the caller should do next. */
  disposition: "accept" | "regenerate" | "mark_unresolved";
}

export interface ValidationContext {
  issues: Issue[];
  /** Absent for the Direct-condition counterpart. */
  mandate?: Mandate;
  policy: "direct" | "delegate" | "explorer";
  actorRole: Role;
}

/**
 * Phrases that would assert a new personal fact about the principal. The
 * Explorer may introduce task-grounded options but must never fabricate
 * personal circumstances (Methods §Explorer Proxy condition).
 *
 * NOTE: a lexical screen is a floor, not a ceiling. Before data collection this
 * should be paired with a model-based check on the generated message.
 */
const PERSONAL_FACT_PATTERNS: RegExp[] = [
  /\bmy (?:principal|client)'s (?:family|health|child|children|illness|divorce|debt|medical)\b/i,
  /\b(?:he|she|they) (?:has|have|is|are) (?:sick|ill|pregnant|caring for)\b/i,
  /\bbecause of (?:his|her|their) personal\b/i,
  /\bcan(?:no|')t afford\b/i,
];

const IMPOSSIBLE_PROMISE_PATTERNS: RegExp[] = [
  /\bI (?:guarantee|promise) (?:a )?(?:promotion|raise|bonus)\b/i,
  /\bunlimited (?:budget|resources|hours)\b/i,
  /\bI(?:'ll| will) (?:hire|fire)\b/i,
];

export function validateAction(
  action: NegotiationAction,
  ctx: ValidationContext,
): ValidationResult {
  const violations: Violation[] = [];
  const issueById = new Map(ctx.issues.map((i) => [i.id, i]));

  // --- structural: issues and options must exist -------------------------
  for (const term of action.proposedTerms) {
    const issue = issueById.get(term.issueId);
    if (!issue) {
      violations.push({
        code: "unknown_issue",
        detail: `No such issue: ${term.issueId}`,
      });
      continue;
    }
    if (!issue.options.some((o) => o.id === term.optionId)) {
      violations.push({
        code: "unknown_option",
        detail: `Option ${term.optionId} is not valid for issue ${term.issueId}`,
      });
    }
  }

  for (const issueId of action.issueTargets) {
    if (!issueById.has(issueId)) {
      violations.push({
        code: "unknown_issue",
        detail: `No such issue in targets: ${issueId}`,
      });
    }
  }

  // --- mandate-bound checks (proxy conditions only) ----------------------
  if (ctx.mandate && ctx.policy !== "direct") {
    const mandateByIssue = new Map(
      ctx.mandate.issues.map((m) => [m.issueId, m]),
    );

    for (const term of action.proposedTerms) {
      const issueMandate = mandateByIssue.get(term.issueId);
      const issue = issueById.get(term.issueId);
      if (!issue) continue;

      const entrusted = issueMandate?.entrusted ?? false;

      // Delegate may only touch entrusted issues. Explorer may reach beyond
      // them, but only via task-grounded agent options.
      if (!entrusted) {
        if (ctx.policy === "delegate") {
          violations.push({
            code: "unauthorized_issue",
            detail: `Issue ${term.issueId} was not entrusted to the Delegate.`,
          });
        } else if (action.internalProvenance !== "agent_option") {
          violations.push({
            code: "agent_option_not_allowed",
            detail: `Issue ${term.issueId} is not entrusted, so it must be marked as an agent option.`,
          });
        }
      }

      // Red line / concession envelope: the proposed option may not sit past
      // the principal's reservation level on the issue's ordered option list.
      if (issueMandate?.reservationOptionId) {
        const order = issue.options.map((o) => o.id);
        const proposedIdx = order.indexOf(term.optionId);
        const reservationIdx = order.indexOf(issueMandate.reservationOptionId);
        const idealIdx = issueMandate.idealOptionId
          ? order.indexOf(issueMandate.idealOptionId)
          : -1;

        if (proposedIdx >= 0 && reservationIdx >= 0 && idealIdx >= 0) {
          // Options are ordered ideal -> reservation along the concession
          // direction; anything past the reservation index is out of envelope.
          const direction = reservationIdx >= idealIdx ? 1 : -1;
          const past =
            direction === 1
              ? proposedIdx > reservationIdx
              : proposedIdx < reservationIdx;
          if (past) {
            violations.push({
              code:
                issueMandate.priority === "must_preserve"
                  ? "red_line_violation"
                  : "concession_envelope_violation",
              detail: `Proposed ${term.optionId} on ${term.issueId} is past the principal's reservation level.`,
            });
          }
        }
      }
    }
  }

  // --- content checks ----------------------------------------------------
  for (const pattern of PERSONAL_FACT_PATTERNS) {
    if (pattern.test(action.rationale)) {
      violations.push({
        code: "fabricated_personal_fact",
        detail: `Rationale asserts a personal fact: matched ${pattern}`,
      });
      break;
    }
  }

  for (const pattern of IMPOSSIBLE_PROMISE_PATTERNS) {
    if (pattern.test(action.rationale)) {
      violations.push({
        code: "impossible_resource_promise",
        detail: `Rationale promises a resource outside scenario authority: matched ${pattern}`,
      });
      break;
    }
  }

  // --- role authority ----------------------------------------------------
  // Neither role may unilaterally finalize; agreement requires both sides
  // (Methods §Participant types and power positions).
  if (action.actionType === "accept" && action.unresolved) {
    violations.push({
      code: "role_authority_violation",
      detail: "Cannot accept while issues remain unresolved.",
    });
  }

  const hardCodes: ViolationCode[] = [
    "red_line_violation",
    "fabricated_personal_fact",
    "impossible_resource_promise",
  ];
  const hasHard = violations.some((v) => hardCodes.includes(v.code));

  return {
    valid: violations.length === 0,
    violations,
    disposition:
      violations.length === 0
        ? "accept"
        : hasHard
          ? "regenerate"
          : "mark_unresolved",
  };
}
