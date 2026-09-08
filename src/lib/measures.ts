/** Canonical participant instrument: Experimental Design Ver.2.23 section 9. */

import type { Role } from "./types";
import { STUDY } from "./study-config";

type ItemBase = { id: string; text: string; hint?: string };
export type Item = ItemBase &
  (
    | { kind: "scale"; low?: string; high?: string; points?: number }
    | { kind: "amount"; unit?: string; step?: number }
    | { kind: "choice"; options: Array<{ value: string; label: string }>; columns?: 1 | 2 }
    | { kind: "select"; options: Array<{ value: string; label: string }>; half?: boolean }
    | { kind: "number"; placeholder?: string; half?: boolean }
    | { kind: "line"; placeholder?: string; half?: boolean }
    | { kind: "text"; placeholder?: string; rows?: number }
  );

export interface Block {
  id: string;
  title: string;
  hint?: string;
  items: Item[];
  optional?: string[];
}

const AGREE = { low: "Strongly disagree", high: "Strongly agree" };

export const BACKGROUND_BLOCKS: Block[] = [
  {
    id: "demographics",
    title: "About you",
    hint: "These questions describe the study sample. You may choose not to answer demographic questions.",
    optional: ["BG1", "BG6"],
    items: [
      { kind: "number", id: "BG1", text: "What is your age?", placeholder: "e.g. 34", half: true },
      {
        kind: "select", id: "BG2", text: "How would you describe your gender?", half: true,
        options: [
          { value: "woman", label: "Woman" }, { value: "man", label: "Man" },
          { value: "nonbinary", label: "Non-binary" }, { value: "no_answer", label: "Prefer not to say" },
        ],
      },
      {
        kind: "select", id: "BG5", text: "What is your current employment status?", half: true,
        options: [
          { value: "full_time", label: "Full-time" }, { value: "part_time", label: "Part-time" },
          { value: "self_employed", label: "Self-employed" }, { value: "not_employed", label: "Not employed" },
          { value: "student", label: "Student" }, { value: "other", label: "Other" },
          { value: "no_answer", label: "Prefer not to say" },
        ],
      },
      { kind: "number", id: "BG6", text: "How many years of work experience do you have?", placeholder: "e.g. 8", half: true },
      {
        kind: "choice", id: "BG7", text: "Have you worked as a supervisor or manager?", columns: 2,
        options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }, { value: "no_answer", label: "Prefer not to say" }],
      },
      {
        kind: "scale", id: "BG9", text: "How often do you use generative AI tools (e.g., ChatGPT)?",
        low: "Never", high: "Daily or almost daily",
      },
    ],
  },
  {
    id: "fts", title: "How you see yourself",
    hint: "1 = Strongly disagree, 7 = Strongly agree. There are no right answers.",
    items: [
      { kind: "scale", id: "FTS1", text: "My feelings are hurt easily.", ...AGREE },
      { kind: "scale", id: "FTS2", text: "I don't respond well to direct criticism.", ...AGREE },
      { kind: "scale", id: "FTS3", text: "I am pretty thin-skinned.", ...AGREE },
    ],
  },
  {
    id: "aia", title: "Your views about AI", hint: "1 = Strongly disagree, 7 = Strongly agree.",
    items: [
      { kind: "scale", id: "AIA1", text: "AI has many beneficial applications.", ...AGREE },
      { kind: "scale", id: "AIA2", text: "AI is helpful in daily life.", ...AGREE },
      { kind: "scale", id: "AIA3", text: "I want to interact with AI in my everyday life.", ...AGREE },
      { kind: "scale", id: "AIA4", text: "Society will benefit from AI.", ...AGREE },
      { kind: "scale", id: "AIA5", text: "I am willing to delegate part of complex decisions to AI.", ...AGREE },
    ],
  },
];

