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
import { useMemo, useState, type ReactNode } from "react";
import { ActionBar, BackButton } from "@/components/study-chrome";
import {
  Callout,
  Card,
  CardTitle,
  ChoiceList,
  Page,
  PageHeader,
  cx,
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

/**
 * One fact from the instructions, under a heading that names it.
 *
 * The emoji is a landmark, not decoration: it is what lets someone who read
 * this page five minutes ago find the paragraph about their point sheet again
 * without re-reading the card. It is `aria-hidden` because the heading beside
 * it already says the same thing in words.
 */
function Fact({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:p-4 shadow-2xs">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-2xs border border-slate-200">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="mb-1 text-sm sm:text-base font-bold text-[var(--ink)]">{title}</p>
        <p className="text-xs sm:text-sm leading-relaxed text-[var(--ink-2)]">
          {children}
        </p>
      </div>
    </div>
  );
}

function Gist({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 sm:flex-nowrap rounded-xl bg-white/80 p-2.5 border border-slate-100 shadow-2xs">
      <dt className="w-24 shrink-0 text-xs font-extrabold uppercase tracking-wider text-[var(--accent)]">
        {term}
      </dt>
      <dd className="min-w-0 flex-1 text-xs sm:text-sm leading-relaxed text-slate-800 font-medium">
        {children}
      </dd>
    </div>
  );
}

function PowerBox({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "own" | "theirs";
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border p-4 sm:p-5 transition-all shadow-2xs",
        tone === "own"
          ? "border-blue-200 bg-blue-50/50 text-blue-950"
          : "border-slate-200 bg-slate-50/70 text-slate-800",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm">{tone === "own" ? "🧑‍💼" : "👤"}</span>
        <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
          {title}
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed text-[var(--ink-2)]"
          >
            <span aria-hidden className="text-blue-600 font-bold">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

  const bypass = useDevBypass();

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
            eyebrow="Tutorial · Instructions (Part 1/2)"
            title="Your Role and Study Instructions"
            subtitle="Please read these instructions carefully. A 3-question comprehension check follows on the next screen."
          />

          {/* Quick Gist card */}
          <Card className="mb-6 border-indigo-100 bg-gradient-to-br from-indigo-50/40 to-blue-50/20">
            <CardTitle hint="At a glance:">
              🎯 Study Overview in 4 Lines
            </CardTitle>
            <dl className="space-y-2.5 mt-3">
              <Gist term="Your Role">
                You are assigned as a <strong>{isLeader ? "Project Leader 👑" : "Team Member 🛠️"}</strong> on a workplace project.
              </Gist>
              <Gist term="Partner">
                You will negotiate with one other participant playing the opposite role.
              </Gist>
              <Gist term="The Task">
                Reach agreement on <strong>3 project terms</strong>. Neither person can decide terms alone.
              </Gist>
              <Gist term="The Catch">
                You each have different goals, and <strong>only you can see your private point payoffs</strong>.
              </Gist>
            </dl>
          </Card>

          {/* Role & Power Asymmetry Card */}
          <Card className="mb-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--accent)]">
                  Your Assigned Role
                </p>
                <h2 className="text-2xl font-black tracking-tight text-[var(--ink)] sm:text-3xl">
                  {isLeader ? "👑 Project Leader" : "🛠️ Team Member"}
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900 shadow-2xs">
                Role Confirmed
              </span>
            </div>

            <div className="grid items-start gap-4 sm:grid-cols-2">
              <PowerBox
                title="What You Hold (Your Authority & Power)"
                tone="own"
                items={
                  isLeader
                    ? [
                        "Formal authority over the overall project",
                        "Approval power over final work assignments",
                        "You write the evaluation that directly feeds into bonus payments",
                        "You recommend who gets staffed on future high-visibility projects",
                      ]
                    : [
                        "Specialist domain expertise that the project critically depends on",
                        "Autonomy to decline extra tasks or accept them with conditions",
                      ]
                }
              />
              <PowerBox
                title={
                  isLeader
                    ? "What the Team Member Holds"
                    : "What the Project Leader Holds"
                }
                tone="theirs"
                items={
                  isLeader
                    ? [
                        "Specialist expertise the project depends on",
                        "Willingness to execute — you cannot force high-quality work by simple decree",
                      ]
                    : [
                        "Formal authority over the overall project",
                        "Approval power over work assignments",
                        "Writes the performance evaluation for your bonus",
                        "Recommends staffing on future high-visibility projects",
                      ]
                }
              />
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs sm:text-sm font-semibold leading-relaxed text-slate-800">
              💡 {isLeader
                ? "Neither side can settle everything alone. You need to negotiate a mutually acceptable agreement."
                : "Your evaluation and bonus depend on the Leader's assessment — and neither side can settle alone. You must negotiate."}
            </div>
          </Card>

          {/* 4 Core Rules */}
          <Card className="mb-6">
            <CardTitle hint="Keep these four principles in mind during every session:">
              How the Negotiation Works
            </CardTitle>
            <div className="space-y-3 mt-3">
              <Fact icon="🗂️" title="Two Negotiation Tasks">
                Each negotiation has a <strong>10-minute time limit</strong> (you can finish earlier if you agree). A quick practice round comes first.
              </Fact>

              <Fact icon="📊" title="Three Terms, Four Options Each">
                Both sides must agree on the same option for all three terms. If you fail to agree before time runs out, the project falls back to a minimal plan and you receive your fallback score.
              </Fact>

              <Fact icon="🔒" title="Your Payoff Sheet is Strictly Private">
                Your situation, what each option pays you, and your fallback score are completely confidential. <strong>Never reveal your exact points or numbers to the other party</strong>. Explain why an issue is important in terms of workplace reasons instead!
              </Fact>

              <Fact icon="💬" title="Direct Chat vs. AI-Mediated Proxy">
                In one task, you write messages and make offers directly. In another task, an <strong>AI Proxy</strong> helps negotiate on your behalf using your instructions before you take over and finish the deal.
              </Fact>
            </div>
          </Card>

          {/* Bonus callout */}
          <Callout title="💰 Task Bonus Opportunity" tone="warning">
            {isLeader ? (
              <p>
                As the Leader, you decide the Team Member&apos;s bonus after each task (up to {STUDY.currencySymbol}{STUDY.bonusPerTask} per task, {STUDY.currencySymbol}{STUDY.bonusTotal} total). You will evaluate both the outcome reached and their communication.
              </p>
            ) : (
              <p>
                The Project Leader evaluates your negotiation conduct and decides a performance bonus for you after each task. Any awarded bonus is added directly to your Prolific payment once the study completes.
              </p>
            )}
          </Callout>
        </Page>

        <ActionBar
          label="Proceed to Comprehension Check"
          onClick={() => {
            setPart("check");
            window.scrollTo({ top: 0, behavior: "smooth" });
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
          eyebrow="Comprehension Check · (Part 2/2)"
          title="Quick Comprehension Check"
          subtitle="Please answer these 3 questions to ensure the rules and payoff format are clear. If you miss any, you will have a chance to retry."
        />

        <div className="space-y-6">
          {CHECKS.map((c, i) => {
            const answered = answers[c.id];
            const isWrong = submitted && answered && answered !== c.correct;
            const isRight = submitted && answered && answered === c.correct;

            return (
              <Card
                key={c.id}
                className={cx(
                  "transition-all",
                  isWrong ? "border-amber-400 bg-amber-50/30" : isRight ? "border-emerald-300 bg-emerald-50/20" : "",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-0.5 text-xs font-extrabold text-slate-700">
                    Question {i + 1} of {CHECKS.length}
                  </span>
                  {isRight ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      ✓ Correct
                    </span>
                  ) : isWrong ? (
                    <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                      ⚠️ Needs review
                    </span>
                  ) : null}
                </div>

                <p className="mb-3.5 text-sm sm:text-base font-bold text-[var(--ink)]">{c.question}</p>
                <ChoiceList
                  name={c.id}
                  value={answered ?? ""}
                  onChange={(v) =>
                    setAnswers((prev) => ({ ...prev, [c.id]: v }))
                  }
                  options={c.options}
                />
                {isWrong ? (
                  <div className="mt-3.5">
                    <Callout title="💡 Helpful Review Tip" tone="warning">
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
        label={canContinue ? "Continue to Practice Round" : submitted ? "Retry Missed Questions" : "Check Answers"}
        onClick={canContinue ? goNext : submitted ? retry : check}
        disabled={!canContinue && !submitted && !allAnswered}
        note={
          submitted && !allCorrect
            ? `⚠️ ${wrong.length} question(s) need another look`
            : submitted && allCorrect
              ? "🎉 All answers correct! Ready to proceed."
              : ""
        }
      />
    </>
  );
}
