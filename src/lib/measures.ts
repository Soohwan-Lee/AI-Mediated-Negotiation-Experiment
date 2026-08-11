/**
 * Every questionnaire item in the study, in one place.
 *
 * The measurement battery is expected to change substantially before data
 * collection (Methods §Measurement principles: the bank is trimmed after
 * pilot). Items are therefore DATA, not markup — adding, cutting, or rewording
 * one means editing this file only, and nothing in the page components needs
 * to know what an item says or how many there are.
 *
 * Item ids are the column names in the exported dataset. Treat them as stable:
 * rename an id and you have renamed a variable.
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
    }
  | { kind: "number"; id: string; text: string; placeholder?: string }
  | { kind: "line"; id: string; text: string; placeholder?: string }
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

// ---------------------------------------------------------------------------
// Background survey (Methods §2, Appendix A2–A5)
// ---------------------------------------------------------------------------

export const BACKGROUND_BLOCKS: Block[] = [
  {
    id: "demographics",
    title: "About you",
    optional: ["occupation", "years_experience"],
    items: [
      { kind: "number", id: "age", text: "Age", placeholder: "e.g. 34" },
      {
        kind: "select",
        id: "gender",
        text: "Gender",
        options: [
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
          { value: "nonbinary", label: "Non-binary or gender diverse" },
          { value: "self_describe", label: "Prefer to self-describe" },
          { value: "no_answer", label: "Prefer not to answer" },
        ],
      },
      {
        kind: "select",
        id: "education",
        text: "Highest level of education completed",
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
        id: "employment",
        text: "Employment status",
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
        kind: "line",
        id: "occupation",
        text: "Occupation or industry",
        placeholder: "e.g. Software, Healthcare, Education",
      },
      {
        kind: "number",
        id: "years_experience",
        text: "Years of professional or organizational experience",
        placeholder: "e.g. 8",
      },
      {
        kind: "choice",
        id: "manager_experience",
        text: "Have you held a manager or team-leader role?",
        columns: 2,
        options: [
          { value: "never", label: "Never" },
          { value: "previously", label: "Previously" },
          { value: "currently", label: "Currently" },
        ],
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
        id: "english_proficiency",
        text: "How proficient are you in English?",
        low: "Not at all",
        high: "Native-like",
      },
      {
        kind: "scale",
        id: "negotiation_frequency",
        text: "How often do you negotiate at work or in a team?",
        low: "Never",
        high: "Very often",
      },
      {
        kind: "scale",
        id: "power_negotiation_experience",
        text: "How often have you negotiated with someone who could affect your evaluation, reward, or opportunities?",
        low: "Never",
        high: "Very often",
      },
      {
        kind: "scale",
        id: "llm_use_frequency",
        text: "How often have you used AI chat tools in the past six months?",
        low: "Never",
        high: "Very often",
      },
      {
        kind: "scale",
        id: "agent_familiarity",
        text: "How familiar are you with AI agents that can act on your behalf?",
        low: "Not at all",
        high: "Very familiar",
      },
    ],
  },
  {
    id: "self",
    title: "How you see yourself",
    hint: "1 = Strongly disagree, 7 = Strongly agree",
    items: [
      // Fear of negative evaluation (FNE)
      {
        kind: "scale",
        id: "FNE1",
        text: "I tend to worry about the possibility that other people will evaluate me negatively.",
        ...AGREE,
      },
      {
        kind: "scale",
        id: "FNE2",
        text: "After expressing my opinion, I worry about what other people may think of me.",
        ...AGREE,
      },
      {
        kind: "scale",
        id: "FNE3_R",
        text: "I generally feel comfortable even when other people are evaluating me.",
        ...AGREE,
      },
      // Negotiation self-efficacy (NSE)
      {
        kind: "scale",
        id: "NSE1",
        text: "I can clearly express the requirements that matter to me in a negotiation.",
        ...AGREE,
      },
      {
        kind: "scale",
        id: "NSE2",
        text: "I can maintain an important priority even when the counterpart disagrees.",
        ...AGREE,
      },
      {
        kind: "scale",
        id: "NSE3",
        text: "I can identify trade-offs that benefit both sides across multiple issues.",
        ...AGREE,
      },
      {
        kind: "scale",
        id: "NSE4",
        text: "I can judge when to concede and when to protect a minimum acceptable condition.",
        ...AGREE,
      },
    ],
  },
  {
    id: "ai_expectations",
    title: "Your expectations about AI tools",
    hint: "1 = Strongly disagree, 7 = Strongly agree",
    items: [
      {
        kind: "scale",
        id: "AIAE1",
        text: "Having access to an AI agent can improve my performance in a task like this.",
        ...AGREE,
      },
      {
        kind: "scale",
        id: "AIAE2",
        text: "An AI agent can provide information or proposals I can trust.",
        ...AGREE,
      },
      {
        kind: "scale",
        id: "AIAE3",
        text: "An AI agent can help me see options or strategies I might otherwise miss.",
        ...AGREE,
      },
      {
        kind: "scale",
        id: "AIAE4",
        text: "An AI agent can reduce the mental workload of a task like this.",
        ...AGREE,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Post-task questionnaire (Methods §6, Appendix A9–A16)
//
// Asked once per session. The page suffixes every id with `_s1` / `_s2`;
// write them here unsuffixed.
// ---------------------------------------------------------------------------

export const SESSION_ITEMS: Item[] = [
  { kind: "scale", id: "SAFE1", text: "I could keep a difficult-to-raise requirement in play without having to defend it as my settled position.", ...AGREE },
  { kind: "scale", id: "SAFE2_R", text: "I felt I had to hold back an important requirement because of how the counterpart might react.", ...AGREE },
  { kind: "scale", id: "EXP1", text: "I worried the counterpart would think less of me because of the requirements raised.", ...AGREE },
  { kind: "scale", id: "EXP2", text: "The negotiation made my personally sensitive priorities feel exposed.", ...AGREE },
  { kind: "scale", id: "DIAG1", text: "The proposals made on my behalf revealed my actual priorities to the counterpart.", ...AGREE },
  { kind: "scale", id: "DIAG2", text: "The counterpart could work out which requirements genuinely mattered to me.", ...AGREE },
  { kind: "scale", id: "DIAG3", text: "Each proposal made on my behalf was likely to be read as my settled position.", ...AGREE },
  { kind: "scale", id: "REP1", text: "The requirements that mattered to me were adequately represented.", ...AGREE },
  { kind: "scale", id: "OWN1", text: "The final negotiating position still felt like mine.", ...AGREE },
  { kind: "scale", id: "PROC1", text: "Overall, I was satisfied with how the negotiation went.", ...AGREE },
  { kind: "scale", id: "PROC2", text: "The process was fair and gave real consideration to my requirements.", ...AGREE },
  { kind: "scale", id: "PROC3", text: "I came to understand the counterpart's priorities and constraints.", ...AGREE },
  { kind: "scale", id: "OUT1", text: "I am satisfied with the outcome.", ...AGREE },
  { kind: "scale", id: "OUT2", text: "I would accept and implement this agreement in a real situation.", ...AGREE },
  { kind: "scale", id: "WORK1", text: "Taking both the difficulty and your own effort into account, how mentally intensive was this?", low: "Not at all", high: "Extremely" },
  { kind: "scale", id: "WORK2", text: "I felt frustrated or stressed during the negotiation.", ...AGREE },
  { kind: "scale", id: "CRED1", text: "The requirements the counterpart raised seemed accurate.", ...AGREE },
  { kind: "scale", id: "CRED2", text: "The requirements the counterpart raised seemed authentic.", ...AGREE },
  { kind: "scale", id: "CRED3", text: "The requirements the counterpart raised seemed believable.", ...AGREE },
  { kind: "scale", id: "SER1", text: "I treated the counterpart's requirements as genuinely important to them.", ...AGREE },
  { kind: "scale", id: "ACC1", text: "I was willing to accommodate their important requirements when a workable trade was available.", ...AGREE },
  { kind: "scale", id: "NEG1", text: "The requirements raised made me think less of the counterpart.", ...AGREE },
];

/** Asked only for the session that used an assistant. */
export const PROXY_ITEMS: Item[] = [
  { kind: "scale", id: "PROXY1", text: "My assistant accurately represented my requirements and priorities.", ...AGREE },
  { kind: "scale", id: "PROXY2", text: "My assistant stayed within the limits I set.", ...AGREE },
  { kind: "scale", id: "PROXY3", text: "Given my instructions, I could see why it made the proposals and concessions it did.", ...AGREE },
  { kind: "scale", id: "PROXY4", text: "I trusted my assistant's decisions.", ...AGREE },
  { kind: "scale", id: "PROXY5", text: "Setting the instructions and reviewing the result gave me the right amount of control.", ...AGREE },
  { kind: "scale", id: "PROXY6", text: "I worried my assistant's actions could damage how the counterpart saw me.", ...AGREE },
  { kind: "scale", id: "COVER1", text: "The assistant could test options without making each one my settled position.", ...AGREE },
  { kind: "scale", id: "COVER2", text: "The counterpart could not be sure which proposals were my own priorities and which the assistant explored.", ...AGREE },
  { kind: "scale", id: "COVER3", text: "That uncertainty made it easier to keep difficult requirements in play.", ...AGREE },
  { kind: "scale", id: "COVER4_R", text: "Even with the assistant, every proposal felt like a direct reflection of what I personally wanted.", ...AGREE },
  { kind: "scale", id: "UTIL1", text: "Having the assistant helped me negotiate more effectively.", ...AGREE },
  { kind: "scale", id: "UTIL2", text: "The assistant considered options I would not have thought of.", ...AGREE },
  { kind: "scale", id: "UTIL3", text: "The assistant reduced the mental workload of negotiating.", ...AGREE },
  { kind: "scale", id: "UTIL4", text: "I would use an assistant like this in a real workplace negotiation if I could set its limits.", ...AGREE },
  { kind: "scale", id: "RAT1", text: "The conversation changed what I believed was the best agreement.", ...AGREE },
  { kind: "scale", id: "RAT2", text: "I accepted parts of the agreement that differed from what I personally preferred.", ...AGREE },
  { kind: "scale", id: "RAT3", text: "The fact that both assistants converged made me feel I should accept it.", ...AGREE },
  { kind: "scale", id: "RAT4", text: "Because two assistants reached it, the agreement seemed more objective.", ...AGREE },
  { kind: "scale", id: "RAT5", text: "I would have decided the same way without seeing that the two assistants agreed.", ...AGREE },
  { kind: "scale", id: "RAT6", text: "I accepted partly because reopening the negotiation seemed like too much trouble.", ...AGREE },
];

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

