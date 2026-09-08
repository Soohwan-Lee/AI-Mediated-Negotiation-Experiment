"use client";

/**
 * Background survey (Experimental Design Ver.2.23 §9.1).
 *
 * Item wording and order live in `lib/measures`; this page only splits the
 * instrument into three short, forward-only sections and holds the answers.
 *
 * Completed before condition assignment is revealed and before any task.
 */

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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

const SECTION_COPY = [
  {
    title: "About you",
    subtitle: "These questions help us describe who took part in the study.",
  },
  {
    title: "How you see yourself",
    subtitle: "Choose the response that best describes you. There are no right or wrong answers.",
  },
  {
    title: "Your views about AI",
    subtitle: "Choose how much you agree or disagree with each statement.",
  },
] as const;

export default function BackgroundPage() {
  usePageEnter("background");
  const router = useRouter();
  const { saveResponses, logEvent } = useParticipant();
  const [answers, setAnswers] = useState<Answers>({});
  const latestAnswers = useRef<Answers>({});
  const [part, setPart] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  // Reachable again via Back from the instructions. Resume at the first
  // unfinished section; if all three were saved, show the final section so a
  // participant can review it without replaying the earlier pages.
  useRestoreAnswers("background", (saved) => {
    const merged = { ...saved, ...latestAnswers.current };
    latestAnswers.current = merged;
    setAnswers(merged);
    const firstIncomplete = BLOCKS.findIndex((block) =>
      missingIds([block], merged).length > 0,
    );
    setPart(firstIncomplete === -1 ? BLOCKS.length - 1 : firstIncomplete);
  });

  const currentBlock = BLOCKS[part];
  const copy = SECTION_COPY[part];

  // Age gets a sanity range on top of presence: a mistyped "3" or "340"
  // would otherwise enter the covariates silently, and nothing downstream
  // re-checks it. 18 is the Prolific floor.
  const age = Number(answers["BG1"]);
  const ageValid =
    answers["BG1"] === undefined || answers["BG1"] === "" ||
    (Number.isFinite(age) && age >= 18 && age <= 100);
  const missing = [
    ...missingIds([currentBlock], answers),
    ...(currentBlock.id === "demographics" && !ageValid ? ["BG1"] : []),
  ];
  const canContinue = useDevGate(missing.length === 0);

  useDevAutofill(
    () =>
      setAnswers((prev) => {
        const next = {
          ...prev,
          ...Object.fromEntries(
            currentBlock.items.map((item) => [item.id, dummyAnswer(item)]),
          ),
        };
        latestAnswers.current = next;
        return next;
      }),
    `background-${part}`,
  );

  function answer(id: string, value: string | number) {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      latestAnswers.current = next;
      return next;
    });
    setFlagged((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleNext() {
    if (submitting.current) return;
    // Showing what is missing beats an unexplained dead button.
    if (!canContinue) {
      setFlagged(new Set(missing));
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      await saveResponses("background", answers);
      if (part < BLOCKS.length - 1) {
        setPart((current) => current + 1);
        setFlagged(new Set());
        window.scrollTo({ top: 0 });
        return;
      }
      logEvent("page_complete", undefined, { page: "background" });
      router.push(nextHref("background"));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Page>
        <PageHeader
          eyebrow={`Step 1 · Section ${part + 1} of ${BLOCKS.length}`}
          title={copy.title}
          subtitle={copy.subtitle}
        />

        <MeasureBlock
          block={currentBlock}
          answers={answers}
          onChange={answer}
          flagged={flagged}
        />
      </Page>

      <ActionBar
        label={part === BLOCKS.length - 1 ? "Continue" : "Next section"}
        onClick={handleNext}
        busy={busy}
        remaining={flagged.size > 0 ? missing.length : 0}
        firstUnansweredId={missing[0] ?? null}
        note={answeredNote([currentBlock], answers)}
      />
    </>
  );
}
