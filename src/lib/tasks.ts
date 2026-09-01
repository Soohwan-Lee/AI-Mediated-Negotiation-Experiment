/**
 * The two negotiation scenarios, from Experimental Design Ver.2.5 §5-§7.
 *
 * Both tasks share one latent payoff structure and differ only on the surface,
 * so Task A and Task B are interchangeable within a participant. Three issues,
 * four options each:
 *
 *   Leader-priority integrative  3000 / 2000 / 1000 / 0   (Member: 0..1500)
 *   Member-priority integrative  3000 / 2000 / 1000 / 0   (Leader: 0..1500)
 *   Distributive                 1800 / 1200 /  600 / 0   (constant sum 1,800)
 *
 * Individual range 0-6,300. Joint range 4,800-7,800. Reservation 2,500 each,
 * so 24 of the 64 packages clear both fallbacks, and 14 of those also hold
 * BOTH requirements — protecting your requirement and reaching agreement are
 * compatible by construction, and so is protecting both at once. (Under
 * ver.1.8's Member-only design the equivalent count was 17; it drops to 14
 * because a package now has to clear two thresholds instead of one.)
 *
 * ROLE SYMMETRY IS THE ver.2.4 CHANGE. Each role holds a socially costly
 * requirement on its own priority issue, each worth 3,000 — the Leader wants
 * review checkpoints, the Member wants protected time. A cheap requirement
 * could be given up as a sensible low-priority concession, which is exactly
 * what this study has to distinguish from withdrawal under evaluative
 * pressure, so both are expensive on purpose.
 *
 * PER-ISSUE REASON CARDS ARE THE ver.2.5 CHANGE. Each role now holds one
 * Working Reason (WR) and one Sensitive Background (SB) per issue — six cards
 * spanning all three terms, coded `{task}-I{n}-{WR|SB}-{L|M}` in the design
 * and `a_i1_wr_l`-style ids here — instead of six cards about the requirement
 * issue alone. The three SBs per role are three facets of ONE backstory
 * (Leader: past fault / competence gap / over-promise · Member: evaluation
 * anxiety / fatigue-caused fault / unreported state), and the role story
 * weaves all three in so no card arrives out of nowhere. Everything that
 * reads a card — the reason-linked acceptance rule, the per-issue reason
 * budget, REASON-SCOPE — now keys on the card's `issueId`.
 *
 * The numbers are working values pending pilot (Design §12); the shapes are
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
 * Leader-priority integrative (Design Ver.2.11 §3.2). Big for the Leader,
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
 * Individual maximum, used for the normalized bonus and the value bars.
 *
 * With two issues it is 3,000 (own priority) + 900 (the other side's, at the
 * level they least want) = 3,900. The number a participant can actually reach
 * while the counterpart still agrees is 3,000 — the full logroll — because
 * every agreement path holds the counterpart's own priority at its best
 * option (Ver.2.11 §3.3).
 */
export const MAX_INDIVIDUAL_POINTS = 3900;

