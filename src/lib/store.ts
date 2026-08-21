/**
 * Persistence facade.
 *
 * Every write the experiment performs goes through `Store`. The current
 * implementation is localStorage-backed so the flow is walkable with no
 * backend. Swapping in Supabase means writing a `SupabaseStore` that satisfies
 * the same interface and changing `getStore()` — no page component changes.
 *
 * Method names deliberately mirror the planned tables (docs/DATA_MODEL.md):
 *   participants / assignment_slots / events / responses / sessions /
 *   mandates / messages / agreements
 */

import type {
  Assignment,
  CandidateAgreement,
  ExperimentEvent,
  Mandate,
  ProlificContext,
  SurveyResponses,
  TranscriptMessage,
} from "./types";

export interface Store {
  createParticipant(
    participantKey: string,
    prolific: ProlificContext,
  ): Promise<void>;

  saveAssignment(assignment: Assignment): Promise<void>;
  loadAssignment(participantKey: string): Promise<Assignment | null>;

  logEvent(event: ExperimentEvent): Promise<void>;

  /** `block` is e.g. "background", "survey", "manipulation_check". */
  saveResponses(
    participantKey: string,
    block: string,
    responses: SurveyResponses,
  ): Promise<void>;
  loadResponses(
    participantKey: string,
    block: string,
  ): Promise<SurveyResponses | null>;

  saveMandate(participantKey: string, mandate: Mandate): Promise<void>;
  loadMandate(
    participantKey: string,
    sessionIndex: 1 | 2,
  ): Promise<Mandate | null>;

  appendMessage(
    participantKey: string,
    message: TranscriptMessage,
  ): Promise<void>;
  loadMessages(
    participantKey: string,
    sessionIndex: 1 | 2,
  ): Promise<TranscriptMessage[]>;

  saveAgreement(
    participantKey: string,
    agreement: CandidateAgreement,
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// localStorage implementation
// ---------------------------------------------------------------------------

const NS = "amne"; // AI-Mediated Negotiation Experiment

function key(...parts: (string | number)[]) {
  return [NS, ...parts].join(":");
}

function read<T>(k: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(k);
  return raw ? (JSON.parse(raw) as T) : null;
}

function write(k: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(k, JSON.stringify(value));
}

class LocalStore implements Store {
  async createParticipant(participantKey: string, prolific: ProlificContext) {
    write(key("participant", participantKey), {
      participantKey,
      ...prolific,
      createdAt: new Date().toISOString(),
    });
  }

  async saveAssignment(assignment: Assignment) {
    write(key("assignment", assignment.participantKey), assignment);
  }

  async loadAssignment(participantKey: string) {
    return read<Assignment>(key("assignment", participantKey));
  }

  async logEvent(event: ExperimentEvent) {
    const k = key("events", event.participantKey);
    const existing = read<ExperimentEvent[]>(k) ?? [];
    existing.push(event);
    write(k, existing);
    if (process.env.NODE_ENV === "development") {
      console.debug("[event]", event.type, event.page ?? "", event.payload ?? "");
    }
  }

  async saveResponses(
    participantKey: string,
    block: string,
    responses: SurveyResponses,
  ) {
    write(key("responses", participantKey, block), responses);
  }

  async loadResponses(participantKey: string, block: string) {
    return read<SurveyResponses>(key("responses", participantKey, block));
  }

  async saveMandate(participantKey: string, mandate: Mandate) {
    write(key("mandate", participantKey, mandate.sessionIndex), mandate);
  }

  async loadMandate(participantKey: string, sessionIndex: 1 | 2) {
    return read<Mandate>(key("mandate", participantKey, sessionIndex));
  }

  async appendMessage(participantKey: string, message: TranscriptMessage) {
    const k = key("messages", participantKey, message.sessionIndex);
    const existing = read<TranscriptMessage[]>(k) ?? [];
    existing.push(message);
    write(k, existing);
  }

  async loadMessages(participantKey: string, sessionIndex: 1 | 2) {
    return read<TranscriptMessage[]>(key("messages", participantKey, sessionIndex)) ?? [];
  }

  async saveAgreement(participantKey: string, agreement: CandidateAgreement) {
    write(key("agreement", participantKey, agreement.sessionIndex), agreement);
  }
}

let instance: Store | null = null;

/**
 * TODO(supabase): return a `SupabaseStore` when
 * NEXT_PUBLIC_SUPABASE_URL is configured. Writes that must not be
 * client-forgeable (assignment claim, event log) should route through
 * `/api/*` server routes rather than the browser client.
 */
export function getStore(): Store {
  if (!instance) instance = new LocalStore();
  return instance;
}
