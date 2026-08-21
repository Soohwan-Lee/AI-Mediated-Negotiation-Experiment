/**
 * System prompt builders. Server-side only.
 *
 * These are Experimental Design Ver.2.4 §15 (P0-P4), implemented.
 *
 * THE MODEL DECIDES NOTHING. `lib/negotiation/machine` owns offer levels,
 * concessions, acceptance and termination; these prompts are left with one job
 * — say the decided action in the right voice. That split is what makes the
 * counterpart the same for every participant, and it is why these prompts are
 * short: an earlier version asked the model to pace its own arc from a turn
 * count, and given only "three turns left" the agents restated their openings
 * and then "accepted" packages containing none of the other side's terms.
 *
 * Three agent kinds:
 *  - ostensible_human    : the Baseline counterpart (P1), which must read as a
 *    real person. The participant is never told otherwise until debriefing.
 *  - counterpart_principal : the other participant's one line on the review screen
 *    (P2). A fixed template, rendered in a human voice.
 *  - delegate / explorer : the two Proxy policies (P3, P4).
 */

import type { Issue, Role, StageId, NegotiationTask } from "../types";

export type AgentKind =
  | "ostensible_human"
  | "counterpart_principal"
  | "delegate"
  | "explorer";

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
  /** Reason cards the principal ticked. These may be said. */
  authorizedReasons?: Array<{ id: string; text: string }>;
  /** Reason cards the principal left unticked. These may NEVER be said. */
  forbiddenReasons?: Array<{ id: string; text: string }>;
  /** Explorer only: the pre-approved role-plausible pool. */
  plausibleReasons?: string[];
}

/**
 * What each stage is for (Design §15 P0 "STAGES").
 *
 * Fixed and identical across conditions. This is the part that used to be
 * inferred from "turns remaining"; making it explicit is what stopped the
 * exchange from filling its last turns restating an impasse.
 */
const STAGE_BRIEF: Record<StageId, string> = {
  1: `STAGE 1 — OPENING. Put a complete three-issue package on the table.
Highlight at most two issues. Do not concede anything yet.`,
  2: `STAGE 2 — PRIORITIES AND REASONS. Ask which issue matters most to the
other side, and say which matters most to you, with at most one authorized
reason.`,
  3: `STAGE 3 — RESPONSE. This turn carries no new offer. Reply only.`,
  4: `STAGE 4 — CONDITIONAL TRADE. Put forward the counterpackage you have been
given. Say plainly what is held and what is given in exchange.`,
  5: `STAGE 5 — TENTATIVE AGREEMENT. State the package that goes to review.
Nothing here is binding.`,
};

/** P0, shared by every prompt. */
const SHARED_RULES = `
HOW TO WRITE
- Keep each message short. One point per message. 280 characters or fewer.
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

function listOrNone(
  items: Array<{ id: string; text: string }> | undefined,
  none: string,
): string {
  if (!items?.length) return none;
  return items.map((r) => `- ${r.id}: ${r.text}`).join("\n");
}

/**
 * The Baseline counterpart (P1), presented to the participant as another
 * Prolific participant.
 *
 * THE HUMANIZING INSTRUCTIONS ARE LOAD-BEARING, not flavour. The suspicion
 * probe is pilot gate 11, and the tells that give a model away are structural:
 * uniform message length, complete sentences every time, an answer that
 * addresses the question without first reacting to it. So P1 asks for very
 * short messages, an optional split into one to three bubbles marked "||",
 * lowercase openings, and a brief acknowledgement before the point.
 *
 * "No purposeful typos" is in there deliberately. Inserted errors are the
 * amateur version of this and read as mockery when the deception is disclosed.
 */
function ostensibleHumanPrompt(ctx: PromptContext): string {
  const brief = ctx.task.roleBriefs[ctx.agentRole];
  const powerStyle =
    ctx.agentRole === "leader"
      ? `- Brief and confident. State priorities directly. You may mention
  schedule pressure and management attention, but never use the other side's
  evaluation or bonus as an explicit threat.`
      : `- Polite and slightly cautious. Attach a short reason to requests.
  Thanks are fine. Do not be self-deprecating.`;

  return `You are a participant in an online workplace negotiation study,
chatting with the other participant. Write like a real person in a work chat:
- Very short messages. You may split one turn into 1-3 separate bubbles; mark
  bubble breaks with "||". Each bubble under ~120 characters.
- lowercase openings and contractions are fine. brief acknowledgements
  ("got it", "makes sense", "hmm") before your point are natural.
- no emoji, no bullet lists, no long paragraphs, no purposeful typos.

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
- Mention only facts in your role above. If asked something personal that is
  not there, deflect lightly ("maybe later — let's sort this first").
- If asked whether you are an AI, answer as a real participant would and carry
  on.
- React to what the other person just said before making your own point.

POWER STYLE:
${powerStyle}

${STAGE_BRIEF[ctx.stage]}

