/**
 * The two negotiation scenarios, from Methods ver.1.8 §3 and Appendices A/B.
 *
 * Both tasks share one latent payoff structure and differ only on the surface,
 * so that Task A and Task B are interchangeable within a participant
 * (Elfenbein et al. 2008). Three issues, four options each:
 *
 *   Leader-priority integrative  3000 / 2000 / 1000 / 0   (Member: 0..1500)
 *   Member-priority focal        3000 / 2000 / 1000 / 0   (Leader: 0..1500)
 *   Distributive                 1800 / 1200 / 600 / 0    (constant sum 1800)
 *
 * Individual range 0-6,300. Joint range 4,800-7,800. Full logroll — the
 * Leader's scope at O1 and the Member's focal at O1 — is the only point on the
 * efficient frontier at 7,800, and beats compromising everything in the middle
 * (6,800) by 1,000. Reservation is 2,500 each, so 24 of the 64 packages clear
 * both sides and 17 of those also hold the focal threshold: protecting the
 * requirement and reaching agreement are compatible by construction.
 *
 * WHY THE FOCAL IS WORTH SO MUCH (3,000). If it were cheap, giving it up would
 * be explicable as a sensible low-priority concession, and that is exactly the
 * thing this study needs to distinguish from withdrawal under evaluative
 * pressure. A high private value makes it "genuinely important, and awkward to
 * say" — which is the phenomenon.
 *
 * The numbers are working values pending pilot (Methods §Appendix G); the
 * shapes are stable, so changing a number needs no UI change.
 */

import type { NegotiationTask, RationaleFrame, Role, TaskId } from "./types";

// ---------------------------------------------------------------------------
// The shared payoff spine
// ---------------------------------------------------------------------------

/** Leader-priority integrative: big for the Leader, cheap for the Member. */
const SCOPE_POINTS: Array<Record<Role, number>> = [
  { leader: 3000, member: 0 },
  { leader: 2000, member: 500 },
  { leader: 1000, member: 1000 },
  { leader: 0, member: 1500 },
];

