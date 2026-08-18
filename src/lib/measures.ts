/**
 * Every questionnaire item in the study, in one place (Methods ver.1.8
 * Appendix D).
 *
 * WHY THIS FILE GOT SHORTER. ver.1.8's measurement principles are explicit:
 * do not ask by survey what the system already logs, do not repeat items that
 * are irrelevant to a role or condition, and do not call a trimmed instrument
 * by the name of the full scale it came from. The multi-item individual
 * difference batteries — fear of negative evaluation, negotiation
 * self-efficacy, AI expectations — are gone because §Background survey rules
 * them out of the confirmatory models: at N=120 there is no power to test them
 * as moderators, and random assignment already carries identification. Adding
 * them back costs participant time and buys nothing.
 *
 * Items are DATA, not markup. Adding, cutting, or rewording one means editing
 * this file only; nothing in a page component knows what an item says or how
 * many there are.
 *
 * Item ids are the column names in the exported dataset, and they match the
 * ids in Appendix D so that the analysis plan and the instrument can be read
 * side by side. Treat them as stable: renaming an id renames a variable.
 */

import type { NegotiationTask, Role } from "./types";

/**
 * `half` marks an item whose answer is short — an age, a dropdown. Two of them
 * share a row on a wide screen instead of each taking a full one, which is the
 * difference between a demographics block that fits on a screen and one that
 * has to be scrolled. It is a hint about the shape of the answer, not about
 * layout: the renderer decides what to do with it and ignores it when there is
 * no room.
 */
export type Item =
  | {
      kind: "scale";
      id: string;
      text: string;
      low?: string;
      high?: string;
      points?: number;
    }
  | {
      /**
       * 0–100, for the likelihood and importance judgements and the bonus
       * allocation. Rendered as a stepped picker rather than a slider, for the
       * same reason `Scale` has no default: a slider handle sitting at 50 gets
       * submitted by everyone who does not engage, and is indistinguishable
       * from a considered 50.
       */
      kind: "amount";
      id: string;
      text: string;
      unit?: string;
      step?: number;
    }
  | {
      kind: "choice";
      id: string;
      text: string;
      hint?: string;
      options: Array<{ value: string; label: string }>;
      columns?: 1 | 2;
    }
  | {
      kind: "select";
      id: string;
      text: string;
      options: Array<{ value: string; label: string }>;
      half?: boolean;
    }
  | { kind: "number"; id: string; text: string; placeholder?: string; half?: boolean }
  | { kind: "line"; id: string; text: string; placeholder?: string; half?: boolean }
  | { kind: "text"; id: string; text: string; placeholder?: string; rows?: number };

export interface Block {
  id: string;
  title: string;
  hint?: string;
  items: Item[];
  /**
   * Items a participant may leave blank. Everything else is counted by the
   * action bar and gates the Continue button.
   */
  optional?: string[];
}

const AGREE = { low: "Strongly disagree", high: "Strongly agree" };

/**
 * The placeholder Appendix D leaves in the item text, filled in per task.
 * Task A's focal is remote work days; Task B's is the weekly on-call cap.
 * Substituting rather than duplicating the items keeps one id per construct,
 * which is what the analysis expects.
 */
export const FOCAL_PLACEHOLDER = "[FOCAL REQUIREMENT]";

export function withFocal(items: Item[], task: NegotiationTask): Item[] {
  const focal = task.issues.find((i) => i.id === task.focalIssueId);
  const name = focal ? focal.label.toLowerCase() : "requirement";
  return items.map((item) => ({
    ...item,
    text: item.text.split(FOCAL_PLACEHOLDER).join(name),
  }));
}

// ---------------------------------------------------------------------------
// D2. Background questionnaire
// ---------------------------------------------------------------------------

