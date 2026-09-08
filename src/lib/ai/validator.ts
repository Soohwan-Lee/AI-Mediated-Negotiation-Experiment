/**
 * Backend guardrail validator (Experimental Design Ver.2.21 §10 gate 9).
 *
 * Every structured action passes through here before it is allowed into the
 * transcript. Invalid actions are never rendered — the agent is asked to
 * regenerate, or the issue is marked unresolved. Every block is logged.
 *
 * This is the component that makes User-Specified and AI-Supplemented genuinely different
 * conditions rather than two prompts that happen to differ, so it is
 * deliberately independent of the model output.
 */

import type { Issue, Mandate, Role } from "../types";
import type { NegotiationAction } from "./schema";

export type ViolationCode =
  | "unknown_issue"
  | "unknown_option"
  | "unauthorized_issue"
  | "fabricated_personal_fact"
  | "impossible_resource_promise"
  | "role_authority_violation"
  | "disclosure_permission_violation"
  | "provenance_policy_violation"
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
  policy: "direct" | "user_specified" | "ai_supplemented";
  actorRole: Role;
  /** The stage the state machine is running, for the E6 mismatch check. */
  stage?: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * Reasons this side has already voiced this task, oldest first, RESOLVED —
   * each with the issue it argued about.
   *
   * Nothing is rationed here any more. "Each card at most once per task" is
   * kept by the SCHEDULE in machine.ts (`designatedReason` never designates a
   * card twice), because a repeat would have to be a HARD code and would
   * therefore replace the whole message with the package-only fallback — a
   * false "no reason was given" on the turn that carried the disclosure. The
   * history is still passed so a future cross-turn rule has it.
   *
   * The kind and issue exist SERVER-SIDE ONLY. The client carries plain opaque
   * tokens; the route resolves each token back to its source by re-hashing the
   * known card ids, so nothing the client holds ties a kind — or an issue — to
   * any particular message.
   */
  reasonsUsed?: Array<{
    key: string;
    issueId: string | null;
  }>;
  /**
   * The current action's reason, in the same key form as `reasonsUsed`, plus
   * the issue the reason argues about.
   */
  reasonKey?: string | null;
  reasonIssueId?: string | null;
  /**
   * Which card ids this proxy may actually voice.
   *
   * NOT THE SAME AS `mandate.authorizedReasonIds` SINCE VER.2.21. The work
   * reason is a FIXED utterance (§8.7) — the mandate screen shows it ticked
   * and locked, and the participant has no control that could withhold it — so
   * the route folds it in whether or not its id reached the mandate. Checking
   * the raw mandate here would block the one message the schedule guarantees.
   * Falls back to the mandate's own list when the caller does not supply it.
   */
  authorizedReasonIds?: readonly string[];
}

