"use client";

/**
 * Persistent page chrome: where you are, and how much is left.
 *
 * Progress is derived from the URL (see `flowKeyFromPath`), so every screen
 * gets it without opting in and no page can report a step it is not on. The
 * label names the stage in the participant's own vocabulary — never the
 * condition.
 */

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { writeFurthest } from "@/lib/flow-position";
import {
  FLOW,
  STUDY,
  backStep,
  flowKeyFromPath,
  flowIndex,
  flowLabel,
  type FlowKey,
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
        {/* Same width as the column below it, for the same reason as the
            action bar: chrome that overhangs its content reads as a mistake. */}
        <div
          className="mx-auto flex h-[var(--header-h)] w-full items-center justify-between gap-4 px-5 sm:px-6 lg:px-8"
          style={{ maxWidth: "var(--measure-page, var(--measure-reading))" }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="h-4 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
            />
            {/* The study's name is the first thing to give up on a narrow
                screen. Where you are is the thing worth the room. */}
            <span className="hidden truncate text-[0.8125rem] font-medium text-[var(--ink-2)] sm:block">
              {STUDY.shortTitle}
            </span>
          </div>

          {key ? (
            <div className="flex min-w-0 items-center gap-3 text-[0.8125rem]">
              <span className="truncate font-medium">{flowLabel(key)}</span>
              <span className="tabular shrink-0 text-[var(--ink-3)]">
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
  /**
   * Omit both `label` and `onClick` for a status-only bar. The negotiate
   * screen wants one: its next step is the Send button inside the
   * conversation, and putting a second, dead primary button down here would
   * either be a lie or a way to skip the negotiation.
   */
  label?: string;
  onClick?: () => void;
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
      {/* Tracks the width of the column it sits under, so the primary button
          lines up with the content rather than floating past its edge. `Page`
          publishes that width as `--measure-page`; the fallback covers an
          action bar rendered outside one. */}
      <div
        className="mx-auto flex min-h-[var(--actionbar-h)] w-full items-center justify-between gap-4 px-5 py-3 sm:px-6 lg:px-8"
        style={{ maxWidth: "var(--measure-page, var(--measure-reading))" }}
      >
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
          {label && onClick ? (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Returns to the previous step, where that is one of the few steps a
 * participant may return to (`backStep`). Renders nothing elsewhere.
 *
 * It lowers the recorded position before navigating, otherwise the navigation
 * guard would read the arrival as a stray back press and bounce it forward
 * again.
 */
export function BackButton({ from }: { from: FlowKey }) {
  const router = useRouter();
  const target = backStep(from);
  if (!target) return null;

  return (
    <button
      type="button"
      onClick={() => {
        writeFurthest(flowIndex(target.key));
        router.push(target.href);
      }}
      className="rounded-[var(--radius)] px-3 py-2 text-[0.9375rem] font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
    >
      ← {target.label}
    </button>
  );
}
