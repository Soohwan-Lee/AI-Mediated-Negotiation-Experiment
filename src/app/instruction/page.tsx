"use client";

/**
 * Experiment instructions (Methods §3).
 *
 * Reveals the participant's ROLE (Leader/Member) and explains the power
 * asymmetry via French & Raven legitimate + reward power. Pre-announces that a
 * role-based reward decision happens at the end.
 *
 * DECEPTION INTEGRITY: this page describes both interface types generically as
 * things they "may" encounter. It never tells the participant which proxy
 * policy they were assigned, and never labels a session as a condition.
 *
 * Reading and the comprehension check are separate steps. Putting the check at
 * the foot of a long page is what makes people scroll past the reading to get
 * to the buttons.
 *
 * Wrong answers re-present the relevant instruction and require a retry
 * (Methods §3), rather than blocking.
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
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { useRestoreAnswers } from "@/lib/saved-answers";
import { nextHref } from "@/lib/study-config";

interface CheckItem {
  id: string;
  question: string;
  options: Array<{ value: string; label: string }>;
  correct: string;
  remediation: string;
}

const CHECKS: CheckItem[] = [
  {
    id: "obj1",
    question:
      "Who could influence the Member's bonus and future high-visibility assignments?",
    options: [
      { value: "leader", label: "The Leader" },
      { value: "member", label: "The Member" },
      { value: "neither", label: "Neither party" },
      { value: "not_sure", label: "Not sure" },
    ],
    correct: "leader",
    remediation:
      "The Leader holds formal authority: they write the evaluation that feeds into the Member's bonus, and they recommend who is staffed on future high-visibility work.",
  },
  {
    id: "obj2",
    question:
      "Could the Leader finish the project successfully without the Member's expertise?",
    options: [
      { value: "easily", label: "Yes, easily" },
      { value: "difficulty", label: "Only with substantial difficulty or cost" },
      { value: "no", label: "No" },
      { value: "not_sure", label: "Not sure" },
    ],
    correct: "difficulty",
    remediation:
      "The project depends on the Member's specialist expertise. The Leader cannot simply direct the outcome — both sides have to negotiate.",
  },
  {
    id: "obj3",
    question:
      "When a software tool negotiates for you, what happens to the agreement it reaches?",
    options: [
      { value: "binding", label: "It is final and binding straight away" },
      {
        value: "tentative",
        label: "It is tentative until you review and decide on it",
      },
      { value: "discarded", label: "It is discarded and you start over" },
    ],
    correct: "tentative",
    remediation:
      "Anything reached on your behalf is tentative and non-binding until you review it and choose to accept, revise, or reject it.",
  },
];

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
                You will complete <strong>two negotiations</strong>, each on a
                different workplace scenario, each about ten minutes. Before
                each one you get a short practice round on the same interface.
              </p>
              <p>
                In each session you get a private briefing: what matters to you,
                what each option is worth to you, and what happens if there is
                no agreement. It is yours alone — the other party has a
                different one and cannot see yours.
              </p>
              <p>
                <strong>The two sessions use different interfaces.</strong> In
                one, you write messages and make offers yourself. In the other,
                you set instructions and limits for a software tool, which then
                negotiates with the other party&apos;s tool while you wait. Each
                one is explained when you reach it.
              </p>
              <p>
                When a tool negotiates for you, what it reaches is{" "}
                <strong>tentative</strong>. Nothing is settled until you review
                it and choose to accept it, ask for one revision, or reject it.
              </p>
            </div>
          </Card>

          <Callout title="At the end of the study" tone="warning">
            {isLeader ? (
              <p>
                After both sessions you will make a reward decision about the
                other party, reflecting your authority in this scenario.
              </p>
            ) : (
              <p>
                After both sessions you will see the reward decision the Project
                Leader made about you, reflecting their authority in this
                scenario.
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
          note="Next: three quick questions"
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
          title="Three quick questions"
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