export const COMPREHENSION_BLOCK: Block = {
  id: "comprehension", title: "Quick check",
  hint: "Four questions about the setup. If needed, review the instructions and try once more.",
  items: [
    {
      kind: "choice", id: "COMP1", text: "Who can influence the Member's evaluation, bonus, and future work assignments?",
      options: [
        { value: "leader", label: "The Leader" }, { value: "member", label: "The Member" },
        { value: "both", label: "Both, together" }, { value: "neither", label: "Neither person" },
      ],
    },
    { kind: "choice", id: "COMP2", text: "Can either person make the final decision on both working conditions without the other person agreeing?", columns: 2,
      options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }] },
    { kind: "choice", id: "COMP3", text: "May you disclose the exact figures on your private scorecard to the counterpart?", columns: 2,
      options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }] },
    {
      kind: "choice", id: "COMP4", text: "Which statement about sharing personal background is correct?",
      options: [
        { value: "required", label: "Sharing it is required to reach an agreement." },
        { value: "optional", label: "Sharing it is optional, and information conveyed may be considered in later evaluations or bonus decisions." },
        { value: "protected", label: "Information conveyed by a Proxy cannot affect later evaluations." },
      ],
    },
  ],
};
export const COMPREHENSION_ANSWERS: Record<string, string> = { COMP1: "leader", COMP2: "no", COMP3: "no", COMP4: "optional" };
export const COMPREHENSION_REMEDIATION: Record<string, string> = {
  COMP1: "The Leader can influence the Member's evaluation, bonus, and future work assignments.",
  COMP2: "Neither side can decide both terms alone. Both sides must agree.",
  COMP3: "Your scorecard figures are private and must not be disclosed.",
  COMP4: "Sharing personal background is optional. Information that is conveyed may be considered in the later bonus or upward evaluation.",
};

export function practiceReasonItem(role: Role): Item {
  const leader = role === "leader";
  return {
    kind: "choice", id: "PRAC1",
    text: leader ? "Why is moving next week advantageous to you?" : "Why is the printer beside your desk advantageous to you?",
    options: [
      { value: "reason", label: leader ? "It gets done before the quarterly review" : "It is the one spot you can reach without getting up" },
      { value: "points", label: "Because it is worth the most points" },
      { value: "other_side", label: "Because the other side prefers it" },
      { value: "unsure", label: "No particular reason" },
    ],
  };
}
export const PRACTICE_REASON_ANSWER = "reason";

function percItems(role: Role): Item[] {
  const outcome = role === "member" ? "my bonus" : "the evaluation of me sent to the director";
  return [
    { kind: "scale", id: "PERC-F1", text: "I felt that sharing this background could make me seem less competent to the counterpart.", ...AGREE },
    { kind: "scale", id: "PERC-F2", text: "I felt that sharing this background could harm my professional image.", ...AGREE },
    { kind: "scale", id: "PERC-I1", text: `I was concerned that sharing this background could negatively affect ${outcome}.`, ...AGREE },
    { kind: "scale", id: "PERC-I2", text: `I felt that keeping this background private would be safer for ${outcome}.`, ...AGREE },
  ];
}

export function experienceBlocks(role: Role): Block[] {
  return [
    {
      id: "perc", title: "Your decision about sharing",
      hint: "Think back to when you decided whether to share this background. Answer whether or not you shared it. Sharing includes allowing your Proxy to convey it. 1 = Strongly disagree, 7 = Strongly agree.",
      items: percItems(role),
    },
    {
      id: "pcr", title: "Now think about the counterpart", hint: "1 = Strongly disagree, 7 = Strongly agree.",
      items: [
        { kind: "scale", id: "PCR4", text: "The counterpart seemed competent.", ...AGREE },
        { kind: "scale", id: "PCR5", text: "The counterpart seemed honest.", ...AGREE },
        { kind: "scale", id: "PCR6", text: "I would like to work with this counterpart on a future project.", ...AGREE },
      ],
    },
    {
      id: "satisfaction", title: "The process and outcome",
      hint: "Please rate the negotiation process and its final outcome separately.",
      items: [
        { kind: "scale", id: "PNPQ1", text: "Overall, I was satisfied with how the negotiation proceeded.", ...AGREE },
        { kind: "scale", id: "PNOQ1", text: "I was satisfied with the final outcome of the negotiation.", ...AGREE },
      ],
    },
  ];
}

