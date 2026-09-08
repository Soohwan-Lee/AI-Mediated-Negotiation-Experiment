"use client";

/**
 * REMARK — the counterpart's parting comment, and ATTR (Design §6.8, §9.4.9).
 *
 * WHAT IT IS. After the post-negotiation decision, the participant is shown
 * one line "the other participant left for you". It is scripted, identical for
 * everyone, and the participant may leave one back (`REMARK_REPLY` — optional,
 * never analysed, and it is there so a one-way comment does not read as odd).
 *
 * WHY IT EXISTS. Transplanted from chen2026's "AI phantom limb" procedure: a
 * client leaves a one-line comment for an agent, and the finding is that
 * NEGATIVE feedback aimed at the agent is still internalized by the person who
 * delegated. That is this study's delegation–protection gap in another domain,
 * so §6.8 imports the procedure to test whether delegation moves the RECEIPT
 * of an evaluation as well as the speaking of it.
 *
 * FIVE RULES, and every one is a constraint that makes the contrast readable:
 *
 *  1. CONSTANT WORDING. Same text for every tier, condition, role and task.
 *     The only thing that changes is who it points at — the participant, or
 *     their Proxy — and that difference IS the Mode. Tiering the valence would
 *     tangle the comment with the outcome the participant earned; randomizing
 *     it would halve every cell (chen2026 needed 355 between-subjects for
 *     η²p = .013).
 *  2. DEMAND LEVEL ONLY, NEVER THE REASONS OR GENERATED TONE. A comment on what was disclosed would
 *     tangle with the disclosure decision and become a face attack of its own.
 *  3. MILDLY NEGATIVE: a subjective impression of the demands, without
 *     asserting a particular opening behavior (2026-09-06 correction).
 *  4. AFTER EVERY CONFIRMATORY MEASURE. PERC, PCR, PNPQ, PNOQ, OWN/OTHER-AI
 *     and the post-negotiation decision are all done before this appears, so
 *     it cannot contaminate RQ2.
 *  5. DISCLOSED AT DEBRIEFING as one of the four deceptions.
 *
 * ATTR1 is asked of everyone; ATTR2 only where there is a Proxy to point at.
 */

import { useState } from "react";
import { MeasureBlock, type Answers } from "@/components/measure";
import { ActionBar } from "@/components/study-chrome";
import { Card, CardTitle, Page } from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import {
  ATTR_BLOCK,
  ATTR_PROXY_ITEM,
  REMARK_REPLY_ITEM,
  blockForTask,
  dummyAnswer,
  requiredIds,
} from "@/lib/measures";
import type { Block } from "@/lib/measures";

/**
 * The fixed comment (§6.8). Two variants and no more: the referent is the
 * participant under Direct and their Proxy under either Proxy policy, which is
 * exactly the Mode contrast. The impasse variant changes only the first
 * sentence, because "glad we sorted it" would be false.
 */
export function remarkText(isProxy: boolean, agreed: boolean): string {
  // "That's a shame" for the impasse: §6.8's rule is that only the FIRST
  // sentence changes, because "glad we sorted it" would be false.
  const opener = agreed ? "Glad we sorted it." : "That's a shame.";
  /**
   * THE ONLY THING THAT VARIES IS WHO IT POINTS AT, and that difference IS
   * the Mode (§6.8 rule 1).
   *
   * "PASSED ON", NOT "PUT FORWARD". §6.8 targets the participant's own DEMAND
   * LEVEL in both arms — under Proxy it is "그쪽 Proxy가 전한 요구", the ask the
   * Proxy RELAYED. "Put forward" reads as the Proxy having chosen the ask
   * itself, which points the comment at something the system decided rather
   * than at something the participant did; that is the exact confound rule 3
   * excludes, and it would make ATTR2's Mode contrast a measurement error
   * instead of a finding.
   */
  const subject = isProxy
    ? "the ask your Proxy passed on"
    : "your ask";
  return `${opener} Honestly, I felt ${subject} was a bit strong.`;
}

export function RemarkPhase({
  taskIndex,
  isProxy,
  agreed,
  onDone,
}: {
  taskIndex: 1 | 2;
  isProxy: boolean;
  agreed: boolean;
  onDone: (answers: Answers) => void;
}) {
  const [answers, setAnswers] = useState<Answers>({});

  // ATTR2 rides inside the same block rather than a second screen: it is the
  // same question asked twice over (did it stick, and who did it land on), and
  // splitting them would put a page break between them.
  const block: Block = blockForTask(
    isProxy
      ? {
          ...ATTR_BLOCK,
          items: [ATTR_BLOCK.items[0], ATTR_PROXY_ITEM, ...ATTR_BLOCK.items.slice(1)],
        }
      : ATTR_BLOCK,
    taskIndex,
  );
  /**
   * The reply box, as a block of its own so it can sit WITH the comment rather
   * than among the ATTR items — see `REMARK_REPLY_ITEM`. It is never in
   * `required`, so Continue is not gated on it.
   */
  const replyBlock: Block = blockForTask(
    {
      id: "remark_reply",
      title: "Would you like to say anything back?",
      hint: "Optional",
      items: [REMARK_REPLY_ITEM],
      optional: [REMARK_REPLY_ITEM.id],
    },
    taskIndex,
  );

  const required = requiredIds(block);
  const missing = required.filter((id) => answers[id] === undefined);
  const canContinue = useDevGate(missing.length === 0);

  useDevAutofill(() => {
    const filled: Answers = {};
    for (const item of [...replyBlock.items, ...block.items]) {
      filled[item.id] = dummyAnswer(item);
    }
    setAnswers((prev) => ({ ...prev, ...filled }));
  }, `remark-${taskIndex}`);

  return (
    <>
      <Page>
        {/* The comment sits on a SHARED surface (interface rule 1): it came
            from the other side, so it is not private to the participant. */}
        <Card className="mb-6 border-slate-200 bg-white">
          <CardTitle hint={`Task ${taskIndex} of 2`}>
            A note from the other participant
          </CardTitle>
          <blockquote className="mt-3 border-l-2 border-[var(--accent)] pl-4 text-sm leading-relaxed text-[var(--ink)]">
            {remarkText(isProxy, agreed)}
          </blockquote>

        </Card>

        {/* THE REPLY, AND IT IS NOT A MEASURE (§6.8). Nothing reads it; it is
            here so a one-way comment does not read as odd — the other side
            left something, and a screen with no way to answer makes the
            exchange read as staged. It comes BEFORE the ATTR items and after
            the comment, so replying is answering the person rather than a
            first draft of "what went through your mind". Optional, and
            Continue is not gated on it: pressing on without answering has to
            stay as ordinary as answering. */}
        <MeasureBlock
          block={replyBlock}
          answers={answers}
          onChange={(id, value) =>
            setAnswers((prev) => ({ ...prev, [id]: value }))
          }
        />

        <MeasureBlock
          block={block}
          answers={answers}
          onChange={(id, value) =>
            setAnswers((prev) => ({ ...prev, [id]: value }))
          }
        />
      </Page>

      <ActionBar
        label="Continue"
        onClick={() => canContinue && onDone(answers)}
        disabled={!canContinue}
        remaining={missing.length}
        firstUnansweredId={missing[0] ?? null}
        note={missing.length === 0 ? "✓ Ready to continue" : ""}
      />
    </>
  );
}
