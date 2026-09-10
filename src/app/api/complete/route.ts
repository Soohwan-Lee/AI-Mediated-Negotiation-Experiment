import { database, failure, participantFor, readBody, StudyError } from "@/lib/server/study-db";
import { STUDY } from "@/lib/study-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await readBody(request);
    const row = await participantFor(request, true);
    // Validate existing coded records, both task outcomes, consent and saved
    // debrief acknowledgment transactionally. Caller flags do not grant completion.
    const result = await database<{ status: string }>("rpc/complete_study_participation", "POST", {
      p_participant_key: row.participant_key,
    });
    if (result.status !== "completed") throw new StudyError(409, "study_incomplete");
    return Response.json({ complete: true, completionCode: STUDY.prolificCompletionCode,
      completionUrl: STUDY.prolificCompletionUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
