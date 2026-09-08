"use client";

import Image from "next/image";
import { useState } from "react";
import { ActionBar, BackButton } from "./study-chrome";
import { RoleDecisionFlow } from "./proxy-art";
import { Card, CardTitle, Page, PageHeader } from "./ui";
import { STUDY } from "@/lib/study-config";
import type { Role } from "@/lib/types";

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

const GUIDE_PAGES = ["The setting", "Your role", "After each task", "The rules"] as const;
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
        <ReadingProgress labels={GUIDE_PAGES} current={page} />
        <PageHeader eyebrow={`Study guide · ${page + 1} of ${GUIDE_PAGES.length}`}
          title={["Two colleagues. Two working conditions.", `You are the ${isLeader ? "team lead" : "team member"}`, "What happens after each task", "What to do in each negotiation"][page]}
          subtitle={["You will play a role in a company project team. Here is the setting before you see your first task.", "You keep this role in both tasks. The other participant plays the other role.", "Both people make one decision about the other after every negotiation.", "Read these rules before a short check and one practice round."][page]} />

        {page === 0 ? (
          <div className="grid items-center gap-6 lg:grid-cols-[1.05fr_1fr]">
            <figure className="overflow-hidden rounded-[var(--radius-xl)] border border-slate-200 bg-[#f4efe5] shadow-[var(--shadow-md)]">
              <Image
                src="/illustrations/workplace-story.png"
                width={1536}
                height={1024}
                sizes="(min-width: 1024px) 27rem, (min-width: 640px) 48rem, 100vw"
                alt="Two colleagues separately read their briefings, then consider two unlabeled workplace choices together."
                className="h-auto w-full"
              />
              <figcaption className="border-t border-slate-200/80 bg-white/90 px-4 py-3 text-xs leading-relaxed text-slate-600">
                One shared project, two private briefings.
              </figcaption>
            </figure>

            <ol className="space-y-2">
              {[
                ["Work on the same team", "You play colleagues with different roles."],
                ["Set two conditions", "Choose one option for each. Both people must agree."],
                ["Use private briefings", "Only you can see your goals, background, and points."],
                ["Negotiate, then reflect", "Chat directly once and use an AI Proxy once. Questions follow each task."],
              ].map(([title, text], index) => (
                <li key={title} className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-[var(--shadow-xs)]">
                  <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
                    {index + 1}
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{title}</h2>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : page === 1 ? (
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
        ) : page === 2 ? (
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
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Each condition has four options. Your aim is a package worth more points to you. If you don&apos;t agree on both, you each get 0 points for that task. Direct negotiation lasts up to 5 minutes; you can finish sooner when you agree.</p>
            </Card>
            <Card tone="private">
              <CardTitle>Keep point values private</CardTitle>
              <p className="mt-2 text-sm leading-relaxed">Discuss the working conditions and why they matter. Never share the numbers from your point sheet in any form.</p>
            </Card>
            <Card>
              <CardTitle>Choose what to explain</CardTitle>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">You can explain what matters to you and ask about the other person&apos;s situation.</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-900">Sharing sensitive background is optional. You can negotiate and reach an agreement without it. If you or your AI Proxy shares it, the other person may consider it in their later bonus decision or upward evaluation.</p>
            </Card>
            <Card>
              <CardTitle>Two ways of taking part</CardTitle>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">In direct chat, use your own words; you do not need to repeat the briefing exactly. In the AI Proxy task, choose what your representative may share, watch the exchange, then approve, request changes, or refuse its proposed agreement. That task explains its policy before you choose.</p>
            </Card>
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
