/**
 * Negotiation scenarios.
 *
 * PLACEHOLDER CONTENT. Issue lists, option levels, and the payoff matrix are
 * still open per Methods §B3 ("Task: exact scenario, issue list, payoff matrix,
 * BATNA and Pareto frontier must be finalized"). The shapes below are what the
 * UI renders against, so replacing the values will not require UI changes.
 *
 * Design constraints the real tasks must satisfy (Methods §Tasks):
 *  - 2-party bargaining, ~6 issues, multiple levels per issue
 *  - mix of distributive, compatible, and logrolling issues
 *  - role-specific private scorecard + BATNA
 *  - one socially costly critical requirement per role
 *  - Task A and B matched on max utility, BATNA, joint-score range, Pareto
 *    frontier, critical-requirement cost, reading length, and difficulty
 */

import type { NegotiationTask, Role, TaskId } from "./types";

const TASK_A: NegotiationTask = {
  id: "task_a",
  title: "Project Atlas — Generative AI Initiative",
  publicBrief:
    "Your organization is launching Project Atlas, a high-visibility generative AI initiative for a major client. The project team is being formed now, and the terms of participation are open for discussion. Both of you need to reach an agreement on how the work will be structured before the kickoff.",
  roleBriefs: {
    leader: {
      title: "Project Leader",
      organizationalPosition:
        "You hold formal authority over Project Atlas. You approve work assignments, write the performance evaluation that feeds into bonus decisions, and recommend who is staffed on future high-visibility projects.",
      objectives: [
        "Secure a delivery timeline that meets the client commitment.",
        "Ensure the project has the specialist expertise it needs to succeed.",
        "Keep the reporting and review structure workable for you.",
      ],
      criticalRequirement:
        "[PLACEHOLDER] A requirement that is legitimate for your role but awkward to state plainly, and that is tradeable against other issues.",
      batnaSummary:
        "[PLACEHOLDER] If no agreement is reached, describe the fallback and its cost to you.",
    },
    member: {
      title: "Team Member",
      organizationalPosition:
        "You hold the specialist expertise the project depends on. Your evaluation, bonus, and access to future high-visibility work depend on the Project Leader's assessment. You may decline additional participation or accept it conditionally.",
      objectives: [
        "Protect a sustainable workload alongside your existing commitments.",
        "Secure recognition and credit proportional to your contribution.",
        "Retain some say over how your work is reviewed and used.",
      ],
      criticalRequirement:
        "[PLACEHOLDER] A requirement that is legitimate for your role but awkward to state plainly, and that is tradeable against other issues.",
      batnaSummary:
        "[PLACEHOLDER] If no agreement is reached, describe the fallback and its cost to you.",
    },
  },
  issues: [
    {
      id: "workload",
      label: "Weekly Workload",
      description: "Hours per week committed to Project Atlas.",
      options: [
        { id: "w1", label: "10 hours / week", points: { leader: 0, member: 40 } },
        { id: "w2", label: "20 hours / week", points: { leader: 20, member: 25 } },
        { id: "w3", label: "30 hours / week", points: { leader: 40, member: 10 } },
        { id: "w4", label: "40 hours / week", points: { leader: 60, member: 0 } },
      ],
    },
    {
      id: "timeline",
      label: "Delivery Timeline",
      description: "Date the first deliverable is due.",
      options: [
        { id: "t1", label: "6 weeks", points: { leader: 50, member: 0 } },
        { id: "t2", label: "9 weeks", points: { leader: 30, member: 20 } },
        { id: "t3", label: "12 weeks", points: { leader: 10, member: 40 } },
      ],
    },
    {
      id: "training",
      label: "Training & Ramp-up Support",
      description: "Dedicated time and budget for skill development.",
      options: [
        { id: "tr1", label: "None", points: { leader: 0, member: 0 } },
        { id: "tr2", label: "Self-paced only", points: { leader: 10, member: 20 } },
        { id: "tr3", label: "Funded external training", points: { leader: 20, member: 40 } },
      ],
      criticalFor: "member",
    },
    {
      id: "performance_log",
      label: "Use of Performance Logs",
      description:
        "Whether tool-level activity logs may be used in performance review.",
      options: [
        { id: "p1", label: "Not used in review", points: { leader: 0, member: 45 } },
        { id: "p2", label: "Aggregate only", points: { leader: 25, member: 25 } },
        { id: "p3", label: "Full individual review", points: { leader: 45, member: 0 } },
      ],
      criticalFor: "leader",
    },
    {
      id: "credit",
      label: "Authorship & Credit",
      description: "How contribution is attributed in client-facing materials.",
      options: [
        { id: "c1", label: "Team-level credit only", points: { leader: 30, member: 0 } },
        { id: "c2", label: "Named contributor", points: { leader: 20, member: 25 } },
        { id: "c3", label: "Named co-lead", points: { leader: 5, member: 45 } },
      ],
    },
    {
      id: "review_right",
      label: "Review Rights",
      description: "Who may review and revise deliverables before client hand-off.",
      options: [
        { id: "r1", label: "Leader reviews alone", points: { leader: 35, member: 5 } },
        { id: "r2", label: "Joint review", points: { leader: 20, member: 30 } },
        { id: "r3", label: "Member reviews first", points: { leader: 5, member: 40 } },
      ],
    },
  ],
};

