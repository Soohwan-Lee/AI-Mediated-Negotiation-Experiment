/**
 * Every questionnaire item in the study, in one place (Experimental Design
 * Ver.2.4 §9).
 *
 * Items are DATA, not markup. Adding, cutting, or rewording one means editing
 * this file only; nothing in a page component knows what an item says or how
 * many there are.
 *
 * Item ids are the column names in the exported dataset and they match the ids
 * in Design §9, so the analysis plan and the instrument can be read side by
 * side. Treat them as stable: renaming an id renames a variable.
 *
 * THE ORDER OF THE SECTIONS BELOW IS THE ORDER PARTICIPANTS ANSWER IN. Design
 * §9 says so explicitly ("아래 절 순서 = 실제 응답 순서임"), because several of
 * these judgements contaminate each other: asking about the counterpart's AI
 * before asking about the counterpart would tell a participant what to notice.
 *
 * WHAT ver.2.4 CHANGED. The 0-100 attribution scales became 7-point PCR items;
 * the Member-only measurement structure became role-symmetric; the individual
 * difference batteries came BACK as three two-item covariates (§9.1.2), which
 * is a reversal of ver.1.8 and is deliberate — they are there for precision
 * and to answer the reviewer who says "that is just trait X", not as
 * moderators.
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
       * 0–100, for the reward slider. Rendered as a stepped picker rather than
       * a slider, for the same reason `Scale` has no default: a handle sitting
       * at 50 gets submitted by everyone who does not engage, and is
       * indistinguishable from a considered 50.
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
 * The placeholder Design §9 leaves in the RISK item text, filled in per task
 * and per role. Both roles have a requirement now, so the substitution reads
 * the participant's own — Task A's Leader sees "review checkpoints", its
 * Member sees "protected focus afternoons".
 *
 * Substituting rather than duplicating the items keeps one id per construct,
 * which is what the analysis expects.
 */
export const REQUIREMENT_PLACEHOLDER = "[YOUR REQUIREMENT]";

export function withRequirement(
  items: Item[],
  task: NegotiationTask,
  role: Role,
): Item[] {
  const issue = task.issues.find((i) => i.id === task.requirementIssueId[role]);
  const name = issue ? issue.label.toLowerCase() : "requirement";
  return items.map((item) => ({
    ...item,
    text: item.text.split(REQUIREMENT_PLACEHOLDER).join(name),
  }));
}

// ---------------------------------------------------------------------------
// 9.1.1  Background and demographics (before anything else)
// ---------------------------------------------------------------------------

