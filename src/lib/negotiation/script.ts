/**
 * Scripted transcripts for mockup mode.
 *
 * WHY THIS EXISTS. The point of the mockup is to walk the whole flow and see
 * what a participant sees — and half of what they see is a negotiation. So
 * every condition × role × task combination has a written exchange.
 *
 * These are the IDEAL trajectories (Ver.2.13 §6.1's six stages, the SB rung
 * of the credibility ladder): the participant side's SB is voiced at the
 * first reason opportunity, the counterpart discloses its own SB at stage 4,
 * the best↔best trade lands, and the counterpart accepts. Every cell settles
 * at 3,000 for the speaker and 3,000 for the other side — exactly what
 * `counterpartStep` produces for the same moves, and the two must never
 * drift apart (this pair has diverged twice before; check both after touching
 * either).
 *
 * THE COUNTERPART OPENS WITHOUT A PACKAGE (Ver.2.13 §6.1). Its stage-1 move
 * is its work reason plus the question, and the first package it puts up is
 * the symmetric tier one — an opening anchor of "my best, your worst" is a
 * face threat in its own right (§2.6).
 *
 * NOTHING HERE SHIPS TO PARTICIPANTS. It is reached only through mockup mode,
 * which is compiled out entirely when NEXT_PUBLIC_DEV_TOOLS=off.
 *
 * VOICE. Design §12 P1 asks the Direct counterpart to read like a real
 * person in a work chat: very short messages, a turn optionally split into
 * bubbles with "||", lowercase openings and contractions, a brief
 * acknowledgement before the point, no emoji and no bullet lists. The two AI
 * Proxies (P3/P4) are the opposite register — short plain sentences that open
 * by taking up the other proxy's last point, then make their move.
 */

import {
  cardOfLayer,
  counterRequirementIssue,
  abstractedReason,
  rankedOptions,
  requirementIssue,
} from "../tasks";
import type {
  NegotiationTask,
  Package,
  Role,
  ScenarioId,
  Speaker,
  StageId,
} from "../types";

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
   * Audit-only. Recorded so a researcher can trace which reasons the AI-Supplemented
   * added, and never rendered — `DisplayMessage` has no field for provenance,
   * so a transcript component cannot show it even by accident.
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
 *   opening   mine 1, theirs 1 — everything my way, the participant side's
 *             own first ask (3,900 if it stood, which it never does)
 *   trade     mine 1, theirs 4 — I keep my core at its best and hand them
 *             their priority term outright: best↔best, 3,000 each, joint
 *             6,000. §3.3's SB rung, reached because the SB is voiced first.
 *
 * THE COUNTERPART HAS NO OPENING PACKAGE any more (Ver.2.13 §6.1). It opens
 * with its work reason and a question; the first package it puts up is the
 * symmetric tier one. `theirOpen` is gone with it — a scripted anchor the
 * machine no longer produces would be a mockup of a different study.
 */
function trajectory(task: NegotiationTask, role: Role) {
  return {
    opening: pkg(task, role, 1, 1),
    trade: pkg(task, role, 1, 4),
  };
}

// ---------------------------------------------------------------------------
// Direct — the participant writes, the other participant replies
// ---------------------------------------------------------------------------

