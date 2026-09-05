/**
 * Core domain types for the AI-Mediated Negotiation experiment.
 *
 * These mirror the intended Supabase schema (see docs/DATA_MODEL.md).
 * Nothing here talks to a database — persistence is behind `lib/store`.
 *
 * The design is role-symmetric: Leader and Member each hold their own socially
 * costly requirement on their own priority issue, each mandates a proxy, each
 * receives the other's case, and each makes a post-negotiation decision about
 * the other. Everything that was once Member-only is indexed by role.
 */

// ---------------------------------------------------------------------------
// Assignment factors
// ---------------------------------------------------------------------------

/**
 * Between-participant: which proxy policy the participant experiences.
 *
 * Ver.2.18 renamed these. `user_specified` (was User-Specified) relays the checked
 * cards with every fact intact; `ai_supplemented` (was AI-Supplemented) abstracts the
 * sensitive card to its KIND and embeds it, unlabelled, among two cover
 * reasons (§6.6). The rename is not cosmetic — Ver.2.20's ai_supplemented no
 * longer ADDS to the card, it REPLACES it, so the old name described the
 * wrong operation.
 */
export type ProxyPolicy = "user_specified" | "ai_supplemented";

/** Between-participant: organizational power position. */
export type Role = "leader" | "member";

/**
 * Session-level condition. Every participant sees `direct` + one proxy policy.
 *
 * `direct` was called `baseline` through Ver.2.17. The design renamed it
 * because "baseline" implies an absence of treatment, and direct negotiation
 * is a condition in its own right: it is where the participant carries the
 * disclosure cost personally, which is the comparison the study is built on.
 */
export type Condition = "direct" | "user_specified" | "ai_supplemented";

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
export type SessionOrder = "direct_first" | "proxy_first";

/**
 * The four counterbalanced sequences (Design §2 "block-randomized
 * counterbalance").
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
 * render "you are in the AI-Supplemented condition" — tasks are shown as "Task 1 /
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
 * What an issue is for, structurally (Design Ver.2.12 §3.2).
 *
 *  - `leader_priority`  The Leader's requirement lives here. Worth a lot to
 *                       the Leader, cheap to the Member.
 *  - `member_priority`  The Member's requirement lives here. The mirror image.
 *
 * TWO INTEGRATIVE ISSUES, ONE PER ROLE, AND NOTHING ELSE. Two is the minimum
 * for a role-symmetric design — with one, a single role would hold the only
 * requirement — and Ver.2.12 fixes it as the maximum too, so the only way to
 * close a gap is the logroll itself.
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
 * Each role holds TWO cards per task — one work reason and one sensitive
 * background, both on that role's own priority issue. The other term is the
 * thing you SPEND, not the thing you argue for, so it carries no card of your
 * own.
 *
 * A CARD CARRIES A REASON AND NEVER A PACKAGE (Ver.2.12 §4). Which conditions
 * to trade is an act taken IN the negotiation; the card only says why the
 * issue is absolute. The credibility ladder (§3.3) reads the voiced card's
 * layer — nothing / work / sensitive — to set how far the counterpart will
 * concede on the speaker's core issue, and `issueId` keeps that judgement
 * scoped: a card on the other term cannot earn the core concession.
 */
