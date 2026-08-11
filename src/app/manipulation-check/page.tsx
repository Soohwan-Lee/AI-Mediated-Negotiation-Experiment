"use client";

/**
 * Power dynamics manipulation check (Methods §7, Appendix A6).
 *
 * Placed AFTER the outcome questionnaire so the power items do not prime the
 * negotiation experience or the outcome evaluations. Items live in
 * `lib/measures`.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MeasureBlock,
  answeredNote,
  missingIds,
  type Answers,
} from "@/components/measure";
import { ActionBar } from "@/components/study-chrome";
import { Page, PageHeader } from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { POWER_BLOCK, dummyAnswer } from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { nextHref } from "@/lib/study-config";

const BLOCKS = [POWER_BLOCK];

export default function ManipulationCheckPage() {
  usePageEnter("manipulation-check");
  const router = useRouter();
  const { saveResponses, logEvent } = useParticipant();
  const [answers, setAnswers] = useState<Answers>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const missing = missingIds(BLOCKS, answers);
  const canContinue = useDevGate(missing.length === 0);

  useDevAutofill(() =>
    setAnswers((prev) => ({
      ...prev,
      ...Object.fromEntries(
        POWER_BLOCK.items.map((i) => [i.id, dummyAnswer(i)]),
      ),
    })),
  );

  function answer(id: string, value: string | number) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setFlagged((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleNext() {
    if (!canContinue) {
      setFlagged(new Set(missing));
      return;
    }
    setBusy(true);
    try {
      await saveResponses("manipulation_check", answers);
      logEvent("page_complete", undefined, { page: "manipulation-check" });
      router.push(nextHref("manipulation-check"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Page>
        <PageHeader
          eyebrow="Almost done"
          title="How the roles felt"
          subtitle="A few questions about the roles in the scenario you worked through."
        />

        <MeasureBlock
          block={POWER_BLOCK}
          answers={answers}
          onChange={answer}
          flagged={flagged}
        />
      </Page>

      <ActionBar
        label="Continue"
        onClick={handleNext}
        busy={busy}
        remaining={flagged.size > 0 ? missing.length : 0}
        firstUnansweredId={missing[0] ?? null}
        note={answeredNote(BLOCKS, answers)}
      />
    </>
  );
}
