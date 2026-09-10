"use client";

/** Ver.2.27 role decision followed by one combined open-ended page. */
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { ActionBar } from "@/components/study-chrome";
import { TranscriptReview } from "@/components/transcript-review";
import { LoadRetry } from "@/components/load-retry";
import { Callout, Card, CardTitle, Page } from "@/components/ui";
import { MeasureBlock, PreviousPart, missingIds, type Answers } from "@/components/measure";
import { sessionPlan } from "@/lib/assignment";
import { bonusAmountFromPercent } from "@/lib/bonus";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { BR1_ITEM, FE1_BLOCK, blockForTask, dummyAnswer, taskOpenBlocks, OPEN_INSTRUMENT_VERSION, OPEN_INSTRUMENT_V2 } from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { STUDY, nextHref } from "@/lib/study-config";
import { answersForIds, explicitlyCompleted } from "@/lib/survey-progress";

export default function TaskRewardPage({ params }: { params: Promise<{ index: string }> }) {
  const { index } = use(params);
  const taskIndex = (Number(index) === 2 ? 2 : 1) as 1 | 2;
  const flowKey = taskIndex === 1 ? "reward-1" : "reward-2";
  usePageEnter(flowKey);
  const router = useRouter();
  const { assignment, participantKey, logEvent } = useParticipant();
  const [stage, setStage] = useState<"decision" | "open">("decision");
  const [amountPercent, setAmountPercent] = useState<number | null>(null);
  const [amountConfirmed, setAmountConfirmed] = useState(false);
  const [evalAnswers, setEvalAnswers] = useState<Answers>({});
  const [openAnswers, setOpenAnswers] = useState<Answers>({});
  const [openVersion, setOpenVersion] = useState<string>(OPEN_INSTRUMENT_VERSION);
  const latestOpenAnswers = useRef<Answers>({});
  const [restored, setRestored] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const isLeader = assignment?.role === "leader";
  const plan = assignment ? sessionPlan(assignment, taskIndex) : null;
  const isProxy = plan ? plan.condition !== "direct" : false;
  const decisionBlockName = `v226_task_decision_t${taskIndex}`;
  const openBlockName = `v226_task_open_t${taskIndex}`;
  const evalBlock = useMemo(() => blockForTask(FE1_BLOCK, taskIndex), [taskIndex]);
  const openBlocks = useMemo(() => taskOpenBlocks(isProxy, { role: assignment?.role, taskIndex, version: openVersion }).map((block) => blockForTask(block, taskIndex)), [assignment?.role, isProxy, taskIndex, openVersion]);

  useEffect(() => {
    if (!participantKey || !assignment) return;
    let active = true;
    void Promise.all([
      getStore().loadResponses(participantKey, decisionBlockName),
      getStore().loadResponses(participantKey, openBlockName),
    ]).then(([decision, open]) => {
      if (!active) return;
      const version = open && Object.keys(open).length ? (open._instrument_version ?? "2.27") : OPEN_INSTRUMENT_VERSION;
      if (!["2.27", OPEN_INSTRUMENT_V2, OPEN_INSTRUMENT_VERSION].includes(String(version))) throw new Error("Unknown task reflection instrument");
      setOpenVersion(String(version));
      const restoredIds = taskOpenBlocks(isProxy, { role: assignment.role, taskIndex, version: String(version) }).flatMap(block => block.items.map(item => `${item.id}_t${taskIndex}`));
      const filteredOpen = { ...answersForIds(open ?? {}, restoredIds), ...latestOpenAnswers.current };
      setOpenAnswers(filteredOpen);
      if (explicitlyCompleted(open ?? {})) {
        router.replace(nextHref(flowKey));
        return;
      }
      latestOpenAnswers.current = filteredOpen;
      const percent = decision?.[`BR1_PERCENT_t${taskIndex}`];
      if (typeof percent === "number") setAmountPercent(percent);
      setAmountConfirmed(decision?.[`BR1_CONFIRMED_t${taskIndex}`] === true);
      const fe = decision?.[`FE1_t${taskIndex}`];
      if (typeof fe === "number") setEvalAnswers({ [`FE1_t${taskIndex}`]: fe });
      const decisionComplete = decision?._submitted === true;
      if (decisionComplete) setStage("open");
      setRestored(true);
    }).catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [assignment, decisionBlockName, flowKey, isLeader, isProxy, openBlockName, participantKey, router, taskIndex, loadAttempt]);

  const awarded = amountPercent === null ? null : bonusAmountFromPercent(amountPercent);
  const evalMissing = missingIds([evalBlock], evalAnswers);
  const canSubmitDecision = useDevGate(isLeader ? amountPercent !== null && amountConfirmed : evalMissing.length === 0);
  const openMissing = missingIds(openBlocks, openAnswers);
  const canSubmitOpen = useDevGate(openMissing.length === 0);

  useDevAutofill(() => {
    if (stage === "decision") {
      setAmountPercent(70); setAmountConfirmed(true);
      setEvalAnswers(Object.fromEntries(evalBlock.items.map((item) => [item.id, dummyAnswer(item)])));
    } else {
      const next = {
        ...latestOpenAnswers.current,
        ...Object.fromEntries(
          openBlocks.flatMap((block) =>
            block.items.map((item) => [item.id, dummyAnswer(item)]),
          ),
        ),
      };
      latestOpenAnswers.current = next;
      setOpenAnswers(next);
    }
  }, `reward-v227-${taskIndex}-${stage}`);

  function persistLeaderDraft(percent: number | null, confirmed: boolean) {
    if (!participantKey) return;
    const pounds = percent === null ? null : bonusAmountFromPercent(percent);
    void getStore().saveResponses(participantKey, decisionBlockName, {
      _instrument_version: "2.26", role: "leader",
      [`BR1_METHOD_t${taskIndex}`]: "percentage_slider_to_gbp",
      [`BR1_PERCENT_t${taskIndex}`]: percent,
      [`BR1_t${taskIndex}`]: pounds,
      [`BR1_CONFIRMED_t${taskIndex}`]: confirmed,
    });
  }

  function answerEvaluation(id: string, value: string | number) {
    const next = { ...evalAnswers, [id]: value };
    setEvalAnswers(next);
    if (participantKey) void getStore().saveResponses(participantKey, decisionBlockName, { ...next, _instrument_version: "2.26", role: "member" });
  }

  async function submitDecision() {
    if (!canSubmitDecision || submitting.current) return;
    submitting.current = true; setBusy(true);
    try {
      const payload: Answers = isLeader ? {
        _instrument_version: "2.26", role: "leader",
        [`BR1_METHOD_t${taskIndex}`]: "percentage_slider_to_gbp",
        [`BR1_PERCENT_t${taskIndex}`]: amountPercent,
        [`BR1_t${taskIndex}`]: awarded,
        [`BR1_CONFIRMED_t${taskIndex}`]: amountConfirmed, _submitted: true,
      } : { ...evalAnswers, _instrument_version: "2.26", role: "member", _submitted: true };
      if (participantKey) await getStore().saveResponses(participantKey, decisionBlockName, payload);
      logEvent("reward_decision", { kind: isLeader ? "BR1" : "FE1", value: isLeader ? awarded : evalAnswers[`FE1_t${taskIndex}`], instrumentVersion: "2.26" }, { sessionIndex: taskIndex });
      setStage("open"); window.scrollTo({ top: 0 });
    } finally { submitting.current = false; setBusy(false); }
  }

  function answerOpen(id: string, value: string | number) {
    const next = { ...latestOpenAnswers.current, [id]: value };
    latestOpenAnswers.current = next;
    setOpenAnswers(next);
    if (participantKey) void getStore().saveResponses(participantKey, openBlockName, {
      ...next,
      _instrument_version: openVersion,
      _submitted_parts: 0,
      _completed: false,
    });
  }

  async function submitOpen() {
    if (!canSubmitOpen || submitting.current) return;
    submitting.current = true; setBusy(true);
    try {
      if (participantKey) await getStore().saveResponses(participantKey, openBlockName, {
        ...latestOpenAnswers.current,
        _instrument_version: openVersion,
        _submitted_parts: 1,
        _completed: true,
      });
      logEvent("survey_saved", { block: openBlockName, instrumentVersion: openVersion }, { sessionIndex: taskIndex });
      router.push(nextHref(flowKey));
    } finally { submitting.current = false; setBusy(false); }
  }

  async function previousOpen() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true);
    try {
      if (participantKey) await getStore().saveResponses(participantKey, openBlockName, {
        ...latestOpenAnswers.current,
        _instrument_version: openVersion,
        _submitted_parts: 0,
        _completed: false,
      });
      logEvent("survey_back", { block: openBlockName, from: "open", to: "decision" }, { sessionIndex: taskIndex });
      setStage("decision"); window.scrollTo({ top: 0 });
    } finally { submitting.current = false; setBusy(false); }
  }

  if (!assignment || !restored) return <Page>{loadFailed
    ? <LoadRetry onRetry={() => { setLoadFailed(false); setLoadAttempt((value) => value + 1); }} />
    : <p className="text-sm text-[var(--ink-2)]">Loading…</p>}</Page>;
  if (stage === "open") return <>
    <Page>
      <TranscriptReview participantKey={participantKey} taskIndex={taskIndex} />
      <Card className="mb-6 border-indigo-100 bg-indigo-50/30">
        <p className="text-xs font-extrabold text-indigo-900">Task {taskIndex} · Final reflection</p>
        <h1 className="mt-2 text-xl font-black tracking-tight text-[var(--ink)] sm:text-2xl">Tell us about this negotiation</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">Please answer in your own words. A brief answer is fine.</p>
      </Card>
      {openBlocks.map((block) => (
        <MeasureBlock
          key={block.id}
          block={block}
          answers={openAnswers}
          onChange={answerOpen}
        />
      ))}
    </Page>
    <ActionBar label="Submit & Continue" onClick={submitOpen} busy={busy} disabled={!canSubmitOpen} remaining={openMissing.length} firstUnansweredId={openMissing[0] ?? null} secondary={<PreviousPart onClick={previousOpen} disabled={busy} />} />
  </>;

  if (!isLeader) return <>
    <Page>
      <Card className="mb-6 border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/20">
        <p className="text-xs font-extrabold text-indigo-900">Upward Evaluation · Task {taskIndex}</p>
        <h1 className="mt-2 text-xl font-black tracking-tight text-[var(--ink)] sm:text-2xl">Evaluate the Team Lead</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">Consider the negotiation as a whole and whether you would want to work with this person again. This evaluation will be sent to the director.</p>
      </Card>
      <MeasureBlock block={evalBlock} answers={evalAnswers} onChange={answerEvaluation} />
    </Page>
    <ActionBar label="Submit Evaluation" onClick={submitDecision} busy={busy} disabled={!canSubmitDecision} remaining={evalMissing.length} firstUnansweredId={evalMissing[0] ?? null} />
  </>;

  const bonusUnit = BR1_ITEM.kind === "amount" ? BR1_ITEM.unit : undefined;
  return <>
    <Page>
      <Card className="mb-6 border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/20">
        <p className="text-xs font-extrabold text-indigo-900">Team Lead Decision · Task {taskIndex}</p>
        <h1 className="mt-2 text-xl font-black tracking-tight text-[var(--ink)] sm:text-2xl">Recommend the Member&apos;s Bonus</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">Consider the negotiation as a whole and whether you would want to work with this person again.</p>
      </Card>
      <Card className="mb-6 border-slate-200" id={`q-BR1_t${taskIndex}`}>
        <CardTitle hint={bonusUnit}>(BR1) {BR1_ITEM.text}</CardTitle>
        <div className="mt-5">
          <label htmlFor={`BR1_t${taskIndex}`} className="sr-only">BR1 bonus percentage from 0 to 100</label>
          <input id={`BR1_t${taskIndex}`} type="range" min={0} max={100} step={1} value={amountPercent ?? 0}
            onChange={(event) => { const value = Number(event.target.value); setAmountPercent(value); setAmountConfirmed(false); persistLeaderDraft(value, false); }}
            className="w-full accent-[var(--accent)]" aria-valuetext={awarded === null ? "No value selected" : `${STUDY.currencySymbol}${awarded.toFixed(2)}`} />
          <div className="mt-2 flex justify-between text-xs font-semibold text-[var(--ink-3)]"><span>£0.00</span><span>£{STUDY.bonusPerTask}</span></div>
          {amountPercent === null ? <button type="button" onClick={() => { setAmountPercent(0); setAmountConfirmed(false); persistLeaderDraft(0, false); }} className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-[var(--accent)]">Choose £0.00</button> : null}
        </div>
        {awarded !== null ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-center"><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Recommended Bonus Amount</p><p className="my-1 font-mono text-3xl font-black text-emerald-950">£{awarded.toFixed(2)}</p></div> : null}
      </Card>
      <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700"><input type="checkbox" checked={amountConfirmed} disabled={amountPercent === null} onChange={(event) => { setAmountConfirmed(event.target.checked); persistLeaderDraft(amountPercent, event.target.checked); }} className="mt-0.5 h-5 w-5 accent-[var(--accent)]" /><span>I intend to recommend {awarded === null ? "the amount shown above" : `£${awarded.toFixed(2)}`} for this task.</span></label>
      <Callout title="Independent Recommendation" tone="neutral"><p>This recommendation does not reduce your own payment.</p></Callout>
    </Page>
    <ActionBar label="Confirm Bonus Recommendation" onClick={submitDecision} busy={busy} disabled={!canSubmitDecision} remaining={amountPercent === null || !amountConfirmed ? 1 : 0} firstUnansweredId={amountPercent === null ? `BR1_t${taskIndex}` : null} note={amountPercent === null ? "Choose a value, even if it is £0.00." : !amountConfirmed ? "Confirm the exact amount before continuing." : "Ready to confirm"} />
  </>;
}
