import {
  BACKGROUND_BLOCKS, END_CHECK_BLOCKS, OEC1_BLOCK, experienceBlocks,
  proxyExperienceBlocks, taskOpenBlocks, OPEN_INSTRUMENT_VERSION, type Item,
} from "../measures";
import { getTask, reasonCards } from "../tasks";
import { codeOutcome } from "../negotiation/machine";
import { bonusAmountFromPercent } from "../bonus";
import { assignmentOf, database, StudyError, type ParticipantRow } from "./study-db";

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 20_000): string => {
  if (typeof value !== "string" || value.length > max) throw new StudyError(400, "invalid_record");
  return value;
};
const taskIndex = (value: unknown): 1 | 2 => {
  if (value !== 1 && value !== 2) throw new StudyError(400, "invalid_task");
  return value;
};
const timestamp = (value: unknown): string => {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed) || parsed > Date.now() + 60_000) throw new StudyError(400, "invalid_timestamp");
  return new Date(parsed).toISOString();
};

async function child(row: ParticipantRow, table: string, index: 1 | 2): Promise<Row> {
  return (await database<Row[]>(`${table}?participant_key=eq.${row.participant_key}&task_index=eq.${index}&limit=1`))[0] ?? {};
}
async function upsert(row: ParticipantRow, table: string, index: 1 | 2, values: Row): Promise<void> {
  await database(`${table}?on_conflict=participant_key,task_index`, "POST", {
    participant_key: row.participant_key, task_index: index, ...values,
  });
}
async function participantPatch(row: ParticipantRow, values: Row): Promise<void> {
  await database(`study_participants?participant_key=eq.${row.participant_key}`, "PATCH", values);
}

/** Whitelist instrument fields; malformed known values fail instead of silently vanishing. */
export function codedAnswers(answers: Row, items: Item[], suffix = ""): { coded: Row; clean: Row } {
  const coded: Row = {}, clean: Row = {};
  for (const item of items) {
    const key = `${item.id}${suffix}`;
    const value = answers[key];
    if (value === undefined) continue;
    if (value === null || value === "") { coded[item.id.toLowerCase()] = null; clean[key] = value; continue; }
    let normalized: unknown = value;
    if (item.kind === "scale") {
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > (item.points ?? 7)) {
        throw new StudyError(400, "invalid_scale");
      }
    } else if (item.kind === "choice" || item.kind === "select") {
      if (!item.options.some(option => option.value === value)) throw new StudyError(400, "invalid_choice");
    } else if (item.kind === "number") {
      normalized = Number(value);
      if (!Number.isFinite(normalized) || Number(normalized) < 0) throw new StudyError(400, "invalid_number");
    } else normalized = text(value);
    coded[item.id.toLowerCase()] = normalized;
    clean[key] = value;
  }
  for (const key of ["_submitted", "_completed", "_checks_submitted", "_instrument_version", "_submitted_parts"])
    if (["string", "number", "boolean"].includes(typeof answers[key])) clean[key] = answers[key];
  return { coded, clean };
}

function scalarFields(answers: Row, names: string[]): Row {
  return Object.fromEntries(names.filter(name => answers[name] !== undefined)
    .map(name => [name, answers[name]]));
}

