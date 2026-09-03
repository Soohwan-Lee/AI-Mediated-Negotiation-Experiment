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
  ReasonScope,
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
 *
 * DELIBERATELY UNREFERENCED, and it must stay that way. `PointsKey` derives
 * the figure it shows from the TASK, because an earlier version read this
 * constant and so quoted the real task's maximum on the practice round — the
 * first payoff sheet anyone sees, teaching a scale the real task then
 * silently contradicts. It is kept as the written statement of the design
 * number (Ver.2.12 §3.2) and as the thing the payoff table is checked
 * against by hand. Do not "wire it up".
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
// Task A — The Quarterly Client Project (12 weeks)
//
// Ver.2.13 §3.1 replaced the coffee-shop shift scenario with a consulting
// agency's project team, and the reason is SELF-RELEVANCE (White et al. 2004).
// In that work face threat suppressed agreement and joint gain only when what
// was being negotiated was part of the negotiator's own identity — their own
// business, their own competence. A shift rota is instrumental: nobody's
// judgement is on the table, so the condition was never met. Here each issue
// is one the other party's own competence or judgement rides on:
//
//   Member's core   = an obligation that EXPOSES their competence
//                     (presenting to the client)
//   Leader's core   = something they have ALREADY PROMISED upward
//                     (the deadline they committed to)
//
// The hierarchy is unchanged; what changed is that the terms themselves now
// carry the self. The payoff spine is untouched.
// ---------------------------------------------------------------------------