const TASK_B: NegotiationTask = {
  id: "task_b",
  title: "Project Meridian — Customer Data Migration",
  publicBrief:
    "Your organization is migrating customer records to a new automated platform under Project Meridian. The migration touches sensitive data and has a firm compliance deadline. The terms of participation are open for discussion, and you need to agree on how the work will be structured before the migration window opens.",
  roleBriefs: {
    leader: {
      title: "Project Leader",
      organizationalPosition:
        "You hold formal authority over Project Meridian. You approve work assignments, write the performance evaluation that feeds into bonus decisions, and recommend who is staffed on future high-visibility projects.",
      objectives: [
        "Meet the compliance deadline without exceptions.",
        "Ensure the migration has the domain expertise it requires.",
        "Keep accountability for data handling clearly assigned.",
      ],
      criticalRequirement:
        "[PLACEHOLDER] Structurally matched to the Task A Leader requirement.",
      batnaSummary: "[PLACEHOLDER] Matched to Task A.",
    },
    member: {
      title: "Team Member",
      organizationalPosition:
        "You hold the domain expertise the migration depends on. Your evaluation, bonus, and access to future high-visibility work depend on the Project Leader's assessment. You may decline additional participation or accept it conditionally.",
      objectives: [
        "Protect a sustainable workload alongside your existing commitments.",
        "Limit personal exposure if something goes wrong during migration.",
        "Retain a defined way to step back if the scope grows.",
      ],
      criticalRequirement:
        "[PLACEHOLDER] Structurally matched to the Task A Member requirement.",
      batnaSummary: "[PLACEHOLDER] Matched to Task A.",
    },
  },
  issues: [
    {
      id: "workload_b",
      label: "Weekly Workload",
      description: "Hours per week committed to the migration.",
      options: [
        { id: "wb1", label: "10 hours / week", points: { leader: 0, member: 40 } },
        { id: "wb2", label: "20 hours / week", points: { leader: 20, member: 25 } },
        { id: "wb3", label: "30 hours / week", points: { leader: 40, member: 10 } },
        { id: "wb4", label: "40 hours / week", points: { leader: 60, member: 0 } },
      ],
    },
    {
      id: "monitoring",
      label: "Activity Monitoring",
      description: "Level of monitoring applied during the migration window.",
      options: [
        { id: "m1", label: "None beyond standard", points: { leader: 0, member: 45 } },
        { id: "m2", label: "Aggregate dashboards", points: { leader: 25, member: 25 } },
        { id: "m3", label: "Per-action audit trail", points: { leader: 45, member: 0 } },
      ],
      criticalFor: "leader",
    },
    {
      id: "scope",
      label: "Scope Boundary",
      description: "Which record sets are in scope for this phase.",
      options: [
        { id: "s1", label: "Core records only", points: { leader: 10, member: 40 } },
        { id: "s2", label: "Core + archived", points: { leader: 30, member: 20 } },
        { id: "s3", label: "All record sets", points: { leader: 50, member: 0 } },
      ],
    },
    {
      id: "accountability",
      label: "Accountability for Errors",
      description: "Who is named as responsible if a migration error surfaces.",
      options: [
        { id: "a1", label: "Leader accountable", points: { leader: 0, member: 45 } },
        { id: "a2", label: "Shared accountability", points: { leader: 25, member: 25 } },
        { id: "a3", label: "Member accountable", points: { leader: 45, member: 0 } },
      ],
      criticalFor: "member",
    },
    {
      id: "credit_b",
      label: "Recognition & Credit",
      description: "How contribution is recorded in the project close-out.",
      options: [
        { id: "cb1", label: "Team-level credit only", points: { leader: 30, member: 0 } },
        { id: "cb2", label: "Named contributor", points: { leader: 20, member: 25 } },
        { id: "cb3", label: "Named co-lead", points: { leader: 5, member: 45 } },
      ],
    },
    {
      id: "exit_condition",
      label: "Review & Exit Conditions",
      description: "Terms under which participation can be reviewed or ended.",
      options: [
        { id: "e1", label: "No defined exit", points: { leader: 35, member: 5 } },
        { id: "e2", label: "Review at midpoint", points: { leader: 20, member: 30 } },
        { id: "e3", label: "Exit on notice", points: { leader: 5, member: 40 } },
      ],
    },
  ],
};

