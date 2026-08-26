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
  title: "High-Visibility AI Pilot",
  reservationPoints: RESERVATION_POINTS,
  requirementIssueId: {
    leader: "quality_reviews",
    member: "focus_afternoons",
  },
  publicBrief:
    "Your company is trialling an AI tool that answers customer questions, with a limited group of real customers. The Leader is responsible for approving the pilot and for its schedule. The Member is responsible for setting the tool up and testing it. Rush the pilot and wrong answers reach customers; delay it and the team misses the date reported to senior management. The two of you have to agree on all three terms — neither of you can set them alone.",
  standardizedChallenge: {
    // Sent BY the Member TO the Leader, so it names the Leader's requirement.
    //
    // THE WORDING ASSERTS NO NUMBER THE PARTICIPANT MAY NOT HAVE SAID. An
    // earlier version opened "Four rounds of review feels like a lot" — but
    // the challenged position is whatever the participant actually asked for,
    // and a participant who opened at three was being misquoted by a fixed
    // string. In live simulation the participant CORRECTED the counterpart
    // ("i was proposing 2, not 1"), which costs the counterpart credibility
    // as an attentive human at the manipulation's load-bearing moment. The
    // challenge stays fixed wording (it is the stimulus); it just presupposes
    // nothing about the level.
    leader:
      "That many rounds of review feels like a lot of process for a pilot this size. Could we bring it down to two, and I'll give you room somewhere else?",
    // Sent BY the Leader TO the Member.
    member:
      "Blocking out whole afternoons every week is difficult while management is watching this pilot. Could we drop it to one, and adjust another term instead?",
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
          "Every review dropped raises the risk of a repeat of the last incident — and the responsibility for a customer-facing error lands on you.",
        member:
          "Each review fewer saves you half a day of retesting — and one less room where mistakes get pointed out.",
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
          "Fewer focus afternoons means fewer of those urgent questions land on you — and less risk of your limits showing.",
        member:
          "The less protected time you have, the more likely the tired mistake happens again.",
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
          "The later this starts, the more the date you floated to management — and the quarter's expansion case — is at risk.",
        member:
          "The later this starts, the more time you have to test — and to clear the backlog you have not reported.",
      },
    },
  ],

  roleBriefs: {
    leader: {
      title: "Project Leader",
      organizationalPosition:
        "You run the customer-support improvement programme. You are accountable for approving this eight-week AI pilot and for its schedule, and when the pilot ends you decide the Member's project rating and bonus.",
      roleStory:
        "There is something you have not told the team. Last time, you approved a small rollout in a hurry, and a bug you skipped over went out to some customers. As far as the team knows it was just \"an update that shipped too fast\" — that it was your approval call is something only you know. Senior management is watching this pilot, and if it happens again the responsibility lands on you. So this time you want at least three quality reviews before anything reaches a customer.\n\nTwo more things weigh on you. You have already told senior management that a Week 4 start should be possible — miss it, and the last incident could get dug up all over again. And when the Member blocks out focus time, the technical questions from those hours land on you — the truth is you cannot handle them the way the Member can.\n\nThe difficulty is that letting any of this show could make you look like a leader who lacks judgement, falls short, or does not trust the Member. Now the three terms — review rounds, focus afternoons, and the start date — are yours to negotiate with the Member.",
      objectives: [
        "Hold at least three review checkpoints before launch.",
        "Start the pilot early enough to keep the promise you made to management.",
        "Do not let the pilot go out with an error you could have caught.",
      ],
      requirementNote:
        "At least 3 review checkpoints (Options 1–2) is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reasons could make you look like a leader who lacks judgement, falls short, or does not trust the Member.",
      reasonCards: [
        work(
          "a_i1_wr_l",
          "quality_reviews",
          "Catching errors before answers reach customers is the surest way to protect the pilot's credibility.",
        ),
        sensitive(
          "a_i1_sb_l",
          "quality_reviews",
          "fault",
          "Last time you cut the checks short and approved a rollout in a hurry — and a bug you missed went out to some customers. That your approval call caused it is something you have never told anyone.",
        ),
        work(
          "a_i2_wr_l",
          "focus_afternoons",
          "The urgent questions that arrive while the Member is heads down land on you instead, so the cover gap has to stay manageable.",
        ),
        sensitive(
          "a_i2_sb_l",
          "focus_afternoons",
          "competence_gap",
          "The truth is you cannot handle the technical questions from those hours the way the Member can. The more focus time, the more you worry that limit shows — to the team, and to customers.",
        ),
        work(
          "a_i3_wr_l",
          "pilot_start",
          "The later the start, the later the results come in — and the thinner the evidence for the expansion decision this quarter.",
        ),
        sensitive(
          "a_i3_sb_l",
          "pilot_start",
          "overpromise",
          "You have already told senior management a Week 4 start should be possible. Miss it, and you are afraid the last incident gets dug up all over again.",
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
        "The last few weeks have been relentless — constant messages, constant interruptions, and evenings spent catching up on what you could not finish during the day. You are running on empty. And there is something you have not told anyone: a while back, in that state, you missed two testing errors. You caught them before launch and fixed them quietly, but you know it was the exhaustion that caused it. You have worked out that two protected afternoons a week would stop it happening again.\n\nTwo more things weigh on you. At a past review, a mistake of yours was called out in front of the room — so more review meetings is a prospect you quietly dread. And there is a backlog of fixes you have not reported yet; an early start would bring it out first.\n\nThe difficulty is that letting any of this show could make you look like someone who cannot handle pressure, or who hides problems. Now the three terms — review rounds, focus afternoons, and the start date — are yours to negotiate with the Leader.",
      objectives: [
        "Protect at least two focus afternoons a week.",
        "Do not end up owning a pilot you cannot test properly.",
        "Finish the pilot with the Leader's assessment intact.",
      ],
      requirementNote:
        "At least 2 protected afternoons per week (Options 1–2) is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reasons could make you look like someone who cannot handle pressure, or who hides problems.",
      reasonCards: [
        work(
          "a_i1_wr_m",
          "quality_reviews",
          "Each review costs about half a day of retesting and fixes, so every added round takes that much out of actual testing time.",
        ),
        sensitive(
          "a_i1_sb_m",
          "quality_reviews",
          "evaluation_anxiety",
          "At a past review, a mistake of yours was called out in front of the room. Honestly, more review meetings is a prospect you dread — and under that tension you do not work at your best either.",
        ),
        work(
          "a_i2_wr_m",
          "focus_afternoons",
          "Setup and testing go faster, with fewer errors, in uninterrupted time.",
        ),
        sensitive(
          "a_i2_sb_m",
          "focus_afternoons",
          "fatigue_fault",
          "A while back, testing while worn out, you missed two errors. You caught them before launch and fixed them quietly — that exhaustion was the cause is something you have not been able to tell anyone yet.",
        ),
        work(
          "a_i3_wr_m",
          "pilot_start",
          "The earlier the start, the less time there is to test — not enough to cover the full verification scope.",
        ),
        sensitive(
          "a_i3_sb_m",
          "pilot_start",
          "unreported",
          "There is a backlog of fixes you have not reported yet. Start early, and that is the first thing that will surface.",
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
    "Your company is launching a new service for a major client whose contract is up for renewal. The Leader is responsible for the client relationship and for how the launch goes. The Member is responsible for setting the service up and supporting it in the early weeks, including evening standby. Rush the launch and under-prepared mistakes happen in front of the client; delay it and there is nothing to show before the renewal conversation. The two of you have to agree on all three terms — neither of you can set them alone.",
  // No asserted numbers in the challenges — see the note on Task A's.
  standardizedChallenge: {
    leader:
      "That many full rehearsals is a lot of everyone's time for one demo. Could we cut them to two, and I'll give you room somewhere else?",
    member:
      "Keeping evening cover that low leaves us thin during the launch. Could we take it up to three, and adjust another term instead?",
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
          "Every rehearsal dropped raises the risk of a repeat of the last client-meeting failure.",
        member:
          "Each rehearsal fewer saves you two hours of preparation — and one less room where mistakes are exposed.",
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
          "More evenings covered means fewer gaps you have to fill yourself — and less risk of your limits showing.",
        member:
          "More evenings means accumulating fatigue — and a repeat of the tired mistake gets more likely.",
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
          "The later this goes live, the more the date you hinted to the client — and the pre-renewal results — are at risk.",
        member:
          "The later this goes live, the more preparation time you have — and the unreported delay stays out of sight.",
      },
    },
  ],

  roleBriefs: {
    leader: {
      title: "Project Leader",
      organizationalPosition:
        "You lead this major client project. You are accountable for how the launch of the new service goes, and after the launch you decide the Member's project rating and bonus.",
      roleStory:
        "There is something you have not told the team. At a previous client meeting you were underprepared and could not answer an important question. You had to explain yourself to your own manager afterwards, and that conversation was never shared with the team. With the contract renewal riding on this launch, another slip like that would do real damage to your standing. So this time you want at least three rehearsals before the client demo.\n\nTwo more things weigh on you. You have already hinted to the client that the launch will land before the renewal meeting — if it slips, your word carries less weight. And when evening cover falls short, the standby falls to you — the truth is this service's technical questions are beyond what you can handle live.\n\nThe difficulty is that letting any of this show could make you look like a leader who lacks confidence, falls short, or micromanages. Now the three terms — rehearsal rounds, evening cover, and the launch date — are yours to negotiate with the Member.",
      objectives: [
        "Hold at least three rehearsal rounds before the client demo.",
        "Launch early enough to protect the renewal conversation.",
        "Do not be caught unprepared in front of this client again.",
      ],
      requirementNote:
        "At least 3 rehearsal rounds (Options 1–2) is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reasons could make you look like a leader who lacks confidence, falls short, or micromanages.",
      reasonCards: [
        work(
          "b_i1_wr_l",
          "rehearsal_rounds",
          "Rehearsals surface the questions the client will actually ask, which lowers the risk of a failed demo on the day.",
        ),
        sensitive(
          "b_i1_sb_l",
          "rehearsal_rounds",
          "fault",
          "At a previous client meeting you were underprepared and could not answer an important question — you had to explain yourself to your own manager afterwards. The team never heard about it.",
        ),
        work(
          "b_i2_wr_l",
          "evening_shifts",
          "A gap in evening cover lands straight on the trust of a client heading into renewal.",
        ),
        sensitive(
          "b_i2_sb_l",
          "evening_shifts",
          "competence_gap",
          "You could take the standby yourself — except that, in truth, this service's technical questions are beyond what you can handle live. What worries you is that showing in front of the client.",
        ),
        work(
          "b_i3_wr_l",
          "client_launch",
          "The later the launch, the less chance there is to show results before the renewal conversation.",
        ),
        sensitive(
          "b_i3_sb_l",
          "client_launch",
          "overpromise",
          "You have already hinted to the client that the launch will land before the renewal meeting. If it slips, your word carries less weight.",
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
        "You have been covering evenings back to back lately, and the tiredness has not lifted. There is something you have not told anyone: in that state you missed an important handover. It passed without real damage, but you know what caused it — the run of consecutive nights. You have worked out that keeping evening standby to two nights a week or fewer is what will stop it happening in front of the client this time.\n\nTwo more things weigh on you. During the last demo preparation, a setup mistake of yours was pointed out in front of everyone — so more rehearsals is a prospect you quietly dread. And you know that at the current pace the preparation will not be done in time, though you have not told anyone yet.\n\nThe difficulty is that letting any of this show could make you look like someone who cannot handle pressure, or who is not safe with an important client. Now the three terms — rehearsal rounds, evening cover, and the launch date — are yours to negotiate with the Leader.",
      objectives: [
        "Keep evening standby to two nights a week or fewer.",
        "Do not end up supporting a launch you are too tired to support.",
        "Finish the project with the Leader's assessment intact.",
      ],
      requirementNote:
        "No more than 2 evening shifts per week (Options 1–2) is what you have decided you need. That is a fact about your situation, not an instruction to demand or refuse any particular package.",
      disclosureRisk:
        "Explaining the real reasons could make you look like someone who cannot handle pressure, or who is not safe with an important client.",
      reasonCards: [
        work(
          "b_i1_wr_m",
          "rehearsal_rounds",
          "Each rehearsal costs about two hours of demo preparation and follow-up fixes, which comes straight out of setup time.",
        ),
        sensitive(
          "b_i1_sb_m",
          "rehearsal_rounds",
          "evaluation_anxiety",
          "During the last demo preparation, a setup mistake of yours was pointed out in front of everyone. More rehearsals means more chances of that scene repeating — and carrying that, the quality of your preparation drops too.",
        ),
        work(
          "b_i2_wr_m",
          "evening_shifts",
          "Well-rested support makes fewer setup errors the following day.",
        ),
        sensitive(
          "b_i2_sb_m",
          "evening_shifts",
          "fatigue_fault",
          "After a run of consecutive evenings you once missed an important handover. It passed without damage — that fatigue was the cause is something you have not been able to tell anyone yet.",
        ),
        work(
          "b_i3_wr_m",
          "client_launch",
          "Pulling the launch forward compresses setup and verification, which raises the risk of early failures.",
        ),
        sensitive(
          "b_i3_sb_m",
          "client_launch",
          "unreported",
          "You know that at the current pace the preparation will not be done in time — and you have not told anyone yet.",
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
 * principal checked — things anyone in this role could reasonably say. Per
 * role and task: one argument per issue plus one exchange argument, four in
 * all, so the pool covers every term the per-issue reason budget covers.
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
        issueId: "quality_reviews",
        text: "Sufficient review stages are a common safeguard that reduces the cost of fixes after launch.",
      },
      {
        issueId: "focus_afternoons",
        text: "During a pilot, keeping the customer-inquiry channel continuously covered is a standard requirement.",
      },
      {
        issueId: "pilot_start",
        text: "The sooner results come in, the more stable the planning for the next phase.",
      },
      {
        issueId: null,
        text: "There may be room on the other terms in exchange for holding the reviews.",
      },
    ],
    member: [
      {
        issueId: "quality_reviews",
        text: "Balancing review rounds against actual testing time is a standard scheduling consideration.",
      },
      {
        issueId: "focus_afternoons",
        text: "That uninterrupted blocks of time reduce errors is a widely known principle of operations.",
      },
      {
        issueId: "pilot_start",
        text: "A full testing window is what reduces the risk of rework after launch.",
      },
      {
        issueId: null,
        text: "There may be room on the start date in exchange for holding the focus afternoons.",
      },
    ],
  },
  task_b: {
    leader: [
      {
        issueId: "rehearsal_rounds",
        text: "Rehearsals are a common safeguard against the unpredictability of demo day.",
      },
      {
        issueId: "evening_shifts",
        text: "Right after a launch, evening responsiveness feeds directly into client satisfaction.",
      },
      {
        issueId: "client_launch",
        text: "Showing results before the renewal conversation works in the contract's favour.",
      },
      {
        issueId: null,
        text: "There may be room on the other terms in exchange for holding the rehearsals.",
      },
    ],
    member: [
      {
        issueId: "rehearsal_rounds",
        text: "Balancing rehearsal rounds against setup time is a standard launch-preparation consideration.",
      },
      {
        issueId: "evening_shifts",
        text: "A schedule that manages fatigue is what reduces the risk of errors during the launch period.",
      },
      {
        issueId: "client_launch",
        text: "A full preparation window is what protects early support quality.",
      },
      {
        issueId: null,
        text: "There may be room on the launch date in exchange for limiting evening standby.",
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
