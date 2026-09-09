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

  /* NO CARD AROUND THE TWO PILLS (round six). This was a bordered, tinted,
     rounded panel wrapping one sentence and two pills, sitting inside the
     brief page's own private card — a box in a box to say two numbers. The
     sentence and the pills are rendered straight onto the page instead. The
     pills keep their own borders, because they are the two ends of the scale
     and have to be told apart at a glance; nothing else here needs a surface.

     THE SECOND "PRIVATE" PILL WENT WITH IT. Every screen this appears on
     already carries `PrivateTag` in its own header, so the pill was the same
     claim twice within one card. */
  return (
    <div
      className={cx(
        "text-xs leading-relaxed text-[var(--private-ink)] sm:text-sm",
        className,
      )}
    >
      <p className="mb-2.5 text-xs leading-relaxed text-[var(--private-ink)]/90">
        <strong className="text-[var(--private-strong)]">
          More points means a better outcome for you.
        </strong>{" "}
        These values are private. The other person never sees them.
      </p>
      {/* Label above value, not beside it. These pills live in the ~355px
          briefing rail as well as the wide task column, and as one inline row
          the label and the number wrapped INSIDE the pill — "Best possible
          (both terms):" on one line and "3,900 pts" on the next, which reads
          as a broken badge rather than a stacked one. Stacking deliberately
          gives the same shape at both widths, and `min-w-0` lets the pills
          shrink instead of pushing the rail wider.

          THE TWO PILLS ARE DIFFERENT COLOURS AND CARRY AN ICON EACH. Both
          used to be warm on a warm ground, so the ceiling and the floor of
          the whole scale read as one pair of badges and a participant had to
          read the words to tell which was which. Emerald for the best you
          could do, slate-and-⛔ for the nothing. Neither colour makes a claim
          about the negotiation: they mark the two ends of the participant's
          OWN scale, which is what makes a bare "3,000" mean anything. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <span className="min-w-0 flex flex-col justify-between rounded-xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2 font-semibold text-emerald-950 shadow-2xs">
          <span className="flex items-center gap-1.5 text-[0.6875rem] leading-tight font-bold break-words">
            <span aria-hidden>🏆</span>
            <span>Best possible ({termCount})</span>
          </span>
          <strong className="tabular block text-base font-black leading-tight mt-1 shrink-0 text-emerald-800">
            {best.toLocaleString()} pts
          </strong>
        </span>
        <span className="min-w-0 flex flex-col justify-between rounded-xl border-2 border-slate-400 bg-slate-100 px-3 py-2 font-semibold text-slate-900 shadow-2xs">
          <span className="flex items-center gap-1.5 text-[0.6875rem] leading-tight font-bold break-words">
            <span aria-hidden>⛔</span>
            <span>No agreement (both score 0)</span>
          </span>
          <strong className="tabular block text-base font-black leading-tight mt-1 shrink-0 text-slate-700">
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

/**
 * The point sheet as it is READ for the first time, on brief page 3.
 *
 * `compact` and `showKey` are gone (round six). They existed for the briefing
 * rail, which rendered this table at 13px behind a tab; the rail now has its
 * own `RailPointSheet` written for the job — no description, no key, two
 * columns at every width — so this component has exactly one caller and both
 * flags were dead branches that would drift out of step with it. `showPoints`
 * has no caller either at the moment and is kept because hiding the point
 * column is a real thing a screen may need to do; it is one boolean, not a
 * second layout.
 */
export function IssueValueTable({
  issues,
  role,
  reservationPoints,
  showPoints = true,
}: {
  issues: Issue[];
  role: Role;
  reservationPoints: number;
  showPoints?: boolean;
}) {
  return (
    <div className="space-y-4">
      {showPoints ? (
        <PointsKey
          issues={issues}
          role={role}
          reservationPoints={reservationPoints}
        />
      ) : null}

      {/* "BOTH OF THESE GET NEGOTIATED. ONE OPTION IS AGREED ON EACH." IS
          GONE (round six). Brief page 1 already says one agreed option per
          condition, two pages earlier, and the two headed columns below say
          the rest by being two columns. It was written when the issues were
          stacked in one column and participants asked whether they were
          picking one option in total; side by side, the layout answers it. */}
      {/* Stacked below `md`: two columns at 400px turns each option label into
          a two-word ribbon, and the labels are short phrases that have to be
          read whole. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {issues.map((issue, index) => {
          const best = Math.max(...issue.options.map((o) => o.points[role]));
          return (
            <div
              key={issue.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-[var(--private-line)] bg-white shadow-2xs"
            >
              {/* No badge marks which issue is this role's priority, and none
                  may be added. Design §5 principle 1 is explicit that issue
                  type and core-requirement marking are not displayed: a star
                  on one issue tells a participant which term the study is
                  about before a word is negotiated. "Issue 1" and "Issue 2"
                  are POSITIONAL and carry no such claim — they are the same
                  two words in the same order for both roles, and the order is
                  the task's own. */}
              <div className="border-b border-[var(--private-line)] bg-[var(--private-soft)] px-3 py-2">
                <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-[var(--private-strong)]">
                  Issue {index + 1}
                </p>
                <p className="text-sm font-bold leading-snug text-[var(--ink)]">
                  {issue.label}
                </p>
              </div>

              <div className="flex-1 p-3">
                {/* THE "WHY IT MATTERS TO YOU" BOX IS GONE (round six). It
                    restated the role story that was read on the previous
                    page and, for the participant's own priority term,
                    restated the sensitive background too — so the brief said
                    the same thing three pages running and the point sheet
                    itself, which is what this page is for, was pushed down by
                    two amber boxes. The issue description stays: it is the
                    only line here that says what the four options actually
                    mean.

                    Removing it also removes a box that appeared on ONE of the
                    two issue cards more forcefully than the other, which is
                    the kind of asymmetry §5 principle 1 is about. */}
                <p className="mb-2.5 text-xs leading-relaxed text-[var(--private-ink)]/80">
                  {issue.description}
                </p>

                <ul className="space-y-1.5">
                  {issue.options.map((o) => {
                    const points = o.points[role];
                    const isBest = showPoints && points === best;
                    return (
                      <li
                        key={o.id}
                        className={cx(
                          "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs sm:text-[0.8125rem]",
                          isBest
                            ? "border-emerald-300 bg-emerald-50/70"
                            : "border-slate-200 bg-white",
                        )}
                      >
                        <span className="min-w-0 flex-1 font-semibold leading-snug text-[var(--ink)] break-words">
                          {o.label}
                        </span>
                        {showPoints ? (
                          <>
                            {/* The bar goes on the best row only. Four bars of
                                four different lengths made the reader compare
                                bar lengths; what they need is which row is the
                                top one and what each row pays. */}
                            {isBest ? (
                              <span
                                aria-hidden
                                className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[0.5625rem] font-black uppercase tracking-wide text-white"
                              >
                                Best
                              </span>
                            ) : null}
                            <span
                              className={cx(
                                "tabular shrink-0 min-w-[3.5rem] text-right font-extrabold",
                                isBest ? "text-emerald-800" : "text-[var(--ink-3)]",
                              )}
                            >
                              {points.toLocaleString()} pts
                            </span>
                          </>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The whole point sheet as a cheat sheet, for the briefing rail.
 *
 * WHY IT IS A SEPARATE COMPONENT AND NOT A THIRD FLAG ON `IssueValueTable`.
 * The rail's job is different from the brief page's. On the brief page the
 * participant is READING the sheet for the first time and needs the issue
 * description and the sentence saying what the two columns are. In the rail
 * they are typing a message and need to find one number without leaving the
 * sentence they are in. Everything that is not a label and a number is
 * therefore gone: no description, no "why it matters", no key paragraph.
 *
 * TWO COLUMNS INSIDE THE RAIL, always, at every width the rail exists at.
 * Stacked, the two tables ran to about 320px and pushed the reason cards —
 * the other thing a participant reaches for mid-sentence — below the fold,
 * which is the complaint this rewrite exists to answer. Side by side they are
 * about 150px and both boxes stay on screen together. The option labels are
 * short phrases ("4 days a week", "1 per week") and fit a 180px column at
 * 11.5px; longer ones wrap rather than truncate.
 *
 * NO BADGE MARKS EITHER ISSUE (design §5 principle 1). "Issue 1" and "Issue 2"
 * are positional, the same two words in the same order for both roles. The
 * emerald row is the participant's own best option on each term, which is a
 * fact about their own sheet and says nothing about which term the study is
 * about — both issues have one.
 *
 * THE ANCHORS ARE DERIVED FROM THE TASK, never from the module constants, for
 * the reason `PointsKey` records: the practice round has its own smaller
 * numbers and would otherwise quote the real task's.
 */
export function RailPointSheet({
  issues,
  role,
  reservationPoints,
}: {
  issues: Issue[];
  role: Role;
  reservationPoints: number;
}) {
  const best = issues.reduce(
    (sum, issue) => sum + Math.max(...issue.options.map((o) => o.points[role])),
    0,
  );
  return (
    <div>
      {/* `items-stretch` and a fixed two-line header. The two issue labels are
          not the same length — "Days a week in the office" is one line and
          "Client meetings the Member presents at" is two — so with a header
          that sizes to its own text the four option rows in the left table sat
          a line above the four in the right, and a participant scanning across
          read "4 days" against the wrong row. Both headers are given a box tall
          enough for the longer of the two labels — 3.625rem fits the eyebrow
          plus two 12px lines — so the rows line up in all four role x task
          cells. Measure it again if a task label is ever lengthened. */}
      <div className="grid grid-cols-2 items-stretch gap-2">
        {issues.map((issue, index) => {
          const issueBest = Math.max(...issue.options.map((o) => o.points[role]));
          return (
            <div
              key={issue.id}
              className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-[var(--private-line)] bg-white"
            >
              <div className="flex min-h-[3.625rem] flex-col justify-center border-b border-[var(--private-line)] bg-[var(--private-soft)] px-2 py-1.5">
                <p className="text-[0.5625rem] font-extrabold uppercase tracking-wider text-[var(--private-strong)]">
                  Issue {index + 1}
                </p>
                <p className="text-[0.75rem] font-bold leading-tight text-[var(--ink)] break-words">
                  {issue.label}
                </p>
              </div>
              <ul>
                {issue.options.map((o) => {
                  const points = o.points[role];
                  const isBest = points === issueBest;
                  return (
                    <li
                      key={o.id}
                      className={cx(
                        "flex items-baseline gap-1.5 border-b border-slate-100 px-2 py-1 text-[0.71875rem] last:border-b-0",
                        isBest ? "bg-emerald-50" : "",
                      )}
                    >
                      <span
                        className={cx(
                          "min-w-0 flex-1 leading-snug break-words",
                          isBest
                            ? "font-bold text-emerald-950"
                            : "font-medium text-[var(--ink-2)]",
                        )}
                      >
                        {o.label}
                      </span>
                      <span
                        className={cx(
                          "tabular shrink-0 font-extrabold",
                          isBest ? "text-emerald-800" : "text-[var(--ink-3)]",
                        )}
                      >
                        {points.toLocaleString()}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* The two ends of the participant's OWN scale, on one line. Both are
          already theirs — §8.1 states the no-agreement figure to everyone and
          the maximum is the sum of their own best levels — so neither adds
          anything the design withholds. "both score 0" rather than a bare 0,
          for the reason `PointsKey` records: unqualified it reads as a
          penalty aimed at this participant alone. */}
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.71875rem] font-semibold text-[var(--private-ink)]">
        <span className="whitespace-nowrap">
          <span aria-hidden>🏆</span> Best possible{" "}
          <strong className="tabular text-emerald-800">
            {best.toLocaleString()} pts
          </strong>
        </span>
        <span className="whitespace-nowrap">
          <span aria-hidden>⛔</span> No agreement{" "}
          <strong className="tabular text-slate-700">
            {reservationPoints.toLocaleString()} pts
          </strong>{" "}
          <span className="font-medium text-[var(--ink-3)]">(both)</span>
        </span>
      </p>
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