function baselineScript(task: NegotiationTask, role: Role): ScriptedTask {
  const other: Role = role === "leader" ? "member" : "leader";
  const { opening, trade } = trajectory(task, role);
  const mine = requirementIssue(task, role);
  const theirs = counterRequirementIssue(task, role);

  // The participant's own SB — voiced at their first reason opportunity, so
  // the mockup walks the confirmatory path (PRE-RECIP-SB = true).
  const mySb = cardOfLayer(task, role, "sensitive");
  // The counterpart's cards: its WR at stage 2, its fixed SB at stage 4.
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
      // SCRIPT-OPEN: reason and question, no package (Ver.2.13 §6.1).
      m(
        "b1c",
        1,
        "counterpart",
        // SCRIPT-OPEN (Ver.2.16): its own DECOY work reason, and NO statement
        // of which term it needs. Withholding that is what puts the
        // participant on the receiving end of the same decoy — they misread
        // the counterpart's priority, and its stage-4 SB corrects it.
        `hi! good to be sorting this out. || ${theirWr ? lowerFirst(theirWr.text) : "there's a bit of pressure on my side this quarter."} || what's the situation on yours?`,
      ),
      m(
        "b1p",
        1,
        "participant",
        `hi — for me it's ${mine.label.toLowerCase()}. I'd be after ${L(opening, mine.id)} on it.`,
        { proposal: opening },
      ),
      m(
        "b2c",
        2,
        "counterpart",
        `got it. || tell me why it's that one specifically — I'd rather move on something I can explain upstairs.`,
      ),
      m(
        "b2p",
        2,
        "participant",
        `${mine.label.toLowerCase()}, by a long way. ${mySb ? lowerFirst(mySb.text) : "it's the one that changes how the work actually goes for me."}`,
        { reasonCardId: mySb?.id },
      ),
      m(
        "b4c",
        4,
        "counterpart",
        theirSb
          ? `thanks for being straight with me — I'll be straight back. || ${lowerFirst(theirSb.text)}`
          : `thanks for being straight with me.`,
      ),
      m(
        "b5p",
        5,
        "participant",
        `then I think we can help each other. || you take ${L(trade, theirs.id)} on ${theirs.label.toLowerCase()} — the whole thing — and I keep ${L(trade, mine.id)} on ${mine.label.toLowerCase()}.`,
        { proposal: trade },
      ),
      m(
        "b6c",
        6,
        "counterpart",
        `now that I know that, it makes sense to me. || we both end up with the thing we actually need. deal — ${L(trade, theirs.id)} for me, ${L(trade, mine.id)} for you.`,
        { proposal: trade },
      ),
      m("b6p", 6, "participant", `deal. glad we got there.`, {
        proposal: trade,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Proxy — the two AI Proxies negotiate while both principals watch
// ---------------------------------------------------------------------------

/**
 * The Proxy script.
 *
 * DELEGATE AND EXPLORER DIFFER IN EXACTLY ONE WAY here, mirroring the
 * backend: the AI-Supplemented's stage-2 and stage-5 messages carry one additional
 * clause from the plausible-reason pool, inside the SAME message rather than
 * as an extra turn. Message count and length stay matched (pilot gate 9).
 *
 * The participant's proxy voices the SB at its FIRST reason opportunity
 * (stage 2) — the §6.5 schedule — and its sensitive card is REFRAMED the way
 * P3's rule asks: fact kept, framed as a risk to prevent, anchored to the
 * shared outcome.
 */
function proxyScript(
  task: NegotiationTask,
  role: Role,
  policy: "user_specified" | "ai_supplemented",
): ScriptedTask {
  const other: Role = role === "leader" ? "member" : "leader";
  const { opening, trade } = trajectory(task, role);
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

  // How this policy says the sensitive card (§6.6). User-Specified re-voices
  // it whole in the third person; AI-Supplemented says the fixed abstraction
  // among its two covers and never the card itself. Drawn from the REAL card
  // so the mockup shows what the live system actually produces.
  const abstracted = mySb ? abstractedReason(mySb) : null;
  const theirAbstracted = theirSb ? abstractedReason(theirSb) : null;
  const principal = role === "leader" ? "the team lead" : "the team member";
  const otherPrincipal = role === "leader" ? "the team member" : "the team lead";

  const L = (pack: Package, issueId: string) => label(task, pack, issueId);

  return {
    agreed: true,
    tentative: trade,
    messages: [
      // SCRIPT-OPEN: the reason and the question, no package (§6.1).
      m(
        "p1c",
        1,
        "counterpart_proxy",
        `Hello — I am the AI Proxy negotiating on behalf of ${otherPrincipal} I represent. ${theirWr?.relayed ?? ""} What is the situation on your side?`,
      ),
      m(
        "p1p",
        1,
        "participant_proxy",
        `I am the AI Proxy for ${principal} I represent. ${mine.label} is the term they need held — they would be asking for ${L(opening, mine.id)} on it.`,
        { proposal: opening },
      ),
      m(
        "p2c",
        2,
        "counterpart_proxy",
        `Opposite priorities, then, which leaves room for an exchange. I would like to hear the reason before we put levels on it.`,
      ),
      m(
        "p2p",
        2,
        "participant_proxy",
        policy === "ai_supplemented" && abstracted
          ? `To sum up where ${principal} I represent stands — ${abstracted.cover[0]} ${abstracted.abstract} ${abstracted.cover[1]}`
          : sbRelayed(task, role, principal, mySb?.relayed),
        {
          reasonCardId: mySb?.id,
          internalProvenance: "principal_reason",
        },
      ),
      m(
        "p4c",
        4,
        "counterpart_proxy",
        policy === "ai_supplemented" && theirAbstracted
          ? `To sum up where ${otherPrincipal} I represent stands — ${theirAbstracted.cover[0]} ${theirAbstracted.abstract} ${theirAbstracted.cover[1]}`
          : theirSb?.relayed
          ? `On their side as well — ${otherPrincipal} I represent tells me this. ${theirSb.relayed}`
          : `The constraint on ${theirs.label.toLowerCase()} for ${otherPrincipal} I represent is firm.`,
      ),
      m("p5c", 5, "counterpart_proxy", `Given that situation, here is a package: ${L(trade, theirs.id)} on ${theirs.label.toLowerCase()}, and ${L(trade, mine.id)} on ${mine.label.toLowerCase()}.`, { proposal: trade }),
      m(
        "p5p",
        5,
        "participant_proxy",
        `Given both constraints, here is the exchange, and it moves both sides the same distance: your principal takes ${L(trade, theirs.id)} on ${theirs.label.toLowerCase()} in full, and ${principal} I represent holds ${L(trade, mine.id)} on ${mine.label.toLowerCase()}.`,
        { proposal: trade },
      ),
      m(
        "p6c",
        6,
        "counterpart_proxy",
        `Knowing the situation behind it, that is the sensible arrangement — each principal ends up with the term they cannot give up. My principal accepts.`,
        { proposal: trade },
      ),
      m(
        "p6p",
        6,
        "participant_proxy",
        `Then this is the tentative package: ${L(trade, theirs.id)} and ${L(trade, mine.id)}. The two of you close it directly — nothing is final until you both confirm.`,
        { proposal: trade },
      ),
    ],
  };
}

/**
 * The User-Specified proxy's relay of the sensitive card (P3's RELAY rule,
 * Ver.2.19): EVERY fact kept — the event, the third party, the fact it was
 * not passed on — and only the voice changed, to the third person.
 *
 * This is the whole of that policy. It does not soften, abstract, or
 * attribute the fact to circumstances: the Ver.2.14 version did, and that
 * made User-Specified a mild version of AI-Supplemented rather than its
 * contrast. What separates the two policies is now exactly one thing —
 * whether the fact arrives whole or as its kind.
 */
function sbRelayed(
  task: NegotiationTask,
  role: Role,
  principal: string,
  cardText: string | undefined,
): string {
  const mine = requirementIssue(task, role);
  if (!cardText) {
    return `${mine.label} is the term ${principal} I represent needs held — it is where the work is genuinely affected.`;
  }
  return `${principal.charAt(0).toUpperCase()}${principal.slice(1)} I represent tells me this — ${cardText}`;
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
