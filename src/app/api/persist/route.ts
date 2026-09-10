import { failure, participantFor, readBody, StudyError } from "@/lib/server/study-db";
import { persistOperation } from "@/lib/server/study-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    if (body.batch !== undefined) throw new StudyError(400, "batch_not_supported");
    const batch = [body];
    let data: unknown = null;
    for (const item of batch) {
      if (!item || typeof item !== "object" || typeof item.op !== "string") throw new StudyError(400, "invalid_operation");
      // Re-read after every batch write so restoration JSON cannot overwrite
      // a preceding write. The database also locks/checks the active attempt.
      const row = await participantFor(request, item.op.startsWith("load"));
      const payload = item.payload;
      const claimed = payload && typeof payload === "object" ? (payload as Record<string, unknown>).participantKey : undefined;
      if (claimed !== undefined && claimed !== row.participant_key) throw new StudyError(409, "identity_changed");
      data = await persistOperation(row, item.op, payload);
    }
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
