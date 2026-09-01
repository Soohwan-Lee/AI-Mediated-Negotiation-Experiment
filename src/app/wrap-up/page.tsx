"use client";

/**
 * The end of the study (Experimental Design Ver.2.4 §9.5).
 *
 * Three blocks in a fixed order, and the order is the design:
 *
 *   POWER + IMM  →  final open-ended  →  suspicion probe
 *
 * POWER and IMM are asked ONCE, here, rather than after each task. They verify
 * that the role manipulation landed (§10 gate 2: Leaders higher on POWER1-2,
 * Members on POWER3) and that participants got into the scenario, and both are
 * judgements about the study as a whole. Asking them earlier would prime the
 * role behaviour they exist to check.
 *
 * The SUSPICION PROBE stays last, immediately before the debriefing. Asked any
 * earlier it plants the idea it is trying to detect; asked afterwards it
 * measures nothing at all. Its two items are the only place a participant is
 * invited to say they thought the counterpart was not a person, and §10 gate
 * 11 records every response for the sensitivity analysis.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MeasureBlock, type Answers } from "@/components/measure";
import { ActionBar } from "@/components/study-chrome";
import { Card, CardTitle, Page } from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import {
  FINAL_OPEN_BLOCK,
  POWER_BLOCK,
  SUSPICION_BLOCK,
  dummyAnswer,
  requiredIds,
} from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { nextHref } from "@/lib/study-config";

const BLOCKS = [POWER_BLOCK, FINAL_OPEN_BLOCK, SUSPICION_BLOCK];

export default function WrapUpPage() {
  usePageEnter("wrap-up");
  const router = useRouter();
  const { participantKey, logEvent } = useParticipant();
  const [answers, setAnswers] = useState<Answers>({});

  useDevAutofill(() => {
    const filled: Answers = {};
    for (const block of BLOCKS) {
      for (const item of block.items) filled[item.id] = dummyAnswer(item);
    }
    setAnswers(filled);
  }, "wrap-up");

  const required = BLOCKS.flatMap(requiredIds);
  const missing = required.filter((id) => answers[id] === undefined);
  const canContinue = useDevGate(missing.length === 0);

  async function save() {
    if (!canContinue) return;
    if (participantKey) {
      await getStore().saveResponses(participantKey, "wrap_up", answers);
    }
    logEvent("survey_saved", { block: "wrap_up" });
    router.push(nextHref("wrap-up"));
  }

  return (
    <>
      <Page>
        <Card className="mb-6 border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-extrabold text-indigo-900 shadow-2xs">
              🏁 Final Phase · Study Wrap-Up
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--ink)]">
            Overall Reflection & Final Questions
          </h1>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-700 font-medium">
            These final questions reflect on your experience across both tasks as a whole. Afterwards, a full debriefing will explain the research context in detail.
          </p>
        </Card>

        <div className="space-y-5">
          {BLOCKS.map((block) => (
            <MeasureBlock
              key={block.id}
              block={block}
              answers={answers}
              onChange={(id, value) =>
                setAnswers((prev) => ({ ...prev, [id]: value }))
              }
            />
          ))}
        </div>
      </Page>

      <ActionBar
        label="Submit & Proceed to Study Debriefing"
        onClick={save}
        disabled={!canContinue}
        remaining={missing.length}
        firstUnansweredId={missing[0] ?? null}
        note={missing.length === 0 ? "✓ All questions answered" : ""}
      />
    </>
  );
}