async function saveResponses(row: ParticipantRow, block: string, answers: Row): Promise<void> {
  const operational = object(row.operational);
  if (block === "v226_background") {
    const { coded, clean } = codedAnswers(answers, BACKGROUND_BLOCKS.flatMap(b => b.items));
    await participantPatch(row, { ...coded, background_answers: { ...object(row.background_answers), ...clean },
      operational: { ...operational, background_submitted: Number(answers._submitted_parts) >= BACKGROUND_BLOCKS.length } });
    return;
  }
  if (block === "v226_wrap_up") {
    const { coded, clean } = codedAnswers(answers, [...END_CHECK_BLOCKS.flatMap(b => b.items), ...OEC1_BLOCK.items]);
    await participantPatch(row, { ...coded, open_answers: { ...object(row.open_answers), [block]: clean },
      operational: { ...operational, wrap_up_submitted: answers._completed === true } });
    return;
  }
  if (block === "debriefing") {
    if (typeof answers.acknowledged !== "boolean") throw new StudyError(400, "invalid_debriefing");
    await participantPatch(row, {
      open_answers: { ...object(row.open_answers), debriefing: {
        acknowledged: answers.acknowledged, comments: text(answers.comments ?? ""),
      } },
      operational: { ...operational, debriefing_acknowledged: answers.acknowledged },
    });
    return;
  }
  const match = /_t([12])$/.exec(block);
  if (!match) return; // Comprehension/practice and UI telemetry are deliberately not persisted.
  const index = taskIndex(Number(match[1]));
  const assignment = assignmentOf(row);
  const plan = assignment.sessions[index - 1];
  const isProxy = plan.condition !== "direct";
  if (block === `v226_post_task_scales_t${index}`) {
    const items = [...experienceBlocks(row.role, isProxy), ...(isProxy ? proxyExperienceBlocks(row.participant_key) : [])].flatMap(b => b.items);
    const { coded, clean } = codedAnswers(answers, items, `_t${index}`);
    const previous = await child(row, "self_reports", index);
    const order: Row = {};
    for (const key of ["pmp_responsibility_order", "pop_responsibility_order"]) {
      const value = answers[`_${key}`];
      if (value !== undefined) {
        if (!isProxy || !["human_first", "ai_first"].includes(String(value))) throw new StudyError(400, "invalid_order");
        order[key] = value; clean[`_${key}`] = value;
      }
    }
    await upsert(row, "self_reports", index, { ...coded, ...order, scales_submitted: answers._submitted === true,
      responses: { ...object(previous.responses), [block]: clean } });
    return;
  }
  if (block === `v226_task_decision_t${index}`) {
    const previous = await child(row, "self_reports", index);
    const clean: Row = scalarFields(answers, ["_submitted", "_instrument_version"]);
    const values: Row = {};
    if (row.role === "leader") {
      const percent = answers[`BR1_PERCENT_t${index}`];
      const confirmed = answers[`BR1_CONFIRMED_t${index}`];
      if (percent !== null && (typeof percent !== "number" || !Number.isInteger(percent) || percent < 0 || percent > 100)) throw new StudyError(400, "invalid_bonus");
      if (typeof confirmed !== "boolean") throw new StudyError(400, "invalid_bonus");
      values.br1_percent = percent;
      values.br1 = percent === null ? null : bonusAmountFromPercent(Number(percent));
      values.br1_confirmed = confirmed;
      Object.assign(clean, { [`BR1_PERCENT_t${index}`]: percent, [`BR1_t${index}`]: values.br1,
        [`BR1_CONFIRMED_t${index}`]: confirmed, [`BR1_METHOD_t${index}`]: "percentage_slider_to_gbp" });
    } else {
      const value = answers[`FE1_t${index}`];
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 7) throw new StudyError(400, "invalid_scale");
      values.fe1 = value; clean[`FE1_t${index}`] = value;
    }
    await upsert(row, "self_reports", index, { ...values, decision_submitted: answers._submitted === true,
      responses: { ...object(previous.responses), [block]: clean } });
    return;
  }
  if (block === `v226_task_open_t${index}`) {
    const previous = await child(row, "self_reports", index);
    const version = answers._instrument_version === OPEN_INSTRUMENT_VERSION ? OPEN_INSTRUMENT_VERSION : "2.27";
    if (previous.open_instrument_version === OPEN_INSTRUMENT_VERSION && version !== OPEN_INSTRUMENT_VERSION) {
      throw new StudyError(409, "instrument_version_conflict");
    }
    const { coded, clean } = codedAnswers(answers,
      taskOpenBlocks(isProxy, { role: row.role, taskIndex: index, version }).flatMap(b => b.items), `_t${index}`);
    await upsert(row, "self_reports", index, {
      ...coded, open_instrument_version: version, open_submitted: answers._completed === true,
      responses: { ...object(previous.responses), [block]: clean },
    });
    // Keep the historical comparison column available without rewriting any
    // operational flags from this request's earlier participant snapshot.
    if (index === 2 && version === OPEN_INSTRUMENT_VERSION && Object.hasOwn(coded, "oec1")) {
      await participantPatch(row, { oec1: coded.oec1 });
    }
    return;
  }
  if (!["preferences", "ratify", "negotiation", "task_outcome"].some(prefix => block === `${prefix}_t${index}`)) return;
  const previous = await child(row, "task_metrics", index);
  const values: Row = {};
  let clean: Row;
  if (block.startsWith("preferences_")) {
    const preferred = validPackage(plan.taskId, answers.preferred, true);
    values.initial_preferences = preferred; clean = { preferred, [`WISH-DEV_t${index}`]: answers[`WISH-DEV_t${index}`] === true };
  } else if (block.startsWith("ratify_")) {
    const ratify = answers[`RATIFY_t${index}`];
    if (!isProxy || !["approved_as_is", "modified", "rejected"].includes(String(ratify))) throw new StudyError(400, "invalid_ratification");
    values.ratify = ratify; clean = { [`RATIFY_t${index}`]: ratify };
  } else {
    clean = scalarFields(answers, ["phase", "tier", "sbFirstChoice", "sbTiming", "priorityClaimed", `SB_t${index}`, `SB-TIMING_t${index}`, "SB", "SB-TIMING", "RATIFY"]);
    const sb = answers.sbFirstChoice ?? answers[`SB_t${index}`] ?? answers.SB;
    const sbTiming = answers.sbTiming ?? answers[`SB-TIMING_t${index}`] ?? answers["SB-TIMING"];
    if (sb !== undefined) { if (typeof sb !== "boolean") throw new StudyError(400, "invalid_disclosure"); values.sb = sb; }
    if (sbTiming !== undefined) {
      if (!["first_chance", "later_turn", "wrap_up", "never"].includes(String(sbTiming))) throw new StudyError(400, "invalid_disclosure");
      values.sb_timing = sbTiming;
    }
    if (answers.tier !== undefined) {
      if (!["none", "work", "sensitive"].includes(String(answers.tier))) throw new StudyError(400, "invalid_tier");
      values.tier = answers.tier;
    }
    if (typeof answers.priorityClaimed === "boolean") values.priority_claimed = answers.priorityClaimed;
    // Scores and requirement preservation come from the validated saved agreement.
    if (block.startsWith("task_outcome_") && previous.agreement) values.status = "completed";
  }
  await upsert(row, "task_metrics", index, { ...values,
    response_blocks: { ...object(previous.response_blocks), [block]: clean } });
}

