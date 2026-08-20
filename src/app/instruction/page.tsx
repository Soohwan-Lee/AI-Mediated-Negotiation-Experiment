"use client";

/**
 * Experiment instructions (Experimental Design Ver.2.4 §6 공통 안내, §8 step 3).
 *
 * Reveals the participant's ROLE and explains the power asymmetry — legitimate
 * authority plus the reward power that makes it bite. Pre-announces that the
 * Leader decides a bonus after each task, because a reward decision that
 * arrived unannounced would be a surprise rather than a standing power
 * relation.
 *
 * DECEPTION INTEGRITY: this page describes both interface types generically as
 * things they "may" encounter. It never tells the participant which proxy
 * policy they were assigned, and never labels a task as a condition.
 *
 * NO WORKED LOGROLL EXAMPLE. An earlier version taught the trade on a lunch
 * scenario, so that a comprehension item could ask about it. ver.2.4 deleted
 * that item (§9.1.3, COMP3 removed) and the teaching has to go with it: pilot
 * gate 6 fails if participants open on the full logroll without ever
 * exchanging priorities, and an interface that hands them the answer is the
 * surest way to produce that. Finding the trade is behaviour to be observed,
 * not a skill to be trained.
 *
 * Reading and the comprehension check are separate steps. Putting the check at
 * the foot of a long page is what makes people scroll past the reading to get
 * to the buttons.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ActionBar, BackButton } from "@/components/study-chrome";
import {
  Callout,
  Card,
  CardTitle,
  ChoiceList,
  Page,
  PageHeader,
} from "@/components/ui";
import { useDevAutofill, useDevBypass } from "@/lib/dev-mode";
import {
  COMPREHENSION_ANSWERS,
  COMPREHENSION_BLOCK,
  COMPREHENSION_REMEDIATION,
} from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { useRestoreAnswers } from "@/lib/saved-answers";
import { STUDY, nextHref } from "@/lib/study-config";

/**
 * The three comprehension items (Design §9.1.3). Wording, correct answers and
 * the text to re-show on a wrong answer all live in `lib/measures` with the
 * rest of the instrument — this page only decides how they behave.
 */
interface CheckItem {
  id: string;
  question: string;
  options: Array<{ value: string; label: string }>;
  correct: string;
  remediation: string;
}

const CHECKS: CheckItem[] = COMPREHENSION_BLOCK.items.flatMap((item) =>
  item.kind === "choice"
    ? [
        {
          id: item.id,
          question: item.text,
          options: item.options,
          correct: COMPREHENSION_ANSWERS[item.id],
          remediation: COMPREHENSION_REMEDIATION[item.id],
        },
      ]
    : [],
);

