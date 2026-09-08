"use client";

/**
 * The two ways issues are shown, used everywhere issues appear.
 *
 * A participant has two terms, each with four levels, and a private point
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
import { comparePointsToFallback } from "@/lib/points-display";
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
 * task could pay them, and what they get if there is no agreement. Both are
 * already theirs — the no-agreement figure is stated in the briefing and the
 * maximum is the sum of their own best levels — so naming them adds no
 * information the design withholds.
 *
 * THERE IS NO FALLBACK PLAN ANY MORE (§3.2, Ver.2.21). `reservationPoints` is
 * 0, and "fallback" named a safety net that no longer exists — a participant
 * who read it would think they came away with something. The wording says what
 * is true instead: no agreement pays nothing, to BOTH sides. Saying "for both"
 * is safe and not a leak of the other side's sheet — §8.1 already tells every
 * participant that failing to agree scores zero for the pair, and it is what
 * stops "0 pts" reading as a penalty aimed at them alone.
 *
 * BOTH ARE DERIVED FROM THE TASK, never from the module constants. An earlier
 * version read `MAX_INDIVIDUAL_POINTS` and `RESERVATION_POINTS` directly, so
 * the practice round quoted the real task's maximum and no-agreement figure
 * instead of its own. The first payoff sheet anyone sees is the practice one, so that was
 * a wrong scale taught before the real task and then silently contradicted by
 * it. The practice task still keeps its own smaller numbers, so the hazard is
 * live even now that both tasks have the same shape.
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
        "rounded-2xl border border-[var(--private-line)] bg-gradient-to-br from-[var(--private-soft)] to-amber-50/40 p-4 text-xs sm:text-sm leading-relaxed text-[var(--private-ink)] shadow-2xs",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 font-bold text-sm text-[var(--private-strong)] mb-1.5">
        <span>How your points work</span>
        <span className="rounded-full border border-[var(--private-line)] bg-white/80 px-2 py-0.5 text-[0.625rem] font-extrabold uppercase tracking-wider">
          Private
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-[var(--private-ink)]/90">
        <strong>More points means a better outcome for you.</strong> The other
        person never sees your point values.
      </p>
      {/* Label above value, not beside it. These pills live in the ~355px
          briefing rail as well as the wide task column, and as one inline row
          the label and the number wrapped INSIDE the pill — "Best possible
          (both terms):" on one line and "3,900 pts" on the next, which reads
          as a broken badge rather than a stacked one. Stacking deliberately
          gives the same shape at both widths, and `min-w-0` lets the pills
          shrink instead of pushing the rail wider. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <span className="min-w-0 flex flex-col justify-between rounded-xl border border-amber-300 bg-amber-100/80 px-3 py-2 font-semibold text-amber-950 shadow-2xs">
          <span className="block text-[0.6875rem] leading-tight opacity-90 font-medium break-words">
            Best possible ({termCount})
          </span>
          <strong className="tabular block text-sm font-black leading-tight mt-1 shrink-0">
            {best.toLocaleString()} pts
          </strong>
        </span>
        <span className="min-w-0 flex flex-col justify-between rounded-xl border border-slate-300 bg-white/90 px-3 py-2 font-semibold text-slate-800 shadow-2xs">
          <span className="block text-[0.6875rem] leading-tight opacity-90 font-medium break-words">
            No agreement (both score 0)
          </span>
          <strong className="tabular block text-sm font-black leading-tight mt-1 shrink-0">
            {reservationPoints.toLocaleString()} pts
          </strong>
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
  label = "Your points for this package",
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
  const comparison = comparePointsToFallback(total, reservationPoints);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--private-line)] bg-[var(--private-surface)] p-3.5 sm:p-4 shadow-2xs">
      <div className="min-w-0">
        <div>
          <p className="text-xs font-semibold text-[var(--private-strong)] uppercase tracking-wide">
            {label}
          </p>
          <p className="tabular text-xl sm:text-2xl font-black text-[var(--ink)]">
            {total.toLocaleString()} <span className="text-sm font-semibold text-[var(--ink-3)]">pts</span>
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--private-line)] bg-white/75 px-3 py-2 text-xs font-semibold text-[var(--private-strong)]">
        {/* NO AGREEMENT IS WORTH NOTHING since Ver.2.21 (§3.2), so "above
            fallback" named a safety net that no longer exists. The comparison
            is kept — it is what makes a bare point total mean anything — and
            said against the real figure instead. */}
        {comparison === "above"
          ? `Above no agreement (${reservationPoints.toLocaleString()} pts)`
          : comparison === "below"
            ? `Below no agreement (${reservationPoints.toLocaleString()} pts)`
            : `Same as no agreement (${reservationPoints.toLocaleString()} pts)`}
      </div>
    </div>
  );
}

