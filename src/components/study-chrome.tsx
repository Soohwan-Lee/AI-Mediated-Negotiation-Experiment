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

  const step = key ? flowIndex(key) + 1 : 0;
  const total = FLOW.length;
  const pct = key ? Math.round((step / total) * 100) : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md shadow-2xs">
        <div
          className="mx-auto flex h-[var(--header-h)] w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
          style={{ maxWidth: "var(--measure-page, var(--measure-reading))" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-base shadow-2xs border border-[var(--accent-border)]">
              🤝
            </span>
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold text-[var(--ink)] sm:text-base">
                {STUDY.shortTitle}
              </span>
            </div>
          </div>

          {key ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="hidden truncate text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] sm:block">
                {flowLabel(key)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100/80 px-3 py-1 text-xs font-bold text-[var(--ink-2)] shadow-2xs">
                <span className="tabular font-extrabold text-[var(--accent)]">
                  Step {step}
                </span>
                <span className="text-slate-400">/</span>
                <span className="text-slate-500">{total}</span>
              </span>
            </div>
          ) : null}
        </div>

        <div
          className="h-[3.5px] w-full bg-slate-100 overflow-hidden"
          role="progressbar"
          aria-label="Study progress"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 transition-[width] duration-500 ease-out shadow-[0_0_8px_rgba(37,99,235,0.4)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}

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
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  remaining?: number;
  firstUnansweredId?: string | null;
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
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/90 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_-2px_rgba(15,23,42,0.06)]">
      <div
        className="mx-auto flex min-h-[var(--actionbar-h)] w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8"
        style={{ maxWidth: "var(--measure-page, var(--measure-reading))" }}
      >
        <div className="text-sm text-[var(--ink-2)] min-w-0">
          {remaining > 0 ? (
            <div className="inline-flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 shadow-2xs animate-pulse">
                <span>⚠️</span>
                <span>{remaining} left to answer</span>
              </span>
              {firstUnansweredId ? (
                <button
                  type="button"
                  onClick={jump}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  Go to first unanswered ↗
                </button>
              ) : null}
            </div>
          ) : (
            <span className="font-medium text-xs sm:text-sm text-[var(--ink-3)]">
              {note ?? ""}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {secondary}
          {label && onClick ? (
            <button
              type="button"
              onClick={onClick}
              disabled={disabled || busy}
              className={cx(
                "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-6 py-3 text-sm sm:text-base font-bold transition-all duration-150 cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98]",
                "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] hover:brightness-105",
                "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
              )}
            >
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <span>{label}</span>
                  <span aria-hidden className="text-lg leading-none transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
      className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[var(--ink-2)] transition-all hover:bg-slate-50 hover:text-[var(--ink)] shadow-2xs cursor-pointer"
    >
      <span aria-hidden>←</span>
      <span>{target.label}</span>
    </button>
  );
}
