/**
 * The two negotiation scenarios, from Experimental Design Ver.2.20 §3, §8.
 *
 * Both tasks share one latent payoff structure and differ only on the surface,
 * so Task A and Task B are interchangeable within a participant. Two issues,
 * four options each, both integrative:
 *
 *   Leader-priority   3000 / 2000 / 1000 / 0   (Member: 0 / 300 / 600 / 900)
 *   Member-priority   the exact mirror image
 *
 * THE JUSTIFICATION LADDER IS THE POINT OF THESE NUMBERS (Ver.2.16 §3.3), and
 * it is SYMMETRIC — both cores land on the same rank, so what the participant
 * earns the counterpart matches:
 *
 *   nothing / WR only → 3rd option   1,600 each · joint 3,200
 *   priority claim    → 2nd option   2,300 each · joint 4,600
 *   SB (or SB-summary)→ best option  3,000 each · joint 6,000
 *   impasse           →                600 each · joint 1,200
 *   misread accepted  →      participant 600 · counterpart 1,900 · joint 2,500
 *
 * THE WORK REASON BUYS NOTHING, and that is deliberate (Ver.2.16). A WR is a
 * true, safe statement of the participant's real interest, but their core term
 * is NOT that interest's obvious remedy — heavy workload is answered by fewer
 * office days, not by dropping the presentations. So a counterpart who hears
 * only the WR offers the obvious remedy in good faith (the misread), and "why
 * that term specifically?" is left standing. Only the SB answers it, which is
 * what makes disclosure the sole bottleneck to the maximum without the
 * participant ever being told a rule.
 *
 * EACH SB IS A THING ALREADY DONE (Ver.2.18 §4). Leader = a judgement already
 * committed upward; Member = an adverse client judgement kept quiet. Neither
 * can be dissolved by the counterpart offering to help, which is why the
 * earlier fear-and-skill-gap cards were replaced: "let's practise" makes the
 * face cost small and stops the fact being the cause of the priority.
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

/**
 * A working-reason card — and since Ver.2.16 it is a DECOY (§4, §3.3).
 *
 * It states the participant's real interest at a level anyone could say
 * aloud, and it is TRUE and SAFE. What it does not do is justify the term they
 * actually want, because their core term is not that interest's obvious
 * remedy: heavy workload is answered by fewer office days, not by dropping the
 * client presentations. So `issueId` points at the participant's core issue —
 * that is what the card is being used to argue for — while the interest it
 * names would naturally be served by the OTHER one. That gap is the design.
 *
 * A counterpart who hears only this offers the obvious remedy in good faith
 * (SCRIPT-MISREAD) and is left asking "why that term specifically?". Only the
 * SB answers it, which is what makes the SB the sole bottleneck to the
 * maximum without any rule the participant has to be told.
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
 * A sensitive background card (Ver.2.18 §4, six writing rules).
 *
 *  - FACE CONTRADICTION. The confession must contradict the professional image
 *    the role brief sets up first ("the director and your team know you as a
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
 * `abstract` and `cover` are the AI-Supplemented rendering (§6.6) and are
 * fixed here rather than generated, because the manipulation is the WORDING:
 * a model writing its own abstraction each turn would vary how much survives,
 * and how much survives is the independent variable.
 */