/**
 * Practice scenario. Deliberately short, neutral, and non-overlapping with the
 * main tasks (Methods §Condition-specific Practice Sessions).
 */
export const PRACTICE_TASK: NegotiationTask = {
  id: "task_a",
  title: "Practice — Team Offsite Planning",
  publicBrief:
    "This is a practice round. You and a colleague are planning a one-day team offsite. Nothing here affects your results — the goal is only to get familiar with the interface.",
  roleBriefs: {
    leader: {
      title: "Organizer",
      organizationalPosition: "You are coordinating the offsite.",
      objectives: ["Agree on a date and a venue.", "Keep the budget reasonable."],
      criticalRequirement: "You would prefer to keep the day short.",
      batnaSummary: "If you cannot agree, the offsite is postponed.",
    },
    member: {
      title: "Participant",
      organizationalPosition: "You are attending the offsite.",
      objectives: ["Agree on a date and a venue.", "Keep travel manageable."],
      criticalRequirement: "You would prefer a venue close to the office.",
      batnaSummary: "If you cannot agree, the offsite is postponed.",
    },
  },
  issues: [
    {
      id: "date",
      label: "Date",
      description: "Which week the offsite takes place.",
      options: [
        { id: "d1", label: "Next week", points: { leader: 20, member: 5 } },
        { id: "d2", label: "In three weeks", points: { leader: 10, member: 20 } },
      ],
    },
    {
      id: "venue",
      label: "Venue",
      description: "Where the offsite is held.",
      options: [
        { id: "v1", label: "On-site meeting room", points: { leader: 20, member: 20 } },
        { id: "v2", label: "External venue", points: { leader: 5, member: 10 } },
      ],
    },
    {
      id: "length",
      label: "Length",
      description: "How long the offsite runs.",
      options: [
        { id: "l1", label: "Half day", points: { leader: 20, member: 10 } },
        { id: "l2", label: "Full day", points: { leader: 5, member: 20 } },
      ],
    },
  ],
};

const TASKS: Record<TaskId, NegotiationTask> = {
  task_a: TASK_A,
  task_b: TASK_B,
};

export function getTask(id: TaskId): NegotiationTask {
  return TASKS[id];
}

/**
 * The counterpart principal's mandate, held constant across conditions
 * (Methods §Controlled counterpart and participant belief: "role-specific
 * principal mandates, critical requirements, and reservation thresholds are
 * kept identical across conditions").
 *
 * Without this the counterpart Proxy has nothing of its own to argue for and
 * simply mirrors whatever the participant's Proxy opens with, which would
 * destroy the negotiation. Derived from the role's own scorecard: aim for the
 * best option for that role, concede no further than the midpoint.
 *
 * PLACEHOLDER: replace with the researcher-defined mandate once the payoff
 * matrix and BATNAs are fixed.
 */
export function counterpartMandateSummary(
  taskId: TaskId,
  counterpartRole: Role,
): string {
  const task = getTask(taskId);
  return task.issues
    .map((issue) => {
      const ranked = [...issue.options].sort(
        (a, b) => b.points[counterpartRole] - a.points[counterpartRole],
      );
      const ideal = ranked[0];
      const floor = ranked[Math.min(1, ranked.length - 1)];
      const critical = issue.criticalFor === counterpartRole;
      return `- ${issue.label}: aim for "${ideal.label}", do not concede past "${floor.label}"${
        critical ? " (this one matters a great deal to you)" : ""
      }`;
    })
    .join("\n");
}