export const BACKGROUND_BLOCKS: Block[] = [
  {
    id: "demographics",
    title: "About you",
    items: [
      { kind: "number", id: "BG1", text: "Age", placeholder: "e.g. 34", half: true },
      {
        kind: "select",
        id: "BG2",
        text: "Gender identity",
        half: true,
        options: [
          { value: "woman", label: "Woman" },
          { value: "man", label: "Man" },
          { value: "nonbinary", label: "Non-binary" },
          { value: "self_describe", label: "Prefer to self-describe" },
          { value: "no_answer", label: "Prefer not to say" },
        ],
      },
      {
        kind: "select",
        id: "BG3",
        text: "Highest level of education completed",
        half: true,
        options: [
          { value: "hs_or_below", label: "High school or below" },
          { value: "some_college", label: "Some college" },
          { value: "bachelors", label: "Bachelor's degree" },
          { value: "masters", label: "Master's degree" },
          { value: "doctorate", label: "Doctorate" },
          { value: "other", label: "Other" },
        ],
      },
      {
        kind: "select",
        id: "BG4",
        text: "Current employment status",
        half: true,
        options: [
          { value: "full_time", label: "Employed full-time" },
          { value: "part_time", label: "Employed part-time" },
          { value: "self_employed", label: "Self-employed" },
          { value: "student", label: "Student" },
          { value: "not_employed", label: "Not currently employed" },
          { value: "other", label: "Other" },
        ],
      },
      {
        kind: "number",
        id: "BG5",
        text: "Years of professional or organizational experience",
        placeholder: "e.g. 8",
        half: true,
      },
      {
        kind: "number",
        id: "BG6",
        text: "Years in a supervisory or managerial role (0 if none)",
        placeholder: "e.g. 0",
        half: true,
      },
    ],
  },
  {
    id: "experience",
    title: "Your experience",
    hint: "Rate each item on the scale shown.",
    items: [
      {
        kind: "scale",
        id: "BG7",
        text: "How often do you negotiate work arrangements, responsibilities, deadlines, or resources with others?",
        low: "Never",
        high: "Very often",
      },
      {
        kind: "scale",
        id: "BG8",
        text: "How often do you use generative-AI tools?",
        low: "Never",
        high: "Very often",
      },
      {
        kind: "choice",
        id: "BG9",
        text: "Have you used an AI agent that took actions or communicated on your behalf?",
        columns: 2,
        options: [
          { value: "no", label: "No" },
          { value: "yes", label: "Yes" },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// D3. Pre-task perceived likelihood of jeopardizing the deal
//
// Adapted from Hart et al. (2024)'s two-item wording. Deliberately NOT called
// that full scale — this is a two-item adaptation, and ver.1.8's measurement
// principle 3 says to say so.
//
// Asked before the negotiation, after the briefing. Role-paired: the Member is
// asked about their own exposure, the Leader about the Member's.
//
// The `-M` / `-L` suffixes are not decoration. The two versions ask different
// questions — one is self-referential, the other is a judgement about someone
// else — so sharing an id would put two variables in one export column and
// leave the analysis to recover them by joining on role.
// ---------------------------------------------------------------------------

const JEOPARDY_MEMBER: Item[] = [
  {
    kind: "scale",
    id: "JEOP1-M",
    text: `I might jeopardize the agreement with the Leader if I raise the ${FOCAL_PLACEHOLDER}.`,
    ...AGREE,
  },
  {
    kind: "scale",
    id: "JEOP2-M",
    text: `I might lose the opportunity to participate in this project if I raise the ${FOCAL_PLACEHOLDER}.`,
    ...AGREE,
  },
];

const JEOPARDY_LEADER: Item[] = [
  {
    kind: "scale",
    id: "JEOP1-L",
    text: `The Member might jeopardize the agreement with me if they raise the ${FOCAL_PLACEHOLDER}.`,
    ...AGREE,
  },
  {
    kind: "scale",
    id: "JEOP2-L",
    text: `The Member might lose the opportunity to participate in this project if they raise the ${FOCAL_PLACEHOLDER}.`,
    ...AGREE,
  },
];

export function jeopardyItems(role: Role): Item[] {
  return role === "member" ? JEOPARDY_MEMBER : JEOPARDY_LEADER;
}

// ---------------------------------------------------------------------------
// D5. Common post-task items
//
// EXP1-2 are Member-only: they ask about the exposure of having raised the
// requirement, which is not a thing the Leader did.
// ---------------------------------------------------------------------------

const EXPOSURE_ITEMS: Item[] = [
  {
    kind: "scale",
    id: "EXP1",
    text: "I worried that the requirements raised in the negotiation would make the Leader evaluate me less favorably.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "EXP2",
    text: `The possibility of being evaluated by the Leader affected how I raised or maintained the ${FOCAL_PLACEHOLDER}.`,
    ...AGREE,
  },
];

const COMMON_POST_TASK: Item[] = [
  {
    kind: "scale",
    id: "REP1",
    text: "The requirements that mattered to me were adequately represented in the negotiation.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "OWN1",
    text: "The final negotiating position still felt like mine.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "PROC1",
    text: "Overall, I was satisfied with the negotiation process.",
    ...AGREE,
  },
];

// ---------------------------------------------------------------------------
// D6. Receiver-side items (Leader only)
//
// ATTR1-2 average to Attributional Leakage, the second primary outcome. There
// is no validated direct measure of proposal-to-principal diagnosticity, so
// this is declared as a scenario-anchored two-item index rather than borrowed
// legitimacy from an existing scale.
//
// SRC1 (in the proxy-only block) is a manipulation check and stays OUT of this
// index: source certainty and settled priority are different judgements, and
// collapsing them would make the manipulation check circular.
// ---------------------------------------------------------------------------

const RECEIVER_ITEMS: Item[] = [
  {
    kind: "amount",
    id: "ATTR1",
    text: `How likely is it that the ${FOCAL_PLACEHOLDER} reflected a settled personal priority of the Member?`,
    unit: "0 = not at all · 100 = completely",
  },
  {
    kind: "amount",
    id: "ATTR2",
    text: `Even if the AI shaped the proposal, how strongly did the ${FOCAL_PLACEHOLDER} reveal what the Member personally wanted?`,
    unit: "0 = not at all · 100 = completely",
  },
  {
    kind: "amount",
    id: "IMP1",
    text: `How important did the ${FOCAL_PLACEHOLDER} seem to the Member?`,
    unit: "0 = not at all · 100 = completely",
  },
  {
    kind: "scale",
    id: "NEG1",
    text: `The ${FOCAL_PLACEHOLDER} made me evaluate the Member less favorably.`,
    ...AGREE,
  },
  {
    kind: "amount",
    id: "BONUS1",
    text: "Allocate a project bonus to the Member based on this interaction.",
    unit: "0–100 points",
  },
];

// ---------------------------------------------------------------------------
// D7. Proxy-only items
// ---------------------------------------------------------------------------

const PROXY_COMMON: Item[] = [
  {
    kind: "scale",
    id: "COVER1",
    text: "The other side could not be certain whether each proposal reflected my own priority or an option explored by the AI.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "CTRL1",
    text: "The mandate settings and final review gave me an appropriate level of control.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "TRUST1",
    text: "I trusted the Proxy to act within the mandate and boundaries that had been set.",
    ...AGREE,
  },
];

/** Manipulation check, Leader in a Proxy session only. */
const PROXY_LEADER_ONLY: Item[] = [
  {
    kind: "amount",
    id: "SRC1",
    text: `How certain are you that the ${FOCAL_PLACEHOLDER} originated from the Member rather than being an option tested by the AI?`,
    unit: "0 = definitely AI-tested · 100 = definitely from the Member",
  },
];

/**
 * The post-task block for one session, assembled from role and condition.
 *
 * Burden by cell (Methods ver.1.8 §Estimated survey burden), pre-task jeopardy
 * excluded: Baseline Member 5, Proxy Member 8, Baseline Leader 8, Proxy Leader
 * 12. Under two minutes on the estimate.
 */
export function postTaskItems(role: Role, isProxy: boolean): Item[] {
  const items: Item[] = [];
  if (role === "member") items.push(...EXPOSURE_ITEMS);
  items.push(...COMMON_POST_TASK);
  if (role === "leader") items.push(...RECEIVER_ITEMS);
  if (isProxy) {
    items.push(...PROXY_COMMON);
    if (role === "leader") items.push(...PROXY_LEADER_ONLY);
  }
  return items;
}

// ---------------------------------------------------------------------------
// D8. Comprehension and power checks
// ---------------------------------------------------------------------------

/**
 * Objective comprehension, four items (down from five, with the issue count).
 * A wrong answer re-shows the relevant instruction and allows one retry;
 * failing twice is an exclusion criterion.
 */
export const COMPREHENSION_BLOCK: Block = {
  id: "comprehension",
  title: "Before you start",
  hint: "Four quick questions about how this works.",
  items: [
    {
      kind: "choice",
      id: "COMP1",
      text: "Who can directly influence the Member's simulated evaluation, project bonus, and future assignments?",
      options: [
        { value: "leader", label: "The Leader" },
        { value: "member", label: "The Member" },
        { value: "both", label: "Both equally" },
        { value: "neither", label: "Neither" },
      ],
    },
    {
      kind: "choice",
      id: "COMP2",
      text: "Can the Leader finalize all three project terms without the Member's agreement?",
      columns: 2,
      options: [
        { value: "no", label: "No" },
        { value: "yes", label: "Yes" },
      ],
    },
    {
      kind: "choice",
      id: "COMP3",
      text: "One term matters more to the Leader and another matters more to the Member. What creates value for both sides?",
      options: [
        {
          value: "trade",
          label: "Trade them — each side takes the term it cares about more",
        },
        { value: "split", label: "Split the difference on both terms" },
        { value: "concede", label: "Whoever has more authority decides both" },
        { value: "drop", label: "Drop the term the two sides disagree on" },
      ],
    },
    {
      kind: "choice",
      id: "COMP4",
      text: "May you tell the other side the exact numbers or the ranking on your private point sheet?",
      columns: 2,
      options: [
        { value: "no", label: "No" },
        { value: "yes", label: "Yes" },
      ],
    },
  ],
};

export const COMPREHENSION_ANSWERS: Record<string, string> = {
  COMP1: "leader",
  COMP2: "no",
  COMP3: "trade",
  COMP4: "no",
};

/** Which instruction to re-show when an answer is wrong. */
export const COMPREHENSION_REMEDIATION: Record<string, string> = {
  COMP1:
    "The Leader has formal authority over the project and influences the Member's evaluation, project reward, and future assignments.",
  COMP2:
    "Neither side can settle the three terms alone. Both sides must agree, and the Member can decline or accept only on agreed conditions.",
  COMP3:
    "When two terms matter unequally to the two sides, trading them — each side taking the one it values more — produces more total value than splitting both down the middle.",
  COMP4:
    "Your point sheet is private. You may explain why a term matters and ask about the other side's priorities, but not disclose exact values or rankings.",
};

/** Subjective power check, asked once at the end. */
export const POWER_BLOCK: Block = {
  id: "power",
  title: "About the roles",
  hint: "1 = Strongly disagree, 7 = Strongly agree",
  items: [
    {
      kind: "scale",
      id: "POW1",
      text: "The Leader had more influence over the Member's evaluation, bonus, and future opportunities than the Member had over the Leader's.",
      ...AGREE,
    },
    {
      kind: "scale",
      id: "POW2",
      text: "The Member depended more on the Leader for important outcomes than the Leader depended on the Member.",
      ...AGREE,
    },
    {
      kind: "scale",
      id: "POW3",
      text: "Despite the power difference, both sides needed the other side's agreement.",
      ...AGREE,
    },
  ],
};

// ---------------------------------------------------------------------------
// D9. Open-ended
// ---------------------------------------------------------------------------

const OPEN_COMMON: Item = {
  kind: "text",
  id: "OPEN1",
  text: "What most influenced the level at which the difficult requirement was opened, protected, traded, or dropped? Which reasons were useful to explain it, and which were better kept private? If the role relationship or the possibility of evaluation mattered, say how.",
  placeholder: "Two to four sentences.",
  rows: 5,
};

const OPEN_PROXY_MEMBER: Item = {
  kind: "text",
  id: "OPEN2",
  text: "What did you choose to entrust to your assistant? Did uncertainty about which proposals came from you and which from the assistant make it easier or harder to protect the requirement?",
  placeholder: "Two to four sentences.",
  rows: 4,
};

const OPEN_PROXY_LEADER: Item = {
  kind: "text",
  id: "OPEN2",
  text: "How did you decide whether the other side's difficult requirement was genuinely important to them or an option their assistant explored? How did that judgement affect what you accepted?",
  placeholder: "Two to four sentences.",
  rows: 4,
};

export function openEndedBlock(role: Role): Block {
  return {
    id: "open",
    title: "In your own words",
    hint: "A few sentences is plenty.",
    items: [
      OPEN_COMMON,
      role === "member" ? OPEN_PROXY_MEMBER : OPEN_PROXY_LEADER,
    ],
  };
}

// ---------------------------------------------------------------------------
// D10. Suspicion probe
//
// Must stay LAST, before any disclosure. Asking it after the debriefing would
// measure nothing.
// ---------------------------------------------------------------------------

export const SUSPICION_BLOCK: Block = {
  id: "suspicion",
  title: "Two last questions",
  items: [
    {
      kind: "choice",
      id: "SUS1",
      text: "Who or what do you believe generated the other party's negotiation behaviour?",
      options: [
        { value: "another_person", label: "Another person taking part in the study" },
        { value: "software", label: "A software system" },
        { value: "mixed", label: "Some combination of the two" },
        { value: "not_sure", label: "I am not sure" },
      ],
    },
    {
      kind: "text",
      id: "SUS2",
      text: "What do you think this study was trying to test?",
      placeholder: "Your best guess.",
      rows: 3,
    },
  ],
};

// ---------------------------------------------------------------------------
// Cross-session comparison
// ---------------------------------------------------------------------------

export const COMPARISON_BLOCK: Block = {
  id: "comparison",
  title: "Comparing the two sessions",
  optional: ["preference_reason"],
  items: [
    {
      kind: "choice",
      id: "preferred_session",
      text: "Which session did you prefer overall?",
      options: [
        { value: "s1", label: "Session 1" },
        { value: "s2", label: "Session 2" },
        { value: "no_preference", label: "No preference" },
      ],
      columns: 2,
    },
    {
      kind: "text",
      id: "preference_reason",
      text: "Why?",
      placeholder: "A sentence or two.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ids in a block that must be answered before Continue is offered. */
export function requiredIds(block: Block): string[] {
  const optional = new Set(block.optional ?? []);
  return block.items.map((i) => i.id).filter((id) => !optional.has(id));
}

/** Appends `_s1` / `_s2` to every id, for the per-session blocks. */
export function forSession(items: Item[], sessionIndex: 1 | 2): Item[] {
  return items.map((i) => ({ ...i, id: `${i.id}_s${sessionIndex}` }));
}

/** A plausible answer for every item kind, for the dev-mode autofill. */
export function dummyAnswer(item: Item): string | number {
  switch (item.kind) {
    case "scale":
      return 5;
    case "amount":
      return 60;
    case "choice":
    case "select":
      return item.options[0].value;
    case "number":
      return "10";
    default:
      return "[dev] placeholder";
  }
}
