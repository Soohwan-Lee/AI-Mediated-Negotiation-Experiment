"use client";

/** Ver.2.26: every post-task self-report scale is submitted from one page. */
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { MeasureBlock, answeredNote, missingIds, type Answers } from "@/components/measure";
import { ActionBar } from "@/components/study-chrome";
import { TranscriptReview } from "@/components/transcript-review";
import { LoadRetry } from "@/components/load-retry";
import { Callout, Card, Page } from "@/components/ui";
import { isProxyCondition, sessionPlan } from "@/lib/assignment";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { blockForTask, dummyAnswer, experienceBlocks, proxyExperienceBlocks, responsibilityOrder } from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { nextHref } from "@/lib/study-config";
import { answersForIds } from "@/lib/survey-progress";

export default function TaskSurveyPage({ params }: { params: Promise<{ index: string }> }) {
  const { index } = use(params);
  const taskIndex = (Number(index) === 2 ? 2 : 1) as 1 | 2;
  const flowKey = taskIndex === 1 ? "survey-1" : "survey-2";
  usePageEnter(flowKey);
  const router = useRouter();
  const { assignment, participantKey, logEvent } = useParticipant();
  const [answers, setAnswers] = useState<Answers>({});
  const latestAnswers = useRef<Answers>({});
  const [restored, setRestored] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const submitting = useRef(false);

  const plan = assignment ? sessionPlan(assignment, taskIndex) : null;
  const isProxy = plan ? isProxyCondition(plan.condition) : false;
  const blocks = useMemo(() => {
    if (!assignment || !participantKey) return [];
    const raw = [
      ...experienceBlocks(assignment.role, isProxy),
      ...(isProxy ? proxyExperienceBlocks(participantKey) : []),
    ];
    return raw.map((block) => blockForTask(block, taskIndex));
  }, [assignment, isProxy, participantKey, taskIndex]);
  const ids = useMemo(() => blocks.flatMap((block) => block.items.map((item) => item.id)), [blocks]);
  const responseBlock = `v226_post_task_scales_t${taskIndex}`;

  useEffect(() => {
    if (!participantKey || ids.length === 0) return;
    let active = true;
    void getStore().loadResponses(participantKey, responseBlock).then((saved) => {
      if (!active) return;
      const filtered = { ...answersForIds(saved ?? {}, ids), ...latestAnswers.current };
      latestAnswers.current = filtered;
      setAnswers(filtered);
      setRestored(true);
    }).catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [ids, participantKey, responseBlock, loadAttempt]);

  const missing = missingIds(blocks, answers);
  const canSubmit = useDevGate(missing.length === 0);

  useDevAutofill(() => {
    const filled = Object.fromEntries(blocks.flatMap((block) => block.items.map((item) => [item.id, dummyAnswer(item)])));
    const next = { ...latestAnswers.current, ...filled };
    latestAnswers.current = next;
    setAnswers(next);
  }, `task-survey-v226-${taskIndex}-${restored}`);

  function answer(id: string, value: string | number) {
    if (submitting.current) return;
    const next = { ...latestAnswers.current, [id]: value };
    latestAnswers.current = next;
    setAnswers(next);
    if (participantKey) void getStore().saveResponses(participantKey, responseBlock, {
      ...next,
      _instrument_version: "2.26",
      _submitted: false,
      ...(isProxy ? {
        _pmp_responsibility_order: responsibilityOrder(participantKey),
        _pop_responsibility_order: responsibilityOrder(participantKey) === "human_first" ? "ai_first" : "human_first",
      } : {}),
    });
    setFlagged((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current); next.delete(id); return next;
    });
  }

  async function submit() {
    if (submitting.current) return;
    if (!canSubmit) { setFlagged(new Set(missing)); return; }
    submitting.current = true;
    setBusy(true);
    setSaveFailed(false);
    try {
      if (participantKey) {
        const store = getStore();
        await store.saveResponses(participantKey, responseBlock, {
            ...latestAnswers.current,
            _instrument_version: "2.26",
            _submitted: true,
          ...(isProxy ? {
            _pmp_responsibility_order: responsibilityOrder(participantKey),
            _pop_responsibility_order: responsibilityOrder(participantKey) === "human_first" ? "ai_first" : "human_first",
          } : {}),
        });
        if (!(await store.confirmSaved())) {
          setSaveFailed(true);
          return;
        }
      }
      logEvent("survey_saved", { block: responseBlock, instrumentVersion: "2.26" }, { sessionIndex: taskIndex });
      router.push(nextHref(flowKey));
    } catch {
      setSaveFailed(true);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (!assignment || !plan || !restored) return <Page>{loadFailed
    ? <LoadRetry onRetry={() => { setLoadFailed(false); setLoadAttempt((value) => value + 1); }} />
    : <p className="text-sm text-[var(--ink-2)]">Loading survey questions…</p>}</Page>;
  return <>
    <Page width="wide">
      <Card className="mb-6 border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/30">
        <p className="text-xs font-extrabold text-indigo-900">Task {taskIndex} · Questionnaire</p>
        <h1 className="mt-2 text-xl font-black tracking-tight text-[var(--ink)] sm:text-2xl">Your negotiation experience</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">Please answer all questions about the negotiation you just completed, then submit the page.</p>
      </Card>
      <TranscriptReview participantKey={participantKey} taskIndex={taskIndex} />
      <fieldset disabled={busy} className="mt-6 grid items-start gap-x-5 lg:grid-cols-2">
        {blocks.map((block) => <MeasureBlock key={block.id} block={block} answers={answers} onChange={answer} flagged={flagged} stackedScales />)}
      </fieldset>
      {saveFailed ? <div className="mb-6" role="alert"><Callout tone="warning"><p>We couldn&apos;t save yet. Your answers are still here. Please retry.</p></Callout></div> : null}
    </Page>
    <ActionBar label={saveFailed ? "Retry saving" : "Submit & Continue"} onClick={submit} busy={busy} remaining={flagged.size > 0 ? missing.length : 0} firstUnansweredId={missing[0] ?? null} note={answeredNote(blocks, answers)} />
  </>;
}
