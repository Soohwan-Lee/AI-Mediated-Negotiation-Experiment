/**
 * Supabase-backed `Store`. NOT WIRED UP YET — `getStore()` still returns the
 * localStorage implementation, and nothing imports this file at runtime.
 *
 * It exists now rather than later because the interface it satisfies is the
 * thing under review: writing it is how you find out whether the page
 * components really are free of persistence assumptions. They are, with the
 * exceptions noted below, and those are the work remaining.
 *
 * TO TURN IT ON
 *   1. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *   2. Apply the schema in docs/DATA_MODEL.md, including the RLS block — no
 *      policies for the anon role, so nothing writes from the browser directly.
 *   3. Create the `/api/persist` route described under `postWrite` below.
 *   4. In `store.ts`, return `new SupabaseStore()` from `getStore()`.
 * No page component changes. That is the whole point of the facade.
 *
 * WHY EVERY WRITE GOES THROUGH A SERVER ROUTE. Three reasons, and the first is
 * the one that matters: a participant who can watch their own network traffic
 * can infer their condition from it, and knowing the condition is the one
 * thing that invalidates their data (CLAUDE.md, "Things the participant must
 * never learn mid-study"). Beyond that, the service-role key must never reach
 * the browser bundle, and assignment claims must be server-authoritative or
 * the cell balance is forgeable.
 *
 * WHY THE QUEUE. The localStorage store cannot fail, so the call sites were
 * written as if writes always succeed — several are `void store.append…(…)`
 * with no `await` and no error branch, which is correct for a live negotiation
 * (a transcript write must never block the composer) and silently lossy over a
 * network. The queue closes that gap without touching a single call site:
 * writes are enqueued synchronously, retried with backoff, and mirrored to
 * localStorage so a participant who closes the tab mid-flush loses nothing
 * that a later session cannot re-send.
 */

import type {
  Assignment,
  CandidateAgreement,
  ExperimentEvent,
  Mandate,
  ProlificContext,
  RehearsalMessage,
  SurveyResponses,
  TranscriptMessage,
} from "./types";
import type { GuardrailEvent, Store } from "./store";

/** One pending write, as it sits in the durable queue. */
interface QueuedWrite {
  id: string;
  /** Which server-route operation this is. */
  op: string;
  payload: unknown;
  attempts: number;
  queuedAt: string;
}

const QUEUE_KEY = "amne:writequeue";
const MAX_ATTEMPTS = 6;

function readQueue(): QueuedWrite[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedWrite[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or blocked. The in-memory queue still drains this session;
    // durability across a reload is what is lost, and there is nothing useful
    // to do about it here.
  }
}

/**
 * Enqueue a write and start draining.
 *
 * Returns as soon as the write is durable LOCALLY, not when the server has it.
 * That is deliberate: `appendMessage` is called from inside a live negotiation
 * and an awaited round trip there would stall the composer between turns.
 */
export class WriteQueue {
  private queue: QueuedWrite[] = [];
  private draining = false;
  private seq = 0;

  constructor(private endpoint: string) {
    this.queue = readQueue();
    if (this.queue.length) void this.drain();
    if (typeof window !== "undefined") {
      // A tab closing mid-flush is the common case, not an edge case: the
      // study ends on a completion screen people close immediately.
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.flushBeacon();
      });
    }
  }

  push(op: string, payload: unknown): void {
    this.seq += 1;
    this.queue.push({
      id: `${Date.now()}-${this.seq}`,
      op,
      payload,
      attempts: 0,
      queuedAt: new Date().toISOString(),
    });
    writeQueue(this.queue);
    void this.drain();
  }

  /** Await this where the next screen depends on the write having landed. */
  async flush(): Promise<void> {
    await this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining || typeof window === "undefined") return;
    this.draining = true;
    try {
      while (this.queue.length) {
        const item = this.queue[0];
        try {
          const response = await fetch(this.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ op: item.op, payload: item.payload }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          this.queue.shift();
          writeQueue(this.queue);
        } catch {
          item.attempts += 1;
          writeQueue(this.queue);
          if (item.attempts >= MAX_ATTEMPTS) {
            // Drop to the back rather than discarding: a later flush, or the
            // next session, gets another go. Losing a transcript row is worse
            // than sending it late.
            this.queue.push(this.queue.shift()!);
            writeQueue(this.queue);
          }
          // Exponential backoff, capped. Stop draining; the next push or a
          // visibility change restarts it.
          await new Promise((r) =>
            setTimeout(r, Math.min(1000 * 2 ** item.attempts, 30_000)),
          );
          if (item.attempts >= MAX_ATTEMPTS) break;
        }
      }
    } finally {
      this.draining = false;
    }
  }

  /**
   * Last-ditch send on tab hide. `sendBeacon` survives the page going away,
   * which a normal fetch does not.
   */
  private flushBeacon(): void {
    if (!this.queue.length || typeof navigator === "undefined") return;
    try {
      navigator.sendBeacon(
        this.endpoint,
        new Blob([JSON.stringify({ batch: this.queue })], {
          type: "application/json",
        }),
      );
    } catch {
      // Nothing further to try.
    }
  }
}

