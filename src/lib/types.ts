/**
 * Core domain types for the AI-Mediated Negotiation experiment.
 *
 * These mirror the intended Supabase schema (see docs/DATA_MODEL.md).
 * Nothing here talks to a database — persistence is behind `lib/store`.
 *
 * WHAT CHANGED IN ver.2.4 (Experimental Design Ver.2.4). The design became
 * role-symmetric: a Leader and a Member now each hold their own socially
 * costly requirement, on their own priority issue, backed by their own six
 * reason cards. Everything that used to be Member-only — the requirement, the
 * private circumstance, the trajectory — is now indexed by role. The yoked
 * receiver stimulus is gone with it (§13): when both sides are senders, there
 * is no receiver-only arm left to hold constant.
 */

// ---------------------------------------------------------------------------
// Assignment factors
// ---------------------------------------------------------------------------

/** Between-participant: which proxy policy the participant experiences. */
export type ProxyPolicy = "delegate" | "explorer";

/** Between-participant: organizational power position. */
export type Role = "leader" | "member";

/** Session-level condition. Every participant sees `baseline` + one proxy. */
export type Condition = "baseline" | "delegate" | "explorer";

/** Which of the two structurally matched scenarios a session runs. */
export type TaskId = "task_a" | "task_b";

/**
 * What a `NegotiationTask` may identify itself as.
 *
 * The practice round has the same shape as a real task but is not one, and
 * saying so in the type keeps it out of `TaskId` — so it can never be
 * assigned to a session, and a practice row can never be mistaken for Task A
 * in the export.
 */
export type ScenarioId = TaskId | "practice";

/** Counterbalancing: which session comes first. */
export type SessionOrder = "baseline_first" | "proxy_first";

/**
 * The four counterbalanced sequences (Design §2 "block-randomized
 * counterbalance").
 * seq1: Baseline-TaskA -> Proxy-TaskB
 * seq2: Proxy-TaskA  -> Baseline-TaskB
 * seq3: Baseline-TaskB -> Proxy-TaskA
 * seq4: Proxy-TaskB  -> Baseline-TaskA
 */
export type SequenceId = "seq1" | "seq2" | "seq3" | "seq4";

/**
 * A fully resolved assignment for one participant.
 *
 * IMPORTANT: participants never see these values as labels. The UI must never
 * render "you are in the Explorer condition" — tasks are shown as "Task 1 /
 * Task 2" and the interface differs only structurally.
 */
export interface Assignment {
  participantKey: string;
  proxyPolicy: ProxyPolicy;
  role: Role;
  sequenceId: SequenceId;
  sessionOrder: SessionOrder;
  /** Ordered plan for the two negotiation tasks. */
  sessions: [SessionPlan, SessionPlan];
  assignedAt: string;
}

export interface SessionPlan {
  /** 1-based index in the participant's flow. */
  index: 1 | 2;
  condition: Condition;
  taskId: TaskId;
}

// ---------------------------------------------------------------------------
// Prolific / participant identity
// ---------------------------------------------------------------------------

export interface ProlificContext {
  prolificPid: string | null;
  studyId: string | null;
  sessionId: string | null;
}

// ---------------------------------------------------------------------------
// Negotiation domain
// ---------------------------------------------------------------------------

export interface IssueOption {
  id: string;
  label: string;
  /** Role-specific private points. Never shown to the counterpart. */
  points: Record<Role, number>;
}

/**
 * What an issue is for, structurally (Design Ver.2.11 §3.2).
 *
 *  - `leader_priority`  The Leader's requirement lives here. Worth a lot to
 *                       the Leader, cheap to the Member.
 *  - `member_priority`  The Member's requirement lives here. The mirror image.
 *
 * TWO INTEGRATIVE ISSUES, ONE PER ROLE, AND NOTHING ELSE. That is the minimum
 * for a role-symmetric design — with only one, a single role would hold the
 * only requirement and the symmetry collapses — and Ver.2.11 fixes it as the
 * maximum too.
 *
 * The `distributive` timing issue is gone. It existed as a second currency for
 * the logroll, but on a constant-sum term every point conceded is exactly one
 * point gained, so it was pure transfer and always the worst rate available;
 * `buildProxyPlan` already refused to spend it except as a last resort. What it
 * added in practice was a third term to read and a third set of levels to
 * choose, on a task whose measured behaviour is which REASONS get said. Ver.2.11
 * drops it, so the only way to close a gap is the logroll itself.
 *
 * A `compatible` type is deliberately absent — both sides preferring the same
 * option needs no conversation, so it carries no information.
 */
