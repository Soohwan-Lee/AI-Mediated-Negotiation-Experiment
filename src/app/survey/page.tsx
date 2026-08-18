"use client";

/**
 * End-of-study questionnaire (Methods ver.1.8 §Post-study).
 *
 * WHY THIS IS SHORT NOW. The post-task items used to be collected here, all of
 * them, after both sessions were over — which asked participants to remember
 * how a negotiation felt two tasks ago. ver.1.8 puts them where they belong:
 * each session carries its own seven-to-fourteen item block, answered while
 * the session is still in mind. What is left for the end is the handful of
 * things that are genuinely about the study as a whole.
 *
 * Two parts: the open-ended questions and the suspicion probe. The subjective
 * power check has its own page immediately after this one.
 *
 * Two things this page must not do:
 *  - name a condition. Sessions are "Session 1" and "Session 2", reminded by
 *    scenario title, never by "Baseline"/"Delegate"/"Explorer".
 *  - ask the suspicion probe anywhere but last, before any disclosure.
 *
 * Item wording lives in `lib/measures`.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  MeasureBlock,
  answeredNote,
  missingIds,
  type Answers,
} from "@/components/measure";
import { ActionBar } from "@/components/study-chrome";
import { Button, Page, PageHeader } from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import {
  COMPARISON_BLOCK,
  SUSPICION_BLOCK,
  dummyAnswer,
  openEndedBlock,
  type Block,
} from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { useRestoreAnswers } from "@/lib/saved-answers";
import { nextHref } from "@/lib/study-config";

interface Part {
  id: string;
  eyebrow: string;
  title: string;
  blocks: Block[];
}

export default function SurveyPage() {
  usePageEnter("survey");
  const router = useRouter();
  const { assignment, saveResponses, logEvent } = useParticipant();
  const [answers, setAnswers] = useState<Answers>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [partIndex, setPartIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const parts = useMemo<Part[]>(() => {
    if (!assignment) return [];

    // The subjective power check has its own page (`/manipulation-check`) and
    // is not repeated here.
    return [
      {
        id: "comparison",
        eyebrow: "Both sessions",
        title: "Comparing the two",
        blocks: [COMPARISON_BLOCK, openEndedBlock(assignment.role)],
      },
      {
        // The probe has to come before anything that would give the design
        // away, which is why it sits here rather than next to the debriefing
        // it logically pairs with.
        id: "suspicion",
        eyebrow: "Last part",
        title: "Two final questions",
        blocks: [SUSPICION_BLOCK],
      },
    ];
  }, [assignment]);

  /**
   * Answers are written on every part, so a returning participant lands where
   * they actually stopped: the first part still missing something, or the last
   * part if the questionnaire was finished and they came back through the
   * manipulation check. Always starting at part one would make someone who
   * came back to fix one item click through all six.
   */
  useRestoreAnswers("survey", (saved) => {
    setAnswers((cur) => ({ ...saved, ...cur }));
    const firstIncomplete = parts.findIndex(
      (p) => missingIds(p.blocks, saved).length > 0,
    );
    setPartIndex(
      firstIncomplete === -1 ? Math.max(parts.length - 1, 0) : firstIncomplete,
    );
  });

  const part = parts[partIndex];
  const isLast = partIndex === parts.length - 1;

  const missing = part ? missingIds(part.blocks, answers) : [];
  const canContinue = useDevGate(missing.length === 0);

  useDevAutofill(() =>
    setAnswers((prev) => ({
      ...prev,
      ...Object.fromEntries(
        parts.flatMap((p) =>
          p.blocks.flatMap((b) => b.items.map((i) => [i.id, dummyAnswer(i)])),
        ),
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

  function goToPart(index: number) {
    setPartIndex(index);
    setFlagged(new Set());
    window.scrollTo({ top: 0 });
  }

  async function handleNext() {
    if (!canContinue) {
      setFlagged(new Set(missing));
      return;
    }

    setBusy(true);
    try {
      // Save on every part, not just at the end: a participant who drops out
      // partway should not take their answers with them. The block is
      // rewritten each time, so the last write is the fullest one.
      await saveResponses("survey", answers);

      if (!isLast) {
        goToPart(partIndex + 1);
        return;
      }

      logEvent("page_complete", undefined, { page: "survey" });
      router.push(nextHref("survey"));
    } finally {
      setBusy(false);
    }
  }

  if (!part) {
    return (
      <Page>
        <p className="text-sm text-[var(--ink-2)]">Loading…</p>
      </Page>
    );
  }

  return (
    <>
      <Page>
        <PageHeader
          eyebrow={`Part ${partIndex + 1} of ${parts.length} · ${part.eyebrow}`}
          title={part.title}
          subtitle={
            partIndex === 0
              ? "A few questions about the study as a whole. There are no right or wrong answers."
              : undefined
          }
        />

        {part.blocks.map((block) => (
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
        label={isLast ? "Finish questionnaire" : "Continue"}
        onClick={handleNext}
        busy={busy}
        remaining={flagged.size > 0 ? missing.length : 0}
        firstUnansweredId={missing[0] ?? null}
        note={answeredNote(part.blocks, answers)}
        secondary={
          partIndex > 0 ? (
            <Button variant="quiet" onClick={() => goToPart(partIndex - 1)}>
              Back
            </Button>
          ) : null
        }
      />
    </>
  );
}
