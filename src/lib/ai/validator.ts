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
  | "disclosure_permission_violation"
  | "provenance_policy_violation"
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
  /** Absent for the Baseline-condition counterpart. */
  mandate?: Mandate;
  policy: "baseline" | "delegate" | "explorer";
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
  //
  // ver.1.8 replaces "entrusted / not entrusted" with a per-issue envelope:
  // where to open, how far the proxy may concede, and a line it may not
  // cross. Both policies are bound by the same boundaries — the Explorer's
  // extra latitude is which combinations inside them it may try, never how
  // far out it may go (Methods §Delegate–Explorer matching).
  if (ctx.mandate && ctx.policy !== "baseline") {
    const mandateByIssue = new Map(
      ctx.mandate.issues.map((m) => [m.issueId, m]),
    );

    for (const term of action.proposedTerms) {
      const issueMandate = mandateByIssue.get(term.issueId);
      const issue = issueById.get(term.issueId);
      if (!issue) continue;

      if (!issueMandate) {
        violations.push({
          code: "unauthorized_issue",
          detail: `Issue ${term.issueId} carries no mandate.`,
        });
        continue;
      }

      // Options are listed best-first for the side the issue favours, so
      // "further along the list" is "further conceded". A hard boundary is a
      // red line; an acceptable floor is the softer envelope.
      const order = issue.options.map((o) => o.id);
      const proposedIdx = order.indexOf(term.optionId);

      const check = (
        limitId: string | null,
        code: ViolationCode,
      ) => {
        if (!limitId) return;
        const limitIdx = order.indexOf(limitId);
        const openIdx = issueMandate.preferredOptionId
          ? order.indexOf(issueMandate.preferredOptionId)
          : -1;
        if (proposedIdx < 0 || limitIdx < 0 || openIdx < 0) return;
        const direction = limitIdx >= openIdx ? 1 : -1;
        const past =
          direction === 1 ? proposedIdx > limitIdx : proposedIdx < limitIdx;
        if (past) {
          violations.push({
            code,
            detail: `Proposed ${term.optionId} on ${term.issueId} is past the principal's ${
              code === "red_line_violation" ? "hard boundary" : "acceptable floor"
            }.`,
          });
        }
      };

      check(issueMandate.hardBoundaryOptionId, "red_line_violation");
      check(
        issueMandate.acceptableFloorOptionId,
        "concession_envelope_violation",
      );
    }

    // Reason permissions. A rationale sourced from a card the participant
    // marked private may not be spoken at all, whatever the policy — this is
    // the one place where the Explorer's extra latitude does NOT apply,
    // because the latitude is over options and role-generic framings, never
    // over the participant's own withheld circumstances.
    if (
      action.reasonSourceId &&
      ctx.mandate.reasonPermissions[action.reasonSourceId] === "private"
    ) {
      violations.push({
        code: "disclosure_permission_violation",
        detail: `Reason ${action.reasonSourceId} was marked private and may not be voiced.`,
      });
    }
  }

  // --- Explorer-only framing --------------------------------------------
  // `common practice` argues from what projects of this kind usually do. It
  // is the frame that carries the source ambiguity, so a Delegate using it
  // would erase the difference between the two conditions.
  if (action.rationaleFrame === "common_practice" && ctx.policy !== "explorer") {
    violations.push({
      code: "provenance_policy_violation",
      detail: "The common-practice frame is available to the Explorer only.",
    });
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
    "disclosure_permission_violation",
    "provenance_policy_violation",
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
