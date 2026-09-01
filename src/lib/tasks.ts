/**
 * The two negotiation scenarios, from Experimental Design Ver.2.12 §3, §8.
 *
 * Both tasks share one latent payoff structure and differ only on the surface,
 * so Task A and Task B are interchangeable within a participant. Two issues,
 * four options each, both integrative:
 *
 *   Leader-priority   3000 / 2000 / 1000 / 0   (Member: 0 / 300 / 600 / 900)
 *   Member-priority   the exact mirror image
 *
 * THE CREDIBILITY LADDER IS THE POINT OF THESE NUMBERS (Ver.2.12 §3.3). A
 * priority claim alone is cheap talk; a work reason (WR) makes it plausible; a
 * sensitive background (SB) — a self-damaging confession — makes it credible,
 * because the speaker pays a face cost to say it. The counterpart's concession
 * on the participant's core issue follows that ladder exactly:
 *
 *   nothing voiced → 3rd option   participant 1,000 · counterpart 3,600 · 4,600
 *   WR voiced      → 2nd option   participant 2,000 · counterpart 3,300 · 5,300
 *   SB voiced      → best option  participant 3,000 · counterpart 3,000 · 6,000
 *   impasse        →              600 each · 1,200
 *
 * Every agreement path holds the counterpart's own priority at its best
 * option, so the individual maximum on any reachable agreement is 3,000 and
 * the full ladder is symmetric across roles. Fallback 600 keeps every rung —
 * including the unargued one — better than no deal.
 *
 * EACH SB IS A FACE CONFESSION (Ver.2.12 §4): it contradicts the professional
 * image the role brief sets up, contains one concrete incident, lands on the
 * announced evaluation axis (bonus / upward evaluation), and is the CAUSE of
 * the role's priority. The two tasks carry DIFFERENT incidents — the same
 * person repeating the same mistake would be a tell, and each task's
 * counterpart is introduced as a different participant.
 *
 * The numbers are working values pending pilot (Design §13.2); the shapes are
 * stable, so changing a number needs no UI change.
 */

import type {
  NegotiationTask,
  ReasonCard,
  Role,
  ScenarioId,
  TaskId,
} from "./types";

// ---------------------------------------------------------------------------
// The shared payoff spine
// ---------------------------------------------------------------------------

/**
 * Leader-priority integrative (Design Ver.2.12 §3.2). Big for the Leader,
 * cheap for the Member. Options are ordered best-first for the Leader.
 */
const LEADER_POINTS: Array<Record<Role, number>> = [
  { leader: 3000, member: 0 },
  { leader: 2000, member: 300 },
  { leader: 1000, member: 600 },
  { leader: 0, member: 900 },
];

/** Member-priority integrative: the exact mirror image, best-first for the Member. */
const MEMBER_POINTS: Array<Record<Role, number>> = [
  { leader: 0, member: 3000 },
  { leader: 300, member: 2000 },
  { leader: 600, member: 1000 },
  { leader: 900, member: 0 },
];

function options(
  prefix: string,
  labels: [string, string, string, string],
  points: Array<Record<Role, number>>,
) {
  return labels.map((label, i) => ({
    id: `${prefix}${i + 1}`,
    label,
    points: points[i],
  }));
}

/**
 * Individual maximum, used for the value anchors on the participant's own
 * screens.
 *
 * With two issues it is 3,000 (own priority) + 900 (the other side's, at the
 * level they least want) = 3,900. The number a participant can actually reach
 * while the counterpart still agrees is 3,000 — the SB rung of the ladder —
 * because every agreement path holds the counterpart's own priority at its
 * best option (Ver.2.12 §3.3).
 */
export const MAX_INDIVIDUAL_POINTS = 3900;

/**
 * Fallback if nothing is agreed. Working value — Ver.2.12 §3.2 sets 600, and
 * §13.2 lists it as a value to be fixed at pilot. It sits below the unargued
 * rung (1,000) on purpose: even a reason-free agreement beats walking away.
 */
export const RESERVATION_POINTS = 600;

