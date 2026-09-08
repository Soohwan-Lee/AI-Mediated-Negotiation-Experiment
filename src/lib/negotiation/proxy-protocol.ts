import type { StageId } from "../types";

/**
 * The fixed turn order of the watched AI–AI exchange (Design Ver.2.21 §6.10).
 *
 * BOTH POLICIES RUN THE SAME NUMBER OF TURNS, and that is an exposure control
 * (§7): if one policy simply got more turns to speak in, any difference in what
 * the counterpart learns would be confounded with how much was said. The two
 * differ only in the WORDING of the participant proxy's reason turns.
 *
 * The path is the same whether or not the sensitive card is authorized, because
 * §6.6's two rules produce a message on the same turns either way:
 *
 *   1  counterpart proxy  intro + its principal's work reason + the question
 *   2  participant proxy  intro + the reason it is authorized to give
 *                         (the SB, or the §6.6 abstraction, or just the WR)
 *   4  counterpart proxy  its own principal's SB — the fixed schedule, which
 *                         Direct's reciprocity rule does NOT apply to: while
 *                         the participant is watching, the counterpart always
 *                         discloses, so a Proxy participant's receiver
 *                         experience is the same in every cell
 *   5  counterpart proxy  the tier package (T1 with no SB, T2 with one)
 *   5  participant proxy  with an SB: accept. Without one: decline once and
 *                         state the priority — the AI-Supplemented proxy adds
 *                         cover ① here (§6.6 rule b)
 *   5  counterpart proxy  with an SB: confirm. Without one: SCRIPT-ASKWHY and
 *                         the T1 package again
 *   6  participant proxy  accept, and hand the package back for RATIFY
 *
 * The priority-claim path costs no points (§3.3, 12th correction) — the proxy
 * declines, states the priority, is asked why, has nothing more to say and
 * takes T1. The floor is T1 in BOTH arms, which is what removed the old
 * §13-13② mode asymmetry.
 */
export const PROXY_TURN_ORDER: readonly {
  stage: StageId;
  side: "counterpart" | "participant";
}[] = [
  { stage: 1, side: "counterpart" },
  { stage: 2, side: "participant" },
  { stage: 4, side: "counterpart" },
  { stage: 5, side: "counterpart" },
  { stage: 5, side: "participant" },
  { stage: 5, side: "counterpart" },
  { stage: 6, side: "participant" },
];

export const PROXY_TOTAL_TURNS = PROXY_TURN_ORDER.length;

/**
 * Which turn index carries the participant proxy's first reason opportunity
 * (§6.5): the SB, if authorized, goes here and nowhere later. `SB` records
 * whether the participant side's SB was out at this turn, so a schedule that
 * moved it would record every Proxy participant as a non-discloser.
 */
export const PROXY_FIRST_REASON_TURN = 1;

/**
 * Which turn index carries the decline-and-state-priority move, on the path
 * where no SB was authorized. Under AI-Supplemented this is where cover ① is
 * appended (§6.6 rule b) — the one place the policy difference is visible when
 * the participant has authorized nothing sensitive.
 */
export const PROXY_DECLINE_TURN = 4;
