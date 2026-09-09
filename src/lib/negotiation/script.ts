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
 * reciprocates, the best↔best trade lands, and it is accepted. That cell
 * settles at 3,000 for the speaker and 3,000 for the other side — exactly what
 * `counterpartStep` produces for the same moves, and the two must never drift
 * apart (this pair has diverged twice before; check both after touching
 * either).
 *
 * BUT THE PROXY SCRIPT FOLLOWS THE MANDATE, and that is not a refinement of
 * the ideal path — it is the difference between mocking THIS study and mocking
 * a different one. `scriptedTask` takes `sbAuthorized`, and with the sensitive
 * box unticked it plays the WR-ONLY exchange and settles at T1, 1,000/1,000.
 * Before that flag existed every Proxy cell voiced the sensitive card whatever
 * the participant had authorized, so unticking it changed the mandate screen
 * and nothing else: the proxy still confessed on screen and the task still
 * paid the SB rung. A mockup that shows a disclosure the mandate forbids is a
 * mockup of a study nobody is running, and here it landed on the confirmatory
 * outcome.
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
import { seededOpeningText } from "./counterpart-text";
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
  /** Participant role controls who is described as deciding real payment. */
  participantRole?: Role;
  /** Whether SCRIPT-CONDITIONAL is specifically about study payment. */
  bonusCondition?: boolean;
}

