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
    <div className="flex gap-3">
      <span aria-hidden className="mt-0.5 text-[1.125rem] leading-none">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="mb-1 text-[0.9375rem] font-semibold">{title}</p>
        <p className="max-w-prose text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
          {children}
        </p>
      </div>
    </div>
  );
}

/**
 * One side's standing in the role relation.
 *
 * COLOUR RULE (interface rule 1): neither box may use the sand palette. What
 * is in them is not private information — it is the role relation both sides
 * are told about, and the study's whole colour convention is that sand means
 * "only you can see this". The two are told apart by weight, not by hue.
 */
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
        "rounded-[var(--radius)] border p-3.5",
        tone === "own"
          ? "border-[var(--ink-3)] bg-[var(--surface)]"
          : "border-[var(--line)] bg-[var(--surface-muted)]",
      )}
    >
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-[0.875rem] leading-relaxed text-[var(--ink-2)]"
          >
            <span aria-hidden className="text-[var(--ink-3)]">
              •
            </span>
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

          {/* The role, as two columns of what each side holds.
              The power asymmetry (Design §6) is the point of this card, and as
              two paragraphs it had to be held in the head to be compared. Side
              by side, the asymmetry is the layout: what you hold, what they
              hold, and neither list is enough on its own. The wording of each
              item is unchanged — this is the same claim, arranged so it can be
              seen rather than assembled. */}
          <Card className="mb-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-3)]">
              You have been assigned the role of
            </p>
            <p className="mb-5 text-2xl font-semibold tracking-[-0.02em]">
              {isLeader ? "Project Leader" : "Team Member"}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <PowerBox
                title="What you hold"
                tone="own"
                items={
                  isLeader
                    ? [
                        "Formal authority over the project",
                        "You approve work assignments",
                        "You write the performance evaluation that feeds into bonus decisions",
                        "You recommend who is staffed on future high-visibility projects",
                      ]
                    : [
                        "The specialist expertise the project depends on",
                        "You may decline extra participation, or accept it on conditions",
                      ]
                }
              />
              <PowerBox
                title={
                  isLeader
                    ? "What the Team Member holds"
                    : "What the Project Leader holds"
                }
                tone="theirs"
                items={
                  isLeader
                    ? [
                        "The specialist expertise the project depends on",
                        "Their willingness to take part — you cannot simply issue instructions and get the outcome you want",
                      ]
                    : [
                        "Formal authority over the project",
                        "They approve work assignments",
                        "They write the performance evaluation that feeds into bonus decisions",
                        "They recommend who is staffed on future high-visibility projects",
                      ]
                }
              />
            </div>

            <p className="mt-4 max-w-prose text-[0.9375rem] font-medium">
              {isLeader
                ? "Neither side can settle everything alone. You need an agreement."
                : "Your evaluation and future opportunities depend on their assessment — and neither side can settle everything alone. You both have to negotiate."}
            </p>
          </Card>

          {/* Five short blocks, not five paragraphs.
              This was one card of continuous prose, and it is the densest
              reading in the study — every fact in it is load-bearing, so none
              could be cut. What could change is the shape: a participant
              scanning for "how long is this" or "can I show them my points"
              had to read the whole thing to find either. Each fact now sits
              under a heading that names it, so the card can be scanned first
              and read second. Nothing here has been dropped. */}
          <Card className="mb-5">
            <CardTitle>What you will do</CardTitle>
            <div className="space-y-4">
              <Fact icon="🗂" title="Two tasks, on two different scenarios">
                Each negotiation has a <strong>ten-minute limit</strong> — that
                is a cap, not a target, and you may finish sooner. Before the
                first one there is a short practice round.
              </Fact>

              <Fact icon="📊" title="Three terms to settle, four options each">
                You and the other party have to agree on the same option for
                all three. If you do not, the project falls back to a limited
                plan and you both take your fallback score.
              </Fact>

              <Fact icon="🔒" title="Your briefing is private">
                It holds your situation, what each option is worth to you in
                points, the reasons behind what you are asking for, and what
                happens if there is no agreement. The other person has a
                different one and cannot see yours. You may explain why a term
                matters to you and ask what matters to them, but{" "}
                <strong>
                  you may not show them your point sheet or tell them the
                  numbers on it
                </strong>
                .
              </Fact>

              <Fact icon="💬" title="The two tasks work differently">
                In one you write the messages and make the offers yourself. In
                the other you set out what you want and which of your reasons
                may be used, and an <strong>AI Proxy</strong> negotiates on your
                behalf with the other person&apos;s AI Proxy while you both
                watch. Each is explained when you reach it.
              </Fact>

              {/* This replaced a sentence promising a review step where the
                  participant could "accept, ask for one change, or reject".
                  That step no longer exists: the AI Proxies negotiate once and
                  then the participant takes over and finishes the negotiation
                  themselves. Leaving the old wording in would have told every
                  Proxy participant to expect a screen they never reach. */}
              <Fact icon="🤝" title="After the AI Proxies, you take over">
                What they reach is not final. You then talk to the other
                participant <strong>directly</strong>, with everything the
                proxies said still on screen, and{" "}
                <strong>what the two of you agree is the result</strong>.
              </Fact>

              <Fact icon="💵" title="Then questions, then the bonus">
                After each task you answer some questions about how it went, and
                then the bonus for that task is decided.
              </Fact>
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
