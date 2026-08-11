"use client";

/**
 * Post-task questionnaire (Methods §6, Appendix A9-A16).
 *
 * Split into parts rather than one long scroll. The full bank runs to roughly
 * eighty rating items; presented as a single page it reads as a wall and
 * answer quality drops off. Parts follow the participant's own experience —
 * one session, then the next — which also keeps the assistant items adjacent
 * to the session they are about.
 *
 * Two things this page must not do:
 *  - name a condition. Sessions are "Session 1" and "Session 2", reminded by
 *    scenario title, never by "Direct"/"Delegate"/"Explorer".
 *  - ask the suspicion probe anywhere but last, before any disclosure
 *    (Methods §A17).
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
import { isProxyCondition, sessionPlan } from "@/lib/assignment";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import {
  COMPARISON_BLOCK,
  OPEN_BLOCK,
  PROXY_ITEMS,
  SESSION_ITEMS,
  SUSPICION_BLOCK,
  dummyAnswer,
  forSession,
  type Block,
} from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { useRestoreAnswers } from "@/lib/saved-answers";
import { nextHref } from "@/lib/study-config";
import { getTask } from "@/lib/tasks";

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

    /** Which session used an assistant. Exactly one always did. */
    const proxyIndex = isProxyCondition(sessionPlan(assignment, 1).condition)
      ? 1
      : 2;

    const built: Part[] = [];

    for (const index of [1, 2] as const) {
      // Remind them which session was which. "Session 2" on its own is
      // abstract by the time they reach this page; the scenario title is what
      // they remember, and it reveals nothing they have not already seen.
      const task = getTask(sessionPlan(assignment, index).taskId);

      built.push({
        id: `s${index}`,
        eyebrow: `Session ${index}`,
        title: task.title,
        blocks: [
          {
            id: `session_${index}`,
            title: "Thinking back to this session",
            hint: "1 = Strongly disagree, 7 = Strongly agree",
            items: forSession(SESSION_ITEMS, index),
          },
        ],
      });

      if (proxyIndex === index) {
        built.push({
          id: `s${index}_proxy`,
          eyebrow: `Session ${index}`,
          title: "The session where an assistant negotiated for you",
          blocks: [
            {
              id: `proxy_${index}`,
              title: "About your assistant",
              hint: "1 = Strongly disagree, 7 = Strongly agree",
              items: forSession(PROXY_ITEMS, index),
            },
          ],
        });
      }
    }

    built.push({
      id: "comparison",
      eyebrow: "Both sessions",
      title: "Comparing the two",
      blocks: [COMPARISON_BLOCK],
    });
    built.push({
      id: "open",
      eyebrow: "Both sessions",
      title: "In your own words",
      blocks: [OPEN_BLOCK],
    });
    built.push({
      id: "suspicion",
      eyebrow: "Last part",
      title: "Two final questions",
      blocks: [SUSPICION_BLOCK],
    });

    return built;
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
      // during an eighty-item questionnaire should not take all of it with
      // them. The block is rewritten each time, so the last write is the
      // fullest one.
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
              ? "Please answer for each session separately. There are no right or wrong answers."
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
