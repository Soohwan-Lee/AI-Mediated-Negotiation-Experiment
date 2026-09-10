import { PROXY_WORK_BENEFITS } from "./tasks";
import type {
  NegotiationTask,
  ProxyPolicy,
  ReasonCard,
  Role,
  TaskId,
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

export const ADDITION_TRANSITION = "Additional work considerations from this Proxy:";

/** Fixed, fact-preserving Proxy wording; original cards remain unchanged. */
export const PROXY_REASON_BASES: Readonly<
  Record<TaskId, Readonly<Record<Role, Readonly<Record<ReasonCard["layer"], string>>>>>
> = {
  task_a: {
    leader: {
      work: "High client expectations make the project's first few weeks important. Time together supports coordination, and presentations shape the client's early impression. Both office attendance and presentation duties need consideration.",
      sensitive: "The office-day request reflects a commitment the Leader made to the director before consulting the team: four office days a week would be possible. The director has already reported this upward, and the team has not been told.",
    },
    member: {
      work: "The Member's broad analysis workload this quarter leaves limited time for other duties. Commuting and meetings on office days reduce analysis time, and presentation preparation takes several days. Both arrangements contribute to the workload.",
      sensitive: "The request to adjust presentation duties relates to feedback after the last presentation. The client contact told the Member privately that they would prefer the Leader to present in future. The Member has not passed this request on to the Leader.",
    },
  },
  task_b: {
    leader: {
      work: "The first four weeks set the project's direction. Staffing keeps early work moving, and consistent client reporting builds trust. Both project days and reporting duties need consideration.",
      sensitive: "The project-day request follows the Leader's mistaken staffing estimate in the submitted plan. The plan depends on the Member working four days a week; requesting more staff would reveal the error to the director. The team has not been told.",
    },
    member: {
      work: "Two of the Member's current projects have overlapping deadlines this month. New-project days would delay existing work, and each weekly report takes separate preparation time. Both arrangements need to fit around the existing workload.",
      sensitive: "The request to adjust reporting duties relates to feedback on last month's report. The client contact directly told the Member that the report was lacking and that they would prefer the Leader to prepare future reports. The Member has not passed this feedback on to the Leader.",
    },
  },
};

/**
 * Renders the policy-controlled proxy reason from fixed source text.
 *
 * Both policies connect the supplied facts to the request using the same
 * fixed wording. Only AI-Supplemented adds an argument pair, selected by the
 * designated reason layer rather than runtime inference.
 */
export function renderProxyReason(
  task: NegotiationTask,
  role: Role,
  card: ReasonCard,
  policy: ProxyPolicy,
): ProxyReasonPresentation {
  if (task.id === "practice") {
    throw new Error("Proxy reason presentations are not defined for practice");
  }
  if (
    !task.roleBriefs[role].reasonCards.some(
      (candidate) =>
        candidate.id === card.id &&
        candidate.layer === card.layer &&
        candidate.issueId === card.issueId,
    )
  ) {
    throw new Error(`Unknown proxy reason card for ${task.id}/${role}: ${card.id}`);
  }
  const base = PROXY_REASON_BASES[task.id][role][card.layer];

  if (policy === "user_specified") {
    return { base, addition: null, text: base };
  }

  const approved = PROXY_WORK_BENEFITS[task.id][role];
  const benefits: readonly [string, string] = [
    approved.wr1,
    card.layer === "sensitive" ? approved.sb1 : approved.wr2,
  ];
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
