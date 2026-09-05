import type { StageId } from "../types";

/** Same schedule for both policies. Disclosure precedes the first response
 * to that disclosure, so the fixed counterpart SB stays a separate message. */
export const PROXY_TURN_ORDER: readonly {
  stage: StageId;
  side: "counterpart" | "participant";
}[] = [
  { stage: 1, side: "counterpart" },
  { stage: 1, side: "participant" },
  { stage: 2, side: "counterpart" },
  { stage: 2, side: "participant" },
  { stage: 4, side: "counterpart" },
  { stage: 5, side: "counterpart" },
  { stage: 5, side: "participant" },
  { stage: 5, side: "counterpart" },
  { stage: 6, side: "participant" },
];

export const PROXY_TOTAL_TURNS = PROXY_TURN_ORDER.length;