export const PROXY_EXPERIENCE_BLOCKS: Block[] = [
  {
    id: "own_ai", title: "Your AI Proxy", hint: "1 = Strongly disagree, 7 = Strongly agree.",
    items: [
      { kind: "scale", id: "OWN-AI2", text: "My AI Proxy represented my requests and reasons well.", ...AGREE },
      { kind: "scale", id: "OWN-AI4", text: "I felt responsible for the content of the requests and reasons conveyed by my AI Proxy.", ...AGREE },
    ],
  },
  {
    id: "other_ai", title: "The counterpart's AI Proxy", hint: "1 = Strongly disagree, 7 = Strongly agree.",
    items: [
      { kind: "scale", id: "OTHER-AI2", text: "I could distinguish reasons provided by the counterpart from reasons added by the AI.", ...AGREE },
      { kind: "scale", id: "OTHER-AI4", text: "I felt that the counterpart was responsible for the content of the requests and reasons conveyed by their AI Proxy.", ...AGREE },
    ],
  },
];

const OPEN_HINT = "Please explain in your own words. A brief answer is fine; there is no minimum word count.";
export function disclosureOpenBlock(isProxy: boolean): Block {
  return {
    id: "disclosure_open", title: "In your own words", hint: OPEN_HINT,
    items: isProxy
      ? [{ kind: "text", id: "OE-DISC-P", text: "What background did you allow your Proxy to use, and why did you make that choice?", hint: "Optional prompt: What mattered most when you made this choice?", placeholder: "A brief answer is fine.", rows: 4 }]
      : [{ kind: "text", id: "OE-DISC-D", text: "How did you decide what to share or keep to yourself in this negotiation, and why?", hint: "Optional prompt: Did your decision change during the conversation? What led to that change?", placeholder: "A brief answer is fine.", rows: 4 }],
  };
}
export function postCommentOpenBlocks(isProxy: boolean): Block[] {
  const items: Item[] = isProxy
    ? [
        { kind: "text", id: "OE-SELF-P", text: "What did you initially expect from your Proxy, and why? How did you feel about it as the negotiation unfolded, and what led you to feel that way?", hint: "Optional prompt: Consider a message that matched or changed how you wanted your position to be presented. Why did that matter to you?", placeholder: "A brief answer is fine.", rows: 4 },
        { kind: "text", id: "OE-OTHER-P", text: "How did you interpret the counterpart's Proxy and the person it represented? Which parts of its messages led you to that interpretation?", hint: "Optional prompt: Were there any reasons you associated with the person or with the AI? What made you think so? You may also discuss the final comment.", placeholder: "A brief answer is fine.", rows: 4 },
      ]
    : [{ kind: "text", id: "OE-INTERP-D", text: "How did you feel about the counterpart, and what did they say or do that led you to feel that way?", hint: "Optional prompt: You may refer to the negotiation or the final comment. A specific example would help.", placeholder: "A brief answer is fine.", rows: 4 }];
  return items.map((item, index) => ({
    id: `interpretation_open_${index + 1}`,
    title: "Looking back",
    hint: OPEN_HINT,
    items: [item],
  }));
}

export const BONUS_ITEM: Item = {
  kind: "amount", id: "BONUS",
  text: `Considering the negotiation and your experience with the Member, how much of this task's ${STUDY.currencySymbol}${STUDY.bonusPerTask} bonus would you recommend for them?`,
  unit: `Choose a value from ${STUDY.currencySymbol}0.00 to ${STUDY.currencySymbol}${STUDY.bonusPerTask}.`, step: 1,
};
export const RECV_EVAL_BLOCK: Block = {
  id: "recv_eval", title: "Your evaluation of the Leader", hint: "This evaluation will be sent to the director.",
  items: [{ kind: "scale", id: "RECV-EVAL", text: "Overall, how would you evaluate the Leader as a colleague?", low: "Very negatively", high: "Very positively" }],
};
export const ATTR_BLOCK: Block = {
  id: "attr", title: "Your response to the final comment", hint: "Use the labels shown for each question.",
  items: [{ kind: "scale", id: "ATTR1", text: "The counterpart's comment bothered me.", ...AGREE }],
};
export const ATTR_PROXY_ITEM: Item = {
  kind: "scale", id: "ATTR2", text: "Whom did you feel the counterpart's comment was directed at?",
  low: "Entirely at my AI Proxy", high: "Entirely at me",
};
export const REMARK_REPLY_ITEM: Item = {
  kind: "text", id: "REMARK_REPLY", text: "Anything you would like to say back to them.", placeholder: "Optional", rows: 2,
};