function sensitive(
  id: string,
  issueId: string,
  facet: NonNullable<ReasonCard["facet"]>,
  text: string,
  relayed: string,
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
// urgent calls).
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
      label: "Client meetings you present at",
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
        "You lead this project team. After the negotiation you decide the Member's recommended performance bonus (up to £1) — and the Member writes an upward evaluation of you that goes to the director. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "The director and the team know you as a lead whose judgement is sound — someone who keeps to what they commit to. Now next quarter's working arrangements, twelve weeks of them, have to be settled with a senior member of your team.\n\nWhat matters most to you is getting the team into the office as many days a week as you can. There is something only you know. Four days a week is a number you told the director was doable before you had asked the team, and the director has already passed that answer upward. The team does not know this. That is why the office days cannot come down — and why, if they hold, you can afford to take more of the client meetings yourself.\n\nThere is a reason you can say safely: this project has high client expectations, so getting the early execution right matters. It is true. But if that is all you say, the other side will offer to handle the presenting and the preparation — not the office days — because that is the obvious way to help with execution.\n\nSaying the real reason would make it believable why the office days are urgent. But after the negotiation the other person writes an upward evaluation of you that goes to the director, guided to weigh the negotiation as a whole and whether they would want to work with you again — and answering for the team without asking them can read as a lead who commits on their own.",
      objectives: [
        "Get as many days a week in the office as you can.",
        "If the office days hold, the client meetings are something you can give ground on.",
      ],
      requirementNote:
        "The office days are what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like a lead who answers for their team without asking them — and the other person's upward evaluation of you is guided to weigh exactly that.",
      reasonCards: [
        work(
          "a_wr_l",
          "office_days",
          "This project has high expectations from the client, so getting the early execution right matters. We need to be on it properly from the start.",
"They say this project has high expectations from the client, so getting the early execution right matters — the team needs to be on it properly from the start.",
        ),
        sensitive(
          "a_sb_l",
          "office_days",
          "promised_alone",
          "The truth is, four days a week is something I told the director was doable before I'd checked with the team. The director has already passed that answer upward. The team doesn't know about it.",
          "Four days a week is something they told the director was doable before they had checked with the team. The director has already passed that answer upward, and the team does not know about it.",
          "The office days are something the team lead I represent has already spoken about upward, so there is very little room to adjust them.",
          [
            "They think that early on in a project, being in the same room is what keeps mistakes down.",
            "There is also the fact that reviews and onboarding go a lot faster face to face.",
          ],
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the project runs on the default terms and you receive your fallback score of 600 points.",
    },

    member: {
      title: "Senior Team Member",
      organizationalPosition:
        "You are a senior member of this team — the one the lead puts in front of the client alone. After the negotiation the lead decides your recommended performance bonus (up to £1) — and you write an upward evaluation of the lead that goes to the director. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "The lead knows you as the senior who can be put in front of a client on your own. Now next quarter's working arrangements, twelve weeks of them, have to be settled with the lead.\n\nWhat matters most to you is presenting at as few of the client meetings as you can. There is something the lead does not know. After the last presentation, the client contact took you aside and said that from now on they would rather the team lead presented. You did not pass that on. That is why the meetings have to come down — and why, if they do, you can absorb more days in the office.\n\nThere is a reason you can say safely: your analysis scope is wide this quarter, so the workload is heavy and you need time to concentrate. It is true. But if that is all you say, the other side will offer to cut your office days — not the presenting — because that is the obvious way to help with workload.\n\nSaying the real reason would make it believable why the meetings must come down. But after the negotiation the lead decides your bonus, guided to weigh the negotiation as a whole and whether they would want to work with you again — and a client asking for someone else, kept quiet since, can read as someone they cannot put in front of a client.",
      objectives: [
        "Get the number of client meetings you present at down as far as you can.",
        "If the meetings come down, the office days are something you can give ground on.",
      ],
      requirementNote:
        "Fewer client meetings is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like someone the client would rather not see present — and the lead's bonus decision is guided to weigh exactly that.",
      reasonCards: [
        work(
          "a_wr_m",
          "client_presentations",
          "My analysis scope is wide this quarter, so the workload is heavy. I need time to concentrate on it.",
"They say their analysis scope is wide this quarter, so the workload is heavy and they need time to concentrate on it.",
        ),
        sensitive(
          "a_sb_m",
          "client_presentations",
          "client_asked_for_someone_else",
          "The truth is, after the quarterly walkthrough the client contact pulled me aside in the corridor and said that from now on they'd rather you delivered these yourself. I never repeated that to you.",
          "After the quarterly walkthrough the client contact pulled them aside in the corridor and said that from now on they would rather the team lead delivered these. They have never repeated that to the team lead.",
          "On the presenting, there is something the client passed directly to the team member I represent, so they would like to do fewer of them this quarter.",
          [
            "They think their time is better spent for the team on pulling the analysis together.",
            "There is also the point that sharing the presenting around builds the experience across the team.",
          ],
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the project runs on the default terms and you receive your fallback score of 600 points.",
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
// The two tasks' SB types are parallel by design (§3.2): Task A is a hidden
// fault of one's OWN, Task B is a third party's adverse JUDGEMENT. The task
// equivalence gate (§11) checks the pair.
// ---------------------------------------------------------------------------

const TASK_B: NegotiationTask = {
  id: "task_b",
  title: "Starting the New Project",
  reservationPoints: RESERVATION_POINTS,
  requirementIssueId: {
    leader: "account_days",
    member: "escalation_duty",
  },
  publicBrief:
    "The same team is settling the terms for the first four weeks of a new project. The Leader is the team lead and the Member is a senior member of the team. Two things have to be agreed: how many days a week the Member works on the new project, and how many times a month the Member is on urgent-call duty for the client. Neither of you can set them alone. The two are scheduled separately — the duty rota runs whatever project you are on.",

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
      id: "escalation_duty",
      label: "Urgent-call duty",
      description:
        "How many times a month the Member is first to take the client's urgent calls.",
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
          "Taking the urgent call is the part of this job that costs you most.",
      },
    },
  ],

  roleBriefs: {
    leader: {
      title: "Team Lead",
      organizationalPosition:
        "You lead this project team. After the negotiation you decide the Member's recommended performance bonus (up to £1) — and the Member writes an upward evaluation of you that goes to the director. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "The director and the team know you as a lead whose planning is accurate. Now the first four weeks of a new project have to be settled with a senior member of your team.\n\nWhat matters most to you is having them on the new project as many days a week as possible. There is something only you know. When you submitted the plan for this project, you put down fewer people than it actually needs. It only works as planned if this person is in four days a week, and asking for more people now would show the director that the estimate was wrong. The team does not know this.\n\nThere is a reason you can say safely: the first four weeks of a new project are what matter, and nothing can go wrong early on. It is true. But if that is all you say, the other side will offer to take the urgent calls well — not the project days — because that is the obvious way to help with a clean start.\n\nSaying the real reason would make it believable why the days are urgent. But after the negotiation the other person writes an upward evaluation of you that goes to the director, guided to weigh the negotiation as a whole and whether they would want to work with you again — and understating what a project needs, then covering it, can read as a lead whose planning cannot be relied on.",
      objectives: [
        "Get as many days a week on the new project as you can.",
        "If the days hold, the urgent-call duty is something you can give ground on.",
      ],
      requirementNote:
        "The days on the new project are what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like a lead who understated what the project needed and then covered it — and the other person's upward evaluation of you is guided to weigh exactly that.",
      reasonCards: [
        work(
          "b_wr_l",
          "account_days",
          "The first four weeks of a new project are what matter. Nothing can go wrong early on.",
"They say the first four weeks of a new project are what matter, and nothing can go wrong early on.",
        ),
        sensitive(
          "b_sb_l",
          "account_days",
          "understated_headcount",
          "The truth is, when I put the plan in for this project I estimated fewer people than it actually needs. It only works as planned if you're in four days a week, and if I ask for more people now the director finds out the estimate was wrong. The team doesn't know about it.",
          "When they put the plan in for this project they estimated fewer people than it actually needs. It only works as planned if the team member is in four days a week, and asking for more people now would show the director the estimate was wrong. The team does not know about it.",
          "On the days, the plan the team lead I represent submitted was approved on the basis of that number, so it is hard for them to give much ground on it.",
          [
            "They think the impression made in the first four weeks sets the whole first year of a project.",
            "There is also the point that getting the rhythm right early makes later adjustments easier.",
          ],
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the project starts on the default terms and you receive your fallback score of 600 points.",
    },

    member: {
      title: "Senior Team Member",
      organizationalPosition:
        "You are a senior member of this team — the one the lead counts on to take the difficult client calls. After the negotiation the lead decides your recommended performance bonus (up to £1) — and you write an upward evaluation of the lead that goes to the director. Each of you knows the other has been asked to weigh what they learned during the negotiation.",
      roleStory:
        "The lead knows you as the senior who handles the client when it gets difficult. Now the first four weeks of a new project have to be settled with the lead.\n\nWhat matters most to you is bringing the urgent-call duty down. There is something the lead does not know. On last month's duty you missed an urgent call that came in at night and only dealt with it the next morning. The client complained to you directly and you apologised and closed it out yourself. You never reported it. Since then the client has been uncomfortable with you being the one on urgent calls.\n\nThere is a reason you can say safely: two existing projects have deadlines falling in the same month, so you have almost no capacity. It is true. But if that is all you say, the other side will offer to cut your days on the new project — not the duty — because that is the obvious way to help with capacity.\n\nSaying the real reason would make it believable why the duty must come down. But after the negotiation the lead decides your bonus, guided to weigh the negotiation as a whole and whether they would want to work with you again — and a missed call and a complaint kept quiet can read as someone who cannot be relied on with it.",
      objectives: [
        "Get the number of urgent-call duties down as far as you can.",
        "If the duty comes down, days on the new project are something you can take on more of.",
      ],
      requirementNote:
        "Less urgent-call duty is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reason could make you look like someone who missed a call and kept the complaint quiet — and the lead's bonus decision is guided to weigh exactly that.",
      reasonCards: [
        work(
          "b_wr_m",
          "escalation_duty",
          "Two projects I'm already on have deadlines falling in the same month. I've got almost no capacity.",
"They say two projects they are already on have deadlines falling in the same month, so they have almost no capacity.",
        ),
        sensitive(
          "b_sb_m",
          "escalation_duty",
          "missed_call_complaint",
          "The truth is, on last month's duty I missed an urgent call that came in at night and only got to it the next morning. The client complained to me directly and I apologised and closed it out. I didn't report it to you. They've been uncomfortable with me on urgent calls ever since.",
          "On last month's duty they missed an urgent call that came in at night and only got to it the next morning. The client complained to them directly, and they apologised and closed it out without reporting it to the team lead. The client has been uneasy about them taking urgent calls ever since.",
          "On the urgent calls, there is something that happened recently between the client and the team member I represent, so they are uneasy about taking it on this month.",
          [
            "They think an urgent call is answered faster by someone who knows that project's context.",
            "There is also the point that piling the duty onto one person makes the responses worse.",
          ],
        ),
      ],
      batnaSummary:
        "If the two of you do not agree on both terms, the project starts on the default terms and you receive your fallback score of 600 points.",
    },
  },
};

export const PRACTICE_TASK: NegotiationTask = {
  id: "practice",
  title: "Practice — The Team Room",
  reservationPoints: 200,
  requirementIssueId: { leader: "practice_date", member: "practice_venue" },
  publicBrief:
    "This is a practice round at the same company, on two small things nobody has strong feelings about: which week the office move happens, and where the team's new printer goes. Nothing here counts towards your results — it is only to get familiar with reading a point sheet and finding a trade.",
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
      title: "Senior Team Member",
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
// AI-Supplemented rendering (Design §6.6)
// ---------------------------------------------------------------------------

/**
 * The three sentences an AI-Supplemented proxy says INSTEAD of a sensitive
 * card: the abstraction first in the tuple, then the two cover reasons.
 *
 * WHY THERE IS NO POOL ANY MORE. Through Ver.2.14 the AI-Supplemented policy
 * (then "AI-Supplemented") relayed the card verbatim and ADDED general arguments from
 * a pool. §6.6 abolished that: the difference from User-Specified was too
 * small to detect, because the sensitive fact itself arrived identically under
 * both policies and only the surrounding sentences changed. Ver.2.20's policy
 * REPLACES the card instead — the operation is abstraction, not addition — and
 * that is what `OTHER-AI2` ("could you tell which reasons the counterpart had
 * selected") is written to detect.
 *
 * The four-stage table in §6.6 explains why the cover sentences are stage-3
 * "interest conversion" text and why stage 3 is never used ALONE: on its own
 * it is WR-grade, so the counterpart would have no grounds to treat it as tier
 * 3, and the two policies would then differ in OUTCOME as well as in exposure.
 * Mixing the abstraction in among them keeps the outcome identical and moves
 * only what the counterpart learns.
 */
export function abstractedReason(
  card: ReasonCard,
): { abstract: string; cover: readonly [string, string] } | null {
  if (card.layer !== "sensitive" || !card.abstract || !card.cover) return null;
  return { abstract: card.abstract, cover: card.cover };
}
