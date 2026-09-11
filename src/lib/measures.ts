/** Canonical participant instrument: Experimental Design Ver.2.26 section 9. */
import type { Role } from "./types";
import { STUDY } from "./study-config";

type ItemBase = { id: string; text: string; hint?: string };
export type Item = ItemBase & (
  | { kind: "scale"; low?: string; high?: string; points?: number }
  | { kind: "amount"; unit?: string; step?: number }
  | { kind: "choice"; options: Array<{ value: string; label: string }>; columns?: 1 | 2 }
  | { kind: "select"; options: Array<{ value: string; label: string }>; half?: boolean }
  | { kind: "number"; placeholder?: string; half?: boolean }
  | { kind: "line"; placeholder?: string; half?: boolean }
  | { kind: "text"; placeholder?: string; rows?: number }
);
export type ChoiceItem = Extract<Item, { kind: "choice" }>;
export interface Block { id: string; title: string; hint?: string; items: Item[]; optional?: string[] }
const AGREE = { low: "Strongly disagree", high: "Strongly agree" };

export const BACKGROUND_BLOCKS: Block[] = [
  {
    id: "demographics", title: "About you",
    hint: "These questions describe the study sample. You may choose not to answer demographic questions.",
    optional: ["BG1", "BG4", "BG8", "BG9"],
    items: [
      { kind: "number", id: "BG1", text: "What is your age?", placeholder: "e.g. 34", half: true },
      { kind: "select", id: "BG2", text: "How would you describe your gender?", half: true, options: [
        { value: "woman", label: "Woman" }, { value: "man", label: "Man" },
        { value: "nonbinary", label: "Non-binary" }, { value: "no_answer", label: "Prefer not to say" },
      ] },
      { kind: "select", id: "BG3", text: "What is your current employment status?", half: true, options: [
        { value: "full_time", label: "Full-time" }, { value: "part_time", label: "Part-time" },
        { value: "self_employed", label: "Self-employed" }, { value: "not_employed", label: "Not employed" },
        { value: "student", label: "Student" }, { value: "other", label: "Other" },
        { value: "no_answer", label: "Prefer not to say" },
      ] },
      { kind: "number", id: "BG4", text: "How many years of work experience do you have?", placeholder: "e.g. 8", half: true },
      { kind: "select", id: "BG8", text: "How would you describe your race or ethnicity? (Optional)", half: true, options: [
        { value: "asian", label: "Asian" }, { value: "black", label: "Black" },
        { value: "white", label: "White" }, { value: "middle_eastern_north_african", label: "Middle Eastern/North African" },
        { value: "indigenous", label: "Indigenous" }, { value: "mixed_multiple", label: "Mixed/multiple backgrounds" },
        { value: "another_background", label: "Another background" }, { value: "no_answer", label: "Prefer not to say" },
      ] },
      { kind: "line", id: "BG9", text: "What country do you currently live in? (Optional)", placeholder: "e.g. United Kingdom", half: true },
      { kind: "choice", id: "BG5", text: "Have you worked as a supervisor or manager?", columns: 2, options: [
        { value: "no", label: "No" }, { value: "yes", label: "Yes" }, { value: "no_answer", label: "Prefer not to say" },
      ] },
      { kind: "scale", id: "BG6", text: "How often do you use generative AI tools (e.g., ChatGPT)?", low: "Never", high: "Daily or almost daily" },
      { kind: "select", id: "BG7", text: "During the past 12 months, how often have you discussed and tried to agree on changes to work arrangements (such as workload, schedules, or task responsibilities) with colleagues or a supervisor?", options: [
        { value: "never", label: "Never" }, { value: "less_than_monthly", label: "Less than monthly" },
        { value: "monthly", label: "Monthly" }, { value: "weekly", label: "Weekly" },
        { value: "daily", label: "Daily or almost daily" }, { value: "not_employed", label: "Not employed during this period" },
        { value: "no_answer", label: "Prefer not to say" },
      ] },
    ],
  },
  { id: "fts", title: "How you see yourself", hint: "1 = Strongly disagree, 7 = Strongly agree. There are no right answers.", items: [
    { kind: "scale", id: "FTS1", text: "My feelings are hurt easily.", ...AGREE },
    { kind: "scale", id: "FTS2", text: "I don't respond well to direct criticism.", ...AGREE },
    { kind: "scale", id: "FTS3", text: "I am pretty thin-skinned.", ...AGREE },
  ] },
  { id: "aia", title: "Your views about AI", hint: "1 = Strongly disagree, 7 = Strongly agree.", items: [
    { kind: "scale", id: "AIA1", text: "AI has many beneficial applications.", ...AGREE },
    { kind: "scale", id: "AIA2", text: "AI is helpful in daily life.", ...AGREE },
    { kind: "scale", id: "AIA3", text: "I want to interact with AI in my everyday life.", ...AGREE },
    { kind: "scale", id: "AIA4", text: "Society will benefit from AI.", ...AGREE },
    { kind: "scale", id: "AIA5", text: "I am willing to delegate part of complex decisions to AI.", ...AGREE },
  ] },
];