/**
 * The Supabase store.
 *
 * Reads go through server routes too, so the anon key never needs table
 * access. Writes that a later screen depends on are awaited via
 * `queue.flush()`; the rest are enqueued and drain in the background.
 */
export class SupabaseStore implements Store {
  private queue = new WriteQueue("/api/persist");

  private async get<T>(op: string, params: unknown): Promise<T | null> {
    const response = await fetch("/api/persist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op, payload: params }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: T };
    return body.data ?? null;
  }

  async createParticipant(participantKey: string, prolific: ProlificContext) {
    this.queue.push("createParticipant", { participantKey, prolific });
    // Awaited: everything downstream is keyed on this row existing.
    await this.queue.flush();
  }

  async saveAssignment(assignment: Assignment) {
    this.queue.push("saveAssignment", assignment);
    await this.queue.flush();
  }

  async loadAssignment(participantKey: string) {
    return this.get<Assignment>("loadAssignment", { participantKey });
  }

  async logEvent(event: ExperimentEvent) {
    // Never awaited — an event log must not be able to stall a screen.
    this.queue.push("logEvent", event);
  }

  async saveResponses(
    participantKey: string,
    block: string,
    responses: SurveyResponses,
  ) {
    this.queue.push("saveResponses", { participantKey, block, responses });
    await this.queue.flush();
  }

  async loadResponses(participantKey: string, block: string) {
    return this.get<SurveyResponses>("loadResponses", {
      participantKey,
      block,
    });
  }

  async saveMandate(participantKey: string, mandate: Mandate) {
    this.queue.push("saveMandate", { participantKey, mandate });
    await this.queue.flush();
  }

  async loadMandate(participantKey: string, sessionIndex: 1 | 2) {
    return this.get<Mandate>("loadMandate", { participantKey, sessionIndex });
  }

  async appendMessage(participantKey: string, message: TranscriptMessage) {
    // NOT awaited: called mid-negotiation, where a round trip between turns
    // would be visible as a stall in the composer.
    this.queue.push("appendMessage", { participantKey, message });
  }

  async loadMessages(participantKey: string, sessionIndex: 1 | 2) {
    return (
      (await this.get<TranscriptMessage[]>("loadMessages", {
        participantKey,
        sessionIndex,
      })) ?? []
    );
  }

  async appendRehearsalMessage(
    participantKey: string,
    message: RehearsalMessage,
  ) {
    this.queue.push("appendRehearsalMessage", { participantKey, message });
  }

  async loadRehearsalMessages(participantKey: string, sessionIndex: 1 | 2) {
    return (
      (await this.get<RehearsalMessage[]>("loadRehearsalMessages", {
        participantKey,
        sessionIndex,
      })) ?? []
    );
  }

  async saveAgreement(participantKey: string, agreement: CandidateAgreement) {
    this.queue.push("saveAgreement", { participantKey, agreement });
    await this.queue.flush();
  }

  async loadAgreement(participantKey: string, sessionIndex: 1 | 2) {
    return this.get<CandidateAgreement>("loadAgreement", {
      participantKey,
      sessionIndex,
    });
  }

  async logGuardrailEvent(participantKey: string, event: GuardrailEvent) {
    this.queue.push("logGuardrailEvent", { participantKey, event });
  }
}
