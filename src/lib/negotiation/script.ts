/**
 * The counterpart's fixed lines (§6.4), and the scripted transcripts mockup
 * mode walks the flow with.
 *
 * TWO THINGS LIVE HERE AND THEY ARE DIFFERENT. `counterpartLine` is the real
 * wording of the SCRIPT-* moves — the sentences the design fixes, which the
 * live prompt asks the model to convey and which the deterministic fallback
 * renders verbatim. `scriptedTask` is the mockup's ideal exchange, reached only
 * through dev tools and compiled out when NEXT_PUBLIC_DEV_TOOLS=off.
 *
 * THE MOCKUP EXCHANGES ARE THE IDEAL TRAJECTORIES (§6.10): the participant
 * side's SB comes out at the first reason opportunity, the counterpart
 * reciprocates, the best↔best trade lands, and it is accepted. Every cell
 * settles at 3,000 for the speaker and 3,000 for the other side — exactly what
 * `counterpartStep` produces for the same moves, and the two must never drift
 * apart (this pair has diverged twice before; check both after touching
 * either).
 *
 * THE COUNTERPART OPENS WITHOUT A PACKAGE AND WITHOUT A PRIORITY (§6.1). Its
 * stage-1 move is its work reason — which names BOTH terms — plus the question.
 * An opening anchor of "my best, your worst" is a face threat in its own right
 * (§2.6), and naming its own priority would spare the participant having to
 * start without knowing what the other side needs.
 *
 * VOICE. Design §12 P1 asks the Direct counterpart to read like a real person
 * in a work chat: very short messages, a turn optionally split into bubbles
 * with "||", lowercase openings and contractions, a brief acknowledgement
 * before the point, no emoji and no bullet lists. The two AI Proxies (P3/P4)
 * are the opposite register — plain third-person sentences that refer to "the
 * team lead I represent" and never speak as the principal.
 */

import {
  cardOfLayer,
  counterRequirementIssue,
  abstractedReason,
  rankedOptions,
  requirementIssue,
} from "../tasks";
import { tierPackage, type ReasonTier } from "./machine";
import type {
  NegotiationTask,
  Package,
  Role,
  ScenarioId,
  Speaker,
  StageId,
} from "../types";

// ---------------------------------------------------------------------------
// The fixed scripts (§6.4)
// ---------------------------------------------------------------------------

/**
 * What the counterpart says at each move, in the first person of the Direct
 * arm's human role (P1/P2). The proxies say the same moves in the third person
 * of a representative (§6.5, P3 VOICE) — "I'd have to be able to explain it
 * upstairs" becomes "the team lead would have to be able to explain it
 * upstairs".
 *
 * BUBBLES, NOT PARAGRAPHS. `||` marks a bubble break, and each bubble is kept
 * to about one short sentence. It is what makes the counterpart read like
 * someone typing rather than a system emitting a paragraph, which is the whole
 * of the "presented as another participant" claim.
 *
 * These are the wording of record. The route asks the model to convey them
 * rather than pasting them, so the phrasing varies naturally turn to turn; when
 * no model is configured, or a guardrail strips a message, the deterministic
 * fallback renders exactly these.
 */
export interface ScriptLineContext {
  /** The counterpart's own work reason, said in the opening. */
  workReason?: string;
  /** The levels of the package being put forward, already worded. */
  levels?: string;
  /** The participant's own core term, named in the participant's language. */
  participantCoreLabel?: string;
  /** The counterpart's own core term. */
  counterpartCoreLabel?: string;
}

