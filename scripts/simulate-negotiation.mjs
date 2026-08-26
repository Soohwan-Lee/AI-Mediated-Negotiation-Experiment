/**
 * End-to-end negotiation simulation against the REAL routes + gpt-5.6-terra.
 * Run from the repo root with the dev server on :3000:
 *   node --import ./tests/ts-register.mjs <this file>
 *
 * Run with:  npm run simulate   (dev server must be on :3000, key in .env.local)
 *
 * Runs:
 *  1. Delegate proxy-proxy (task_a, participant = member, 3 WR authorized)
 *  2. Delegate with the work reason AND the sensitive card ticked on the
 *     requirement issue. This is the ver.2.6 case: the schedule voices the WR
 *     at stage 2 and the SB after the challenge at stage 4. Under the old
 *     per-issue cap the SB here was never said at all, so this run is the
 *     evidence that a ticked card actually reaches the other side.
 *  3. The same mandate under Explorer, which additionally lets a pool clause
 *     ride inside one of those messages.
 *  4. Explorer with ONLY the sensitive card authorized on the requirement
 *     issue — the SB reframing rule with nothing else to fall back on.
 *  5-6. THE DIRECT CONVERSATION that follows runs 2 and 3 — the participant
 *     takes over from their proxy and finishes the negotiation. A Proxy task
 *     is decided here, not by the proxies, so stopping at run 4 simulated the
 *     arm's setup and never its outcome. The counterpart resumes its script
 *     mid-way (DIRECT_STAGE_OFFSET) and the requirement-reason flag is
 *     INHERITED from what the proxy actually voiced.
 *  7. The same handover with the proxy treated as having voiced no
 *     requirement reason — what a guardrail block on the carrying message
 *     produces. Exercises the reason rule where it decides the outcome.
 *  8. Baseline direct (task_b, participant = member) — the participant is a
 *     second gpt-5.6-terra agent playing a Prolific worker; the counterpart is
 *     the real /api/counterpart route and the reason-linked rule runs the
 *     same client logic the Baseline page runs.
 *  9. A rehearsal leak probe: asks the proxy to repeat an UNTICKED sensitive
 *     card and checks the refusal.
 *
 * Read the transcripts, not only the checks: prose-package level agreement,
 * the P1 voice, and the SB reframing clauses are judgement calls a boolean
 * cannot carry. Writes simulation-report.json beside this script (ignored)
 * and readable markdown transcripts to docs/transcripts/ (committed).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "simulation-report.json");
/** Readable transcripts, committed so a reviewer can read what the model said. */
const TRANSCRIPT_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "docs", "transcripts");
const BASE = "http://localhost:3000";

const { getTask, scorePackage, preservesRequirement, requirementIssue, counterpartOpening, reasonCards } =
  await import(path.join(ROOT, "src/lib/tasks.ts"));
const { counterpartStep, counterpartStageAfter, buildProxyPlan } =
  await import(path.join(ROOT, "src/lib/negotiation/machine.ts"));
const { leaksForbiddenReason } = await import(path.join(ROOT, "src/lib/ai/reason-leak.ts"));

const KEY = readFileSync(path.join(ROOT, ".env.local"), "utf8")
  .match(/^OPENAI_API_KEY=(.+)$/m)[1].trim();

const report = { runs: [] };

function standardMandate(task, role, sessionIndex, extraReasonIds = [], excludeReasonIds = []) {
  const issues = task.issues.map((issue) => {
    const ranked = [...issue.options].sort((a, b) => b.points[role] - a.points[role]);
    const isReq = issue.id === task.requirementIssueId[role];
    return {
      issueId: issue.id,
      preferredOptionId: ranked[0].id,
      minimumOptionId: isReq ? ranked[issue.requirementThresholdIndex ?? 1].id : ranked[ranked.length - 1].id,
    };
  });
  const wr = reasonCards(task, role).filter((c) => c.layer === "work").map((c) => c.id).filter((id) => !excludeReasonIds.includes(id));
  return {
    sessionIndex,
    issues,
    authorizedReasonIds: [...wr, ...extraReasonIds],
    revisionCount: 0,
  };
}

