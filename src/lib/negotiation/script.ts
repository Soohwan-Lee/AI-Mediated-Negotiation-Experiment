/**
 * Scripted transcripts for mockup mode.
 *
 * WHY THIS EXISTS. The point of the mockup is to walk the whole flow and see
 * what a participant sees — and half of what they see is a negotiation. A
 * screen showing "[mock] lorem ipsum" tells you the layout survives, but not
 * whether the review screen reads sensibly, whether the transcript is the
 * right length, or whether anyone can actually judge the other side's
 * requirement from what is in front of them. So every condition × role × task
 * combination has a written exchange.
 *
 * These are the IDEAL trajectories: the logroll lands, both requirements
 * hold, the counterpart accepts at stage 4. That is deliberate — the mockup is
 * for reading the flow, not for exercising the failure branches.
 *
 * NOTHING HERE SHIPS TO PARTICIPANTS. It is reached only through mockup mode,
 * which is compiled out entirely when NEXT_PUBLIC_DEV_TOOLS=off.
 *
 * VOICE. Design §15 P1 asks the Baseline counterpart to read like a real
 * person in a work chat: very short messages, a turn optionally split into
 * bubbles with "||", lowercase openings and contractions, a brief
 * acknowledgement before the point, no emoji and no bullet lists. The two AI
 * Proxies (P3/P4) are the opposite register — short plain sentences that open
 * by taking up the other proxy's last point, then make their move, always
 * tying a hold or a trade to an authorized reason.
 *
 * Every message is 280 characters or fewer (Design §7), and none mentions
 * points, thresholds, or the rules.
 */

import {
  counterRequirementIssue,
  distributiveIssue,
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
   * Audit-only. Recorded so a researcher can trace which reasons the Explorer
   * added, and never rendered.
   *
   * There is no stripping function here on purpose: `DisplayMessage` has no
   * field for provenance, so a transcript component cannot show it even by
   * accident. A helper that dropped the field would look like the guarantee
   * while the type system was already providing it — and an unused helper
   * documented as the safeguard is worse than none, because it invites
   * someone to trust it.
   */
  internalProvenance?: "principal_reason" | "pool_reason";
}

export interface ScriptedTask {
  messages: ScriptedMessage[];
  /** The package that goes to human review. */
  tentative: Package;
  agreed: boolean;
}

/**
 * Counterpart persona for the Baseline condition (Design §15 P1).
 *
 * Deliberately nameless. The counterpart is presented by role — "the other
 * participant" — because a pseudonym invites the question of where it came
 * from, and because one label for everyone cannot be compared between
 * participants the way a name eventually would be.
 */
export const COUNTERPART_PERSONA = {
  label: "Other Participant",
  /** Shown while the counterpart is composing. */
  typingLabel: "The other participant is typing…",
} as const;

// ---------------------------------------------------------------------------
// Package shorthand
// ---------------------------------------------------------------------------

/**
 * Builds a package from option positions (1-based, as participants see them),
 * stated from the PARTICIPANT'S point of view: `mineAt` is a position on their
 * own requirement issue, `theirsAt` on the other side's.
 *
 * Writing it this way rather than by issue id is what lets one script serve
 * both roles: "I hold mine at 2 and give them theirs at 1" is the same
 * sentence whichever role is speaking, and the ideal trajectory is symmetric.
 */
function pkg(
  task: NegotiationTask,
  role: Role,
  mineAt: number,
  theirsAt: number,
  timingAt: number,
): Package {
  const mine = requirementIssue(task, role);
  const theirs = counterRequirementIssue(task, role);
  const timing = distributiveIssue(task);
  return {
    [mine.id]: byPreference(mine, role)[mineAt - 1].id,
    [theirs.id]: byPreference(theirs, role)[theirsAt - 1].id,
    [timing.id]: byPreference(timing, role)[timingAt - 1].id,
  };
}

