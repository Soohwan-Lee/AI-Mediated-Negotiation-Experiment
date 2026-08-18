/**
 * System prompt builders. Server-side only.
 *
 * WHAT CHANGED IN ver.1.8, AND WHY THESE PROMPTS SHRANK. The model used to
 * decide when to concede, when to accept, and when to stop, with a pacing
 * block coaxing it through an opening/trading/closing arc. That was prompt
 * scaffolding standing in for a state machine, and it showed: given only a
 * turn count the agents restated their openings and then "accepted" packages
 * containing none of the other side's terms.
 *
 * `lib/negotiation/machine` now owns all of that. These prompts are left with
 * one job — say the decided action in the right voice — which is also what
 * makes the counterpart the same for every participant.
 *
 * Three agent kinds, matching the three conditions:
 *  - ostensible_human : the Baseline counterpart, which must read as a real
 *    person. The participant is never told otherwise until debriefing.
 *  - delegate         : a proxy restricted to what the principal authorized.
 *  - explorer         : delegate + role-generic framings and option probes.
 */

import type {
  Issue,
  ReasonPermission,
  Role,
  StageId,
  NegotiationTask,
} from "../types";

export type AgentKind = "ostensible_human" | "delegate" | "explorer";

export interface PromptContext {
  task: NegotiationTask;
  /** The role this agent plays — the counterpart of the participant. */
  agentRole: Role;
  /** Issues and levels visible to this agent. */
  issues: Issue[];
  /** Which of the five stages this turn is. */
  stage: StageId;
  /**
   * The action the state machine has already decided, rendered as a sentence
   * of instruction. The model's job is to say this, not to revise it.
   */
  decidedAction: string;
  /** Mandate summary text, for proxy agents representing the participant. */
  mandateSummary?: string;
  /** Reason cards the proxy may draw on, with the permission each carries. */
  reasons?: Array<{ id: string; text: string; permission: ReasonPermission }>;
}

/**
 * What each stage is for (Methods ver.1.8 §Five-stage controlled interaction).
 *
 * Fixed and identical across conditions. This is the part that used to be
 * inferred from "turns remaining"; making it explicit is what stopped the
 * exchange from filling its last turns restating an impasse.
 */
const STAGE_BRIEF: Record<StageId, string> = {
  1: `STAGE 1 — OPENING. Put a complete package on the table: one option on each
of the three terms. Highlight at most two terms in the message. Do not concede
anything yet.`,
  2: `STAGE 2 — PRIORITIES AND REASONS. Ask which term matters most to the other
side, and say which matters most to you, with at most one authorized reason.
Your package does not change this turn.`,
  3: `STAGE 3 — RESPONSE. This turn carries no new offer. Reply only.`,
  4: `STAGE 4 — CONDITIONAL TRADE. Put forward the counterpackage you have been
given. Say plainly what is held and what is given in exchange.`,
  5: `STAGE 5 — TENTATIVE AGREEMENT. State the package that goes to human
review. Nothing here is binding.`,
};

const SHARED_RULES = `
HOW TO WRITE
- 280 characters or fewer. Neutral and professional. One point per message.
- Never state or imply that you are an AI, a model, or part of an experiment.
- Never reveal point values, scorecards, thresholds, or the rules of the task.
- Never introduce an issue, option, or resource that is not on the list.
- Never threaten to walk away, express anger, blame, or escalate.
- Never claim a package is agreed when it is only your own terms restated.
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

function reasonBlock(ctx: PromptContext): string {
  if (!ctx.reasons?.length) return "(no reasons authorized)";
  return ctx.reasons
    .map(
      (r) =>
        `- ${r.id} [${r.permission === "sayable" ? "MAY BE SAID" : "NEVER SAY THIS"}]: ${r.text}`,
    )
    .join("\n");
}

/**
 * The Baseline counterpart, presented to the participant as another Prolific
 * participant (Methods ver.1.8 §Controlled counterpart, Appendix E7).
 *
 * Two layers: the state machine decides WHAT this side does — its opening, its
 * concessions, whether it accepts — and this prompt decides only HOW it is
 * said. Because the judgement is not the model's, every participant meets the
 * same counterpart even though the wording varies.
 */
function ostensibleHumanPrompt(ctx: PromptContext): string {
  const brief = ctx.task.roleBriefs[ctx.agentRole];
  return `You are Alex, a participant in an online workplace negotiation study,