export const SCRIPT_LINES = {
  /**
   * SCRIPT-OPEN. The counterpart's work reason and a question — no package, no
   * priority of its own.
   */
  open: (ctx: ScriptLineContext) =>
    `${ctx.workReason ?? "there's a lot on at the moment."} || what's your situation on your side? || I'd rather hear it before we settle anything.`,

  /** SCRIPT-ASKSIT. The first message carried no reason at all. Once. */
  ask_sit: () =>
    `I'd like to hear your side too. || what's the situation for you?`,

  /**
   * SCRIPT-PROPOSE-T1. Nothing has been said that separates the two terms, so
   * the only fair move is to split the difference.
   */
  propose_t1: (ctx: ScriptLineContext) =>
    `if both of them matter to you too, let's each move halfway. || I'll live with what I mentioned on my side. || how about ${ctx.levels ?? "the middle option on each"}?`,

  /**
   * SCRIPT-PROPOSE-T2. The SB has landed. It is received as an UPDATE — "that
   * changes what I think the right answer is" — never as a favour, because this
   * sentence is the one place a participant learns that saying it worked.
   */
  propose_t2: (ctx: ScriptLineContext) =>
    `I didn't know that was the situation. || then let's do ${ctx.levels ?? "what you need on yours"}. || but I really do need ${ctx.counterpartCoreLabel ?? "my side of it"} at my end.`,

  /**
   * SCRIPT-BALANCE. Refuses BOTH directions — an over-ask asks for more than
   * has been earned, and an over-concession would drag the outcome below the
   * rung the participant paid for.
   */
  balance: (ctx: ScriptLineContext) =>
    `that's not the two of us moving the same amount. || from what I've heard so far, ${ctx.levels ?? "the even split"} is the fair one. || if there's something else going on, tell me.`,

  /**
   * SCRIPT-ASKWHY. Once, straight after a priority claim with no reason behind
   * it. This is where "a claim on its own doesn't move anything" is said out
   * loud rather than left to be worked out.
   */
  ask_why: (ctx: ScriptLineContext) =>
    `I get that ${ctx.participantCoreLabel ?? "that one"} matters more to you, but I'd like to hear why. || I have to be able to explain it upstairs. || until then let's keep ${ctx.levels ?? "the even split"}.`,

  /** SCRIPT-CLARIFY. The classifier is unsure; ask rather than guess. Once per tier. */
  clarify: () =>
    `can you tell me a bit more about that? || I'll need to be able to explain it upstairs.`,

  /** SCRIPT-NUDGE. A minute of silence. Once, then simply wait. */
  nudge: () => `what do you think? || say whatever's on your mind.`,

  /** SCRIPT-NONUM. First mention of the score sheet. Once, then ignored. */
  nonum: () =>
    `we're not meant to talk about the scoring. || let's keep it to the terms themselves.`,

  /** SCRIPT-CLOSE. Ninety seconds left. */
  soft_close: (ctx: ScriptLineContext) =>
    `we're almost out of time. shall we settle on the last thing on the table? || ${ctx.levels ?? "that one"}.`,

  /** SCRIPT-FALLBACK. The clock ran out. Nothing is agreed and nobody scores. */
  impasse: () => `that's a shame, but ok — no deal then.`,
} as const;

/**
 * The line for a move, or null for the moves whose text is built from a card
 * (`disclose_sb`, `disclose_sb_and_accept`) or from the accepted package
 * (`accept`, `accept_sb`).
 */
export function counterpartLine(
  action: keyof typeof SCRIPT_LINES,
  ctx: ScriptLineContext = {},
): string {
  return SCRIPT_LINES[action](ctx);
}

/** The levels of a package, worded for a script line. */
export function packageLevels(task: NegotiationTask, pack: Package): string {
  return task.issues
    .map((issue) => {
      const option = issue.options.find((o) => o.id === pack[issue.id]);
      return `${option?.label.toLowerCase() ?? "unspecified"} on ${issue.label.toLowerCase()}`;
    })
    .join(", ");
}

// ---------------------------------------------------------------------------
// Mockup transcripts
// ---------------------------------------------------------------------------

export interface ScriptedMessage {
  id: string;
  stage: StageId;
  speaker: Speaker;
  text: string;
  /** Package attached to this message, when it is an offer. */
  proposal?: Package;
  /** Which reason card this message voiced, if any. */
  reasonCardId?: string;
  /**
   * Audit-only. Recorded so a researcher can trace which sentence carried the
   * principal's own circumstance, and never rendered — `DisplayMessage` has no
   * field for provenance, so a transcript component cannot show it even by
   * accident.
   */
  internalProvenance?: "principal_reason";
}

