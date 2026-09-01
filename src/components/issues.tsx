"use client";

/**
 * The two ways issues are shown, used everywhere issues appear.
 *
 * A participant has three terms, each with four levels, and a private point
 * value for every level. That is more than anyone holds in their head, so it
 * is shown in exactly two forms and never a third:
 *
 *   IssueValueTable — read it. Levels in order, what each is worth to you,
 *                     with a bar so the shape of your preferences is visible
 *                     at a glance rather than read off numbers.
 *   OptionChips     — choose one. Same order, same labels, same values.
 *
 * Both live in the private zone or carry their values there: what a level is
 * worth to you is yours alone (globals.css, "colour encodes visibility").
 */

import type { Issue, Package, Role } from "@/lib/types";
import { cx } from "./ui";

/** Share of the best value on this issue, for the bar width. */
function share(issue: Issue, points: number, role: Role): number {
  const best = Math.max(...issue.options.map((o) => o.points[role]), 1);
  return Math.round((points / best) * 100);
}

/**
 * What the numbers on this screen mean — one line, above the numbers.
 *
 * A bare `3000` beside an option is not information: it has no unit, no
 * ceiling and no floor, so a participant cannot tell whether it is a good
 * score or a bad one. Design §5's "payoff 이해 보조 장치" asks for the
 * situation to stay beside the score; the per-issue rationale does that half.
 * This does the other half — it gives the column a scale, so "3,000" can be
 * read as "most of what this term can pay me" rather than as a raw token.
 *
 * The two anchors are the only ones a participant can act on: the most this
 * task could pay them, and the fallback they get if there is no agreement.
 * Both are already theirs — the fallback is stated in the briefing and the
 * maximum is the sum of their own best levels — so naming them adds no
 * information the design withholds.
 *
 * BOTH ARE DERIVED FROM THE TASK, never from the module constants. An earlier
 * version read `MAX_INDIVIDUAL_POINTS` and `RESERVATION_POINTS` directly, and
 * the practice round therefore told participants their best outcome "across
 * all three terms" was 6,300 against a fallback of 2,500 — while the practice
 * task has TWO terms and a fallback of 200. The first payoff sheet anyone sees
 * is the practice one, so that was a wrong scale taught before the real task
 * and then silently contradicted by it.
 *
 * WHAT IT MUST NOT SAY. Nothing about the other side's numbers, nothing about
 * the joint total, and no hint that trading term against term pays better
 * than splitting each one. Finding the logroll is the behaviour being
 * observed (§5 "대화 없이 정답을 찾지 못하게 하는 원칙", pilot gate 6) — a key
 * that taught it would hand over the answer.
 */
export function PointsKey({
  issues,
  role,
  reservationPoints,
  className,
}: {
  issues: Issue[];
  role: Role;
  reservationPoints: number;
  className?: string;
}) {
  const best = issues.reduce(
    (sum, issue) => sum + Math.max(...issue.options.map((o) => o.points[role])),
    0,
  );
  const WORDS = ["no", "one", "two", "three", "four", "five", "six"];
  const termCount =
    issues.length === 2
      ? "both terms"
      : `all ${WORDS[issues.length] ?? issues.length} terms`;

  return (
    <div
      className={cx(
        "rounded-xl border border-[var(--private-line)] bg-[var(--private-soft)] p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed text-[var(--private-ink)] shadow-2xs",
        className,
      )}
    >
      <div className="flex items-center gap-2 font-bold text-sm text-[var(--private-strong)] mb-1.5">
        <span>🔢</span>
        <span>Your Point Guide</span>
      </div>
      <p className="mb-2 text-xs sm:text-[0.8125rem]">
        Points indicate how much a term is worth <strong>to you</strong> (higher is better).
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-100/70 px-2.5 py-1 font-semibold text-amber-900 shadow-2xs">
          🏆 Best possible ({termCount}): <strong className="tabular text-sm">{best.toLocaleString()} pts</strong>
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white/80 px-2.5 py-1 font-semibold text-slate-800 shadow-2xs">
          🛡️ No-agreement fallback: <strong className="tabular text-sm">{reservationPoints.toLocaleString()} pts</strong>
        </span>
      </div>
    </div>
  );
}