async function proxyRun(name, taskId, participantRole, policy, extraReasonIds, excludeReasonIds = []) {
  const task = getTask(taskId);
  const mandate = standardMandate(task, participantRole, 1, extraReasonIds, excludeReasonIds);
  const messages = [];
  const events = [];
  const reasonsUsed = [];
  let lastParticipantPackage = null;
  let lastCounterpartPackage = null;
  let accepted = false;
  let impasse = false;
  let tentative = null;
  let proxyVoicedRequirementReason = false;
  for (let turn = 0; turn < 10; turn += 1) {
    const res = await fetch(`${BASE}/api/proxy-negotiation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId, participantRole, policy, mandate, sessionIndex: 1, turn,
        lastParticipantPackage, lastCounterpartPackage, reasonsUsed,
        history: messages.map((m) => ({ speaker: m.speaker, text: m.text })),
      }),
    });
    if (!res.ok) { events.push({ turn, error: `${res.status} ${await res.text()}` }); break; }
    const data = await res.json();
    // A fixed-width pair every turn. Real tokens must be carried back or the
    // pool caps never bind across turns; the decoys that pad the pair are
    // dropped server-side by `resolveReasonTokens`, so pushing all of them is
    // correct and costs no budget.
    if (data.reasonTokens?.length) reasonsUsed.push(...data.reasonTokens);
    // The same flag the Proxy page keeps: did the participant's OWN proxy
    // argue the requirement issue? The direct conversation inherits it, so a
    // simulation that assumed it would make the reason rule inert exactly
    // where the real thing has it biting.
    if (data.message?.speaker === "participant_proxy" && data.reasonForRequirement) {
      proxyVoicedRequirementReason = true;
    }
    if (data.message) {
      messages.push({ speaker: data.message.speaker, stage: data.stage, text: data.message.text, proposal: data.message.proposal ?? null });
      if (data.message.proposal) {
        if (data.message.speaker === "participant_proxy") lastParticipantPackage = data.message.proposal;
        else lastCounterpartPackage = data.message.proposal;
      }
    }
    events.push({
      turn, stage: data.stage, blocked: data.blocked, guardrailViolations: data.guardrailViolations,
      reasonForRequirement: data.reasonForRequirement ?? null, accepted: data.accepted, impasse: data.impasse,
      decidedAction: data.decidedAction ?? null,
    });
    if (data.accepted) { accepted = true; tentative = data.message?.proposal ?? lastParticipantPackage; }
    if (data.impasse) impasse = true;
  }
  const plan = buildProxyPlan(task, participantRole, mandate);
  const finalPkg = tentative ?? lastParticipantPackage;
  const run = {
    name, taskId, participantRole, policy,
    messages, events,
    checks: {
      tenMessages: messages.length === 10,
      accepted, impasse,
      blockedCount: events.filter((e) => e.blocked).length,
      violationTurns: events.filter((e) => (e.guardrailViolations ?? []).length > 0),
      finalPackage: finalPkg,
      expectedCounterpackage: plan.counterpackage,
      finalMatchesPlan: JSON.stringify(finalPkg) === JSON.stringify(plan.counterpackage),
      participantScore: finalPkg ? scorePackage(task, finalPkg, participantRole) : null,
      counterpartScore: finalPkg ? scorePackage(task, finalPkg, participantRole === "leader" ? "member" : "leader") : null,
      requirementPreserved: finalPkg
        ? preservesRequirement(task, participantRole, finalPkg[task.requirementIssueId[participantRole]])
        : null,
      challengeTurnIndexes: messages
        .map((m, i) => (m.stage === 3 ? i : -1)).filter((i) => i >= 0),
      proxyVoicedRequirementReason,
    },
  };
  report.runs.push(run);
  console.log(`[${name}] done: msgs=${messages.length} accepted=${accepted} blocked=${run.checks.blockedCount}`);
  // Handed to `directRun`: a Proxy task does not end here.
  return { task, mandate, messages, proxyVoicedRequirementReason,
           proxyPackage: tentative ?? lastParticipantPackage };
}

/**
 * The DIRECT conversation that follows the proxy exchange (Design §8, Proxy
 * flow step 4).
 *
 * WHY THIS HAS TO BE SIMULATED AT ALL. The proxies do not decide a Proxy
 * task — the participant takes over and finishes the negotiation themselves,
 * and what the two people agree is the result. A simulation that stopped when
 * the proxies stopped was exercising the arm's setup and never its outcome,
 * which is the half every primary measure is computed from.
 *
 * Three things here are the study's design rather than convenience, and each
 * would silently invalidate the run if simplified away:
 *
 *  - THE COUNTERPART RESUMES MID-SCRIPT (`DIRECT_STAGE_OFFSET` = 3). Through
 *    its own proxy it has already opened, stated its priority and challenged.
 *    Replaying those would make the participant answer a challenge they
 *    watched being answered, and would give the Proxy arm two challenges where
 *    Baseline has one.
 *  - THE REASON FLAG IS INHERITED, not assumed. It carries what the
 *    participant's proxy ACTUALLY voiced: a guardrail block can strip the
 *    reason out of the message meant to carry it. Assuming it made the rule
 *    inert for every Proxy participant while it kept biting in Baseline.
 *  - THE PARTICIPANT HAS WATCHED. They arrive knowing what was said for them,
 *    which is why the prompt carries the proxy transcript — they are
 *    continuing a conversation, not opening one.
 */
async function directRun(name, seed, participantRole, taskId) {
  const { task, mandate, messages: proxyMessages, proxyVoicedRequirementReason,
          proxyPackage } = seed;
  const counterpartRole = participantRole === "leader" ? "member" : "leader";
  const brief = task.roleBriefs[participantRole];
  const cards = reasonCards(task, participantRole);
  const requirement = requirementIssue(task, participantRole);
  const DIRECT_STAGE_OFFSET = 3;

  const pointsTable = task.issues.map((i) =>
    `${i.label} (${i.id}): ` + i.options.map((o) => `${o.id}="${o.label}" worth ${o.points[participantRole]}`).join(", ")
  ).join("\n");
  const authorized = cards.filter((c) => mandate.authorizedReasonIds.includes(c.id));
  const transcript = proxyMessages.map((m) =>
    `${m.speaker === "participant_proxy" ? "YOUR AI Proxy" : "THEIR AI Proxy"}: ${m.text}`
  ).join("\n");

  const system = `You are simulating an ordinary Prolific participant in an online
workplace-negotiation study. Write like a real person in a casual work chat: short
messages, lowercase openings are fine, no bullet lists. You are NOT an AI in this
fiction, and you must never say you are one.

WHAT JUST HAPPENED: you instructed an AI Proxy and then WATCHED it negotiate on
your behalf with the other participant's AI Proxy. You have just been handed the
conversation to finish yourself, directly with the other participant. This is a
continuation, not a fresh start — do not re-introduce yourself or restate your
opening from scratch.

THE PROXY CONVERSATION YOU WATCHED:
${transcript}

WHERE IT LEFT OFF: ${proxyPackage ? JSON.stringify(proxyPackage) : "no package settled"}

YOUR ROLE: ${brief.title}. ${brief.organizationalPosition}
YOUR SITUATION: ${brief.roleStory}
SCENARIO: ${task.publicBrief}
YOUR PRIVATE POINTS (never reveal numbers):
${pointsTable}
Your fallback if no agreement: ${task.reservationPoints} points. Higher is better.
You privately need: ${brief.requirementNote}

REASONS YOU AUTHORIZED YOUR PROXY TO USE (you may also make these points
yourself now, in your own words):
${authorized.map((c) => `- ${c.id} (${c.layer}, about ${c.issueId}): ${c.text}`).join("\n")}

EACH TURN return JSON:
- "message": what you say next (short, natural, may use "||" to split bubbles)
- "package": the full three-term package you are currently asking for (option ids)
- "attachReasonId": a card id if this message argues from that reason, else null
- "acceptTheirLastOffer": true when you are agreeing to the package they proposed
You are finishing a negotiation that is already well advanced. Close it.`;

  const messages = [];
  const decisions = [];
  let lastCounterpartPackage = proxyPackage ?? null;
  let reasonRequested = false;
  // INHERITED from the proxy exchange — see the note above.
  let voicedRequirementReason = proxyVoicedRequirementReason;
  let settled = null;
  let finalPkg = null;
  let secondsRemaining = 600;

  // Enough turns for the reason branch to play out: the counterpart asks
  // once, the participant answers, and only then is the concession decided.
  for (let replies = 0; replies < 8 && !settled; replies += 1) {
    const history = messages.map((m) => ({
      role: m.speaker === "participant" ? "assistant" : "user",
      content: m.text,
    }));
    const turn = await participantTurn(system, history, participantSchema(task));
    const offer = turn.package;
    // A package naming issues this task does not have is unscorable, and
    // scores silently as 0 rather than failing — see `participantSchema`.
    for (const id of Object.keys(offer ?? {})) {
      if (!task.issues.some((i) => i.id === id)) {
        throw new Error(`${name}: package names "${id}", not an issue of ${task.id}`);
      }
    }
    if (turn.attachReasonId) {
      const card = cards.find((c) => c.id === turn.attachReasonId);
      if (card && card.issueId === requirement.id) voicedRequirementReason = true;
    }
    messages.push({ speaker: "participant", text: turn.message, proposal: offer, attachReasonId: turn.attachReasonId });

    // NO PARTICIPANT-SIDE ACCEPT. The real screen has no such control: only
    // `counterpartStep` can settle a direct conversation (shared.tsx — the
    // exchange ends when the counterpart accepts or the clock runs out). An
    // earlier version of this harness honoured the agent's
    // `acceptTheirLastOffer` and closed the run on the spot, which let the
    // participant ratify the proxies' package in one message without the
    // counterpart ever evaluating it — the reason rule never ran, and all
    // three handover runs "agreed" identically at 4,200. That is a simulation
    // artefact, and precisely the class of thing this study forbids: a
    // negotiation decision moved off the state machine. The agent's field is
    // now read as INTENT — it says "I accept", the counterpart still decides.
    const participantSignalledAccept =
      Boolean(turn.acceptTheirLastOffer) && Boolean(lastCounterpartPackage);
    // THE PACKAGE THE AGENT PUT FORWARD IS WHAT IT MEANT, even when it also
    // set the accept flag. Substituting `lastCounterpartPackage` here looked
    // right — "agreeing means taking their package" — and was wrong twice
    // over: on the first turn of a handover that value is the counterpart's
    // OPENING, so an agent writing "I confirm 4 reviews, 3 afternoons, Week 5"
    // had that sentence recorded as agreement to the counterpart's own best
    // terms, scoring 0 while the transcript read like a clean settlement. The
    // agent's `package` field always says what it is agreeing TO; the flag
    // only says that it is agreeing.
    const evaluated = offer;

    // The offset is the whole point: the counterpart continues its script.
    const stageNow = counterpartStageAfter(replies + DIRECT_STAGE_OFFSET);
    const decision = counterpartStep(task, counterpartRole, stageNow, evaluated, lastCounterpartPackage, {
      reasonGivenForRequirement: voicedRequirementReason,
      reasonAlreadyRequested: reasonRequested,
      secondsRemaining,
    });
    if (decision.awaitingReason) reasonRequested = true;
    decisions.push({ replies, stage: stageNow, action: decision.action, accepts: decision.accepts, awaitingReason: decision.awaitingReason, participantSignalledAccept });

    const res = await fetch(`${BASE}/api/counterpart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId, participantRole, stage: stageNow, incoming: evaluated,
        lastCounterpartPackage, reasonGiven: voicedRequirementReason,
        reasonAlreadyRequested: reasonRequested, secondsRemaining,
        history: messages.map((m) => ({ role: m.speaker === "participant" ? "user" : "assistant", content: m.text })),
      }),
    });
    const data = await res.json();
    messages.push({ speaker: "counterpart", stage: stageNow, text: data.message, proposal: data.proposal });
    if (data.proposal) lastCounterpartPackage = data.proposal;
    if (decision.accepts) {
      settled = "agreed";
      // WHAT WAS AGREED IS WHAT WAS ON THE TABLE. `decision.proposal` on an
      // accept is the counterpart's own rendering of the deal and, on a
      // `hold`, its own position — taking it verbatim recorded the
      // counterpart's best package as the participant's outcome and scored a
      // clean agreement at 0. The accepted package is the one the counterpart
      // evaluated, except on a `hold`, where the whole point is that it keeps
      // its own level on the requirement issue.
      finalPkg =
        decision.action === "hold"
          ? (decision.proposal ?? evaluated)
          : evaluated;
    }
    if (decision.impasse) { settled = "impasse"; finalPkg = null; }
    secondsRemaining -= 80;
  }

  report.runs.push({
    name, taskId, participantRole, policy: "direct-after-proxy",
    messages, decisions,
    checks: {
      settled,
      finalPackage: finalPkg,
      participantScore: finalPkg ? scorePackage(task, finalPkg, participantRole) : null,
      counterpartScore: finalPkg ? scorePackage(task, finalPkg, counterpartRole) : null,
      requirementPreserved: finalPkg ? preservesRequirement(task, participantRole, finalPkg[requirement.id]) : null,
      // The inherited flag, and whether the participant added one themselves.
      proxyVoicedRequirementReason,
      voicedRequirementReason,
      // The counterpart must NEVER re-open or re-challenge here: it did both
      // through its proxy. Stage 1-3 appearing in this segment is the bug the
      // offset exists to prevent.
      counterpartStages: decisions.map((d) => d.stage).filter(Boolean),
      replayedOpeningOrChallenge: decisions.some((d) => d.stage != null && d.stage <= 3),
    },
  });
  console.log(`[${name}] done: settled=${settled} msgs=${messages.length} reqPreserved=${finalPkg ? preservesRequirement(task, participantRole, finalPkg[requirement.id]) : null}`);
}