export type IssueType = "leader_priority" | "member_priority";

export interface Issue {
  id: string;
  label: string;
  /** One sentence, in the participant's own words (Design §5 exposure column). */
  description: string;
  type: IssueType;
  options: IssueOption[];
  /**
   * Index past which the requirement on this issue counts as not preserved.
   * Options are ordered best-first for whichever role the issue favours, so
   * index 1 means "Options 1-2 hold the requirement".
   *
   * Present on both integrative issues — each role has a requirement now.
   */
  requirementThresholdIndex?: number;
  /**
   * One line of "why this is scored the way it is", per role. Design §5
   * requires this to sit NEXT TO the score at all times, so nobody optimizes
   * a number without reading the situation behind it.
   */
  rationale: Record<Role, string>;
}

/**
 * One checkbox on the mandate screen (Design §5 이유 카드, §7 UI 규칙).
 *
 * The two layers are the measure. `work` cards justify the position from
 * shared work standards and cost nothing beyond the ask itself; `sensitive`
 * cards justify it from the speaker's own undisclosed circumstances, and how
 * many of them the participant is willing to hand over is `REASON-SCOPE`.
 * (Design §5 ver.2.5 splits the social cost formally: claiming cost is
 * constant across card types; disclosure cost is what a sensitive card adds.)
 *
 * Ver.2.11 holds each role to TWO cards per task — one work reason and one
 * sensitive background, both on that role's own requirement issue. The other
 * term is the thing you SPEND, not the thing you argue for, so it carries no
 * card of your own. `issueId` stays load-bearing even though every card now
 * satisfies the scope check: the reason-linked acceptance rule reads the
 * card's issue rather than assuming it, so a card added later on the other
 * term cannot silently earn the requirement concession.
 */
export interface ReasonCard {
  id: string;
  /** The issue this card argues about. Every card belongs to exactly one. */
  issueId: string;
  layer: "work" | "sensitive";
  /** Shown on the card, verbatim from Design §5. */
  text: string;
  /**
   * Which facet of the role's backstory a sensitive card carries.
   *
   * Ver.2.11 gives each role ONE sensitive card per task, and the two tasks
   * show the SAME backstory at a different moment — the manager's staffing
   * exposure, the senior's second job — so a participant meeting their second
   * task is not handed a new secret. The facet is analysis metadata.
   */
  facet?:
    | "staffing_warning"
    | "overpromise"
    | "second_job";
}

export interface NegotiationTask {
  id: ScenarioId;
  title: string;
  /** Shared context both sides can see (Design §6 공통 안내). */
  publicBrief: string;
  /** Role-specific confidential briefing. */
  roleBriefs: Record<Role, RoleBrief>;
  issues: Issue[];
  /**
   * Which issue carries each role's requirement. Both roles have one now, so
   * this is a map rather than a single `focalIssueId`.
   */
  requirementIssueId: Record<Role, string>;
  /**
   * The standardized challenge each side sends at Stage 3 (Design §4 단계 3:
   * "양측이 상대의 핵심 요구를 한 번씩 낮춰 달라고 요청함 (고정 문구)").
   *
   * Keyed by the role being challenged, because the challenge names that
   * role's requirement. Fixed wording — this is the manipulation, so it may
   * not vary by participant.
   */
  standardizedChallenge: Record<Role, string>;
  /** Fallback points if no agreement is reached. Same for both roles. */
  reservationPoints: number;
}

export interface RoleBrief {
  title: string;
  /** Where you sit and what you can do. */
  organizationalPosition: string;
  /**
   * The role story (Design §6 안내문). Several sentences of concrete
   * situation, because a scorecard alone does not make anyone reluctant to
   * speak. The sensitive cards must already be present in this narrative or
   * they arrive out of nowhere on the mandate screen.
   */
  roleStory: string;
  /** Plain-language statement of what this side is trying to get. */
  objectives: string[];
  /**
   * Six cards: one work reason + one sensitive background per issue
   * (Design §5 ver.2.5). The three sensitive cards are three facets of the
   * role's single backstory. Both roles have these.
   */
  reasonCards: ReasonCard[];
  /** "At least 3 review checkpoints (Options 1-2)." */
  requirementNote: string;
  /** Why saying the sensitive reason out loud would cost something. */
  disclosureRisk: string;
  /** What happens if nothing is agreed. */
  batnaSummary: string;
}

