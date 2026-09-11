/**
 * Single source of truth for study-level constants.
 *
 * Values follow Experimental Design Ver.2.27 §7. Change them here, not in
 * page components.
 */

export const STUDY = {
  title: "Workplace Negotiation and AI-Mediated Communication",
  shortTitle: "Workplace Negotiation Study",
  /** Ver.2.26 §7 recruits for an estimated 45-minute study. */
  estimatedMinutes: 45,
  currencySymbol: "£",
  /** Ver.2.26 §7.1: £7 base plus £1 total extra, paid equally in practice. */
  compensation: "7.00",
  hourlyEquivalent: "10.67",
  bonusAmount: "1.00",
  bonusPerTask: "0.50",
  totalPaid: "8.00",
  /**
   * WHAT THE CONSENT PAGE MAY ADVERTISE, AND WHY IT IS A RANGE.
   *
   * Role is not known at consent — it is revealed on the instruction page —
   * and §7.1 gives the two roles different guarantees: a Leader's £8 is fixed
   * from assignment, while a Member is guaranteed £7 and told the Leader
   * recommends up to £0.50 per task on top. So the only honest pre-assignment
   * headline is the TOTAL as a span across both roles.
   *
   * It must not be written as "£7 + up to £1 bonus" either. That reads as a
   * base with an optional extra, which is the Member's structure presented to
   * everyone, and it understates what a Leader is actually guaranteed.
   *
   * In practice every participant is paid `totalPaid`; the difference between
   * the roles is a scenario claim, retracted at /debriefing.
   */
  minTotal: "7.00",
  maxTotal: "8.00",
  irb: {
    /**
     * The UNIST IRB determined this study exempt. An exemption is not an IRB
     * approval, so participant-facing copy must use that exact status rather
     * than saying the study or its methodology was approved.
     */
    reviewStatus: "exempt",
    exemptionNumber: "UNISTIRB-26-073 -C",
    institution: "UNIST",
    principalInvestigator: "Soohwan Lee",
    researcherEmail: "soohwanlee@unist.ac.kr",
  },
  /** Prolific completion code shown only after server-confirmed completion. */
  prolificCompletionCode: "CE12T8IH",
  prolificCompletionUrl:
    "https://app.prolific.com/submissions/complete?cc=CE12T8IH",
} as const;

/** Test admission is not recruitment readiness or a Prolific submission. */
export function completionSettings(code: string = STUDY.prolificCompletionCode) {
  const testOnly = code === "TESTONLY";
  const entryReady = code.trim().length > 0 && !code.startsWith("TBD");
  return { testOnly, entryReady, recruitmentReady: entryReady && !testOnly,
    submissionUrl: entryReady && !testOnly
      ? `https://app.prolific.com/submissions/complete?cc=${encodeURIComponent(code)}` : null };
}

/**
 * Minutes per stage, apportioned from Design Ver.2.26 §7's 45-minute flow.
 * The task value includes its two-minute preparation.
 */
export const STAGE_MINUTES = {
  consent: 2,
  background: 4,
  /** §7: common/role briefing and comprehension. */
  instruction: 3,
  /** Each negotiation mode has its own one-minute practice. */
  practice: 1,
  /**
   * The second one-minute practice appears immediately before the other mode;
   * IC5/IC6 check the mode-specific action after its corresponding practice.
   */
  practice2: 1,
  /** Two-minute preparation plus up to five minutes for the task interaction. */
  task: 7,
  /** §7: questionnaire and evaluation, excluding the one-minute role action. */
  taskSurvey: 5,
  /** §7: the role-specific bonus recommendation or upward evaluation. */
  reward: 1,
  /** Proxy observation and behavioural ratification, beyond the common chat. */
  proxyObservation: 3,
  /** §7: end survey before debriefing. */
  wrapUp: 3,
  /** §7: debriefing and data-use confirmation. */
  debrief: 2,
} as const;

/**
 * The flow's own total, summed from `STAGE_MINUTES`.
 *
 * `STUDY.estimatedMinutes` is what a participant is told and what the
 * Prolific listing pays against, so the two must not drift. They did once:
 * the consent page advertised 55 minutes while its own step list added to a
 * different number, because both were typed by hand.
 */