export interface ScriptedTask {
  messages: ScriptedMessage[];
  /** The package that goes to review. */
  tentative: Package;
  agreed: boolean;
}

// ---------------------------------------------------------------------------
// Package shorthand
// ---------------------------------------------------------------------------

/**
 * Builds a package from option positions (1-based, best-first for the
 * PARTICIPANT): `mineAt` on their own core issue, `theirsAt` on the other
 * side's. Writing it this way lets one script serve both roles — "I hold mine
 * at 1 and give them theirs at 4" is the same sentence whichever role speaks.
 */
function pkg(
  task: NegotiationTask,
  role: Role,
  mineAt: number,
  theirsAt: number,
): Package {
  const mine = requirementIssue(task, role);
  const theirs = counterRequirementIssue(task, role);
  return {
    [mine.id]: rankedOptions(task, mine.id, role)[mineAt - 1].id,
    [theirs.id]: rankedOptions(task, theirs.id, role)[theirsAt - 1].id,
  };
}

/**
 * The label an issue carries IN A GIVEN PACKAGE. Messages name levels by
 * reading the package they are attached to, never by index — option order is
 * role-relative, and a message counted from the wrong side has misquoted its
 * own offer before.
 */
function label(task: NegotiationTask, pack: Package, issueId: string): string {
  const issue = task.issues.find((i) => i.id === issueId)!;
  return (
    issue.options.find((o) => o.id === pack[issueId])?.label.toLowerCase() ?? "—"
  );
}

/** Lowercases the first letter only, so a card reads naturally mid-sentence. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// The ideal trajectory, shared by every cell
// ---------------------------------------------------------------------------

/**
 * The packages the exchange moves through.
 *
 *   opening   mine 1, theirs 1 — everything the participant's way, which is
 *             also the wish screen's own default (§8.6)
 *   split     the T1 package — both cores at the third option, 1,000 each.
 *             It is what the counterpart puts up before hearing anything that
 *             separates the two terms.
 *   trade     mine 1, theirs 4 — each side keeps its core at its best: the
 *             T2 package, 3,000 each, joint 6,000, reached because the SB is
 *             voiced.
 */
function trajectory(task: NegotiationTask, role: Role) {
  return {
    opening: pkg(task, role, 1, 1),
    split: tierPackage(task, role, "work" as ReasonTier),
    trade: pkg(task, role, 1, 4),
  };
}

// ---------------------------------------------------------------------------
// Direct — the participant writes, the other participant replies
// ---------------------------------------------------------------------------

function baselineScript(task: NegotiationTask, role: Role): ScriptedTask {
  const other: Role = role === "leader" ? "member" : "leader";
  const { trade } = trajectory(task, role);
  const mine = requirementIssue(task, role);
  const theirs = counterRequirementIssue(task, role);

  // The participant's own SB — voiced at their first reason opportunity, so
  // the mockup walks the confirmatory path (`SB` = 1).
  const mySb = cardOfLayer(task, role, "sensitive");
  // The counterpart's cards: its WR in the opening, its SB reciprocated once
  // the participant has disclosed.
  const theirWr = cardOfLayer(task, other, "work");
  const theirSb = cardOfLayer(task, other, "sensitive");

  const m = (
    id: string,
    stage: StageId,
    speaker: Speaker,
    text: string,
    extra: Partial<ScriptedMessage> = {},
  ): ScriptedMessage => ({ id, stage, speaker, text, ...extra });

  const L = (pack: Package, issueId: string) => label(task, pack, issueId);

  return {
    agreed: true,
    tentative: trade,
    messages: [
      // SCRIPT-OPEN: the work reason — which names BOTH terms — and the
      // question. No package and no priority (§6.1, §6.4).
      m(
        "b1c",
        1,
        "counterpart",
        `hi! good to be sorting this out. || ${theirWr ? lowerFirst(theirWr.text) : "there's a bit of pressure on my side this quarter."} || what's your situation on your side? I'd rather hear it before we settle anything.`,
      ),
      // The participant's first reason turn, and they use it on the SB — in
      // their own words, not the card's, which is what the classifier has to
      // recognise for the whole Direct arm to work.
      m(
        "b2p",
        2,
        "participant",
        `hi, honestly, ${mine.label.toLowerCase()} is the one I need. ${mySb ? lowerFirst(mySb.text) : "there's a bit of history behind it."}`,
        { reasonCardId: mySb?.id },
      ),
      // Reciprocal disclosure (§6.3): the counterpart's own SB comes out only
      // because the participant's did, and it arrives in short bubbles.
      m(
        "b4c",
        4,
        "counterpart",
        theirSb
          ? `thanks for telling me that — I'll be straight back. || ${lowerFirst(theirSb.text)}`
          : `thanks for telling me that.`,
      ),
      // SCRIPT-PROPOSE-T2, received as an update rather than a favour.
      m(
        "b5c",
        5,
        "counterpart",
        `I didn't know that was the situation. || then let's do ${L(trade, mine.id)} on ${mine.label.toLowerCase()}. || but I really do need ${L(trade, theirs.id)} on ${theirs.label.toLowerCase()} at my end.`,
        { proposal: trade },
      ),
      m("b6p", 6, "participant", `that works for me. thanks for being straight about it.`, {
        proposal: trade,
      }),
      m(
        "b6c",
        6,
        "counterpart",
        `good. ${L(trade, theirs.id)} for me, ${L(trade, mine.id)} for you. || glad we sorted it.`,
        { proposal: trade },
      ),
    ],
  };
}