export const COMPREHENSION_BLOCK: Block = { id: "comprehension", title: "Quick check", hint: "Four questions about the setup. If needed, review the instructions and try once more.", items: [
  { kind: "choice", id: "IC1", text: "Who can influence the Member's evaluation, bonus, and future work assignments?", options: [
    { value: "leader", label: "The Leader" }, { value: "member", label: "The Member" },
    { value: "both", label: "Both, together" }, { value: "neither", label: "Neither person" },
  ] },
  { kind: "choice", id: "IC2", text: "Can either side fix both terms alone?", columns: 2, options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }] },
  { kind: "choice", id: "IC3", text: "May you disclose the exact figures on your private scorecard to the counterpart?", columns: 2, options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }] },
  { kind: "choice", id: "IC4", text: "Which statement about sharing personal background is correct?", options: [
    { value: "required", label: "Sharing it is required to reach an agreement." },
    { value: "optional", label: "Sharing it is optional, and information conveyed may be considered in later evaluations or bonus decisions." },
    { value: "protected", label: "Information conveyed by a Proxy cannot affect later evaluations." },
  ] },
] };
export const COMPREHENSION_ANSWERS: Record<string, string> = { IC1: "leader", IC2: "no", IC3: "no", IC4: "optional" };
export const COMPREHENSION_REMEDIATION: Record<string, string> = {
  IC1: "The Leader can influence the Member's evaluation, bonus, and future work assignments.",
  IC2: "Neither side can decide both terms alone. Both sides must agree.",
  IC3: "Your scorecard figures are private and must not be disclosed.",
  IC4: "Sharing personal background is optional. Information that is conveyed may be considered in the later bonus or upward evaluation.",
};

export const DIRECT_PRACTICE_CHECK: ChoiceItem = {
  kind: "choice", id: "IC5",
  text: "During direct negotiation, who writes the messages you send to the counterpart?",
  columns: 2,
  options: [{ value: "you", label: "You" }, { value: "proxy", label: "Your AI Proxy" }],
};
export const PROXY_PRACTICE_CHECK: ChoiceItem = {
  kind: "choice", id: "IC6",
  text: "After the two AI Proxies finish, what must happen for an agreement to become final?",
  options: [
    { value: "mutual_confirmation", label: "You talk with the other participant and both confirm the final agreement." },
    { value: "automatic", label: "The Proxy result becomes final automatically." },
    { value: "solo_review", label: "You review it alone and approve or reject it." },
  ],
};
export const PRACTICE_CHECK_ANSWERS: Record<string, string> = {
  IC5: "you",
  IC6: "mutual_confirmation",
};
export const PRACTICE_CHECK_REMEDIATION: Record<string, string> = {
  IC5: "You write the messages you send during direct negotiation.",
  IC6: "You talk with the other participant after the Proxy exchange. An agreement becomes final only when both of you confirm the same terms. You can also end the task without agreement, in which case both sides receive 0 task points.",
};