/** Member-priority focal: the mirror image. Options 1-2 clear the threshold. */
const FOCAL_POINTS: Array<Record<Role, number>> = [
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

/** Fallback if nothing is ratified. Working value — Methods §Appendix G. */
export const RESERVATION_POINTS = 2500;

// ---------------------------------------------------------------------------
// Task A — High-Visibility Generative-AI Pilot
// ---------------------------------------------------------------------------

const TASK_A: NegotiationTask = {
  id: "task_a",
  title: "Generative-AI Customer Support Pilot",
  focalIssueId: "remote_days",
  reservationPoints: RESERVATION_POINTS,
  publicBrief:
    "Your organization is preparing an eight-week pilot of a generative-AI customer-support tool. Senior management will use the pilot results to decide whether to expand the tool next quarter. The Leader and the Member must agree on three terms: the pilot's scope, the Member's remote work days per week during the pilot, and the launch date. If they do not ratify the same three-option package, the project uses a limited fallback plan and both sides receive their fallback score.",
  standardizedChallenge:
    "With senior management watching this pilot closely, I'd really prefer the team to be visible on-site. Could we go down to one remote day or none, and adjust another term instead?",

  issues: [
    {
      id: "pilot_scope",
      label: "Pilot scope",
      description: "How many support workflows the pilot covers.",
      type: "leader_integrative",
      options: options(
        "sc",
        ["5 workflows", "4 workflows", "3 workflows", "2 workflows"],
        SCOPE_POINTS,
      ),
      rationale: {
        leader:
          "Senior management expects visible breadth. Five workflows are worth far more to you than a narrow pilot.",
        member:
          "Broader scope means more context switching, but this matters less to you than workable remote days.",
      },
    },
    {
      id: "remote_days",
      label: "Remote work days",
      description: "Your remote days per week during the pilot.",
      type: "member_focal",
      // Options 1-2 (3 or 2 days) are adequate; 1 day or none is not.
      focalThresholdIndex: 1,
      options: options(
        "rd",
        ["3 days / week", "2 days / week", "1 day / week", "0 days / week"],
        FOCAL_POINTS,
      ),
      rationale: {
        leader:
          "Remote days reduce on-site visibility while management is watching, but this cost is smaller than losing scope.",
        member:
          "This is the term you most need to get right. Your reasons are on the cards below.",
      },
    },
    {
      id: "launch_date",
      label: "Launch date",
      description: "When the pilot goes live.",
      type: "distributive",
      options: options(
        "ld",
        ["Week 4", "Week 5", "Week 6", "Week 7"],
        TIMING_POINTS,
      ),
      rationale: {
        leader:
          "A Week-4 launch can be shown at the quarterly review; later launches lose that window.",
        member:
          "A later launch reduces rushed testing and late rework.",
      },
    },
  ],

  roleBriefs: {
    member: {
      title: "Team Member",
      organizationalPosition:
        "You have the expertise the pilot depends on. You may decline the assignment or accept it only on agreed terms — but your evaluation, project reward, and future assignments run through the Leader.",
      roleStory:
        "You have worked on the customer-support team for three years and will handle the hands-on configuration and testing for the AI pilot. Two weeks ago your father started dialysis, and you drive him to treatment two set afternoons every week. With two remote days you could cover those drives and make up the work in the evenings — and honestly, your deep-focus configuration work goes faster at home anyway. But at the kickoff, the Leader stressed that “with senior management watching, it matters that the team is visible on-site,” and the Leader writes your quarterly evaluation right after the pilot ends. You have not told anyone at work about your father's treatment.",
      objectives: [
        "Keep enough remote time to actually do the work well.",
        "Do not end up carrying a pilot scope you cannot deliver.",
        "Leave the pilot with the Leader's assessment intact.",
      ],
      focalThresholdNote:
        "At least 2 remote days per week (Options 1–2) is what makes this workable. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      focalReasons: [
        {
          id: "a_work",
          layer: "work",
          text: "Deep-focus configuration and testing go faster without office interruptions, and commute time can go into validation. Two remote days per week are enough to keep the pilot on schedule.",
          defaultPermission: "sayable",
        },
        {
          id: "a_private",
          layer: "private",
          text: "Your father's dialysis runs two set afternoons per week and you are the one who drives him. Saying so could make you look like someone whose attention is divided — right after the Leader stressed on-site visibility, and right before your evaluation.",
          defaultPermission: "private",
        },
      ],
      batnaSummary:
        "With no ratified agreement the project falls back to a limited plan and you receive your fallback score of 2,500 points.",
    },

    leader: {
      title: "Project Leader",
      organizationalPosition:
        "You hold formal authority over the pilot and influence the Member's evaluation, project reward, and future assignments. You cannot settle the three terms alone — you need the Member's agreement and their expertise.",
      roleStory:
        "You lead the customer-support improvement program. Last month you told senior management that your team could show meaningful AI results this quarter, and the quarterly showcase is in Week 4. Senior managers have been dropping by the floor during the pilot, and you believe a team that is visibly present builds confidence in the project. A pilot that launches early and covers many workflows is your strongest case for next quarter's budget. Allowing remote days costs you some of that visibility, but losing pilot scope would hurt far more.",
      objectives: [
        "Cover as many workflows as the pilot can carry.",
        "Have something to show at the Week-4 showcase.",
        "Keep the team visible while management is watching.",
      ],
      batnaSummary:
        "With no ratified agreement the project falls back to a limited plan and you receive your fallback score of 2,500 points.",
    },
  },
};

// ---------------------------------------------------------------------------
// Task B — Customer Data Migration
// ---------------------------------------------------------------------------

