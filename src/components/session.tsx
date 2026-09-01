"use client";

/**
 * Task shell: where you are in the task, and your briefing, always.
 *
 * The briefing is the whole problem with this study's interface. Three terms
 * with four levels each, private point values, a fallback score, a role story
 * and six reason cards for the one term that is hard to raise — shown once on
 * an intro screen and then taken away, which is what an ordinary flow does.
 * Nobody holds that. So the briefing is pinned beside the work on a wide
 * screen and one tap away on a narrow one, at every phase, with no way to lose
 * it.
 *
 * DECEPTION INTEGRITY: phase names are generic and identical in wording
 * wherever they can be. Nothing here may hint at which condition a task is.
 */

import { useState, type ReactNode } from "react";
import { IssueValueTable } from "./issues";
import { ActionBar } from "./study-chrome";
import { Card, CardTitle, Page, PrivateTag, cx } from "./ui";
import type { NegotiationTask, Role } from "@/lib/types";

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/**
 * Where you are in this task.
 *
 * A bar of segments rather than a written trail of phase names. Seven names
 * with separators between them wrapped to three lines inside the task column,
 * which is a lot of chrome to say "third of seven" — and the phase the
 * participant is on is already the heading right above it. The names stay for
 * screen readers, where a trail costs nothing.
 */
