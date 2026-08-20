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
        <Card className="mb-6">
          <CardTitle hint="Last set of questions — then we explain what the study was about.">
            🏁 Almost done
          </CardTitle>
          <p className="prose-study text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            These questions are about the two tasks together, rather than about
            either one on its own.
          </p>
        </Card>

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
      </Page>

      <ActionBar
        label="Finish and see the explanation"
        onClick={save}
        disabled={!canContinue}
        remaining={missing.length}
        firstUnansweredId={missing[0] ?? null}
        note={missing.length === 0 ? "All answered." : ""}
      />
    </>
  );
}
