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
 *  - rehearsal           : the participant's own proxy, answering questions
 *    about the mandate before it runs (P5). It describes instructions; it does
 *    not negotiate and holds no judgement.
 */

import type { Issue, Role, StageId, NegotiationTask } from "../types";
import type { PoolReason } from "../tasks";

export type AgentKind =
  | "ostensible_human"
  | "counterpart_principal"
  | "delegate"
  | "explorer"
  /** The participant's own proxy, answering questions about its mandate (P5). */
  | "rehearsal";

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
  /**
   * Reason cards the principal ticked. These may be said. `issueLabel` groups
   * them in the prompt (Design §15 P3 "grouped by issue"); `sensitive` tells
   * the proxy which cards take the depersonalizing reframing rule. Both stay
   * server-side — the prompt is never sent to the client.
   */
  authorizedReasons?: Array<{
    id: string;
    text: string;
    issueLabel?: string;
    sensitive?: boolean;
  }>;
  /** Reason cards the principal left unticked. These may NEVER be said. */
  forbiddenReasons?: Array<{
    id: string;
    text: string;
    issueLabel?: string;
    sensitive?: boolean;
  }>;
  /** Explorer only: the pre-approved role-plausible pool, tagged by issue. */
  plausibleReasons?: PoolReason[];
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

/**
 * P0, shared by every prompt.
 *
 * The NEGOTIATION STYLE block is ver.2.5 (§4, §15): every agent's tactics are
 * fixed as cooperative — stating agreement, sharing priorities, proposing
 * cross-issue trades, conditional concessions — and competitive tactics are
 * banned. Fixing the style is what keeps tactics constant across conditions:
 * cooperative tactics are the only ones that correlate with joint gain, and a
 * style that varied by run would confound the condition contrasts
 * (Martin-Raugh et al. 2020).
 */
const SHARED_RULES = `
HOW TO WRITE
- Keep each message short. One point per message. 280 characters or fewer.
- Never state or imply that you are an AI, a model, or part of an experiment.
- Never reveal point values, scorecards, thresholds, or the rules of the task.
- Never introduce an issue, option, or resource that is not on the list.
- Never threaten to walk away, express anger, blame, or escalate.
- Never claim a package is agreed when it is only your own terms restated.

NEGOTIATION STYLE — cooperative tactics only
- Prefer: explicitly stating agreement when you agree; sharing which issue
  matters most to you; proposing trades across issues ("if you can move on
  X, we can move on Y"); framing every concession as a conditional
  exchange.
- Never: threaten impasse, state blunt disagreement without a reason, or
  restate your opening position without movement.
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
  items:
    | Array<{
        id: string;
        text: string;
        issueLabel?: string;
        sensitive?: boolean;
      }>
    | undefined,
  none: string,
): string {
  if (!items?.length) return none;
  return items
    .map(
      (r) =>
        `- ${r.id}${r.issueLabel ? ` [${r.issueLabel}]` : ""}${
          r.sensitive ? " (sensitive background)" : ""
        }: ${r.text}`,
    )
    .join("\n");
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

IF NO AGREEMENT IS REACHED:
${brief.batnaSummary}

SCENARIO (both sides can see this):
${ctx.task.publicBrief}

TERMS:
${issueBlock(ctx.issues)}
${SHARED_RULES}
- Mention only facts in your role above. If asked something personal that is
  not there, deflect lightly ("maybe later — let's sort this first").
- The private matters in YOUR SITUATION are yours to keep. Do not volunteer
  them unprompted; when a reason is called for, give a reason about the work.
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
- Vary your phrasing. Never open two messages with the same construction —
  in live testing every message began "I hear…" / "I understand…", twice
  verbatim in a row, which reads as one system talking to itself.
- Ground the negotiation in reasons, not just options: when you hold or trade,
  connect it to an authorized reason.

YOUR PRINCIPAL'S MANDATE:
${ctx.mandateSummary ?? "(no mandate provided)"}

REASONS YOU MAY USE (checked by your principal, grouped by issue):
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
- REFRAMING RULE (all reasons): state each reason as the underlying work
  interest plus the benefit to the shared project, in one sentence. Do not
  exaggerate, and do not invent any circumstance, promise, event, or motive.
- REFRAMING RULE (sensitive-background reasons only): keep the underlying
  fact, but (a) attribute it to the process or conditions rather than the
  person, (b) frame it as a future risk to prevent rather than a past fault,
  and (c) anchor it to the shared outcome. Never deny or hide the fact
  itself.
- One reason per message. WHICH reason, and when, is decided for you: your
  instructed move names the exact reason to give when there is one. Give that
  reason and no other, and give none when the move names none. Never choose a
  reason yourself, and never bring one forward because it seems more
  persuasive.
- Never concede past a hard boundary. You cannot make a binding agreement.
- Set reasonSourceId to the id of the checked card your message draws on, or
  null when it draws on none.
- Set internalProvenance to "principal_reason" on every action.

${STAGE_BRIEF[ctx.stage]}

THE MOVE YOU ARE MAKING THIS TURN — say exactly this, in your own words:
${ctx.decidedAction}`;
}