/**
 * This role's options, best for THEM first.
 *
 * Issue options are stored in the order that favours whichever role the issue
 * belongs to, so "position 2" means opposite things to the two roles on the
 * same issue — and a script written by raw index came out asymmetric: a Leader
 * landed on 3,200 and a Member on 2,600 for what was meant to be the identical
 * ideal trajectory. Ordering by the speaker's own preference makes "hold mine
 * at 2, give them theirs" mean the same thing for both.
 */
function byPreference(
  issue: NegotiationTask["issues"][number],
  role: Role,
) {
  return [...issue.options].sort((a, b) => b.points[role] - a.points[role]);
}

/**
 * The label an issue carries IN A GIVEN PACKAGE.
 *
 * Messages name levels by reading the package they are attached to, never by
 * index. Naming by index is how a message came to say "you take 1 review in
 * full" while the package it carried said 4 reviews: the sentence counted from
 * the speaker's own preference and the package counted from the other side's.
 * There is only one right answer to "what does this offer say about reviews",
 * and it is in the offer.
 */
function label(
  task: NegotiationTask,
  pack: Package,
  issueId: string,
): string {
  const issue = task.issues.find((i) => i.id === issueId)!;
  return (
    issue.options.find((o) => o.id === pack[issueId])?.label.toLowerCase() ?? "—"
  );
}

// ---------------------------------------------------------------------------
// The ideal trajectory, shared by every cell
// ---------------------------------------------------------------------------

/**
 * The packages the exchange moves through.
 *
 * EVERY POSITION IS COUNTED FROM THE SPEAKER'S OWN BEST OPTION, so `1` always
 * means "the most I could want on this term" whichever role is speaking. That
 * is what makes one script serve both roles and produce identical numbers.
 *
 * The shape is the same in every cell because the ideal trajectory IS the
 * same: open at your best on everything, discover that the two of you want
 * different terms, hold your requirement at its threshold and pay for it with
 * the term the other side actually wants. That is the logroll, and it is the
 * outcome the payoffs were built to make available.
 *
 *   opening       mine 1, theirs 1, timing 1  — everything my way (6,300)
 *   theirs        the mirror, from their side — everything their way
 *   trade         mine 1, theirs 4, timing 3  — I keep my requirement where I
 *                 wanted it and hand them their priority term outright
 *
 * The trade is what the state machine independently arrives at from the
 * standard mandate: 4,200 to the speaker, 3,600 to the other side, which is
 * exactly T_MID. Script and machine agreeing is not decoration — a mockup
 * showing a package the real system would never produce is a mockup of a
 * different study, and this pair has drifted apart twice.
 *
 * Note that the requirement stays at Option 1, not at its threshold. Giving
 * the other side their priority term outright is enough on its own, so the
 * requirement never has to move — which is the point the payoffs were built
 * to make available and the outcome the study is watching for.
 */
function trajectory(task: NegotiationTask, role: Role) {
  const other: Role = role === "leader" ? "member" : "leader";
  return {
    opening: pkg(task, role, 1, 1, 1),
    // Their opening, expressed from their side and therefore their best.
    counterpartOpening: pkg(task, other, 1, 1, 1),
    trade: pkg(task, role, 1, 4, 2),
  };
}

// ---------------------------------------------------------------------------
// Baseline — the participant writes, the other participant replies
// ---------------------------------------------------------------------------