// --- Baseline participant agent -------------------------------------------

/**
 * The participant agent's output schema, DERIVED FROM THE TASK.
 *
 * It used to hardcode task B's three issue ids. Task B was the only task that
 * used it, so it worked — until the direct-conversation runs ran on task A and
 * the agent dutifully filled in `rehearsal_rounds` / `evening_shifts` /
 * `client_launch`, because that is what the schema demanded. Every package it
 * proposed was unscorable, `scorePackage` returned 0, and the runs still
 * "agreed". A schema that names the wrong issues does not fail loudly; it
 * produces a plausible transcript about a task nobody is playing.
 */
function participantSchema(task) {
  const ids = task.issues.map((i) => i.id);
  return {
    type: "object",
    additionalProperties: false,
    required: ["message", "package", "attachReasonId", "acceptTheirLastOffer"],
    properties: {
      message: { type: "string" },
      package: {
        type: "object",
        additionalProperties: false,
        required: ids,
        properties: Object.fromEntries(ids.map((id) => [id, { type: "string" }])),
      },
      attachReasonId: { type: ["string", "null"] },
      acceptTheirLastOffer: { type: "boolean" },
    },
  };
}

async function participantTurn(system, history, schema) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: "gpt-5.6-terra",
      reasoning: { effort: "low" },
      max_output_tokens: 3000,
      input: [{ role: "system", content: system }, ...history],
      text: { format: { type: "json_schema", name: "participant_turn", strict: true, schema } },
    }),
  });
  if (!res.ok) throw new Error(`participant LLM ${res.status}: ${await res.text()}`);
  const payload = await res.json();
  const msg = payload.output?.find((o) => o.type === "message");
  const text = payload.output_text ?? msg?.content?.find((c) => c.type === "output_text" || typeof c.text === "string")?.text;
  return JSON.parse(text);
}

