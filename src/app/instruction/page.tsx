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
 * Ends with an objective comprehension check. Wrong answers re-present the
 * relevant instruction and require a retry (Methods §3), rather than blocking.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDevAutofill, useDevBypass } from "@/lib/dev-mode";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { nextHref, stepNumber } from "@/lib/study-config";
import {
  Button,
  Callout,
  Card,
  Divider,
  PageHeader,
  PageShell,
  ProgressBar,
  RadioGroup,
} from "@/components/ui";

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
      "The Leader holds formal authority: they write the evaluation that feeds into the Member's bonus and recommend who is staffed on future high-visibility work.",
  },
  {
    id: "obj2",
    question:
      "Could the Leader complete the project successfully without the Member's expertise and participation?",
    options: [
      { value: "easily", label: "Yes, easily" },
      {
        value: "difficulty",
        label: "Only with substantial difficulty or cost",
      },
      { value: "no", label: "No" },
      { value: "not_sure", label: "Not sure" },
    ],
    correct: "difficulty",
    remediation:
      "The project depends on the Member's specialist expertise. The Leader cannot simply direct the outcome — both sides need to negotiate.",
  },
  {
    id: "obj3",
    question:
      "When a software tool negotiates on your behalf, what happens to the agreement it reaches?",
    options: [
      { value: "binding", label: "It is final and binding immediately" },
      {
        value: "tentative",
        label: "It is tentative until you review and decide on it",
      },
      { value: "discarded", label: "It is discarded and you start over" },
    ],
    correct: "tentative",
    remediation:
      "Any agreement reached on your behalf is tentative and non-binding until you review it and choose to accept, revise, or reject it.",
  },
];

export default function InstructionPage() {
  usePageEnter("instruction");
  const router = useRouter();
  const { assignment, logEvent } = useParticipant();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState(1);

  const role = assignment?.role ?? "member";
  const isLeader = role === "leader";

  const wrong = useMemo(
    () => CHECKS.filter((c) => answers[c.id] && answers[c.id] !== c.correct),
    [answers],
  );
  const allAnswered = CHECKS.every((c) => answers[c.id]);
  const allCorrect = allAnswered && wrong.length === 0;

  useDevAutofill(() =>
    setAnswers(Object.fromEntries(CHECKS.map((c) => [c.id, c.correct]))),
  );

  // Dev mode skips the answer-and-retry loop entirely rather than just
  // enabling the button, so an unanswered check does not trap the walkthrough.
  const bypass = useDevBypass();
  const canContinue = (submitted && allCorrect) || bypass;

  function goNext() {
    logEvent("page_complete", undefined, { page: "instruction" });
    router.push(nextHref("instruction"));
  }

  function handleCheck() {
    setSubmitted(true);
    logEvent("comprehension_answer", {
      attempt,
      answers,
      correctCount: CHECKS.length - wrong.length,
    });
    if (wrong.length > 0) {
      setAttempt((a) => a + 1);
    }
  }

  function handleRetry() {
    // Clear only the incorrect answers so the participant re-answers those.
    setAnswers((prev) => {
      const next = { ...prev };
      for (const c of wrong) delete next[c.id];
      return next;
    });
    setSubmitted(false);
  }

  const { step, total } = stepNumber("instruction");

  return (
    <PageShell>
      <ProgressBar step={step} total={total} label="Instructions" />
      <PageHeader
        title="Your role and how this works"
        subtitle="Please read carefully. You will be asked a few questions about this at the end."
      />

      <Card className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[var(--muted)]">
          Your assigned role
        </p>
        <h2 className="mb-3 text-xl font-semibold">
          {isLeader ? "Project Leader" : "Team Member"}
        </h2>
        <div className="prose-study text-sm">
          {isLeader ? (
            <>
              <p>
                You are the <strong>Project Leader</strong>. You hold formal
                authority over the project. You approve work assignments, you
                write the performance evaluation that feeds into bonus
                decisions, and you recommend who is staffed on future
                high-visibility projects.
              </p>
              <p>
                At the same time, the project depends on the Team Member&apos;s
                specialist expertise and their willingness to take part. You
                cannot simply issue instructions and get the outcome you want —
                you need an agreement.
              </p>
            </>
          ) : (
            <>
              <p>
                You are the <strong>Team Member</strong>. You hold the
                specialist expertise the project depends on, and you may decline
                additional participation or accept it on conditions.
              </p>
              <p>
                At the same time, the Project Leader holds formal authority.
                They approve work assignments, write the performance evaluation
                that feeds into bonus decisions, and recommend who is staffed on
                future high-visibility projects. Your evaluation and future
                opportunities depend on their assessment.
              </p>
            </>
          )}
          <p>
            Neither side can settle every issue alone. Both of you need to
            negotiate rather than one party simply issuing instructions.
          </p>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-base font-semibold">
          What you will do
        </h2>
        <div className="prose-study text-sm">
          <p>
            You will complete <strong>two negotiation sessions</strong>, each on
            a different workplace scenario, and each lasting about 10 minutes.
            Before each session you will get a short practice round using the
            same interface, so you can get comfortable with it.
          </p>
          <p>
            In each session you will receive a private briefing: what matters to
            you, what each option is worth to you, and what happens if no
            agreement is reached. This briefing is yours alone — the other party
            has a different one and cannot see yours.
          </p>
          <p>
            <strong>The two sessions use different interfaces.</strong> In one,
            you will write messages and exchange offers yourself. In the other,
            you will set instructions and boundaries for a software tool, which
            then negotiates with the other party&apos;s tool on your behalf
            while you wait. You will see exactly how each interface works when
            you reach it.
          </p>
          <p>
            When a tool negotiates for you, whatever it reaches is{" "}
            <strong>tentative and non-binding</strong>. Nothing is settled until
            you review it and decide whether to accept it, ask for one revision,
            or reject it.
          </p>
        </div>
      </Card>

      <Callout title="At the end of the study" tone="warning">
        {isLeader ? (
          <p>
            After both sessions, you will be asked to make a reward decision
            regarding the other party, reflecting your authority in this
            scenario.
          </p>
        ) : (
          <p>
            After both sessions, you will see the reward decision that the
            Project Leader made regarding you, reflecting their authority in
            this scenario.
          </p>
        )}
      </Callout>

      <Divider />

      <Card>
        <h2 className="mb-1 text-base font-semibold">Quick check</h2>
        <p className="mb-4 text-xs text-[var(--muted)]">
          Please answer these to confirm the setup is clear.
        </p>

        <div className="space-y-6">
          {CHECKS.map((c) => {
            const answered = answers[c.id];
            const isWrong = submitted && answered && answered !== c.correct;
            return (
              <div key={c.id}>
                <p className="mb-2 text-sm font-medium">{c.question}</p>
                <RadioGroup
                  name={c.id}
                  value={answered ?? ""}
                  onChange={(v) =>
                    setAnswers((prev) => ({ ...prev, [c.id]: v }))
                  }
                  options={c.options}
                />
                {isWrong ? (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <p className="mb-1 font-semibold">
                      Not quite — please review:
                    </p>
                    <p>{c.remediation}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-[var(--muted)]">
            {submitted && allCorrect
              ? "All correct."
              : submitted && wrong.length > 0
                ? `${wrong.length} to review.`
                : ""}
          </p>
          {canContinue ? (
            <Button onClick={goNext}>Continue</Button>
          ) : submitted ? (
            <Button onClick={handleRetry}>Try again</Button>
          ) : (
            <Button onClick={handleCheck} disabled={!allAnswered}>
              Check answers
            </Button>
          )}
        </div>
      </Card>
    </PageShell>
  );
}