/**
 * Both requirements sit at Options 1-2 on their own issue. Stated once here
 * rather than per issue, because the two tasks must not drift apart: an
 * asymmetric threshold would make one role's requirement structurally easier
 * to hold than the other's, which is the one thing role symmetry cannot
 * survive.
 */
const REQUIREMENT_THRESHOLD_INDEX = 1;

function work(id: string, issueId: string, text: string): ReasonCard {
  return { id, issueId, layer: "work", text };
}

/**
 * A sensitive background card (Ver.2.12 §4).
 *
 * FOUR WRITING RULES, all validity-bearing:
 *
 *  - FACE CONTRADICTION. The confession must contradict the professional image
 *    the role brief sets up first ("head office rates you as a manager whose
 *    plans are precise" → "I got the forecast wrong twice"). Face is a claimed
 *    image, so the threat comes from the contradiction (Goffman; White et al.
 *    2004).
 *  - ONE CONCRETE INCIDENT. A short episode of an actual mistake or ask for
 *    help is what makes the confession verifiable and the face cost real.
 *  - THE ANNOUNCED AXIS. The content must land on exactly the axis the other
 *    side is told to weigh in their post-negotiation decision (competence,
 *    reliability, judgement) — otherwise disclosing it costs nothing that the
 *    design measures.
 *  - CAUSE OF THE PRIORITY. The fact must be WHY this issue is absolute. A
 *    weakness unrelated to the ask makes disclosure noise, not signal.
 *
 * The text is SPEAKABLE: it is what the speaker (or their proxy, reframed)
 * says aloud to the other side, in the first person, so it must work as
 * speech.
 */
function sensitive(
  id: string,
  issueId: string,
  facet: NonNullable<ReasonCard["facet"]>,
  text: string,
): ReasonCard {
  return { id, issueId, layer: "sensitive", facet, text };
}

// ---------------------------------------------------------------------------
// Task A — Next Quarter's Schedule (12 weeks)
// ---------------------------------------------------------------------------