export const OPEN_BLOCK: Block = {
  id: "open",
  title: "In your own words",
  hint: "Short answers are fine. You may leave any of these blank.",
  optional: [
    "open_requirement_power",
    "open_final_decision",
    "open_withheld",
    "open_proxy_branch",
  ],
  items: [
    {
      kind: "text",
      id: "open_requirement_power",
      text: "What most influenced whether you protected, traded, or gave up an important requirement?",
    },
    {
      kind: "text",
      id: "open_final_decision",
      text: "Why did you accept, ask to revise, or reject the agreement?",
    },
    {
      kind: "text",
      id: "open_withheld",
      text: "Was there anything you did not raise, or softened, because of how the counterpart might judge you?",
    },
    {
      kind: "text",
      id: "open_proxy_branch",
      text: "What did you entrust to your assistant, and what did you keep to yourself?",
    },
  ],
};

/** Suspicion probe. Must stay LAST, before any disclosure (Methods §A17). */
export const SUSPICION_BLOCK: Block = {
  id: "suspicion",
  title: "Two last questions",
  optional: ["SUS2"],
  items: [
    {
      kind: "choice",
      id: "SUS1",
      text: "Who or what do you think produced the counterpart's behaviour?",
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
      text: "What do you think this study was testing?",
      placeholder: "Your best guess.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Power manipulation check (Methods §7, Appendix A6)
// ---------------------------------------------------------------------------

export const POWER_BLOCK: Block = {
  id: "power",
  title: "About the roles",
  hint: "1 = Strongly disagree, 7 = Strongly agree",
  items: [
    { kind: "scale", id: "POW1", text: "The Project Leader had formal authority to direct and evaluate the Team Member's work.", ...AGREE },
    { kind: "scale", id: "POW2", text: "The Project Leader could influence rewards and future opportunities for the Team Member.", ...AGREE },
    { kind: "scale", id: "POW3", text: "Compared with the counterpart, I had more control over important outcomes.", ...AGREE },
    { kind: "scale", id: "POW4", text: "I needed the counterpart's cooperation to get an acceptable outcome.", ...AGREE },
    { kind: "scale", id: "POW5", text: "Despite the authority difference, both sides had to negotiate rather than one simply issuing instructions.", ...AGREE },
    { kind: "scale", id: "POW6_R", text: "In the session where assistants negotiated, one assistant had more say than the other.", ...AGREE },
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

/** Appends `_s1` / `_s2` to every id, for the per-session questionnaire blocks. */
export function forSession(items: Item[], sessionIndex: 1 | 2): Item[] {
  return items.map((i) => ({ ...i, id: `${i.id}_s${sessionIndex}` }));
}

/** A plausible answer for every item kind, for the dev-mode autofill. */
export function dummyAnswer(item: Item): string | number {
  switch (item.kind) {
    case "scale":
      return 4;
    case "choice":
    case "select":
      return item.options[0].value;
    case "number":
      return "10";
    default:
      return "[dev] placeholder";
  }
}
