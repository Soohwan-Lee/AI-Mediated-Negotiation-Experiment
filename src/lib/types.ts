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
 * What an issue is for, structurally (Design §5 "Issue 구성 rationale").
 * The task is `2 integrative + 1 distributive`:
 *
 *  - `leader_priority`  The Leader's requirement lives here. Worth a lot to
 *                       the Leader, cheap to the Member.
 *  - `member_priority`  The Member's requirement lives here. The mirror image.
 *  - `distributive`     Timing. Constant-sum, so there is push and pull and a
 *                       second currency for the logroll.
 *
 * Two integrative issues, one per role, is the MINIMUM for a role-symmetric
 * design: with only one, a single role would hold the only requirement and the
 * symmetry collapses. Two distributive issues would turn the task into
 * haggling, which is not what this study measures. A `compatible` type is
 * deliberately absent — both sides preferring the same option needs no
 * conversation, so it carries no information.
 */
export type IssueType =
  | "leader_priority"
  | "member_priority"
  | "distributive";

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
 * The two layers are the measure. `work` cards cost nothing to say; `sensitive`
 * cards are the participant's own reputational exposure, and how many of them
 * they are willing to hand over is `REASON-SCOPE`.
 *
 * ver.2.4 replaced the old two-level Sayable/Private permission with plain
 * multi-select checkboxes: a checked card may be spoken, an unchecked card may
 * not. That is one decision per card instead of two, and the count is directly
 * interpretable as delegation breadth.
 */
export interface ReasonCard {
  id: string;
  layer: "work" | "sensitive";
  /** Shown on the card, verbatim from Design §5. */
  text: string;
  /**
   * Which phase of the one situation this card carries — `incident`,
   * `undisclosed`, `worry`. Sensitive cards only.
   *
   * The three sensitive cards are deliberately three faces of ONE event, not
   * three separate secrets: that is what makes them memorable, and it lets
   * `REASON-SCOPE` record how deep a participant was willing to go rather than
   * just how many boxes they ticked.
   */
  phase?: "incident" | "undisclosed" | "worry";
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
  /** Fallback points if no agreement is ratified. Same for both roles. */
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
   * Six cards: 3 work reasons + 3 phases of the one sensitive situation.
   * Both roles have these now.
   */
  reasonCards: ReasonCard[];
  /** "At least 3 review checkpoints (Options 1-2)." */
  requirementNote: string;
  /** Why saying the sensitive reason out loud would cost something. */
  disclosureRisk: string;
  /** What happens if nothing is ratified. */
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
  revisionCount: number;
}

/**
 * The delegation-breadth measure derived from a mandate (Design §9.3.1
 * `REASON-SCOPE`).
 *
 * Reported as its parts, never as one number: "checked four cards" means
 * something entirely different depending on whether any of them were
 * sensitive, and how far into the situation they went.
 */
export interface ReasonScope {
  totalChecked: number;
  workChecked: number;
  sensitiveChecked: number;
  /** How deep into the situation they went, or null if no sensitive card. */
  deepestPhase: "incident" | "undisclosed" | "worry" | null;
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
  /** The counterpart principal, who speaks only at ratification (Design §4). */
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

// ---------------------------------------------------------------------------
// Agreement + ratification
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

export type RatificationChoice = "ratify" | "request_revision" | "reject";

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
  | "message_sent"
  | "negotiation_started"
  | "negotiation_ended"
  | "ratification_choice"
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