export function PackageValue({
  issues,
  role,
  selection,
  reservationPoints,
  label = "This package pays you",
}: {
  issues: Issue[];
  role: Role;
  selection: Package | Record<string, string | null>;
  reservationPoints: number;
  label?: string;
}) {
  const chosen = issues.map((issue) => {
    const optionId = selection[issue.id];
    return issue.options.find((o) => o.id === optionId) ?? null;
  });
  if (chosen.some((o) => o === null)) return null;

  const total = chosen.reduce((sum, o) => sum + (o?.points[role] ?? 0), 0);
  const clears = total >= reservationPoints;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--private-line)] bg-[var(--private-surface)] p-3.5 sm:p-4 shadow-2xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-lg shadow-2xs">
          {clears ? "🏆" : "⚠️"}
        </span>
        <div>
          <p className="text-xs font-semibold text-[var(--private-strong)] uppercase tracking-wide">
            {label}
          </p>
          <p className="tabular text-xl sm:text-2xl font-black text-[var(--ink)]">
            {total.toLocaleString()} <span className="text-sm font-semibold text-[var(--ink-3)]">pts</span>
          </p>
        </div>
      </div>

      <div className="flex items-center">
        {clears ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 shadow-2xs">
            <span>✓</span> Above fallback ({reservationPoints.toLocaleString()})
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 shadow-2xs">
            <span>⚠️</span> Below fallback ({reservationPoints.toLocaleString()})
          </span>
        )}
      </div>
    </div>
  );
}

function mattersMost(issue: Issue, role: Role): boolean {
  return role === "member"
    ? issue.type === "member_priority"
    : issue.type === "leader_priority";
}

export function IssueValueTable({
  issues,
  role,
  reservationPoints,
  showPoints = true,
  showKey = true,
}: {
  issues: Issue[];
  role: Role;
  reservationPoints: number;
  showPoints?: boolean;
  showKey?: boolean;
}) {
  return (
    <div className="space-y-6">
      {showPoints && showKey ? (
        <PointsKey
          issues={issues}
          role={role}
          reservationPoints={reservationPoints}
          className="mb-2"
        />
      ) : null}
      {issues.map((issue) => (
        <div key={issue.id} className="rounded-xl border border-[var(--private-line)] bg-white/60 p-4 shadow-2xs">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm sm:text-base font-bold text-[var(--ink)]">{issue.label}</p>
            {mattersMost(issue, role) ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[0.6875rem] font-extrabold uppercase tracking-wide text-amber-900 shadow-2xs">
                ⭐ Priority
              </span>
            ) : null}
          </div>
          <p className="mb-2 text-xs sm:text-sm leading-relaxed text-[var(--private-ink)]/80">
            {issue.description}
          </p>
          <div className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50/70 p-2.5 text-xs sm:text-[0.8125rem] leading-relaxed text-[var(--private-ink)]">
            <span className="font-semibold">💡 Your Situation: </span>
            <span className="italic">{issue.rationale[role]}</span>
          </div>

          <ul className="space-y-2">
            {issue.options.map((o) => (
              <li key={o.id} className="flex items-center gap-3 text-xs sm:text-sm rounded-lg bg-white p-2 border border-slate-100 shadow-2xs">
                <span className="min-w-0 flex-1 font-medium text-[var(--ink)]">{o.label}</span>
                {showPoints ? (
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100 border border-slate-200"
                    >
                      <span
                        className="block h-full rounded-full bg-[var(--accent)] transition-all"
                        style={{ width: `${share(issue, o.points[role], role)}%` }}
                      />
                    </span>
                    <span className="tabular font-bold text-xs sm:text-sm text-[var(--accent)] min-w-[3.5rem] text-right">
                      {o.points[role].toLocaleString()} pts
                    </span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function OptionChips({
  issue,
  role,
  value,
  onChange,
  name,
  showPoints = true,
  allowNone,
  noneLabel = "No limit",
  tone = "accent",
}: {
  issue: Issue;
  role: Role;
  value: string | null;
  onChange: (optionId: string) => void;
  name: string;
  showPoints?: boolean;
  allowNone?: boolean;
  noneLabel?: string;
  tone?: "accent" | "private";
}) {
  const selectedClass =
    tone === "private"
      ? "border-amber-500 bg-amber-500 text-white shadow-sm scale-102 font-bold"
      : "border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm scale-102 font-bold";

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {allowNone ? (
        <Chip
          name={name}
          selected={value === ""}
          onSelect={() => onChange("")}
          selectedClass={selectedClass}
        >
          <span className="text-[var(--ink-3)] font-medium">{noneLabel}</span>
        </Chip>
      ) : null}

      {issue.options.map((o) => (
        <Chip
          key={o.id}
          name={name}
          selected={value === o.id}
          onSelect={() => onChange(o.id)}
          selectedClass={selectedClass}
        >
          <span className="font-semibold">{o.label}</span>
          {showPoints ? (
            <span
              className={cx(
                "tabular ml-2 rounded-md px-1.5 py-0.5 text-xs font-bold transition-colors",
                value === o.id
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-[var(--accent)]",
              )}
            >
              +{o.points[role]} pts
            </span>
          ) : null}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  name,
  selected,
  onSelect,
  selectedClass,
  children,
}: {
  name: string;
  selected: boolean;
  onSelect: () => void;
  selectedClass: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cx(
        "inline-flex cursor-pointer items-center rounded-xl border-2 px-4 py-2.5 text-sm sm:text-[0.9375rem] transition-all duration-150 shadow-2xs select-none active:scale-[0.98]",
        selected
          ? selectedClass
          : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      {children}
    </label>
  );
}