export function TaskHeader({
  taskIndex,
  title,
  steps,
  current,
  aside,
}: {
  taskIndex: 1 | 2;
  title: string;
  steps: string[];
  current: number;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-[var(--ink-2)] shadow-2xs">
            <span className="text-[var(--accent)] font-extrabold">Task {taskIndex} of 2</span>
            <span className="text-slate-300">/</span>
            <span>Step {current + 1} of {steps.length}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
            {title}
          </h1>
        </div>
        {aside}
      </div>

      <ol className="flex items-center gap-1.5">
        {steps.map((label, i) => (
          <li
            key={label}
            className={cx(
              "flex-1 rounded-full transition-all duration-300",
              i === current ? "h-2 bg-[var(--accent)] shadow-2xs" : "h-1.5",
              i < current ? "bg-[var(--accent)]/50" : i > current ? "bg-slate-200" : "",
            )}
            aria-current={i === current ? "step" : undefined}
          >
            <span className="sr-only">
              {label}
              {i === current ? " — you are here" : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

export type CoverScene = "direct" | "proxy" | "practice";

function CoverArt({ scene }: { scene: CoverScene }) {
  const figures =
    scene === "proxy"
      ? [
          { emoji: "🧑‍💼", label: "You" },
          { emoji: "🤖", label: "Your AI Proxy" },
          { emoji: "🤝", label: "Exchange", joint: true },
          { emoji: "🤖", label: "Their AI Proxy" },
          { emoji: "👤", label: "Other Participant" },
        ]
      : scene === "direct"
        ? [
            { emoji: "🧑‍💼", label: "You" },
            { emoji: "💬", label: "Direct Chat", joint: true },
            { emoji: "👤", label: "Other Participant" },
          ]
        : [
            { emoji: "🧑‍💼", label: "You" },
            { emoji: "💬", label: "Practice", joint: true },
            { emoji: "🎯", label: "Practice Scenario" },
          ];

  return (
    <div
      aria-hidden
      className="my-8 flex w-full flex-wrap items-center justify-center gap-3 sm:gap-5"
    >
      {figures.map((f, i) => (
        <div
          key={`${f.emoji}-${i}`}
          className={cx(
            "flex flex-col items-center",
            f.joint ? "px-1" : "w-20 sm:w-24",
          )}
        >
          <span
            className={cx(
              "flex items-center justify-center rounded-2xl transition-all",
              f.joint
                ? "h-10 w-10 text-xl sm:text-2xl bg-slate-100 border border-slate-200 text-slate-600 shadow-2xs"
                : "h-14 w-14 sm:h-16 sm:w-16 border-2 border-slate-200 bg-white text-2xl sm:text-3xl shadow-sm hover:scale-105",
            )}
          >
            {f.emoji}
          </span>
          {f.label ? (
            <span className="mt-2 text-center text-xs font-bold leading-tight text-[var(--ink-2)]">
              {f.label}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function TaskCover({
  eyebrow,
  title,
  lead,
  steps,
  minutes,
  note,
  actionLabel,
  onStart,
  secondary,
  counter,
  doesNotCount,
  scene,
}: {
  eyebrow: string;
  title: string;
  lead: ReactNode;
  steps: Array<string | { label: string; hint: string }>;
  minutes: number;
  note?: ReactNode;
  actionLabel: string;
  onStart: () => void;
  secondary?: ReactNode;
  counter?: { index: number; total: number };
  doesNotCount?: boolean;
  scene?: CoverScene;
}) {
  return (
    <>
      <Page>
        <div className="flex min-h-[calc(100vh-var(--header-h)-var(--actionbar-h)-3rem)] flex-col justify-center py-10 text-center">
          <div className="mx-auto flex w-full max-w-prose flex-col items-center">
            {counter ? (
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-1 text-sm font-extrabold text-[var(--accent)] shadow-2xs">
                <span>Task {counter.index}</span>
                <span className="opacity-40">/</span>
                <span>{counter.total}</span>
              </div>
            ) : null}

            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--ink-3)]">
              {eyebrow}
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl">
              {title}
            </h1>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-xs font-bold text-[var(--ink-2)] shadow-2xs">
              <span>⏱️</span>
              <span>About {minutes} minutes</span>
              {doesNotCount ? (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Does not count</span>
                </>
              ) : null}
            </div>

            {scene ? <CoverArt scene={scene} /> : null}

            <div className="mt-6 w-full text-left rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs leading-relaxed text-sm sm:text-base">
              {lead}
            </div>

            <Card tone="muted" className="mt-6 w-full text-left">
              <CardTitle>What happens in this part</CardTitle>
              <ol className="space-y-3">
                {steps.map((step, i) => {
                  const label = typeof step === "string" ? step : step.label;
                  const hint = typeof step === "string" ? null : step.hint;
                  return (
                    <li key={label} className="flex items-start gap-3.5 rounded-xl bg-white p-3 border border-slate-100 shadow-2xs">
                      <span
                        aria-hidden
                        className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-xs font-black text-[var(--accent)] border border-[var(--accent-border)]"
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm sm:text-base font-bold text-[var(--ink)]">
                          {label}
                        </span>
                        {hint ? (
                          <span className="mt-0.5 block text-xs sm:text-sm text-[var(--ink-3)] leading-relaxed">
                            {hint}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            {note ? <div className="mt-4 w-full text-left">{note}</div> : null}
          </div>
        </div>
      </Page>

      <ActionBar label={actionLabel} onClick={onStart} secondary={secondary} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Briefing
// ---------------------------------------------------------------------------

export function BriefingPanel({
  task,
  role,
  defaultOpen,
}: {
  task: NegotiationTask;
  role: Role;
  defaultOpen?: boolean;
}) {
  const brief = task.roleBriefs[role];

  return (
    <Card tone="private" className="text-[var(--private-ink)]">
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--private-line)] pb-3">
        <h2 className="text-base font-bold text-[var(--private-strong)]">
          Your Briefing
        </h2>
        <PrivateTag />
      </div>

      <div className="mb-4 rounded-xl border border-[var(--private-line)] bg-[var(--private-soft)] p-3.5 shadow-2xs">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--private-strong)]">
          Your Role
        </p>
        <p className="text-base font-extrabold text-[var(--ink)]">
          {brief.title}
        </p>
        <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[var(--private-ink)]/80">
          {brief.organizationalPosition}
        </p>
      </div>

      <div className="space-y-3">
        <Fold title="📄 Your Situation" defaultOpen={defaultOpen}>
          <p className="whitespace-pre-line text-xs sm:text-sm leading-relaxed">
            {brief.roleStory}
          </p>
        </Fold>

        <Fold title="🎯 What You Want" defaultOpen={defaultOpen}>
          <ul className="list-disc space-y-1.5 pl-4 text-xs sm:text-sm leading-relaxed">
            {brief.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </Fold>

        {brief.reasonCards.length ? (
          <Fold title="💬 Your Reasons (Term by Term)" defaultOpen>
            <p className="mb-3 rounded-lg border border-[var(--private-line)] bg-amber-100/60 p-3 text-xs sm:text-sm leading-relaxed font-medium">
              {brief.requirementNote}
            </p>
            <p className="mb-3 text-xs sm:text-sm leading-relaxed text-[var(--private-ink)]/80">
              Each term comes with a <strong>work reason</strong> (safe to share) and a piece of{" "}
              <strong>sensitive background</strong> (private to you).{" "}
              {brief.disclosureRisk}
            </p>
            <IssueReasonGroups task={task} role={role} />
          </Fold>
        ) : null}

        <Fold title="⚠️ If No Agreement (Fallback)" defaultOpen>
          <p className="text-xs sm:text-sm leading-relaxed font-medium">{brief.batnaSummary}</p>
        </Fold>

        <Fold title="🔢 Point Values per Term" defaultOpen last>
          <IssueValueTable
            issues={task.issues}
            role={role}
            reservationPoints={task.reservationPoints}
          />
        </Fold>
      </div>

      <p className="mt-5 border-t border-[var(--private-line)] pt-3 text-center text-xs font-semibold text-[var(--private-strong)]">
        🔒 The other side has their own briefing and cannot see yours.
      </p>
    </Card>
  );
}

function Fold({
  title,
  children,
  defaultOpen,
  last,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  last?: boolean;
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  last?: boolean;
}) {
  return (
    <details open={defaultOpen} className={cx("group rounded-xl border border-[var(--private-line)] bg-white/70 overflow-hidden shadow-2xs transition-all", last ? "" : "mb-2.5")}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 text-xs sm:text-sm font-bold tracking-tight text-[var(--ink)] hover:bg-amber-100/40 select-none [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span
          aria-hidden
          className="shrink-0 text-sm font-black text-[var(--private-strong)] transition-transform duration-200 group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="border-t border-[var(--private-line)] p-3.5 bg-[var(--private-surface)] text-[var(--private-ink)]">
        {children}
      </div>
    </details>
  );
}

export function ReasonBox({
  title,
  note,
  cards,
  sensitive,
  children,
}: {
  title: string;
  note?: string;
  cards: Array<{ id: string; text: string }>;
  sensitive?: boolean;
  children?: (card: { id: string; text: string }) => ReactNode;
}) {
  if (!cards.length) return null;
  return (
    <div
      className={cx(
        "mb-2.5 rounded-xl border p-3 last:mb-0 shadow-2xs transition-all",
        sensitive
          ? "border-amber-300 bg-amber-50/90 text-amber-950"
          : "border-slate-200 bg-white text-slate-900",
      )}
    >
      <p
        className={cx(
          "mb-1 flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide",
          sensitive ? "text-amber-900" : "text-slate-700",
        )}
      >
        <span>{sensitive ? "🔒" : "💼"}</span>
        <span>{title}</span>
      </p>
      {note ? (
        <p className="mb-2 text-xs leading-relaxed opacity-80">
          {note}
        </p>
      ) : null}
      <ul className="space-y-2">
        {cards.map((card) => (
          <li key={card.id}>
            {children ? (
              children(card)
            ) : (
              <p className="text-xs sm:text-sm leading-relaxed">
                {card.text}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IssueReasonGroups({
  task,
  role,
  renderCard,
}: {
  task: NegotiationTask;
  role: Role;
  renderCard?: (card: { id: string; text: string }) => ReactNode;
}) {
  const cards = task.roleBriefs[role].reasonCards;
  return (
    <div className="space-y-3">
      {task.issues.map((issue) => {
        const onIssue = cards.filter((c) => c.issueId === issue.id);
        if (!onIssue.length) return null;
        return (
          <div key={issue.id} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
            <p className="mb-2 text-xs sm:text-sm font-bold text-[var(--ink)]">
              {issue.label}
            </p>
            <ReasonBox
              title="Work reason"
              cards={onIssue.filter((c) => c.layer === "work")}
            >
              {renderCard}
            </ReasonBox>
            <ReasonBox
              title="Sensitive background"
              cards={onIssue.filter((c) => c.layer === "sensitive")}
              sensitive
            >
              {renderCard}
            </ReasonBox>
          </div>
        );
      })}
    </div>
  );
}

export function TaskLayout({
  briefing,
  children,
}: {
  briefing: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-8">
      <div className="min-w-0">{children}</div>

      <aside className="hidden lg:block">
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] max-h-[calc(100vh-var(--header-h)-3rem)] overflow-y-auto rounded-2xl shadow-sm">
          {briefing}
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(var(--actionbar-h)+1rem)] right-4 z-20 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-400 px-5 py-3 text-xs sm:text-sm font-extrabold text-slate-900 shadow-xl lg:hidden cursor-pointer hover:scale-105 active:scale-95 transition-all"
      >
        <span>📋</span>
        <span>Your Briefing</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(26rem,100%)] flex-col bg-[var(--private-surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--private-line)] px-4 py-3.5 bg-amber-100/50">
              <span className="text-sm font-extrabold text-[var(--private-strong)]">
                Your Briefing (Private)
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
              >
                Close ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{briefing}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
