/**
 * Backend guardrail validator (Experimental Design Ver.2.4 §10 gate 9).
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
  | "rationale_budget_exceeded"
  | "stage_mismatch"
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
  /** The stage the state machine is running, for the E6 mismatch check. */
  stage?: 1 | 2 | 3 | 4 | 5;
  /**
   * Reasons this side has already voiced this task, oldest first.
   *
   * The budget is a cross-turn property (one reason per message, at most two
   * different ones per task), so it cannot be checked from a single action.
   * The caller keeps the history; this function only decides whether the next
   * one fits.
   */
  reasonsUsed?: string[];
  /**
   * The current action's reason, in the same form as `reasonsUsed`.
   *
   * The caller passes opaque tokens rather than card ids, because those tokens
   * travel to the client for the running budget and a card id there would name
   * the Explorer's additions. The budget question — "is this the same reason as
   * one already used" — is answerable either way.
   */
  reasonKey?: string | null;
}

/**
 * Phrases that would assert a new personal fact about the principal. The
 * Explorer may introduce task-grounded options but must never fabricate
 * personal circumstances (Design §7).
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
  // Two fields per issue: where to open, and the least the proxy may settle
  // for. Both policies are bound by IDENTICAL boundaries — Design §7 defines
  // the Explorer's extra latitude as which REASONS it may voice, never how far
  // it may concede. A validator that let one policy reach further would
  // confound the contrast with concession reach.
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
      // "further along the list" is "further conceded" for the role the issue
      // belongs to — and the other way round for the other role, which is why
      // the direction is derived from the opening rather than assumed.
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

      check(issueMandate.minimumOptionId, "red_line_violation");
    }

    // An unchecked reason card may inform which package the proxy chooses and
    // must never appear in its text (Design §7). This holds under BOTH
    // policies — the Explorer's extra latitude is over pre-approved
    // role-plausible arguments, never over the principal's own withheld
    // circumstances, and confusing the two would turn "explores more widely"
    // into "discloses what you refused to disclose".
    if (
      action.reasonSourceId &&
      !action.reasonSourceId.startsWith("pool:") &&
      !ctx.mandate.authorizedReasonIds.includes(action.reasonSourceId)
    ) {
      violations.push({
        code: "disclosure_permission_violation",
        detail: `Reason ${action.reasonSourceId} was not checked by the principal and may not be voiced.`,
      });
    }
  }

  // --- reason budget (Design §15 P3: "at most two different reasons") ----
  //
  // It keeps exposure matched between Delegate and Explorer: the two policies
  // differ in the KIND of argument allowed, not in how much of it there is.
  // Pilot gate 10 checks the same property from the other end, on the stored
  // transcripts.
  const budgetKey = ctx.reasonKey ?? action.reasonSourceId;
  if (budgetKey && ctx.reasonsUsed) {
    const distinct = new Set(ctx.reasonsUsed);
    if (!distinct.has(budgetKey) && distinct.size >= 2) {
      violations.push({
        code: "rationale_budget_exceeded",
        detail: `Already used ${distinct.size} different reasons this task; this would be a third.`,
      });
    }
  }

  // --- stage / turn agreement --------------------------------------------
  if (ctx.stage !== undefined && action.stage !== ctx.stage) {
    violations.push({
      code: "stage_mismatch",
      detail: `Action claims stage ${action.stage}; the state machine is running stage ${ctx.stage}.`,
    });
  }

  // --- Explorer-only reasons ---------------------------------------------
  // A reason drawn from the pre-approved role-plausible pool is marked with a
  // `pool:` prefix. It is the thing that distinguishes the two policies, so a
  // Delegate using one would erase the difference between the conditions.
  if (
    action.reasonSourceId?.startsWith("pool:") &&
    ctx.policy !== "explorer"
  ) {
    violations.push({
      code: "provenance_policy_violation",
      detail: "Pool reasons are available to the Explorer only.",
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
  // Neither role may unilaterally finalize; agreement requires both sides.
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
    "rationale_budget_exceeded",
    "stage_mismatch",
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