function validPackage(taskId: string, value: unknown, partial = false): Row {
  const task = getTask(taskId as "task_a" | "task_b")!;
  const supplied = object(value), result: Row = {};
  for (const issue of task.issues) {
    const option = supplied[issue.id];
    if (option === undefined && partial) continue;
    if (typeof option !== "string" || !issue.options.some(o => o.id === option)) throw new StudyError(400, "invalid_package");
    result[issue.id] = option;
  }
  return result;
}

async function saveAgreement(row: ParticipantRow, value: unknown) {
  const agreement = object(value), index = taskIndex(agreement.sessionIndex);
  const task = getTask(assignmentOf(row).sessions[index - 1].taskId)!;
  if (!Array.isArray(agreement.terms) || agreement.terms.length !== task.issues.length) throw new StudyError(400, "invalid_agreement");
  const terms = task.issues.map(issue => {
    const term = agreement.terms instanceof Array ? agreement.terms.find(t => object(t).issueId === issue.id) : null;
    const option = object(term).optionId;
    if (option !== null && !issue.options.some(o => o.id === option)) throw new StudyError(400, "invalid_agreement");
    return { issueId: issue.id, optionId: option, unresolved: option === null };
  });
  const unresolvedIssueIds = terms.filter(t => t.unresolved).map(t => t.issueId);
  const pkg = unresolvedIssueIds.length ? null : Object.fromEntries(terms.map(t => [t.issueId, t.optionId])) as Record<string, string>;
  const outcome = codeOutcome(task, row.role, pkg, Boolean(pkg));
  await upsert(row, "task_metrics", index, {
    agreement: { sessionIndex: index, terms, unresolvedIssueIds }, outcome,
    points: outcome.participantPoints, joint: outcome.jointPoints,
    own_requirement_preserved: outcome.requirementPreserved,
    their_requirement_preserved: codeOutcome(task, row.role === "leader" ? "member" : "leader", pkg, Boolean(pkg)).requirementPreserved,
  });
}