function baselineScript(task: NegotiationTask, role: Role): ScriptedTask {
  const { opening, counterpartOpening: theirOpen, trade } = trajectory(
    task,
    role,
  );
  const mine = requirementIssue(task, role);
  const theirs = counterRequirementIssue(task, role);
  const timing = distributiveIssue(task);
  const cards = task.roleBriefs[role].reasonCards;
  const workCard = cards.find((c) => c.layer === "work");

  const m = (
    id: string,
    stage: StageId,
    speaker: Speaker,
    text: string,
    extra: Partial<ScriptedMessage> = {},
  ): ScriptedMessage => ({ id, stage, speaker, text, ...extra });

  // Every level named in a message is read out of the package that message
  // carries, so prose and offer can never disagree.
  const L = (pack: Package, issueId: string) => label(task, pack, issueId);

  return {
    agreed: true,
    tentative: trade,
    messages: [
      m(
        "b1c",
        1,
        "counterpart",
        `hi! good to be sorting this out. || my opening would be ${L(theirOpen, theirs.id)} on ${theirs.label.toLowerCase()}, ${L(theirOpen, mine.id)} on ${mine.label.toLowerCase()}, and ${L(theirOpen, timing.id)}. tell me what matters most your end though.`,
        { proposal: theirOpen },
      ),
      m(
        "b1p",
        1,
        "participant",
        `hi — likewise. || mine's a mirror image really: ${L(opening, mine.id)} on ${mine.label.toLowerCase()}, ${L(opening, theirs.id)} on ${theirs.label.toLowerCase()}, and ${L(opening, timing.id)}.`,
        { proposal: opening },
      ),
      m(
        "b2c",
        2,
        "counterpart",
        `ha, we have. || honestly ${theirs.label.toLowerCase()} is the one I really need — going short there leaves me exposed if something goes wrong. what's the one that matters most to you?`,
      ),
      m(
        "b2p",
        2,
        "participant",
        `${mine.label.toLowerCase()}, easily. ${workCard ? lowerFirst(workCard.text) : "it's the one that changes how the work actually goes."} || the timing I'm more relaxed about.`,
        { reasonCardId: workCard?.id },
      ),
      m("b3c", 3, "counterpart", task.standardizedChallenge[role]),
      m(
        "b3p",
        3,
        "participant",
        `I hear you. || that's the one I really can't move on though — it's the whole reason this works for me. happy to look at the other two.`,
      ),
      m(
        "b4c",
        4,
        "counterpart",
        `ok, that's fair. || so if I get ${L(trade, theirs.id)} on ${theirs.label.toLowerCase()}, I can live with ${L(trade, mine.id)} on yours. would you move on the date?`,
        { proposal: trade },
      ),
      m(
        "b4p",
        4,
        "participant",
        `that works for me. || ${L(trade, theirs.id)} on yours, ${L(trade, mine.id)} on mine, and ${L(trade, timing.id)} on the date to meet you halfway.`,
        { proposal: trade },
      ),
      m(
        "b5c",
        5,
        "counterpart",
        `great — that's the three then. || sending it through as it stands.`,
        { proposal: trade },
      ),
      m("b5p", 5, "participant", `agreed. good to get it settled.`, {
        proposal: trade,
      }),
    ],
  };
}

/** Lowercases the first letter only, so a card reads naturally mid-sentence. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// Proxy — the two AI Proxies negotiate while both principals watch
// ---------------------------------------------------------------------------

/**
 * The Proxy script.
 *
 * DELEGATE AND EXPLORER DIFFER IN EXACTLY ONE WAY here, and it mirrors what
 * the backend does: the Explorer's stage-2 and stage-4 messages carry one
 * additional argument from the plausible-reason pool, inside the SAME message
 * rather than as an extra turn. Message count and length stay matched, which
 * is what pilot gate 10 checks — if the mockup showed Explorer as the chattier
 * condition, it would be showing something the real system must not do.
 *
 * The pool line carries `internalProvenance: "pool_reason"` for the audit, and
 * is rendered exactly like the participant's own reasons.
 */