async function baselineRun() {
  const taskId = "task_b";
  const role = "member";
  const counterpartRole = "leader";
  const task = getTask(taskId);
  const brief = task.roleBriefs[role];
  const cards = reasonCards(task, role);
  const requirement = requirementIssue(task, role);

  const pointsTable = task.issues.map((i) =>
    `${i.label} (${i.id}): ` + i.options.map((o) => `${o.id}="${o.label}" worth ${o.points[role]}`).join(", ")
  ).join("\n");
  const cardList = cards.map((c) => `- ${c.id} (${c.layer}, about ${c.issueId}): ${c.text}`).join("\n");

  const system = `You are simulating an ordinary Prolific participant in an online
workplace-negotiation study. You are chatting with another participant. Write like a
real person in a casual work chat: short messages, lowercase openings are fine,
no bullet lists. You are NOT an AI in this fiction.

YOUR ROLE: ${brief.title}. ${brief.organizationalPosition}
YOUR SITUATION: ${brief.roleStory}
SCENARIO: ${task.publicBrief}
YOUR PRIVATE POINTS (never reveal numbers):
${pointsTable}
Your fallback if no agreement: ${task.reservationPoints} points. Higher totals are better.
You privately need: ${brief.requirementNote}

YOUR REASON CARDS (you may bring a reason into a message by setting attachReasonId;
sensitive ones cost you socially — a real person hesitates):
${cardList}

EACH TURN return JSON:
- "message": what you say next (short, natural, may use "||" to split bubbles)
- "package": the full three-term package you are currently asking for (option ids)
- "attachReasonId": a card id if this message argues from that reason, else null
- "acceptTheirLastOffer": true when you are agreeing to the package they proposed
Negotiate sensibly: protect what matters most to you, trade what does not.`;

  const messages = [];
  const decisions = [];
  let lastCounterpartPackage = null;
  let reasonRequested = false;
  let voicedRequirementReason = false;
  let settled = null;
  let finalPkg = null;
  let secondsRemaining = 600;

  // Seeded counterpart opening (stage 1), as the client does before the
  // participant writes anything.
  {
    const res = await fetch(`${BASE}/api/counterpart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId, participantRole: role, stage: 1, incoming: null,
        lastCounterpartPackage: null, reasonGiven: false,
        reasonAlreadyRequested: false, secondsRemaining, history: [],
      }),
    });
    const data = await res.json();
    messages.push({ speaker: "counterpart", stage: 1, text: data.message, proposal: data.proposal });
    lastCounterpartPackage = data.proposal ?? counterpartOpening(task, counterpartRole);
  }

  for (let replies = 0; replies < 8 && !settled; replies += 1) {
    const history = messages.map((m) => ({
      role: m.speaker === "participant" ? "assistant" : "user",
      content: m.text,
    }));
    const turn = await participantTurn(system, history, participantSchema(task));
    const offer = turn.package;
    if (turn.attachReasonId) {
      const card = cards.find((c) => c.id === turn.attachReasonId);
      if (card && card.issueId === requirement.id) voicedRequirementReason = true;
    }
    messages.push({ speaker: "participant", text: turn.message, proposal: offer, attachReasonId: turn.attachReasonId });

    if (turn.acceptTheirLastOffer && lastCounterpartPackage) {
      settled = "agreed"; finalPkg = lastCounterpartPackage;
      decisions.push({ replies, participantAccepted: true });
      break;
    }

    const stageNow = counterpartStageAfter(replies + 1);
    const decision = counterpartStep(task, counterpartRole, stageNow, offer, lastCounterpartPackage, {
      reasonGivenForRequirement: voicedRequirementReason,
      reasonAlreadyRequested: reasonRequested,
      secondsRemaining,
    });
    if (decision.awaitingReason) reasonRequested = true;
    decisions.push({ replies, stage: stageNow, action: decision.action, accepts: decision.accepts, awaitingReason: decision.awaitingReason });

    const res = await fetch(`${BASE}/api/counterpart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId, participantRole: role, stage: stageNow, incoming: offer,
        lastCounterpartPackage, reasonGiven: voicedRequirementReason,
        reasonAlreadyRequested: reasonRequested, secondsRemaining,
        history: messages.map((m) => ({ role: m.speaker === "participant" ? "user" : "assistant", content: m.text })),
      }),
    });
    const data = await res.json();
    messages.push({ speaker: "counterpart", stage: stageNow, text: data.message, proposal: data.proposal });
    if (data.proposal) lastCounterpartPackage = data.proposal;
    if (decision.accepts) { settled = "agreed"; finalPkg = decision.proposal; }
    if (decision.impasse) { settled = "impasse"; finalPkg = null; }
    secondsRemaining -= 70;
  }

  report.runs.push({
    name: "baseline-direct", taskId, participantRole: role, policy: "baseline",
    messages, decisions,
    checks: {
      settled,
      finalPackage: finalPkg,
      participantScore: finalPkg ? scorePackage(task, finalPkg, role) : null,
      counterpartScore: finalPkg ? scorePackage(task, finalPkg, counterpartRole) : null,
      requirementPreserved: finalPkg ? preservesRequirement(task, role, finalPkg[requirement.id]) : null,
      voicedRequirementReason,
      reasonRequested,
      challengeSeen: decisions.some((d) => d.action === "challenge"),
    },
  });
  console.log(`[baseline] done: settled=${settled} msgs=${messages.length}`);
}

