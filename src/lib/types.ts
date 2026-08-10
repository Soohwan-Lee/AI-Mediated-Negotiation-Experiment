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

/** Session-level condition. Every participant sees `direct` + one proxy. */
export type Condition = "direct" | "delegate" | "explorer";

/** Which of the two structurally matched scenarios. */
export type TaskId = "task_a" | "task_b";

/** Counterbalancing: which session comes first. */
export type SessionOrder = "direct_first" | "proxy_first";

/**
 * The four counterbalanced sequences from Methods §Experimental Design.
 * seq1: Direct-TaskA -> Proxy-TaskB
 * seq2: Proxy-TaskA  -> Direct-TaskB
 * seq3: Direct-TaskB -> Proxy-TaskA
 * seq4: Proxy-TaskB  -> Direct-TaskA
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

export interface Issue {
  id: string;
  label: string;
  description: string;
  options: IssueOption[];
  /** Marks the socially costly requirement for a given role. */
  criticalFor?: Role;
}

export interface NegotiationTask {
  id: TaskId;
  title: string;
  /** Shared context both sides can see. */
  publicBrief: string;
  /** Role-specific confidential briefing. */
  roleBriefs: Record<Role, RoleBrief>;
  issues: Issue[];
}

export interface RoleBrief {
  title: string;
  organizationalPosition: string;
  objectives: string[];
  criticalRequirement: string;
  batnaSummary: string;
}

// ---------------------------------------------------------------------------
// Mandate (proxy conditions only)
// ---------------------------------------------------------------------------

export type MandatePriority = "low" | "medium" | "high" | "must_preserve";

export type RationalePolicy =
  | "may_disclose"
  | "work_reframing_only"
  | "no_rationale"
  | "do_not_use";

export interface IssueMandate {
  issueId: string;
  entrusted: boolean;
  priority: MandatePriority;
  idealOptionId: string | null;
  /** Worst option the proxy may concede to. */
  reservationOptionId: string | null;
  rationalePolicy: RationalePolicy;
  notes: string;
}

export interface Mandate {
  sessionIndex: 1 | 2;
  issues: IssueMandate[];
  allowedActions: {
    askClarifyingQuestions: boolean;
    proposePackages: boolean;
    makeConditionalTrades: boolean;
    concedeWithinRange: boolean;
    leaveUnresolvedForReview: boolean;
  };
  revisionCount: number;
}

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

// ---------------------------------------------------------------------------
// Survey
// ---------------------------------------------------------------------------

/** Keyed by item id (e.g. "FNE1", "SAFE2_R"). */
export type SurveyResponses = Record<string, string | number | string[] | null>;

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