/**
 * Fallback if nothing is agreed. Working value — Ver.2.11 §3.2 sets 600, and
 * §13.2 lists it as a value to be fixed at pilot.
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
 * A sensitive background card.
 *
 * TWO WRITING RULES ADDED IN VER.2.6 (§5), both easy to undo by "tidying" the
 * wording, and both of which broke real cards before they were added:
 *
 *  - SPEAKABILITY. The text is what the proxy says ALOUD to the other side, so
 *    it has to be a first-person disclosure that works as speech. Five cards
 *    ended "that it was my call is something only you know" — a description of
 *    the fact being private, which is incoherent the moment it is spoken to
 *    someone. The private-state framing belongs in the role STORY, where it is
 *    narration and still reads correctly; the card takes the confessional form
 *    ("something you have never told anyone"). Both phrasings survive in this
 *    file for exactly that reason — the backstory keeps "only you know", the
 *    cards do not.
 *
 *  - ARGUMENT LINK. Disclosing an SB has to function as a work argument for
 *    the requirement on its own: incident → risk of recurrence → the ask. A
 *    card that is only a feeling ("more review meetings is a prospect you
 *    dread") gives the proxy nothing to reframe into an interest, so the
 *    depersonalisation rule has nothing to bite on and the guardrail strips
 *    the message. The two evaluation-anxiety cards therefore carry the
 *    consequence for the work as well as the feeling.
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
// Task A — High-Visibility AI Pilot
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
    "You both work at the same coffee and bakery shop. The Leader is the store manager and the Member is the senior staff member — the only one who can close the shop alone. The two of you are setting the regular schedule for the next quarter, twelve weeks. Two things have to be agreed: how many weekend shifts and how many closing shifts. Neither of you can set them alone.",
  standardizedChallenge: {
    // Sent BY the Member TO the Leader, so it names the Leader's requirement.
    // Presupposes no level: the challenged position is whatever the participant
    // actually asked for, and a fixed number misquotes anyone who opened lower.
    leader:
      "That many weekends in a row is a lot to ask. Could we bring it down, and I'll give you room somewhere else?",
    // Sent BY the Leader TO the Member.
    member:
      "Cutting the closes back that far is difficult when you're the only one who can close alone. Could we keep more of them, and adjust the other term instead?",
  },

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
        member:
          "Each weekend shift is a day off you do not get back.",
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
        "You manage this coffee and bakery shop. You set the schedule, and after each schedule is agreed you decide the Member's performance bonus.",
      roleStory:
        "Weekends are what the shop lives on, and you need experienced cover on them.\n\nThere is something you have not told the team. At last month's Saturday operations review you were given a written warning over staffing planning. If the same problem comes up again, a performance review of your own gets started. That is why weekend cover matters as much as it does — and why, if you can get it, you can afford to cut the closing shifts back.\n\nThe difficulty is that saying so out loud could make you look like a manager who cannot plan staffing. Now the two terms — weekend shifts and closing shifts — are yours to negotiate with the Member.",
      objectives: [
        "Get as many weekend shifts covered as you can.",
        "If weekends are covered, closing shifts are something you can give ground on.",
      ],
      requirementNote:
        "Weekend cover is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like a manager who cannot plan staffing.",
      reasonCards: [
        work(
          "a_i1_wr_l",
          "weekend_shifts",
          "Weekend peaks need experienced cover. If the weekends are covered, the closing shifts can come down.",
        ),
        sensitive(
          "a_i1_sb_l",
          "weekend_shifts",
          "staffing_warning",
          "At last month's Saturday operations review you were given a written warning over staffing planning. If it happens again a performance review of your own gets started. So the weekend cover you have to have — but the closes you can cut back.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the schedule falls back to the default rota and you receive your fallback score of 600 points.",
    },

    member: {
      title: "Senior Staff",
      organizationalPosition:
        "You are the senior staff member here, and the only one who can close the shop on your own. The manager you are negotiating with decides your performance bonus after each schedule is agreed.",
      roleStory:
        "What matters most to you is getting the closing shifts down.\n\nThere is something the manager does not know. To cover your living costs you have taken a second job at another shop on weekday evenings. The closes clash with it directly; the weekends do not clash at all. That is why cutting the closes matters as much as it does — and why, if you can get that, you can take on more weekend work.\n\nThe difficulty is that saying so out loud could make you look like someone who does not put this shop first. Now the two terms — weekend shifts and closing shifts — are yours to negotiate with the manager.",
      objectives: [
        "Get the number of closing shifts down as far as you can.",
        "If the closes come down, weekend shifts are something you can take on more of.",
      ],
      requirementNote:
        "Fewer closing shifts is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like someone who does not put this shop first.",
      reasonCards: [
        work(
          "a_i2_wr_m",
          "closing_shifts",
          "Closing back-to-back makes mistakes more likely the next day. If the closes come down, I can take on more weekend work.",
        ),
        sensitive(
          "a_i2_sb_m",
          "closing_shifts",
          "second_job",
          "To cover your living costs you have a second job at another shop on weekday evenings. The closes clash with it; the weekends do not. So if the closes come down, you can take on more weekend work.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the schedule falls back to the default rota and you receive your fallback score of 600 points.",
    },
  },
};

// ---------------------------------------------------------------------------
// Task B — Peak-Season Schedule
//
// Structurally identical to Task A: same payoff spine, same thresholds, the
// same two-issue shape. Only the surface changes, and the SB cards are the
// SAME BACKSTORY seen at a different moment — the manager's staffing exposure
// and the senior's second job — so nothing arrives unannounced in whichever
// task a participant meets second (Ver.2.11 §3.2).
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
    "It is the same coffee and bakery shop, and now the four weeks of the year-end holiday rush have to be scheduled. The Leader is the store manager and the Member is the senior staff member. Two things have to be agreed: how many extra daytime shifts during the peak, and how many long double shifts. Neither of you can set them alone.",
  standardizedChallenge: {
    leader:
      "That many extra daytime shifts through the busiest weeks is a lot to ask. Could we bring it down, and I'll give you room on the other one?",
    member:
      "Cutting the doubles back that far is difficult in the busiest weeks of the year. Could we keep more of them, and adjust the other term instead?",
  },

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
        "You manage this coffee and bakery shop. You set the schedule, and after each schedule is agreed you decide the Member's performance bonus.",
      roleStory:
        "The four weeks of the holiday rush are the busiest of the year, and the peak daytime hours are what the season turns on.\n\nThere is something you have not told the team. Before checking who was actually available, you promised head office a peak coverage target. Falling short of it goes into your year-end review. That is why the extra daytime shifts matter as much as they do — and why, if you can get them, you can afford to cut the doubles back.\n\nThe difficulty is that saying so out loud could make you look like someone who promises before checking. Now the two terms — extra daytime shifts and double shifts — are yours to negotiate with the Member.",
      objectives: [
        "Get as many extra peak daytime shifts covered as you can.",
        "If the daytime cover is there, double shifts are something you can give ground on.",
      ],
      requirementNote:
        "Peak daytime cover is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like someone who promises before checking.",
      reasonCards: [
        work(
          "b_i1_wr_l",
          "peak_daytime",
          "Peak daytime hours need experienced cover. If the daytime is covered, the doubles can come down.",
        ),
        sensitive(
          "b_i1_sb_l",
          "peak_daytime",
          "overpromise",
          "Before checking who was actually available you promised head office a peak coverage target, and falling short goes into your year-end review. So the daytime cover you have to have — but the doubles you can cut back.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the season falls back to the default rota and you receive your fallback score of 600 points.",
    },

    member: {
      title: "Senior Staff",
      organizationalPosition:
        "You are the senior staff member here, and the only one who can close the shop on your own. The manager you are negotiating with decides your performance bonus after each schedule is agreed.",
      roleStory:
        "What matters most to you across these four weeks is getting the double shifts down.\n\nThere is something the manager does not know. The second job you have on weekday evenings is at its busiest over the holidays. The doubles clash with it directly; the extra daytime shifts do not clash at all. That is why cutting the doubles matters as much as it does — and why, if you can get that, you can take on more of the daytime work.\n\nThe difficulty is that saying so out loud could make you look like someone who puts another job first in the busiest season. Now the two terms — extra daytime shifts and double shifts — are yours to negotiate with the manager.",
      objectives: [
        "Get the number of double shifts down as far as you can.",
        "If the doubles come down, extra daytime shifts are something you can take on more of.",
      ],
      requirementNote:
        "Fewer double shifts is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like someone who puts another job first in the busiest season.",
      reasonCards: [
        work(
          "b_i2_wr_m",
          "double_shifts",
          "Frequent doubles make recovery hard and mistakes more likely. If the doubles come down, I can take on more of the daytime shifts.",
        ),
        sensitive(
          "b_i2_sb_m",
          "double_shifts",
          "second_job",
          "The second job you have on weekday evenings is at its busiest over the holidays. The doubles clash with it; the extra daytime shifts do not. So if the doubles come down, you can take on more daytime work.",
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
  standardizedChallenge: {
    leader: "Could we do the deep clean a bit later instead?",
    member: "Could we keep the new machine somewhere easier to reach?",
  },
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
 * The binary the trajectory is coded from (Design §9.3.1). Options 1-2
 * preserve it; 3-4 do not. Reported per stage, never summed.
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

/** Both sides' totals plus the joint value, for the review screen. */
export function packageValue(
  task: NegotiationTask,
  pkg: Record<string, string | null | undefined>,
) {
  const leader = scorePackage(task, pkg, "leader");
  const member = scorePackage(task, pkg, "member");
  return { leader, member, joint: leader + member };
}

