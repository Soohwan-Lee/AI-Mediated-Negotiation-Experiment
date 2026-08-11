"use client";

/**
 * Demographic & background survey (Methods §2, Appendix A2–A5).
 *
 * Carries the three covariate indices that enter the primary LMM (FNE, NSE,
 * AIAE). Item wording lives in `lib/measures` — this page only holds answers.
 *
 * Completed before condition assignment is revealed and before any task.
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
import { BACKGROUND_BLOCKS, dummyAnswer } from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { useRestoreAnswers } from "@/lib/saved-answers";
import { nextHref } from "@/lib/study-config";

const BLOCKS = BACKGROUND_BLOCKS;

export default function BackgroundPage() {
  usePageEnter("background");
  const router = useRouter();
  const { saveResponses, logEvent } = useParticipant();
  const [answers, setAnswers] = useState<Answers>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Reachable again via Back from the instructions.
  useRestoreAnswers("background", (saved) =>
    setAnswers((cur) => ({ ...saved, ...cur })),
  );

  const missing = missingIds(BLOCKS, answers);
  const canContinue = useDevGate(missing.length === 0);

  useDevAutofill(() =>
    setAnswers((prev) => ({
      ...prev,
      ...Object.fromEntries(
        BLOCKS.flatMap((b) => b.items.map((i) => [i.id, dummyAnswer(i)])),
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
    // Showing what is missing beats an unexplained dead button.
    if (!canContinue) {
      setFlagged(new Set(missing));
      return;
    }
    setBusy(true);
    try {
      await saveResponses("background", answers);
      logEvent("page_complete", undefined, { page: "background" });
      router.push(nextHref("background"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Page>
        <PageHeader
          eyebrow="Before we start"
          title="A few questions about you"
          subtitle="These help us describe who took part. There are no right or wrong answers."
        />

        {BLOCKS.map((block) => (
          <MeasureBlock
            key={block.id}
            block={block}
            answers={answers}
            onChange={answer}
            flagged={flagged}
          />
        ))}
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
