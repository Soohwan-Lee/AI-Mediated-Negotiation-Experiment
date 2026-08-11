/**
 * Single source of truth for study-level constants.
 *
 * Values marked TBD are pending pilot + IRB per Methods §B3 "Decisions still
 * required". Change them here, not in page components.
 */

export const STUDY = {
  title: "Workplace Negotiation and AI-Mediated Communication",
  /** Shown in the page chrome, where the full title does not fit. */
  shortTitle: "Workplace Negotiation Study",
  /** Shown on the consent page. */
  estimatedMinutes: 55,
  compensationUsd: "9.00", // TBD after pilot; must clear Prolific fair rate
  hourlyEquivalentUsd: "9.80",
  irb: {
    protocolNumber: "TBD-IRB-0000",
    institution: "UNIST",
    principalInvestigator: "[PI Name]",
    /** IRB office address — TBD, must be the approved one before recruitment. */
    contactEmail: "[irb-contact@unist.ac.kr]",
    researcherEmail: "soohwanlee@unist.ac.kr",
  },
  /** Issued on the completion page. Replace with the real Prolific code. */
  prolificCompletionCode: "TBD-COMPLETION-CODE",
  prolificCompletionUrl:
    "https://app.prolific.com/submissions/complete?cc=TBD-COMPLETION-CODE",
} as const;

/** Minutes per stage, from Methods §Overall timeline (total ≈ 54 min). */
export const STAGE_MINUTES = {
  consent: 2,
  background: 3,
  instruction: 5,
  practice: 5,
  session: 10,
  survey: 10,
  manipulationCheck: 2,
  rewardDecision: 2,
} as const;

/**
 * Turn budget for a single main session. TBD pending pilot.
 *
 * LATENCY NOTE: measured ~7.5s per AI turn against gpt-5.6-sol at low
 * reasoning effort. `/api/proxy-negotiation` generates ONE turn per request,
 * so each invocation stays well inside Vercel's 60s Hobby limit regardless of
 * this value — the budget is a design choice, not a timeout constraint.
 *
 * 6 per side (12 total, ~90s of waiting) is set to give the exchange room for
 * a real opening / trading / closing arc without producing a transcript too
 * long for participants to review. Confirm in pilot.
 */
export const NEGOTIATION = {
  sessionSeconds: 10 * 60,
  practiceSeconds: 5 * 60,
  maxTurnsPerSide: 6,
  /** Delay before the counterpart replies, ms. TBD: fixed vs. jitter. */
  counterpartDelayMs: 2500,
} as const;

/**
 * Ordered page flow. `href` values map 1:1 to routes under src/app.
 * The two session blocks are parameterized by session index.
 */
export const FLOW = [
  { key: "welcome", href: "/", label: "Welcome & Consent" },
  { key: "background", href: "/background", label: "Background Survey" },
  { key: "instruction", href: "/instruction", label: "Instructions" },
  { key: "practice-1", href: "/session/1/practice", label: "Practice 1" },
  { key: "session-1", href: "/session/1", label: "Session 1" },
  { key: "practice-2", href: "/session/2/practice", label: "Practice 2" },
  { key: "session-2", href: "/session/2", label: "Session 2" },
  { key: "survey", href: "/survey", label: "Questionnaire" },
  { key: "manipulation-check", href: "/manipulation-check", label: "Final Check" },
  { key: "reward", href: "/reward", label: "Reward Decision" },
  { key: "debriefing", href: "/debriefing", label: "Debriefing" },
  { key: "complete", href: "/complete", label: "Completion" },
] as const;

export type FlowKey = (typeof FLOW)[number]["key"];

export function nextHref(current: FlowKey): string {
  const i = FLOW.findIndex((s) => s.key === current);
  return FLOW[Math.min(i + 1, FLOW.length - 1)].href;
}

/**
 * Resolves the flow step from the URL.
 *
 * The chrome derives progress this way rather than having each page declare
 * its own step, so there is one source of truth and no page can drift out of
 * sync. It is also assignment-order-proof: the URL carries only the session
 * INDEX, so "Session 1" is step 5 for every participant regardless of which
 * condition or task they were assigned (Methods §Controlled counterpart and
 * participant belief).
 */
const HREF_TO_KEY = new Map<string, FlowKey>(
  FLOW.map((s) => [s.href, s.key as FlowKey]),
);

export function flowKeyFromPath(pathname: string): FlowKey | null {
  const clean =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return HREF_TO_KEY.get(clean) ?? null;
}

export function flowIndex(key: FlowKey): number {
  return FLOW.findIndex((s) => s.key === key);
}

export function flowLabel(key: FlowKey): string {
  return FLOW[flowIndex(key)]?.label ?? "";
}