export function experienceBlocks(role: Role, isProxy = false): Block[] {
  const outcome = role === "member" ? "my bonus" : "the evaluation of me sent to the director";
  const sharingHint = `Think back to when you decided whether to share this background. Answer whether or not you shared it. Sharing includes allowing your Proxy to convey it.${isProxy ? " For the Proxy task, consider the way your Proxy was instructed to convey the background." : ""} 1 = Strongly disagree, 7 = Strongly agree.`;
  return [
    { id: "social_cost_face", title: "Your decision about sharing", hint: sharingHint, items: [
      { kind: "scale", id: "SCF1", text: "I felt that sharing this background could make me seem less competent to the counterpart.", ...AGREE },
      { kind: "scale", id: "SCF2", text: "I felt that sharing this background could harm my professional image.", ...AGREE },
    ] },
    { id: "social_cost_evaluation", title: "Your decision and later evaluation", hint: "1 = Strongly disagree, 7 = Strongly agree.", items: [
      { kind: "scale", id: "SCE1", text: `I was concerned that sharing this background could negatively affect ${outcome}.`, ...AGREE },
      { kind: "scale", id: "SCE2", text: `I felt that keeping this background private would be safer for ${outcome}.`, ...AGREE },
    ] },
    { id: "counterpart_evaluation", title: "Now think about the counterpart", hint: "Now think about the person you negotiated with, including the person represented by the other Proxy. 1 = Strongly disagree, 7 = Strongly agree.", items: [
      { kind: "scale", id: "CE1", text: "The counterpart seemed competent.", ...AGREE },
      { kind: "scale", id: "CE2", text: "The counterpart seemed honest.", ...AGREE },
      { kind: "scale", id: "CE3", text: "I would like to work with this counterpart on a future project.", ...AGREE },
    ] },
    { id: "negotiation_satisfaction", title: "The process and outcome", hint: "Please rate the negotiation process and its final outcome separately. 1 = Strongly disagree, 7 = Strongly agree.", items: [
      { kind: "scale", id: "NS1", text: "Overall, I was satisfied with how the negotiation proceeded.", ...AGREE },
      { kind: "scale", id: "NS2", text: "I was satisfied with the final outcome of the negotiation.", ...AGREE },
    ] },
  ];
}

const OWN_RESPONSIBILITY: Item[] = [
  { kind: "scale", id: "PMP3", text: "I felt responsible for the content of the reasons conveyed by my AI Proxy.", ...AGREE },
  { kind: "scale", id: "PMP4", text: "I felt that my AI Proxy was responsible for the content of the reasons it conveyed.", ...AGREE },
];
const OTHER_RESPONSIBILITY: Item[] = [
  { kind: "scale", id: "POP3", text: "I felt that the counterpart was responsible for the content of the reasons conveyed by their AI Proxy.", ...AGREE },
  { kind: "scale", id: "POP4", text: "I felt that the counterpart's AI Proxy was responsible for the content of the reasons it conveyed.", ...AGREE },
];

export type ResponsibilityOrder = "human_first" | "ai_first";
export function responsibilityOrder(participantKey: string): ResponsibilityOrder {
  const parity = [...participantKey].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2;
  return parity === 0 ? "human_first" : "ai_first";
}