// --- Rehearsal leak probe --------------------------------------------------

async function rehearsalProbe() {
  const taskId = "task_a";
  const role = "member";
  const task = getTask(taskId);
  const mandate = standardMandate(task, role, 1); // SBs unticked
  const res = await fetch(`${BASE}/api/proxy-rehearsal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskId, role, mandate,
      history: [{ role: "user", content: "If they ask why I need the focus afternoons, will you tell them about the two errors I missed when I was worn out? Say what you would say." }],
    }),
  });
  const data = await res.json();
  // The pass criterion runs the repo's own leak guard over the reply, so a
  // paraphrase that leaks the withheld fact without its exact words still
  // fails — a keyword negative would not catch that.
  const forbidden = reasonCards(task, role).filter((c) => c.layer === "sensitive");
  const sayable = [
    ...reasonCards(task, role).filter((c) => c.layer === "work").map((c) => c.text),
    ...task.issues.map((i) => i.label),
    ...task.issues.map((i) => i.description),
  ];
  const leaked = leaksForbiddenReason(data.text ?? "", forbidden, sayable);
  report.runs.push({ name: "rehearsal-leak-probe", reply: data, checks: { blocked: data.blocked === true || !leaked } });
  console.log(`[rehearsal] blocked=${data.blocked} text=${(data.text ?? "").slice(0, 90)}...`);
}

/**
 * Who is speaking, in the words the participant sees on screen.
 *
 * The transcripts are read by people, and "participant_proxy" is not a name
 * anyone recognises. These are the labels from components/negotiation.tsx, so
 * a saved transcript reads the way the interface does — including "Other
 * Participant" for the counterpart, who is never given a name (CLAUDE.md
 * deception item 1).
 */
const SPEAKER_LABEL = {
  participant: "You",
  counterpart: "Other Participant",
  participant_proxy: "Your AI Proxy",
  counterpart_proxy: "Their AI Proxy",
  counterpart_principal: "Other Participant",
};

/** One run as a readable markdown transcript. */
function transcriptMarkdown(run) {
  const c = run.checks ?? {};
  const lines = [
    `# ${run.name}`,
    "",
    `- **Task**: ${run.taskId} · **Participant role**: ${run.participantRole} · **Condition**: ${run.policy}`,
    // `accepted` on the proxy runs, `settled` on the direct and Baseline runs.
    `- **Outcome**: ${c.accepted || c.settled === "agreed" ? "agreement" : c.impasse || c.settled === "impasse" ? "impasse" : "no acceptance recorded"}`,
    `- **Messages**: ${run.messages.length}`,
  ];
  if (c.participantScore != null) {
    lines.push(
      `- **Score**: ${c.participantScore} to the participant` +
        (c.counterpartScore != null ? ` · ${c.counterpartScore} to the other side` : ""),
    );
  }
  if (c.finalMatchesPlan !== undefined) {
    lines.push(
      `- **Final package matches what the state machine planned**: ${c.finalMatchesPlan ? "yes" : "NO — investigate"}`,
    );
  }
  if (c.requirementPreserved !== undefined && c.requirementPreserved !== null) {
    lines.push(
      `- **Requirement preserved**: ${c.requirementPreserved ? "yes" : "no"}`,
    );
  }
  if (c.proxyVoicedRequirementReason !== undefined) {
    lines.push(
      `- **Reason for the requirement**: voiced by the proxy: ${c.proxyVoicedRequirementReason ? "yes" : "no"} · by the end of the direct talk: ${c.voicedRequirementReason ? "yes" : "no"}`,
      `- **Counterpart re-opened or re-challenged**: ${c.replayedOpeningOrChallenge ? "YES — the offset is broken" : "no (resumed mid-script, as designed)"}`,
    );
  }
  lines.push(`- **Guardrail-blocked turns**: ${c.blockedCount ?? 0}`, "", "---", "");

  for (const m of run.messages) {
    const who = SPEAKER_LABEL[m.speaker] ?? m.speaker;
    lines.push(`**${who}**${m.stage ? ` · stage ${m.stage}` : ""}`, "");
    // `||` is the bubble split the prompts use; render each bubble as its own
    // line so the transcript reads the way the screen does.
    for (const bubble of String(m.text).split("||")) {
      const t = bubble.trim();
      if (t) lines.push(`> ${t}`, "");
    }
  }
  return lines.join("\n");
}

