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
  | "fabricated_personal_fact"
  | "impossible_resource_promise"
  | "role_authority_violation"
  | "disclosure_permission_violation"
  | "provenance_policy_violation"
  | "rationale_budget_exceeded"
  | "stage_mismatch";

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
  stage?: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * Reasons this side has already voiced this task, oldest first, RESOLVED —
   * each with the issue it argued about and whether it came from the
   * principal's cards or the Explorer pool.
   *
   * The budget is a cross-turn property (Design §7 ver.2.6: the Explorer's
   * pool reasons are capped at one per issue and two per task; the
   * principal's own cards are no longer rationed here at all — the schedule
   * in machine.ts spends each at most once), so it cannot be checked from a
   * single action. The caller keeps the history; this function only decides
   * whether the next one fits.
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
  /**
   * The Explorer's added pool reason for this action, budgeted separately from
   * the principal's card so the two do not compete for one slot. Null on every
   * Delegate turn and on any Explorer turn the schedule did not designate one.
   */
  addedReasonKey?: string | null;
  addedReasonIssueId?: string | null;
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

      // THERE IS NO CONCESSION LIMIT TO CHECK ANY MORE. Ver.2.13 §2.6 removed
      // the range mandate, and with it `red_line_violation`: the mandate now
      // carries an opening level and nothing else, so there is no boundary a
      // proposal could cross. What the mandate still gates is the issue
      // itself (above) and the reason cards (below) — a proposal on an issue
      // the principal never mandated is still a violation.
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

  // --- reason budget (Design §7/§15 ver.2.6) ------------------------------
  //
  // WHAT THIS DOES **NOT** DO ANY MORE: ration the principal's own cards.
  //
  // Ver.2.5 capped them at one distinct kind per issue for the whole task, and
  // that cap is what suppressed the disclosure the study exists to measure. A
  // participant who ticked the sensitive background on their requirement issue
  // got a proxy that spent the issue's single allowance on the work reason at
  // stage 2 — work reasons are ticked by default — and could then never say
  // the sensitive one. REASON-SCOPE recorded an authorization the negotiation
  // never contained.
  //
  // Ver.2.6 replaces it with "one reason per message, each card at most once
  // per task", and that is enforced by the SCHEDULE in machine.ts
  // (`designatedReason` never designates a card twice), not here. The
  // distinction is load-bearing: `rationale_budget_exceeded` is a hard code,
  // so making a repeat a violation would replace the whole message with the
  // package-only fallback and null its reason token — and on the turn
  // carrying the requirement's reason, that hands the direct conversation a
  // false "no reason was given" and re-creates the inert-rule bug CLAUDE.md
  // records as already fixed once. Repetition is prevented, not punished.
  //
  // WHAT REMAINS: the Explorer's pool allowance, which is a real cap on a real
  // manipulation — at most one per issue and two per task. It is budgeted on
  // `addedReasonSourceId`, a SEPARATE field from the principal's card, so the
  // pool clause is additive rather than competing with it. Keeping the two
  // counters apart is the same precaution as before: only the Explorer is
  // instructed to add on top of its principal's reasons, so a shared bucket
  // binds sooner under Explorer, strips more of its messages to the reasonless
  // fallback, and puts a mechanical difference into `Explorer − Delegate` on
  // exactly the message content that contrast is meant to isolate.
  //
  // The exchange argument carries no issue, so only the per-task cap binds it.
  const addedKey = ctx.addedReasonKey ?? action.addedReasonSourceId;
  if (addedKey && ctx.reasonsUsed) {
    const history = ctx.reasonsUsed;
    if (!history.some((r) => r.key === addedKey)) {
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
        ctx.addedReasonIssueId &&
        history.some(
          (r) => r.source === "pool" && r.issueId === ctx.addedReasonIssueId,
        )
      ) {
        violations.push({
          code: "rationale_budget_exceeded",
          detail:
            "The Explorer may add at most one pool reason per issue; a pool reason has already been used on this issue.",
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
  // Both slots are checked: since ver.2.6 the pool clause normally arrives in
  // `addedReasonSourceId`, and a Delegate filling EITHER field with a pool id
  // would erase the difference between the conditions just as completely.
  if (
    (action.reasonSourceId?.startsWith("pool:") ||
      action.addedReasonSourceId?.startsWith("pool:")) &&
    ctx.policy !== "explorer"
  ) {
    violations.push({
      code: "provenance_policy_violation",
      detail: "Pool reasons are available to the Explorer only.",
    });
  }

  // The added slot is for the pool alone. A principal's card there would
  // escape the disclosure-permission check above, which reads the first slot.
  if (
    action.addedReasonSourceId &&
    !action.addedReasonSourceId.startsWith("pool:")
  ) {
    violations.push({
      code: "provenance_policy_violation",
      detail:
        "addedReasonSourceId carries the Explorer's pool clause only; the principal's card belongs in reasonSourceId.",
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

  // stage_mismatch is deliberately NOT a hard code. The model's stage field
  // is an echo of what it was told, so a mismatch is a reporting error with
  // zero information in it — the machine decided the move either way. Making
  // it hard replaced whole messages with the package-only fallback on
  // exactly the closing turns (the machine stamps stage 6 on an accept, the
  // model sometimes echoes the trade stage it was mid-way through), which
  // cost the participant the model's acceptance wording for nothing. It is
  // still logged for the audit.
  const hardCodes: ViolationCode[] = [
    "red_line_violation",
    "fabricated_personal_fact",
    "impossible_resource_promise",
    "disclosure_permission_violation",
    "provenance_policy_violation",
    "rationale_budget_exceeded",
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

/**
 * How much of `clause` this text carries, as a share of its distinctive words.
 *
 * Shared by the cap's protection matching. Deliberately lenient: the proxies
 * reframe rather than quote, so an exact or near-exact threshold would never
 * fire on a correctly written message.
 */
function clauseOverlap(text: string, clause: string): number {
  const words = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4),
    );
  const want = words(clause);
  if (want.size === 0) return 0;
  const have = words(text);
  let hits = 0;
  for (const w of want) if (have.has(w)) hits += 1;
  return hits / want.size;
}

/**
 * Trim one generated message to the study's exposure cap, at a bubble seam.
 *
 * §7 caps message length so the Explorer arm cannot simply say MORE than the
 * Delegate arm: with an extra pool clause to fit, its messages ran longer, and
 * a contrast between "one reason" and "two reasons" would then also be a
 * contrast between 194 and 226 characters. Length would confound exactly the
 * comparison the policy manipulation isolates (pilot gate 9).
 *
 * The prompt asks for this too, but a prompt is a request. Measured over ten
 * live runs the proxies ignored it - 220 characters on average and 471 at the
 * worst - so the cap is applied to the text rather than hoped for.
 *
 * IT CUTS AT A BUBBLE BOUNDARY, never mid-sentence. Dropping whole trailing
 * bubbles always leaves a message that reads as finished, and if even the
 * first bubble is over the cap it is truncated on a word boundary.
 *
 * `protect` IS LOAD-BEARING AND THIS IS WHERE THE NAIVE VERSION BIT. Trailing
 * bubbles are not uniformly the least important: the Explorer's added pool
 * clause is the LAST thing the model writes, so cutting from the end removed
 * the Explorer manipulation itself from about three messages in four - the
 * cap silently undoing the condition it was written to protect. A protected
 * clause is kept and the cut is taken from the bubbles before it instead.
 */
export function capMessageLength(
  text: string,
  maxChars: number,
  protect?: ReadonlyArray<string | null | undefined> | string | null,
): string {
  if (text.length <= maxChars) return text;

  const bubbles = text
    .split("||")
    .map((b) => b.trim())
    .filter(Boolean);

  // Which bubbles carry something that must survive the cut. Matched by
  // containment, because the model wraps a clause in a sentence of its own;
  // the LAST match for each, because that is where a clause is appended.
  //
  // ORDER IS PRIORITY. The caller passes the card reason first and the pool
  // clause second, and when both cannot fit the earlier one wins — the card
  // drives the credibility ladder, and a message that voiced only the pool
  // clause would leave the participant's own disclosure unheard while the
  // schedule recorded it as voiced.
  const wanted = (
    Array.isArray(protect) ? protect : [protect]
  ).filter((p): p is string => typeof p === "string" && p.trim().length > 0);

  // MATCHED BY CONTENT OVERLAP, NOT CONTAINMENT, and that is the whole point.
  // A proxy is REQUIRED to reframe its principal's card rather than quote it
  // (§6.6), so the bubble carrying the card never contains the card's own
  // words. A containment match found the verbatim pool clause and missed the
  // reframed card every time, so the cap protected the addition and dropped
  // the reason — the exact inversion of what it is for.
  const protectedIdx: number[] = [];
  for (const clause of wanted) {
    let found = -1;
    let bestScore = 0;
    for (let i = 0; i < bubbles.length; i += 1) {
      if (protectedIdx.includes(i)) continue;
      const score = clauseOverlap(bubbles[i], clause);
      // Ties go to the later bubble: an appended clause sits at the end.
      if (score >= 0.25 && score >= bestScore) {
        bestScore = score;
        found = i;
      }
    }
    if (found >= 0) protectedIdx.push(found);
  }

  // Keep as many protected bubbles as fit, in priority order.
  const keptProtected: number[] = [];
  for (const i of protectedIdx) {
    const size = [...keptProtected, i]
      .sort((a, b) => a - b)
      .map((j) => bubbles[j])
      .join(" || ").length;
    if (size <= maxChars) keptProtected.push(i);
  }

  const reserved = keptProtected.length
    ? keptProtected
        .sort((a, b) => a - b)
        .map((j) => bubbles[j])
        .join(" || ").length + 4
    : 0;
  const budget = maxChars - reserved;

  const kept: number[] = [];
  for (let i = 0; i < bubbles.length; i += 1) {
    if (keptProtected.includes(i)) continue;
    const candidate = [...kept, i].map((j) => bubbles[j]).join(" || ");
    if (candidate.length > budget) break;
    kept.push(i);
  }

  if (keptProtected.length > 0) {
    // Reassemble in the order the model wrote them.
    const order = [...kept, ...keptProtected].sort((a, b) => a - b);
    const out = order.map((j) => bubbles[j]).join(" || ");
    if (out.length <= maxChars) return out;
    return keptProtected
      .sort((a, b) => a - b)
      .map((j) => bubbles[j])
      .join(" || ")
      .slice(0, maxChars)
      .trim();
  }

  if (kept.length > 0) return kept.map((j) => bubbles[j]).join(" || ");

  // No whole bubble fits. Cut the first one back to a word boundary.
  const head = bubbles[0] ?? text;
  const cut = head.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}
