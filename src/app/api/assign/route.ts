import { assignmentOf, claimParticipant, failure, participantFor, readBody, sessionCookie } from "@/lib/server/study-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admission is the only place a production assignment is created. */
export async function POST(request: Request) {
  try {
    const row = await claimParticipant(await readBody(request));
    return Response.json({ assignment: assignmentOf(row), status: row.status,
      consented: row.operational?.consented === true }, {
      headers: { "Set-Cookie": sessionCookie(row.participant_key, request), "Cache-Control": "no-store" },
    });
  } catch (error) { return failure(error); }
}

/** Internal URL refresh restores the signed identity, never a supplied key. */
export async function GET(request: Request) {
  try {
    const row = await participantFor(request, true);
    return Response.json({ assignment: assignmentOf(row), status: row.status,
      consented: row.operational?.consented === true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
