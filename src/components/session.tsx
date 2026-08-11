"use client";

/**
 * Session shell: where you are in the session, and your briefing, always.
 *
 * The briefing is the whole problem with this study's interface. Six issues,
 * three or four levels each, private point values, a reservation position and
 * a critical requirement — shown once on an intro screen and then taken away,
 * which is what the old flow did. Nobody holds that. So the briefing is
 * pinned beside the work on a wide screen and one tap away on a narrow one,
 * at every phase, with no way to lose it.
 *
 * DECEPTION INTEGRITY: phase names are generic and identical in wording
 * wherever they can be. Nothing here may hint at which condition a session is.
 */

import { useState, type ReactNode } from "react";
import { IssueValueTable } from "./issues";
import { Card, PrivateTag, cx } from "./ui";
import type { NegotiationTask, Role } from "@/lib/types";

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export function SessionHeader({
  sessionIndex,
  title,
  steps,
  current,
  aside,
}: {
  sessionIndex: 1 | 2;
  title: string;
  /** Phase labels, in order. */
  steps: string[];
  /** Index of the phase being shown. */
  current: number;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-3)]">
            Session {sessionIndex} of 2
          </p>
          <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">
            {title}
          </h1>
        </div>
        {aside}
      </div>

      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]">
        {steps.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            {i > 0 ? (
              <span aria-hidden className="text-[var(--ink-3)]">
                ›
              </span>
            ) : null}
            <span
              className={cx(
                i === current
                  ? "font-semibold text-[var(--ink)]"
                  : i < current
                    ? "text-[var(--ink-3)] line-through decoration-[var(--line-strong)]"
                    : "text-[var(--ink-3)]",
              )}
              aria-current={i === current ? "step" : undefined}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Briefing
// ---------------------------------------------------------------------------

export function BriefingPanel({
  task,
  role,
}: {
  task: NegotiationTask;
  role: Role;
}) {
  const brief = task.roleBriefs[role];

  return (
    <Card tone="private" className="text-[var(--private-ink)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[0.95rem] font-semibold text-[var(--ink)]">
          Your briefing
        </h2>
        <PrivateTag />
      </div>

      <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]">
        You are
      </p>
      <p className="mb-3 text-[0.9375rem] font-semibold text-[var(--ink)]">
        {brief.title}
      </p>
      {/* The panel is read in the rail most of the time, but on the brief
          phase it sits in the full-width column — so its prose keeps a
          reading measure of its own rather than following the container. */}
      <p className="mb-5 max-w-prose text-[0.8125rem] leading-relaxed">
        {brief.organizationalPosition}
      </p>

      <Section title="What you want">
        <ul className="list-disc space-y-1 pl-4 text-[0.8125rem]">
          {brief.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </Section>

      <Section title="Matters most to you">
        <p className="max-w-prose rounded-[var(--radius)] border border-[var(--private-line)] bg-[#fff9ef] p-3 text-[0.8125rem]">
          {brief.criticalRequirement}
        </p>
      </Section>

      <Section title="If there is no agreement">
        <p className="max-w-prose text-[0.8125rem]">{brief.batnaSummary}</p>
      </Section>

      <Section title="What each level is worth to you" last>
        <IssueValueTable issues={task.issues} role={role} />
      </Section>

      <p className="mt-5 border-t border-[var(--private-line)] pt-3 text-[0.75rem]">
        The other party has their own briefing and cannot see yours.
      </p>
    </Card>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-5"}>
      <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]">
        {title}
      </p>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Main column with the briefing beside it.
 *
 * Pinned as a rail from `lg` up, where there is room for it; below that a
 * button opens the same panel over the page. One panel, two placements — the
 * briefing is never a different thing depending on your screen.
 */
export function SessionLayout({
  briefing,
  children,
}: {
  briefing: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    /* The rail carries the whole briefing — six issues, their levels and what
       each is worth — so it widens with the page rather than staying at the
       width it needed when the column was narrower. Past `xl` it takes a
       little more, which keeps the value table off a second line. */
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-8">
      <div className="min-w-0">{children}</div>

      <aside className="hidden lg:block">
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] max-h-[calc(100vh-var(--header-h)-3rem)] overflow-y-auto">
          {briefing}
        </div>
      </aside>

      {/* Narrow screens: the same panel, on demand. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(var(--actionbar-h)+1rem)] right-4 z-20 rounded-full border border-[var(--private-line)] bg-[var(--private)] px-4 py-2.5 text-[0.8125rem] font-semibold text-[var(--private-ink)] shadow-lg lg:hidden"
      >
        Your briefing
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(24rem,100%)] flex-col bg-[var(--private)]">
            <div className="flex items-center justify-between border-b border-[var(--private-line)] px-4 py-3">
              <span className="text-[0.9375rem] font-semibold">
                Your briefing
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--private-ink)] hover:bg-[#fff9ef]"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{briefing}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
