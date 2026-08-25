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
   * Reasons this side has already voiced this task, oldest first, RESOLVED —
   * each with the issue it argued about and whether it came from the
   * principal's cards or the Explorer pool.
   *
   * The budget is a cross-turn property (Design §7 ver.2.5: at most one
   * principal reason kind per issue; the Explorer's pool reasons are a
   * separate allowance of one per issue and two per task), so it cannot be
   * checked from a single action. The caller keeps the history; this function
   * only decides whether the next one fits.
   *
   * The kind and issue exist SERVER-SIDE ONLY. The client still carries plain
   * opaque tokens; the route resolves each token back to its source by
   * re-hashing the known card and pool ids, so nothing the client holds ties
   * a kind — or an issue — to any particular message.
   */
  reasonsUsed?: Array<{
    key: string;
    issueId: string | null;
    source: "principal" | "pool";
  }>;
  /**
   * The current action's reason, in the same key form as `reasonsUsed`, plus
   * the issue the reason argues about (null for the pool's exchange argument,
   * which links terms rather than arguing for one).
   */
  reasonKey?: string | null;
  reasonIssueId?: string | null;
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

  // --- reason budget (Design §7/§15 ver.2.5: per-issue caps) --------------
  //
  // TWO SEPARATE COUNTERS, NOT ONE. The principal's cards and the Explorer's
  // pool are budgeted independently, exactly as in ver.2.4 — merging them was
  // tried once and re-created the documented `Explorer − Delegate` stripping
  // bias, because only the Explorer is instructed to ADD on top of its
  // principal's reasons, so a shared bucket hit its cap sooner under Explorer
  // and more of its messages fell to the reasonless fallback. What ver.2.5
  // changes is the SHAPE of each budget:
  //
  //  - principal cards: at most ONE distinct reason kind per issue across the
  //    task (was: two distinct kinds per task). Repeating an already-used
  //    reason is fine.
  //  - pool (Explorer only): at most one per issue and two per task, additive
  //    on top of the principal's cards. The exchange argument carries no
  //    issue, so only the per-task cap binds it.
  const budgetKey = ctx.reasonKey ?? action.reasonSourceId;
  const isPool = action.reasonSourceId?.startsWith("pool:") ?? false;
  if (budgetKey && ctx.reasonsUsed) {
    const history = ctx.reasonsUsed;
    const alreadyUsed = history.some((r) => r.key === budgetKey);
    if (!alreadyUsed && isPool) {
      const poolDistinct = new Set(
        history.filter((r) => r.source === "pool").map((r) => r.key),
      );
      if (poolDistinct.size >= 2) {
        violations.push({
          code: "rationale_budget_exceeded",
          detail:
            "The Explorer may add at most two pool reasons per task; this would be a third.",
        });
      } else if (
        ctx.reasonIssueId &&
        history.some(
          (r) => r.source === "pool" && r.issueId === ctx.reasonIssueId,
        )
      ) {
        violations.push({
          code: "rationale_budget_exceeded",
          detail:
            "The Explorer may add at most one pool reason per issue; a pool reason has already been used on this issue.",
        });
      }
    } else if (!alreadyUsed && !isPool && ctx.reasonIssueId) {
      const principalOnIssue = new Set(
        history
          .filter(
            (r) =>
              r.source === "principal" && r.issueId === ctx.reasonIssueId,
          )
          .map((r) => r.key),
      );
      if (principalOnIssue.size >= 1) {
        violations.push({
          code: "rationale_budget_exceeded",
          detail:
            "At most one of the principal's reasons may be used per issue; a different one has already been used on this issue.",
        });
      }
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