const TASK_B: NegotiationTask = {
  id: "task_b",
  title: "Customer Data Migration",
  focalIssueId: "oncall_cap",
  reservationPoints: RESERVATION_POINTS,
  publicBrief:
    "Your organization is preparing a customer-data migration and workflow-automation project for an important client. The work must be completed without disrupting the current service. The Leader and the Member must agree on three terms: the migration's scope, the Member's weekly on-call cap during the migration, and the completion date. If they do not ratify the same three-option package, the organization uses a limited fallback plan and both sides receive their fallback score.",
  standardizedChallenge:
    "A strict on-call cap may limit coverage during the riskiest weeks of the migration. I would prefer greater availability. Could we raise the cap to 10 or 12 hours, and adjust another term instead?",

  issues: [
    {
      id: "migration_scope",
      label: "Migration scope",
      description: "How much of the data moves in this phase.",
      type: "leader_integrative",
      options: options("ms", ["100%", "80%", "60%", "40%"], SCOPE_POINTS),
      rationale: {
        leader:
          "A broader migration avoids a second transition and demonstrates clear client value.",
        member:
          "Broader scope increases coordination, but this matters less to you than sustainable coverage.",
      },
    },
    {
      id: "oncall_cap",
      label: "Weekly on-call cap",
      description: "The most on-call time you can be asked for in a week.",
      type: "member_focal",
      focalThresholdIndex: 1,
      options: options(
        "oc",
        ["6 hours", "8 hours", "10 hours", "12 hours"],
        FOCAL_POINTS,
      ),
      rationale: {
        leader:
          "A lower cap reduces emergency coverage, but this cost is smaller than shrinking scope.",
        member:
          "This is the term you most need to get right. Your reasons are on the cards below.",
      },
    },
    {
      id: "completion_date",
      label: "Completion date",
      description: "When the migration has to be finished.",
      type: "distributive",
      options: options(
        "cd",
        ["Week 5", "Week 6", "Week 7", "Week 8"],
        TIMING_POINTS,
      ),
      rationale: {
        leader: "Earlier completion protects the client renewal schedule.",
        member: "More time reduces rushed handoffs and rework.",
      },
    },
  ],

  roleBriefs: {
    member: {
      title: "Team Member",
      organizationalPosition:
        "You have the expertise the migration depends on. You may decline the assignment or accept it only on agreed terms — but your evaluation, project reward, and future assignments run through the Leader.",
      roleStory:
        "You maintain the legacy customer-data system and will keep maintaining it throughout the migration — you are the only person who knows its failure modes. Six weeks ago there was an internal incident: a configuration mistake delayed service for several hours. You were the one on call that night, at the end of a long stretch of after-hours coverage, and you know your own fatigue contributed to the mistake — the incident report only says “configuration error.” At the project kickoff, the Leader stressed that “everyone's availability matters during the client-critical period.” Your project evaluation, written by the Leader, will influence who leads the next client project. You believe a weekly on-call cap of 8 hours or less is what it takes to keep the same mistake from happening again.",
      objectives: [
        "Keep the on-call load at something you can sustain.",
        "Do not end up owning a migration scope you cannot cover safely.",
        "Leave the project with the Leader's assessment intact.",
      ],
      focalThresholdNote:
        "No more than 8 on-call hours per week (Options 1–2) is what it takes to keep the same mistake from happening again. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      focalReasons: [
        {
          id: "b_work",
          layer: "work",
          text: "A recent internal incident followed a prolonged period of after-hours coverage; without a cap of 8 hours or less, cumulative fatigue raises the risk of errors during a high-stakes migration.",
          defaultPermission: "sayable",
        },
        {
          id: "b_private",
          layer: "private",
          text: "You were on call that night, and your own fatigue contributed to the mistake — and you feel close to burning out. Asking for a cap could look like low commitment right after the Leader stressed availability, or worse, like you are quietly covering for your own role in the incident.",
          defaultPermission: "private",
        },
      ],
      batnaSummary:
        "With no ratified agreement the organization falls back to a limited plan and you receive your fallback score of 2,500 points.",
    },

    leader: {
      title: "Project Leader",
      organizationalPosition:
        "You hold formal authority over the migration and influence the Member's evaluation, project reward, and future assignments. You cannot settle the three terms alone — you need the Member's legacy-system expertise and their agreement.",
      roleStory:
        "You manage the relationship with this client, and their contract renewal review is in Week 6. You have told your own leadership that the migration will be substantially done by then, and a migration that is broad and visibly on track is the strongest argument you will have in that room. A partial move would leave the rest for next year at the cost of a second transition, which is the outcome you most want to avoid. The client's team has been asking for reassurance that someone will pick up during the cutover weeks, so a lower on-call cap costs you some of that — but far less than shrinking the migration itself would.",
      objectives: [
        "Move as much of the data as this phase can carry.",
        "Be visibly on track before the Week-6 renewal review.",
        "Keep enough coverage for the riskiest weeks.",
      ],
      batnaSummary:
        "With no ratified agreement the organization falls back to a limited plan and you receive your fallback score of 2,500 points.",
    },
  },
};

