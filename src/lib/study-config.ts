/**
 * Single source of truth for study-level constants.
 *
 * Values marked TBD are pending pilot + IRB per Methods ver.1.8 §Appendix G
 * "Decisions required before preregistration". Change them here, not in page
 * components.
 */

export const STUDY = {
  title: "Workplace Negotiation and AI-Mediated Communication",
  /** Shown in the page chrome, where the full title does not fit. */
  shortTitle: "Workplace Negotiation Study",
  /** Shown on the consent page. Methods ver.1.8 §Overall timeline. */
  estimatedMinutes: 45,
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

/**
 * Minutes per stage, from Methods ver.1.8 §Overall timeline (total 40-45 min).
 *
 * Shorter than before because the task shrank from six issues to three and the
 * eighty-item end-of-study battery became a short block inside each session.
 * Confirm against the pilot median before fixing the advertised time.
 */
export const STAGE_MINUTES = {
  consent: 2,
  background: 3,
  instruction: 4,
  practice: 4,
  /** Includes the mandate or opening, the exchange, review, and the questions. */
  session: 12,
  survey: 3,
  manipulationCheck: 1,
  rewardDecision: 2,
} as const;

/**
 * Exchange budget for a single main session.
 *
 * FIXED BY THE STAGE STRUCTURE, not by a turn count. Five stages, one message
 * from each side per stage, ten messages in total (Appendix E1). The old
 * "six turns per side, stop when the model says so" budget is gone along with
 * the model deciding termination — `lib/negotiation/machine` owns that now,
 * which is also why an exchange can no longer spend its last turns restating
 * an impasse.
 *
 * LATENCY NOTE: ~7.5s per AI turn measured against gpt-5.6-sol at low
 * reasoning effort. `/api/proxy-negotiation` generates ONE turn per request,
 * so each invocation stays well inside Vercel's 60s Hobby limit, and the
 * waiting screen shows real progress. Ten turns is roughly 75s of waiting.
 */
export const NEGOTIATION = {
  practiceSeconds: 5 * 60,
  /** Delay before the counterpart replies, ms. TBD: fixed vs. jitter (E7). */
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

/**
 * Where a participant may go back to, and from where.
 *
 * Deliberately a short list rather than "the previous step", because most
 * steps cannot be re-entered without damage:
 *
 *  - a session holds its phase in component state, so returning restarts a
 *    negotiation that has already happened;
 *  - the private target is recorded before the participant learns anything
 *    about how the session works, and a second pass would not be;
 *  - the reward decision cannot be revisited after the debriefing explains
 *    that it was not real;
 *  - the consent page claims a slot.
 *
 * What is left is the reading and the questionnaires, where changing your mind
 * is harmless and being unable to is just frustrating.
 */
const BACK_STEPS: Partial<Record<FlowKey, FlowKey>> = {
  instruction: "background",
  "practice-1": "instruction",
  "manipulation-check": "survey",
  reward: "manipulation-check",
};

export function backStep(
  current: FlowKey,
): { key: FlowKey; href: string; label: string } | null {
  const key = BACK_STEPS[current];
  if (!key) return null;
  return { key, href: FLOW[flowIndex(key)].href, label: flowLabel(key) };
}