async function saveMandate(row: ParticipantRow, value: unknown) {
  const mandate = object(value), index = taskIndex(mandate.sessionIndex);
  const plan = assignmentOf(row).sessions[index - 1];
  if (plan.condition === "direct" || !Array.isArray(mandate.issues) || !Array.isArray(mandate.authorizedReasonIds)) throw new StudyError(400, "invalid_mandate");
  const task = getTask(plan.taskId)!;
  const pkg = validPackage(plan.taskId, Object.fromEntries(mandate.issues.map(raw => {
    const issue = object(raw); return [String(issue.issueId), issue.preferredOptionId];
  })));
  const allowed = new Set(reasonCards(task, row.role).map(c => c.id));
  if (!mandate.authorizedReasonIds.every(id => typeof id === "string" && allowed.has(id))) throw new StudyError(400, "invalid_mandate");
  await upsert(row, "task_metrics", index, { mandate: { sessionIndex: index,
    revisionCount: Number.isInteger(mandate.revisionCount) ? mandate.revisionCount : 0,
    issues: Object.entries(pkg).map(([issueId, preferredOptionId]) => ({ issueId, preferredOptionId })),
    authorizedReasonIds: mandate.authorizedReasonIds,
  } });
}

async function appendMessage(row: ParticipantRow, raw: unknown) {
  const message = object(raw), index = taskIndex(message.sessionIndex);
  const plan = assignmentOf(row).sessions[index - 1];
  const speaker = text(message.speaker, 30);
  if (!["participant", "counterpart", "participant_proxy", "counterpart_proxy", "counterpart_principal", "system"].includes(speaker)) throw new StudyError(400, "invalid_speaker");
  const proxy = speaker.endsWith("_proxy");
  if (proxy && plan.condition === "direct") throw new StudyError(400, "invalid_speaker");
  const id = text(message.id, 120);
  if (!/^[\w:.-]+$/.test(id)) throw new StudyError(400, "invalid_message_id");
  const values: Row = { participant_key: row.participant_key, task_index: index,
    message_id: id, turn_id: id, speaker, text: text(message.text),
    phase: proxy ? "proxy_exchange" : "human_negotiation", created_at: timestamp(message.createdAt),
  };
  if (message.stage !== undefined) {
    if (!Number.isInteger(message.stage) || Number(message.stage) < 1 || Number(message.stage) > 6) throw new StudyError(400, "invalid_stage");
    values.stage = message.stage;
  }
  if (message.proposal) values.proposal = validPackage(plan.taskId, message.proposal);
  if (message.reasonLabel !== undefined) {
    if (!["none", "WR", "SB"].includes(String(message.reasonLabel))) throw new StudyError(400, "invalid_reason");
    values.reason_label = message.reasonLabel;
  }
  if (message.reasonConfidence !== undefined) {
    if (typeof message.reasonConfidence !== "number" || message.reasonConfidence < 0 || message.reasonConfidence > 1) throw new StudyError(400, "invalid_confidence");
    values.reason_confidence = message.reasonConfidence;
  }
  if (typeof message.reasonPriorityClaim === "boolean") values.reason_priority_claim = message.reasonPriorityClaim;
  if (message.reasonCardId !== undefined) {
    const id = text(message.reasonCardId, 120);
    const task = getTask(plan.taskId)!;
    if (![...reasonCards(task, "leader"), ...reasonCards(task, "member")].some(card => card.id === id)) throw new StudyError(400, "invalid_reason");
    values.reason_card_id = id;
  }
  if (message.internalProvenance !== undefined) {
    if (!["principal_reason", "principal_reason_with_ai_work_benefits"].includes(String(message.internalProvenance))) throw new StudyError(400, "invalid_provenance");
    values.internal_provenance = message.internalProvenance;
  }
  if (message.decidedAction !== undefined) values.decided_action = text(message.decidedAction, 120);
  if (proxy) {
    // Proxy reasons are schedule facts; restore their label without guessing
    // from natural-language text or promoting added work benefits to SB.
    const metrics = await child(row, "task_metrics", index);
    const mandate = object(metrics.mandate);
    const ownSb = reasonCards(getTask(plan.taskId)!, row.role).find(c => c.layer === "sensitive");
    const authorized = Array.isArray(mandate.authorizedReasonIds) && mandate.authorizedReasonIds.includes(ownSb?.id);
    if (values.reason_label === "SB" && !authorized) throw new StudyError(400, "unauthorized_reason");
    // Missing or blocked disclosure metadata stays missing. Authorization alone
    // never proves that a reason was actually displayed.
  }
  await database("chat_messages?on_conflict=participant_key,task_index,message_id", "POST", values);
}