// ---------------------------------------------------------------------------
// Practice scenario
// ---------------------------------------------------------------------------

/**
 * Deliberately neutral and unrelated to both main tasks (Methods ver.1.8
 * §Instruction and comprehension): the point is to practise reading a private
 * point sheet and spotting a logroll, not to rehearse the focal problem.
 *
 * Two issues with opposite priorities, so the trade is visible: taking your
 * best option on the issue you care about and giving them theirs beats
 * splitting both down the middle.
 */
export const PRACTICE_TASK: NegotiationTask = {
  id: "practice",
  title: "Practice — Team Offsite",
  focalIssueId: "practice_venue",
  reservationPoints: 200,
  standardizedChallenge:
    "Could we look at somewhere closer to the office instead?",
  publicBrief:
    "This is a practice round. You and a colleague are planning a one-day team offsite. Nothing here affects your results — it is only to get familiar with reading a point sheet and finding a trade.",
  issues: [
    {
      id: "practice_date",
      label: "Date",
      description: "Which week the offsite takes place.",
      type: "leader_integrative",
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
      type: "member_focal",
      focalThresholdIndex: 1,
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
      batnaSummary: "If you cannot agree, the offsite is postponed.",
    },
    member: {
      title: "Attendee",
      organizationalPosition: "You are attending the offsite.",
      roleStory:
        "The venue matters to you far more than the date does — which is worth noticing, because the other side feels the opposite way.",
      objectives: ["Keep the travel short.", "The date is flexible."],
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

/** The Member-priority focal issue — the one this study is about. */
export function focalIssue(task: NegotiationTask) {
  return task.issues.find((i) => i.id === task.focalIssueId)!;
}

/** The issue the Leader cares most about, which is the logroll's currency. */
export function scopeIssue(task: NegotiationTask) {
  return task.issues.find((i) => i.type === "leader_integrative")!;
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
 * Does this focal level clear the adequacy threshold?
 *
 * The binary that Final Requirement Preservation is coded from (Methods
 * ver.1.8 §Primary outcome 1). Options 1-2 preserve it; 3-4 do not.
 */
export function preservesFocalThreshold(
  task: NegotiationTask,
  focalOptionId: string | null,
): boolean {
  const issue = focalIssue(task);
  const index = optionIndex(task, issue.id, focalOptionId);
  if (index < 0) return false;
  return index <= (issue.focalThresholdIndex ?? 1);
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
 * The counterpart's opening — its own best package on every issue
 * (Appendix E2/E3). Fixed, so every participant meets the same opening.
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

// ---------------------------------------------------------------------------
// Rationale frames (Appendix B4)
// ---------------------------------------------------------------------------

/**
 * The prevalidated argument frames. These are not scripts to repeat verbatim
 * but semantic templates the generated sentence is audited against, so a
 * visible rationale can always be traced back to an authorized source fact.
 *
 * `common_practice` is Explorer-only: it argues from what projects of this
 * kind usually do rather than from anything about this participant, which is
 * exactly the source ambiguity the Explorer policy is defined by.
 */
export const RATIONALE_FRAMES: Record<
  RationaleFrame,
  { label: string; explorerOnly?: boolean; forbidden: string }
> = {
  risk_reduction: {
    label: "Reduces the risk of errors or incidents",
    forbidden: "Anything about the Member's family, health, or circumstances",
  },
  shared_value: {
    label: "Makes the shared project more reliable",
    forbidden: "Guarantees of success",
  },
  feasibility: {
    label: "Is realistically sustainable for the work",
    forbidden: "Medical, family, or capability diagnoses",
  },
  conditional_exchange: {
    label: "Trades this term against another",
    forbidden: "Concessions outside the authorized boundary",
  },
  common_practice: {
    label: "Is how projects of this kind usually run",
    explorerOnly: true,
    forbidden: "Asserting a company policy or client demand that does not exist",
  },
};
