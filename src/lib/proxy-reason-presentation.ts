import { PROXY_WORK_BENEFITS } from "./tasks";
import type {
  NegotiationTask,
  ProxyPolicy,
  ReasonCard,
  Role,
} from "./types";

export interface ProxyReasonPresentation {
  base: string;
  addition: null | {
    transition: string;
    benefits: readonly [string, string];
  };
  text: string;
}

const MAX_BASE_BUBBLE_CHARS = 220;

const ADDITION_TRANSITION = "In addition, considering the work arrangements,";

const ISSUE_GROUNDS: Readonly<Record<string, string>> = {
  office_days: "the office-day arrangement",
  client_presentations: "the client-presentation duties",
  account_days: "the new-project time arrangement",
  weekly_reports: "the weekly-reporting duties",
};

/**
 * Renders the policy-controlled proxy reason from fixed source text.
 *
 * Both policies share the same factual base byte for byte. AI-Supplemented
 * follows it with exactly two approved work benefits; it never abstracts,
 * hides, hedges, or invents facts from the authorized card.
 */
export function renderProxyReason(
  task: NegotiationTask,
  role: Role,
  card: ReasonCard,
  policy: ProxyPolicy,
): ProxyReasonPresentation {
  const source = card.relayed ?? card.text;
  const issueGround = ISSUE_GROUNDS[card.issueId];
  if (
    !task.issues.some((candidate) => candidate.id === card.issueId) ||
    !issueGround
  ) {
    throw new Error(`Unknown issue for proxy reason card: ${card.issueId}`);
  }
  const grounds =
    card.layer === "work"
      ? "Based on the circumstances provided, there are grounds to discuss both work arrangements."
      : `Based on the circumstances provided, there is a basis for adjusting ${issueGround}.`;
  const base = `${source} ${grounds}`;

  if (policy === "user_specified") {
    return { base, addition: null, text: base };
  }

  if (task.id === "practice") {
    throw new Error("Proxy reason additions are not defined for practice");
  }

  const benefits = PROXY_WORK_BENEFITS[task.id][role];
  const addition = {
    transition: ADDITION_TRANSITION,
    benefits,
  } as const;

  return {
    base,
    addition,
    text: `${base} ${addition.transition} ${benefits[0]} ${benefits[1]}`,
  };
}

/**
 * Adds display bubble boundaries without changing any policy-controlled text.
 * Base facts split only between sentences; each AI benefit stays intact.
 */
export function formatProxyReasonBubbles(
  presentation: ProxyReasonPresentation,
): string {
  const sentences = presentation.base.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!sentences) return presentation.text;

  const bubbles: string[] = [];
  let current = "";
  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (current && candidate.length > MAX_BASE_BUBBLE_CHARS) {
      bubbles.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) bubbles.push(current);

  if (presentation.addition) {
    bubbles.push(
      `${presentation.addition.transition} ${presentation.addition.benefits[0]}`,
      presentation.addition.benefits[1],
    );
  }

  return bubbles.join(" || ");
}
