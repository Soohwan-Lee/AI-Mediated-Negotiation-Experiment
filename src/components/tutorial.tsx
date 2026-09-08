"use client";

/**
 * The practice coach: a speech bubble that points at the one control the
 * current tutorial step needs.
 *
 * PRACTICE ONLY. `Coach` is exported from here and imported by
 * `src/app/practice/page.tsx` and NOWHERE ELSE. Do not reach for it from a
 * task screen, and do not "reuse" it to explain the mandate or the composer
 * in Task 1 or Task 2.
 *
 * The reason is the measure. What the study observes is which box a
 * participant chooses to draw from — the work reason or the sensitive one —
 * and how far they go in their own words. A pointer on a real task screen
 * would sit on one control rather than another at the moment that decision is
 * being taken, which is a cue suggesting an answer (interface rule 9) on the
 * primary outcome. The practice round is the only place there is no decision
 * to bias: its scenario is neutral, its data is excluded from the analysis,
 * and everything it teaches is where the controls are.
 *
 * Interface rules this component keeps:
 *
 *  - RULE 1 (colour encodes visibility). The bubble is a SHARED surface —
 *    white with a navy/accent border — never sand. It carries no private
 *    value: no points, no minimum position, no briefing text. It only says
 *    what to do next, which is not information about the participant.
 *  - RULE 9 (a cue points, it does not colour). The bubble may say WHAT to do
 *    and never WHICH option to pick or which reason to use. The single
 *    `.cue-ring` on the screen goes on the CONTROL the bubble points at — the
 *    page owns that ring and moves it with the step. The ONE exception is
 *    `nextCue`, for the micro-steps whose control is the sticky action bar:
 *    that bar is shared chrome and cannot take a ring, so the bubble renders
 *    the press-me button itself and rings that. It is still one ring, and the
 *    page must not also ring a card on those steps. `CoachAnchor` is a plain
 *    positioning wrapper for the same reason: it must not put a ring or a
 *    surface colour around the card it holds.
 *  - RULE 2 (nothing starts answered). The bubble never pre-selects anything
 *    and its optional "Next" affordance only advances the tutorial.
 *
 * Motion: the bubble uses the shared `.bubble-in` entrance, whose single
 * 0.28s run is already reduced to a no-op by the global
 * `prefers-reduced-motion` block in `globals.css`. No new keyframe.
 */

import type { ReactNode } from "react";
import { cx } from "@/components/ui";

/** Which edge the tail hangs off, i.e. where the control being pointed at is. */
export type CoachPoint = "down" | "right" | "up" | "none";

const TAIL_POSITION: Record<Exclude<CoachPoint, "none">, string> = {
  // Tail on the bottom edge: the control is directly BELOW the bubble.
  down: "-bottom-[9px] left-8 border-b border-r",
  // Tail on the right edge: the control is BESIDE the bubble (the briefing
  // rail, which sits in the right column from `lg` up).
  right: "top-8 -right-[9px] border-t border-r",
  // Tail on the top edge: the control is ABOVE the bubble.
  up: "-top-[9px] left-8 border-t border-l",
};

// `none` renders no tail at all. Used where the thing being pointed at is
// INSIDE the bubble (a `nextCue` button), so any tail would point at an
// unrelated control — and next to a list of answers that is a cue suggesting
// one of them, which rule 9 forbids.

export function Coach({
  step,
  total,
  title,
  children,
  point = "down",
  onNext,
  nextLabel = "Got it",
  nextCue = false,
  compact = false,
  waiting = false,
  className,
}: {
  step: number;
  total: number;
  title: string;
  /** One or two short sentences. What to do — never which answer to give. */
  children: ReactNode;
  point?: CoachPoint;
  /**
   * Only pass this where the step has no natural completion action of its
   * own. Steps that end by picking, sending or answering something do not
   * need a button that says the participant is finished.
   */
  onNext?: () => void;
  nextLabel?: string;
  /**
   * Put the screen's single `.cue-ring` on this bubble's own button.
   *
   * Used where the thing to press is not a control the page can ring — the
   * sticky action bar is shared chrome and takes no ring — so the tutorial
   * renders the press-me button here instead. Still ONE ring on the screen:
   * the caller must not also ring a control while this is set.
   */
  nextCue?: boolean;
  /**
   * A shorter bubble, for the micro-steps that sit between two cards rather
   * than at the top of the column. Same surface and same rules — only the
   * padding and the icon shrink.
   */
  compact?: boolean;
  /**
   * The step is waiting on something the participant cannot click (a reply on
   * its way). Swaps the compass for a spinner and drops the emphasis, so the
   * bubble does not read as an instruction to act while nothing is actionable.
   */
  waiting?: boolean;
  className?: string;
}) {
  return (
    <div
      // Not `role="alert"`: the coach is a standing instruction for the step,
      // not an interruption. `aria-live="polite"` reads the new bubble to a
      // screen reader when the step changes without stealing focus from the
      // control it is pointing at.
      aria-live="polite"
      className={cx(
        "bubble-in relative mb-4 flex gap-3 rounded-2xl border border-[var(--accent-border)] bg-[var(--surface)] shadow-[var(--shadow-md)]",
        compact ? "p-3" : "p-3.5 sm:p-4",
        // The right-pointing tail only means anything from `lg` up, where the
        // briefing actually sits in a right-hand column. Below that the panel
        // is behind a tap, so the bubble just reads as a plain instruction.
        point === "right" ? "lg:mr-1" : "",
        className,
      )}
    >
      {point === "none" ? null : (
        <span
          aria-hidden
          className={cx(
            "absolute h-[17px] w-[17px] rotate-45 border-[var(--accent-border)] bg-[var(--surface)]",
            TAIL_POSITION[point],
            point === "right" ? "hidden lg:block" : "",
          )}
        />
      )}

      <span
        aria-hidden
        className={cx(
          "flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] ring-1 ring-[var(--accent-border)]",
          compact ? "h-7 w-7 text-sm" : "h-9 w-9 text-lg",
        )}
      >
        {waiting ? (
          // A ring that spins, not the breathing cue ring: this one says
          // "something is happening", not "press me". `motion-reduce` stops it
          // for anyone who has asked for less movement.
          <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent-border)] border-t-[var(--accent)] motion-reduce:animate-none" />
        ) : (
          "🧭"
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.09em] text-[var(--ink-3)]">
          Step {step} of {total}
        </p>
        <p
          className={cx(
            "mt-0.5 font-extrabold leading-snug text-[var(--accent)]",
            compact ? "text-sm" : "text-base",
          )}
        >
          {title}
        </p>
        <div className="mt-1 max-w-prose text-sm leading-relaxed text-[var(--ink-2)] [&>p+p]:mt-1.5">
          {children}
        </div>

        {onNext ? (
          <button
            type="button"
            onClick={onNext}
            className={cx(
              "mt-2.5 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-bold text-[var(--accent)] transition-colors hover:bg-white",
              // The screen's one ring, when the thing to press is this button.
              nextCue ? "cue-ring" : "",
            )}
          >
            {nextLabel} →
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Wraps the control a `Coach` bubble points at, so bubble and control read as
 * one unit and the tail lands on the right edge.
 *
 * Deliberately renders no border, no background and no ring: the ring belongs
 * on the control itself (rule 9 forbids nesting two), and a surface here would
 * recolour a card whose colour already says who can see what is on it
 * (rule 1).
 */
export function CoachAnchor({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("relative", className)}>{children}</div>;
}
