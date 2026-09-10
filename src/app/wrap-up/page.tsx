"use client";

/** End checks; legacy Task 2 instruments retain their final comparison here. */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MeasureBlock, PreviousPart, missingIds, type Answers } from "@/components/measure";
import { ActionBar } from "@/components/study-chrome";
import { LoadRetry } from "@/components/load-retry";
import { Card, Page } from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { END_CHECK_BLOCKS, OEC1_BLOCK, OPEN_INSTRUMENT_VERSION, dummyAnswer } from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { nextHref } from "@/lib/study-config";
import { answersForIds, explicitlyCompleted, restoredValidPart } from "@/lib/survey-progress";

const RESPONSE_BLOCK = "v226_wrap_up";
const LEGACY_PARTS = [END_CHECK_BLOCKS, [OEC1_BLOCK]];
const ALL_IDS = LEGACY_PARTS.flatMap(blocks => blocks.flatMap(block => block.items.map(item => item.id)));

export default function WrapUpPage() {
  usePageEnter("wrap-up");
  const router = useRouter();
  const { participantKey, logEvent } = useParticipant();
  const [answers, setAnswers] = useState<Answers>({});
  const latestAnswers = useRef<Answers>({});
  const [part, setPart] = useState<number | null>(null);
  const [checksSubmitted, setChecksSubmitted] = useState(false);
  const [restored, setRestored] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [comparisonInTask, setComparisonInTask] = useState(false);
  const submitting = useRef(false);
  const PARTS = useMemo(() => comparisonInTask ? [END_CHECK_BLOCKS] : LEGACY_PARTS, [comparisonInTask]);

  useEffect(() => {
    if (!participantKey) return;
    let active = true;
    void Promise.all([
      getStore().loadResponses(participantKey, RESPONSE_BLOCK),
      getStore().loadResponses(participantKey, "v226_task_open_t2"),
    ]).then(([saved, taskOpen]) => {
      if (!active) return;
      const inTask = taskOpen?._instrument_version === OPEN_INSTRUMENT_VERSION;
      setComparisonInTask(inTask);
      const pageIds = (inTask ? [END_CHECK_BLOCKS] : LEGACY_PARTS).map(blocks => blocks.flatMap(block => block.items.map(item => item.id)));
      const filtered = { ...answersForIds(saved ?? {}, ALL_IDS), ...latestAnswers.current };
      if (explicitlyCompleted(saved ?? {})) { router.replace(nextHref("wrap-up")); return; }
      const submittedChecks = saved?._checks_submitted === true;
      setChecksSubmitted(submittedChecks);
      latestAnswers.current = filtered;
      setAnswers(filtered);
      setPart(restoredValidPart(pageIds, filtered, submittedChecks ? 1 : 0));
      setRestored(true);
    }).catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [participantKey, router, loadAttempt]);

  const activePart = part ?? 0;
  const blocks = PARTS[activePart] ?? PARTS[0];
  const missing = activePart === PARTS.length - 1
    ? missingIds(PARTS.flat(), answers)
    : missingIds(blocks, answers);
  const canSubmit = useDevGate(missing.length === 0);
  const isLast = activePart === PARTS.length - 1;

  useDevAutofill(() => {
    const next = { ...latestAnswers.current, ...Object.fromEntries(blocks.flatMap((block) => block.items.map((item) => [item.id, dummyAnswer(item)]))) };
    latestAnswers.current = next; setAnswers(next);
  }, `wrap-up-v226-${activePart}`);

  function answer(id: string, value: string | number) {
    const next = { ...latestAnswers.current, [id]: value };
    latestAnswers.current = next; setAnswers(next);
    if (participantKey) void getStore().saveResponses(participantKey, RESPONSE_BLOCK, { ...next, _instrument_version: "2.26", _checks_submitted: checksSubmitted });
  }

  async function submit() {
    if (!canSubmit || submitting.current) return;
    submitting.current = true; setBusy(true);
    try {
      if (participantKey) await getStore().saveResponses(participantKey, RESPONSE_BLOCK, { ...latestAnswers.current, _instrument_version: "2.26", _checks_submitted: true, _completed: isLast });
      if (!isLast) { setChecksSubmitted(true); setPart(activePart + 1); window.scrollTo({ top: 0 }); return; }
      logEvent("survey_saved", { block: RESPONSE_BLOCK, instrumentVersion: "2.26" });
      router.push(nextHref("wrap-up"));
    } finally { submitting.current = false; setBusy(false); }
  }

  async function previous() {
    if (activePart === 0 || submitting.current) return;
    submitting.current = true; setBusy(true);
    try {
      if (participantKey) await getStore().saveResponses(participantKey, RESPONSE_BLOCK, { ...latestAnswers.current, _instrument_version: "2.26", _checks_submitted: checksSubmitted });
      logEvent("survey_back", { block: RESPONSE_BLOCK, from: activePart, to: activePart - 1 });
      setPart(activePart - 1); window.scrollTo({ top: 0 });
    } finally { submitting.current = false; setBusy(false); }
  }

  if (!restored) return <Page>{loadFailed
    ? <LoadRetry onRetry={() => { setLoadFailed(false); setLoadAttempt((value) => value + 1); }} />
    : <p className="text-sm text-[var(--ink-2)]">Loading final questions…</p>}</Page>;
  return <>
    <Page>
      <Card className="mb-6 border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/30">
        <p className="text-xs font-extrabold text-indigo-900">Final questions · Section {activePart + 1} of {PARTS.length}</p>
        <h1 className="mt-2 text-xl font-black tracking-tight text-[var(--ink)] sm:text-2xl">{activePart === 0 ? "Your role and interaction" : "Comparing your experiences"}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">Please answer based on your experience across the study.</p>
      </Card>
      {blocks.map((block) => <MeasureBlock key={block.id} block={block} answers={answers} onChange={answer} />)}
    </Page>
    <ActionBar label={isLast ? "Submit & Continue to Debriefing" : "Next Section"} onClick={submit} busy={busy} disabled={!canSubmit} remaining={missing.length} firstUnansweredId={missing[0] ?? null} secondary={activePart > 0 ? <PreviousPart onClick={previous} disabled={busy} /> : null} />
  </>;
}