export function IssueValueTable({
  issues,
  role,
  reservationPoints,
  showPoints = true,
  showKey = true,
  compact = false,
}: {
  issues: Issue[];
  role: Role;
  reservationPoints: number;
  showPoints?: boolean;
  showKey?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-3" : "space-y-6"}>
      {showPoints && showKey ? (
        <PointsKey
          issues={issues}
          role={role}
          reservationPoints={reservationPoints}
          className="mb-2"
        />
      ) : null}
      {issues.map((issue) => (
        <div
          key={issue.id}
          className={cx(
            "border border-[var(--private-line)] bg-white/80 shadow-2xs",
            compact ? "rounded-xl p-3" : "rounded-2xl p-4 sm:p-5",
          )}
        >
          {/* No badge marks which issue is this role's priority, and none may
              be added. Design §5 principle 1 is explicit that issue type and
              core-requirement marking are not displayed: a star on one issue
              tells a participant which term the study is about before a word is
              negotiated, and lets them infer the counterpart sees the same on
              theirs — which hands over the shape of the logroll. Finding the
              logroll is the behaviour being observed (pilot gate 6). The points
              and the one-line rationale below already convey what matters to
              this role, through the role's own story rather than a label. */}
          <div className="mb-1.5">
            <p className="text-sm sm:text-base font-bold text-[var(--ink)]">{issue.label}</p>
          </div>
          <p className="mb-2 text-xs sm:text-sm leading-relaxed text-[var(--private-ink)]/80">
            {issue.description}
          </p>
          <div
            className={cx(
              "rounded-xl border border-amber-200/80 bg-amber-50/70 text-xs sm:text-[0.8125rem] leading-relaxed text-[var(--private-ink)] font-medium",
              compact ? "mb-2 p-2" : "mb-3 p-2.5",
            )}
          >
            <span className="font-bold text-amber-950">Why it matters to you: </span>
            <span>{issue.rationale[role]}</span>
          </div>

          <ul className={compact ? "space-y-1.5" : "space-y-2"}>
            {issue.options.map((o) => (
              <li
                key={o.id}
                className={cx(
                  "flex items-center gap-2.5 text-xs sm:text-sm rounded-xl bg-white border border-slate-100 shadow-2xs",
                  compact ? "p-2" : "p-2.5",
                )}
              >
                <span className="min-w-0 flex-1 font-semibold text-[var(--ink)] leading-snug break-words">{o.label}</span>
                {showPoints ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      aria-hidden
                      className="h-2 w-14 sm:w-20 shrink-0 overflow-hidden rounded-full bg-slate-100 border border-slate-200"
                    >
                      <span
                        className="block h-full rounded-full bg-[var(--accent)] transition-all"
                        style={{ width: `${share(issue, o.points[role], role)}%` }}
                      />
                    </span>
                    <span className="tabular font-extrabold text-xs sm:text-sm text-[var(--accent)] min-w-[3.25rem] text-right shrink-0">
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
      ? "border-amber-500 bg-amber-500 text-white shadow-sm font-bold ring-2 ring-amber-500/20"
      : "border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm font-bold ring-2 ring-[var(--accent)]/20";

  // Two columns, not four. The labels are short phrases ("4 per month",
  // "1 per week") rather than single words, and at four columns inside the
  // task's ~50rem content width every one of them truncated to "4 per mo…" —
  // which is the part of a chip a participant actually has to read. Two
  // columns fit the phrase and the point badge whole.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5">
      {allowNone ? (
        <Chip
          name={name}
          selected={value === ""}
          onSelect={() => onChange("")}
          selectedClass={selectedClass}
        >
          <span className="text-[var(--ink-3)] font-medium truncate">{noneLabel}</span>
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
          <div className="flex w-full items-center justify-between gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-semibold leading-snug break-words min-w-0">{o.label}</span>
            {showPoints ? (
              <span
                className={cx(
                  "tabular shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-2xs sm:text-xs font-bold transition-colors",
                  value === o.id
                    ? "bg-white/25 text-white"
                    : "bg-slate-100 text-[var(--accent)]",
                )}
              >
                +{o.points[role]} pts
              </span>
            ) : null}
          </div>
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
        "flex w-full cursor-pointer items-center rounded-xl border-2 px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm transition-all duration-150 shadow-2xs select-none active:scale-[0.98]",
        selected
          ? selectedClass
          : "border-[var(--line-strong)] bg-white text-[var(--ink)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50",
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