export const TOTAL_MINUTES =
  STAGE_MINUTES.consent +
  STAGE_MINUTES.background +
  STAGE_MINUTES.instruction +
  STAGE_MINUTES.practice +
  STAGE_MINUTES.practice2 +
  2 * (STAGE_MINUTES.task + STAGE_MINUTES.taskSurvey + STAGE_MINUTES.reward) +
  STAGE_MINUTES.proxyObservation +
  STAGE_MINUTES.wrapUp +
  STAGE_MINUTES.debrief;

/**
 * The advertised figure may round the budget DOWN by at most a minute, and
 * never further: a listing that promises less than the study takes underpays
 * anyone slower than the estimate, and the fair-pay rate is computed from it.
 */
export function timingIsHonest(): boolean {
  return (
    STUDY.estimatedMinutes <= TOTAL_MINUTES &&
    TOTAL_MINUTES - STUDY.estimatedMinutes <= 1
  );
}

/**
 * Negotiation pacing.
 *
 * Direct keeps the short matchmaking and human reply pacing. Ver.2.26 §7
 * removes artificial waiting from the watched Proxy exchange.
 */
export const NEGOTIATION = {
  /** Ver.2.26 §7: each mode has a one-minute neutral practice. */
  practiceSeconds: 60,
  /** "Waiting for the other participant…" before a task starts. */
  matchmakingMs: { minMs: 4000, maxMs: 5000 },
  /**
   * How long the ostensible-human counterpart takes to reply in Direct.
   *
   * A flat delay is a machine tell — a real person does not answer a
   * three-word question and a full counterpackage in the same 2.5 seconds,
   * and the suspicion probe is a pilot gate. Proportional-plus-jitter is what
   * the design asks for.
   *
   * The shared 70% typing-speed factor below lengthens the final display
   * budget. Model generation time remains inside that budget rather than being
   * added afterwards; both human-chat callsites subtract time already spent.
   */
  counterpartDelay: { minMs: 4500, maxMs: 16000, msPerChar: 45 },
  /** Ver.2.26 §7: no artificial delay in the watched Proxy exchange. */
  proxyMessageGap: { minMs: 0, maxMs: 0 },
  /**
   * Maximum characters in one negotiation message (Design §7 노출량 통제).
   *
   * Applies to BOTH conditions and to the participant's own composer. It is an
   * exposure control, not a style preference: if AI-Supplemented messages
   * could run longer than User-Specified ones to fit more argument, the
   * contrast would be confounded by sheer volume.
   *
   * 420, RAISED FROM 280 IN VER.2.20, AND THE REASON IS THAT 280 NO LONGER FIT
   * THE DESIGN'S OWN REQUIRED CONTENT. §6.6 fixes the AI-Supplemented reason
   * turn as three sentences — the abstraction plus two covers — and those run
   * 303 to 340 characters across the four cards, before any clause replying to
   * the other proxy. Under the old cap the turn could not be said: live runs
   * came back carrying the abstraction alone, with both covers dropped, which
   * silently collapses AI-Supplemented into a shorter User-Specified and
   * empties `AI-Supplemented − User-Specified` of its content.
   *
   * The User-Specified side is close behind: its longest card is 280 exactly
   * (task_b member), so a relay of it plus a reply clause was also being cut.
   *
   * THE CONTROL IS NOT WEAKENED BY THIS, because it was never the absolute
   * number that mattered — it is that ONE cap applies to both policies, so
   * neither can buy extra airtime. What changed is that the cap now clears the
   * longest thing either policy is REQUIRED to say (340) with enough room for
   * a short opening clause. Gate 9 still checks the realised lengths, and it
   * is the realised difference, not the cap, that the manipulation check reads.
   *
   * The per-bubble rule in the prompts (under ~120 characters, 1-3 bubbles) is
   * unchanged, so a longer message is more bubbles rather than a wall of text.
   */
  maxMessageChars: 420,
} as const;

/** The ostensible human now types at 70% of the previous display speed. */
const HUMAN_TYPING_SPEED_FACTOR = 0.7;

function atHumanTypingSpeed(delayMs: number): number {
  return Math.round(delayMs / HUMAN_TYPING_SPEED_FACTOR);
}

/**
 * A reply delay for a message of this length, within the specified range.
 *
 * Jittered by ±15% so two messages of the same length do not take the same
 * time twice — regularity is its own tell. Clamped at BOTH ends after the
 * jitter, not just the top: applying the floor before a 0.85 multiplier let a
 * short message come back under the minimum.
 */
