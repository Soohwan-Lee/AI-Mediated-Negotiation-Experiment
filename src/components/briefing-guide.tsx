"use client";

import Image from "next/image";
import { useState } from "react";
import { ActionBar, BackButton } from "./study-chrome";
import { RoleDecisionFlow } from "./proxy-art";
import { Card, CardTitle, Page, PageHeader, cx } from "./ui";
import { PHASES, STUDY, type PhaseKey } from "@/lib/study-config";
import type { Role } from "@/lib/types";

/**
 * "What happens next", as five words across the top of the screen.
 *
 * NOT the progress bar. The chrome's bar is derived from the URL and counts
 * thirteen routes (interface rule 3); this one names the five PHASES a
 * participant can actually hold in mind, and it exists because the PI's note
 * was that nobody knows which phase they are in. Both can be on screen at
 * once because they answer different questions: the bar says how far through,
 * this says what kind of thing is happening.
 *
 * It carries no cue ring (rule 9). Nothing on it is waiting to be pressed —
 * it is a map, not a control — and the screen's one ring belongs to whatever
 * the participant is being asked to do.
 */
export function PhaseStrip({ current }: { current: PhaseKey }) {
  return (
    <ol
      aria-label="What happens next"
      className="sr-only"
    >
      {PHASES.map((phase, index) => {
        const isCurrent = phase.key === current;
        const isPast = index < PHASES.findIndex((p) => p.key === current);
        return (
          <li key={phase.key} className="flex items-center gap-1.5">
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={cx(
                "rounded-full border px-2.5 py-1 font-bold",
                isCurrent
                  ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : isPast
                    ? "border-slate-200 bg-white text-slate-500"
                    : "border-slate-200 bg-white text-slate-400",
              )}
            >
              {phase.label}
              {"doesNotCount" in phase && phase.doesNotCount ? (
                <span className="ml-1 font-semibold opacity-70">
                  (does not count)
                </span>
              ) : null}
            </span>
            {index < PHASES.length - 1 ? (
              <span aria-hidden className="text-slate-300">
                ›
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function ReadingProgress({
  labels,
  current,
  ariaLabel = "Reading pages",
}: {
  labels: readonly string[];
  current: number;
  ariaLabel?: string;
}) {
  return (
    <ol aria-label={ariaLabel} className="mb-7 flex flex-wrap gap-x-5 gap-y-2 border-b border-slate-200 pb-4">
      {labels.map((label, index) => (
        <li key={label} aria-current={index === current ? "step" : undefined}
          className={`text-sm ${index === current ? "font-bold text-slate-900" : "text-slate-500"}`}>
          <span className="mr-2 tabular-nums">{index + 1}.</span>{label}
        </li>
      ))}
    </ol>
  );
}

export function PreviousReading({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return <button type="button" onClick={onClick} disabled={disabled}
    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
    Back
  </button>;
}

/**
 * THREE PAGES, DOWN FROM FOUR. "The setting" and "Your role" were two screens
 * saying one thing — you are one of two colleagues settling two conditions —
 * and a participant who has just read a consent page with its own three-part
 * overview does not need it twice. What a participant needs BEFORE the
 * practice round is: who they are, what they are agreeing on, that the point
 * sheet is private, that the other side moves on the reasons it hears, and
 * what they are paid. Anything past that is folded into a `<details>` or is
 * on the briefing panel where it stays reachable all task.
 */
const GUIDE_PAGES = ["Your role", "After each task", "The rules"] as const;
export const STUDY_GUIDE_LAST_PAGE = GUIDE_PAGES.length - 1;

export function StudyOrientation({
  role,
  onContinue,
  initialPage = 0,
}: {
  role: Role;
  onContinue: () => void;
  initialPage?: number;
}) {
  const [page, setPage] = useState(initialPage);
  const isLeader = role === "leader";
  const roleImage = isLeader
    ? "/illustrations/role-team-lead.png?v=20260907b"
    : "/illustrations/role-team-member.png?v=20260907b";
  function move(next: number) {
    setPage(next);
    window.scrollTo({ top: 0 });
  }
  return (
    <>
      <Page>
        {/* The map first, then where you are on it. The strip names the five
            phases; `ReadingProgress` counts the pages of THIS one. */}
        <PhaseStrip current="instructions" />
        <ReadingProgress labels={GUIDE_PAGES} current={page} />
        <PageHeader eyebrow={`Study guide · ${page + 1} of ${GUIDE_PAGES.length}`}
          title={[`You are the ${isLeader ? "team lead" : "team member"}`, "What happens after each task", "What to do in each negotiation"][page]}
          subtitle={["You and one other participant settle two working conditions. You keep this role in both tasks.", "", "Three rules, then a short check and one practice round."][page]} />

        {page === 0 ? (
          <div className="grid items-start gap-6 md:grid-cols-[0.95fr_1.05fr]">
            <figure className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--private-line)] bg-[var(--private-soft)] shadow-[var(--shadow-sm)]">
              <div className="relative">
                <Image
                  src={roleImage}
                  width={1536}
                  height={1024}
                  sizes="(min-width: 1024px) 26rem, (min-width: 640px) 48rem, 100vw"
                  alt={isLeader
                    ? "One person organizes equal blank cards on a project planning board."
                    : "One person reviews a blank client-work analysis sheet beside an idle headset."}
                  className="h-auto w-full"
                />
                <div className="absolute right-3 top-3 rounded-lg border border-white/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm">
                  <span className="block text-2xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">Your role</span>
                  <span className="mt-0.5 block text-sm font-bold text-slate-900">{isLeader ? "Team lead" : "Team member"}</span>
                </div>
              </div>
            </figure>

            <div className="space-y-4">
              <Card tone="private">
                <CardTitle>{isLeader ? "Team lead" : "Team member"}</CardTitle>
                <p className="mt-2 text-base leading-relaxed">{isLeader
                  ? "You lead the project and answer to the director. You recommend the member's bonus after each negotiation."
                  : "You work directly with the client. The team lead recommends your bonus after each negotiation."}</p>
              </Card>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 shadow-2xs">
                <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-emerald-800">
                  Your study payment
                </p>
                {isLeader ? (
                  <>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <strong className="text-xl tabular-nums">
                        {STUDY.currencySymbol}{STUDY.compensation}
                      </strong>
                      <span className="text-sm font-semibold">base</span>
                      <span aria-hidden className="text-emerald-700">+</span>
                      <strong className="text-xl tabular-nums">
                        {STUDY.currencySymbol}{STUDY.bonusAmount}
                      </strong>
                      <span className="text-sm font-semibold">for your role</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed">
                      <strong>{STUDY.currencySymbol}{STUDY.totalPaid}</strong> in total, guaranteed from now. Your recommendations for the member <strong>do not reduce your payment</strong>.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <strong className="text-xl tabular-nums">
                        {STUDY.currencySymbol}{STUDY.compensation}
                      </strong>
                      <span className="text-sm font-semibold">guaranteed</span>
                      <span aria-hidden className="text-emerald-700">+</span>
                      <strong className="text-xl tabular-nums">
                        up to {STUDY.currencySymbol}{STUDY.bonusAmount}
                      </strong>
                      <span className="text-sm font-semibold">across two tasks</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed">
                      <strong>{STUDY.currencySymbol}{STUDY.compensation}–{STUDY.currencySymbol}{STUDY.totalPaid}</strong> in total. Bonus amounts are not shown during the tasks.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : page === 1 ? (
          /*
            ONE BLOCK, NOT THREE. The diagram is the page. The payment
            sentence sits on page 1 and was repeated here; a repeat is what
            made this the tallest page in the guide.

            What stays is the §5② guideline, which is the one sentence both
            roles are given about how to make that decision, and the line
            saying points are not money — a participant who thinks otherwise
            reads the whole point sheet as a wage.
          */
          <div className="space-y-4">
            <RoleDecisionFlow role={role} />
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <p className="text-sm leading-relaxed text-slate-900">
                <strong>Both people are told the same thing:</strong> consider not just the result, but the negotiation as a whole and whether you would want to work with this person again.
              </p>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                Negotiation points are not money. They show how well the conditions fit your goals.
              </p>
            </div>
          </div>
        ) : (
          /*
            THREE ONE-LINERS, DOWN FROM THREE CARDS. Each rule was a card
            with a heading and a paragraph that restated the heading. A rule
            a participant has to remember through two negotiations reads
            better as one line they can hold than as a card they skim.

            Nothing was dropped. The point-sheet line is pinned by the COMP3
            comprehension item, the anonymity line is the consent page's own
            undertaking, and the third is §8.1's optional-disclosure notice.
          */
          <div className="space-y-4">
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <Rule icon="🤝" title="Agree on both conditions">
                Each has four options. If you do not agree on both, you each get 0 points for that task.
              </Rule>
              {/*
                §8.1: the participant is told the other side moves on the
                reasons it hears. It must NOT say which kind of reason works.
                Saying the sensitive one is better would stage the disclosure
                the study measures, and naming the trade is pilot gate 6's own
                question.
              */}
              <Rule icon="💬" title="Say why a condition matters">
                You can also ask about the other person&apos;s situation. How far they move depends on the reasons they hear.
              </Rule>
              {/*
                §8.1's two private things, one line each. Never give the other
                side the numbers is the half the COMP3 comprehension item
                pins; "your employer" is what makes the anonymity half
                actionable rather than a slogan, so it stays named.
              */}
              <Rule icon="🔒" title="Keep your point sheet to yourself">
                Never give the other side the numbers on it. Stay anonymous in the chat too: no name, no employer.
              </Rule>
            </ul>

            {/*
              §8.1's common notice, in the same words as the ⚠ caption under
              the sensitive card on the mandate screen and in the Direct
              briefing panel. It states the cost and never predicts a bad
              outcome: telling a participant which answer is the careful one
              would stage the primary outcome.
            */}
            <p className="rounded-2xl border border-rose-200 bg-rose-50/50 px-5 py-3.5 text-sm leading-relaxed text-rose-950">
              <span aria-hidden className="mr-1.5">⚠</span>
              <strong>Sharing personal background is your choice.</strong> If you or your AI Proxy shares it, the other person may weigh it in their later bonus recommendation or upward evaluation.
            </p>

            {/*
              Folded, not cut. This is real and a participant may want it, but
              it is not needed BEFORE the practice round: the task screens
              explain their own controls when they arrive, and the AI Proxy
              task states its policy on the screen where the choice is made.
            */}
            <details className="rounded-2xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-bold text-slate-900">More detail on the two tasks</summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">In the direct task you chat with the other participant for up to 5 minutes, in your own words. You can finish sooner once you agree.</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">In the AI Proxy task you choose what your representative may share, watch the exchange, then approve it, ask for a change, or refuse it. That task explains its policy before you choose.</p>
            </details>
          </div>
        )}
      </Page>
      <ActionBar label={page === STUDY_GUIDE_LAST_PAGE ? "Continue to the quick check" : `Next: ${GUIDE_PAGES[page + 1].toLowerCase()}`}
        onClick={() => page === STUDY_GUIDE_LAST_PAGE ? onContinue() : move(page + 1)}
        note={`Guide page ${page + 1} of ${GUIDE_PAGES.length}`}
        secondary={page > 0 ? <PreviousReading onClick={() => move(page - 1)} /> : <BackButton from="instruction" />} />
    </>
  );
}

/**
 * One rule, one line.
 *
 * A list row rather than a card: three cards each carrying a heading and a
 * paragraph that restated the heading is what the PI meant by "a box inside a
 * box". The icon is decorative — it marks the row apart from its neighbours
 * and says nothing the text does not, so it is `aria-hidden`.
 */
function Rule({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-5 py-3.5">
      <span aria-hidden className="mt-0.5 text-base leading-none">{icon}</span>
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700">
        <strong className="text-slate-900">{title}.</strong> {children}
      </p>
    </li>
  );
}
