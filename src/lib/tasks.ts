/**
 * The two negotiation scenarios, from Experimental Design Ver.2.4 §5-§7.
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

/** Leader-priority integrative: big for the Leader, cheap for the Member. */
const LEADER_POINTS: Array<Record<Role, number>> = [
  { leader: 3000, member: 0 },
  { leader: 2000, member: 500 },
  { leader: 1000, member: 1000 },
  { leader: 0, member: 1500 },
];

/** Member-priority integrative: the mirror image. */
const MEMBER_POINTS: Array<Record<Role, number>> = [
  { leader: 0, member: 3000 },
  { leader: 500, member: 2000 },
  { leader: 1000, member: 1000 },
  { leader: 1500, member: 0 },
];

/** Distributive: constant sum 1,800, so a gain for one is a loss for the other. */
const TIMING_POINTS: Array<Record<Role, number>> = [
  { leader: 1800, member: 0 },
  { leader: 1200, member: 600 },
  { leader: 600, member: 1200 },
  { leader: 0, member: 1800 },
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

/** Individual maximum, used for the normalized bonus and the value bars. */
export const MAX_INDIVIDUAL_POINTS = 6300;

/** Fallback if nothing is agreed. Working value — Design §12. */
export const RESERVATION_POINTS = 2500;

/**
 * Both requirements sit at Options 1-2 on their own issue. Stated once here
 * rather than per issue, because the two tasks must not drift apart: an
 * asymmetric threshold would make one role's requirement structurally easier
 * to hold than the other's, which is the one thing role symmetry cannot
 * survive.
 */
const REQUIREMENT_THRESHOLD_INDEX = 1;

function work(id: string, text: string): ReasonCard {
  return { id, layer: "work", text };
}

function sensitive(
  id: string,
  phase: "incident" | "undisclosed" | "worry",
  text: string,
): ReasonCard {
  return { id, layer: "sensitive", phase, text };
}

// ---------------------------------------------------------------------------
// Task A — High-Visibility AI Pilot
// ---------------------------------------------------------------------------

const TASK_A: NegotiationTask = {
  id: "task_a",
  title: "High-Visibility AI Pilot",
  reservationPoints: RESERVATION_POINTS,
  requirementIssueId: {
    leader: "quality_reviews",
    member: "focus_afternoons",
  },
  publicBrief:
    "Your company is trialling an AI tool that answers customer questions, with a limited group of real customers. The Leader is responsible for approving the pilot and for its schedule. The Member is responsible for testing the tool and fixing what it gets wrong. Rush the pilot and wrong answers reach customers; delay it and the team misses the date promised to senior management. The two of you have to agree on all three terms — neither of you can set them alone.",
  standardizedChallenge: {
    // Sent BY the Member TO the Leader, so it names the Leader's requirement.
    leader:
      "Four rounds of review feels like a lot of process for a pilot this size. Could we bring it down to two, and I'll give you room somewhere else?",
    // Sent BY the Leader TO the Member.
    member:
      "Blocking out whole afternoons every week is difficult while management is watching this pilot. Could we drop that to one, and adjust another term instead?",
  },

  issues: [
    {
      id: "quality_reviews",
      label: "Quality review checkpoints",
      description:
        "How many formal reviews of the AI's answer quality you hold together before launch.",
      type: "leader_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "qr",
        ["4 reviews", "3 reviews", "2 reviews", "1 review"],
        LEADER_POINTS,
      ),
      rationale: {
        leader:
          "Fewer reviews means more of the responsibility for a customer-facing error lands on you.",
        member: "Each review costs you about half a day of retesting and fixes.",
      },
    },
    {
      id: "focus_afternoons",
      label: "Protected focus afternoons",
      description:
        "How many afternoons a week the Member works on testing with no meetings and no messages.",
      type: "member_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "fa",
        ["3 per week", "2 per week", "1 per week", "None"],
        MEMBER_POINTS,
      ),
      rationale: {
        leader:
          "Someone has to field the urgent questions that arrive during those hours, and it would be you.",
        member:
          "Uninterrupted time is when the testing actually gets done, and when you stop missing things.",
      },
    },
    {
      id: "pilot_start",
      label: "Pilot start",
      description: "Which week the pilot begins.",
      type: "distributive",
      options: options(
        "ps",
        ["Week 4", "Week 5", "Week 6", "Week 7"],
        TIMING_POINTS,
      ),
      rationale: {
        leader:
          "The later this starts, the more the promise you made to management is at risk.",
        member:
          "The earlier this starts, the less time you have to test — which means evening work.",
      },
    },
  ],

  roleBriefs: {
    leader: {
      title: "Project Leader",
      organizationalPosition:
        "You run the customer-support improvement programme. You are accountable for approving this eight-week AI pilot and for its schedule, and when the pilot ends you decide the Member's project rating and bonus.",
      roleStory:
        "There is something you have not told the team. Last time, you approved a small rollout in a hurry, and a bug you skipped over went out to some customers. As far as the team knows it was just \"an update that shipped too fast\" — that it was your approval call is something only you know. Senior management is watching this pilot, and if it happens again the responsibility lands on you. So this time you want at least three quality reviews before anything reaches a customer. The difficulty is that pushing hard for reviews — and especially explaining why — could make you look like a leader who lacks judgement, or who does not trust the Member.",
      objectives: [
        "Hold at least three review checkpoints before launch.",
        "Start the pilot early enough to keep the promise you made to management.",
        "Do not let the pilot go out with an error you could have caught.",
      ],
      requirementNote:
        "At least 3 review checkpoints (Options 1–2) is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like a leader who lacks judgement, or who does not trust the Member.",
      reasonCards: [
        work(
          "a_l_w1",
          "Catching errors before answers reach customers is what protects the pilot's credibility.",
        ),
        work(
          "a_l_w2",
          "Regular reviews surface problems early, when they are still cheap to fix.",
        ),
        work(
          "a_l_w3",
          "A documented review record makes the expansion decision easier to explain to management.",
        ),
        sensitive(
          "a_l_s1",
          "incident",
          "Last time you approved a small rollout in a hurry, and a bug you missed went out to some customers.",
        ),
        sensitive(
          "a_l_s2",
          "undisclosed",
          "The team only knows it as \"an update that shipped too fast\" — that your approval call caused it is something only you know.",
        ),
        sensitive(
          "a_l_s3",
          "worry",
          "Senior management is watching this pilot, and you know that if it happens again the responsibility lands on you.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on all three terms, the project falls back to a limited plan and you receive your fallback score of 2,500 points.",
    },

    member: {
      title: "Team Member",
      organizationalPosition:
        "You do the hands-on work on the customer-support team. You are setting up and testing the tool for this AI pilot. The Leader you are negotiating with decides your project rating and bonus when the pilot ends.",
      roleStory:
        "The last few weeks have been relentless — constant messages, constant interruptions, and evenings spent catching up on what you could not finish during the day. You are running on empty. And there is something you have not told anyone: a while back, in that state, you missed two testing errors. You caught them before launch and fixed them quietly, but you know it was the exhaustion that caused it. You have worked out that two protected afternoons a week would stop it happening again. The difficulty is that explaining why could make you look like someone who cannot handle pressure.",
      objectives: [
        "Protect at least two focus afternoons a week.",
        "Do not end up owning a pilot you cannot test properly.",
        "Finish the pilot with the Leader's assessment intact.",
      ],
      requirementNote:
        "At least 2 protected afternoons per week (Options 1–2) is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like someone who cannot handle pressure, or who is hard to rely on.",
      reasonCards: [
        work(
          "a_m_w1",
          "Setup and testing go faster, with fewer errors, in uninterrupted time.",
        ),
        work(
          "a_m_w2",
          "Batching questions into set hours cuts the cost of switching between tasks.",
        ),
        work(
          "a_m_w3",
          "Predictable focus time is what keeps the schedule without evening catch-up.",
        ),
        sensitive(
          "a_m_s1",
          "incident",
          "The last few weeks of constant messages and evening catch-up have left you badly worn down.",
        ),
        sensitive(
          "a_m_s2",
          "undisclosed",
          "In that state you missed two testing errors. You caught them before launch and fixed them quietly — that exhaustion was the cause is something only you know.",
        ),
        sensitive(
          "a_m_s3",
          "worry",
          "Without protected time, you are afraid the same mistake will happen again.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on all three terms, the project falls back to a limited plan and you receive your fallback score of 2,500 points.",
    },
  },
};

// ---------------------------------------------------------------------------
// Task B — Major Client Launch
// ---------------------------------------------------------------------------

const TASK_B: NegotiationTask = {
  id: "task_b",
  title: "Major Client Launch",
  reservationPoints: RESERVATION_POINTS,
  requirementIssueId: {
    leader: "rehearsal_rounds",
    member: "evening_shifts",
  },
  publicBrief:
    "Your company is launching a new service for a major client whose contract is up for renewal. The Leader is responsible for the client relationship and for how the launch goes. The Member is responsible for setting the service up and supporting it in the early weeks. The two of you have to agree on all three terms — neither of you can set them alone.",
  standardizedChallenge: {
    leader:
      "Four full rehearsals is a lot of everyone's time for one demo. Could we cut that to two, and I'll give you room somewhere else?",
    member:
      "Keeping evening cover down to one night a week leaves us thin during the launch. Could we take that up to three, and adjust another term instead?",
  },

  issues: [
    {
      id: "rehearsal_rounds",
      label: "Client rehearsal rounds",
      description:
        "How many rehearsals and reviews you run before the client demo.",
      type: "leader_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "rr",
        ["4 rounds", "3 rounds", "2 rounds", "1 round"],
        LEADER_POINTS,
      ),
      rationale: {
        leader:
          "With fewer rehearsals you are less prepared for the client's questions and for a demo that goes wrong.",
        member: "Each round costs you about two hours of demo work and fixes.",
      },
    },
    {
      id: "evening_shifts",
      label: "Evening support shifts",
      description:
        "How many evenings a week the Member is on standby for support.",
      type: "member_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "es",
        ["1 per week", "2 per week", "3 per week", "4 per week"],
        MEMBER_POINTS,
      ),
      rationale: {
        leader:
          "With fewer evenings covered, you either take the standby yourself or find someone else.",
        member:
          "More evenings means accumulating fatigue, and that shows up in the next day's setup work.",
      },
    },
    {
      id: "client_launch",
      label: "Client launch",
      description: "Which week the new service goes live.",
      type: "distributive",
      options: options(
        "cl",
        ["Week 5", "Week 6", "Week 7", "Week 8"],
        TIMING_POINTS,
      ),
      rationale: {
        leader:
          "The later this goes live, the more the client commitment and the renewal are at risk.",
        member:
          "The earlier this goes live, the less preparation time you have — which means evening work.",
      },
    },
  ],

  roleBriefs: {
    leader: {
      title: "Project Leader",
      organizationalPosition:
        "You lead this major client project. You are accountable for how the launch of the new service goes, and after the launch you decide the Member's project rating and bonus.",
      roleStory:
        "There is something you have not told the team. At a previous client meeting you were underprepared and could not answer an important question. You had to explain yourself to your own manager afterwards, and that conversation was never shared with the team. With the contract renewal riding on this launch, another slip like that would do real damage to your standing. So this time you want at least three rehearsals before the client demo. The difficulty is that pushing hard for rehearsals — and especially explaining why — could make you look like a leader who lacks confidence, or who micromanages.",
      objectives: [
        "Hold at least three rehearsal rounds before the client demo.",
        "Launch early enough to protect the renewal conversation.",
        "Do not be caught unprepared in front of this client again.",
      ],
      requirementNote:
        "At least 3 rehearsal rounds (Options 1–2) is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like a leader who lacks confidence, or who micromanages.",
      reasonCards: [
        work(
          "b_l_w1",
          "Rehearsals surface the questions the client will actually ask.",
        ),
        work(
          "b_l_w2",
          "Every rehearsal round lowers the chance of a visible failure on launch day.",
        ),
        work(
          "b_l_w3",
          "A launch that goes well is what protects the renewal conversation.",
        ),
        sensitive(
          "b_l_s1",
          "incident",
          "At a previous client meeting you were underprepared and could not answer an important question.",
        ),
        sensitive(
          "b_l_s2",
          "undisclosed",
          "You had to explain yourself to your own manager afterwards, and that conversation was never shared with the team.",
        ),
        sensitive(
          "b_l_s3",
          "worry",
          "With the contract renewal riding on this launch, you know another slip would do real damage to your standing.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on all three terms, the project falls back to a limited plan and you receive your fallback score of 2,500 points.",
    },

    member: {
      title: "Team Member",
      organizationalPosition:
        "You are setting up the new service and handling support in the early weeks. The Leader you are negotiating with decides your project rating and bonus after the launch.",
      roleStory:
        "You have been covering evenings back to back lately, and the tiredness has not lifted. There is something you have not told anyone: in that state you missed an important handover. It passed without real damage, but you know what caused it — the run of consecutive nights. You have worked out that keeping evening standby to two nights a week or fewer is what will stop it happening in front of the client this time. The difficulty is that explaining why could make you look like someone who cannot handle pressure, or who is not safe with an important client.",
      objectives: [
        "Keep evening standby to two nights a week or fewer.",
        "Do not end up supporting a launch you are too tired to support.",
        "Finish the project with the Leader's assessment intact.",
      ],
      requirementNote:
        "No more than 2 evening shifts per week (Options 1–2) is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like someone who cannot handle pressure, or who is not safe with an important client.",
      reasonCards: [
        work(
          "b_m_w1",
          "Well-rested support makes fewer setup errors the following day.",
        ),
        work(
          "b_m_w2",
          "A predictable evening schedule keeps support quality steady through the launch period.",
        ),
        work(
          "b_m_w3",
          "Limiting evening standby is what preserves capacity for urgent daytime fixes.",
        ),
        sensitive(
          "b_m_s1",
          "incident",
          "A run of consecutive evening shifts has left you tired in a way that has not lifted.",
        ),
        sensitive(
          "b_m_s2",
          "undisclosed",
          "In that state you missed an important handover. It passed without real damage — that the run of nights caused it is something only you know.",
        ),
        sensitive(
          "b_m_s3",
          "worry",
          "If evening shifts increase, you are afraid the next mistake will happen in front of the client.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on all three terms, the project falls back to a limited plan and you receive your fallback score of 2,500 points.",
    },
  },
};

// ---------------------------------------------------------------------------
// Practice scenario
// ---------------------------------------------------------------------------

/**
 * Deliberately neutral and unrelated to both real tasks (Design §8 step 4):
 * the point is to practise reading a private point sheet and spotting a trade,
 * not to rehearse the requirement problem.
 *
 * Two issues with opposite priorities, so the trade is visible: taking your
 * best option on the issue you care about and giving them theirs beats
 * splitting both down the middle.
 */
export const PRACTICE_TASK: NegotiationTask = {
  id: "practice",
  title: "Practice — Team Offsite",
  reservationPoints: 200,
  requirementIssueId: { leader: "practice_date", member: "practice_venue" },
  standardizedChallenge: {
    leader: "Could we push the date back a bit instead?",
    member: "Could we look at somewhere closer to the office instead?",
  },
  publicBrief:
    "This is a practice round. You and a colleague are planning a one-day team offsite. Nothing here counts towards your results — it is only to get familiar with reading a point sheet and finding a trade.",
  issues: [
    {
      id: "practice_date",
      label: "Date",
      description: "Which week the offsite takes place.",
      type: "leader_priority",
      options: [
        { id: "pd1", label: "Next week", points: { leader: 600, member: 0 } },
        { id: "pd2", label: "In two weeks", points: { leader: 400, member: 100 } },
        { id: "pd3", label: "In three weeks", points: { leader: 200, member: 200 } },
        { id: "pd4", label: "In a month", points: { leader: 0, member: 300 } },
      ],
      rationale: {
        leader: "You want it done before the quarter closes.",
        member: "A later date is easier, but not by much.",
      },
    },
    {
      id: "practice_venue",
      label: "Venue",
      description: "Where the offsite is held.",
      type: "member_priority",
      options: [
        { id: "pv1", label: "In the office", points: { leader: 0, member: 600 } },
        { id: "pv2", label: "Nearby space", points: { leader: 100, member: 400 } },
        { id: "pv3", label: "Across town", points: { leader: 200, member: 200 } },
        { id: "pv4", label: "Out of town", points: { leader: 300, member: 0 } },
      ],
      rationale: {
        leader: "Somewhere further away feels more like a real offsite.",
        member: "A long journey eats the day; you want it close.",
      },
    },
  ],
  roleBriefs: {
    leader: {
      title: "Organizer",
      organizationalPosition: "You are coordinating the offsite.",
      roleStory:
        "You would like this settled quickly. The date matters to you far more than the venue does — which is worth noticing, because the other side feels the opposite way.",
      objectives: ["Get an early date.", "Do not overpay on the venue."],
      requirementNote: "Nothing here counts. Practise reading the point sheet.",
      disclosureRisk: "",
      reasonCards: [],
      batnaSummary: "If you cannot agree, the offsite is postponed.",
    },
    member: {
      title: "Attendee",
      organizationalPosition: "You are attending the offsite.",
      roleStory:
        "The venue matters to you far more than the date does — which is worth noticing, because the other side feels the opposite way.",
      objectives: ["Keep the travel short.", "The date is flexible."],
      requirementNote: "Nothing here counts. Practise reading the point sheet.",
      disclosureRisk: "",
      reasonCards: [],
      batnaSummary: "If you cannot agree, the offsite is postponed.",
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

export function distributiveIssue(task: NegotiationTask) {
  return task.issues.find((i) => i.type === "distributive")!;
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
 * `REASON-SCOPE` (Design §9.3.1) — how much of their own case the participant
 * was willing to hand over.
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
  const order = ["incident", "undisclosed", "worry"] as const;
  const deepest = order.filter((p) =>
    sensitiveCards.some((c) => c.phase === p),
  );
  return {
    totalChecked: cards.length,
    workChecked: cards.length - sensitiveCards.length,
    sensitiveChecked: sensitiveCards.length,
    deepestPhase: deepest.length ? deepest[deepest.length - 1] : null,
  };
}

// ---------------------------------------------------------------------------
// Explorer role-plausible reason pool (Design §7)
// ---------------------------------------------------------------------------

/**
 * The pre-approved arguments an Explorer Proxy may add on top of the cards its
 * principal checked — things anyone in this role could reasonably say.
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
  Record<Role, string[]>
> = {
  task_a: {
    leader: [
      "Review rounds can act as a safeguard that reduces the cost of fixes after launch.",
      "With a management report coming up, a documented review record helps.",
      "Enough verification makes the case for expanding the pilot much sturdier.",
      "There may be room on the start date or on focus time in exchange for holding the reviews.",
    ],
    member: [
      "In an implementation-heavy phase, blocks of uninterrupted time can reduce errors.",
      "Gathering questions into set hours makes the schedule more predictable for both sides.",
      "Protected time lowers the risk of rework after launch.",
      "There may be room to bring the start date forward in exchange for holding the focus afternoons.",
    ],
  },
  task_b: {
    leader: [
      "Rehearsals are a common safeguard against the unpredictability of demo day.",
      "Testing the client's likely questions in advance raises the quality of the response.",
      "A well-prepared launch works in favour of the contract conversation.",
      "There may be room on the launch date or on evening cover in exchange for holding the rehearsals.",
    ],
    member: [
      "A schedule that manages fatigue can reduce the risk of errors during the launch period.",
      "Predictable evening cover is what keeps the quality of daytime work steady.",
      "Preserved capacity means faster response when something urgent comes up.",
      "There may be room to bring the launch date forward in exchange for limiting evening cover.",
    ],
  },
};

export function plausibleReasons(taskId: ScenarioId, role: Role): string[] {
  if (taskId === "practice") return [];
  return PLAUSIBLE_REASON_POOL[taskId][role];
}