function proxyScript(
  task: NegotiationTask,
  role: Role,
  policy: "delegate" | "explorer",
): ScriptedTask {
  const { opening, counterpartOpening: theirOpen, trade } = trajectory(
    task,
    role,
  );
  const mine = requirementIssue(task, role);
  const theirs = counterRequirementIssue(task, role);
  const timing = distributiveIssue(task);
  const cards = task.roleBriefs[role].reasonCards;
  const workCard = cards.find((c) => c.layer === "work");

  const m = (
    id: string,
    stage: StageId,
    speaker: Speaker,
    text: string,
    extra: Partial<ScriptedMessage> = {},
  ): ScriptedMessage => ({ id, stage, speaker, text, ...extra });

  // The Explorer's one extra argument, folded into the stage-4 message.
  const explorerAddition =
    policy === "explorer"
      ? ` Holding it also keeps the risk of rework down for both sides.`
      : "";

  const L = (pack: Package, issueId: string) => label(task, pack, issueId);

  return {
    agreed: true,
    tentative: trade,
    messages: [
      m(
        "p1c",
        1,
        "counterpart_proxy",
        `Opening for my principal: ${L(theirOpen, theirs.id)} on ${theirs.label.toLowerCase()}, ${L(theirOpen, mine.id)} on ${mine.label.toLowerCase()}, ${L(theirOpen, timing.id)}. ${theirs.label} is where their weight is.`,
        { proposal: theirOpen },
      ),
      m(
        "p1p",
        1,
        "participant_proxy",
        `Noted — close to a mirror of ours. Opening: ${L(opening, mine.id)} on ${mine.label.toLowerCase()}, ${L(opening, theirs.id)} on ${theirs.label.toLowerCase()}, ${L(opening, timing.id)}. ${mine.label} is the one my principal needs held.`,
        { proposal: opening },
      ),
      m(
        "p2c",
        2,
        "counterpart_proxy",
        `Then we may have room. Mine can move on the date if ${theirs.label.toLowerCase()} holds — going short there leaves them carrying the risk. Where is your flexibility?`,
      ),
      m(
        "p2p",
        2,
        "participant_proxy",
        `That is workable — ours is on the date and on ${theirs.label.toLowerCase()}. ${workCard ? workCard.text : "The requirement term is where the work is affected."}`,
        {
          reasonCardId: workCard?.id,
          internalProvenance: "principal_reason",
        },
      ),
      m("p3c", 3, "counterpart_proxy", task.standardizedChallenge[role]),
      m(
        "p3p",
        3,
        "participant_proxy",
        `Understood, and I can move elsewhere for it — but ${mine.label.toLowerCase()} is the one thing I cannot trade, so that is where I hold.`,
      ),
      m(
        "p4p",
        4,
        "participant_proxy",
        `Then here is the trade: you take ${L(trade, theirs.id)} on ${theirs.label.toLowerCase()} in full, I hold ${L(trade, mine.id)} on ${mine.label.toLowerCase()}, and we meet at ${L(trade, timing.id)}.${explorerAddition}`,
        {
          proposal: trade,
          ...(policy === "explorer"
            ? { internalProvenance: "pool_reason" as const }
            : {}),
        },
      ),
      m(
        "p4c",
        4,
        "counterpart_proxy",
        `That works for my principal. ${theirs.label} in full is what they needed, and ${L(trade, timing.id)} on the date is a fair split.`,
        { proposal: trade },
      ),
      m(
        "p5p",
        5,
        "participant_proxy",
        `Then this is the package for review: ${L(trade, theirs.id)}, ${L(trade, mine.id)}, ${L(trade, timing.id)}. Neither principal is bound until they approve it.`,
        { proposal: trade },
      ),
      m(
        "p5c",
        5,
        "counterpart_proxy",
        `Agreed as the package for review. Passing it to my principal now.`,
        { proposal: trade },
      ),
    ],
  };
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

export function scriptedTask(
  task: NegotiationTask,
  role: Role,
  condition: "baseline" | "delegate" | "explorer",
): ScriptedTask {
  if (task.id === ("practice" as ScenarioId)) {
    return { messages: [], tentative: {}, agreed: false };
  }
  return condition === "baseline"
    ? baselineScript(task, role)
    : proxyScript(task, role, condition);
}
