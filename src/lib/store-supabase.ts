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
  /**
   * How many times this item has been tried. Diagnostics only — nothing is
   * dropped or reordered on a count. Retries are triggered by events that mean
   * conditions actually changed (another push, `online`, the next flush), not
   * by a budget being spent, because a budget spent while the network was down
   * used to leave the queue permanently refusing to drain.
   */
  attempts: number;
  queuedAt: string;
}

const QUEUE_KEY = "amne:writequeue";

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
  /** The in-flight drain, so a second caller awaits it instead of skipping it. */
  private draining: Promise<void> | null = null;
  private seq = 0;

  constructor(private endpoint: string) {
    this.queue = readQueue();
    // Anything left from a previous session had its attempts counted against a
    // server that may since have come back. Start it fresh, or a queue that
    // exhausted its retries yesterday would refuse to drain today.
    for (const item of this.queue) item.attempts = 0;
    if (this.queue.length) void this.drain();
    if (typeof window !== "undefined") {
      // A tab closing mid-flush is the common case, not an edge case: the
      // study ends on a completion screen people close immediately.
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.flushBeacon();
      });
      // Coming back online is the moment a stalled queue should retry, and it
      // costs nothing to wait for it rather than backing off blindly.
      window.addEventListener("online", () => {
        for (const item of this.queue) item.attempts = 0;
        void this.drain();
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

  /**
   * Await this where the next screen depends on the write having landed.
   *
   * It must await the IN-FLIGHT drain, not start a second one and return.
   * `drain()` used to bail out at its re-entrancy guard, so `flush()` was
   * `await Promise.resolve()` whenever a background drain happened to be
   * running — and the writes that are awaited precisely because the next
   * screen depends on them (participant creation, assignment, the mandate)
   * would resolve while still sitting in the queue.
   */
  async flush(): Promise<boolean> {
    await this.drain();
    // Reported, not thrown. A drain that gave up leaves the queue non-empty,
    // and the caller needs to know — but throwing here would surface a
    // transient network failure as a crashed screen in the middle of a study,
    // which is worse than proceeding with the write still queued. The write is
    // in localStorage and will be retried.
    return this.queue.length === 0;
  }

  /** How many writes are still waiting. Surfaced for a completion-page check. */
  get pending(): number {
    return this.queue.length;
  }

  /**
   * Send whatever is queued, oldest first, and stop at the first item that
   * will not go.
   *
   * ONE PASS PER ITEM, and the backoff is between passes rather than inside
   * them. An earlier version retried the head item up to six times within a
   * single drain, sleeping up to thirty seconds between tries — ninety seconds
   * of a drain that `flush()` awaited, during which the study appeared frozen.
   * Worse, the item was then rotated to the back still carrying six attempts,
   * so every later drain broke on it immediately and the queue never moved
   * again. Retries now come from the events that mean "conditions changed":
   * another `push`, coming back online, or the next `flush`.
   */
  private drain(): Promise<void> {
    if (this.draining) return this.draining;
    if (typeof window === "undefined") return Promise.resolve();
    this.draining = this.run().finally(() => {
      this.draining = null;
    });
    return this.draining;
  }

  private async run(): Promise<void> {
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
        // Nothing is discarded and nothing is reordered: the queue is a
        // transcript and its order is data. Stop here and let the next push,
        // an `online` event, or the next flush try again.
        return;
      }
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

  /**
   * Await a write the next screen depends on, and note it if it did not land.
   *
   * Deliberately does NOT block the participant. The alternative — refusing to
   * advance until the server answers — turns a dropped connection into a dead
   * end in the middle of a 55-minute study, and the write is durable locally
   * either way. What must not happen is failing silently, so the console
   * carries it and `queue.pending` can be read at the end.
   */
  private async settle(label: string): Promise<void> {
    const landed = await this.queue.flush();
    if (!landed) {
      console.warn(
        `[store] ${label} is queued but not yet saved (${this.queue.pending} pending).`,
      );
    }
  }

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
    await this.settle("createParticipant");
  }

  async saveAssignment(assignment: Assignment) {
    this.queue.push("saveAssignment", assignment);
    await this.settle("saveAssignment");
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
    await this.settle("saveResponses");
  }

  async loadResponses(participantKey: string, block: string) {
    return this.get<SurveyResponses>("loadResponses", {
      participantKey,
      block,
    });
  }

  async saveMandate(participantKey: string, mandate: Mandate) {
    this.queue.push("saveMandate", { participantKey, mandate });
    await this.settle("saveMandate");
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
    await this.settle("saveAgreement");
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