async function logEvent(row: ParticipantRow, raw: unknown) {
  const event = object(raw), payload = object(event.payload);
  if (event.type === "study_completed") return; // Only the authoritative finalizer completes.
  if (event.type === "negotiation_ended" && (payload.technicalFailure === true || payload.phase === "withdrawal")) {
    if (event.sessionIndex === 1 || event.sessionIndex === 2) await upsert(row, "task_metrics", event.sessionIndex, { status: "interrupted" });
    await participantPatch(row, { status: "stopped", operational: { ...object(row.operational),
      stop_reason: payload.phase === "withdrawal" ? "withdrawal" : "technical" } });
    return;
  }
  if (!["negotiation_started", "negotiation_ended"].includes(String(event.type))) return;
  if (payload.phase === "task_closed") return;
  const index = taskIndex(event.sessionIndex);
  const previous = await child(row, "task_metrics", index);
  const at = timestamp(event.clientTimestamp);
  const proxy = payload.phase === "proxy" || (payload.phase === undefined && assignmentOf(row).sessions[index - 1].condition !== "direct");
  const phase = proxy ? "proxy" : "human";
  const values: Row = event.type === "negotiation_started"
    ? { started_at: previous.started_at ?? at, [`${phase}_started_at`]: previous[`${phase}_started_at`] ?? at,
        status: previous.status === "completed" ? "completed" : "active" }
    : { ended_at: at, [`${phase}_ended_at`]: at };
  const combined = { ...previous, ...values };
  for (const name of ["human", "proxy"]) {
    const start = combined[`${name}_started_at`], end = combined[`${name}_ended_at`];
    if (typeof start === "string" && typeof end === "string") values[`${name}_duration_ms`] = Math.max(0, Date.parse(end) - Date.parse(start));
  }
  values.duration_ms = Number(values.human_duration_ms ?? previous.human_duration_ms ?? 0)
    + Number(values.proxy_duration_ms ?? previous.proxy_duration_ms ?? 0);
  await upsert(row, "task_metrics", index, values);
}

/** The cookie, never a payload participantKey, selects every row. */
export async function persistOperation(row: ParticipantRow, op: string, raw: unknown): Promise<unknown> {
  const payload = object(raw);
  if (op === "loadAssignment") return assignmentOf(row);
  if (op === "createParticipant") {
    await participantPatch(row, { operational: { ...object(row.operational), consented: true } });
    return null;
  }
  if (op === "saveAssignment") return null; // Assignment is immutable and already saved by claim RPC.
  if (op === "logGuardrailEvent") return null; // No durable click/practice/guardrail event tables.
  if (!object(row.operational).consented) {
    if (op === "logEvent") return null;
    throw new StudyError(409, "consent_required");
  }
  if (op === "saveResponses") { await saveResponses(row, text(payload.block, 100), object(payload.responses)); return null; }
  if (op === "saveMandate") { await saveMandate(row, payload.mandate); return null; }
  if (op === "saveAgreement") { await saveAgreement(row, payload.agreement); return null; }
  if (op === "appendMessage") { await appendMessage(row, payload.message); return null; }
  if (op === "logEvent") { await logEvent(row, raw); return null; }
  if (op === "loadResponses") {
    const block = text(payload.block, 100);
    if (block === "v226_background") return row.background_answers ?? null;
    if (!/^v226_task_open_t[12]$/.test(block) && Object.hasOwn(object(row.open_answers), block)) return object(row.open_answers)[block];
    const match = /_t([12])$/.exec(block);
    if (!match) return null;
    const index = taskIndex(Number(match[1]));
    const table = /^v226_(post_task_scales|task_decision|task_open)_/.test(block) ? "self_reports" : "task_metrics";
    const saved = await child(row, table, index);
    return object(saved[table === "self_reports" ? "responses" : "response_blocks"])[block] ?? null;
  }
  if (op === "loadMandate" || op === "loadAgreement") {
    const saved = await child(row, "task_metrics", taskIndex(payload.sessionIndex));
    return saved[op === "loadMandate" ? "mandate" : "agreement"] ?? null;
  }
  if (op === "loadMessages") {
    const index = taskIndex(payload.sessionIndex);
    const messages = await database<Row[]>(`chat_messages?participant_key=eq.${row.participant_key}&task_index=eq.${index}&order=created_at.asc,message_id.asc`);
    return messages.map(m => ({ id: m.message_id, sessionIndex: index, speaker: m.speaker, text: m.text,
      createdAt: m.created_at, ...(m.stage ? { stage: m.stage } : {}), ...(m.proposal ? { proposal: m.proposal } : {}),
      ...(m.reason_label ? { reasonLabel: m.reason_label } : {}) }));
  }
  throw new StudyError(400, "unknown_operation");
}
