/**
 * Condition assignment.
 *
 * DESIGN INTENT (not yet implemented — see docs/DATA_MODEL.md):
 * A pre-seeded `assignment_slots` table holds one row per planned participant,
 * each row carrying a fixed (proxy_policy, role, sequence_id) combination and a
 * `claimed` boolean. On participant entry the server atomically claims the
 * first row with `claimed = false`, flips it to true, and returns it. This
 * keeps the four `Proxy Policy x Role` cells and the four sequences balanced
 * without any runtime randomization, and makes the design auditable.
 *
 * The claim MUST be atomic (Postgres RPC with `FOR UPDATE SKIP LOCKED`, or a
 * conditional update returning the row) so two simultaneous participants can
 * never claim the same slot.
 *
 * Until then, `claimSlot` falls back to a local deterministic rotation so the
 * whole flow is walkable end to end.
 */

import type {
  Assignment,
  Condition,
  ProxyPolicy,
  Role,
  SequenceId,
  SessionOrder,
  SessionPlan,
  TaskId,
} from "./types";

/** The 4 counterbalanced sequences from Methods §Experimental Design. */
const SEQUENCES: Record<
  SequenceId,
  { order: SessionOrder; first: { condition: "direct" | "proxy"; task: TaskId }; second: { condition: "direct" | "proxy"; task: TaskId } }
> = {
  seq1: {
    order: "direct_first",
    first: { condition: "direct", task: "task_a" },
    second: { condition: "proxy", task: "task_b" },
  },
  seq2: {
    order: "proxy_first",
    first: { condition: "proxy", task: "task_a" },
    second: { condition: "direct", task: "task_b" },
  },
  seq3: {
    order: "direct_first",
    first: { condition: "direct", task: "task_b" },
    second: { condition: "proxy", task: "task_a" },
  },
  seq4: {
    order: "proxy_first",
    first: { condition: "proxy", task: "task_b" },
    second: { condition: "direct", task: "task_a" },
  },
};

const PROXY_POLICIES: ProxyPolicy[] = ["delegate", "explorer"];
const ROLES: Role[] = ["leader", "member"];
const SEQUENCE_IDS: SequenceId[] = ["seq1", "seq2", "seq3", "seq4"];

/**
 * The full crossed slot list, in the order rows should be seeded into
 * `assignment_slots`. 2 policies x 2 roles x 4 sequences = 16 slots per block;
 * repeat the block until the target N (120) is reached.
 */
export function buildSlotBlock(): Array<{
  proxyPolicy: ProxyPolicy;
  role: Role;
  sequenceId: SequenceId;
}> {
  const slots = [];
  for (const proxyPolicy of PROXY_POLICIES) {
    for (const role of ROLES) {
      for (const sequenceId of SEQUENCE_IDS) {
        slots.push({ proxyPolicy, role, sequenceId });
      }
    }
  }
  return slots;
}

/** Expands a claimed slot into the concrete two-session plan. */
export function resolveAssignment(
  participantKey: string,
  slot: { proxyPolicy: ProxyPolicy; role: Role; sequenceId: SequenceId },
  assignedAt: string,
): Assignment {
  const seq = SEQUENCES[slot.sequenceId];

  const toCondition = (c: "direct" | "proxy"): Condition =>
    c === "direct" ? "direct" : slot.proxyPolicy;

  const sessions: [SessionPlan, SessionPlan] = [
    { index: 1, condition: toCondition(seq.first.condition), taskId: seq.first.task },
    { index: 2, condition: toCondition(seq.second.condition), taskId: seq.second.task },
  ];

  return {
    participantKey,
    proxyPolicy: slot.proxyPolicy,
    role: slot.role,
    sequenceId: slot.sequenceId,
    sessionOrder: seq.order,
    sessions,
    assignedAt,
  };
}

/**
 * Claims the next available slot.
 *
 * TODO(supabase): replace the body with an atomic RPC call:
 *   const { data } = await supabase.rpc('claim_assignment_slot', { p_key: participantKey })
 * and drop the local rotation entirely.
 */
export async function claimSlot(
  participantKey: string,
): Promise<Assignment> {
  const block = buildSlotBlock();
  // Deterministic stand-in: hash the key into the block so repeated entries by
  // the same participant resolve to the same slot (refresh-safe).
  let hash = 0;
  for (let i = 0; i < participantKey.length; i += 1) {
    hash = (hash * 31 + participantKey.charCodeAt(i)) >>> 0;
  }
  const slot = block[hash % block.length];
  return resolveAssignment(participantKey, slot, new Date().toISOString());
}

/** Convenience lookups used by the session pages. */
export function sessionPlan(
  assignment: Assignment,
  index: 1 | 2,
): SessionPlan {
  return assignment.sessions[index - 1];
}

export function isProxyCondition(condition: Condition): boolean {
  return condition === "delegate" || condition === "explorer";
}