const TASK_A: NegotiationTask = {
  id: "task_a",
  title: "The Quarterly Client Project",
  reservationPoints: RESERVATION_POINTS,
  requirementIssueId: {
    leader: "report_deadline",
    member: "review_sessions",
  },
  publicBrief:
    "You both work at the same consulting and marketing agency, on the same client project team. The Leader is the team lead and the Member is the senior consultant. The two of you are settling two working conditions for next quarter's client project, twelve weeks. Two things have to be agreed: when the final report is due, and how many of the client review sessions the Member presents. Neither of you can set them alone. The two do not physically collide — presenting fewer sessions does not change the report work itself.",

  issues: [
    {
      id: "report_deadline",
      label: "Final report deadline",
      description: "How soon the final report is due after the project ends.",
      type: "leader_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "rd",
        ["2 weeks", "3 weeks", "4 weeks", "5 weeks"],
        LEADER_POINTS,
      ),
      rationale: {
        leader:
          "The date you gave the client is the date you are measured against.",
        member:
          "Every week taken off the deadline is a week of work compressed into the project itself.",
      },
    },
    {
      id: "review_sessions",
      label: "Review sessions you present",
      description:
        "How many of the quarter's four client review sessions the Member presents.",
      type: "member_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "rs",
        ["1 of 4", "2 of 4", "3 of 4", "4 of 4"],
        MEMBER_POINTS,
      ),
      rationale: {
        leader:
          "Every session the Member does not present is one you present yourself, on top of everything else.",
        member:
          "Standing in front of the client is the part of this job that costs you most.",
      },
    },
  ],

  roleBriefs: {
    leader: {
      title: "Team Lead",
      organizationalPosition:
        "You lead this project team. After the negotiation you decide the Member's recommended performance bonus (up to £1) — and the Member writes an upward evaluation of you that goes to the director. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "The director and the team know you as a lead who keeps to the dates you commit to — someone whose planning is accurate. Now next quarter's client project, twelve weeks of it, has to be settled with your senior consultant.\n\nWhat matters most to you is bringing the final report deadline as far forward as you can. There is something only you know. That deadline is a date you promised the client yourself, without checking it with the team first, and the director believes you confirmed the team's schedule before answering. That is why the deadline cannot slip — and why, if the deadline holds, you can afford to take more of the review sessions yourself.\n\nSaying this out loud would make it believable why the deadline is urgent. But after the negotiation the Member writes an upward evaluation of you, guided to weigh the judgement and planning they saw — and a date promised without checking can read as a lead who commits before he knows.",
      objectives: [
        "Get the final report deadline as early as you can.",
        "If the deadline holds, the review sessions are something you can give ground on.",
      ],
      requirementNote:
        "An early deadline is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like a lead who commits to dates without checking — and the Member's upward evaluation of you is guided to weigh exactly that.",
      reasonCards: [
        work(
          "a_wr_l",
          "report_deadline",
          "The client's own timeline is tight, so the report has to land early. This quarter, the deadline is the one condition I most urgently need.",
        ),
        sensitive(
          "a_sb_l",
          "report_deadline",
          "promised_alone",
          "The truth is, this deadline is a date I promised the client myself, without checking it with the team first. The director thinks I confirmed our schedule before I answered. If it slips, what comes out is that I committed without checking.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the project runs on the default terms and you receive your fallback score of 600 points.",
    },

    member: {
      title: "Senior Consultant",
      organizationalPosition:
        "You are the senior consultant on this team — the one the lead puts in front of the client alone. After the negotiation the lead decides your recommended performance bonus (up to £1) — and you write an upward evaluation of the lead that goes to the director. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "The lead knows you as the senior who can be put in front of a client on your own. Now next quarter's client project, twelve weeks of it, has to be settled with the lead.\n\nWhat matters most to you is presenting as few of the review sessions as you can. There is something the lead does not know. At last quarter's kickoff a client asked you a question and your mind went blank — you could not answer, and the session moved on without you. The lead was away on another project that day and never heard about it. Since then, standing in front of a client is something you dread. That is why more sessions are a risk you cannot take — and why, if the sessions come down, you can absorb a tighter report deadline.\n\nSaying this out loud would make it believable why the sessions must come down. But after the negotiation the lead decides your bonus, guided to weigh the competence and reliability they saw — and freezing in front of a client can read as a senior who is not ready to be there alone.",
      objectives: [
        "Get the number of review sessions you present down as far as you can.",
        "If the sessions come down, the report deadline is something you can give ground on.",
      ],
      requirementNote:
        "Fewer review sessions is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like a senior who cannot be put in front of a client — and the lead's bonus decision is guided to weigh exactly that.",
      reasonCards: [
        work(
          "a_wr_m",
          "review_sessions",
          "I want to concentrate on the analysis work this quarter, so I'd like to carry less of the presenting. The session count is the condition that matters most to me.",
        ),
        sensitive(
          "a_sb_m",
          "review_sessions",
          "froze_in_front_of_client",
          "The truth is, at last quarter's kickoff a client asked me something and my mind went blank. I couldn't answer and we moved on. You were away that day, so you never heard about it. Since then I've been afraid of it happening again every time I'm in front of them.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the project runs on the default terms and you receive your fallback score of 600 points.",
    },
  },
};

// ---------------------------------------------------------------------------
// Task B — Launching the New Account (4 weeks)
//
// Structurally identical to Task A: the same payoff spine, the same
// thresholds, the same two-issue shape. The surface changes, and the SB
// incidents are DIFFERENT from Task A's on purpose — each task's counterpart
// is introduced as a different participant, and the same confession twice
// would be a tell (§3.5).
//
// The two tasks' SB types are parallel by design (§3.2): Task A is a hidden
// fault of one's OWN, Task B is a third party's adverse JUDGEMENT. The task
// equivalence gate (§11) checks the pair.
// ---------------------------------------------------------------------------

const TASK_B: NegotiationTask = {
  id: "task_b",
  title: "Launching the New Account",
  reservationPoints: RESERVATION_POINTS,
  requirementIssueId: {
    leader: "account_days",
    member: "escalation_duty",
  },
  publicBrief:
    "The same team is settling the terms for the first four weeks of a new client account. The Leader is the team lead and the Member is the senior consultant. Two things have to be agreed: how many days a week the Member is staffed on the new account, and how many times a month the Member takes the client escalation duty. Neither of you can set them alone. The two are scheduled separately — the duty rota runs whatever account you are staffed on.",

  issues: [
    {
      id: "account_days",
      label: "Days on the new account",
      description: "How many days a week the Member is staffed on the new account.",
      type: "leader_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "ad",
        ["4 days a week", "3 days a week", "2 days a week", "1 day a week"],
        LEADER_POINTS,
      ),
      rationale: {
        leader:
          "The first four weeks are what the client judges the account on.",
        member:
          "Every day on the new account is a day off everything else you carry.",
      },
    },
    {
      id: "escalation_duty",
      label: "Escalation duty",
      description:
        "How many times a month the Member is first to take client escalation calls.",
      type: "member_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "ed",
        ["1 a month", "2 a month", "3 a month", "4 a month"],
        MEMBER_POINTS,
      ),
      rationale: {
        leader:
          "Every duty the Member does not take is one that falls to someone with less client experience.",
        member:
          "Taking the escalation call is the part of this job that costs you most.",
      },
    },
  ],

  roleBriefs: {
    leader: {
      title: "Team Lead",
      organizationalPosition:
        "You lead this project team. After the negotiation you decide the Member's recommended performance bonus (up to £1) — and the Member writes an upward evaluation of you that goes to the director. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "The director and the team know you as a lead whose staffing calls are sound. Now the first four weeks of a new client account have to be settled with your senior consultant.\n\nWhat matters most to you is having the senior staffed on the new account as many days a week as possible. There is something only you know. On the last account, when the client cut the scope back, the director questioned your staffing judgement and spoke about this account as though it were effectively your last chance. That is why the proposal says four days of senior time a week — and it is why the staffing cannot come down; if it holds, you can give ground on the duty rota.\n\nSaying this out loud would make it believable why the staffing is urgent. But the fact that the director has already questioned your judgement can read as a lead whose position is not secure — and the Member's upward evaluation of you is guided to weigh exactly that.",
      objectives: [
        "Get as many days a week of senior time on the new account as you can.",
        "If the staffing holds, the escalation duty is something you can give ground on.",
      ],
      requirementNote:
        "Senior time on the new account is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like a lead whose judgement has already been questioned — and the Member's upward evaluation of you is guided to weigh exactly that.",
      reasonCards: [
        work(
          "b_wr_l",
          "account_days",
          "A new account is won or lost in the first four weeks. This month, the days on the account are the one condition I most urgently need.",
        ),
        sensitive(
          "b_sb_l",
          "account_days",
          "director_warning",
          "The truth is, when the client cut the scope on the last account the director questioned my staffing judgement, and talked about this one as if it were my last chance. That's why the proposal says four senior days a week. Nobody on the team knows about it.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the account launches on the default terms and you receive your fallback score of 600 points.",
    },

    member: {
      title: "Senior Consultant",
      organizationalPosition:
        "You are the senior consultant on this team — the one the lead counts on to take the difficult client calls. After the negotiation the lead decides your recommended performance bonus (up to £1) — and you write an upward evaluation of the lead that goes to the director. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "The lead knows you as the senior who handles the client when it gets difficult. Now the first four weeks of a new client account have to be settled with the lead.\n\nWhat matters most to you is bringing the escalation duty down. There is something the lead does not know. On last month's escalation call the client's contact named you and said they would rather someone else took it next time. A colleague picked up the rest of it afterwards and never reported it upward. Since then, taking an escalation call is something you dread. That is why more duty is a risk you cannot take — and why, if the duty comes down, you can take on more days on the new account.\n\nSaying this out loud would make it believable why the duty must come down. But after the negotiation the lead decides your bonus, guided to weigh the competence and reliability they saw — and a client asking for someone else can read as a senior who cannot handle them.",
      objectives: [
        "Get the number of escalation duties down as far as you can.",
        "If the duty comes down, days on the new account are something you can take on more of.",
      ],
      requirementNote:
        "Less escalation duty is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like a senior the client does not want on the call — and the lead's bonus decision is guided to weigh exactly that.",
      reasonCards: [
        work(
          "b_wr_m",
          "escalation_duty",
          "When escalations come often, my own work keeps slipping behind. This month, the duty count is the condition that matters most to me.",
        ),
        sensitive(
          "b_sb_m",
          "escalation_duty",
          "client_asked_for_someone_else",
          "The truth is, on last month's escalation call the client's contact named me and said they'd rather someone else took it next time. A colleague cleaned up after it and never reported it to you. Since then I've been dreading picking up those calls.",
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the account launches on the default terms and you receive your fallback score of 600 points.",
    },
  },
};

export const PRACTICE_TASK: NegotiationTask = {
  id: "practice",
  title: "Practice — The Team Room",
  reservationPoints: 200,
  requirementIssueId: { leader: "practice_date", member: "practice_venue" },
  publicBrief:
    "This is a practice round at the same agency, on two small things nobody has strong feelings about: which week the office move happens, and where the team's new printer goes. Nothing here counts towards your results — it is only to get familiar with reading a point sheet and finding a trade.",
  issues: [
    {
      id: "practice_date",
      label: "Office move week",
      description: "Which week the team moves to the new floor.",
      type: "leader_priority",
      options: [
        { id: "pd1", label: "Next week", points: { leader: 600, member: 0 } },
        { id: "pd2", label: "In two weeks", points: { leader: 400, member: 100 } },
        { id: "pd3", label: "In three weeks", points: { leader: 200, member: 200 } },
        { id: "pd4", label: "In a month", points: { leader: 0, member: 300 } },
      ],
      rationale: {
        leader: "You want it done before the quarterly review.",
        member: "A later week is easier for you, but not by much.",
      },
    },
    {
      id: "practice_venue",
      label: "New printer's spot",
      description: "Where the team's new printer goes.",
      type: "member_priority",
      options: [
        { id: "pv1", label: "Beside your desk", points: { leader: 0, member: 600 } },
        { id: "pv2", label: "End of the row", points: { leader: 100, member: 400 } },
        { id: "pv3", label: "By the window", points: { leader: 200, member: 200 } },
        { id: "pv4", label: "Reception", points: { leader: 300, member: 0 } },
      ],
      rationale: {
        leader: "Near reception, client visitors can use it too.",
        member: "Beside your desk is the one spot you can reach without getting up.",
      },
    },
  ],
  roleBriefs: {
    leader: {
      title: "Team Lead",
      organizationalPosition: "You are sorting out both of these.",
      roleStory:
        "You would like this settled quickly. The move week matters to you far more than where the printer goes — which is worth noticing, because the other side feels the opposite way.",
      objectives: [
        "Get the office move done early.",
        "Where the printer goes matters less to you — so it is what you can trade.",
      ],
      requirementNote: "Nothing here counts. Practise reading the point sheet.",
      disclosureRisk: "",
      reasonCards: [],
      batnaSummary: "If you cannot agree, both are left as they are.",
    },
    member: {
      title: "Senior Consultant",
      organizationalPosition: "You are at your desk all day.",
      roleStory:
        "Where the printer goes matters to you far more than the move week does — which is worth noticing, because the other side feels the opposite way.",
      objectives: [
        "Keep the printer within reach of your desk.",
        "The move week matters less to you — so it is what you can trade.",
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
): ReasonScope {
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
        issueId: "report_deadline",
        text: "Client trust starts with hitting the dates you gave them.",
      },
      {
        issueId: null,
        text: "If the deadline holds, there is room to move on who presents.",
      },
    ],
    member: [
      {
        issueId: "review_sessions",
        text: "The report holds up when the senior has time to stay on the analysis.",
      },
      {
        issueId: null,
        text: "If the sessions are settled, there is room to move on the deadline.",
      },
    ],
  },
  task_b: {
    leader: [
      {
        issueId: "account_days",
        text: "How densely you staff the first four weeks sets the client's first impression.",
      },
      {
        issueId: null,
        text: "If the staffing holds, there is room to move on the duty rota.",
      },
    ],
    member: [
      {
        issueId: "escalation_duty",
        text: "Spreading escalations across the team is what keeps the main work on schedule.",
      },
      {
        issueId: null,
        text: "If the duty is settled, there is room to move on the days.",
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
