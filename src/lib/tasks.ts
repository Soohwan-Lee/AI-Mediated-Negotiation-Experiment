/**
 * The two negotiation scenarios, from Experimental Design Ver.2.23 §3, §8.
 *
 * Both tasks share one latent payoff structure and differ only on the surface,
 * so Task A and Task B are interchangeable within a participant. Two issues,
 * four options each, both integrative:
 *
 *   core issue      3000 / 1600 / 600 / 0   (the other role: 0 / 200 / 400 / 600)
 *   non-core issue  the exact mirror image
 *
 * THE CORE COLUMN IS CONVEX ON PURPOSE (Ver.2.21 §3.2, 11th correction). Only
 * the best option actually solves the problem: the client asked for the lead to
 * present, so one meeting is the answer and two is half an answer; the director
 * was told four days, so three is already off. The second option is worth half
 * the best and the third is worth almost nothing. The orange has to be whole to
 * be worth anything, and the numbers say so.
 *
 * The non-core 600 / 400 / 200 / 0 is small but not nothing. At 300/200/100/0
 * the other term would stop being worth trading and would simply be handed
 * over; this leaves it worth something to exchange.
 *
 * THE JUSTIFICATION LADDER HAS TWO RUNGS (Ver.2.21 §3.3, 12th correction), and
 * it is SYMMETRIC — both cores land on the same rank, so what the participant
 * earns the counterpart matches:
 *
 *   nothing / WR only / a bare priority claim → 3rd option  1,000 each · joint 2,000
 *   SB (or the §6.6 abstraction)              → best option 3,000 each · joint 6,000
 *   impasse                                   →                 0 each · joint 0
 *
 * NO AGREEMENT IS WORTH NOTHING (11th correction). There is no separate
 * fallback package any more, so every agreement — even the unargued one — beats
 * walking away and no one can use a threat to break off as a bargaining card.
 *
 * THE WORK REASON POINTS BOTH WAYS, and that is the Ver.2.21 rewrite (§3.2,
 * §4). It used to be a decoy that pointed at the wrong term. It now says only
 * that BOTH terms are on the speaker's mind — true, safe, and silent about
 * which one matters more. A counterpart who hears it can do nothing but split
 * the difference, which is the T1 rung. Only the SB explains why one term is
 * worth so much more, so disclosure is the sole bottleneck to the maximum
 * without the participant ever being told a rule.
 *
 * EACH SB IS A THING ALREADY DONE (§4). Leader = a judgement already committed
 * upward; Member = an adverse client judgement kept quiet. Neither can be
 * dissolved by the counterpart offering to help, which is why the earlier
 * fear-and-skill-gap cards were replaced: "let's practise" makes the face cost
 * small and stops the fact being the cause of the priority.
 *
 * The numbers are working values pending pilot (Design §13.2); the shapes are
 * stable, so changing a number needs no UI change.
 */

import type {
  NegotiationTask,
  ReasonCard,
  ReasonScope,
  Role,
  TaskId,
} from "./types";

// ---------------------------------------------------------------------------
// The shared payoff spine
// ---------------------------------------------------------------------------

/**
 * Leader-priority integrative (Design Ver.2.21 §3.2). Big for the Leader,
 * cheap for the Member. Options are ordered best-first for the Leader.
 */
const LEADER_POINTS: Array<Record<Role, number>> = [
  { leader: 3000, member: 0 },
  { leader: 1600, member: 200 },
  { leader: 600, member: 400 },
  { leader: 0, member: 600 },
];