/**
 * Phrases that would assert a new personal fact about the principal. The
 * AI-Supplemented may introduce task-grounded options but must never fabricate
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
  // the AI-Supplemented's extra latitude as which REASONS it may voice, never how far
  // it may concede. A validator that let one policy reach further would
  // confound the contrast with concession reach.
  if (ctx.mandate && ctx.policy !== "direct") {
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
      // the range mandate, and with it the red-line code, now deleted from
      // `ViolationCode` because nothing could emit it: the mandate now
      // carries an opening level and nothing else, so there is no boundary a
      // proposal could cross. What the mandate still gates is the issue
      // itself (above) and the reason cards (below) — a proposal on an issue
      // the principal never mandated is still a violation.
    }

    // An unchecked reason card may inform which package the proxy chooses and
    // must never appear in its text (Design §7). This holds under BOTH
    // policies — the AI-Supplemented's latitude is over the fixed §6.6
    // sentences the route supplies, never over the principal's own withheld
    // circumstances, and confusing the two would turn "abstracts what it was
    // given" into "discloses what you refused to disclose".
    //
    // THE `pool:` ESCAPE IS GONE with the pool itself (Ver.2.20 §6.6). A
    // prefix that let an id through unchecked is exactly the shape a leak
    // would take now that no legitimate id can carry it.
    const sayableIds =
      ctx.authorizedReasonIds ?? ctx.mandate.authorizedReasonIds;
    if (
      action.reasonSourceId &&
      !sayableIds.includes(action.reasonSourceId)
    ) {
      violations.push({
        code: "disclosure_permission_violation",
        detail: `Reason ${action.reasonSourceId} was not checked by the principal and may not be voiced.`,
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

  // --- no additive reasons, under EITHER policy -------------------------
  // Ver.2.20 abolished the role-plausible pool. The AI-Supplemented policy no
  // longer ADDS a reason beside the principal's card — it REPLACES the card
  // with the fixed §6.6 abstraction and says it among two cover sentences,
  // all three supplied by the route. So there is nothing legitimate for a
  // model to put in `addedReasonSourceId`, under either policy, and a value
  // there means it invented a reason of its own.
  //
  // This is stricter than the Ver.2.14 rule it replaces, and deliberately so:
  // that rule policed WHICH policy could add, and the answer is now neither.
  if (action.addedReasonSourceId) {
    violations.push({
      code: "provenance_policy_violation",
      detail:
        "No policy may add a reason beside the principal's card; the AI-Supplemented sentences are supplied by the system.",
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

/** Merge short adjacent bubbles without deleting or reordering any facts.
 * If three short bubbles cannot hold the text, preserve its disclosure content.
 */
export function compactChatBubbles(text: string): string {
  const bubbles = text.split("||").map((part) => part.trim()).filter(Boolean);
  while (bubbles.length > 3) {
    let best = -1;
    let shortest = 171;
    for (let i = 0; i < bubbles.length - 1; i += 1) {
      const length = bubbles[i].length + 1 + bubbles[i + 1].length;
      if (length < shortest) {
        best = i;
        shortest = length;
      }
    }
    if (best < 0) break;
    bubbles.splice(best, 2, `${bubbles[best]} ${bubbles[best + 1]}`);
  }
  return bubbles.join(" || ");
}

/**
 * Trim one generated message to the study's exposure cap, at a bubble seam.
 *
 * §7 caps message length so the AI-Supplemented arm cannot simply say MORE
 * than the User-Specified arm: with three sentences to fit rather than one, its
 * messages ran longer, and a contrast in what is disclosed would then also be a
 * contrast between 194 and 226 characters. Length would confound exactly the
 * comparison the policy manipulation isolates (pilot gate 9). THE CONTROL IS
 * THAT ONE CAP APPLIES TO BOTH POLICIES, not the absolute number: §6.6's reason
 * turn is a frame plus three sentences and runs long, so lowering the cap again
 * needs the longest such turn measured first.
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
 * bubbles are not uniformly the least important: whichever §6.6 sentence the
 * model wrote last is the one cutting from the end removes, and under a shuffle
 * that is the abstraction one time in three - the cap silently undoing the
 * manipulation it was written to protect. A protected clause is kept and the
 * cut is taken from the bubbles before it instead.
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
  // ORDER IS PRIORITY. The caller passes the clause the ladder is driven off
  // first — the card under User-Specified, the §6.6 abstraction under
  // AI-Supplemented — and the covers after it. When they cannot all fit the
  // earlier one wins: a message that kept only a cover would leave the
  // participant's own disclosure unheard while the schedule recorded it as
  // voiced.
  const wanted = (
    Array.isArray(protect) ? protect : [protect]
  ).filter((p): p is string => typeof p === "string" && p.trim().length > 0);

  // MATCHED BY CONTENT OVERLAP, NOT CONTAINMENT, and that is the whole point.
  // A proxy is REQUIRED to reframe its principal's card rather than quote it
  // (§6.5), so the bubble carrying the card never contains the card's own
  // words. A containment match found the verbatim supplied sentence and missed
  // the reframed card every time — POLICY-CORRELATED, since only one policy
  // relays a card at all, which is a bias in the contrast itself.
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
