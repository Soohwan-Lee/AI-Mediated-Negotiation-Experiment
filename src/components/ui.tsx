"use client";

/**
 * Shared primitives. Intentionally small and plain — this is a research
 * instrument, so visual consistency across participants matters more than
 * expressiveness.
 */

import Link from "next/link";
import type { ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function PageShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main
      className={cx(
        "mx-auto w-full px-6 py-10 sm:py-14",
        wide ? "max-w-5xl" : "max-w-2xl",
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
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[var(--muted)]">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-[var(--muted)]">{subtitle}</p>
      ) : null}
    </header>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Callout({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "warning";
  title?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-lg border p-4 text-sm",
        tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]",
      )}
    >
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

export function Divider() {
  return <hr className="my-8 border-[var(--border)]" />;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export function Button({
  children,
  onClick,
  disabled,
  type = "button",
  variant = "primary",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary"
          ? "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-black"
          : "border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]",
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
  disabled,
}: {
  href: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="inline-flex cursor-not-allowed items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)] opacity-40">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)] transition-colors hover:bg-black"
    >
      {children}
    </Link>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mb-6">
      <label className="mb-2 block text-sm font-medium">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </label>
      {hint ? (
        <p className="mb-2 text-xs text-[var(--muted)]">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--focus)]";

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <input
      type={type}
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
  rows = 4,
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
      className={cx(INPUT_CLASS, "resize-y")}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
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
      className={INPUT_CLASS}
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

export function RadioGroup({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <label
          key={o.value}
          className={cx(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
            value === o.value
              ? "border-[var(--accent)] bg-[var(--surface-muted)]"
              : "border-[var(--border)] hover:bg-[var(--surface-muted)]",
          )}
        >
          <input
            type="radio"
            name={name}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="mt-1"
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * 7-point Likert row. Default anchors are the study default
 * (1 = Strongly disagree, 7 = Strongly agree) per Methods §A1.
 */
export function Likert({
  id,
  statement,
  value,
  onChange,
  lowAnchor = "Strongly disagree",
  highAnchor = "Strongly agree",
  points = 7,
}: {
  id: string;
  statement: string;
  value: number | null;
  onChange: (v: number) => void;
  lowAnchor?: string;
  highAnchor?: string;
  points?: number;
}) {
  return (
    <div className="border-b border-[var(--border)] py-4 last:border-b-0">
      <p className="mb-3 text-sm">{statement}</p>
      <div className="flex items-center gap-2">
        <span className="hidden w-28 shrink-0 text-right text-xs text-[var(--muted)] sm:block">
          {lowAnchor}
        </span>
        <div className="flex flex-1 justify-between gap-1">
          {Array.from({ length: points }, (_, i) => i + 1).map((n) => (
            <label
              key={n}
              className={cx(
                "flex flex-1 cursor-pointer flex-col items-center rounded-md border py-2 text-xs transition-colors",
                value === n
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border-[var(--border)] hover:bg-[var(--surface-muted)]",
              )}
            >
              <input
                type="radio"
                name={id}
                checked={value === n}
                onChange={() => onChange(n)}
                className="sr-only"
              />
              {n}
            </label>
          ))}
        </div>
        <span className="hidden w-28 shrink-0 text-xs text-[var(--muted)] sm:block">
          {highAnchor}
        </span>
      </div>
      <div className="mt-1 flex justify-between text-xs text-[var(--muted)] sm:hidden">
        <span>{lowAnchor}</span>
        <span>{highAnchor}</span>
      </div>
    </div>
  );
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  lowAnchor,
  highAnchor,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  lowAnchor?: string;
  highAnchor?: string;
}) {
  return (
    <div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>{lowAnchor ?? min}</span>
        <span className="font-medium text-[var(--foreground)]">{value}</span>
        <span>{highAnchor ?? max}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export function ProgressBar({
  step,
  total,
  label,
}: {
  step: number;
  total: number;
  label?: string;
}) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-baseline justify-between text-xs text-[var(--muted)]">
        <span>{label ?? `Step ${step} of ${total}`}</span>
        <span>{pct}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