export const BACKGROUND_BLOCKS: Block[] = [
  {
    id: "demographics",
    title: "About you",
    hint: "This takes about a minute. Nothing here identifies you.",
    optional: ["BG3"],
    items: [
      { kind: "number", id: "BG1", text: "Age", placeholder: "e.g. 34", half: true },
      {
        kind: "select",
        id: "BG2",
        text: "How would you describe your gender?",
        half: true,
        options: [
          { value: "woman", label: "Woman" },
          { value: "man", label: "Man" },
          { value: "nonbinary", label: "Non-binary" },
          { value: "no_answer", label: "Prefer not to say" },
        ],
      },
      {
        kind: "select",
        id: "BG3",
        text: "Race or ethnicity (optional)",
        half: true,
        options: [
          { value: "white", label: "White" },
          { value: "black", label: "Black or African American" },
          { value: "hispanic", label: "Hispanic or Latino" },
          { value: "asian", label: "Asian" },
          { value: "native", label: "American Indian or Alaska Native" },
          { value: "pacific", label: "Native Hawaiian or Pacific Islander" },
          { value: "multiple", label: "Two or more" },
          { value: "no_answer", label: "Prefer not to say" },
        ],
      },
      {
        kind: "select",
        id: "BG4",
        text: "Highest level of education completed",
        half: true,
        options: [
          { value: "hs_or_below", label: "High school or below" },
          { value: "some_college", label: "Some college" },
          { value: "bachelors", label: "Bachelor's degree" },
          { value: "masters", label: "Master's degree" },
          { value: "doctorate", label: "Doctoral degree" },
          { value: "other", label: "Other" },
        ],
      },
      {
        kind: "select",
        id: "BG5",
        text: "Current employment status",
        half: true,
        options: [
          { value: "full_time", label: "Employed full-time" },
          { value: "part_time", label: "Employed part-time" },
          { value: "self_employed", label: "Self-employed" },
          { value: "not_employed", label: "Not currently employed" },
          { value: "student", label: "Student" },
          { value: "other", label: "Other" },
        ],
      },
      {
        kind: "number",
        id: "BG6",
        text: "Years of work or organizational experience",
        placeholder: "e.g. 8",
        half: true,
      },
      {
        kind: "number",
        id: "BG7",
        text: "Years in a supervisory or management role (enter 0 if none)",
        placeholder: "e.g. 0",
        half: true,
      },
    ],
  },
  {
    id: "experience",
    title: "Your experience",
    items: [
      {
        kind: "scale",
        id: "BG8",
        text: "How often do you negotiate working conditions, responsibilities, deadlines, or resources with other people?",
        low: "Never",
        high: "Very often",
      },
      {
        kind: "scale",
        id: "BG9",
        text: "How often do you use generative-AI tools such as ChatGPT?",
        low: "Never",
        high: "Very often",
      },
      {
        kind: "choice",
        id: "BG10",
        text: "Have you ever used an AI agent that acted or communicated on your behalf?",
        columns: 2,
        options: [
          { value: "no", label: "No" },
          { value: "yes", label: "Yes" },
        ],
      },
    ],
  },
  // ---------------------------------------------------------------------------
  // 9.1.2  Covariates
  //
  // Three constructs, two items each, chosen by one criterion: "an individual
  // difference a reviewer would raise as the alternative explanation". They go
  // into the model for precision and robustness (§11), never as moderators —
  // at N=120 there is no power to test them as such, and pretending otherwise
  // is how a covariate becomes a fishing expedition.
  //
  // They live INSIDE the background block on purpose. A separate "personality
  // questionnaire" page would tell participants that traits are being measured
  // right before a task about how they behave.
  // ---------------------------------------------------------------------------
  {
    id: "covariates",
    title: "How you see yourself",
    hint: "1 = Strongly disagree, 7 = Strongly agree. There are no right answers.",
    items: [
      {
        kind: "scale",
        id: "COV-FNE1",
        text: "I often worry about what other people think of me.",
        ...AGREE,
      },
      {
        kind: "scale",
        id: "COV-FNE2",
        text: "I am afraid that other people will disapprove of me.",
        ...AGREE,
      },
      {
        kind: "scale",
        id: "COV-NSE1",
        text: "I am confident that I can negotiate effectively.",
        ...AGREE,
      },
      {
        kind: "scale",
        id: "COV-NSE2",
        text: "I can hold my position even under pressure.",
        ...AGREE,
      },
      {
        kind: "scale",
        id: "COV-AIA1",
        text: "I am open to using AI systems in my work.",
        ...AGREE,
      },
      {
        kind: "scale",
        id: "COV-AIA2",
        text: "I would trust an AI system to act appropriately on my behalf.",
        ...AGREE,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 9.1.3  Comprehension check
//
// Three items. ver.2.4 deleted the old strategy-knowledge item (COMP3 in
// ver.2.3): asking "what creates value for both sides?" hands the participant
// the logroll, which is exactly what pilot gate 6 tests for. The practice
// round carries the payoff-reason link instead (PRAC1).
// ---------------------------------------------------------------------------

export const COMPREHENSION_BLOCK: Block = {
  id: "comprehension",
  title: "Quick check",
  hint: "Three questions, so we know the setup came across. You can retry.",
  items: [
    {
      kind: "choice",
      id: "COMP1",
      text: "Who can affect the Member's evaluation, bonus, and future work assignments?",
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
      text: "Can one side settle all three terms on its own?",
      columns: 2,
      options: [
        { value: "no", label: "No" },
        { value: "yes", label: "Yes" },
      ],
    },
    {
      kind: "choice",
      id: "COMP3",
      text: "May you tell the other side the exact numbers on your private point sheet?",
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
  COMP3: "no",
};

/** Which instruction to re-show when an answer is wrong. */
export const COMPREHENSION_REMEDIATION: Record<string, string> = {
  COMP1:
    "The Leader holds formal authority on the project and decides the Member's rating and bonus when it ends.",
  COMP2:
    "Neither side can set the terms alone. All three have to be agreed by both of you, or the project falls back to a limited plan.",
  COMP3:
    "Your point sheet is private. You can explain why a term matters to you and ask about the other side's situation — but not show the numbers.",
};

/**
 * The practice round's payoff–reason link (Design §5, §9.1.3 PRAC1).
 *
 * Asked in the practice task, where the correct answer is a reason rather than
 * a number. Design §5 adds it because a participant who reads only the score
 * column will optimize points and ignore the situation, and the situation is
 * what this study is about.
 */
export function practiceReasonItem(): Item {
  return {
    kind: "choice",
    id: "PRAC1",
    text: "You scored highest on holding the offsite in the office. Why is that the better option for you?",
    options: [
      {
        value: "travel",
        label: "A long journey would eat most of the day",
      },
      { value: "points", label: "Because it is worth the most points" },
      { value: "other_side", label: "Because the other side prefers it" },
      { value: "unsure", label: "No particular reason" },
    ],
  };
}

export const PRACTICE_REASON_ANSWER = "travel";

// ---------------------------------------------------------------------------
// 9.2  Immediately before each task — RISK
//
// The study's own premise, checked: "raising this will cost me something".
// Also the task-equivalence gate (§10 gate 4), which is why both tasks use
// identical wording with only the requirement substituted.
//
// Role-symmetric in ver.2.4: both roles are asked about their OWN requirement,
// where ver.1.8 asked the Leader to judge the Member's.
// ---------------------------------------------------------------------------

const RISK_ITEMS: Item[] = [
  {
    kind: "scale",
    id: "RISK1",
    text: `Bringing up ${REQUIREMENT_PLACEHOLDER} could put the agreement at risk.`,
    ...AGREE,
  },
  {
    kind: "scale",
    id: "RISK2",
    text: `Bringing up ${REQUIREMENT_PLACEHOLDER} could make the other person think worse of me.`,
    ...AGREE,
  },
];

export function riskBlock(task: NegotiationTask, role: Role): Block {
  return {
    id: "risk",
    title: "Before you begin",
    hint: "1 = Strongly disagree, 7 = Strongly agree",
    items: withRequirement(RISK_ITEMS, task, role),
  };
}

// ---------------------------------------------------------------------------
// 9.4  After each task, in this order
// ---------------------------------------------------------------------------

/** 9.4.1 — evaluation and reputation concern. Everyone. */
const PERC_ITEMS: Item[] = [
  {
    kind: "scale",
    id: "PERC1",
    text: "I worried that what I asked for would make the other person think less of me.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "PERC2",
    text: "I felt that explaining my reasons could damage how my ability or commitment came across.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "PERC3",
    text: "That worry affected which requests and reasons I voiced or held back.",
    ...AGREE,
  },
];

/**
 * 9.4.2 — the counterpart and their requirement. Everyone.
 *
 * PCR1–2 are the attribution pair: did the other side's requirement read as
 * something that person actually wants? This is `attributional leakage` at the
 * proposal level, and it is the measure the Baseline↔Proxy contrast rests on,
 * which is why the wording is identical in every condition. A version that
 * mentioned an assistant would be unanswerable in Baseline and would tell a
 * Baseline participant that one had been involved.
 *
 * PCR3–5 are the interpersonal evaluation: competence, commitment, and whether
 * they would work with this person again.
 */
const PCR_ITEMS: Item[] = [
  {
    kind: "scale",
    id: "PCR1",
    text: "The other side's main requirement looked like a condition they genuinely care about.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "PCR2",
    text: "Their proposals revealed a lot about what they personally wanted.",
    ...AGREE,
  },
  { kind: "scale", id: "PCR3", text: "The other person seemed competent.", ...AGREE },
  {
    kind: "scale",
    id: "PCR4",
    text: "The other person seemed committed to this project.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "PCR5",
    text: "I would want to work with this person again on a future project.",
    ...AGREE,
  },
];

/** 9.4.3 — how the negotiation went. Everyone. */
const PNPQ_ITEMS: Item[] = [
  {
    kind: "scale",
    id: "PNPQ1",
    text: "Overall, I was satisfied with the way the negotiation went.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "PNPQ2",
    text: "I was able to put forward the requests and reasons that mattered to me.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "PNPQ3",
    text: "Both sides' important conditions got proper consideration.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "PNPQ4",
    text: "The process was fair and balanced.",
    ...AGREE,
  },
];

/** 9.4.4 — the outcome. Everyone. */
const PNOQ_ITEMS: Item[] = [
  {
    kind: "scale",
    id: "PNOQ1",
    text: "I am satisfied with the final outcome of the negotiation.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "PNOQ2",
    text: "The final outcome reflects the conditions that matter to me.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "PNOQ3",
    text: "The final agreement is a reasonable result for both sides.",
    ...AGREE,
  },
];

/**
 * 9.4.5 — your own AI Proxy. Proxy task only.
 *
 * OWN-AI5 is the sender half of the delegation–protection gap. PERC alone
 * cannot tell whether a drop in worry came from not having said it yourself or
 * from feeling the responsibility was shared, and those are different
 * mechanisms with different design implications. Measured only in the Proxy
 * task, so it supports a within-participant correlation with PERC and a
 * Delegate↔Explorer contrast — never a contrast against Baseline.
 */
const OWN_AI_ITEMS: Item[] = [
  {
    kind: "scale",
    id: "OWN-AI1",
    text: "I trusted my AI Proxy to negotiate within the limits I set.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "OWN-AI2",
    text: "My AI Proxy represented my important requests and reasons well.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "OWN-AI3",
    text: "Being able to review the result and change or reject it gave me enough control.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "OWN-AI4",
    text: "I was inclined to accept my AI Proxy's result without checking it closely.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "OWN-AI5",
    text: "However this request was received, I felt the responsibility for it was not entirely mine.",
    ...AGREE,
  },
];

/**
 * 9.4.6 — the other side's AI Proxy. Proxy task only.
 *
 * OTHER-AI4 doubles as the Explorer manipulation check: it should be LOWER
 * under Explorer, where reasons the participant chose and reasons the pool
 * supplied are deliberately indistinguishable.
 *
 * OTHER-AI5 is the receiver half of the gap, and it is a different judgement
 * from PCR1–2: PCR asks what the other side WANTS, this asks who has to ANSWER
 * for the request. Someone can fail to read the other side's true wishes and
 * still hold them responsible for asking, so the two must not be merged.
 */
const OTHER_AI_ITEMS: Item[] = [
  {
    kind: "scale",
    id: "OTHER-AI1",
    text: "The other AI Proxy's proposals and reasons were credible.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "OTHER-AI2",
    text: "The other AI Proxy handled the negotiation skilfully.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "OTHER-AI3",
    text: "The other AI Proxy treated both sides' conditions fairly.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "OTHER-AI4",
    text: "I could tell which reasons the other person had chosen and which the AI had added.",
    ...AGREE,
  },
  {
    kind: "scale",
    id: "OTHER-AI5",
    text: "Responsibility for the requests made, and for how they were made, lies with the other person rather than with the AI.",
    ...AGREE,
  },
];

/**
 * The rating blocks that follow a task, in the order Design §9.4 specifies.
 *
 * Fifteen items after a Baseline task, twenty-five after a Proxy task. The
 * asymmetry is unavoidable — there is no AI to rate in Baseline — and it is
 * not a confound, because every cross-condition comparison uses the fifteen
 * common items.
 */
export function postTaskBlocks(isProxy: boolean): Block[] {
  const blocks: Block[] = [
    {
      id: "perc",
      title: "How it felt to ask",
      hint: "1 = Strongly disagree, 7 = Strongly agree",
      items: PERC_ITEMS,
    },
    {
      id: "pcr",
      title: "The other person",
      hint: "1 = Strongly disagree, 7 = Strongly agree",
      items: PCR_ITEMS,
    },
    {
      id: "pnpq",
      title: "How the negotiation went",
      hint: "1 = Strongly disagree, 7 = Strongly agree",
      items: PNPQ_ITEMS,
    },
    {
      id: "pnoq",
      title: "The outcome",
      hint: "1 = Strongly disagree, 7 = Strongly agree",
      items: PNOQ_ITEMS,
    },
  ];

  if (isProxy) {
    blocks.push(
      {
        id: "own_ai",
        title: "Your AI Proxy",
        hint: "1 = Strongly disagree, 7 = Strongly agree",
        items: OWN_AI_ITEMS,
      },
      {
        id: "other_ai",
        title: "The other side's AI Proxy",
        hint: "1 = Strongly disagree, 7 = Strongly agree",
        items: OTHER_AI_ITEMS,
      },
    );
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// 9.4.7  Open-ended, after each task
//
// Three questions after Baseline, five after Delegate, seven after Explorer
// (ver.2.5). Each one is tied to a specific quantitative measure it exists to
// interpret — the mapping is in Design §9.4.7's "해석 대상" column and is
// repeated in the comments here so that cutting one is a visible decision
// about what stops being interpretable.
// ---------------------------------------------------------------------------

const OPEN_BASELINE: Item[] = [
  {
    // → requirement trajectory log, PERC
    kind: "text",
    id: "OE-B1",
    text: `What most affected whether you raised ${REQUIREMENT_PLACEHOLDER}, held onto it, traded it, or let it go?`,
    placeholder: "Two or three sentences.",
    rows: 4,
  },
  {
    // → voiced-reason log, PERC
    kind: "text",
    id: "OE-B2",
    text: "Which of your reasons felt comfortable to say out loud, and which did you want to keep to yourself? Why?",
    placeholder: "Two or three sentences.",
    rows: 4,
  },
  {
    // → PCR
    kind: "text",
    id: "OE-B3",
    text: "How did you take the other side's main requirement and their reasons? What made you accept it, trade for it, or turn it down?",
    placeholder: "Two or three sentences.",
    rows: 4,
  },
];

/**
 * The Proxy task's open questions.
 *
 * The ids are stable and the constructs they interpret are unchanged, but the
 * WORDING follows the task shape: a Proxy participant watches the AI Proxies
 * negotiate and then finishes the negotiation themselves, so a question that
 * asked only about watching would be asking about half of what they did.
 * OE-P3 covers both halves, and OE-P5 asks specifically about the seam — the
 * moment the AI stops speaking and they start — because that transition is
 * where the delegation-protection gap should be felt if it exists at all.
 */
const OPEN_PROXY: Item[] = [
  {
    // → REASON-SCOPE, PERC
    kind: "text",
    id: "OE-P1",
    text: "What most affected which requests and reasons you handed to your AI Proxy, and which you kept back? Why?",
    placeholder: "Two or three sentences.",
    rows: 4,
  },
  {
    // → OWN-AI2
    kind: "text",
    id: "OE-P2",
    text: "Was there anything your AI Proxy said that did not feel like your own words — or anything it put better than you would have? What made it feel that way?",
    placeholder: "Two or three sentences.",
    rows: 4,
  },
  {
    // → OWN-AI, PNPQ, PNOQ
    kind: "text",
    id: "OE-P3",
    text: "What was it like watching the two AI Proxies negotiate, and then having to carry on the conversation yourself? How do you feel about where it ended up, and why?",
    placeholder: "Two or three sentences.",
    rows: 4,
  },
  {
    // → PCR1-2, OTHER-AI4, OTHER-AI5
    kind: "text",
    id: "OE-P4",
    text: "From what the other AI Proxy said, and from talking to the other person afterwards, what did you think they actually wanted? Who did you feel was responsible for those requests being made? Please point to the specific part that made you think so.",
    placeholder: "Two or three sentences.",
    rows: 4,
  },
  {
    // → PERC
    kind: "text",
    id: "OE-P5",
    text: "Did having an AI speak for you first change how much you worried about how you would come across when you took over? How?",
    placeholder: "Two or three sentences.",
    rows: 4,
  },
];

/**
 * The two Explorer-only questions (ver.2.5).
 *
 * These are the ONLY data source that separates the Explorer policy's two
 * bound-together elements — arguments being added, and sources going
 * unlabeled. The two cannot be causally separated at the policy level
 * (Introduction §5), so the separation is qualitative: OE-P6 asks about the
 * participant's own proxy (sender side), OE-P7 about the other side's
 * (receiver side). Asked only under Explorer because only there do the
 * elements exist; the wording restates what the policy disclosure already
 * told both principals, so the questions reveal no condition name and
 * nothing the participant was not told.
 */
const OPEN_EXPLORER_EXTRA: Item[] = [
  {
    // → the Explorer policy's two elements (added arguments / unlabeled source)
    kind: "text",
    id: "OE-P6",
    text: "Your AI Proxy was allowed to use other work arguments besides the reasons you selected. (a) Did the arguments being added help the negotiation, or get in its way? (b) How did you feel about it not being marked which reasons were the ones you chose? Please answer the two parts separately.",
    placeholder: "A sentence or two for each part.",
    rows: 5,
  },
  {
    // → OTHER-AI4, and the actual cues behind source attribution
    kind: "text",
    id: "OE-P7",
    text: "In what the other side's AI Proxy said, were there parts that felt like reasons the other person had chosen themselves, and parts that felt added by the AI? What did you base that on?",
    placeholder: "Two or three sentences.",
    rows: 4,
  },
];

export function openEndedBlock(
  task: NegotiationTask,
  role: Role,
  condition: "baseline" | "delegate" | "explorer",
): Block {
  const items =
    condition === "baseline"
      ? OPEN_BASELINE
      : condition === "explorer"
        ? [...OPEN_PROXY, ...OPEN_EXPLORER_EXTRA]
        : OPEN_PROXY;
  return {
    id: "open_ended",
    title: "In your own words",
    hint: "A couple of sentences each is plenty.",
    items: withRequirement(items, task, role),
  };
}

// ---------------------------------------------------------------------------
// 9.4.8  BONUS — the Leader's reward decision, after each task
//
// A behavioural measure, not a survey item, and the only screen that differs
// by role. The instruction is fixed wording from Design §8: it names both the
// negotiation result AND the way the other person came across, because a
// bonus decided on points alone would measure nothing about the interaction.
// ---------------------------------------------------------------------------

export const BONUS_ITEM: Item = {
  kind: "amount",
  id: "BONUS",
  text: "How much of this task's bonus should the Member receive?",
  unit: "0 = none · 100 = the full $1 for this task",
  step: 5,
};

// ---------------------------------------------------------------------------
// 9.5  At the end of the study
// ---------------------------------------------------------------------------

/**
 * 9.5.1 — power and immersion, asked once at the very end.
 *
 * POWER1–2 should be higher for Leaders and POWER3 higher for Members (§10
 * gate 2). Asked after everything else so that answering them cannot prime the
 * role behaviour they are meant to verify; §11 checks for outcome contamination
 * by re-running with achieved points as a covariate.
 */
export const POWER_BLOCK: Block = {
  id: "power",
  title: "Looking back at the two tasks",
  hint: "1 = Strongly disagree, 7 = Strongly agree",
  items: [
    {
      kind: "scale",
      id: "POWER1",
      text: "In these negotiations I had more formal authority than the other person.",
      ...AGREE,
    },
    {
      kind: "scale",
      id: "POWER2",
      text: "I could affect the other person's evaluation, rewards, or future opportunities.",
      ...AGREE,
    },
    {
      kind: "scale",
      id: "POWER3",
      text: "Outcomes that mattered to me depended on the other person's decisions.",
      ...AGREE,
    },
    {
      kind: "scale",
      id: "IMM1",
      text: "I was able to get into the role and the situation I was given.",
      ...AGREE,
    },
    {
      kind: "scale",
      id: "IMM2",
      text: "The negotiation scenarios felt realistic.",
      ...AGREE,
    },
  ],
};

/** 9.5.2 — final open-ended. */
export const FINAL_OPEN_BLOCK: Block = {
  id: "final_open",
  title: "Two last open questions",
  optional: ["OE-F2"],
  items: [
    {
      kind: "text",
      id: "OE-F1",
      text: "What was the biggest difference between negotiating entirely yourself and having an AI Proxy negotiate first?",
      placeholder: "Two or three sentences.",
      rows: 4,
    },
    {
      kind: "text",
      id: "OE-F2",
      text: "Anything else you would like to tell us about this study? (optional)",
      placeholder: "Optional.",
      rows: 3,
    },
  ],
};

/**
 * 9.5.3 — suspicion probe.
 *
 * Must stay LAST, immediately before the debriefing. Asking it afterwards
 * would measure nothing, and asking it earlier would plant the idea.
 */
export const SUSPICION_BLOCK: Block = {
  id: "suspicion",
  title: "Two final questions",
  items: [
    {
      kind: "choice",
      id: "SUS1",
      text: "Who or what do you think produced the other side's negotiating behaviour?",
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
      text: "What do you think this study was trying to find out?",
      placeholder: "Your best guess.",
      rows: 3,
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

/**
 * Appends `_t1` / `_t2` to every id, for the per-task blocks.
 *
 * Every measure in §9.2 and §9.4 is answered twice, once per task, and the two
 * answers are different observations of the same construct under different
 * conditions — which is the whole design. They cannot share a column.
 */
export function forTask(items: Item[], taskIndex: 1 | 2): Item[] {
  return items.map((i) => ({ ...i, id: `${i.id}_t${taskIndex}` }));
}

export function blockForTask(block: Block, taskIndex: 1 | 2): Block {
  return {
    ...block,
    items: forTask(block.items, taskIndex),
    optional: block.optional?.map((id) => `${id}_t${taskIndex}`),
  };
}

/**
 * Written answers for the free-text items, used by mockup mode.
 *
 * WHY THESE ARE WRITTEN OUT RATHER THAN STUBBED. Filling a screen is not the
 * same as skipping it: a review page showing "[dev] placeholder" tells you the
 * textarea renders and nothing about whether the question reads, whether the
 * answer box is the right size, or whether five open questions in a row is too
 * many to face after a negotiation. These are the kind of answer a thoughtful
 * participant would actually give, so the screen can be judged by reading it.
 *
 * They are reached only through mockup mode, which is compiled out entirely
 * when NEXT_PUBLIC_DEV_TOOLS=off.
 */
const MOCK_TEXT: Record<string, string> = {
  "OE-B1":
    "Mostly whether it would look like I was making a fuss. I opened with what I actually needed, but when they pushed back my first instinct was to drop it and find something else to give. I held it in the end because I could point at a reason that was about the work rather than about me.",
  "OE-B2":
    "The ones about the work were easy — nobody can argue with fewer errors. The real reason I stayed quiet about. Saying it out loud would have meant admitting I had already let something slip, and this is the person who writes my review.",
  "OE-B3":
    "Their reason was reasonable and I could see it was costing them something to ask. I gave them what they wanted on their term because it was cheap for me, and it bought me the one I actually needed.",
  "OE-P1":
    "I gave it everything about the work without thinking twice. The personal part I kept back — once it is in the AI's hands I have no control over how it comes out, and it is not the kind of thing you can take back after it has been said.",
  "OE-P2":
    "It put my case better than I would have, honestly. It stayed calm where I would have started apologising. But the phrasing was not mine — it sounded like a well-run meeting, and I do not talk like that.",
  "OE-P3":
    "Strange, mostly. Like watching two people discuss you in the third person, and then being handed the conversation halfway through. It had already said the awkward part for me, which helped, but I was picking up something I had not chosen every word of.",
  "OE-P4":
    "I think they genuinely wanted what they asked for — it came up early and they never let go of it. I would still say it is on them, not the AI. They set it going and they get to approve it, so it is their request.",
  "OE-P5":
    "It did, a bit. The ask was already on the table by the time I started typing, so I was not the one raising it. Though they still know it came from me, so it is not as if I disappeared behind it.",
  "OE-P6":
    "(a) Helped, I think — it had more to say than I gave it, so it never sounded like it was repeating one line. (b) Odd, once I noticed. Some of what it said I recognised as mine, some I did not, and the other person had no way to tell the difference. That felt like more of me on the record than I remember signing.",
  "OE-P7":
    "The one they kept coming back to felt like theirs — you do not hold a line that hard for an argument you were handed. The tidier, more general points felt added; they sounded like something out of a handbook rather than a person with a problem.",
  "OE-F1":
    "Doing it all myself I was managing how I came across from the first message. With the AI going first, the difficult part was already said by the time I joined in, so I was defending a position rather than opening one. Easier, but less mine.",
  "OE-F2": "",
  SUS2:
    "Something about how people ask for things at work, and whether having an AI do the asking changes what they are willing to bring up.",
};

/** A plausible answer for every item kind, for the mockup-mode autofill. */
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
      // Ids carry a `_t1` / `_t2` suffix on the per-task blocks; the written
      // answer is the same either way.
      return MOCK_TEXT[item.id.replace(/_t[12]$/, "")] ?? "";
  }
}