export interface ReasonCard {
  id: string;
  /** The issue this card argues about. Every card belongs to exactly one. */
  issueId: string;
  layer: "work" | "sensitive";
  /** Shown on the card, verbatim from Design §5. */
  text: string;
  /**
   * Which confession a sensitive card carries (analysis metadata).
   *
   * Ver.2.18 REPLACED ALL FOUR, and the reason is a finding rather than a
   * preference. The Ver.2.17 set went to two outside models on the same
   * question and only one card survived: freezing in front of a client and a "last
   * chance" warning read to a US workplace as incompetence and as grounds for
   * pity, and the counterpart's natural reply to both is to OFFER TO FIX IT
   * ("let's practise", "I'll sit in"). A weakness someone can dissolve for you
   * is not a costly signal, and it cannot be the cause of a priority.
   *
   * The surviving type is ONE: a thing already done. Leader = a judgement
   * already committed upward (a promise made alone; a headcount understated).
   * Member = an adverse judgement a CLIENT has already made and the
   * participant covered up (the client asking for someone else; a missed call
   * and a complaint). Nobody can undo either, and learning of it also reveals
   * the second admission — that it was kept quiet. The cost lands on judgement
   * and trust ("without asking me?" / "why am I only hearing this now?"),
   * which is why §5's evaluation guideline is "would you want to work with
   * this person again" rather than a competence axis.
   */
  facet?:
    | "promised_alone"
    | "understated_headcount"
    | "client_asked_for_someone_else"
    | "missed_call_complaint";
  /**
   * What an AI-Supplemented proxy says INSTEAD of this card (§6.6, sensitive
   * cards only). Fixed text, never generated: the model's only job is to join
   * the three sentences into one natural message.
   *
   * `abstract` keeps the KIND of fact and the attribution to the principal
   * ("something the client passed directly to the team member I represent")
   * and drops the event, the third party's words, and the fact it was hidden.
   * It is still tier 3 — a circumstance specific to that person is what the
   * counterpart needs in order to justify moving upward — while what the
   * counterpart LEARNS stops at "something happened".
   *
   * `cover` are two role-plausible reasons of the §6.6 stage-3 kind, carrying
   * the same attribution form so sentence shape alone cannot sort them. They
   * never move the tier: they are role generalities, not this person's
   * circumstance, and letting one open the SB rung would hand the maximum to
   * an AI-Supplemented participant who authorized nothing.
   */
  abstract?: string;
  cover?: readonly [string, string];
  /**
   * The card as a PROXY reports it — third person, the principal referred to
   * rather than speaking (Ver.2.19 §6.5).
   *
   * `text` is written to be said BY THE PARTICIPANT, which is what the Direct
   * arm needs. A proxy that renders it verbatim ends up claiming the
   * principal's situation as its own ("I never repeated that to you"), and on
   * screen that is indistinguishable from the participant speaking — which
   * defeats the third-person rule, whose whole job is to keep the delegation
   * visible.
   *
   * Written out rather than derived. A pronoun-substitution pass was tried and
   * produces broken sentences on exactly the clauses that carry the
   * confession ("they'd rather the other side delivered these yourself"),
   * because the cards address the counterpart as "you" in the middle of
   * reporting a third party's words. Both persons of a load-bearing sentence
   * are worth writing once.
   *
   * Used by the MOCKUP only. The live proxies get the rule in P3/P4 and
   * re-voice the card themselves, which reads better than any fixed wording.
   */
  relayed?: string;
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
 * One issue's instruction to the Proxy (Ver.2.13 §8.6, §8.7).
 *
 * ONE FIELD PER ISSUE — where to open. The "least you will take" is gone:
 * §2.6 dropped the range mandate because it could not change the outcome
 * (the counterpart's policy is decisive) and could only manufacture an
 * impasse while mixing mandate-setting skill into a result meant to turn on
 * disclosure. The participant's control is the reason checkboxes before and
 * RATIFY after.
 *
 * Both issues are still entered the same way, with no extra control on either
 * (§5 principle 1) — a per-issue difference would name the requirement issue.
 */
export interface IssueMandate {
  issueId: string;
  /** Where to open. */
  preferredOptionId: string | null;
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
   * a negotiation that had already finished — a bite Direct never had, which
   * is why it is gone (CLAUDE.md, "There is no 'ask for one change'"). This
   * counts edits made while nothing has been said to anyone: from the
   * rehearsal screen ("Change my instructions") and from the confirm screen
   * ("Change something"). Both are the ordinary act of writing a mandate, and
   * Direct's equivalent is that a Direct participant can change their mind
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
 * The six stages (Ver.2.12 §6.1). Both Direct and Proxy run exactly these,
 * which is what makes the transcripts comparable across conditions.
 *
 *  1 opening     — a full two-issue package from each side.
 *  2 first reason — the counterpart states its WR and asks for the
 *                  participant's top issue and reason; the participant's next
 *                  message is their first reason opportunity.
 *  3 lock        — NOT a message. The system records whether the participant
 *                  side disclosed before the counterpart's SB (PRE-RECIP-SB).
 *  4 disclosure  — the counterpart voices its designated SB card, once,
 *                  unconditionally. Never conditioned on what the participant
 *                  said, so every participant receives the same stimulus.
 *  5 trade       — conditional exchange, bounded by the credibility tier the
 *                  participant's voiced reasons have earned (§6.2).
 *  6 close       — tentative agreement, or impasse when the clock runs out.
 */
export type StageId = 1 | 2 | 3 | 4 | 5 | 6;

/** A complete selection across both issues. */
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
   * Internal provenance for the AI-Supplemented condition — stored for audit but
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
   * DECISION-LOCK (Ver.2.12 §6.1): the participant's disclosure decision is
   * fixed before anyone has spoken — the mandate under Proxy, the moment the
   * negotiation opens under Direct — so the choice cannot be revised after
   * hearing the counterpart. What is logged is when the lock happened; the
   * PRE/POST-RECIP-SB coding reads the message log against the counterpart's
   * SB disclosure.
   */
  | "decision_locked"
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