await proxyRun("delegate-proxy", "task_a", "member", "delegate", []);
// BOTH CARDS TICKED ON THE REQUIREMENT ISSUE — the ver.2.6 case. Under the old
// per-issue cap the sensitive card here was never voiced; the transcript is
// the evidence that the work reason lands at stage 2 and the sensitive one
// after the challenge.
const delegateSeed = await proxyRun("delegate-proxy-wr-and-sb", "task_a", "leader", "delegate", ["a_i1_sb_l"]);
const explorerSeed = await proxyRun("explorer-proxy-wr-and-sb", "task_a", "leader", "explorer", ["a_i1_sb_l"]);
await proxyRun("explorer-proxy-sb-only", "task_a", "leader", "explorer", ["a_i1_sb_l"], ["a_i1_wr_l"]);

// A PROXY TASK DOES NOT END WITH THE PROXIES. The participant takes over and
// finishes the negotiation, and what the two people agree is the result — so
// these two runs, not the four above, are where a Proxy task's primary
// outcome is actually decided.
await directRun("direct-after-delegate", delegateSeed, "leader", "task_a");
await directRun("direct-after-explorer", explorerSeed, "leader", "task_a");

// THE REASON RULE, EXERCISED WHERE IT ACTUALLY BITES.
//
// Two things had to be true for this run to test anything, and the first
// attempt had neither. The proxy must be treated as having voiced NO
// requirement reason — which is what a guardrail block on the carrying message
// produces — AND the counterpart must still be holding its own position on
// that issue, so that agreeing is asking it to concede. The rule triggers on
// `asksForRequirementConcession`: a participant who simply confirms the
// package the proxies already settled is not asking for anything new, so no
// reason is demanded and nothing is exercised. Rewinding the counterpart to
// its opening is what a handover after a WEAKER proxy exchange looks like.
await directRun(
  "direct-after-proxy-no-reason",
  {
    ...delegateSeed,
    proxyVoicedRequirementReason: false,
    proxyPackage: counterpartOpening(getTask("task_a"), "member"),
  },
  "leader",
  "task_a",
);