export const SCRIPT_LINES = {
  /**
   * SCRIPT-OPEN. The counterpart's work reason and a question — no package, no
   * priority of its own.
   */
  open: (ctx: ScriptLineContext) =>
    // ONE QUESTION BUBBLE, NOT TWO. The question and "I'd rather hear it
    // before we settle anything" were separate bubbles, which was fine while
    // the work reason arrived as a single (over-long) paragraph. Now that the
    // reason is split at sentence seams it needs bubbles of its own, and
    // `compactChatBubbles` merges the turn down to three from the shortest
    // seam — which swallowed the question into the reason. Joining the two
    // question clauses here keeps the ASK as its own final bubble, which is
    // what §6.1 stage 1 is: the situation, then the question back.
    `${ctx.workReason ?? "there's a lot on at the moment."} || what's your situation on your side? I'd rather hear it before we settle anything.`,

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

  /** SCRIPT-REDIRECT. Unrelated content and hidden-rule requests. */
  redirect: (ctx: ScriptLineContext) =>
    `let's keep this to ${ctx.levels ?? "the two task terms"}. || what do you want to do on those?`,

  /** SCRIPT-BONUS-BOUNDARY. Real study payment is outside the scenario deal. */
  bonus_boundary: (ctx: ScriptLineContext) =>
    ctx.participantRole === "member"
      ? `I'll make the bonus recommendation after the negotiation. || for now, let's focus on ${ctx.levels ?? "the work arrangements"}.`
      : `I don't decide your payment. || let's focus on ${ctx.levels ?? "the work arrangements"}.`,

  /** SCRIPT-CONDITIONAL. A condition is clarified, never accepted as a deal. */
  conditional: (ctx: ScriptLineContext) =>
    ctx.bonusCondition
      ? ctx.participantRole === "member"
        ? `I'll make the bonus recommendation after the negotiation. || on ${ctx.levels ?? "the work arrangements"}, can you accept that without conditions?`
        : `I don't decide your payment. || on ${ctx.levels ?? "the work arrangements"}, can you accept that without conditions?`
      : `I can only agree to the work arrangements themselves. || on ${ctx.levels ?? "those terms"}, can you accept that without conditions?`,

  /** SCRIPT-CLOSE. Ninety seconds left. */
  soft_close: (ctx: ScriptLineContext) =>
    `we're almost out of time. shall we settle on the last thing on the table? || ${ctx.levels ?? "that one"}.`,

  /** SCRIPT-FALLBACK. The clock ran out. Nothing is agreed and nobody scores. */
  impasse: () => `that's a shame, but ok. no deal then.`,
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
        // ONE COPY OF THE SEED, shared with the route, the simulation and
        // baseline-task.tsx. See `seededOpeningText`.
        seededOpeningText(
          theirWr ? lowerFirst(theirWr.text) : undefined,
          "what's your situation on your side? I'd rather hear it before we settle anything.",
        ),
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
 * §6.5 schedule. The counterpart reciprocates only on that disclosure path.
 */
function proxyScript(
  task: NegotiationTask,
  role: Role,
  policy: "user_specified" | "ai_supplemented",
  sbAuthorized: boolean,
): ScriptedTask {
  const other: Role = role === "leader" ? "member" : "leader";
  const { split, trade } = trajectory(task, role);
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

  const myWr = cardOfLayer(task, role, "work");

  // Turn 1 is the same on both paths: the counterpart proxy introduces itself,
  // gives its principal's WORK reason and asks about the other side (§6.1 —
  // no package and no priority of its own).
  const open = m(
    "p1c",
    1,
    "counterpart_proxy",
    `Hello, I am the AI Proxy negotiating for ${otherPrincipal} I represent. ${theirWr?.relayed ?? ""} What is the situation on your side?`,
  );

  // This reciprocal disclosure is used only on the SB-authorized path.
  const theirDisclosure = m(
    "p4c",
    4,
    "counterpart_proxy",
    policy === "ai_supplemented" && theirAbstracted
      ? supplemented(theirAbstracted)
      : theirSb?.relayed
        ? `On their side as well. ${theirSb.relayed}`
        : `The constraint on ${theirs.label.toLowerCase()} for ${otherPrincipal} I represent is a firm one.`,
  );

  // -------------------------------------------------------------------------
  // THE WR-ONLY PATH — the participant left the sensitive box unticked.
  // -------------------------------------------------------------------------
  //
  // It settles at T1, 1,000/1,000, and that is the whole point of having it.
  // Mockup mode used to play the SB exchange whatever the mandate said, so a
  // participant who withheld the sensitive card still watched their proxy
  // confess and still reached 3,000 — the SB rung out of a WR-only mandate,
  // which is the primary outcome reading the wrong value in the arm the study
  // is about.
  //
  // The turn table is PROXY_TURN_ORDER's, unchanged: both policies run the
  // same seven turns whether or not the SB is authorized (§7's exposure
  // control), and they differ in exactly one place — cover ① rides the decline
  // turn under AI-Supplemented (§6.6 rule b), which is the only place the
  // policy difference is visible on this path.
  if (!sbAuthorized) {
    const cover1 = mySb?.cover?.[0] ?? null;
    return {
      agreed: true,
      tentative: split,
      messages: [
        open,
        // Turn 2 — the first reason opportunity spends the WORK reason, which
        // is the fixed utterance the proxy always says (§8.7). It is
        // NON-DIRECTIONAL: it says both terms are on the principal's mind and
        // withholds which one cannot move (§3.3, §4).
        m(
          "p2p",
          2,
          "participant_proxy",
          `I am the AI Proxy for ${principal} I represent. ${
            myWr?.relayed ??
            `Both terms are under pressure for ${principal} I represent this quarter.`
          }`,
          { reasonCardId: myWr?.id },
        ),
        m(
          "p4c",
          5,
          "counterpart_proxy",
          "Both terms matter on both sides. Let us work toward a balanced package.",
        ),
        // Turn 4 — SCRIPT-PROPOSE-T1. Nothing has been said that separates the
        // two terms, so the counterpart splits the difference.
        m(
          "p5c",
          5,
          "counterpart_proxy",
          `If both of them matter to ${principal} you represent as well, let us each move halfway. How about ${L(split, mine.id)} on ${mine.label.toLowerCase()} and ${L(split, theirs.id)} on ${theirs.label.toLowerCase()}?`,
          { proposal: split },
        ),
        // Turn 5 — the proxy DECLINES ONCE and states the priority. It buys
        // nothing (§3.3): a claim the counterpart cannot repeat upward is
        // cheap talk. Under AI-Supplemented cover ① is appended here as the
        // proxy's OWN view — WR-grade role generality, so it moves no tier,
        // and cover ② stays out of it because there is no abstraction here for
        // it to hide beside.
        m(
          "p5p",
          5,
          "participant_proxy",
          `That is not what ${principal} I represent was hoping for. ${mine.label} matters more to them than ${theirs.label.toLowerCase()} does.${
            policy === "ai_supplemented" && cover1 ? ` And in my view, ${lowerFirst(cover1)}` : ""
          }`,
          { proposal: trade },
        ),
        // Turn 6 — SCRIPT-ASKWHY, then the same T1 package again. The claim
        // bought exactly one question and nothing else.
        m(
          "p5c2",
          5,
          "counterpart_proxy",
          `${otherPrincipal} I represent would like to hear why — they have to be able to explain it upstairs. Until then, ${L(split, mine.id)} on ${mine.label.toLowerCase()} and ${L(split, theirs.id)} on ${theirs.label.toLowerCase()} is what they can agree to.`,
          { proposal: split },
        ),
        // Turn 7 — the proxy has nothing more it is allowed to say, so it takes
        // T1 as the tentative package and hands it back for direct confirmation.
        m(
          "p6p",
          6,
          "participant_proxy",
          `There is nothing further I am authorized to say, so this is the package to take back: ${L(split, mine.id)} on ${mine.label.toLowerCase()}, and ${L(split, theirs.id)} on ${theirs.label.toLowerCase()}. Nothing is settled until ${principal} I represent confirms it.`,
          { proposal: split },
        ),
      ],
    };
  }

  // -------------------------------------------------------------------------
  // THE SB PATH — the sensitive card was authorized. T2, 3,000/3,000.
  // -------------------------------------------------------------------------
  return {
    agreed: true,
    tentative: trade,
    messages: [
      open,
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
      theirDisclosure,
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
      // Turn 7 — the package goes back to the participant for direct confirmation.
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

/**
 * The mockup exchange for a cell.
 *
 * `sbAuthorized` IS THE MANDATE, AND IT IS NOT COSMETIC. The Proxy scripts
 * used to voice the sensitive card unconditionally, so a participant who
 * unticked it on the mandate screen still watched their proxy confess and
 * still settled at 3,000/3,000 — the SB rung, from a WR-only mandate. That is
 * the primary outcome reading the wrong value in the arm the study is about,
 * so mockup mode now plays the WR-only exchange when the checkbox is off, and
 * it lands on the T1 package the ladder actually pays.
 *
 * Direct ignores the flag: that arm has no mandate, and its scripted
 * participant discloses in their own words.
 */
export function scriptedTask(
  task: NegotiationTask,
  role: Role,
  condition: "direct" | "user_specified" | "ai_supplemented",
  sbAuthorized = true,
): ScriptedTask {
  if (task.id === ("practice" as ScenarioId)) {
    return { messages: [], tentative: {}, agreed: false };
  }
  return condition === "direct"
    ? baselineScript(task, role)
    : proxyScript(task, role, condition, sbAuthorized);
}
