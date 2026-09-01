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
              <Gist term="Where you are">
                A coffee and bakery shop. You are the{" "}
                <strong>{isLeader ? "store manager 👑" : "senior staff member 🛠️"}</strong>.
              </Gist>
              <Gist term="Who you talk to">
                One other participant, playing the other role. They want different
                things from the schedule than you do.
              </Gist>
              <Gist term="What you settle">
                <strong>Two things about the schedule</strong> — and you have to agree
                on both. Neither of you can set them alone.
              </Gist>
              <Gist term="Why it is not obvious">
                You each have a private point sheet, and{" "}
                <strong>you cannot see theirs</strong>. The only way to find out what
                they can give you is to talk about it.
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
                  {isLeader ? "👑 Store Manager" : "🛠️ Senior Staff"}
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900 shadow-2xs">
                Role Confirmed
              </span>
            </div>

            <div className="grid items-start gap-4 sm:grid-cols-2">
              <PowerBox
                title="What you hold"
                tone="own"
                items={
                  isLeader
                    ? [
                        "You set the schedule once it is agreed",
                        "You decide their performance bonus after each schedule",
                        "You answer for how the shop is covered",
                      ]
                    : [
                        "You are the only one who can close the shop alone",
                        "You can refuse a shift pattern, or ask for it to change",
                      ]
                }
              />
              <PowerBox
                title={
                  isLeader
                    ? "What the senior staff member holds"
                    : "What the store manager holds"
                }
                tone="theirs"
                items={
                  isLeader
                    ? [
                        "They are the only one who can close the shop alone",
                        "They can refuse a shift pattern, or ask for it to change",
                      ]
                    : [
                        "They set the schedule once it is agreed",
                        "They decide your performance bonus after each schedule",
                        "They answer for how the shop is covered",
                      ]
                }
              />
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:text-sm font-semibold leading-relaxed text-slate-800">
              💡 {isLeader
                ? "Neither of you can set the schedule alone — it only happens if you both agree."
                : "The manager decides your bonus after each schedule. And neither of you can set the schedule alone."}
            </div>
          </Card>

          {/* 4 Core Rules */}
          <Card className="mb-6">
            <CardTitle hint="Four things to keep in mind:">
              ⚡ How the negotiation works
            </CardTitle>
            <div className="grid gap-3 sm:grid-cols-2 mt-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 shadow-2xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">⏱️</span>
                  <p className="text-xs sm:text-sm font-bold text-[var(--ink)]">10-Minute Limit per Task</p>
                </div>
                <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                  Finish as soon as you both agree — there is no need to use the
                  time. If it runs out with no agreement, you each get the low
                  fallback score.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 shadow-2xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📦</span>
                  <p className="text-xs sm:text-sm font-bold text-[var(--ink)]">Two terms, four options each</p>
                </div>
                <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                  You agree the two together, as one package. Picking a level on
                  one term only is not an agreement.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 shadow-2xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔒</span>
                  <p className="text-xs sm:text-sm font-bold text-amber-950">Payoffs are Strictly Private</p>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Never say a number from your point sheet. Say why the term
                  matters to you instead — that is what the other person can
                  actually respond to.
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 shadow-2xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🤖</span>
                  <p className="text-xs sm:text-sm font-bold text-blue-950">Direct vs. AI Proxy Mode</p>
                </div>
                <p className="text-xs text-blue-900 leading-relaxed">
                  In one task you talk to the other person yourself. In the other,
                  an AI Proxy speaks for you first, using instructions you write.
                </p>
              </div>
            </div>
          </Card>

          {/* Bonus callout */}
          <Callout title="💰 Task Bonus Opportunity" tone="warning">
            {isLeader ? (
              <p className="text-xs sm:text-sm">
                As the Leader, you allocate the Team Member&apos;s bonus after each task (up to {STUDY.currencySymbol}{STUDY.bonusPerTask} per task, {STUDY.currencySymbol}{STUDY.bonusTotal} total) based on outcome and conduct.
              </p>
            ) : (
              <p className="text-xs sm:text-sm">
The store manager decides a performance bonus for you after each schedule. Any bonus you are awarded is paid automatically when the study ends.
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
