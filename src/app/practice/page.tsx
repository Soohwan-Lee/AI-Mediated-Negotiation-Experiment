"use client";

/**
 * Practice round (Experimental Design Ver.2.4 §8 step 4).
 *
 * A short neutral scenario that does not overlap with Task A or B, run on the
 * same controls the real tasks use, so nothing in a real task is a surprise.
 * Practice data is kept for comprehension and debugging only and is excluded
 * from the primary analysis.
 *
 * ONE PRACTICE ROUND, NOT TWO. The old flow put one before each task, which
 * meant the second was a rehearsal of an interface the participant had already
 * used twice — and cost four minutes to teach nothing.
 *
 * PRAC1 IS HERE FOR A REASON. Design §5 adds a payoff–reason check because a
 * participant who reads only the score column will optimize points and ignore
 * the situation, and the situation is what the study is about. It is asked
 * where a correct answer is a REASON rather than a number, so answering it
 * requires having read the two together.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OptionChips } from "@/components/issues";
import {
  MessageComposer,
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";
import { BriefingPanel, TaskLayout } from "@/components/session";
import { ActionBar, BackButton } from "@/components/study-chrome";
import {
  Callout,
  Card,
  CardTitle,
  ChoiceList,
  Page,
  PageHeader,
} from "@/components/ui";
import { isProxyCondition, sessionPlan } from "@/lib/assignment";
import { useDevBypass } from "@/lib/dev-mode";
import { PRACTICE_REASON_ANSWER, practiceReasonItem } from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { nextHref } from "@/lib/study-config";
import { PRACTICE_TASK } from "@/lib/tasks";

export default function PracticePage() {
  usePageEnter("practice");

  const router = useRouter();
  const { assignment, logEvent, saveResponses } = useParticipant();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [offer, setOffer] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");
  const [reasonAnswer, setReasonAnswer] = useState("");
  const [reasonSubmitted, setReasonSubmitted] = useState(false);
  const bypass = useDevBypass();

  if (!assignment) {
    return (
      <Page>
        <p className="text-sm text-[var(--ink-2)]">Loading…</p>
      </Page>
    );
  }

  // Which interface the FIRST task uses — this round previews that one.
  const plan = sessionPlan(assignment, 1);
  const isProxy = isProxyCondition(plan.condition);
  const task = PRACTICE_TASK;
  const role = assignment.role;
  const prac1 = practiceReasonItem();
  const reasonCorrect = reasonAnswer === PRACTICE_REASON_ANSWER;

  function finish() {
    logEvent("comprehension_answer", {
      item: "PRAC1",
      answer: reasonAnswer,
      correct: reasonCorrect,
    });
    void saveResponses("practice", { PRAC1: reasonAnswer });
    logEvent("page_complete", undefined, { page: "practice" });
    router.push(nextHref("practice"));
  }

  async function sendPractice(text: string) {
    setMessages((m) => [
      ...m,
      { id: `p${m.length}`, speaker: "participant", text },
    ]);
    setPending(true);
    // Practice keeps a short fixed delay rather than the real range: this
    // round is for learning the controls, and eight seconds of typing
    // indicator to see a canned reply teaches nothing.
    await new Promise((r) => setTimeout(r, 1200));
    setMessages((m) => [
      ...m,
      {
        id: `c${m.length}`,
        speaker: "counterpart",
        text: "thanks — that works for me. || this one's just practice though, so poke at whatever you like.",
      },
    ]);
    setPending(false);
  }

  const canContinue = bypass || (reasonSubmitted && reasonCorrect);

  return (
    <>
      <Page width="wide">
        <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
          <PageHeader
            eyebrow="Practice round"
            title="Try the interface"
            subtitle="Nothing here counts. Take a minute to get used to it."
          />

          <div className="mb-5">
            <Callout title="🔭 What the real tasks look like">
              {isProxy ? (
                <p>
                  In your first task you will set out what you want and which of
                  your reasons may be used, and an AI Proxy will negotiate on
                  your behalf while you watch. You review what it reaches and
                  decide whether to accept it.
                </p>
              ) : (
                <p>
                  In your first task you will write the messages yourself and
                  build up an offer as you go. At the end you decide whether to
                  accept where things landed.
                </p>
              )}
            </Callout>
          </div>

          <Card className="mb-5">
            <CardTitle>📋 The practice scenario</CardTitle>
            <p className="max-w-prose text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
              {task.publicBrief}
            </p>
          </Card>

          <Card className="mb-5 flex flex-col" padded={false}>
            <div className="border-b border-[var(--line)] px-4 py-3">
              <p className="text-[0.875rem] font-medium">💬 Practice messages</p>
            </div>
            <Transcript
              messages={messages}
              pending={pending}
              emptyHint="Send anything to see how this works."
            />
            <MessageComposer
              value={draft}
              onChange={setDraft}
              onSend={(text) => {
                setDraft("");
                void sendPractice(text);
              }}
              disabled={pending}
              placeholder="Try writing something…"
            />
          </Card>

          <Card className="mb-5">
            <CardTitle hint="Choosing a level on each term is how you make an offer.">
              📦 Practice offer
            </CardTitle>
            <div className="space-y-4">
              {task.issues.map((issue) => (
                <div key={issue.id}>
                  <p className="mb-1.5 text-[0.8125rem] font-medium">
                    {issue.label}
                  </p>
                  <p className="mb-2 max-w-prose text-[0.8125rem] text-[var(--ink-2)]">
                    💡 {issue.rationale[role]}
                  </p>
                  <OptionChips
                    issue={issue}
                    role={role}
                    name={`practice-${issue.id}`}
                    value={offer[issue.id] ?? null}
                    onChange={(v) =>
                      setOffer((prev) => ({ ...prev, [issue.id]: v }))
                    }
                    allowNone
                    noneLabel="Not specified"
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card id={`q-${prac1.id}`}>
            <CardTitle hint="One question, so we know the point sheet and the situation are being read together.">
              ✅ Before you start
            </CardTitle>
            <p className="mb-3 max-w-prose text-[0.9375rem] font-medium">
              {prac1.text}
            </p>
            {prac1.kind === "choice" ? (
              <ChoiceList
                name={prac1.id}
                value={reasonAnswer}
                onChange={(v) => {
                  setReasonAnswer(v);
                  setReasonSubmitted(false);
                }}
                options={prac1.options}
              />
            ) : null}
            {reasonSubmitted && !reasonCorrect ? (
              <div className="mt-3">
                <Callout title="Not quite" tone="warning">
                  <p>
                    The points tell you which option is better for you; the
                    briefing tells you why. Look at what a long journey would
                    cost you in the practice scenario.
                  </p>
                </Callout>
              </div>
            ) : null}
          </Card>
        </TaskLayout>
      </Page>

      <ActionBar
        label={canContinue ? "Start Task 1" : "Check my answer"}
        onClick={canContinue ? finish : () => setReasonSubmitted(true)}
        disabled={!canContinue && !reasonAnswer}
        note={
          canContinue
            ? "Practice is not recorded as a result."
            : reasonSubmitted
              ? "Have another look."
              : ""
        }
        secondary={<BackButton from="practice" />}
      />
    </>
  );
}
