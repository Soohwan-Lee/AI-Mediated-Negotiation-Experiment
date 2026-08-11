"use client";

/**
 * Persistent page chrome: where you are, and how much is left.
 *
 * Progress is derived from the URL (see `flowKeyFromPath`), so every screen
 * gets it without opting in and no page can report a step it is not on. The
 * label names the stage in the participant's own vocabulary — never the
 * condition.
 */

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  FLOW,
  STUDY,
  flowKeyFromPath,
  flowIndex,
  flowLabel,
} from "@/lib/study-config";
import { cx } from "./ui";

export function StudyChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const key = flowKeyFromPath(pathname ?? "");

  // Steps are 1-based for display; the consent page reads "Step 1 of 12".
  const step = key ? flowIndex(key) + 1 : 0;
  const total = FLOW.length;
  const pct = key ? Math.round((step / total) * 100) : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex h-[var(--header-h)] w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="h-4 w-1.5 rounded-full bg-[var(--accent)]"
            />
            <span className="truncate text-[0.8125rem] font-medium text-[var(--ink-2)]">
              {STUDY.shortTitle}
            </span>
          </div>

          {key ? (
            <div className="flex shrink-0 items-center gap-3 text-[0.8125rem]">
              <span className="hidden font-medium sm:inline">
                {flowLabel(key)}
              </span>
              <span className="tabular text-[var(--ink-3)]">
                {step} / {total}
              </span>
            </div>
          ) : null}
        </div>

        <div
          className="h-[3px] w-full bg-[var(--line)]"
          role="progressbar"
          aria-label="Study progress"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-[var(--accent)] transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}

/**
 * Sticky primary action.
 *
 * Sits at the bottom of every screen that has a next step, so the participant
 * never scrolls looking for it. When items are still unanswered it says how
 * many and offers to jump to the first one, which is more useful than a dead
 * disabled button that explains nothing.
 */
export function ActionBar({
  label,
  onClick,
  disabled,
  busy,
  remaining = 0,
  firstUnansweredId,
  note,
  secondary,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Count of required items with no answer yet. */
  remaining?: number;
  /** Anchor id of the first of them, for the jump link. */
  firstUnansweredId?: string | null;
  /** Replaces the status text when there is nothing to count. */
  note?: string;
  secondary?: ReactNode;
}) {
  function jump() {
    if (!firstUnansweredId) return;
    document
      .getElementById(`q-${firstUnansweredId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[var(--surface)]">
      <div className="mx-auto flex min-h-[var(--actionbar-h)] w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <p className="text-[0.8125rem] text-[var(--ink-2)]">
          {remaining > 0 ? (
            <>
              <span className="font-medium text-[var(--ink)]">
                {remaining} {remaining === 1 ? "question" : "questions"}
              </span>{" "}
              still need an answer
              {firstUnansweredId ? (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={jump}
                    className="font-medium text-[var(--accent)] underline underline-offset-2"
                  >
                    Go to the first
                  </button>
                </>
              ) : null}
            </>
          ) : (
            (note ?? "")
          )}
        </p>

        <div className="flex shrink-0 items-center gap-2">
          {secondary}
          <button
            type="button"
            onClick={onClick}
            disabled={disabled || busy}
            className={cx(
              "inline-flex items-center gap-2 rounded-[var(--radius)] px-6 py-2.5 text-[0.9375rem] font-medium transition-colors",
              "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {busy ? "Saving…" : label}
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