// ---------------------------------------------------------------------------
// Mandate (proxy conditions only)
// ---------------------------------------------------------------------------

/**
 * One issue's instruction to the Proxy (Design §8 Proxy task 흐름 step 2).
 *
 * Two fields per issue — what you want, and the least you will take. Design
 * §5 principle 4 is explicit that all three issues are entered the same way,
 * so the UI may not single out the requirement issue with an extra control.
 */
export interface IssueMandate {
  issueId: string;
  /** Where to open. */
  preferredOptionId: string | null;
  /** The least the proxy may settle for. Doubles as the hard boundary. */
  minimumOptionId: string | null;
}

export interface Mandate {
  sessionIndex: 1 | 2;
  issues: IssueMandate[];
  /**
   * Ids of the reason cards the AI Proxy is allowed to say. Unchecked cards
   * may inform the proxy's package choice but must never appear in its text
   * (Design §7).
   */
  authorizedReasonIds: string[];
  /**
   * How many times the participant went back and edited this mandate BEFORE
   * the proxies ran.
   *
   * Not the deleted post-hoc revision. That one let a Proxy participant re-run
   * a negotiation that had already finished — a bite Baseline never had, which
   * is why it is gone (CLAUDE.md, "There is no 'ask for one change'"). This
   * counts edits made while nothing has been said to anyone: from the
   * rehearsal screen ("Change my instructions") and from the confirm screen
   * ("Change something"). Both are the ordinary act of writing a mandate, and
   * Baseline's equivalent is that a Baseline participant can change their mind
   * freely before they type.
   *
   * It is behavioural data rather than bookkeeping: whether someone
   * interrogates a delegate and then revises what they entrusted is the same
   * delegation decision REASON-SCOPE measures, seen from another side. Each
   * increment also lands in `events` as `mandate_revised`, and
   * `rehearsal_messages.revision_count` stamps which revision a given question
   * was asked under.
   */
  revisionCount: number;
}

/**
 * The delegation-breadth measure derived from a mandate (Design §9.3.1
 * `REASON-SCOPE`, redefined in ver.2.5 as per-issue delegation width).
 *
 * Reported as its parts, never as one number: "checked four cards" means
 * something entirely different depending on whether any of them were
 * sensitive, and on WHICH issues the sensitive ones sat. Pre-2.5 exports
 * carried a `deepestPhase` field instead of `coreIssueSensitive`/`byIssue`;
 * the two shapes are not comparable and must not be pooled in analysis.
 */
export interface ReasonScope {
  totalChecked: number;
  workChecked: number;
  /** How many sensitive cards were handed over, 0-3, across the three issues. */
  sensitiveChecked: number;
  /** Was the sensitive card on this role's OWN requirement issue included? */
  coreIssueSensitive: boolean;
  /** The per-issue selection pattern, keyed by issue id. */
  byIssue: Record<string, { work: boolean; sensitive: boolean }>;
}

// ---------------------------------------------------------------------------
// Five-stage fixed progression (Design §4)
// ---------------------------------------------------------------------------

/**
 * The five stages, in order. Both Baseline and Proxy run exactly these, which
 * is what makes the transcripts comparable across conditions.
 *
 *  1 opening    — a full three-issue package from each side.
 *  2 exchange   — one priority question and one authorized reason each.
 *  3 challenge  — each side asks the other to lower its requirement. No new
 *                 offer this turn.
 *  4 trade      — a counterpackage holding the requirement and paying for it
 *                 elsewhere.
 *  5 tentative  — the package that goes to human review.
 */
export type StageId = 1 | 2 | 3 | 4 | 5;

/** A complete selection across all three issues. */
export type Package = Record<string, string>;

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

export type Speaker =
  | "participant"
  | "counterpart"
  | "participant_proxy"
  | "counterpart_proxy"
  /** The counterpart principal, who speaks once on the review screen (Design §4). */
  | "counterpart_principal"
  | "system";