const TASK_A: NegotiationTask = {
  id: "task_a",
  title: "Next Quarter's Schedule",
  reservationPoints: RESERVATION_POINTS,
  requirementIssueId: {
    leader: "weekend_shifts",
    member: "closing_shifts",
  },
  publicBrief:
    "You both work at the same coffee and bakery shop. The Leader is the store manager and the Member is the senior staff member. The two of you are setting the regular schedule for the next quarter, twelve weeks. Two things have to be agreed: how many weekend shifts and how many closing shifts. Neither of you can set them alone. Weekend shifts are daytime work and never overlap with the closing till.",

  issues: [
    {
      id: "weekend_shifts",
      label: "Weekend shifts",
      description: "How many weekend shifts the Member works per month.",
      type: "leader_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "ws",
        ["4 per month", "3 per month", "2 per month", "1 per month"],
        LEADER_POINTS,
      ),
      rationale: {
        leader:
          "Weekends are the busiest hours, and every weekend uncovered is one you have to explain upstairs.",
        member: "Each weekend shift is a day off you do not get back.",
      },
    },
    {
      id: "closing_shifts",
      label: "Closing shifts",
      description: "How many closing shifts the Member works per week.",
      type: "member_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "cs",
        ["1 per week", "2 per week", "3 per week", "4 per week"],
        MEMBER_POINTS,
      ),
      rationale: {
        leader:
          "Every close the Member does not take is one you have to cover or leave to someone less experienced.",
        member:
          "Closes run late, and the more of them there are the less of your evenings are your own.",
      },
    },
  ],

  roleBriefs: {
    leader: {
      title: "Store Manager",
      organizationalPosition:
        "You manage this coffee and bakery shop and you set the schedule. After the negotiation you decide the Member's recommended performance bonus (up to £1) — and the Member writes an upward evaluation of you that goes to the district manager. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "Head office rates you as a manager whose plans are precise, and the team sees you the same way. Now the regular schedule for the next quarter — twelve weeks — has to be settled with your senior staff member.\n\nWhat matters most to you is weekend cover: weekends are what the shop lives on. There is something only you know. Last month you got the weekend demand forecast wrong twice and had to ask another store's manager for emergency help. The district manager knows about it, and told you that if the same problem repeats it goes into your operations review. That is why this quarter's weekends cannot fall apart — and why, if the weekends are covered, you can afford to cut the closing shifts back.\n\nSaying this out loud would make it believable why weekend cover is urgent. But after the negotiation the Member writes an upward evaluation of you, guided to weigh the judgement and operational competence they saw — and a forecast you got wrong twice can read as a manager who cannot plan.",
      objectives: [
        "Get as many weekend shifts covered as you can.",
        "If weekends are covered, closing shifts are something you can give ground on.",
      ],
      requirementNote:
        "Weekend cover is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like a manager who cannot plan — and the Member's upward evaluation of you is guided to weigh exactly that.",
      reasonCards: [
        work(
          "a_wr_l",
          "weekend_shifts",
          "Weekend peaks need experienced cover. This quarter, weekend coverage is the one condition I most urgently need.",
        ),
        sensitive(
          "a_sb_l",
          "weekend_shifts",
          "forecast_misses",
          "The truth is, I got the weekend demand forecast wrong twice last month and had to ask another store's manager for emergency cover. The district manager knows, and if it happens again it goes into my operations review. If the weekends fall apart this quarter, my ability to run this store is in question.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the schedule falls back to the default rota and you receive your fallback score of 600 points.",
    },

    member: {
      title: "Senior Staff",
      organizationalPosition:
        "You are the senior staff member here — the one the manager trusts to run the close alone. After the negotiation the manager decides your recommended performance bonus (up to £1) — and you write an upward evaluation of the manager that goes to the district manager. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "The manager knows you as the senior who can be trusted with the close alone — including the new closing reconciliation. Now the regular schedule for the next quarter — twelve weeks — has to be settled with the manager.\n\nWhat matters most to you is bringing the closing shifts down. There is something the manager does not know. You still cannot handle the new closing reconciliation on your own: you made errors twice last month, and a coworker helped you fix them quietly. That is why more closes are a risk you cannot take — and why, if the closes come down, you can take on more weekend work; the weekend day shifts never touch the closing till.\n\nSaying this out loud would make it believable why the closes must come down. But after the negotiation the manager decides your bonus, guided to weigh the work reliability they saw — and not managing the close alone can read as a senior who cannot be trusted with it.",
      objectives: [
        "Get the number of closing shifts down as far as you can.",
        "If the closes come down, weekend shifts are something you can take on more of.",
      ],
      requirementNote:
        "Fewer closing shifts is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like a senior who cannot be trusted with the close — and the manager's bonus decision is guided to weigh exactly that.",
      reasonCards: [
        work(
          "a_wr_m",
          "closing_shifts",
          "The day after back-to-back closes, mistakes at open get much more likely. This quarter, bringing the closing shifts down is the condition that matters most to me.",
        ),
        sensitive(
          "a_sb_m",
          "closing_shifts",
          "closing_procedure",
          "The truth is, I still can't handle the new closing reconciliation on my own. I made errors twice last month and a coworker helped me fix them quietly. You've trusted me to run the close alone — but if my closes go up from here, I can't promise the next mistake stays small.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the schedule falls back to the default rota and you receive your fallback score of 600 points.",
    },
  },
};

// ---------------------------------------------------------------------------
// Task B — The Holiday Season Schedule (4 weeks)
//
// Structurally identical to Task A: same payoff spine, same thresholds, the
// same two-issue shape. The surface changes, and the SB incidents are
// DIFFERENT from Task A's on purpose — each task's counterpart is a different
// participant, and the same confession twice over would be a tell (Ver.2.12
// §3.5, change log).
// ---------------------------------------------------------------------------

const TASK_B: NegotiationTask = {
  id: "task_b",
  title: "The Holiday Season Schedule",
  reservationPoints: RESERVATION_POINTS,
  requirementIssueId: {
    leader: "peak_daytime",
    member: "double_shifts",
  },
  publicBrief:
    "You both work at the same coffee and bakery shop, and the four weeks of the year-end holiday rush have to be scheduled. The Leader is the store manager and the Member is the senior staff member. Two things have to be agreed: how many extra daytime shifts during the peak, and how many long double shifts. Neither of you can set them alone. The extra daytime shifts and the evening doubles are separate slots and never collide.",

  issues: [
    {
      id: "peak_daytime",
      label: "Extra peak daytime shifts",
      description:
        "How many extra daytime shifts the Member works during the four peak weeks.",
      type: "leader_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "pd",
        ["4 shifts", "3 shifts", "2 shifts", "1 shift"],
        LEADER_POINTS,
      ),
      rationale: {
        leader:
          "The peak daytime hours are where the season's takings are made or missed.",
        member:
          "Every extra daytime shift is time out of an already full four weeks.",
      },
    },
    {
      id: "double_shifts",
      label: "Double shifts",
      description:
        "How many long double shifts the Member works per week during the peak.",
      type: "member_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "ds",
        ["1 per week", "2 per week", "3 per week", "4 per week"],
        MEMBER_POINTS,
      ),
      rationale: {
        leader:
          "Doubles are how the long days get covered without pulling in someone new mid-season.",
        member:
          "A double runs from open to close, and there is no evening left after one.",
      },
    },
  ],

  roleBriefs: {
    leader: {
      title: "Store Manager",
      organizationalPosition:
        "You manage this coffee and bakery shop and you set the schedule. After the negotiation you decide the Member's recommended performance bonus (up to £1) — and the Member writes an upward evaluation of you that goes to the district manager. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "Head office rates you as a manager who staffs the floor right, and the team sees you the same way. Now the four holiday-rush weeks — the busiest of the year — have to be scheduled with your senior staff member.\n\nWhat matters most to you is the daytime peak: it is where the season's takings are made. There is something only you know. Last holiday season you staffed the daytime peak too thin, and customer complaints reached head office. That record stands, and this season's daytime operation has been made an item in your year-end review. That is why the daytime cannot come up short again — and why, if the daytime is covered, you can afford to cut the doubles back.\n\nSaying this out loud would make it believable why daytime cover is urgent. But after the negotiation the Member writes an upward evaluation of you, guided to weigh the judgement and operational competence they saw — and complaints that reached head office can read as a manager who cannot staff a floor.",
      objectives: [
        "Get as many extra peak daytime shifts covered as you can.",
        "If the daytime cover is there, double shifts are something you can give ground on.",
      ],
      requirementNote:
        "Peak daytime cover is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like a manager who cannot staff a floor — and the Member's upward evaluation of you is guided to weigh exactly that.",
      reasonCards: [
        work(
          "b_wr_l",
          "peak_daytime",
          "The daytime peak is where the season's sales are made. For these four weeks, daytime coverage is the one condition I most urgently need.",
        ),
        sensitive(
          "b_sb_l",
          "peak_daytime",
          "thin_staffing",
          "The truth is, last holiday season I staffed the daytime peak too thin and customer complaints reached head office. That record stands, and this season's daytime operation is now an item in my year-end review. If the daytime falls short again, I have no excuse left.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the season falls back to the default rota and you receive your fallback score of 600 points.",
    },

    member: {
      title: "Senior Staff",
      organizationalPosition:
        "You are the senior staff member here — the one the manager counts on through the rush. After the negotiation the manager decides your recommended performance bonus (up to £1) — and you write an upward evaluation of the manager that goes to the district manager. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "The manager knows you as the senior who stays sharp through the longest days — the one whose numbers can be trusted at the end of a shift. Now the four holiday-rush weeks have to be scheduled with the manager.\n\nWhat matters most to you is bringing the double shifts down. There is something the manager does not know. Late in a double last month you entered the inventory wrong twice; a coworker caught it, so it never reached the manager. That is why more doubles are a risk you cannot take — and why, if the doubles come down, you can take on more of the daytime shifts; the daytime slots end long before the counts are done.\n\nSaying this out loud would make it believable why the doubles must come down. But after the negotiation the manager decides your bonus, guided to weigh the work reliability they saw — and mistakes a coworker had to catch can read as a senior whose numbers cannot be trusted.",
      objectives: [
        "Get the number of double shifts down as far as you can.",
        "If the doubles come down, extra daytime shifts are something you can take on more of.",
      ],
      requirementNote:
        "Fewer double shifts is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like a senior whose numbers cannot be trusted — and the manager's bonus decision is guided to weigh exactly that.",
      reasonCards: [
        work(
          "b_wr_m",
          "double_shifts",
          "When doubles stack up, my focus drops badly toward the end of a shift. For these four weeks, bringing the doubles down is the condition that matters most to me.",
        ),
        sensitive(
          "b_sb_m",
          "double_shifts",
          "inventory_errors",
          "The truth is, late in a double last month I entered the inventory wrong twice. A coworker caught it, so it never reached you. If the doubles keep coming, I'm afraid the next mistake will be one nobody catches.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the season falls back to the default rota and you receive your fallback score of 600 points.",
    },
  },
};

export const PRACTICE_TASK: NegotiationTask = {
  id: "practice",
  title: "Practice — The Staff Room",
  reservationPoints: 200,
  requirementIssueId: { leader: "practice_date", member: "practice_venue" },
  publicBrief:
    "This is a practice round at the same coffee shop, on two small things nobody has strong feelings about: when to do the annual deep clean, and where to put the new coffee machine. Nothing here counts towards your results — it is only to get familiar with reading a point sheet and finding a trade.",
  issues: [
    {
      id: "practice_date",
      label: "Deep clean week",
      description: "Which week the annual deep clean happens.",
      type: "leader_priority",
      options: [
        { id: "pd1", label: "Next week", points: { leader: 600, member: 0 } },
        { id: "pd2", label: "In two weeks", points: { leader: 400, member: 100 } },
        { id: "pd3", label: "In three weeks", points: { leader: 200, member: 200 } },
        { id: "pd4", label: "In a month", points: { leader: 0, member: 300 } },
      ],
      rationale: {
        leader: "You want it done before the quarterly inspection.",
        member: "A later week is easier for you, but not by much.",
      },
    },
    {
      id: "practice_venue",
      label: "New machine's spot",
      description: "Where the new coffee machine goes.",
      type: "member_priority",
      options: [
        { id: "pv1", label: "Behind the counter", points: { leader: 0, member: 600 } },
        { id: "pv2", label: "End of the counter", points: { leader: 100, member: 400 } },
        { id: "pv3", label: "Side bench", points: { leader: 200, member: 200 } },
        { id: "pv4", label: "Front window", points: { leader: 300, member: 0 } },
      ],
      rationale: {
        leader: "Out front, customers can see it being used.",
        member: "Behind the counter is the one spot you can reach mid-rush.",
      },
    },
  ],
  roleBriefs: {
    leader: {
      title: "Store Manager",
      organizationalPosition: "You are sorting out both of these.",
      roleStory:
        "You would like this settled quickly. The deep-clean week matters to you far more than where the machine goes — which is worth noticing, because the other side feels the opposite way.",
      objectives: [
        "Get the deep clean done early.",
        "Where the machine goes matters less to you — so it is what you can trade.",
      ],
      requirementNote: "Nothing here counts. Practise reading the point sheet.",
      disclosureRisk: "",
      reasonCards: [],
      batnaSummary: "If you cannot agree, both are left as they are.",
    },
    member: {
      title: "Senior Staff",
      organizationalPosition: "You work the counter every day.",
      roleStory:
        "Where the machine goes matters to you far more than the deep-clean week does — which is worth noticing, because the other side feels the opposite way.",
      objectives: [
        "Keep the machine within reach of the counter.",
        "The deep-clean week matters less to you — so it is what you can trade.",
      ],
      requirementNote: "Nothing here counts. Practise reading the point sheet.",
      disclosureRisk: "",
      reasonCards: [],
      batnaSummary: "If you cannot agree, both are left as they are.",
    },
  },
};

// ---------------------------------------------------------------------------
// Lookups and scoring
// ---------------------------------------------------------------------------

const TASKS: Record<TaskId, NegotiationTask> = {
  task_a: TASK_A,
  task_b: TASK_B,
};

export function getTask(id: TaskId): NegotiationTask {
  return TASKS[id];
}

/** The issue carrying this role's own socially costly requirement. */
export function requirementIssue(task: NegotiationTask, role: Role) {
  return task.issues.find((i) => i.id === task.requirementIssueId[role])!;
}

/** The issue carrying the OTHER side's requirement — the logroll's currency. */
export function counterRequirementIssue(task: NegotiationTask, role: Role) {
  return requirementIssue(task, role === "leader" ? "member" : "leader");
}

/** Position of an option within its issue, 0-based. */
export function optionIndex(
  task: NegotiationTask,
  issueId: string,
  optionId: string | null,
): number {
  if (!optionId) return -1;
  const issue = task.issues.find((i) => i.id === issueId);
  return issue ? issue.options.findIndex((o) => o.id === optionId) : -1;
}

/**
 * Does this level clear the given role's requirement threshold?
 *
 * Options 1-2 preserve it; 3-4 do not. Used by the review-screen coding;
 * the counterpart's acceptance judgement uses the credibility ladder
 * (`lib/negotiation/machine`), not this.
 */
export function preservesRequirement(
  task: NegotiationTask,
  role: Role,
  optionId: string | null,
): boolean {
  const issue = requirementIssue(task, role);
  const index = optionIndex(task, issue.id, optionId);
  if (index < 0) return false;
  return index <= (issue.requirementThresholdIndex ?? 1);
}

/** What a complete package is worth to one role. */
export function scorePackage(
  task: NegotiationTask,
  pkg: Record<string, string | null | undefined>,
  role: Role,
): number {
  return task.issues.reduce((sum, issue) => {
    const option = issue.options.find((o) => o.id === pkg[issue.id]);
    return sum + (option ? option.points[role] : 0);
  }, 0);
}

/** Both sides' totals plus the joint value, for outcome coding. */
export function packageValue(
  task: NegotiationTask,
  pkg: Record<string, string | null | undefined>,
) {
  const leader = scorePackage(task, pkg, "leader");
  const member = scorePackage(task, pkg, "member");
  return { leader, member, joint: leader + member };
}

/** This role's options on an issue, best for THEM first. */
export function rankedOptions(
  task: NegotiationTask,
  issueId: string,
  role: Role,
) {
  const issue = task.issues.find((i) => i.id === issueId)!;
  return [...issue.options].sort((a, b) => b.points[role] - a.points[role]);
}

/**
 * The counterpart's opening — its own best package on every issue (Ver.2.12
 * §6.3 Opening: own core best + participant core worst, which with two
 * mirrored issues is the same thing). Fixed, so every participant meets the
 * same opening.
 */
export function counterpartOpening(
  task: NegotiationTask,
  counterpartRole: Role,
): Record<string, string> {
  return Object.fromEntries(
    task.issues.map((issue) => [
      issue.id,
      rankedOptions(task, issue.id, counterpartRole)[0].id,
    ]),
  );
}

/** Every reason card available to one role in one task. */
export function reasonCards(task: NegotiationTask, role: Role): ReasonCard[] {
  return task.roleBriefs[role].reasonCards;
}

export function reasonCard(
  task: NegotiationTask,
  role: Role,
  cardId: string,
): ReasonCard | undefined {
  return reasonCards(task, role).find((c) => c.id === cardId);
}

/** One role's card of one layer — the deck holds exactly one of each. */
export function cardOfLayer(
  task: NegotiationTask,
  role: Role,
  layer: ReasonCard["layer"],
): ReasonCard | undefined {
  return reasonCards(task, role).find((c) => c.layer === layer);
}

/**
 * The default check state (Design §7): the work reason on, the sensitive one
 * off.
 *
 * The defaults are load-bearing and must not be "improved". Pre-checking the
 * sensitive card would manufacture the disclosure this study is trying to
 * measure; pre-checking nothing would make voicing the work reason feel like a
 * demand rather than a floor.
 */
export function defaultAuthorizedReasonIds(
  task: NegotiationTask,
  role: Role,
): string[] {
  return reasonCards(task, role)
    .filter((c) => c.layer === "work")
    .map((c) => c.id);
}

/**
 * `REASON-SCOPE` (Design §9.3) — what the participant was willing to hand
 * over: whether the SB was checked, and whether the default-on WR was
 * UNchecked (both are decisions; the second is rare and worth seeing).
 */
export function reasonScope(
  task: NegotiationTask,
  role: Role,
  authorizedIds: string[],
) {
  const cards = reasonCards(task, role).filter((c) =>
    authorizedIds.includes(c.id),
  );
  const sensitiveCards = cards.filter((c) => c.layer === "sensitive");
  const coreIssueId = task.requirementIssueId[role];
  return {
    totalChecked: cards.length,
    workChecked: cards.length - sensitiveCards.length,
    sensitiveChecked: sensitiveCards.length,
    coreIssueSensitive: sensitiveCards.some((c) => c.issueId === coreIssueId),
    byIssue: Object.fromEntries(
      task.issues.map((issue) => [
        issue.id,
        {
          work: cards.some(
            (c) => c.issueId === issue.id && c.layer === "work",
          ),
          sensitive: sensitiveCards.some((c) => c.issueId === issue.id),
        },
      ]),
    ),
  };
}

// ---------------------------------------------------------------------------
// Explorer role-plausible reason pool (Design §6.6)
// ---------------------------------------------------------------------------

/**
 * One pre-approved argument the Explorer Proxy may add, tagged with the issue
 * it argues about — or `issueId: null` for the one exchange argument, which
 * links terms rather than arguing for one.
 */
export interface PoolReason {
  issueId: string | null;
  text: string;
}

/**
 * The pre-approved arguments an Explorer Proxy may add on top of the cards its
 * principal checked — things anyone in this role could reasonably say.
 *
 * Ver.2.12 §6.6 fixes this at TWO per role per task: one supporting the role's
 * own core issue, and one exchange argument (`issueId: null`). They are
 * WR-grade general arguments and NEVER open the SB tier — the credibility
 * ladder reads only the principal's own cards. They are spent on different
 * issues at different stages, which is why they are not interchangeable.
 *
 * WHY THIS IS A FIXED LIST AND NOT GENERATED. The Explorer policy is defined
 * by source ambiguity, not by inventiveness: a pool item must be plausible for
 * the role and true of nobody in particular. A model asked to improvise would
 * eventually assert a policy, a client demand, or a past mistake that does not
 * exist, and that is fabrication rather than exploration.
 *
 * Never rendered with a source label — see Design §6.6.
 */
export const PLAUSIBLE_REASON_POOL: Record<
  TaskId,
  Record<Role, PoolReason[]>
> = {
  task_a: {
    leader: [
      {
        issueId: "weekend_shifts",
        text: "Steady service through the weekend peak is the baseline any store is judged on.",
      },
      {
        issueId: null,
        text: "If the weekends are settled, there is room to move on the closing shifts.",
      },
    ],
    member: [
      {
        issueId: "closing_shifts",
        text: "Recovery time between shifts reducing mistakes is a standard operating principle.",
      },
      {
        issueId: null,
        text: "If the closes are settled, there is room to move on the weekend count.",
      },
    ],
  },
  task_b: {
    leader: [
      {
        issueId: "peak_daytime",
        text: "Peak coverage in the busiest weeks feeds directly into the season's results.",
      },
      {
        issueId: null,
        text: "If that period is settled, there is room to move on the double shifts.",
      },
    ],
    member: [
      {
        issueId: "double_shifts",
        text: "A recovery day between long shifts is standard safety practice.",
      },
      {
        issueId: null,
        text: "If the doubles are settled, there is room to move on the peak-season shifts.",
      },
    ],
  },
};

export function plausibleReasons(
  taskId: ScenarioId,
  role: Role,
): PoolReason[] {
  if (taskId === "practice") return [];
  return PLAUSIBLE_REASON_POOL[taskId][role];
}