/**
 * The counterpart's opening — its own best package on every issue (Design §4
 * stage 1). Fixed, so every participant meets the same opening.
 */
export function counterpartOpening(
  task: NegotiationTask,
  counterpartRole: Role,
): Record<string, string> {
  return Object.fromEntries(
    task.issues.map((issue) => {
      const best = [...issue.options].sort(
        (a, b) => b.points[counterpartRole] - a.points[counterpartRole],
      )[0];
      return [issue.id, best.id];
    }),
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

/**
 * The default check state (Design §7): every work reason on, every sensitive
 * one off.
 *
 * The defaults are load-bearing and must not be "improved". Pre-checking a
 * sensitive card would manufacture the disclosure this study is trying to
 * measure; pre-checking none would make the minimum-one-work-reason rule feel
 * like a demand rather than a floor.
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
 * `REASON-SCOPE` (Design §9.3.1, ver.2.5) — how much of their own case the
 * participant was willing to hand over, as per-issue delegation width: how
 * many sensitive cards (0-3), whether the one on their OWN requirement issue
 * was among them, and the per-issue pattern. Replaces the pre-2.5
 * `deepestPhase` shape; the two are not comparable in analysis.
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
// Explorer role-plausible reason pool (Design §7)
// ---------------------------------------------------------------------------

/**
 * One pre-approved argument the Explorer Proxy may add, tagged with the issue
 * it argues about — or `issueId: null` for the one exchange argument, which
 * links terms rather than arguing for one (Design §7 ver.2.5 "issue별 재편").
 */
export interface PoolReason {
  issueId: string | null;
  text: string;
}

/**
 * The pre-approved arguments an Explorer Proxy may add on top of the cards its
 * principal checked — things anyone in this role could reasonably say.
 *
 * Ver.2.11 §6.6 fixes this at TWO per role per task: one supporting the role's
 * own core issue, and one exchange argument (`issueId: null`) that links the
 * two terms rather than arguing for either. They are spent on different
 * issues at different stages, which is why they are not interchangeable —
 * pointing both at the core issue silently halves the manipulation, because
 * the second request finds nothing and no log shows it.
 *
 * WHY THIS IS A FIXED LIST AND NOT GENERATED. The Explorer policy is defined
 * by source ambiguity, not by inventiveness: a pool item must be plausible for
 * the role and true of nobody in particular, so that a receiver cannot tell
 * which reasons came from the person. A model asked to improvise would
 * eventually assert a policy, a client demand, or a past mistake that does not
 * exist, and that is fabrication rather than exploration.
 *
 * Never rendered with a source label — see Design §7 "이유 출처 표시".
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
        text: "A rest day between long shifts is standard safety practice.",
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