export interface TranscriptMessage {
  id: string;
  sessionIndex: 1 | 2;
  speaker: Speaker;
  text: string;
  createdAt: string;
  /** Which of the five stages this message belongs to. */
  stage?: StageId;
  /** The package proposed with this message, if any. */
  proposal?: Package;
  /**
   * Which reason card this message voiced, if any. Design §4 makes reason
   * delivery mechanically consequential — the counterpart will not concede on
   * a requirement no reason was ever given for — so this is read by the state
   * machine, not just logged.
   */
  reasonCardId?: string;
  /**
   * Internal provenance for the Explorer condition — stored for audit but
   * NEVER rendered to the participant (Design §7 "이유 출처 표시").
   */
  internalProvenance?: "principal_reason" | "pool_reason";
  /**
   * The move the state machine chose for this turn, stored beside the rendered
   * sentence. Design §4 requires the pair so an audit can show the model never
   * stepped outside the rules (pilot gate 9).
   */
  decidedAction?: string;
}

/**
 * One turn of the rehearsal — the participant questioning their own AI Proxy
 * about its mandate, before it negotiates anything.
 *
 * Kept apart from `TranscriptMessage` on purpose. A rehearsal turn is not part
 * of any negotiation: it has no stage, carries no package, and nothing in it
 * reaches the counterpart. Storing it in the same table as negotiation messages
 * would put turns that were never part of an exchange into the transcript the
 * analysis reads, and the message count per stage is a reported measure.
 *
 * It is still worth recording: which participants interrogated their proxy,
 * what they asked, and whether they revised the mandate afterwards is
 * delegation behaviour of exactly the kind REASON-SCOPE is trying to capture.
 */
export interface RehearsalMessage {
  id: string;
  sessionIndex: 1 | 2;
  /** "participant" asks; "proxy" is their own AI Proxy answering. */
  speaker: "participant" | "proxy";
  text: string;
  createdAt: string;
  /**
   * True when the guardrail replaced the model's wording because it reproduced
   * a reason card the participant had not authorized. Recorded rather than
   * silently swapped, because the rate is a pilot audit number.
   */
  blocked?: boolean;
  /** How many times the mandate had been edited when this turn was taken. */
  revisionCount?: number;
}

// ---------------------------------------------------------------------------
// Agreement
// ---------------------------------------------------------------------------

export interface AgreementTerm {
  issueId: string;
  optionId: string | null;
  unresolved: boolean;
}

export interface CandidateAgreement {
  sessionIndex: 1 | 2;
  terms: AgreementTerm[];
  unresolvedIssueIds: string[];
}

/**
 * The requirement's level at each point in the trajectory (Design §9.3.1).
 *
 * Reported as transitions, never summed into a scale — an additive score
 * would hide that O1->O2 keeps the requirement and O2->O3 breaks it.
 */
export interface RequirementTrajectory {
  sessionIndex: 1 | 2;
  /** From the pre-negotiation preference screen. */
  preferredOptionId: string | null;
  /** The floor entered on the same screen. */
  minimumOptionId: string | null;
  openingOptionId: string | null;
  afterChallengeOptionId: string | null;
  finalOptionId: string | null;
  /** Whether a reason was ever voiced for this requirement, and which. */
  reasonsVoicedCardIds: string[];
}

// ---------------------------------------------------------------------------
// Survey
// ---------------------------------------------------------------------------

/**
 * A single stored answer. Most items are a scale point or a choice, but some
 * blocks (initial preference, mandate summaries) store an issue-keyed map.
 */
export type ResponseValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | Record<string, string | number | null>;

/** Keyed by item id (e.g. "PERC1", "OWN-AI5"). */
export type SurveyResponses = Record<string, ResponseValue>;

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------

export type EventType =
  | "page_enter"
  | "page_complete"
  | "consent_given"
  | "assignment_created"
  | "comprehension_answer"
  | "initial_preference_saved"
  | "mandate_saved"
  | "mandate_revised"
  /**
   * The participant finished questioning their own AI Proxy about the mandate
   * before it ran. The turn count is delegation behaviour worth having beside
   * REASON-SCOPE: whether someone interrogates a delegate before trusting it
   * with an argument is the same decision measured a different way.
   */
  | "rehearsal_finished"
  | "message_sent"
  | "negotiation_started"
  | "negotiation_ended"
  | "task_outcome_recorded"
  | "survey_saved"
  | "reward_decision"
  | "debriefing_acknowledged"
  | "study_completed";

export interface ExperimentEvent {
  type: EventType;
  participantKey: string;
  page?: string;
  sessionIndex?: 1 | 2;
  payload?: Record<string, unknown>;
  clientTimestamp: string;
}