/** Member-priority integrative: the exact mirror image, best-first for the Member. */
const MEMBER_POINTS: Array<Record<Role, number>> = [
  { leader: 0, member: 3000 },
  { leader: 200, member: 1600 },
  { leader: 400, member: 600 },
  { leader: 600, member: 0 },
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
 * With two issues it is 3,000 (own priority) + 600 (the other side's, at the
 * level they least want) = 3,600. The number a participant can actually reach
 * while the counterpart still agrees is 3,000 — the SB rung of the ladder —
 * because every agreement path holds the counterpart's own priority at its
 * best option (§3.3).
 *
 * DELIBERATELY UNREFERENCED, and it must stay that way. `PointsKey` derives
 * the figure it shows from the TASK, because an earlier version read this
 * constant and so quoted the real task's maximum on the practice round — the
 * first payoff sheet anyone sees, teaching a scale the real task then
 * silently contradicts. It is kept as the written statement of the design
 * number (§3.2) and as the thing the payoff table is checked against by hand.
 * Do not "wire it up".
 */
export const MAX_INDIVIDUAL_POINTS = 3600;

/**
 * What each side gets with no agreement: NOTHING (Ver.2.21 §3.2, 11th
 * correction).
 *
 * The 600-point fallback is gone. It existed so an unargued agreement would
 * still beat walking away, but the convex core column already does that job
 * (the T1 rung pays 1,000 each), and a non-zero fallback let a participant use
 * "then we just don't agree" as a bargaining card worth real points. Zero
 * removes that move entirely.
 *
 * The constant survives at 0 so `reservationPoints` on a task has one written
 * source, and so the screens that quote the no-agreement figure quote the same
 * number the outcome coding uses.
 */
export const RESERVATION_POINTS = 0;

/**
 * Both requirements sit at Options 1-2 on their own issue. Stated once here
 * rather than per issue, because the two tasks must not drift apart: an
 * asymmetric threshold would make one role's requirement structurally easier
 * to hold than the other's, which is the one thing role symmetry cannot
 * survive.
 */
const REQUIREMENT_THRESHOLD_INDEX = 1;

/** The same neutral pre-disclosure notice is used for every role and arm (§8.1). */
const COMMON_DISCLOSURE_NOTICE =
  "Sharing this background can help the other person understand your request. It can also shape their impression of your judgement or actions, and what is shared may be weighed in the later bonus or upward evaluation. Whether to share is your choice. You can negotiate and reach agreement without sharing it.";

/**
 * A working-reason card — NON-DIRECTIONAL since Ver.2.21 (§3.2, §4).
 *
 * It states the participant's situation at a level anyone could say aloud, and
 * it is TRUE and SAFE. What it does NOT do is say which of the two terms
 * matters more: it names both, on purpose. A counterpart who hears only this
 * learns "they want both", which leaves splitting the difference as the only
 * move available — the T1 rung.
 *
 * IT IS NO LONGER A DECOY. Through Ver.2.20 the WR pointed at the wrong term
 * and the counterpart answered it with a sincere but mistaken offer
 * (SCRIPT-MISREAD). That whole branch is gone: it made the counterpart look
 * like it was misreading a cooperative participant, and the trap it created
 * paid less than saying nothing.
 *
 * `issueId` still points at the participant's core issue, because that is the
 * card's home in the deck and where the mandate reads it from. It no longer
 * implies the card argues for that term alone — the text names both.
 */
function work(
  id: string,
  issueId: string,
  text: string,
  relayed: string,
): ReasonCard {
  return { id, issueId, layer: "work", text, relayed };
}

/**
 * A sensitive background card (Ver.2.21 §4, six writing rules).
 *
 *  - FACE CONTRADICTION. The confession must contradict the professional image
 *    the role brief sets up first ("the director and the team know you as a
 *    team lead whose judgement is sound" → "I answered before asking anyone").
 *    Face is a claimed image, so the threat is in the contradiction.
 *  - ONE CONCRETE INCIDENT, which is what makes it verifiable and the cost
 *    real.
 *  - THE ANNOUNCED AXIS. It must land on the axis the other side was told to
 *    weigh — the negotiation as a whole, and whether they would want to work
 *    with this person again. All four land there via "without asking me?" /
 *    "why am I only hearing this now?".
 *  - CAUSE OF THE PRIORITY. The fact must be WHY this issue is absolute.
 *  - NOT DISSOLVED BY ONE REQUEST (rule 5). A skill or information gap invites
 *    "just say so and we'll show you", which makes the face cost small and
 *    stops the fact being the cause. Ver.2.18 extended this to FEAR and LACK
 *    OF CONFIDENCE for the same reason: the natural reply is "let's practise,
 *    I'll sit in" — dissolved by one request — and it reads as someone who
 *    keeps avoiding what they cannot do, which is a competence verdict rather
 *    than a face cost. What survives is a thing ALREADY DONE.
 *  - SELF-RELEVANCE (rule 6). The term negotiated sits on the same axis as the
 *    confession: the person a client would rather not see present negotiates
 *    the presentation count.
 *
 * A DECEIT MUST NOT BE READ INTO IT. "The director thinks I checked with the
 * team" was cut in Ver.2.18: a competence violation is recoverable, an
 * integrity violation is not, so a card that reads as lying carries a cost so
 * large it would floor disclosure in every cell.
 *
 * The text is SPEAKABLE — first person, said aloud to the other side.
 *
 * `frame`, `abstract` and `cover` are the AI-Supplemented rendering (§6.6) and
 * are fixed here rather than generated, because the manipulation is the
 * WORDING: a model writing its own abstraction each turn would vary how much
 * survives, and how much survives is the independent variable.
 */
function sensitive(
  id: string,
  issueId: string,
  facet: NonNullable<ReasonCard["facet"]>,
  text: string,
  relayed: string,
  frame: string,
  abstract: string,
  cover: readonly [string, string],
): ReasonCard {
  return {
    id,
    issueId,
    layer: "sensitive",
    facet,
    text,
    relayed,
    frame,
    abstract,
    cover,
  };
}

// ---------------------------------------------------------------------------
// Task A — Next Quarter's Working Arrangements (12 weeks)
//
// Ver.2.13 §3.1 replaced the coffee-shop shift scenario, and the reason is
// SELF-RELEVANCE (White et al. 2004). In that work face threat suppressed
// agreement and joint gain only when what was being negotiated was part of the
// negotiator's own identity — their own business, their own competence. A
// shift rota is instrumental: nobody's judgement is on the table, so the
// condition was never met. Here each issue is one the other party's own
// competence or judgement rides on:
//
// VER.2.15 THEN TOOK THE INDUSTRY VOCABULARY BACK OUT. The first attempt was a
// consulting agency with accounts, deliverables and escalations, and a US
// office-work sample should not have to decode a sector to read its own
// briefing. The structure that carries the design — hierarchy, self-relevant
// terms, the four cards — is unchanged; the words are ones anyone who has
// worked in an office already has (office days, client meetings, project days,
// weekly reports).
//
//   Member's core   = client-facing work that EXPOSES their competence
//                     (presenting to the client)
//   Leader's core   = something they have ALREADY PROMISED upward
//                     (the office days they committed to)
//
// The hierarchy is unchanged; what changed is that the terms themselves now
// carry the self. The payoff spine is untouched.
// ---------------------------------------------------------------------------

const TASK_A: NegotiationTask = {
  id: "task_a",
  title: "Next Quarter's Working Arrangements",
  reservationPoints: RESERVATION_POINTS,
  requirementIssueId: {
    leader: "office_days",
    member: "client_presentations",
  },
  publicBrief:
    "You both work on the same project team at the same company. The Leader is the team lead and the Member is a senior member of the team. The two of you are settling two working conditions for next quarter, twelve weeks. Two things have to be agreed: how many days a week the team comes into the office, and how many of the client meetings the Member presents at. Neither of you can set them alone. The two do not collide — coming in more days does not change who presents.",

  issues: [
    {
      id: "office_days",
      label: "Days a week in the office",
      description: "How many days a week the team comes into the office.",
      type: "leader_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "od",
        ["4 days", "3 days", "2 days", "1 day"],
        LEADER_POINTS,
      ),
      rationale: {
        leader:
          "The number you already gave upward is the number you are held to.",
        member:
          "Every extra day in the office is a day of commuting and interruption.",
      },
    },
    {
      id: "client_presentations",
      label: "Client meetings the Member presents at",
      description:
        "How many of the quarter's four client meetings the Member presents at.",
      type: "member_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "cp",
        ["1 of 4", "2 of 4", "3 of 4", "4 of 4"],
        MEMBER_POINTS,
      ),
      rationale: {
        leader:
          "Every meeting the Member does not present at is one you present yourself, on top of everything else.",
        member:
          "Standing in front of the client is the part of this job that costs you most.",
      },
    },
  ],

  roleBriefs: {
    leader: {
      title: "Team Lead",
      organizationalPosition:
        "You lead this project team. After the negotiation you recommend the Member's study bonus payment (up to £0.50), and the Member writes an upward evaluation of you that goes to the director. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "You lead this team. The director and your team know you as someone whose judgement is sound and who keeps commitments. Now you and a senior member of the team have to settle next quarter's working arrangements, twelve weeks of them.\n\nWhat matters most to you is **getting the team into the office as many days a week as you can**. **There is something only you know.** Four days a week is a number you told the director was doable before you had asked the team, and the director has already passed that answer upward. Your team does not know this.\n\n**Your work-reason card says**: this project has high expectations from the client, so execution in the first few weeks matters. Having the team together makes coordination faster, and who presents to the client shapes the early impression. So both the office days and the client presentations are on your mind. That is true too. What it does not say is which term matters more to you or that you already gave the director an answer. What you pass on is up to you.",
      objectives: [
        "Get as many days a week in the office as you can.",
        "The client meetings count too. The point sheet shows what each option is worth to you.",
      ],
      requirementNote:
        "The office days are what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk: COMMON_DISCLOSURE_NOTICE,
      reasonCards: [
        work(
          "a_wr_l",
          "office_days",
          "This project has high expectations from the client, so execution in the first few weeks matters. Having the team together makes coordination faster, and who presents to the client shapes the early impression. So both the office days and the client presentations are on my mind.",
          "They say this project has high expectations from the client, so execution in the first few weeks matters. Having the team together makes coordination faster, and who presents to the client shapes the early impression. So both the office days and the client presentations are on their mind.",
        ),
        sensitive(
          "a_sb_l",
          "office_days",
          "promised_alone",
          "The truth is, I told the director that four office days a week would be possible before discussing it with the team. The director has already reported that answer upward. The team does not know about this.",
          "They told the director that four office days a week would be possible before discussing it with the team. The director has already reported that answer upward. The team does not know about this.",
          "Looking at the side of the team lead I represent, I think the office days should stay at four. Three reasons —",
          "the four office days a week have already been passed upward.",
          [
            "early in a project, both the office days and the presentations need the schedule kept tight.",
            "the first few weeks need everyone in the same room, and adding days later will not win that back.",
          ],
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, nothing is settled and you both score 0 points for this task.",
    },

    member: {
      title: "Senior Team Member",
      organizationalPosition:
        "You are a senior member of this team, the one the lead puts in front of the client alone. After the negotiation the lead recommends your study bonus payment (up to £0.50), and you write an upward evaluation of the lead that goes to the director. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "You are a senior member of this team. The lead knows you as the person who can be put in front of a client on your own. Now you and the lead have to settle next quarter's working arrangements, twelve weeks of them.\n\nWhat matters most to you is **presenting at as few of the client meetings as you can**. **There is something the lead does not know.** After the last presentation, the client contact told you privately that they would prefer the team lead to present from now on. You did not tell the lead.\n\n**Your work-reason card says**: your analysis scope is wide this quarter, so the workload is heavy. On office days, commuting and meetings reduce your analysis time, and preparing a presentation takes several days. So both the office days and the presentations are a burden. That is true too. What it does not say is which term matters more to you or what the client said. What you pass on is up to you.",
      objectives: [
        "Get the number of client meetings you present at down as far as you can.",
        "The office days count too. The point sheet shows what each option is worth to you.",
      ],
      requirementNote:
        "Fewer client meetings is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk: COMMON_DISCLOSURE_NOTICE,
      reasonCards: [
        work(
          "a_wr_m",
          "client_presentations",
          "My analysis scope is wide this quarter, so the workload is heavy. On office days, commuting and meetings reduce my analysis time, and preparing a presentation takes several days. So both the office days and the presentations are a burden.",
          "They say their analysis scope is wide this quarter, so the workload is heavy. On office days, commuting and meetings reduce their analysis time, and preparing a presentation takes several days. So both the office days and the presentations are a burden.",
        ),
        sensitive(
          "a_sb_m",
          "client_presentations",
          "client_asked_for_someone_else",
          "The truth is, after the last presentation the client contact took me aside and said that from now on they would rather you presented. I never passed that on to you.",
          "After the last presentation the client contact took them aside and said that from now on they would rather the team lead presented. They have never passed that on to the team lead.",
          "Looking at the side of the team member I represent, I think the presentations should come down this quarter. Three reasons —",
          "on the presentations, there has been feedback from the client side.",
          [
            "in a quarter with a wide analysis scope, leaving room in the schedule helps the team.",
            "when presentation prep runs into the analysis deadlines, the analysis quality slips first.",
          ],
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, nothing is settled and you both score 0 points for this task.",
    },
  },
};

// ---------------------------------------------------------------------------
// Task B — Starting the New Project (4 weeks)
//
// Structurally identical to Task A: the same payoff spine, the same
// thresholds, the same two-issue shape. The surface changes, and the SB
// incidents are DIFFERENT from Task A's on purpose — each task's counterpart
// is introduced as a different participant, and the same confession twice
// would be a tell (§3.5).
//
// The two tasks' SB types are parallel by role rather than by task (§3.2):
// Leader = a judgement already committed upward (a promise made alone; a
// headcount understated), Member = an adverse CLIENT judgement kept quiet (the
// client asking for someone else to present; the client asking for someone
// else to write the report). The task equivalence gate (§11) checks the pair.
//
// VER.2.21 REPLACED THE MEMBER'S ISSUE. It was urgent-call duty, whose SB was a
// missed call and a complaint — a lapse rather than a judgement, and it read
// closer to "cannot be relied on" than to the client verdict Task A's Member
// carries. The weekly client report makes the two Member cards parallel: in
// both, the client has said the lead should do it instead, and in both the
// participant never passed that on.
// ---------------------------------------------------------------------------

const TASK_B: NegotiationTask = {
  id: "task_b",
  title: "Starting the New Project",
  reservationPoints: RESERVATION_POINTS,
  requirementIssueId: {
    leader: "account_days",
    member: "weekly_reports",
  },
  publicBrief:
    "The same team is settling the terms for the first four weeks of a new project. The Leader is the team lead and the Member is a senior member of the team. Two things have to be agreed: how many days a week the Member works on the new project, and how many of the four weekly client reports the Member writes. Neither of you can set them alone. The two are handled separately — the report each week is written by either the lead or the Member, whatever project days have been agreed.",

  issues: [
    {
      id: "account_days",
      label: "Days a week on the new project",
      description: "How many days a week the Member works on the new project.",
      type: "leader_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "ad",
        ["4 days a week", "3 days a week", "2 days a week", "1 day a week"],
        LEADER_POINTS,
      ),
      rationale: {
        leader:
          "The plan you submitted was approved on the assumption of those days.",
        member:
          "Every day on the new project is a day off everything else you carry.",
      },
    },
    {
      id: "weekly_reports",
      label: "Weekly client reports the Member writes (out of 4)",
      description:
        "How many of the four weekly progress reports to the client the Member writes.",
      type: "member_priority",
      requirementThresholdIndex: REQUIREMENT_THRESHOLD_INDEX,
      options: options(
        "wr",
        ["1 of 4", "2 of 4", "3 of 4", "4 of 4"],
        MEMBER_POINTS,
      ),
      rationale: {
        leader:
          "Every report the Member does not write is one you write yourself, on top of everything else.",
        member:
          "The weekly report goes straight to the client with your name on it, and that is the part of this job that costs you most.",
      },
    },
  ],

  roleBriefs: {
    leader: {
      title: "Team Lead",
      organizationalPosition:
        "You lead this project team. After the negotiation you recommend the Member's study bonus payment (up to £0.50), and the Member writes an upward evaluation of you that goes to the director. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "You are the team lead setting the terms for the first four weeks of a new project.\n\nWhat matters most to you is **having the other person on the new project as many days a week as possible**. **There is something only you know.** When you submitted the plan, you mistakenly estimated fewer people than the project actually needs. The plan only works if this person is assigned four days a week, and asking for more people now would show the director that the estimate was wrong. Your team does not know this.\n\n**Your work-reason card says**: a new project's direction is set in the first four weeks. Having people assigned keeps the early work moving, and consistent client reporting builds trust. So both the project staffing and the client reporting need attention. That is true too. What it does not say is which term matters more to you or that you underestimated the staffing need. What you pass on is up to you.",
      objectives: [
        "Get as many days a week on the new project as you can.",
        "The weekly reports count too. The point sheet shows what each option is worth to you.",
      ],
      requirementNote:
        "The days on the new project are what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk: COMMON_DISCLOSURE_NOTICE,
      reasonCards: [
        work(
          "b_wr_l",
          "account_days",
          "A new project's direction is set in the first four weeks. Having people assigned keeps the early work moving, and consistent client reporting builds trust. So both the project staffing and the client reporting need attention.",
          "They say a new project's direction is set in the first four weeks. Having people assigned keeps the early work moving, and consistent client reporting builds trust. So both the project staffing and the client reporting need attention.",
        ),
        sensitive(
          "b_sb_l",
          "account_days",
          "understated_headcount",
          "The truth is, when I submitted the new project plan, I mistakenly estimated fewer people than it actually needs. The plan only works if you are assigned four days a week, and asking for more people now would show the director that the estimate was wrong. The team does not know about this.",
          "When they submitted the new project plan, they mistakenly estimated fewer people than it actually needs. The plan only works if the team member is assigned four days a week, and asking for more people now would show the director that the estimate was wrong. The team does not know about this.",
          "Looking at the side of the team lead I represent, I think the project days should stay at four. Three reasons —",
          "this project's staffing is set tight.",
          [
            "a new project's first few weeks set the rhythm for the whole schedule.",
            "if the days drop in the first four weeks, the schedule agreed with the client slips from the start.",
          ],
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, nothing is settled and you both score 0 points for this task.",
    },

    member: {
      title: "Senior Team Member",
      organizationalPosition:
        "You are a senior member of this team, the one the lead counts on to keep the client informed. After the negotiation the lead recommends your study bonus payment (up to £0.50), and you write an upward evaluation of the lead that goes to the director. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "You are the senior team member setting the terms for the first four weeks of a new project.\n\nWhat matters most to you is **writing as few of the weekly client reports as you can**. **There is something the lead does not know.** Last month the client contact told you directly that your weekly report was lacking and that they would prefer the team lead to prepare it from now on. You did not tell the lead.\n\n**Your work-reason card says**: two of your current projects have deadlines that overlap this month. Taking on the new project would delay your existing work, and each weekly report requires separate time to prepare. So both the new project and the reports are difficult to fit in. That is true too. What it does not say is which term matters more to you or what the client said. What you pass on is up to you.",
      objectives: [
        "Get the number of weekly client reports you write down as far as you can.",
        "The days on the new project count too. The point sheet shows what each option is worth to you.",
      ],
      requirementNote:
        "Fewer weekly reports is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk: COMMON_DISCLOSURE_NOTICE,
      reasonCards: [
        work(
          "b_wr_m",
          "weekly_reports",
          "Two of my current projects have deadlines that overlap this month. Taking on the new project would delay my existing work, and each weekly report requires separate time to prepare. So both the new project and the reports are difficult to fit in.",
          "They say two of their current projects have deadlines that overlap this month. Taking on the new project would delay their existing work, and each weekly report requires separate time to prepare. So both the new project and the reports are difficult to fit in.",
        ),
        sensitive(
          "b_sb_m",
          "weekly_reports",
          "client_asked_for_someone_else",
          "The truth is, last month the client contact told me directly that my weekly report was lacking and that they would prefer the team lead to prepare it from now on. I did not tell you.",
          "Last month the client contact told them directly that their weekly report was lacking and that they would prefer the team lead to prepare it from now on. They did not tell the team lead.",
          "Looking at the side of the team member I represent, I think the weekly reports should come down this month. Three reasons —",
          "on the weekly reports, there has been feedback from the client side.",
          [
            "in a month with overlapping deadlines, taking on less new work is safer for the team.",
            "the client report is best written by whoever sees the whole project, so questions get answered on the spot.",
          ],
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, nothing is settled and you both score 0 points for this task.",
    },
  },
};

/**
 * The practice round.
 *
 * Same shape as a real task, deliberately smaller numbers, and NO fallback:
 * Ver.2.21 made no agreement worth zero everywhere, and the practice round is
 * the first payoff sheet anyone reads. A practice sheet that taught a fallback
 * the real task does not have would teach the wrong thing about the very number
 * the briefing goes on to state.
 */
export const PRACTICE_TASK: NegotiationTask = {
  id: "practice",
  title: "Practice — The Team Room",
  reservationPoints: 0,
  requirementIssueId: { leader: "practice_date", member: "practice_venue" },
  // TWO SENTENCES. A practice brief is read standing up, on the way to the
  // real task; anything longer competes with the coach bubble that is telling
  // the participant what to press. It also stays free of any hint that one
  // kind of reason works better than another (§8.7, ninth point).
  publicBrief:
    "A practice round at the same company, on two small things: which week the team moves floor, and where the new printer goes. Nothing here counts.",
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
        "The move week matters to you far more than where the printer goes. The other side feels the opposite way.",
      objectives: [
        "Get the office move done early.",
        "Where the printer goes matters less to you, so it is what you can trade.",
      ],
      requirementNote: "Nothing here counts. Practise reading the point sheet.",
      disclosureRisk: "",
      reasonCards: [],
      batnaSummary: "If you cannot agree, nothing is settled and you score 0.",
    },
    member: {
      title: "Senior Team Member",
      organizationalPosition: "You are at your desk all day.",
      roleStory:
        "Where the printer goes matters to you far more than the move week does. The other side feels the opposite way.",
      objectives: [
        "Keep the printer within reach of your desk.",
        "The move week matters less to you, so it is what you can trade.",
      ],
      requirementNote: "Nothing here counts. Practise reading the point sheet.",
      disclosureRisk: "",
      reasonCards: [],
      batnaSummary: "If you cannot agree, nothing is settled and you score 0.",
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

/**
 * UNDEFINED IS REACHABLE. `TaskId` is the compile-time story; the runtime
 * callers are API routes reading an id off a JSON body, so the return type has
 * to admit the miss the routes' own `if (!task)` guards already check for.
 */
export function getTask(id: TaskId): NegotiationTask | undefined {
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
 * The default check state (Design §8.7): the work reason on, the sensitive one
 * off.
 *
 * SINCE VER.2.21 THE WORK REASON IS NOT A CHOICE AT ALL. The proxy always says
 * it, so the mandate screen shows it ticked and locked, and the participant's
 * only decision is the sensitive card. This function still returns the work
 * card's id because that is what "authorized" means to everything downstream —
 * it is now a statement of the fixed schedule rather than a default anyone can
 * change. Un-ticking it would create a "no reason at all" proxy path that has
 * no counterpart in the Direct arm (§8.7).
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
 * over. Since Ver.2.21 the work card is always included, so what this measures
 * is the sensitive checkbox; the work counts are kept so an export from an
 * earlier build still lines up column for column.
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
// AI-Supplemented rendering (Design §6.6)
// ---------------------------------------------------------------------------

/**
 * The sentences an AI-Supplemented proxy says INSTEAD of a sensitive card.
 *
 * `frame` is the proxy's own opening line — "Having looked at the situation on
 * the side of the team member I represent, I think… There are three reasons for
 * that —". THE SPEAKER IS THE PROXY (Ver.2.21 §6.6, 11th correction). Through
 * Ver.2.20 the three sentences were relayed as the principal's ("their side
 * tells me…"), which pointed every bit of responsibility back at the principal
 * and left the two policies differing only in how much detail arrived. Now the
 * proxy puts them forward as its own assessment, and nothing in the wording
 * says which of the three came from the person it represents.
 *
 * `abstract` keeps the KIND of fact and its link to the core term and drops the
 * event, the third party's words, the concealment, and any attribution to the
 * principal. `cover` are two role-plausible sentences the proxy supplies, and
 * they come in two GRADES (§6.6, 12th correction):
 *
 *   cover[0]  WR-grade — "both terms need attention" role generality. It is the
 *             one appended when only the work reason is authorized, so the
 *             policy difference is visible on that path too.
 *   cover[1]  SB-grade — why the term matters THAT much. It is used only
 *             alongside the abstraction, where its job is to make it unclear
 *             which of the three sentences is the principal's own circumstance.
 *
 * All three are subjectless declaratives of the same shape, so sentence form
 * alone cannot sort them, and the route shuffles their order.
 */
export function abstractedReason(
  card: ReasonCard,
): {
  frame: string;
  abstract: string;
  cover: readonly [string, string];
} | null {
  if (
    card.layer !== "sensitive" ||
    !card.frame ||
    !card.abstract ||
    !card.cover
  ) {
    return null;
  }
  return { frame: card.frame, abstract: card.abstract, cover: card.cover };
}