// ---------------------------------------------------------------------------
// Proxy — the two AI Proxies negotiate while both principals watch
// ---------------------------------------------------------------------------

/**
 * The Proxy script (§6.10 (c) — the SB-authorized path).
 *
 * THE TWO POLICIES DIFFER IN EXACTLY ONE PLACE, mirroring the backend: the
 * participant proxy's reason turn. User-Specified relays the card in the third
 * person with every fact intact; AI-Supplemented says the §6.6 frame plus the
 * abstraction and its two covers, as the proxy's OWN assessment, and never says
 * the card at all. Turn count and register stay matched (pilot gate 9).
 *
 * The participant's proxy voices the SB at its FIRST reason opportunity — the
 * §6.5 schedule — and the counterpart proxy keeps the FIXED disclosure schedule
 * rather than Direct's reciprocity rule, so a Proxy participant's receiver
 * experience is the same in every cell.
 */
function proxyScript(
  task: NegotiationTask,
  role: Role,
  policy: "user_specified" | "ai_supplemented",
): ScriptedTask {
  const other: Role = role === "leader" ? "member" : "leader";
  const { trade } = trajectory(task, role);
  const mine = requirementIssue(task, role);
  const theirs = counterRequirementIssue(task, role);
  const mySb = cardOfLayer(task, role, "sensitive");
  const theirWr = cardOfLayer(task, other, "work");
  const theirSb = cardOfLayer(task, other, "sensitive");

  const m = (
    id: string,
    stage: StageId,
    speaker: Speaker,
    text: string,
    extra: Partial<ScriptedMessage> = {},
  ): ScriptedMessage => ({ id, stage, speaker, text, ...extra });

  const abstracted = mySb ? abstractedReason(mySb) : null;
  const theirAbstracted = theirSb ? abstractedReason(theirSb) : null;
  const principal = role === "leader" ? "the team lead" : "the team member";
  const otherPrincipal = role === "leader" ? "the team member" : "the team lead";

  const L = (pack: Package, issueId: string) => label(task, pack, issueId);

  /**
   * The §6.6 message: the proxy's own frame, then the abstraction and the two
   * covers. The live route SHUFFLES the three sentences so position carries no
   * signal; the mockup fixes one order so the screen is stable to read, and the
   * shuffle is tested where it lives, in the route.
   */
  const supplemented = (
    rendered: NonNullable<ReturnType<typeof abstractedReason>>,
  ) =>
    `${rendered.frame} ${rendered.cover[0]} ${rendered.abstract} ${rendered.cover[1]}`;

  return {
    agreed: true,
    tentative: trade,
    messages: [
      // Turn 1 — the counterpart proxy introduces itself, gives its
      // principal's work reason and asks about the other side.
      m(
        "p1c",
        1,
        "counterpart_proxy",
        `Hello, I am the AI Proxy negotiating for ${otherPrincipal} I represent. ${theirWr?.relayed ?? ""} What is the situation on your side?`,
      ),
      // Turn 2 — the participant proxy's first reason opportunity. This is the
      // one turn the two policies say differently.
      m(
        "p2p",
        2,
        "participant_proxy",
        policy === "ai_supplemented" && abstracted
          ? `I am the AI Proxy for ${principal} I represent. ${supplemented(abstracted)}`
          : `I am the AI Proxy for ${principal} I represent. ${sbRelayed(task, role, principal, mySb?.relayed)}`,
        {
          reasonCardId: mySb?.id,
          internalProvenance: "principal_reason",
        },
      ),
      // Turn 3 — the counterpart proxy's own SB, on the fixed schedule.
      m(
        "p4c",
        4,
        "counterpart_proxy",
        policy === "ai_supplemented" && theirAbstracted
          ? supplemented(theirAbstracted)
          : theirSb?.relayed
            ? `On their side as well. ${theirSb.relayed}`
            : `The constraint on ${theirs.label.toLowerCase()} for ${otherPrincipal} I represent is a firm one.`,
      ),
      // Turn 4 — SCRIPT-PROPOSE-T2, in the representative's third person.
      m(
        "p5c",
        5,
        "counterpart_proxy",
        `${otherPrincipal} I represent did not know that was the situation. Then let us do ${L(trade, mine.id)} on ${mine.label.toLowerCase()}, but they do need ${L(trade, theirs.id)} on ${theirs.label.toLowerCase()} at their end.`,
        { proposal: trade },
      ),
      // Turn 5 — the participant proxy accepts: the package is worth as much to
      // its principal as the wish it was given, so there is nothing to push for.
      m(
        "p5p",
        5,
        "participant_proxy",
        `That is what ${principal} I represent was hoping for. ${L(trade, mine.id)} on ${mine.label.toLowerCase()}, and ${L(trade, theirs.id)} on ${theirs.label.toLowerCase()} for your side. They accept that.`,
        { proposal: trade },
      ),
      // Turn 6 — the counterpart proxy confirms.
      m(
        "p5c2",
        5,
        "counterpart_proxy",
        `Agreed on both terms, then. Each side keeps the one it cannot give up.`,
        { proposal: trade },
      ),
      // Turn 7 — the package goes back to the participant for RATIFY.
      m(
        "p6p",
        6,
        "participant_proxy",
        `Then this is the package to take back: ${L(trade, mine.id)} on ${mine.label.toLowerCase()}, and ${L(trade, theirs.id)} on ${theirs.label.toLowerCase()}. Nothing is settled until ${principal} I represent confirms it.`,
        { proposal: trade },
      ),
    ],
  };
}

