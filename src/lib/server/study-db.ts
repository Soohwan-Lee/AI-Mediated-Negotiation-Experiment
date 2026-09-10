import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { resolveAssignment, sequenceForOrders } from "../assignment";
import type { Assignment, ProxyPolicy, Role } from "../types";

export class StudyError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

export interface ParticipantRow extends Record<string, unknown> {
  participant_key: string;
  participant_id: number;
  prolific_pid: string;
  study_id: string;
  session_id: string;
  proxy_policy: ProxyPolicy;
  role: Role;
  task_order: "taskA_first" | "taskB_first";
  mode_order: "directFirst" | "proxyFirst";
  assigned_at: string;
  expires_at: string;
  status: "active" | "completed" | "expired" | "stopped";
  background_answers: Record<string, unknown>;
  open_answers: Record<string, unknown>;
  operational: Record<string, unknown>;
}

const COOKIE = "amne_study";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validProlificId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);

export function databaseConfigured(): boolean {
  return Boolean((process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim()
    && (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim());
}

function configuration() {
  if (typeof window !== "undefined") throw new Error("Server-only database module");
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const secret = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !secret) throw new StudyError(503, "storage_unavailable");
  return { url: url.replace(/\/$/, ""), secret };
}

/** Service credentials stay in server routes; never return provider error bodies. */
export async function database<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const { url, secret } = configuration();
  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/${path}`, {
      method, cache: "no-store", signal: AbortSignal.timeout(10_000),
      headers: {
        apikey: secret, ...(!secret.startsWith("sb_secret_") ? { Authorization: `Bearer ${secret}` } : {}),
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch { throw new StudyError(503, "storage_unavailable"); }
  if (!response.ok) {
    // Database constraints also enforce attempt expiry and immutable assignment.
    throw new StudyError(response.status === 409 || response.status === 400 ? 409 : 503,
      response.status === 409 || response.status === 400 ? "record_conflict" : "storage_unavailable");
  }
  if (response.status === 204) return null as T;
  return await response.json() as T;
}

export function assignmentOf(row: ParticipantRow): Assignment {
  return resolveAssignment(row.participant_key, {
    proxyPolicy: row.proxy_policy, role: row.role,
    sequenceId: sequenceForOrders(row.mode_order === "proxyFirst" ? "proxy_first" : "direct_first",
      row.task_order === "taskA_first" ? "task_a_first" : "task_b_first"),
  }, row.assigned_at);
}

function signature(value: string): string {
  const secret = process.env.STUDY_SESSION_SECRET?.trim() ?? configuration().secret;
  return createHmac("sha256", secret).update(`amne-study-session-v1:${value}`).digest("base64url");
}

export function sessionCookie(key: string, request: Request): string {
  const value = `${key}.${Date.now() + 2 * 60 * 60 * 1000}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}.${signature(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200${secure}`;
}

export function sessionKey(request: Request): string {
  const cookie = request.headers.get("cookie")?.split(";").map(x => x.trim())
    .find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const [key, expires, mac, ...extra] = cookie?.split(".") ?? [];
  if (!key || !UUID.test(key) || extra.length || !/^\d{13}$/.test(expires ?? "")
    || Number(expires) < Date.now() || !mac) throw new StudyError(401, "session_required");
  const expected = signature(`${key}.${expires}`);
  const received = Buffer.from(mac);
  const wanted = Buffer.from(expected);
  if (received.length !== wanted.length || !timingSafeEqual(received, wanted)) {
    throw new StudyError(401, "session_required");
  }
  return key;
}

export async function participantFor(request: Request, allowCompleted = false): Promise<ParticipantRow> {
  const key = sessionKey(request);
  const rows = await database<ParticipantRow[]>(`study_participants?participant_key=eq.${key}&limit=1`);
  const row = rows[0];
  if (!row) throw new StudyError(401, "session_required");
  if (allowCompleted && row.status === "completed") return row;
  if (row.status !== "active" || Date.parse(row.expires_at) <= Date.now()) {
    throw new StudyError(409, "session_stopped");
  }
  return row;
}

export function checkOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new StudyError(403, "invalid_origin");
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  checkOrigin(request);
  if (process.env.NEXT_PUBLIC_DEV_TOOLS !== "off") throw new StudyError(403, "preview_is_local");
  const text = await request.text();
  if (text.length > 250_000) throw new StudyError(413, "request_too_large");
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new StudyError(400, "invalid_request"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new StudyError(400, "invalid_request");
  return body as Record<string, unknown>;
}

export function failure(error: unknown): Response {
  return Response.json({ error: error instanceof StudyError ? error.code : "storage_unavailable" }, {
    status: error instanceof StudyError ? error.status : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function claimParticipant(ids: Record<string, unknown>): Promise<ParticipantRow> {
  if (![ids.prolificPid, ids.studyId, ids.sessionId].every(validProlificId)) {
    throw new StudyError(400, "prolific_identity_required");
  }
  const result = await database<ParticipantRow | ParticipantRow[] | null>("rpc/claim_study_assignment", "POST", {
    p_prolific_pid: String(ids.prolificPid).toLowerCase(), p_study_id: String(ids.studyId).toLowerCase(),
    p_session_id: String(ids.sessionId).toLowerCase(), p_participant_key: randomUUID(),
  });
  const row = Array.isArray(result) ? result[0] : result;
  if (!row?.participant_key) throw new StudyError(409, "assignment_unavailable");
  // Fetch the frozen assignment and full attempt record, not a client echo.
  const rows = await database<ParticipantRow[]>(`study_participants?participant_key=eq.${row.participant_key}&limit=1`);
  if (!rows[0]) throw new StudyError(503, "storage_unavailable");
  return rows[0];
}

/** Read-only probe of all required tables; no provider/model call. */
export async function storageReady(): Promise<boolean> {
  if (!databaseConfigured()) return false;
  try {
    await Promise.all(["assignment_slots", "study_participants", "self_reports", "task_metrics", "chat_messages"]
      .map(table => database(`${table}?select=participant_id&limit=1`)));
    return true;
  } catch { return false; }
}
