"use client";

/**
 * Background survey (Experimental Design Ver.2.26 §9.1).
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
  PreviousPart,
  answeredNote,
  missingIds,
  type Answers,
} from "@/components/measure";
import { ActionBar } from "@/components/study-chrome";
import { LoadRetry } from "@/components/load-retry";
import { Callout, Page, PageHeader } from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { BACKGROUND_BLOCKS, dummyAnswer, requiredIds } from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { useRestoreAnswers } from "@/lib/saved-answers";
import { getStore } from "@/lib/store";
import { nextHref } from "@/lib/study-config";
import { answersForIds, restoredValidPart } from "@/lib/survey-progress";

const BLOCKS = BACKGROUND_BLOCKS;
const RESPONSE_BLOCK = "v226_background";
const BACKGROUND_IDS = BLOCKS.flatMap((block) => block.items.map((item) => item.id));
const BACKGROUND_PAGE_IDS = BLOCKS.map(requiredIds);
const NUMBER_IDS = BLOCKS.flatMap((block) =>
  block.items.filter((item) => item.kind === "number").map((item) => item.id),
);

function invalidNumberIds(answers: Answers): string[] {
  return NUMBER_IDS.filter((id) => {
    const value = answers[id];
    const numeric = typeof value === "string" || typeof value === "number"
      ? Number(value)
      : Number.NaN;
    return (
      value !== undefined &&
      value !== "" &&
      (!Number.isFinite(numeric) || numeric < 0)
    );
  });
}

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
  const [submittedParts, setSubmittedParts] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const submitting = useRef(false);

  // Reachable again via Back from the instructions. Resume after the last
  // explicitly submitted section. Merely filling the final field never moves
  // a participant forward on reload.
  //
  // The landing section is chosen ONCE. The restore is a store read, so it can
  // resolve after the participant has already pressed Previous — and picking
  // the section again at that point would drag them forward out of the one
  // they had just asked to go back to. Answers still merge whenever the read
  // lands, with local edits winning.
  const landed = useRef(false);
  const restoration = useRestoreAnswers(RESPONSE_BLOCK, (saved) => {
    const filtered = answersForIds(saved, BACKGROUND_IDS);
    const merged = { ...filtered, ...latestAnswers.current };
    latestAnswers.current = merged;
    setAnswers(merged);
    if (landed.current) return;
    landed.current = true;
    const restoredPart = restoredValidPart(BACKGROUND_PAGE_IDS, merged, saved._submitted_parts);
    setSubmittedParts(typeof saved._submitted_parts === "number" ? saved._submitted_parts : 0);
    setPart(restoredPart);
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
  const currentMissing = [...new Set([
    ...missingIds([currentBlock], answers),
    ...invalidNumberIds(answers).filter((id) =>
      currentBlock.items.some((item) => item.id === id),
    ),
    ...(currentBlock.id === "demographics" && !ageValid ? ["BG1"] : []),
  ])];
  const allMissing = [...new Set([
    ...missingIds(BLOCKS, answers),
    ...invalidNumberIds(answers),
    ...(!ageValid ? ["BG1"] : []),
  ])];
  const missing = part === BLOCKS.length - 1 ? allMissing : currentMissing;
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
    if (submitting.current) return;
    const next = { ...latestAnswers.current, [id]: value };
    latestAnswers.current = next;
    setAnswers(next);
    // Do not let one temporarily invalid number enter a full-block snapshot:
    // the server correctly rejects it, and that rejected FIFO head would also
    // hold every later corrected snapshot behind it.
    if (invalidNumberIds(next).length === 0) {
      void saveResponses(RESPONSE_BLOCK, { ...next, _instrument_version: "2.26", _submitted_parts: submittedParts });
    }
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
    setSaveFailed(false);
    try {
      const nextSubmittedParts = Math.max(submittedParts, part + 1);
      await saveResponses(RESPONSE_BLOCK, { ...latestAnswers.current, _instrument_version: "2.26", _submitted_parts: nextSubmittedParts });
      if (!(await getStore().confirmSaved())) {
        setSaveFailed(true);
        return;
      }
      setSubmittedParts(nextSubmittedParts);
      if (part < BLOCKS.length - 1) {
        setPart((current) => current + 1);
        setFlagged(new Set());
        window.scrollTo({ top: 0 });
        return;
      }
      logEvent("page_complete", undefined, { page: "background" });
      router.push(nextHref("background"));
    } catch {
      setSaveFailed(true);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  /**
   * Steps back one section, within this route only. Leaving the route entirely
   * is `BACK_STEPS` and `BackButton`, which this does not touch.
   *
   * The section order is fixed; Previous only pages. Answers are written
   * first, so nothing typed on the current section is lost, and an earlier
   * section re-renders from `answers` with its values in place and editable.
   * The flag set is cleared because it marks what was missing on the section
   * being left, not on the one being returned to.
   */
  async function handlePrevious() {
    if (part === 0 || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setSaveFailed(false);
    try {
      await saveResponses(RESPONSE_BLOCK, { ...latestAnswers.current, _instrument_version: "2.26", _submitted_parts: submittedParts });
      if (!(await getStore().confirmSaved())) {
        setSaveFailed(true);
        return;
      }
      logEvent("survey_back", { block: RESPONSE_BLOCK, from: part, to: part - 1 }, { page: "background" });
      setPart(part - 1);
      setFlagged(new Set());
      window.scrollTo({ top: 0 });
    } catch {
      setSaveFailed(true);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Page>
        <PageHeader
          eyebrow={`Background survey · Section ${part + 1} of ${BLOCKS.length}`}
          title={copy.title}
          subtitle={copy.subtitle}
        />

        {restoration.loadFailed ? <LoadRetry onRetry={restoration.retry} /> : null}
        <fieldset disabled={busy}>
          <MeasureBlock
            block={currentBlock}
            answers={answers}
            onChange={answer}
            flagged={flagged}
          />
        </fieldset>
        {saveFailed ? <div className="mb-5" role="alert"><Callout tone="warning"><p>We couldn&apos;t save yet. Your answers are still here. Please retry.</p></Callout></div> : null}
      </Page>

      <ActionBar
        label={saveFailed ? "Retry saving" : part === BLOCKS.length - 1 ? "Continue" : "Next section"}
        onClick={handleNext}
        busy={busy}
        remaining={flagged.size > 0 ? missing.length : 0}
        firstUnansweredId={missing[0] ?? null}
        note={answeredNote([currentBlock], answers)}
        secondary={part > 0 ? <PreviousPart onClick={handlePrevious} disabled={busy} /> : null}
      />
    </>
  );
}