/** Deterministic presentation order, stable on reload; allocation balance is verified at recruitment. */
export function proxyExperienceBlocks(participantKey: string): Block[] {
  const ownOrder = responsibilityOrder(participantKey);
  const order = (items: Item[], value: ResponsibilityOrder) => value === "human_first" ? items : [items[1], items[0]];
  const otherOrder = ownOrder === "human_first" ? "ai_first" : "human_first";
  const responsibilityHint = "Think about the reasons actually conveyed in the messages, including any reasons the AI added. Rate each statement separately. More than one party can be responsible for the same content.";
  return [
    { id: "perception_my_proxy", title: "Your AI Proxy", hint: `1 = Strongly disagree, 7 = Strongly agree. ${responsibilityHint}`, items: [
      { kind: "scale", id: "PMP1", text: "I felt I could trust my AI Proxy to negotiate on my behalf.", ...AGREE },
      { kind: "scale", id: "PMP2", text: "My AI Proxy represented my requests and reasons well.", ...AGREE },
      ...order(OWN_RESPONSIBILITY, ownOrder),
    ] },
    { id: "perception_other_proxy", title: "The counterpart's AI Proxy", hint: "1 = Strongly disagree, 7 = Strongly agree.", items: [
      { kind: "scale", id: "POP1", text: "I felt I could trust the information conveyed by the counterpart's AI Proxy.", ...AGREE },
      { kind: "scale", id: "POP2", text: "It was clear to me which reasons came from the counterpart and whether any were added by the AI.", ...AGREE },
      ...order(OTHER_RESPONSIBILITY, otherOrder),
    ] },
  ];
}

const OPEN_HINT = "Please explain in your own words. A brief answer is fine; there is no minimum word count.";
export function legacyTaskOpenBlocks(isProxy: boolean): Block[] {
  const blocks: Block[] = [
    { id: "open_disclosure", title: "Your decision about sharing", hint: `${OPEN_HINT}${isProxy ? " In the Proxy task, sharing includes allowing your AI Proxy to use the background." : ""}`, items: [{
      kind: "text", id: "OED1", text: "How did you decide what to share or keep to yourself in this negotiation, and why?",
      hint: "Optional prompt: What did you expect would happen if you shared it, and why?", placeholder: "A brief answer is fine.", rows: 4,
    }] },
    { id: "open_evaluation", title: "Your impression of the counterpart", hint: OPEN_HINT, items: [{
      kind: "text", id: "OEE1", text: "What impression did you form of the counterpart, and which messages or actions led you to that impression?",
      hint: isProxy ? "Optional prompt: How, if at all, did the other Proxy affect your view of the person it represented, and why?" : undefined,
      placeholder: "A brief answer is fine.", rows: 4,
    }] },
  ];
  if (isProxy) blocks.push({ id: "open_proxy", title: "Your experience with your Proxy", hint: OPEN_HINT, items: [{
    kind: "text", id: "OEP1", text: "What did you initially expect from your Proxy, and why? What in the negotiation reinforced or changed your view of it?",
    hint: "Optional prompt: Think of a particular message and explain why it mattered to you.", placeholder: "A brief answer is fine.", rows: 4,
  }] });
  blocks.push({ id: "open_task_comment", title: "Anything else?", optional: ["OET1"], items: [{
    kind: "text", id: "OET1", text: "Is there anything else about this task or the way you negotiated that you would like to share?",
    hint: "Optional. You may leave this blank.", placeholder: "Any other thoughts about this task (optional).", rows: 3,
  }] });
  return blocks;
}

export const OPEN_INSTRUMENT_VERSION = "2.27-open-v3";
export const OPEN_INSTRUMENT_V2 = "2.27-open-v2";

export function isExpandedOpenInstrument(version: unknown): boolean {
  return version === OPEN_INSTRUMENT_VERSION || version === OPEN_INSTRUMENT_V2;
}

type ExpandedOpenInstrumentVersion =
  | typeof OPEN_INSTRUMENT_VERSION
  | typeof OPEN_INSTRUMENT_V2;

