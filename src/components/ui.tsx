"use client";

/**
 * Interface primitives.
 *
 * Two rules run through all of them:
 *
 * 1. COLOUR ENCODES VISIBILITY. `tone="private"` marks anything the
 *    counterpart cannot see. See the note in globals.css — this is not
 *    decoration, and private content must never land on a plain white card.
 *
 * 2. NOTHING STARTS ANSWERED. Rating inputs have no default position, so a
 *    participant who skips an item leaves it visibly empty instead of
 *    submitting a midpoint they never chose.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Content column. `reading` for forms and prose, `wide` for the session
 * surfaces that carry a briefing rail. Bottom padding clears the sticky
 * action bar.
 *
 * Both measures come from `globals.css`, which is also where the header and
 * the action bar read theirs — the three have to agree, or the chrome reads as
 * misaligned with the page it frames. They are deliberately generous: a narrow
 * column on a laptop turns a questionnaire into a long scroll while half the
 * screen sits empty. Long prose keeps a reading measure of its own by way of
 * `.prose-study`, so widening here does not stretch paragraphs.
 */
export function Page({
  children,
  width = "reading",
}: {
  children: ReactNode;
  width?: "reading" | "wide";
}) {
  return (
    <main
      // `data-measure` is what the sticky action bar keys off to match this
      // column's width — see the rule in globals.css. It is a plain attribute
      // rather than state so the server and client render the same thing.
      data-measure={width}
      className={cx(
        "mx-auto w-full px-5 pb-32 pt-8 sm:px-6 sm:pt-12 lg:px-8",
        width === "wide" ? "max-w-(--measure-wide)" : "max-w-(--measure-reading)",
      )}
    >
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}) {
  return (
    <header className="mb-8">
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-3)]">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2rem]">
        {title}
      </h1>
      {subtitle ? (
        // Held to a reading measure: the column is wide for forms and tables,
        // but a sentence introducing the page is still a sentence.
        <p className="mt-3 max-w-prose text-[1.0625rem] leading-relaxed text-[var(--ink-2)]">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

export function Card({
  children,
  className,
  tone = "surface",
  padded = true,
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: "surface" | "private" | "muted";
  padded?: boolean;
  /** Anchor target, for the action bar's "go to the first unanswered". */
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cx(
        id && "scroll-mt-24",
        "rounded-[var(--radius-lg)] border",
        padded && "p-5 sm:p-6",
        tone === "private"
          ? "border-[var(--private-line)] bg-[var(--private)]"
          : tone === "muted"
            ? "border-[var(--line)] bg-[var(--surface-muted)]"
            : "border-[var(--line)] bg-[var(--surface)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Section heading inside a card. */
export function CardTitle({
  children,
  hint,
  aside,
}: {
  children: ReactNode;
  hint?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[0.95rem] font-semibold tracking-[-0.01em]">
          {children}
        </h2>
        {hint ? (
          <p className="mt-1 text-sm text-[var(--ink-2)]">{hint}</p>
        ) : null}
      </div>
      {aside}
    </div>
  );
}

export function Callout({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "warning" | "private";
  title?: string;
}) {
  const toneClass =
    tone === "warning"
      ? "border-[#f0dcc0] bg-[var(--caution-soft)] text-[#6d3d05]"
      : tone === "private"
        ? "border-[var(--private-line)] bg-[var(--private)] text-[var(--private-ink)]"
        : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink)]";

  return (
    <div className={cx("rounded-[var(--radius)] border p-4 text-sm", toneClass)}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {/* A callout is prose, and prose does not want the full width of a wide
          column — `max-w-prose` holds the line length while the panel itself
          still spans the card. */}
      <div className="max-w-prose [&>p+p]:mt-2">{children}</div>
    </div>
  );
}

/** Small caps label used to mark a private zone. */
export function PrivateTag({ children = "Private to you" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--private-line)] bg-[#fff9ef] px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--private-strong)]">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--private-strong)]" />
      {children}
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx("border-[var(--line)]", className ?? "my-8")} />;
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

const BUTTON_SIZE = {
  sm: "px-3 py-1.5 text-[0.8125rem]",
  md: "px-5 py-2.5 text-[0.9375rem]",
} as const;

const BUTTON_VARIANT = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]",
  secondary:
    "border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)]",
  quiet: "text-[var(--ink-2)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]",
} as const;

export function Button({
  children,
  onClick,
  disabled,
  type = "button",
  variant = "primary",
  size = "md",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: keyof typeof BUTTON_VARIANT;
  size?: keyof typeof BUTTON_SIZE;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        BUTTON_BASE,
        BUTTON_SIZE[size],
        BUTTON_VARIANT[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx(BUTTON_BASE, BUTTON_SIZE.md, BUTTON_VARIANT.primary)}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export function Field({
  label,
  hint,
  children,
  required,
  flagged,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
  /** Marks an unanswered item after the participant tried to continue. */
  flagged?: boolean;
}) {
  return (
    <div
      className={cx(
        "mb-6 last:mb-0",
        flagged && "-ml-4 border-l-2 border-[var(--caution)] pl-4",
      )}
    >
      <label className="mb-1.5 block text-[0.9375rem] font-medium">
        {label}
        {required ? (
          <span className="ml-1 text-[var(--caution)]" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p className="mb-2 text-sm text-[var(--ink-2)]">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 py-2.5 text-[0.9375rem] outline-none transition-colors placeholder:text-[var(--ink-3)] focus:border-[var(--accent)]";

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  inputMode?: "numeric";
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_CLASS}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cx(INPUT_CLASS, "resize-y leading-relaxed")}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Choose…",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx(INPUT_CLASS, "cursor-pointer")}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Radio options as full-width cards — a larger target than a bare radio. */
export function ChoiceList({
  name,
  value,
  onChange,
  options,
  columns = 1,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; hint?: string }>;
  columns?: 1 | 2;
}) {
  return (
    <div className={cx("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <label
            key={o.value}
            className={cx(
              "flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border p-3.5 text-[0.9375rem] transition-colors",
              selected
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--line-strong)] bg-[var(--surface)] hover:border-[var(--ink-3)]",
            )}
          >
            <input
              type="radio"
              name={name}
              checked={selected}
              onChange={() => onChange(o.value)}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              {o.label}
              {o.hint ? (
                <span className="mt-0.5 block text-sm text-[var(--ink-2)]">
                  {o.hint}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[0.9375rem] leading-relaxed">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span>{children}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Scale
// ---------------------------------------------------------------------------

/**
 * Discrete rating scale — the only rating control in the study.
 *
 * Deliberately NOT a slider: a slider starts somewhere, and "somewhere" gets
 * submitted by everyone who does not engage. Here nothing is selected until
 * the participant picks a point, so a skipped item stays visibly empty and is
 * counted as unanswered by the action bar.
 */
export function Scale({
  id,
  statement,
  value,
  onChange,
  lowAnchor = "Strongly disagree",
  highAnchor = "Strongly agree",
  points = 7,
  flagged,
  compact,
}: {
  id: string;
  statement?: string;
  value: number | null;
  onChange: (v: number) => void;
  lowAnchor?: string;
  highAnchor?: string;
  points?: number;
  flagged?: boolean;
  /** Drops the divider — for a scale sitting alone inside a Field. */
  compact?: boolean;
}) {
  const steps = Array.from({ length: points }, (_, i) => i + 1);

  return (
    <fieldset
      className={cx(
        "scroll-mt-24",
        !compact && "border-b border-[var(--line)] py-3.5 last:border-b-0",
        flagged && "-ml-4 border-l-2 border-l-[var(--caution)] pl-4",
      )}
      id={`q-${id}`}
    >
      {/* A rendered <legend> is laid out by the fieldset itself and does not
          take part in flex, so it cannot sit beside the buttons. It stays as
          the accessible name for the group, hidden, and the visible statement
          below is an ordinary flex child. */}
      {statement ? <legend className="sr-only">{statement}</legend> : null}

      {/* The statement sits beside its buttons once there is room for both.
          Stacked, every item costs two rows, and a battery of eighty of them
          becomes a long scroll; side by side each item is one row and a block
          can be taken in at once. Below `lg` it stacks.

          The statement is the part that flexes and the buttons are the part
          that does not: a fixed statement column plus fixed anchor columns
          plus fixed buttons added up to more than the session column is wide,
          and "Strongly agree" ended up outside the card. Nothing here has a
          minimum width the row cannot give it. */}
      <div className={cx(statement && "lg:flex lg:items-center lg:gap-6")}>
        {statement ? (
          <p
            aria-hidden
            className="mb-2.5 text-[0.9375rem] leading-snug lg:mb-0 lg:min-w-0 lg:flex-1"
          >
            {statement}
          </p>
        ) : null}

        {/* ONE anchor placement, not two. The anchors used to flank the row on
            a wide screen and sit under it on a narrow one, which is two
            layouts to keep working and the reason the wide one could overflow.
            Under the row they are the same thing at every width, and they sit
            directly beneath the end they name. */}
        <div
          className="w-full lg:shrink-0"
          // Caps the row at a comfortable button size instead of stretching
          // seven circles across a wide column. Below the cap the buttons
          // shrink with the container, so the row cannot overflow it.
          style={{ maxWidth: `calc(${points} * 2.875rem)` }}
        >
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${points}, minmax(0, 1fr))` }}
          >
            {steps.map((n) => {
              const selected = value === n;
              return (
                <label key={n} className="group cursor-pointer">
                  <input
                    type="radio"
                    name={id}
                    checked={selected}
                    onChange={() => onChange(n)}
                    className="sr-only"
                  />
                  <span
                    className={cx(
                      "flex aspect-square w-full items-center justify-center rounded-full border-2 text-[0.8125rem] font-medium transition-colors",
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink-3)] group-hover:border-[var(--accent)] group-hover:text-[var(--ink)]",
                    )}
                  >
                    {n}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-1.5 flex items-start justify-between gap-3 text-[0.75rem] leading-tight text-[var(--ink-2)]">
            <span className="max-w-[48%]">{lowAnchor}</span>
            <span className="max-w-[48%] text-right">{highAnchor}</span>
          </div>
        </div>
      </div>
    </fieldset>
  );
}

/**
 * Quantity picker in the same visual language as `Scale`, for values that are
 * an amount rather than an opinion. Same reason for having no default.
 */
export function AmountScale({
  id,
  value,
  onChange,
  max = 100,
  step = 10,
  unit,
}: {
  id: string;
  value: number | null;
  onChange: (v: number) => void;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const steps = Array.from({ length: max / step + 1 }, (_, i) => i * step);

  return (
    <fieldset id={`q-${id}`} className="scroll-mt-24">
      {/* A grid rather than a wrapping flex row: with `flex-1` a leftover chip
          on the last line stretched to the full width and stopped looking like
          the same control as the ones above it. Columns fit themselves to the
          container, so this cannot overflow either. */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(3rem, 1fr))" }}
      >
        {steps.map((n) => {
          const selected = value === n;
          return (
            <label key={n} className="group cursor-pointer">
              <input
                type="radio"
                name={id}
                checked={selected}
                onChange={() => onChange(n)}
                className="sr-only"
              />
              <span
                className={cx(
                  "tabular flex h-11 items-center justify-center rounded-[var(--radius)] border-2 text-[0.875rem] transition-colors",
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink-2)] group-hover:border-[var(--accent)] group-hover:text-[var(--ink)]",
                )}
              >
                {n}
              </span>
            </label>
          );
        })}
      </div>
      {unit ? (
        <p className="mt-2 text-xs text-[var(--ink-2)]">{unit}</p>
      ) : null}
    </fieldset>
  );
}
