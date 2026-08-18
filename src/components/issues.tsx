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

import type { Issue, Role } from "@/lib/types";
import { cx } from "./ui";

/** Share of the best value on this issue, for the bar width. */
function share(issue: Issue, points: number, role: Role): number {
  const best = Math.max(...issue.options.map((o) => o.points[role]), 1);
  return Math.round((points / best) * 100);
}

/**
 * Is this the term the participant most needs to protect?
 *
 * The focal issue is the Member's; the Leader's own big issue is scope. Both
 * get the marker on their own side, because both need to know where their
 * weight sits before they can trade anything away.
 */
function mattersMost(issue: Issue, role: Role): boolean {
  return role === "member"
    ? issue.type === "member_focal"
    : issue.type === "leader_integrative";
}

export function IssueValueTable({
  issues,
  role,
  showPoints = true,
}: {
  issues: Issue[];
  role: Role;
  showPoints?: boolean;
}) {
  return (
    <div className="space-y-5">
      {issues.map((issue) => (
        <div key={issue.id}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <p className="text-[0.875rem] font-semibold">{issue.label}</p>
            {mattersMost(issue, role) ? (
              <span className="shrink-0 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--private-strong)]">
                Matters most
              </span>
            ) : null}
          </div>
          <p className="mb-1 text-[0.8125rem] leading-snug text-[var(--private-ink)]/75">
            {issue.description}
          </p>
          {/* Why the level matters to YOU. Without it the point column is just
              numbers to optimize; with it there is something to say to the
              other side that is not "this is worth more to me". */}
          <p className="mb-2 max-w-prose text-[0.8125rem] italic leading-snug text-[var(--private-ink)]/75">
            {issue.rationale[role]}
          </p>

          <ul className="space-y-1">
            {issue.options.map((o) => (
              <li key={o.id} className="flex items-center gap-2 text-[0.8125rem]">
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {showPoints ? (
                  <>
                    <span
                      aria-hidden
                      className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--private-line)]"
                    >
                      <span
                        className="block h-full rounded-full bg-[var(--private-strong)]"
                        style={{ width: `${share(issue, o.points[role], role)}%` }}
                      />
                    </span>
                    <span className="tabular w-7 shrink-0 text-right text-[0.75rem] text-[var(--private-ink)]">
                      {o.points[role]}
                    </span>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Pick one level of one issue.
 *
 * Chips rather than a dropdown: every level and what it is worth stays on
 * screen, so choosing is a comparison rather than a memory test.
 */
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
  /** Radio group name — must be unique on the page. */
  name: string;
  showPoints?: boolean;
  allowNone?: boolean;
  noneLabel?: string;
  tone?: "accent" | "private";
}) {
  const selectedClass =
    tone === "private"
      ? "border-[var(--private-strong)] bg-[var(--private-strong)] text-white"
      : "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]";

  return (
    <div className="flex flex-wrap gap-1.5">
      {allowNone ? (
        <Chip
          name={name}
          selected={value === ""}
          onSelect={() => onChange("")}
          selectedClass={selectedClass}
        >
          <span className="text-[var(--ink-3)]">{noneLabel}</span>
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
          {o.label}
          {showPoints ? (
            <span
              className={cx(
                "tabular ml-1.5 text-[0.75rem]",
                value === o.id ? "opacity-70" : "text-[var(--ink-3)]",
              )}
            >
              {o.points[role]}
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
        "cursor-pointer rounded-full border px-3 py-1.5 text-[0.8125rem] transition-colors",
        selected
          ? selectedClass
          : "border-[var(--line-strong)] bg-[var(--surface)] hover:border-[var(--ink-3)]",
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
