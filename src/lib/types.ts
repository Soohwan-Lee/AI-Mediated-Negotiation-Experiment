/**
 * Core domain types for the AI-Mediated Negotiation experiment.
 *
 * These mirror the intended Supabase schema (see docs/DATA_MODEL.md).
 * Nothing here talks to a database — persistence is behind `lib/store`.
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
 * The four counterbalanced sequences from Methods §Experimental Design.
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
 * render "you are in the Explorer condition" — sessions are shown as
 * "Session 1 / Session 2" and the interface differs only structurally.
 */
export interface Assignment {
  participantKey: string;
  proxyPolicy: ProxyPolicy;
  role: Role;
  sequenceId: SequenceId;
  sessionOrder: SessionOrder;
  /** Ordered plan for the two main sessions. */
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
 * What an issue is for, structurally (Methods ver.1.8 §Common payoff
 * architecture). The task is `2 integrative + 1 distributive`:
 *
 *  - `leader_integrative`  scope. Worth a lot to the Leader, cheap to the Member.
 *  - `member_focal`        the socially costly requirement. Worth a lot to the
 *                          Member, cheap to the Leader. This is the issue the
 *                          whole study is about.
 *  - `distributive`        timing. Constant-sum, so there is push and pull and
 *                          a second currency for the logroll.
 *
 * A `compatible` type is deliberately absent: discovering hidden shared value
 * is not this study's mechanism, and the issue budget is spent on the focal
 * problem instead.
 */
export type IssueType =
  | "leader_integrative"
  | "member_focal"
  | "distributive";

export interface Issue {
  id: string;
  label: string;
  description: string;
  type: IssueType;
  options: IssueOption[];
  /**
   * Options 1..n are ordered so that index 0 is best for whichever role the
   * issue favours. For `member_focal`, the adequacy threshold is the index
   * past which the requirement counts as not preserved.
   *
   * Present only on the focal issue.
   */
  focalThresholdIndex?: number;
  /** One-line "why this matters to you", per role (Appendix A3/A4/A6/A7). */
  rationale: Record<Role, string>;
}

/**
 * The two layers of the focal requirement's reason (Methods ver.1.8 §Private
 * rationale). The separation is the point: it lets a Member entrust a usable
 * reason without disclosing the private circumstance behind it, and which
 * layer they mark sayable is itself the disclosure measure.
 */
export interface ReasonCard {
  id: string;
  layer: "work" | "private";
  /** Shown on the card. */
  text: string;
  /** Default permission — work reasons open, private reasons closed. */
  defaultPermission: ReasonPermission;
}

/**
 * Two levels only (Appendix A8). A third level ("say it but reframe it") was
 * cut in ver.1.8: it asked participants to reason about paraphrase policy,
 * which is the system's job, not theirs.
 */
export type ReasonPermission = "sayable" | "private";

export interface NegotiationTask {
  id: ScenarioId;
  title: string;
  /** Shared context both sides can see (Appendix A2/A5). */
  publicBrief: string;
  /** Role-specific confidential briefing. */
  roleBriefs: Record<Role, RoleBrief>;
  issues: Issue[];
  /** The issue id of the Member-priority focal requirement. */
  focalIssueId: string;
  /**
   * The standardized focal challenge the challenging side sends at Stage 3
   * (Appendix B3). Fixed wording — this is the manipulation, so it may not
   * vary by participant.
   */
  standardizedChallenge: string;
  /** Fallback points if no agreement is ratified. Same for both roles. */
  reservationPoints: number;
}

export interface RoleBrief {
  title: string;
  /** Where you sit and what you can do (Appendix A1 + role story opener). */
  organizationalPosition: string;
  /**
   * The role story (Appendix A3/A4/A6/A7). Several sentences of concrete
   * situation, because a scorecard alone does not make anyone reluctant to
   * speak. Rendered as prose, not bullets.
   */
  roleStory: string;
  /** Plain-language statement of what this side is trying to get. */
  objectives: string[];
  /**
   * The two-layer reason, on the role that holds the focal requirement.
   * Absent for the role the focal issue is cheap for.
   */
  focalReasons?: ReasonCard[];
  /** "At least 2 remote days per week (Options 1-2)." Focal-holder only. */
  focalThresholdNote?: string;
  /** What happens if nothing is ratified. */
  batnaSummary: string;
}

// ---------------------------------------------------------------------------
// Mandate (proxy conditions only)
// ---------------------------------------------------------------------------

/**
 * One issue's instruction to the Proxy (Methods ver.1.8 §E8 mandate table).
 *
 * Three fields per issue — preferred, acceptable floor, hard boundary — which
 * is the whole mandate for that issue. Whether the participant put the focal
 * threshold in `hardBoundary` is the MANDATE behavioural code.
 */
export interface IssueMandate {
  issueId: string;
  /** Where to open. */
  preferredOptionId: string | null;
  /** Worst option the proxy may concede to without asking. */
  acceptableFloorOptionId: string | null;
  /** A line the proxy may not cross at all. Null means no hard boundary. */
  hardBoundaryOptionId: string | null;
}

export interface Mandate {
  sessionIndex: 1 | 2;
  issues: IssueMandate[];
  /** Permission per reason card, keyed by `ReasonCard.id`. */
  reasonPermissions: Record<string, ReasonPermission>;
  /** May the proxy offer "if you hold X, I can move on Y" packages? */
  allowConditionalTrade: boolean;
  revisionCount: number;
}

// ---------------------------------------------------------------------------
// Five-stage controlled interaction (Methods ver.1.8 §Five-stage controlled
// interaction, Appendix E)
// ---------------------------------------------------------------------------

/**
 * The five stages, in order. Both Baseline and Proxy run exactly these, which
 * is what makes the transcripts comparable across conditions.
 *
 *  1 opening    — a full three-issue package from each side.
 *  2 exchange   — one priority question and one authorized rationale each.
 *  3 challenge  — the standardized focal challenge. No new offer this turn.
 *  4 trade      — a counterpackage that may tie the focal to scope or timing.
 *  5 tentative  — the package that goes to human review.
 */
export type StageId = 1 | 2 | 3 | 4 | 5;

/** A complete selection across all three issues. */
export type Package = Record<string, string>;

/**
 * Which of the prevalidated argument frames a visible rationale used
 * (Appendix B4). Logged for the source-grounding audit; `common_practice` is
 * Explorer-only.
 */
export type RationaleFrame =
  | "risk_reduction"
  | "shared_value"
  | "feasibility"
  | "conditional_exchange"
  | "common_practice";

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

export type Speaker =
  | "participant"
  | "counterpart"
  | "participant_proxy"
  | "counterpart_proxy"
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
  /** Which prevalidated frame the visible rationale used, if any. */
  frame?: RationaleFrame;
  /**
   * Internal provenance for the Explorer condition — stored for audit but
   * NEVER rendered to the participant (Methods §Explorer Proxy condition).
   */
  internalProvenance?: "principal_mandate" | "agent_option";
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
 * The Leader's structured response to the focal requirement, coded as
 * Requirement Uptake (Methods ver.1.8 §Primary outcome 3).
 *
 *  accommodate  2 — threshold accepted as it stands
 *  trade        1 — threshold kept, but conditional on a concession elsewhere
 *  reduce       0 — asked to go below the threshold, or refused
 */
export type FocalResponse = "accommodate" | "trade" | "reduce";

/**
 * The focal requirement's level at each point in the trajectory (Methods
 * ver.1.8 §Primary outcome 1). Reported as transitions, never summed into a
 * scale — an additive score would hide that O1->O2 keeps the threshold and
 * O2->O3 breaks it.
 */
export interface FocalTrajectory {
  sessionIndex: 1 | 2;
  /** Recorded before the session's condition is revealed. */
  privateTargetOptionId: string | null;
  /** Proxy only: the mandate's floor on the focal issue. */
  mandateOptionId: string | null;
  openingOptionId: string | null;
  afterChallengeOptionId: string | null;
  finalOptionId: string | null;
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

/** Keyed by item id (e.g. "FNE1", "SAFE2_R"). */
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
