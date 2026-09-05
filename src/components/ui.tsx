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
      data-measure={width}
      className={cx(
        "mx-auto w-full px-4 pb-36 pt-6 sm:px-6 sm:pt-10 lg:px-8",
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
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-0.5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--accent)] shadow-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          {eyebrow}
        </div>
      ) : null}
      <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl lg:text-[2.25rem] lg:leading-tight">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2.5 max-w-prose text-base leading-relaxed text-[var(--ink-2)] sm:text-lg">
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
  cue,
}: {
  children: ReactNode;
  className?: string;
  tone?: "surface" | "private" | "muted";
  padded?: boolean;
  id?: string;
  cue?: boolean;
}) {
  return (
    <section
      id={id}
      className={cx(
        id && "scroll-mt-24",
        "rounded-[var(--radius-lg)] border transition-all duration-200",
        padded && "p-5 sm:p-7",
        cue && (tone === "private" ? "cue-ring-private" : "cue-ring"),
        tone === "private"
          ? "border-[var(--private-line)] bg-[var(--private-surface)] shadow-[var(--shadow-sm)] text-[var(--private-ink)]"
          : tone === "muted"
            ? "border-[var(--line)] bg-[var(--surface-muted)] shadow-[var(--shadow-xs)]"
            : "border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]",
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
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold tracking-tight text-[var(--ink)] sm:text-lg break-words leading-snug">
          {children}
        </h2>
        {hint ? (
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink-3)] break-words">{hint}</p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
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
      ? "border-[var(--caution-line)] bg-[var(--caution-soft)] text-[#78350f] shadow-xs"
      : tone === "private"
        ? "border-[var(--private-line)] bg-[var(--private-surface)] text-[var(--private-ink)] shadow-xs"
        : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink)] shadow-xs";

  return (
    <div className={cx("rounded-[var(--radius)] border p-4 sm:p-5 text-sm leading-relaxed", toneClass)}>
      {title ? (
        <p className="mb-1.5 flex items-center gap-2 font-semibold text-[0.95rem]">
          {title}
        </p>
      ) : null}
      <div className="max-w-prose [&>p+p]:mt-2">{children}</div>
    </div>
  );
}

export function Cue({
  children,
  tone = "accent",
}: {
  children: ReactNode;
  tone?: "accent" | "quiet" | "positive";
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] shadow-2xs",
        tone === "accent"
          ? "border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : tone === "positive"
            ? "border border-[var(--positive-line)] bg-[var(--positive-soft)] text-[var(--positive)]"
            : "border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink-3)]",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "h-2 w-2 rounded-full",
          tone === "accent"
            ? "animate-pulse bg-[var(--accent)]"
            : tone === "positive"
              ? "bg-[var(--positive)]"
              : "bg-[var(--ink-4)]",
        )}
      />
      {children}
    </span>
  );
}

/** Small caps label used to mark a private zone. */
export function PrivateTag({ children = "Private to you" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--private-line)] bg-[var(--private-soft)] px-3 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--private-strong)] shadow-2xs">
      <span aria-hidden className="text-xs">🔒</span>
      {children}
    </span>
  );
}


/**
 * Visual key point item with icon for scanning dense information quickly.
 */