export const OE_COMPARE_BLOCK: Block = {
  id: "oe_compare", title: "Comparing the two experiences", hint: OPEN_HINT,
  items: [{ kind: "text", id: "OE-COMP", text: "What difference, if any, mattered most to you between negotiating directly and using a Proxy, and why?", hint: "Optional prompt: You may discuss what you shared, how you were represented, or how you interpreted the counterpart's responses. You can also mention anything else about the experience.", placeholder: "A brief answer is fine.", rows: 4 }],
};
export const POWER_BLOCK: Block = {
  id: "role_study", title: "Your role and the study",
  hint: "1 = Strongly disagree, 7 = Strongly agree.",
  items: [
    { kind: "scale", id: "POWER1", text: "I could influence the counterpart's evaluation, rewards, or future opportunities.", ...AGREE },
    { kind: "scale", id: "POWER2", text: "My important outcomes depended on the counterpart's decisions.", ...AGREE },
    { kind: "scale", id: "IMM2", text: "This negotiation situation felt plausible in a real workplace.", ...AGREE },
    { kind: "scale", id: "INCENT1", text: "The bonus amount was meaningful enough to consider when making my decisions.", ...AGREE },
  ],
};
export const CP_BLOCK: Block = {
  id: "cp", title: "The direct interaction",
  hint: "Think back to the task where you negotiated directly with the counterpart, rather than through your Proxy. 1 = Strongly disagree, 7 = Strongly agree.",
  items: [
    { kind: "scale", id: "CP1", text: "During the direct negotiation, the counterpart's messages felt natural.", ...AGREE },
    { kind: "scale", id: "CP2", text: "During the direct negotiation, the counterpart responded to what I said.", ...AGREE },
  ],
};
export const SUS_UNUSUAL_BLOCK: Block = {
  id: "sus_unusual", title: "The interaction",
  items: [{ kind: "text", id: "SUS0", text: "Was there anything unusual or unexpected about the negotiations?", placeholder: "Enter None if there was nothing unusual or unexpected.", rows: 3 }],
};
export const SUS_IDENTITY_BLOCK: Block = {
  id: "sus_identity", title: "One final question", optional: ["SUS3-WHEN"],
  items: [
    { kind: "choice", id: "SUS3", text: "Did you ever think the counterpart might not be a real person?", columns: 2, options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }] },
    { kind: "text", id: "SUS3-WHEN", text: "When did you first think so, and what led you to that thought?", placeholder: "Shown only when you answer Yes.", rows: 3 },
  ],
};

export function requiredIds(block: Block): string[] {
  const optional = new Set(block.optional ?? []);
  return block.items.map((item) => item.id).filter((id) => !optional.has(id));
}
export function forTask(items: Item[], taskIndex: 1 | 2): Item[] {
  return items.map((item) => ({ ...item, id: `${item.id}_t${taskIndex}` }));
}
export function blockForTask(block: Block, taskIndex: 1 | 2): Block {
  return { ...block, items: forTask(block.items, taskIndex), optional: block.optional?.map((id) => `${id}_t${taskIndex}`) };
}

const MOCK_TEXT: Record<string, string> = {
  "OE-DISC-D": "I shared what seemed necessary once the other person asked why it mattered.",
  "OE-DISC-P": "I allowed the work background but kept the personal detail private because it felt unnecessary.",
  "OE-INTERP-D": "The counterpart seemed direct but responsive because they adjusted their proposal after my explanation.",
  "OE-SELF-P": "I expected the Proxy to state my position clearly, and its concise explanation matched that expectation.",
  "OE-OTHER-P": "I associated the specific personal detail with the person and the general work argument with the AI.",
  "OE-COMP": "The Proxy created distance from the request, while direct negotiation gave me more control over each explanation.",
  SUS0: "Nothing especially unusual stood out during either negotiation.",
  "SUS3-WHEN": "The response timing first made me wonder during the direct task.",
  REMARK_REPLY: "Thanks for sharing that. I understand the request felt strong.",
};
export function dummyAnswer(item: Item): string | number {
  switch (item.kind) {
    case "scale": return 5;
    case "amount": return 50;
    case "choice":
    case "select": return item.options[0].value;
    case "number": return item.id === "BG1" ? "34" : "8";
    default: return MOCK_TEXT[item.id.replace(/_t[12]$/, "")] ?? "A brief response for the study walkthrough.";
  }
}