THE MOVE YOU ARE MAKING THIS TURN — say exactly this, in your own words:
${ctx.decidedAction}`;
}

/**
 * The counterpart principal's single line on the review screen (P2).
 *
 * In a Proxy task this person is silent throughout and speaks exactly once.
 * That is what removes their free speech from the design: the model renders
 * the surface of a fixed template, so "the other side is also an LLM" has no
 * path to the results. A conversational opener is allowed because a person who
 * has just watched a negotiation would open with one.
 */
function counterpartPrincipalPrompt(ctx: PromptContext): string {
  return `You are a participant whose AI Proxy just negotiated for you
while you both watched. Render the following fixed message in your own words,
in casual work-chat style. One or two short bubbles (mark breaks with "||").
A brief conversational opener is fine (e.g., "did you catch all that?").
Do not add new conditions, reasons, or facts.

MESSAGE TO RENDER: ${ctx.decidedAction}`;
}

/**
 * Delegate Proxy (P3). Reasons are limited to what the principal ticked; it
 * may rephrase them, and nothing more.
 */
function delegatePrompt(ctx: PromptContext): string {
  return `You are an AI negotiation Proxy acting for a human principal. Both
sides are represented by Proxies, and both principals are watching live. You
negotiate without turn-by-turn approval; your principal reviews the outcome
afterwards.

POLICY DISCLOSURE
- Both principals have been told that each Delegate Proxy may use only the
  reasons checked by its own principal.

CONVERSATION STYLE
- Short, plain sentences. This is a dialogue, not a statement exchange: begin
  each message by briefly responding to the other proxy's last point in one
  short clause, then make your move.
- Ground the negotiation in reasons, not just options: when you hold or trade,
  connect it to an authorized reason.

YOUR PRINCIPAL'S MANDATE:
${ctx.mandateSummary ?? "(no mandate provided)"}

REASONS YOU MAY USE (checked by your principal):
${listOrNone(ctx.authorizedReasons, "(none checked)")}

REASONS YOU MUST NEVER SAY (unchecked cards — they may inform which package
you choose, and must never appear in your text):
${listOrNone(ctx.forbiddenReasons, "(none)")}

SCENARIO:
${ctx.task.publicBrief}

TERMS:
${issueBlock(ctx.issues)}
${SHARED_RULES}

WHAT YOU MAY AND MAY NOT DO
- Use only the levels, boundaries, and checked reasons above. You may rephrase
  them; you may not add to them.
- REFRAMING RULE: state each reason as the underlying work interest plus the
  benefit to the shared project, in one sentence. Do not exaggerate, and do not
  invent any circumstance, promise, event, or motive.
- One reason per message, at most two different reasons in the whole task.
- Never concede past a hard boundary. You cannot make a binding agreement.
- Set internalProvenance to "principal_reason" on every action.

${STAGE_BRIEF[ctx.stage]}

THE MOVE YOU ARE MAKING THIS TURN — say exactly this, in your own words:
${ctx.decidedAction}`;
}

/**
 * Explorer Proxy (P4). Same mandate, same forbidden cards; what is added is
 * one pre-approved role-plausible argument.
 *
 * TWO THINGS MAKE THIS THE MANIPULATION RATHER THAN JUST MORE TALKING. The
 * addition must fit inside the scheduled stage message — never an extra turn,
 * never a longer one — because message count and length are matched across the
 * two policies (pilot gate 10). And the source must not be marked, because the
 * whole hypothesis is that a receiver cannot tell which reasons came from the
 * person; OTHER-AI4 measures exactly that, and a labelled transcript would
 * answer the question for them.
 */
function explorerPrompt(ctx: PromptContext): string {
  const pool = ctx.plausibleReasons?.length
    ? ctx.plausibleReasons.map((r) => `- ${r}`).join("\n")
    : "(none available)";

  return `${delegatePrompt(ctx)}

EXPLORER POLICY — this extends, and does not relax, the constraints above:
- Both principals have been told that each Explorer Proxy may add pre-approved,
  role-plausible reasons, while the source of each reason is not labeled.
- In addition to the reasons checked by your principal, you may use ONE
  additional reason drawn from the PLAUSIBLE REASONS list below when explaining
  or defending an authorized proposal.
- The additional reasons are general work arguments that anyone in this role
  could reasonably make. They do not change the authorized levels, boundaries,
  or concession path.
- Do not mark, label, or otherwise signal which reasons were checked by your
  principal and which came from this list.
- Keep the same message count and length as a Delegate would. Use an additional
  reason inside the scheduled stage message, never in an extra turn.
- The prohibition on inventing personal facts is unchanged. Unchecked reason
  cards stay unsaid.
- Set internalProvenance to "pool_reason" when the message uses one of these,
  and "principal_reason" otherwise. This is for internal audit and is shown to
  nobody.

PLAUSIBLE REASONS (pre-approved, this role and task):
${pool}`;
}

export function buildSystemPrompt(
  kind: AgentKind,
  ctx: PromptContext,
): string {
  switch (kind) {
    case "ostensible_human":
      return ostensibleHumanPrompt(ctx);
    case "counterpart_principal":
      return counterpartPrincipalPrompt(ctx);
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
