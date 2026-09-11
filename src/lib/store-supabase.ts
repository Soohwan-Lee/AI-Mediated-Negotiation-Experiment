/**
 * Server-backed store with an ordered queue scoped to one participation attempt.
 * Writes use signed-session API routes; server credentials never enter this file.
 * Failed writes remain local for an explicit retry or reload. Completion requires
 * both a successful flush and the server's separate completeness check.
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
import type { GuardrailEvent, Store } from "./store";

/** One pending write, as it sits in the durable queue. */
interface QueuedWrite {
  id: string;
  /** Which server-route operation this is. */
  op: string;
  payload: unknown;
  queuedAt: string;
}

const RECOVERABLE_RESPONSE_BLOCK =
  /^(?:debriefing|v226_(?:background|wrap_up|post_task_scales_t[12]|task_decision_t[12]|task_open_t[12]))$/;

function responseSnapshot(item: QueuedWrite) {
  if (item.op !== "saveResponses" || !item.payload || typeof item.payload !== "object") return null;
  const payload = item.payload;
  if (
    !("participantKey" in payload) ||
    typeof payload.participantKey !== "string" ||
    !("block" in payload) ||
    typeof payload.block !== "string" ||
    !("responses" in payload) ||
    !payload.responses ||
    typeof payload.responses !== "object" ||
    Array.isArray(payload.responses)
  ) return null;
  return {
    participantKey: payload.participantKey,
    block: payload.block,
    responses: payload.responses,
  };
}

function supersedesSurveySnapshot(firstItem: QueuedWrite, secondItem: QueuedWrite) {
  const first = responseSnapshot(firstItem);
  const second = responseSnapshot(secondItem);
  const preservesSubmissionProgress = first && second &&
    ["_submitted", "_completed", "_checks_submitted"].every((key) =>
      Reflect.get(first.responses, key) !== true || Reflect.get(second.responses, key) === true,
    ) &&
    (typeof Reflect.get(first.responses, "_submitted_parts") !== "number" ||
      (typeof Reflect.get(second.responses, "_submitted_parts") === "number" &&
        Reflect.get(second.responses, "_submitted_parts") >=
          Reflect.get(first.responses, "_submitted_parts")));
  return Boolean(
    first && second &&
    RECOVERABLE_RESPONSE_BLOCK.test(first.block) &&
    second.participantKey === first.participantKey &&
    second.block === first.block &&
    Object.is(
      Reflect.get(first.responses, "_instrument_version"),
      Reflect.get(second.responses, "_instrument_version"),
    ) &&
    preservesSubmissionProgress &&
    Object.keys(first.responses).every((key) => Object.hasOwn(second.responses, key)),
  );
}

/**
 * Collapse only adjacent, cumulative survey drafts. `preservePrefix` protects
 * the item currently owned by `run()` from queue mutation while fetch awaits.
 */
function compactSurveySnapshots(queue: QueuedWrite[], preservePrefix = 0): QueuedWrite[] {
  const compacted = queue.slice(0, preservePrefix);
  for (const item of queue.slice(preservePrefix)) {
    while (
      compacted.length > preservePrefix &&
      supersedesSurveySnapshot(compacted[compacted.length - 1], item)
    ) {
      compacted.pop();
    }
    compacted.push(item);
  }
  return compacted;
}

const QUEUE_KEY = "amne:writequeue";

function readQueue(storageKey = QUEUE_KEY): QueuedWrite[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedWrite[], storageKey = QUEUE_KEY): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(queue));
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

  constructor(private endpoint: string, private storageKey = QUEUE_KEY) {
    const storedQueue = readQueue(storageKey);
    this.queue = compactSurveySnapshots(storedQueue);
    if (this.queue.length !== storedQueue.length) {
      writeQueue(this.queue, this.storageKey);
    }
    if (this.queue.length) void this.drain();
    if (typeof window !== "undefined") {
      // One ordered transport only. A parallel beacon could replay an older
      // survey draft after a newer write. The durable queue resumes on reload.
      // Coming back online is the moment a stalled queue should retry, and it
      // costs nothing to wait for it rather than backing off blindly.
      window.addEventListener("online", () => {
        void this.drain();
      });
    }
  }

  push(op: string, payload: unknown): void {
    this.seq += 1;
    this.enqueue({
      id: `${Date.now()}-${this.seq}`,
      op,
      payload,
      queuedAt: new Date().toISOString(),
    });
  }

  /** Enqueue one logical record at most once, including after a page reload. */
  pushIdempotent(op: string, payload: unknown, id: string): void {
    if (this.queue.some((item) => item.id === id)) return;
    this.enqueue({ id, op, payload, queuedAt: new Date().toISOString() });
  }

  private enqueue(item: QueuedWrite): void {
    this.queue.push(item);
    // `drain()` captures queue[0] across an await. Never replace that object;
    // compact only writes that have not started transport yet.
    this.queue = compactSurveySnapshots(this.queue, this.draining ? 1 : 0);
    writeQueue(this.queue, this.storageKey);
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
   * Worse, the item was then rotated to the back still carrying its spent budget,
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
          signal: AbortSignal.timeout(10_000),
          // Transport IDs aid inspection. Database record keys make retries
          // idempotent; no parallel beacon can replay an older draft.
          body: JSON.stringify({ id: item.id, op: item.op, payload: item.payload }),
        });
        if (!response.ok) {
          const supersededValidationFailure =
            (response.status === 400 || response.status === 413) &&
            this.queue.slice(1).some((candidate) =>
              supersedesSurveySnapshot(item, candidate),
            );
          if (supersededValidationFailure) {
            // Survey writes are complete block snapshots. A later snapshot for
            // the same attempt and block therefore compensates for this
            // rejected one. Keep every unrelated write in place, and never do
            // this for auth, conflict, or transient server failures.
            this.queue.shift();
            writeQueue(this.queue, this.storageKey);
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }
        this.queue.shift();
        writeQueue(this.queue, this.storageKey);
      } catch {
        writeQueue(this.queue, this.storageKey);
        // Nothing is discarded and nothing is reordered: the queue is a
        // transcript and its order is data. Stop here and let the next push,
        // an `online` event, or the next flush try again.
        return;
      }
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
  readonly persistenceKind = "remote" as const;
  private queue: WriteQueue;

  constructor(participantKey = "unclaimed") {
    this.queue = new WriteQueue("/api/persist", `amne:writequeue:${participantKey}`);
  }

  /** Completion uses the queue's existing ordered flush contract. */
  async confirmSaved(): Promise<boolean> {
    return this.queue.flush();
  }

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
    if (!(await this.queue.flush())) throw new Error("Pending study data could not be saved");
    const response = await fetch("/api/persist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ op, payload: params }),
    });
    if (!response.ok) throw new Error("Saved study data could not be loaded");
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
    // Only analytic phase boundaries reach storage. Completion is finalized
    // separately; clicks, comprehension attempts and practice are not records.
    if (event.type !== "negotiation_started" && event.type !== "negotiation_ended") return;
    this.queue.push("logEvent", event);
  }

  async saveResponses(
    participantKey: string,
    block: string,
    responses: SurveyResponses,
  ) {
    if (block === "instruction_check" || block.startsWith("practice_")) return;
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
    // The authenticated model routes persist authoritative server_audit entries.
    // Client guardrail echoes are deliberately not a second analysis source.
    void participantKey; void event;
  }
}
