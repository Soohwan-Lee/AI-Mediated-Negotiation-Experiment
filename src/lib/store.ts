/**
 * Persistence facade.
 *
 * Development uses localStorage; recruitment uses signed-session server routes.
 * The shared interface maps onto the compact five-table research schema.
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
import { SupabaseStore } from "./store-supabase";

export interface Store {
  /** What a successful `confirmSaved` call actually guarantees. */
  readonly persistenceKind: "local" | "remote";

  /** Retry pending writes and report whether this store is currently settled. */
  confirmSaved(): Promise<boolean>;

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
  loadAgreement(
    participantKey: string,
    sessionIndex: 1 | 2,
  ): Promise<CandidateAgreement | null>;

  /**
   * A validator block or regeneration (docs/DATA_MODEL.md `guardrail_events`).
   *
   * The table was in the schema with no way to write to it, so pilot gate 9's
   * rationale audit had no source. Guardrail behaviour is also the thing most
   * likely to differ silently between the two policies, which makes its rate
   * part of the AI-Supplemented − User-Specified contrast rather than an implementation
   * detail.
   */
  logGuardrailEvent(
    participantKey: string,
    event: GuardrailEvent,
  ): Promise<void>;
}

/** One validator block or regeneration, for the pilot audit. */
export interface GuardrailEvent {
  sessionIndex: 1 | 2;
  turnIndex?: number;
  violationCode: string;
  detail?: string;
  disposition: "accept" | "regenerate" | "mark_unresolved";
  createdAt: string;
}

// ---------------------------------------------------------------------------
// localStorage implementation
// ---------------------------------------------------------------------------

const NS = "amne"; // AI-Mediated Negotiation Experiment

function key(...parts: (string | number)[]) {
  return [NS, ...parts].join(":");
}

// BOTH SIDES SWALLOW, as `store-supabase.ts`'s queue mirror does. A private
// window, blocked site data or a full quota makes `localStorage` THROW, and
// these are called from the middle of a negotiation turn: an unhandled quota
// error there would take the whole exchange down over a write whose only job
// is durability across a reload. A read that throws is the same case — the
// absent value is the correct answer to "nothing readable is stored".
function read<T>(k: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export class LocalStore implements Store {
  readonly persistenceKind = "local" as const;

  /** Latest unsaved value per key; intentionally not a general-purpose queue. */
  private pendingWrites = new Map<string, string>();

  private readValue<T>(k: string): T | null {
    const pending = this.pendingWrites.get(k);
    if (pending !== undefined) {
      try {
        return JSON.parse(pending) as T;
      } catch {
        return null;
      }
    }
    return read<T>(k);
  }

  private writeValue(k: string, value: unknown): void {
    if (typeof window === "undefined") return;
    const serialized = JSON.stringify(value);
    try {
      window.localStorage.setItem(k, serialized);
      this.pendingWrites.delete(k);
    } catch {
      // Preserve the newest value for reads and a later explicit retry. Live
      // negotiation actions still never fail because localStorage is blocked.
      this.pendingWrites.set(k, serialized);
    }
  }

  async confirmSaved(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    for (const [k, serialized] of [...this.pendingWrites]) {
      try {
        window.localStorage.setItem(k, serialized);
        this.pendingWrites.delete(k);
      } catch {
        // Keep every failed key for the next Retry press.
      }
    }
    return this.pendingWrites.size === 0;
  }

  async createParticipant(participantKey: string, prolific: ProlificContext) {
    this.writeValue(key("participant", participantKey), {
      participantKey,
      ...prolific,
      createdAt: new Date().toISOString(),
    });
  }

  async saveAssignment(assignment: Assignment) {
    this.writeValue(key("assignment", assignment.participantKey), assignment);
  }

  async loadAssignment(participantKey: string) {
    return this.readValue<Assignment>(key("assignment", participantKey));
  }

  async logEvent(event: ExperimentEvent) {
    const k = key("events", event.participantKey);
    const existing = this.readValue<ExperimentEvent[]>(k) ?? [];
    if (
      event.type === "study_completed" &&
      existing.some((saved) => saved.type === "study_completed")
    ) {
      return;
    }
    existing.push(event);
    this.writeValue(k, existing);
    if (process.env.NODE_ENV === "development") {
      console.debug("[event]", event.type, event.page ?? "", event.payload ?? "");
    }
  }

  async saveResponses(
    participantKey: string,
    block: string,
    responses: SurveyResponses,
  ) {
    this.writeValue(key("responses", participantKey, block), responses);
  }

  async loadResponses(participantKey: string, block: string) {
    return this.readValue<SurveyResponses>(key("responses", participantKey, block));
  }

  async saveMandate(participantKey: string, mandate: Mandate) {
    this.writeValue(key("mandate", participantKey, mandate.sessionIndex), mandate);
  }

  async loadMandate(participantKey: string, sessionIndex: 1 | 2) {
    return this.readValue<Mandate>(key("mandate", participantKey, sessionIndex));
  }

  async appendMessage(participantKey: string, message: TranscriptMessage) {
    const k = key("messages", participantKey, message.sessionIndex);
    const existing = this.readValue<TranscriptMessage[]>(k) ?? [];
    const duplicateIndex = existing.findIndex((saved) => saved.id === message.id);
    if (duplicateIndex >= 0) {
      // The same message is sometimes written once when rendered and again
      // after classification. Keep its identity, text, time and position while
      // adding only metadata that the later write actually defines.
      const definedMetadata = Object.fromEntries(
        Object.entries(message).filter(
          ([field, value]) =>
            !["id", "text", "createdAt"].includes(field) && value !== undefined,
        ),
      );
      existing[duplicateIndex] = {
        ...existing[duplicateIndex],
        ...definedMetadata,
      };
    } else {
      existing.push(message);
    }
    this.writeValue(k, existing);
  }

  async loadMessages(participantKey: string, sessionIndex: 1 | 2) {
    return this.readValue<TranscriptMessage[]>(key("messages", participantKey, sessionIndex)) ?? [];
  }

  async saveAgreement(participantKey: string, agreement: CandidateAgreement) {
    this.writeValue(key("agreement", participantKey, agreement.sessionIndex), agreement);
  }

  async loadAgreement(participantKey: string, sessionIndex: 1 | 2) {
    return this.readValue<CandidateAgreement>(
      key("agreement", participantKey, sessionIndex),
    );
  }

  async logGuardrailEvent(participantKey: string, event: GuardrailEvent) {
    const k = key("guardrail", participantKey);
    const existing = this.readValue<GuardrailEvent[]>(k) ?? [];
    existing.push(event);
    this.writeValue(k, existing);
  }
}

let instance: Store | null = null;
let identity: string | null = null;

/** Development and mock flows always stay local, even when server keys exist. */
export const REMOTE_STUDY = process.env.NEXT_PUBLIC_DEV_TOOLS === "off";

/** Each attempt has its own recoverable queue. Old queues are left in place. */
export function setStoreIdentity(participantKey: string): void {
  if (!REMOTE_STUDY || identity === participantKey) return;
  identity = participantKey;
  instance = new SupabaseStore(participantKey);
}

/**
 * Production requires the server-backed store. Missing server configuration
 * fails closed in admission/preflight, never by falling back to local storage.
 */
export function getStore(): Store {
  if (!instance) instance = REMOTE_STUDY ? new SupabaseStore() : new LocalStore();
  return instance;
}
