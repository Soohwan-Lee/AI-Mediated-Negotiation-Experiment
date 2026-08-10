/**
 * Server-authoritative condition assignment.
 *
 * DESIGN INTENT (Methods §Experimental assignment): on participant entry the
 * server claims the next unclaimed row from a pre-seeded `assignment_slots`
 * table, flips it to claimed, and returns it. The claim must be atomic so two
 * simultaneous participants cannot take the same slot:
 *
 *   -- supabase/migrations: claim_assignment_slot()
 *   UPDATE assignment_slots SET claimed = true, participant_key = p_key,
 *          claimed_at = now()
 *   WHERE id = (
 *     SELECT id FROM assignment_slots WHERE claimed = false
 *     ORDER BY slot_index LIMIT 1 FOR UPDATE SKIP LOCKED
 *   )
 *   RETURNING *;
 *
 * SCAFFOLD STATE: falls through to the deterministic local stand-in in
 * lib/assignment. Assignment is idempotent per participant key so a refresh
 * never reassigns (Methods: "assignment is not changed after session start").
 */

import { NextResponse } from "next/server";
import { claimSlot } from "@/lib/assignment";

export const runtime = "nodejs";

interface RequestBody {
  participantKey: string;
  prolificPid?: string | null;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.participantKey) {
    return NextResponse.json(
      { error: "participantKey is required" },
      { status: 400 },
    );
  }

  // TODO(supabase): check for an existing assignment by participant_key first,
  // then call the claim_assignment_slot RPC. Return 409 if the pool is
  // exhausted so the study can be closed cleanly.
  const assignment = await claimSlot(body.participantKey);

  return NextResponse.json({ assignment, stubbed: true });
}
