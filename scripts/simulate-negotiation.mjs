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
 *  5. Baseline direct (task_b, participant = member) — the participant is a
 *     second gpt-5.6-terra agent playing a Prolific worker; the counterpart is
 *     the real /api/counterpart route and the reason-linked rule runs the
 *     same client logic the Baseline page runs.
 *  6. A rehearsal leak probe: asks the proxy to repeat an UNTICKED sensitive
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
    },
  };
  report.runs.push(run);
  console.log(`[${name}] done: msgs=${messages.length} accepted=${accepted} blocked=${run.checks.blockedCount}`);
}

// --- Baseline participant agent -------------------------------------------

const PARTICIPANT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["message", "package", "attachReasonId", "acceptTheirLastOffer"],
  properties: {
    message: { type: "string" },
    package: {
      type: "object",
      additionalProperties: false,
      required: ["rehearsal_rounds", "evening_shifts", "client_launch"],
      properties: {
        rehearsal_rounds: { type: "string" },
        evening_shifts: { type: "string" },
        client_launch: { type: "string" },
      },
    },
    attachReasonId: { type: ["string", "null"] },
    acceptTheirLastOffer: { type: "boolean" },
  },
};

async function participantTurn(system, history) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: "gpt-5.6-terra",
      reasoning: { effort: "low" },
      max_output_tokens: 3000,
      input: [{ role: "system", content: system }, ...history],
      text: { format: { type: "json_schema", name: "participant_turn", strict: true, schema: PARTICIPANT_SCHEMA } },
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
    const turn = await participantTurn(system, history);
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
    `- **Outcome**: ${c.accepted ? "agreement" : c.impasse ? "impasse" : "no acceptance recorded"}`,
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
await proxyRun("delegate-proxy-wr-and-sb", "task_a", "leader", "delegate", ["a_i1_sb_l"]);
await proxyRun("explorer-proxy-wr-and-sb", "task_a", "leader", "explorer", ["a_i1_sb_l"]);
await proxyRun("explorer-proxy-sb-only", "task_a", "leader", "explorer", ["a_i1_sb_l"], ["a_i1_wr_l"]);
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