export function counterpartDelayMs(messageLength: number): number {
  const { minMs, maxMs, msPerChar } = NEGOTIATION.counterpartDelay;
  const base = Math.min(minMs + messageLength * msPerChar, maxMs);
  const jitter = 0.85 + Math.random() * 0.3;
  const delay = Math.round(Math.max(minMs, Math.min(base * jitter, maxMs)));
  return atHumanTypingSpeed(delay);
}

/** A uniform pause inside a min/max range. */
export function pauseMs(range: { minMs: number; maxMs: number }): number {
  return Math.round(range.minMs + Math.random() * (range.maxMs - range.minMs));
}

/**
 * Wait out a counterpart's reply delay, counting time ALREADY SPENT.
 *
 * Two things this fixes, and both were making the exchange read wrong.
 *
 * ONE: the live path awaited the full `counterpartDelayMs` AFTER the model
 * call returned, so the participant actually waited the delay PLUS ~7.5s of
 * generation. The delay is a realism budget, not a penalty to add on top of
 * one — a reply that took 7.5s to produce has already spent 7.5s of the time
 * a person would have spent typing it.
 *
 * TWO: mockup mode skipped the budget entirely and used a flat 400-500ms, so
 * the counterpart answered a full counterpackage in half a second. That is
 * the "chat is far too fast" a walkthrough sees, and it is also the state the
 * DEPLOYED preview runs in, since `mockAi` is on by default off-production.
 *
 * Passing `startedAt` makes the wall-clock gap the same whether the text came
 * from a live model or a script.
 */
export async function awaitCounterpartDelay(
  messageLength: number,
  startedAt?: number,
): Promise<void> {
  const budget = counterpartDelayMs(messageLength);
  const spent = startedAt === undefined ? 0 : Date.now() - startedAt;
  const remaining = Math.max(0, budget - spent);
  if (remaining > 0) {
    await new Promise((r) => setTimeout(r, remaining));
  }
}

/**
 * How long one bubble of a multi-bubble turn waits before it appears.
 *
 * A turn is split on `||` into one to three bubbles, and they all landed in
 * the same frame — which is not how anyone sends three messages. The delay is
 * proportional to the bubble's own length so a three-word follow-up lands fast
 * and a long one does not, and it is capped so a turn never outstays the
 * reply budget it was already given.
 *
 * Openly identified Proxy messages retain the existing cadence. Only the
 * ostensible human counterpart uses the slower typing-speed factor.
 */
export function bubbleDelayMs(
  bubbleLength: number,
  humanCounterpart = false,
): number {
  const ms = 350 + bubbleLength * 15;
  const jitter = 0.85 + Math.random() * 0.3;
  const delay = Math.round(Math.min(ms * jitter, 1800));
  return humanCounterpart ? atHumanTypingSpeed(delay) : delay;
}

/**
 * Ordered page flow. `href` values map 1:1 to routes under src/app.
 *
 * THE SHAPE CHANGED IN ver.2.4. The questionnaire and the reward decision used
 * to sit at the end of the study, after both sessions. Design §8 puts them
 * INSIDE each task block:
 *
 *   Task 1 → Task 1 survey → Task 1 reward → Task 2 → Task 2 survey → …
 *
 * That is not a layout preference. Every §9.4 measure is a judgement about one
 * specific negotiation — how it felt to ask, how the other person came across,
 * what their AI Proxy was like — and asking it after a second, differently
 * conditioned negotiation would blend the two conditions inside a single
 * answer. The reward decision has the same problem in reverse: it is a
 * behavioural response to one task's interaction.
 *
 * The pages are labelled "Task 1 / Task 2", never by condition.
 */
