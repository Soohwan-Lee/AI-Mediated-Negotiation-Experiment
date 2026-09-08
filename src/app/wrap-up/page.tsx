"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MeasureBlock, type Answers } from "@/components/measure";
import { ActionBar } from "@/components/study-chrome";
import { Card, Page } from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import {
  CP_BLOCK,
  OE_COMPARE_BLOCK,
  POWER_BLOCK,
  SUS_IDENTITY_BLOCK,
  SUS_UNUSUAL_BLOCK,
  dummyAnswer,
  requiredIds,
  type Block,
} from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { nextHref } from "@/lib/study-config";

export default function WrapUpPage() {
  usePageEnter("wrap-up");
  const router = useRouter();
  const { participantKey, logEvent } = useParticipant();
  const [answers, setAnswers] = useState<Answers>({});
  const [part, setPart] = useState(0);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!participantKey) return;
    let active = true;
    void getStore().loadResponses(participantKey, "wrap_up").then((saved) => {
      if (!active) return;
      const existing = saved ?? {};
      const groups = [
        ["OE-COMP"],
        ["POWER1", "POWER2", "IMM2", "INCENT1"],
        ["CP1", "CP2"],
        ["SUS0"],
        ["SUS3", ...(existing.SUS3 === "yes" ? ["SUS3-WHEN"] : [])],
      ];
      const firstIncomplete = groups.findIndex((group) =>
        group.some((id) => existing[id] === undefined || existing[id] === ""),
      );
      if (firstIncomplete === -1 && saved) {
        router.replace(nextHref("wrap-up"));
        return;
      }
      setAnswers(existing);
      setPart(Math.max(0, firstIncomplete));
      setRestored(true);
    });
    return () => { active = false; };
  }, [participantKey, router]);

  const identityBlock: Block = answers.SUS3 === "yes"
    ? { ...SUS_IDENTITY_BLOCK, optional: [] }
    : { ...SUS_IDENTITY_BLOCK, items: SUS_IDENTITY_BLOCK.items.slice(0, 1) };
  const parts: Block[][] = [
    [OE_COMPARE_BLOCK],
    [POWER_BLOCK],
    [CP_BLOCK],
    [SUS_UNUSUAL_BLOCK],
    [identityBlock],
  ];
  const current = parts[part] ?? [];
  const isLast = part === parts.length - 1;
  const required = current.flatMap(requiredIds);
  const missing = required.filter((id) => answers[id] === undefined || answers[id] === "");
  const canContinue = useDevGate(missing.length === 0);

  useDevAutofill(() => {
    const filled: Answers = {};
    for (const block of current) {
      for (const item of block.items) filled[item.id] = dummyAnswer(item);
    }
    setAnswers((previous) => ({ ...previous, ...filled }));
  }, `wrap-up-${part}`);

  function answer(id: string, value: string | number) {
    setAnswers((previous) => {
      const next = { ...previous, [id]: value };
      if (id === "SUS3" && value !== "yes") delete next["SUS3-WHEN"];
      return next;
    });
  }

  async function save() {
    if (!canContinue || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      if (participantKey) await getStore().saveResponses(participantKey, "wrap_up", answers);
      if (!isLast) {
        setPart((currentPart) => currentPart + 1);
        window.scrollTo({ top: 0 });
        return;
      }
      logEvent("survey_saved", { block: "wrap_up" });
      router.push(nextHref("wrap-up"));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (!restored) {
    return <Page><p className="text-sm text-[var(--ink-2)]">Loading final questions…</p></Page>;
  }

  return (
    <>
      <Page>
        <Card className="mb-6 border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/30">
          <p className="text-xs font-extrabold text-indigo-900">Final questions · Section {part + 1} of {parts.length}</p>
          <h1 className="mt-2 text-xl font-black tracking-tight text-[var(--ink)] sm:text-2xl">
            {part === 0 ? "Comparing your experiences" : part === 1 ? "Your role and the study" : "The interaction"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Please answer based on your experience across the study.
          </p>
        </Card>

        {current.map((block) => (
          <MeasureBlock key={block.id} block={block} answers={answers} onChange={answer} />
        ))}
      </Page>

      <ActionBar
        label={isLast ? "Submit & Continue to Debriefing" : "Next Section"}
        onClick={save}
        busy={busy}
        disabled={!canContinue}
        remaining={missing.length}
        firstUnansweredId={missing[0] ?? null}
      />
    </>
  );
}
