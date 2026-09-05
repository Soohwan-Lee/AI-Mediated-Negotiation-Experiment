/**
 * Single source of truth for study-level constants.
 *
 * Values marked TBD are pending pilot + IRB per Experimental Design Ver.2.4
 * §12 "Preregistration 전 결정 사항". Change them here, not in page components.
 */

export const STUDY = {
  title: "Workplace Negotiation and AI-Mediated Communication",
  /** Shown in the page chrome, where the full title does not fit. */
  shortTitle: "Workplace Negotiation Study",
  /**
   * Shown on the consent page, and the figure the Prolific listing must
   * carry. Design §2: "약 1시간 기준".
   *
   * Derived from `STAGE_MINUTES`, which is budgeted deliberately tight — the
   * negotiation clocks are CAPS that most participants finish well inside,
   * and the two batteries assume a worker who reads at pace. It is not
   * padded, but it is also not shaved: an advertised figure below what the
   * study takes underpays every participant who is slower than the estimate,
   * and Prolific's fair-pay rate is computed against this number.
   */
  estimatedMinutes: 61,
  /* ^ Keep in step with `TOTAL_MINUTES` below, which is derived from
     STAGE_MINUTES; `assertTimingConsistent()` fails the build if they part. */
  /**
   * Payment, in GBP because that is the currency Prolific pays in — quoting
   * dollars to a worker who is paid pounds advertises a figure the study does
   * not pay. The symbol is a field rather than a literal in the copy, so a
   * currency change stays one edit and cannot leave one screen behind.
   *
   * Working values, TBD after pilot; must clear Prolific's fair-pay rate.
   */
  currencySymbol: "£",
  /**
   * Base participation payment, advertised on the consent page.
   *
   * £8.25 base + £1.00 bonus = £9.25 for a 61-minute study, which is £9.10 an
   * hour — above Prolific's recommended fair-pay rate of £9.00 (their hard
   * floor is £6.00). The recommended rate rather than the floor because this
   * is an effortful hour: two briefings to read, two negotiations to conduct,
   * and roughly eighty rating items plus fourteen written answers.
   *
   * THE PAY ROSE WHEN THE BUDGET DID. Ver.2.14 added the REMARK screen and
   * ATTR after each post-negotiation decision (§6.8), which is two minutes
   * across the study. Left at £8.00 the rate would have fallen to £8.85/hour
   * — below the recommended rate the listing is judged against — so the base
   * moved with it. The number to adjust is always the PAY, never the
   * advertised minutes: the estimate is derived from the screens that exist,
   * and quoting less than the study takes underpays whoever is slower than
   * the estimate.
   */
  compensation: "8.25",
  hourlyEquivalent: "9.10",
  /**
   * The performance bonus (Design §2, §8). £1.00 per participant, across the
   * study — not per task.
   *
   * IT IS PRESENTED AS SOMETHING A LEADER DECIDES AND A MEMBER RECEIVES, AND
   * IN FACT EVERY PARTICIPANT IS PAID IT IN FULL. That is the third deception,
   * alongside the counterpart's existence and the upward evaluation, and
   * `/debriefing` retracts all three together.
   *
   * The reason for holding a pound back rather than simply paying £8.25 flat
   * is that the Leader's reward power has to be REAL to the Member for gate
   * 2's manipulation check to mean anything. POWER2 asks whether outcomes
   * that mattered depended on the other person's decisions; a bonus the
   * Member believes is being decided about them by someone else is that
   * dependence, and a flat fee announced up front is not.
   *
   * WHY IT IS NEVER SHOWN AS A NUMBER TO A MEMBER: see the reward page. The
   * wait carries the manipulation; a figure would add a tell (the same amount
   * after two visibly different negotiations) and a contaminant (a payout
   * seen after Task 1 is a response the Task 2 measures would pick up).
   *
   * FOR A LEADER the slider divides this pound and the choice is recorded as
   * `BONUS`. It is a real decision and real data. It simply never travels to
   * anybody's payment, because underpaying a Member for their counterpart's
   * judgement of them would be the study inflicting a cost on a participant
   * for a behaviour it induced.
   */
  bonusAmount: "1.00",
  /**
   * Decided once per task, so the two halves sum to `bonusAmount`. The §9.4.8
   * `BONUS` measure is a judgement about ONE negotiation, so the decision has
   * to be per task for the same reason the questionnaire is.
   */
  bonusPerTask: "0.50",
  /** Advertised total: base + the full bonus, which everyone is paid. */
  totalPaid: "9.25",
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
 * Minutes per stage, from Design §8 and §10 gate 8 ("Task당 median ≤ 12분").
 *
 * The two task blocks dominate: each is a briefing, a preference or mandate
 * screen, a ten-minute-capped negotiation, a review, twenty-odd survey items
 * and a reward screen.
 *
 * Do not resolve a long total by shaving the estimate. The pilot median
 * decides it, and the levers if it runs long are the reply-delay range and the
 * turn budget, not the advertised time. `STUDY.estimatedMinutes` is what a
 * participant is told, and it must not drift below what the study takes.
 */
export const STAGE_MINUTES = {
  consent: 2,
  background: 4,
  instruction: 4,
  practice: 4,
  /**
   * Briefing, preference or mandate, negotiation, decision, review.
   *
   * 13, down one from Ver.2.12's 14. Two Ver.2.13 changes both shorten the
   * task and neither is large: the mandate screen lost its second control per
   * issue (the walkaway limit, §2.6), and in the Proxy arm the three-minute
   * closing conversation is now reached only by a participant who asks for a
   * change or refuses — an approver goes straight to review. It is a cap
   * either way, and the pilot median decides whether it is right.
   *
   * NOT the §7 heading's "45-50 minutes". That is the design doc's rough
   * estimate; this figure is summed from the screens that actually exist, and
   * the advertised number is computed from it. Adopting the looser figure
   * would advertise less than the study takes, which underpays anyone slower
   * than the estimate.
   */
  task: 13,
  /**
   * The rating blocks and open-ended after ONE task.
   *
   * A Proxy task's battery is about twenty-five rating items and seven
   * required written answers. At a brisk five seconds per rating and
   * forty-five per written answer that is seven minutes, and four was the
   * old figure — which quietly understated the study by six minutes across
   * the two tasks and therefore understated the pay owed for them.
   */
  taskSurvey: 7,
  /**
   * The post-negotiation decision, then REMARK and ATTR.
   *
   * 2, up one from Ver.2.13. The decision itself is one control (a slider for
   * the Leader, three ratings and an optional note for the Member), and
   * Ver.2.14 added a screen after it: the counterpart's fixed parting comment
   * plus ATTR1, ATTR2 (Proxy only) and one written answer (§6.8, §9.4.9).
   * That screen has to come after every confirmatory measure, so it cannot be
   * folded into the battery above.
   */
  reward: 2,
  wrapUp: 3,
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
  2 * (STAGE_MINUTES.task + STAGE_MINUTES.taskSurvey + STAGE_MINUTES.reward) +
  STAGE_MINUTES.wrapUp;

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
 * Design §8 asks for a "waiting for the other participant" pause of 4-5
 * seconds before each negotiation, and 8-12 second gaps between messages while
 * two AI Proxies negotiate. Both exist to make a simulated counterpart read as
 * a person on the other end of a connection.
 */
export const NEGOTIATION = {
  practiceSeconds: 5 * 60,
  /** "Waiting for the other participant…" before a task starts. */
  matchmakingMs: { minMs: 4000, maxMs: 5000 },
  /**
   * How long the ostensible-human counterpart takes to reply in Direct.
   *
   * A flat delay is a machine tell — a real person does not answer a
   * three-word question and a full counterpackage in the same 2.5 seconds,
   * and the suspicion probe is a pilot gate. Proportional-plus-jitter is what
   * the design asks for.
   */
  counterpartDelay: { minMs: 8000, maxMs: 25000, msPerChar: 55 },
  /** Gap between messages while the participant spectates two AI Proxies. */
  proxyMessageGap: { minMs: 8000, maxMs: 12000 },
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
  return Math.round(Math.max(minMs, Math.min(base * jitter, maxMs)));
}

/** A uniform pause inside a min/max range. */
export function pauseMs(range: { minMs: number; maxMs: number }): number {
  return Math.round(range.minMs + Math.random() * (range.maxMs - range.minMs));
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
  { key: "practice", href: "/practice", label: "Practice Round" },
  { key: "task-1", href: "/task/1", label: "Task 1" },
  { key: "survey-1", href: "/task/1/survey", label: "Task 1 Questions" },
  { key: "reward-1", href: "/task/1/reward", label: "Task 1 Bonus" },
  { key: "task-2", href: "/task/2", label: "Task 2" },
  { key: "survey-2", href: "/task/2/survey", label: "Task 2 Questions" },
  { key: "reward-2", href: "/task/2/reward", label: "Task 2 Bonus" },
  { key: "wrap-up", href: "/wrap-up", label: "Final Questions" },
  { key: "debriefing", href: "/debriefing", label: "Study Debriefing" },
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
 * What is left is the reading and the questionnaires, where changing your mind
 * is harmless and being unable to is just frustrating.
 */
const BACK_STEPS: Partial<Record<FlowKey, FlowKey>> = {
  instruction: "background",
  practice: "instruction",
  "reward-1": "survey-1",
  "reward-2": "survey-2",
};

export function backStep(
  current: FlowKey,
): { key: FlowKey; href: string; label: string } | null {
  const key = BACK_STEPS[current];
  if (!key) return null;
  return { key, href: FLOW[flowIndex(key)].href, label: flowLabel(key) };
}

