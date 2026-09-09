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
      className="mb-6 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs"
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
          subtitle={["You and one other participant settle two working conditions. You keep this role in both tasks.", "Both people make one decision about the other after every negotiation.", "Read these before a short check and one practice round."][page]} />

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
              <figcaption className="border-t border-[var(--private-line)] bg-white/90 px-4 py-3 text-xs leading-relaxed text-[var(--private-ink)]">
                {isLeader ? "You coordinate the project plan." : "You bring client-facing experience to the project."}
              </figcaption>
            </figure>

            <div className="space-y-4">
              <Card tone="private">
                <CardTitle>{isLeader ? "Team lead" : "Team member"}</CardTitle>
                <p className="mt-2 text-base leading-relaxed">{isLeader
                  ? "You lead the project and answer to the director. You finalize the working conditions once both people agree. After each negotiation, you recommend the member's bonus."
                  : "You are an experienced team member trusted to work directly with the client. You can ask for changes or refuse a proposed package. After each negotiation, the team lead recommends your bonus."}</p>
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
                      <span className="text-sm font-semibold">guaranteed role addition</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed">
                      Your total is <strong>{STUDY.currencySymbol}{STUDY.totalPaid}</strong> from the time you are assigned this role. Your recommendations for the member <strong>do not reduce your payment</strong>.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <strong className="text-xl tabular-nums">
                        {STUDY.currencySymbol}{STUDY.compensation}
                      </strong>
                      <span className="text-sm font-semibold">guaranteed base</span>
                      <span aria-hidden className="text-emerald-700">+</span>
                      <strong className="text-xl tabular-nums">
                        up to {STUDY.currencySymbol}{STUDY.bonusAmount}
                      </strong>
                      <span className="text-sm font-semibold">across two tasks</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed">
                      Your total can be <strong>{STUDY.currencySymbol}{STUDY.compensation}–{STUDY.currencySymbol}{STUDY.totalPaid}</strong>. Bonus amounts are not shown before both tasks are complete.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : page === 1 ? (
          <div className="space-y-4">
            <RoleDecisionFlow role={role} />
            <Card padded={false} className="p-4 sm:p-5">
              <p className="rounded-xl border border-[var(--private-line)] bg-[var(--private-surface)] px-3 py-2.5 text-sm leading-relaxed text-[var(--private-ink)]">
                {isLeader ? (
                  <>
                    Your <strong>{STUDY.currencySymbol}{STUDY.totalPaid} total is already guaranteed</strong>. After each task, you recommend up to <strong>{STUDY.currencySymbol}{STUDY.bonusPerTask}</strong> for the member. That recommendation does not come out of your payment.
                  </>
                ) : (
                  <>
                    Your <strong>{STUDY.currencySymbol}{STUDY.compensation} base is guaranteed</strong>. The leader recommends up to <strong>{STUDY.currencySymbol}{STUDY.bonusPerTask} after each task</strong>, for up to {STUDY.currencySymbol}{STUDY.bonusAmount} across both tasks. Bonus amounts are not shown during the tasks.
                  </>
                )}
              </p>
              <p className="mt-3 text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                Both people receive the same instruction
              </p>
              <blockquote className="mt-1.5 border-l-2 border-slate-400 pl-3 text-sm leading-relaxed text-slate-800">
                Consider not just the result, but the negotiation as a whole and whether you would want to work with this person again.
              </blockquote>
              <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-700">
                <strong>Negotiation points are not money.</strong> They show how well the working conditions fit your goals; they do not directly determine study payment.
              </p>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardTitle>Agree on both conditions</CardTitle>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Each has four options, and you both have to agree. If you do not agree on both, you each get 0 points for that task.</p>
              {/*
                §8.1: the participant is told the other side moves on the
                reasons it hears. It must NOT say which kind of reason works.
                Saying the sensitive one is better would stage the disclosure
                the study measures, and naming the trade is pilot gate 6's own
                question.
              */}
              <p className="mt-3 text-sm leading-relaxed text-slate-900">You can say why a condition matters to you, and ask about the other person&apos;s situation. How far they move depends on the reasons they hear.</p>
            </Card>

            {/*
              THE TWO NOTICES, together, on the page a participant reads right
              before the practice round. Both are one sentence of instruction
              plus one of consequence, and the point-sheet half is pinned by
              the COMP3 comprehension item.
            */}
            <Card tone="private">
              <CardTitle>Two things to keep to yourself</CardTitle>
              <p className="mt-2 text-sm leading-relaxed"><strong>Your point sheet.</strong> Never give the other side the numbers on it, in any form. Talk about the working conditions instead.</p>
              <p className="mt-3 text-sm leading-relaxed"><strong>Who you are.</strong> Stay anonymous in the chat. Do not type your name, your employer, or any other identifying detail.</p>
            </Card>

            <Card>
              <CardTitle>Sharing personal background is your choice</CardTitle>
              <p className="mt-2 text-sm leading-relaxed text-slate-900">You can negotiate and agree without it. If you or your AI Proxy shares it, the other person may weigh it in their later bonus recommendation or upward evaluation.</p>
            </Card>

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
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{isLeader ? `You are paid ${STUDY.currencySymbol}${STUDY.totalPaid} in total, fixed from now.` : `You are paid ${STUDY.currencySymbol}${STUDY.compensation} as a guaranteed base, and up to ${STUDY.currencySymbol}${STUDY.bonusAmount} more across the two tasks.`}</p>
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
