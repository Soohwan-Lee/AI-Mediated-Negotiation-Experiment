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

import { MAX_INDIVIDUAL_POINTS, RESERVATION_POINTS } from "@/lib/tasks";
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
 * The two anchors are the only ones a participant can act on: the most the
 * whole task could pay them, and the fallback they get if there is no
 * agreement. Both are already theirs — the fallback is stated in the briefing
 * and the maximum is the sum of their own best levels — so naming them adds
 * no information the design withholds.
 *
 * WHAT IT MUST NOT SAY. Nothing about the other side's numbers, nothing about
 * the joint total, and no hint that trading term against term pays better
 * than splitting each one. Finding the logroll is the behaviour being
 * observed (§5 "대화 없이 정답을 찾지 못하게 하는 원칙", pilot gate 6) — a key
 * that taught it would hand over the answer.
 */
export function PointsKey({ className }: { className?: string }) {
  return (
    <p
      className={cx(
        "max-w-prose text-[0.75rem] leading-relaxed text-[var(--private-ink)]",
        className,
      )}
    >
      <span aria-hidden>🔢 </span>
      Points say how much a level is worth <strong>to you</strong> — higher is
      better for your situation. The best possible outcome for you across all
      three terms is{" "}
      <span className="tabular font-semibold">
        {MAX_INDIVIDUAL_POINTS.toLocaleString()}
      </span>
      . With no agreement you get your fallback of{" "}
      <span className="tabular font-semibold">
        {RESERVATION_POINTS.toLocaleString()}
      </span>
      .
    </p>
  );
}

/**
 * What the package currently on the table is worth to the participant.
 *
 * The running total is what turns three separate numbers into a decision:
 * picking a level is only meaningful against what the whole package pays, and
 * against the fallback that is the alternative to agreeing at all. Shown only
 * once every term has a level, because a partial sum invites reading it as
 * the total and it would drop as terms were added.
 *
 * Again: the participant's OWN total only. No joint figure, and no comparison
 * with the other side — those are what the conversation is for.
 */
export function PackageValue({
  issues,
  role,
  selection,
  label = "This package pays you",
}: {
  issues: Issue[];
  role: Role;
  selection: Package | Record<string, string | null>;
  label?: string;
}) {
  const chosen = issues.map((issue) => {
    const optionId = selection[issue.id];
    return issue.options.find((o) => o.id === optionId) ?? null;
  });
  if (chosen.some((o) => o === null)) return null;

  const total = chosen.reduce((sum, o) => sum + (o?.points[role] ?? 0), 0);
  const clears = total >= RESERVATION_POINTS;

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.8125rem] text-[var(--private-ink)]">
      <span>{label}</span>
      <span className="tabular text-[1.0625rem] font-semibold text-[var(--ink)]">
        {total.toLocaleString()}
      </span>
      <span className="text-[0.75rem]">
        {clears ? (
          <>
            — above your fallback of{" "}
            <span className="tabular">
              {RESERVATION_POINTS.toLocaleString()}
            </span>
          </>
        ) : (
          <>
            — <span className="font-semibold text-[var(--caution)]">below</span>{" "}
            your fallback of{" "}
            <span className="tabular">
              {RESERVATION_POINTS.toLocaleString()}
            </span>
          </>
        )}
      </span>
    </div>
  );
}

/**
 * Is this the term the participant most needs to protect?
 *
 * Each role's own priority issue, which in ver.2.4 is also where their
 * requirement lives. Both roles get the marker on their own side, because
 * both need to know where their weight sits before trading anything away —
 * and the marker is symmetric for the same reason the payoffs are: a
 * highlight only one role saw would be a difference between the roles that
 * nothing in the design asked for.
 */
function mattersMost(issue: Issue, role: Role): boolean {
  return role === "member"
    ? issue.type === "member_priority"
    : issue.type === "leader_priority";
}

export function IssueValueTable({
  issues,
  role,
  showPoints = true,
  /** Show the scale the numbers are on. Off where a `PointsKey` is already
      on screen, so the same two anchors are not stated twice. */
  showKey = true,
}: {
  issues: Issue[];
  role: Role;
  showPoints?: boolean;
  showKey?: boolean;
}) {
  return (
    <div className="space-y-5">
      {showPoints && showKey ? (
        <PointsKey className="border-b border-[var(--private-line)] pb-3" />
      ) : null}
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