function expandedTaskOpenBlocks(
  isProxy: boolean,
  options: { role?: Role; taskIndex?: 1 | 2 },
  version: ExpandedOpenInstrumentVersion,
): Block[] {
  const text = (id: string, question: string, probe: string): Item => ({
    kind: "text", id, text: question, hint: `Optional prompt: ${probe}`,
    placeholder: "A brief answer is fine.", rows: 3,
  });
  const blocks: Block[] = [
    { id: "open_choices_reactions", title: "Your choices and reactions", hint: `Please describe your experience in your own words. Brief answers are welcome. The prompts below are optional ways to expand your answer; there are no right or wrong answers.${isProxy ? " Sharing includes allowing your AI Proxy to use the background." : ""}`, items: [
      text("OED1", "At the start, how did you decide what background to share or keep private, and why?", "What did you expect sharing or withholding it might change, including any benefits or concerns?"),
      text("OEI1", "Did anything during the negotiation change what you wanted to share or how you wanted to proceed? Why or why not?", "You can describe a particular message or moment, or explain why your approach stayed the same."),
      text("OEF1", "How did you feel when your reasons were conveyed or kept private, and why?", "What, if anything, did the other person's response mean to you personally?"),
    ] },
    { id: "open_impressions_outcome", title: "Your impressions and the outcome", items: [
      text("OEE1", "What impression did you form of the counterpart, and which messages or actions led you to that impression?", `If relevant, explain how that impression related to your ${options.role === "leader" ? "bonus recommendation" : options.role === "member" ? "evaluation of the Leader" : "bonus recommendation or evaluation"}.`),
      text("OEN1", "How did you feel about the negotiation process and how the task ended, and why?", "What, if anything, felt satisfactory, difficult, or unresolved?"),
    ] },
    { id: "open_workplace", title: "Thinking about your workplace", items: [
      text("OER1", "In a real workplace, would you share different information if you negotiated in the same way? Why or why not?", "Consider ongoing working relationships, workplace expectations, or consequences beyond this study."),
    ] },
  ];
  if (isProxy) {
    if (version === OPEN_INSTRUMENT_V2) {
      blocks.push(
        { id: "open_proxy_voice_control", title: "Your voice and control", items: [
          text("OEP1", "How well did your Proxy express what you wanted to say, and why?", "What matched or differed from your intended meaning or way of speaking?"),
          text("OEP2", "How, if at all, did using a Proxy affect your sense of control over the negotiation, and why?", "Consider choosing its instructions, watching the exchange, and discussing the terms yourself afterward."),
        ] },
        { id: "open_proxy_reasons", title: "Understanding the reasons", items: [
          text("OEP3", "Who, if anyone, do you see as responsible for the reasons your Proxy conveyed, and why?", "You may discuss yourself, the AI, both, or neither; their responsibilities need not be the same."),
          text("OEP4", "How did you understand where the reasons conveyed by the other Proxy came from, and why?", "What could you tell, or not tell, about the person's input and any AI contribution? How did that shape your interpretation?"),
        ] },
      );
    } else {
      blocks.push(
        { id: "open_proxy_mine", title: "Your Proxy", items: [
          text("OEP1", "How did you feel about the way your Proxy represented you and how much say you had in the negotiation, and why?", "Consider what matched or differed from your intentions and any moments when you wanted more or less involvement."),
          text("OEP3", "Who, if anyone, do you see as responsible for the reasons your Proxy conveyed, and why?", "You may discuss yourself, the AI, both, or neither; their responsibilities need not be the same."),
        ] },
        { id: "open_proxy_other", title: "The other Proxy", items: [
          text("OEP4", "How did you understand where the reasons conveyed by the other Proxy came from, and why?", "What could you tell, or not tell, about the person's input and any AI contribution? How did that shape your interpretation?"),
          text("OEP5", "Who, if anyone, do you see as responsible for the reasons the other Proxy conveyed, and why?", "You may discuss the person it represented, the AI, both, or neither; their responsibilities need not be the same."),
        ] },
      );
    }
  }
  if (options.taskIndex === 2) blocks.push(OEC1_BLOCK);
  blocks.push(legacyTaskOpenBlocks(false).find((block) => block.id === "open_task_comment")!);
  return blocks;
}