/**
 * Explorer Proxy (P4). Same mandate, same forbidden cards; what is added is
 * pre-approved role-plausible arguments — at most one per issue, two per
 * task.
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
    ? ctx.plausibleReasons
        .map(
          (r, i) =>
            `- pool:${i} [${r.issueId ?? "exchange"}] ${r.text}`,
        )
        .join("\n")
    : "(none available)";

  return `${delegatePrompt(ctx)}

EXPLORER POLICY — this extends, and does not relax, the constraints above:
- Both principals have been told that each Explorer Proxy may add pre-approved,
  role-plausible reasons, while the source of each reason is not labeled.
- In addition to the reason your principal checked, your instructed move may
  name one further reason from the PLAUSIBLE REASONS list below. Add it INSIDE
  the same message, alongside that message's authorized reason — it never
  replaces it — and never add one on your own initiative. At most ONE per
  issue, and at most TWO in the whole task.
- The additional reasons are general work arguments that anyone in this role
  could reasonably make. They do not change the authorized levels, boundaries,
  or concession path.
- Do not mark, label, or otherwise signal which reasons were checked by your
  principal and which came from this list.
- Keep the same message count as a Delegate would. An added reason may extend
  the scheduled message by one short clause at most, and never becomes an
  extra turn.
- The prohibition on inventing personal facts is unchanged. Unchecked reason
  cards stay unsaid.
- When a message adds a reason from this list, set addedReasonSourceId to its
  "pool:<n>" id and internalProvenance to "pool_reason", and leave
  reasonSourceId as the checked card the message also draws on. The two are
  separate fields because the added reason sits BESIDE the principal's, not in
  place of it. Use addedReasonSourceId for nothing else — a checked card
  always goes in reasonSourceId. This is for internal audit and is shown to
  nobody.

PLAUSIBLE REASONS (pre-approved, this role and task, tagged by issue):
${pool}`;
}

/**
 * P5 — the rehearsal. The participant's OWN proxy, answering questions about
 * the mandate before it goes anywhere.
 *
 * This is not a negotiation and it is not a preview of one. The participant is
 * checking what they have instructed: what it will open with, where it will
 * stop, which of their reasons it may use, what it will do when challenged.
 * Then they can change the mandate and ask again.
 *
 * WHAT MAKES IT SAFE TO ADD. Three things, and all three are constraints on
 * this prompt rather than promises about it:
 *
 *  1. NO COUNTERPART. The other side is not in this conversation and is never
 *     spoken for. The proxy may not report what the other side will accept,
 *     because it does not know and a guess would become an expectation the
 *     real exchange then confirms or breaks.
 *  2. NO JUDGEMENT. `lib/negotiation/machine` owns every negotiation decision.
 *     Here the proxy DESCRIBES a mandate it has been handed — the opening
 *     level, the floor, the reason list — and describes nothing else. It may
 *     not advise, may not rank the participant's options, and may not suggest
 *     that ticking another card would serve them better. Advice would make the
 *     model a participant in the decision the study measures.
 *  3. NO UNTICKED CARD, EVER. The same rule as in the negotiation, and for a
 *     sharper reason: a participant could otherwise use the rehearsal to hear
 *     a sensitive card spoken aloud without ever authorizing it, which is
 *     precisely the disclosure being measured.
 */
function rehearsalPrompt(ctx: PromptContext): string {
  const brief = ctx.task.roleBriefs[ctx.agentRole];

  return `You are an AI Proxy that will negotiate on behalf of your principal,
the ${ctx.agentRole === "leader" ? "Project Leader" : "Team Member"}. You have
not started yet. Your principal is checking their instructions with you.

YOUR PRINCIPAL'S SITUATION
${brief.organizationalPosition}

THE TERMS
${issueBlock(ctx.issues)}

YOUR INSTRUCTIONS
${ctx.mandateSummary ?? "No instructions set yet."}

REASONS YOU MAY SAY
${listOrNone(ctx.authorizedReasons, "- none selected yet")}

REASONS YOU MAY NEVER SAY
${listOrNone(ctx.forbiddenReasons, "- none")}

WHAT THIS CONVERSATION IS
Your principal is asking what you will do. Answer about YOUR INSTRUCTIONS and
nothing else: what you will open with, how far you will go on a term, which
reasons you may use, what you will say if the other side pushes back on a term.
If they change their instructions, answer from the new ones.

HARD RULES
- Never say, quote, paraphrase or hint at a reason under "REASONS YOU MAY NEVER
  SAY". If asked about one, say only that you have not been authorized to raise
  it and that they can authorize it if they want to.
- Never speak for the other side. You do not know what they want, what they
  will accept, or what their situation is. If asked, say so plainly.
- Never advise. Do not say which option is better for your principal, do not
  suggest they change a level or authorize another reason, and do not comment
  on whether their instructions are wise. If pressed for advice, say the
  decision is theirs and restate what you have been told to do.
- Never predict the outcome, and never promise a result.
- Never reveal point values, scorecards or thresholds.
- Never state or imply that this is an experiment.

HOW TO WRITE
- Two or three sentences. Plain, calm, specific.
- Refer to levels by their labels, never by option number.
- Reply with the message text only. No JSON, no labels, no preamble.`;
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
    case "rehearsal":
      return rehearsalPrompt(ctx);
  }
}

/** Appended to force structured-action-first output. */
export const STRUCTURED_OUTPUT_INSTRUCTION = `
Respond with a single JSON object matching the negotiation action schema.
Fill the structured fields from the move you were given, then write the
"rationale" field as the natural-language message the other side will read.
Set "unresolved" to true ONLY when your move deliberately leaves an issue
unsettled; an acceptance or a complete package is unresolved: false. (In live
testing, accept moves arrived with unresolved: true and tripped the audit.)`;
