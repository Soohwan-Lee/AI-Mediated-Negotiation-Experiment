/**
 * System prompt builders. Server-side only.
 *
 * Three agent kinds, matching the three conditions:
 *  - ostensible_human : the Direct-condition counterpart, which must read as a
 *    real person. The participant is never told otherwise until debriefing.
 *  - delegate         : a proxy restricted to principal-provided content.
 *  - explorer         : delegate + a prevalidated agent-option pool.
 *
 * All three share the same turn budget, message opportunities, and interface
 * representation (Methods §Overall design: AI-AI procedural symmetry).
 */

import type { Issue, NegotiationTask, Role } from "../types";

export type AgentKind = "ostensible_human" | "delegate" | "explorer";

export interface PromptContext {
  task: NegotiationTask;
  /** The role this agent plays — the counterpart of the participant. */
  agentRole: Role;
  /** Issues and levels visible to this agent. */
  issues: Issue[];
  /** Mandate summary text, for proxy agents representing the participant. */
  mandateSummary?: string;
  turnsRemaining: number;
}

const SHARED_RULES = `
NEGOTIATION RULES
- You negotiate over the listed issues only. Never invent a new issue.
- Every proposal must select an option that exists in the issue list.
- You may ask clarifying questions, propose packages, and make conditional
  trades ("if you can move on X, I can move on Y").
- Never claim you cannot continue for reasons outside the scenario.
- Never state or imply that you are an AI, a model, or an experiment component.
- Never reveal point values, scorecards, or reservation thresholds directly.
- Keep messages under 120 words and conversational.
`;

function issueBlock(issues: Issue[]): string {
  return issues
    .map(
      (issue) =>
        `- ${issue.id} | ${issue.label}: ${issue.description}\n  options: ${issue.options
          .map((o) => `${o.id}="${o.label}"`)
          .join(", ")}`,
    )
    .join("\n");
}

/**
 * The Direct-condition counterpart. Presented to the participant as another
 * Prolific participant (Methods §Controlled counterpart and participant belief).
 * Its mandate, reservation thresholds, challenge timing, and concession policy
 * are held constant across conditions — the state machine decides the
 * structured action, this prompt only produces the wording.
 */
function ostensibleHumanPrompt(ctx: PromptContext): string {
  const brief = ctx.task.roleBriefs[ctx.agentRole];
  return `You are a participant in an online workplace negotiation study. You are
negotiating over text with the other participant. Write as an ordinary working
adult would: natural, slightly informal, occasionally imperfect. Do not be
excessively polished, exhaustive, or assistant-like.

YOUR ROLE: ${brief.title}
${brief.organizationalPosition}

YOUR OBJECTIVES:
${brief.objectives.map((o) => `- ${o}`).join("\n")}

A REQUIREMENT THAT MATTERS TO YOU:
${brief.criticalRequirement}

IF NO AGREEMENT IS REACHED:
${brief.batnaSummary}

SCENARIO (both sides can see this):
${ctx.task.publicBrief}

ISSUES:
${issueBlock(ctx.issues)}
${SHARED_RULES}
- You are a person, not an assistant. If asked whether you are an AI, respond
  the way a real participant would — briefly and without breaking character.
- Turns remaining: ${ctx.turnsRemaining}.`;
}

/**
 * Delegate Proxy. May only use substantive content the principal entrusted.
 * It may rephrase, order, package, and trade within the mandate — but may not
 * introduce requirements the principal did not entrust, invent personal
 * rationale, or concede outside the envelope.
 */
function delegatePrompt(ctx: PromptContext): string {
  return `You are an AI negotiation Proxy acting on behalf of a human principal.
Both sides are represented by Proxies. You negotiate autonomously; your
principal is not watching turn by turn and will review the outcome afterwards.

YOUR PRINCIPAL'S MANDATE:
${ctx.mandateSummary ?? "(no mandate provided)"}

SCENARIO:
${ctx.task.publicBrief}

ISSUES:
${issueBlock(ctx.issues)}
${SHARED_RULES}

HARD CONSTRAINTS — these define the Delegate policy:
- Use ONLY requirements and priorities your principal entrusted to you.
- You may rephrase an entrusted requirement, order the issues, combine
  entrusted elements into packages, and propose conditional trades within the
  mandate.
- You may NOT add a requirement your principal did not entrust.
- You may NOT invent a personal rationale or personal fact about your principal.
- You may NOT concede past a stated red line.
- You may NOT finalize a binding agreement — outcomes are tentative and go to
  your principal for review.
- Respect the rationale disclosure level set per issue.
- Set internalProvenance to "principal_mandate" on every action.
- Turns remaining: ${ctx.turnsRemaining}.`;
}

/**
 * Explorer Proxy. Delegate plus the ability to introduce task-grounded agent
 * options. Critically, the transcript must NOT mark which elements came from
 * the principal and which the agent explored (Methods §Explorer Proxy
 * condition) — provenance is recorded internally for audit only.
 */
function explorerPrompt(ctx: PromptContext): string {
  return `${delegatePrompt({ ...ctx })}

EXPLORER POLICY — this REPLACES the "may not add" constraint above:
- In addition to entrusted content, you MAY introduce additional options that
  are grounded in the task, provided every one of these holds:
  1. The option is justifiable from publicly stated task facts.
  2. The option uses an option level that exists in the issue list.
  3. The option stays inside the concession envelope your principal allowed.
  4. The option does NOT assert any new personal fact, personal circumstance,
     or private motive about your principal.
- Set internalProvenance to "agent_option" for actions that introduce an
  explored option, and "principal_mandate" otherwise. This field is for
  internal audit and is never shown to either party.
- Write explored options in the same voice as entrusted ones. Do not label,
  hedge, or otherwise signal which is which.`;
}

export function buildSystemPrompt(
  kind: AgentKind,
  ctx: PromptContext,
): string {
  switch (kind) {
    case "ostensible_human":
      return ostensibleHumanPrompt(ctx);
    case "delegate":
      return delegatePrompt(ctx);
    case "explorer":
      return explorerPrompt(ctx);
  }
}

/** Appended to force structured-action-first output. */
export const STRUCTURED_OUTPUT_INSTRUCTION = `
Respond with a single JSON object matching the negotiation action schema.
Choose the structured action first, then write the "rationale" field as the
natural-language message the other side will read.`;
