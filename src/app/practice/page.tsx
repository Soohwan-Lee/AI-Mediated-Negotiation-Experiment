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
import { BriefingPanel, TaskCover, TaskLayout } from "@/components/session";
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
import { useDevAutofill, useDevBypass } from "@/lib/dev-mode";
import { PRACTICE_REASON_ANSWER, practiceReasonItem } from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { STAGE_MINUTES, nextHref } from "@/lib/study-config";
import { PRACTICE_TASK } from "@/lib/tasks";

export default function PracticePage() {
  usePageEnter("practice");

  const router = useRouter();
  // The cover is a PHASE, not a route: the flow step still comes from the URL
  // alone, so adding a screen here cannot desynchronise the progress bar.
  const [phase, setPhase] = useState<"intro" | "practice">("intro");
  const { assignment, logEvent, saveResponses } = useParticipant();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [offer, setOffer] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");
  const [reasonAnswer, setReasonAnswer] = useState("");
  const [reasonSubmitted, setReasonSubmitted] = useState(false);
  const bypass = useDevBypass();

  // Mockup mode fills this screen like every other: a written message in the
  // composer, both practice terms at this role's best level, and the
  // comprehension answer entered (not yet submitted, so the Check interaction
  // stays visible). Filling is not the same as skipping — an empty practice
  // screen tells a reviewer nothing about whether the round reads.
  useDevAutofill(() => {
    const role = assignment?.role ?? "leader";
    setOffer(
      Object.fromEntries(
        PRACTICE_TASK.issues.map((i) => [
          i.id,
          [...i.options].sort((a, b) => b.points[role] - a.points[role])[0].id,
        ]),
      ),
    );
    setDraft(
      role === "leader"
        ? "hi! for me the date is the main thing — could we do next week, and I'm happy to keep the venue wherever suits you?"
        : "hi! the venue is the main thing for me — could we keep it in the office, and I'm flexible on the date?",
    );
    setReasonAnswer(PRACTICE_REASON_ANSWER);
  }, `practice-${phase}`);

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

  if (phase === "intro") {
    return (
      <TaskCover
        eyebrow="Tutorial · Practice Round"
        title="Quick Practice Round"
        doesNotCount
        scene="practice"
        lead={
          <>
            <p className="mb-2">
              This practice round lets you test the negotiation tools on a simple, neutral scenario before starting the real tasks.
            </p>
            <p className="text-slate-600">
              Nothing you do during this practice round will affect your score or recorded outcomes. Feel free to explore!
            </p>
          </>
        }
        steps={[
          { label: "Review the practice scenario & private briefing", hint: "Check the sidebar for your goals and point values" },
          { label: "Send a sample message", hint: "A simulated automated response will reply instantly" },
          { label: "Select sample terms", hint: "Test how selecting options builds an offer" },
          { label: "Answer 1 quick question", hint: "Verify how the point sheet relates to your goals" },
        ]}
        minutes={STAGE_MINUTES.practice}
        note={
          <Callout title="ℹ️ No Time Pressure" tone="neutral">
            <p>
              Task 1 only begins when you click &apos;Start Task 1&apos;. Take your time exploring the controls.
            </p>
          </Callout>
        }
        actionLabel="Start the practice round"
        onStart={() => setPhase("practice")}
        secondary={<BackButton from="practice" />}
      />
    );
  }

  return (
    <>
      <Page width="wide">
        <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
          <PageHeader
            eyebrow="Practice Round · Safe Sandbox"
            title="Try the Negotiation Interface"
            subtitle="Explore how messaging, offer selection, and your private briefing work together. Nothing here counts."
          />

          <div className="mb-6">
            <Callout title="🔭 About Your Upcoming Real Tasks" tone="neutral">
              {isProxy ? (
                <p>
                  In Task 1, you will configure your initial goals and permitted reasons, observe an <strong>AI Proxy</strong> negotiate on your behalf, and then <strong>take over directly to close the deal</strong>.
                </p>
              ) : (
                <p>
                  In Task 1, you will chat directly, send offers, and negotiate until both of you <strong>agree on all project terms</strong>.
                </p>
              )}
            </Callout>
          </div>

          <Card className="mb-6 border-slate-200 bg-white">
            <CardTitle hint="This neutral scenario is for practice only:">
              📋 The Practice Scenario
            </CardTitle>
            <p className="text-sm sm:text-base leading-relaxed text-[var(--ink-2)]">
              {task.publicBrief}
            </p>
          </Card>

          <Card className="mb-6 flex flex-col overflow-hidden border-slate-200" padded={false}>
            <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5 flex items-center justify-between">
              <p className="text-xs sm:text-sm font-bold text-[var(--ink)]">💬 Practice Chatbox</p>
              <span className="text-xs font-semibold text-slate-500">Interactive Sandbox</span>
            </div>
            <Transcript
              messages={messages}
              pending={pending}
              emptyHint="Send a message below to test the chat response!"
            />
            <MessageComposer
              value={draft}
              onChange={setDraft}
              onSend={(text) => {
                setDraft("");
                void sendPractice(text);
              }}
              disabled={pending}
              placeholder="Type a test message here…"
            />
          </Card>

          <Card className="mb-6">
            <CardTitle hint="Selecting an option on each term creates a proposal package:">
              📦 Practice Offer Builder
            </CardTitle>
            <div className="space-y-5 mt-3">
              {task.issues.map((issue) => (
                <div key={issue.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                  <p className="mb-1 text-xs sm:text-sm font-bold text-[var(--ink)]">
                    {issue.label}
                  </p>
                  <p className="mb-2.5 text-xs text-[var(--ink-3)]">
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

          <Card id={`q-${prac1.id}`} className={cx(reasonSubmitted && reasonCorrect ? "border-emerald-300 bg-emerald-50/20" : "")}>
            <CardTitle hint="One quick question to confirm the point sheet and scenario rationale are clear:">
              ✅ Quick Check Before Task 1
            </CardTitle>
            <p className="mb-3 text-sm sm:text-base font-bold text-[var(--ink)]">
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
              <div className="mt-3.5">
                <Callout title="💡 Tip" tone="warning">
                  <p>
                    Points indicate which option yields a higher score for your situation; the briefing explains why. Consider what a longer journey would cost in the scenario.
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
            ? "✓ Ready! Practice data is not recorded as a task result."
            : reasonSubmitted
              ? "⚠️ Please review your selected answer."
              : ""
        }
        secondary={<BackButton from="practice" />}
      />
    </>
  );
}
