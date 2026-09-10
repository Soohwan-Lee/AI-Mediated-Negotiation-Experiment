import type { StageId } from "../types";

/**
 * The fixed turn order of the watched AI–AI exchange (Design Ver.2.21 §6.10).
 *
 * BOTH POLICIES RUN THE SAME NUMBER OF TURNS, and that is an exposure control
 * (§7): if one policy simply got more turns to speak in, any difference in what
 * the counterpart learns would be confounded with how much was said. The two
 * differ only in whether two fixed work benefits follow the same authorized
 * reason. The reason's facts, tier and representative voice stay the same.
 *
 * The path is the same whether or not the sensitive card is authorized, because
 * the same reason schedule is used either way:
 *
 *   1  counterpart proxy  intro + its principal's work reason + the question
 *   2  participant proxy  intro + the reason it is authorized to give
 *                         (the authorized SB, or just the WR)
 *   4  counterpart proxy  SB only after participant-side SB; otherwise
 *                         acknowledge shared work concerns without new facts
 *   5  counterpart proxy  the tier package (T1 with no SB, T2 with one)
 *   5  participant proxy  with an SB: accept. Without one: decline once and
 *                         state the priority; benefits are not repeated here
 *   5  counterpart proxy  with an SB: confirm. Without one: SCRIPT-ASKWHY and
 *                         the T1 package again
 *   6  participant proxy  accept, and hand the package back for direct confirmation
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
 * where no SB was authorized. Any AI work benefits have already been stated
 * with the work reason and are not repeated on this turn.
 */
export const PROXY_DECLINE_TURN = 4;