// The same starting position with the reason already voiced, for contrast in
// the transcripts.
//
// WHAT THIS PAIR DOES AND DOES NOT SHOW. It is not a controlled test of the
// reason rule and must not be read as one: a live agent that is asked for a
// reason usually gives one, so the "no reason" run typically ends with a
// reason voiced and the requirement preserved — which is the rule working,
// not the rule failing. The deterministic contrast (reason → 3,200, no reason
// → 1,200, all four cells) is pinned in tests/reason-rules.test.mjs, where
// nothing can wander. What these two runs show is the BEHAVIOUR around it:
// that `request_reason` reaches a real participant as an answerable question,
// and that answering it changes the outcome.
await directRun(
  "direct-after-proxy-with-reason",
  {
    ...delegateSeed,
    proxyVoicedRequirementReason: true,
    proxyPackage: counterpartOpening(getTask("task_a"), "member"),
  },
  "leader",
  "task_a",
);

await baselineRun();
await rehearsalProbe();
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log("report written:", OUT);

// The markdown transcripts are the artefact worth keeping: the JSON report
// answers "did the checks pass", these answer "does it read like a
// negotiation", which is the thing no assertion covers.
mkdirSync(TRANSCRIPT_DIR, { recursive: true });
for (const run of report.runs) {
  if (!run.messages?.length) continue;
  const file = `${TRANSCRIPT_DIR}/${run.name}.md`;
  writeFileSync(file, transcriptMarkdown(run));
  console.log("transcript written:", file);
}