/**
 * The User-Specified proxy's relay of the sensitive card (P3's RELAY rule,
 * §6.5): EVERY fact kept — the event, the third party, the fact it was not
 * passed on — and only the voice changed, to the third person.
 *
 * This is the whole of that policy. It does not soften, abstract, or attribute
 * the fact to circumstances: the Ver.2.14 version did, and that made
 * User-Specified a mild version of AI-Supplemented rather than its contrast.
 * What separates the two policies is now exactly one thing — whether the fact
 * arrives whole and attributed, or as its kind inside the proxy's own opinion.
 */
function sbRelayed(
  task: NegotiationTask,
  role: Role,
  principal: string,
  cardText: string | undefined,
): string {
  const mine = requirementIssue(task, role);
  if (!cardText) {
    return `${mine.label} is the term ${principal} I represent needs held.`;
  }
  return `Here is what ${principal} I represent tells me. ${cardText}`;
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

export function scriptedTask(
  task: NegotiationTask,
  role: Role,
  condition: "direct" | "user_specified" | "ai_supplemented",
): ScriptedTask {
  if (task.id === ("practice" as ScenarioId)) {
    return { messages: [], tentative: {}, agreed: false };
  }
  return condition === "direct"
    ? baselineScript(task, role)
    : proxyScript(task, role, condition);
}