export default function InstructionPage() {
  usePageEnter("instruction");
  const router = useRouter();
  const { assignment, logEvent, saveResponses } = useParticipant();
  const [part, setPart] = useState<"read" | "check">("read");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState(1);

  const isLeader = (assignment?.role ?? "member") === "leader";

  const wrong = useMemo(
    () => CHECKS.filter((c) => answers[c.id] && answers[c.id] !== c.correct),
    [answers],
  );
  const allAnswered = CHECKS.every((c) => answers[c.id]);
  const allCorrect = allAnswered && wrong.length === 0;

  useDevAutofill(() =>
    setAnswers(Object.fromEntries(CHECKS.map((c) => [c.id, c.correct]))),
  );

  // Dev mode skips the answer-and-retry loop rather than just enabling a
  // button, so an unanswered check cannot trap a walkthrough.
  const bypass = useDevBypass();

  // Reachable again via Back from the first practice round, so the answers are
  // stored rather than only logged.
  useRestoreAnswers("instruction_check", (saved) => {
    const restored = Object.fromEntries(
      CHECKS.map((c) => [c.id, saved[c.id]]).filter(
        ([, v]) => typeof v === "string",
      ),
    ) as Record<string, string>;
    if (Object.keys(restored).length > 0) {
      setAnswers((cur) => ({ ...restored, ...cur }));
    }
  });

  function check() {
    setSubmitted(true);
    logEvent("comprehension_answer", {
      attempt,
      answers,
      correctCount: CHECKS.length - wrong.length,
    });
    void saveResponses("instruction_check", answers);
    if (wrong.length > 0) setAttempt((a) => a + 1);
  }

  function retry() {
    // Clear only the wrong ones, so they re-answer those.
    setAnswers((prev) => {
      const next = { ...prev };
      for (const c of wrong) delete next[c.id];
      return next;
    });
    setSubmitted(false);
  }

  function goNext() {
    logEvent("page_complete", undefined, { page: "instruction" });
    router.push(nextHref("instruction"));
  }

  // --- part 1: reading ---------------------------------------------------
  if (part === "read") {
    return (
      <>
        <Page>
          <PageHeader
            eyebrow="Part 1 of 2 · Instructions"
            title="Your role, and how this works"
            subtitle="Read this carefully — you will be asked a few questions about it next."
          />

          <Card className="mb-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-3)]">
              You have been assigned the role of
            </p>
            <p className="mb-4 text-2xl font-semibold tracking-[-0.02em]">
              {isLeader ? "Project Leader" : "Team Member"}
            </p>

            <div className="prose-study">
              {isLeader ? (
                <>
                  <p>
                    You hold formal authority over the project. You approve work
                    assignments, you write the performance evaluation that feeds
                    into bonus decisions, and you recommend who is staffed on
                    future high-visibility projects.
                  </p>
                  <p>
                    At the same time, the project depends on the Team
                    Member&apos;s specialist expertise and their willingness to
                    take part. You cannot simply issue instructions and get the
                    outcome you want — you need an agreement.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    You hold the specialist expertise the project depends on,
                    and you may decline extra participation or accept it on
                    conditions.
                  </p>
                  <p>
                    At the same time, the Project Leader holds formal authority.
                    They approve work assignments, write the performance
                    evaluation that feeds into bonus decisions, and recommend
                    who is staffed on future high-visibility projects. Your
                    evaluation and future opportunities depend on their
                    assessment.
                  </p>
                </>
              )}
              <p>
                Neither side can settle everything alone. Both of you have to
                negotiate.
              </p>
            </div>
          </Card>

          <Card className="mb-5">
            <CardTitle>What you will do</CardTitle>
            <div className="prose-study">
              <p>
                You will complete <strong>two negotiation tasks</strong>, each
                on a different workplace scenario. Each negotiation has a{" "}
                <strong>ten-minute limit</strong>. Before the first one there is
                a short practice round.
              </p>
              <p>
                After each task you answer some questions about how it went, and
                then the bonus for that task is decided.
              </p>
              <p>
                Each negotiation settles <strong>three terms</strong>, and each
                term has four options. You and the other party have to agree on
                the same option for all three, or the project falls back to a
                limited plan and you both take your fallback score.
              </p>
              <p>
                In each task you get a private briefing: your situation, what
                each option is worth to you in points, the reasons behind what
                you are asking for, and what happens if there is no agreement.
                It is yours alone — the other person has a different one and
                cannot see yours. You may explain why a term matters to you and
                ask what matters to them, but you may not show them your point
                sheet or tell them the numbers on it.
              </p>
              <p>
                <strong>The two tasks use different interfaces.</strong> In one,
                you write the messages and make the offers yourself. In the
                other, you set out what you want and which of your reasons may
                be used, and an <strong>AI Proxy</strong> negotiates on your
                behalf with the other person&apos;s AI Proxy while you both
                watch. Each is explained when you reach it.
              </p>
              <p>
                When an AI Proxy negotiates for you, what it reaches is{" "}
                <strong>tentative</strong>. Nothing is settled until you review
                it and choose to accept it, ask for one change, or reject it.
              </p>
            </div>
          </Card>

          <Callout title="💰 After each task" tone="warning">
            {isLeader ? (
              <p>
                As the Leader, you decide the other participant&apos;s bonus for
                that task — up to ${STUDY.bonusPerTaskUsd} each time, $
                {STUDY.bonusTotalUsd} across both. You are asked to weigh up
                both how the negotiation turned out and how they conducted
                themselves.
              </p>
            ) : (
              <p>
                The Leader decides your bonus for that task — up to $
                {STUDY.bonusPerTaskUsd} each time, ${STUDY.bonusTotalUsd} across
                both. They are asked to weigh up both how the negotiation turned
                out and how you conducted yourself.
              </p>
            )}
          </Callout>
        </Page>

        <ActionBar
          label="I have read this"
          onClick={() => {
            setPart("check");
            window.scrollTo({ top: 0 });
          }}
          note={`Next: ${CHECKS.length} quick questions`}
          secondary={<BackButton from="instruction" />}
        />
      </>
    );
  }

  // --- part 2: comprehension check ---------------------------------------
  const canContinue = (submitted && allCorrect) || bypass;

  return (
    <>
      <Page>
        <PageHeader
          eyebrow="Part 2 of 2 · Instructions"
          title="A few quick questions"
          subtitle="These just confirm the setup is clear. If one is wrong you can try again."
        />

        <div className="space-y-5">
          {CHECKS.map((c) => {
            const answered = answers[c.id];
            const isWrong = submitted && answered && answered !== c.correct;
            return (
              <Card key={c.id}>
                <p className="mb-3 text-[0.9375rem] font-medium">{c.question}</p>
                <ChoiceList
                  name={c.id}
                  value={answered ?? ""}
                  onChange={(v) =>
                    setAnswers((prev) => ({ ...prev, [c.id]: v }))
                  }
                  options={c.options}
                />
                {isWrong ? (
                  <div className="mt-3">
                    <Callout title="Not quite" tone="warning">
                      <p>{c.remediation}</p>
                    </Callout>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      </Page>

      <ActionBar
        label={canContinue ? "Continue" : submitted ? "Try again" : "Check answers"}
        onClick={canContinue ? goNext : submitted ? retry : check}
        disabled={!canContinue && !submitted && !allAnswered}
        note={
          submitted && !allCorrect
            ? `${wrong.length} to look at again`
            : submitted && allCorrect
              ? "All correct."
              : ""
        }
      />
    </>
  );
}