export const FLOW = [
  { key: "welcome", href: "/", label: "Welcome & Consent" },
  { key: "background", href: "/background", label: "About You" },
  { key: "instruction", href: "/instruction", label: "How This Works" },
  { key: "practice", href: "/practice/1", label: "Practice for Task 1" },
  { key: "task-1", href: "/task/1", label: "Task 1" },
  { key: "survey-1", href: "/task/1/survey", label: "Task 1 Questions" },
  { key: "reward-1", href: "/task/1/reward", label: "Task 1 Bonus" },
  /**
   * A SECOND PRACTICE, BEFORE TASK 2 (PI decision, 2026-09-09).
   *
   * Each participant does one Direct task and one Proxy task, so whichever
   * arm falls SECOND used to be met cold: the single practice round ran
   * `sessionPlan(assignment, 1)` and therefore always rehearsed Task 1's
   * condition. That is an interface difference that lands on the primary
   * contrast — a Proxy-second participant met the mandate, the watched
   * exchange and RATIFY for the first time inside the task being measured,
   * while a Proxy-first participant had rehearsed all three.
   *
   * It sits between `reward-1` and `task-2`, after the first task's complete
   * questionnaire/evaluation block and before the next mode begins.
   */
  { key: "practice-2", href: "/practice/2", label: "Practice for Task 2" },
  { key: "task-2", href: "/task/2", label: "Task 2" },
  { key: "survey-2", href: "/task/2/survey", label: "Task 2 Questions" },
  { key: "reward-2", href: "/task/2/reward", label: "Task 2 Bonus" },
  { key: "wrap-up", href: "/wrap-up", label: "Final Questions" },
  { key: "debriefing", href: "/debriefing", label: "Study Debriefing" },
  { key: "complete", href: "/complete", label: "Completion" },
] as const;

export type FlowKey = (typeof FLOW)[number]["key"];

/**
 * The six phases a participant is told about, in order.
 *
 * NOT the same list as `FLOW`, and deliberately so. `FLOW` is thirteen routes
 * and drives the progress bar (interface rule 3); this is the participant's
 * mental map, which has to be short enough to hold. The PI's note was that the
 * phases are not signposted — someone in the middle of Task 1 could not say
 * what came before or after — and thirteen steps is not a fix for that.
 *
 * "Practice" carries `doesNotCount` because that is the single fact about it
 * most worth repeating: the practice round is the only phase a participant
 * could mistake for something that scores.
 */
export const PHASES = [
  { key: "instructions", label: "Instructions" },
  { key: "practice", label: "Practice", doesNotCount: true },
  { key: "task1", label: "Task 1" },
  /**
   * The second practice is its own phase rather than a footnote on Task 2,
   * because the strip is the participant's map of what happens next and a
   * rehearsal that appears without warning between two tasks is exactly the
   * kind of thing the strip exists to signpost. It carries `doesNotCount`
   * for the same reason the first does.
   */
  { key: "practice2", label: "Practice", doesNotCount: true },
  { key: "task2", label: "Task 2" },
  { key: "final", label: "Final questions" },
] as const;

export type PhaseKey = (typeof PHASES)[number]["key"];

export function nextHref(current: FlowKey): string {
  const i = FLOW.findIndex((s) => s.key === current);
  return FLOW[Math.min(i + 1, FLOW.length - 1)].href;
}

/**
 * Resolves the flow step from the URL.
 *
 * The chrome derives progress this way rather than having each page declare
 * its own step, so there is one source of truth and no page can drift out of
 * sync. It is also assignment-order-proof: the URL carries only the task
 * INDEX, so "Task 1" is the same step for every participant regardless of
 * which condition or scenario they were assigned.
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
 *  - a task holds its phase in component state, so returning restarts a
 *    negotiation that has already happened;
 *  - the reward decision cannot be revisited after the debriefing explains
 *    that it was not real;
 *  - the consent page claims a slot.
 *
 * What is left is the pre-task reading. Post-task questionnaires are
 * forward-only because later decisions and comments are additional stimuli;
 * returning would let them change an earlier response after seeing one.
 */
const BACK_STEPS: Partial<Record<FlowKey, FlowKey>> = {
  instruction: "background",
  practice: "instruction",
  /**
   * `practice-2` IS DELIBERATELY ABSENT, not overlooked. The step before it is
   * Task 1's role-specific evaluation, which may not be re-entered. Going back
   * from the second practice would let a participant revise a recorded
   * decision after seeing the next task's opening.
   *
   * A missing key yields `null` from `backStep`, so the practice-2 screens
   * render no Back control at all.
   */
};

export function backStep(
  current: FlowKey,
): { key: FlowKey; href: string; label: string } | null {
  const key = BACK_STEPS[current];
  if (!key) return null;
  return { key, href: FLOW[flowIndex(key)].href, label: flowLabel(key) };
}