export function KeyPoint({
  icon,
  title,
  children,
  highlight = false,
}: {
  icon?: string;
  title: string;
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex items-start gap-3 rounded-xl border p-3 sm:p-3.5 transition-all",
        highlight
          ? "border-blue-200 bg-blue-50/60 text-blue-950"
          : "border-slate-100 bg-slate-50/70 text-slate-800",
      )}
    >
      {icon ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-2xs text-sm">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
          {title}
        </p>
        <div className="mt-0.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * 2-column or 3-column summary grid for quick scanning
 */
export function SummaryGrid({
  children,
  cols = 2,
}: {
  children: ReactNode;
  cols?: 2 | 3;
}) {
  return (
    <div
      className={cx(
        "grid gap-2.5 sm:gap-3",
        cols === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2",
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-semibold transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 select-none active:scale-[0.98]";

const BUTTON_SIZE = {
  sm: "px-3.5 py-1.5 text-xs shadow-2xs",
  md: "px-5 py-2.5 text-sm sm:text-[0.9375rem] shadow-xs hover:shadow-sm",
} as const;

const BUTTON_VARIANT = {
  primary:
    "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-sm hover:shadow",
  secondary:
    "border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] hover:border-[var(--ink-4)]",
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
  flagged?: boolean;
}) {
  return (
    <div
      className={cx(
        "mb-6 last:mb-0 transition-all",
        flagged && "-ml-4 border-l-4 border-[var(--caution)] pl-4 bg-amber-50/50 py-2 rounded-r-lg",
      )}
    >
      <label className="mb-1.5 block text-sm sm:text-base font-semibold text-[var(--ink)]">
        {label}
        {required ? (
          <span className="ml-1.5 text-[var(--caution)] font-bold" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p className="mb-2.5 text-sm text-[var(--ink-3)] leading-relaxed">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-3 text-sm sm:text-base outline-none transition-all placeholder:text-[var(--ink-4)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--focus-ring)] shadow-2xs";

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
      className={cx(INPUT_CLASS, "cursor-pointer font-medium")}
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

/** Radio options as full-width cards */
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
    <div className={cx("grid gap-2.5", columns === 2 && "sm:grid-cols-2")}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <label
            key={o.value}
            className={cx(
              "flex cursor-pointer items-start gap-3.5 rounded-[var(--radius)] border p-4 text-sm sm:text-base transition-all duration-150 shadow-2xs select-none",
              selected
                ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[var(--accent-border)] font-medium"
                : "border-[var(--line-strong)] bg-[var(--surface)] hover:border-[var(--ink-4)] hover:bg-slate-50/70",
            )}
          >
            <input
              type="radio"
              name={name}
              checked={selected}
              onChange={() => onChange(o.value)}
              className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-[var(--accent)] cursor-pointer"
            />
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-[var(--ink)]">{o.label}</span>
              {o.hint ? (
                <span className="mt-1 block text-xs sm:text-sm text-[var(--ink-3)] leading-relaxed">
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
    <label className="flex cursor-pointer items-start gap-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 sm:p-4 text-sm sm:text-base leading-relaxed transition-all hover:bg-slate-50 shadow-2xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[var(--accent)] cursor-pointer"
      />
      <span className="text-[var(--ink-2)] select-none">{children}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Scale
// ---------------------------------------------------------------------------

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
  compact?: boolean;
}) {
  const steps = Array.from({ length: points }, (_, i) => i + 1);

  return (
    <fieldset
      className={cx(
        "scroll-mt-24 transition-all",
        !compact && "border-b border-[var(--line)] py-4 last:border-b-0",
        flagged && "-ml-4 border-l-4 border-l-[var(--caution)] pl-4 bg-amber-50/50 rounded-r-xl py-3 my-1",
      )}
      id={`q-${id}`}
    >
      {statement ? <legend className="sr-only">{statement}</legend> : null}

      <div className={cx(statement && "lg:flex lg:items-center lg:gap-6")}>
        {statement ? (
          <p
            aria-hidden
            className="mb-3 text-sm sm:text-[0.9375rem] font-medium leading-relaxed text-[var(--ink)] lg:mb-0 lg:min-w-0 lg:flex-1"
          >
            {statement}
          </p>
        ) : null}

        <div
          className="w-full lg:shrink-0"
          style={{ maxWidth: `calc(${points} * 3.25rem)` }}
        >
          <div
            className="grid gap-2"
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
                      "flex aspect-square w-full items-center justify-center rounded-xl border-2 text-sm sm:text-base font-bold transition-all duration-150 shadow-2xs",
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm scale-105"
                        : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink-3)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] group-hover:bg-[var(--accent-soft)] group-hover:scale-102",
                    )}
                  >
                    {n}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-2 flex items-start justify-between gap-3 text-xs font-medium text-[var(--ink-3)]">
            <span className="max-w-[48%] leading-tight break-words">{lowAnchor}</span>
            <span className="max-w-[48%] text-right leading-tight break-words">{highAnchor}</span>
          </div>
        </div>
      </div>
    </fieldset>
  );
}

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
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(3.25rem, 1fr))" }}
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
                  "tabular flex h-12 items-center justify-center rounded-xl border-2 text-sm sm:text-base font-bold transition-all duration-150 shadow-2xs",
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm scale-105"
                    : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink-2)] group-hover:border-[var(--accent)] group-hover:bg-[var(--accent-soft)] group-hover:text-[var(--accent)] group-hover:scale-102",
                )}
              >
                {n}
              </span>
            </label>
          );
        })}
      </div>
      {unit ? (
        <p className="mt-2.5 text-xs font-medium text-[var(--ink-3)]">{unit}</p>
      ) : null}
    </fieldset>
  );
}