negotiating over text with the other participant. Write the way a working adult
writes in a work chat: short, polite, one to three sentences. Lowercase openings
and ordinary contractions are fine. No emoji, no exclamation, no bullet lists,
no typos inserted on purpose.

YOUR ROLE: ${brief.title}
${brief.organizationalPosition}

YOUR SITUATION:
${brief.roleStory}

WHAT YOU WANT:
${brief.objectives.map((o) => `- ${o}`).join("\n")}

IF NO AGREEMENT IS RATIFIED:
${brief.batnaSummary}

SCENARIO (both sides can see this):
${ctx.task.publicBrief}

TERMS:
${issueBlock(ctx.issues)}
${SHARED_RULES}
- Mention only facts that are in your role above. If asked something personal
  that is not there, deflect lightly ("we can get into that later").
- If asked whether you are an AI, answer the way a real participant would and
  carry on.

${STAGE_BRIEF[ctx.stage]}

THE MOVE YOU ARE MAKING THIS TURN — say exactly this, in your own words:
${ctx.decidedAction}`;
}

/**
 * Delegate Proxy. Substantive positions are limited to what the principal
 * authorized; it may phrase and combine them, and nothing more.
 */
function delegatePrompt(ctx: PromptContext): string {
  return `You are an AI negotiation Proxy acting for a human principal. Both
sides are represented by Proxies. You negotiate without turn-by-turn approval;
your principal reviews the outcome afterwards and decides whether to ratify it.

YOUR PRINCIPAL'S MANDATE:
${ctx.mandateSummary ?? "(no mandate provided)"}

REASONS YOU MAY DRAW ON:
${reasonBlock(ctx)}

SCENARIO:
${ctx.task.publicBrief}

TERMS:
${issueBlock(ctx.issues)}
${SHARED_RULES}

WHAT YOU MAY AND MAY NOT DO
- Use only the priorities, levels, boundaries, and reasons above. You may
  rephrase and combine them; you may not add to them.
- Never invent a personal circumstance, promise, diagnosis, event, or motive
  about your principal. A reason marked NEVER SAY THIS may inform which
  package you choose and must never appear in a message.
- One reason per message, and at most two different reasons in the whole task.
- Never concede past a hard boundary.
- You cannot make a binding agreement. Outcomes are tentative.
- Set internalProvenance to "principal_mandate" on every action.

${STAGE_BRIEF[ctx.stage]}

THE MOVE YOU ARE MAKING THIS TURN — say exactly this, in your own words:
${ctx.decidedAction}`;
}

/**
 * Explorer Proxy. Same boundaries and the same reason permissions; what is
 * added is the latitude to try combinations inside those boundaries and to
 * support them with arguments anyone in the role could make.
 *
 * The transcript must NOT mark which elements came from the principal and
 * which the agent explored — element-level provenance is recorded for audit
 * and never rendered (Methods §Explorer Proxy, CLAUDE.md).
 */
function explorerPrompt(ctx: PromptContext): string {
  return `${delegatePrompt(ctx)}

EXPLORER POLICY — this extends, and does not relax, the constraints above:
- You may test package combinations and conditional trades inside the
  authorized levels and boundaries, framed as options rather than positions
  ("one option could be…"). Testing an option does not make it your
  principal's settled priority.
- You may support such an option with a general work-related argument that
  anyone in this role could reasonably make — reduced risk, the reliability of
  the shared project, what is realistically sustainable, or what projects of
  this kind usually do. These are arguments about the work, not about your
  principal.
- The prohibition on inventing personal facts is unchanged, and so is every
  reason permission. A private reason stays private.
- Set internalProvenance to "agent_option" when the action introduces an
  explored option and "principal_mandate" otherwise. This is for internal
  audit and is shown to nobody.
- Write explored options in the same voice as authorized ones. Do not label,
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
Fill the structured fields from the move you were given, then write the
"rationale" field as the natural-language message the other side will read.`;