export function taskOpenBlocks(
  isProxy: boolean,
  options: { role?: Role; taskIndex?: 1 | 2; version?: string } = {},
): Block[] {
  if (options.version === undefined || options.version === OPEN_INSTRUMENT_VERSION) {
    return expandedTaskOpenBlocks(isProxy, options, OPEN_INSTRUMENT_VERSION);
  }
  if (options.version === OPEN_INSTRUMENT_V2) {
    return expandedTaskOpenBlocks(isProxy, options, OPEN_INSTRUMENT_V2);
  }
  return legacyTaskOpenBlocks(isProxy);
}

export const BR1_ITEM: Item = {
  kind: "amount", id: "BR1",
  text: `Considering the negotiation and your experience with the Member, how much of this task's ${STUDY.currencySymbol}${STUDY.bonusPerTask} bonus would you recommend for them?`,
  unit: `Choose a value from ${STUDY.currencySymbol}0.00 to ${STUDY.currencySymbol}${STUDY.bonusPerTask}.`, step: 1,
};
export const FE1_BLOCK: Block = { id: "formal_evaluation", title: "Your evaluation of the Leader", hint: "This evaluation will be sent to the director.", items: [
  { kind: "scale", id: "FE1", text: "Overall, how would you evaluate the Leader as a colleague?", low: "Very negatively", high: "Very positively" },
] };

export const END_CHECK_BLOCKS: Block[] = [
  { id: "role_scenario_checks", title: "Your role", hint: "1 = Strongly disagree, 7 = Strongly agree.", items: [
    { kind: "scale", id: "RSC1", text: "I could influence the counterpart's evaluation, rewards, or future opportunities.", ...AGREE },
    { kind: "scale", id: "RSC2", text: "My important outcomes depended on the counterpart's decisions.", ...AGREE },
    { kind: "scale", id: "RSC3", text: "This negotiation situation felt plausible in a real workplace.", ...AGREE },
    { kind: "scale", id: "RSC4", text: "The bonus amount was meaningful enough to consider when making my decisions.", ...AGREE },
  ] },
  { id: "interaction_checks", title: "The direct interaction", hint: "Think back to the task where you negotiated directly with the counterpart. 1 = Strongly disagree, 7 = Strongly agree.", items: [
    { kind: "scale", id: "ICC1", text: "During the direct negotiation, the counterpart's messages felt natural.", ...AGREE },
    { kind: "scale", id: "ICC2", text: "During the direct negotiation, the counterpart responded to what I said.", ...AGREE },
    { kind: "text", id: "ICC3", text: "Is there anything about the counterpart's responses that you would like to comment on? If so, what stood out and why?", placeholder: "Enter None if there is nothing you would like to add.", rows: 3 },
  ] },
];
export const OEC1_BLOCK: Block = { id: "open_comparison", title: "Comparing the two experiences", hint: OPEN_HINT, items: [{
  kind: "text", id: "OEC1", text: "What difference, if any, mattered most to you between negotiating directly and using a Proxy, and why?",
  hint: "Optional prompt: You can also mention an experience or concern that the earlier questions did not cover.", placeholder: "A brief answer is fine.", rows: 4,
}] };

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
  OED1: "I shared what seemed necessary once the other person asked why it mattered.",
  OEE1: "The counterpart seemed direct but responsive because they adjusted their proposal after my explanation.",
  OEP1: "I expected the Proxy to state my position clearly, and its concise explanation matched that expectation.",
  OEC1: "The Proxy created distance from the request, while direct negotiation gave me more control over each explanation.",
  ICC3: "Nothing especially unusual stood out during the direct negotiation.",
};
export function dummyAnswer(item: Item): string | number {
  switch (item.kind) {
    case "scale": return 5;
    case "amount": return 50;
    case "choice":
    case "select": return item.options[0].value;
    case "number": return item.id === "BG1" ? "34" : "8";
    default: return item.id === "BG9" ? "United Kingdom" : MOCK_TEXT[item.id.replace(/_t[12]$/, "")] ?? "A brief response for the study walkthrough.";
  }
}
