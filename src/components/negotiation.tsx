"use client";

/**
 * The conversation surface: timer, transcript, composer.
 *
 * Issues and the private briefing live in `issues.tsx` and `session.tsx` —
 * this file is only what is said and when.
 *
 * DECEPTION INTEGRITY: nothing here may reveal that the counterpart is an LLM,
 * or which condition the participant is in. Speaker labels are person-facing
 * ("Counterpart", "Counterpart's Proxy") and internal provenance is never
 * accepted as a prop.
 */

import { useEffect, useRef, useState } from "react";
import { NEGOTIATION } from "@/lib/study-config";
import type { StageId, Speaker } from "@/lib/types";
import { Button } from "./ui";

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

export function CountdownTimer({
  seconds,
  onExpire,
  onTick,
  running = true,
}: {
  seconds: number;
  onExpire?: () => void;
  /**
   * Reports the remaining seconds each tick.
   *
   * The counterpart reads the clock — a low one is what makes it offer to
   * settle rather than keep trading — so the number cannot live only in here.
   */
  onTick?: (remaining: number) => void;
  running?: boolean;
}) {
  const [remaining, setRemaining] = useState(seconds);

  // Keep the latest callbacks without restarting the interval when the parent
  // re-renders with new function identities.
  const onExpireRef = useRef(onExpire);
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onExpireRef.current = onExpire;
    onTickRef.current = onTick;
  });

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        const next = Math.max(0, r - 1);
        // Reporting from inside the updater would run during render in React's
        // strict double-invoke, so it is queued instead.
        window.setTimeout(() => onTickRef.current?.(next), 0);
        if (next === 0) {
          window.clearInterval(id);
          window.setTimeout(() => onExpireRef.current?.(), 0);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const low = remaining <= 60;

  return (
    <span
      className={`font-mono text-sm tabular-nums ${low ? "text-red-600" : "text-[var(--ink-2)]"}`}
      aria-live="off"
    >
      {mm}:{ss}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

/**
 * How each speaker is named on screen.
 *
 * DECEPTION INTEGRITY: the counterpart is presented as the other person taking
 * part, and their proxy belongs to that person. Nothing here may read as a
 * system component.
 *
 * "Other Participant" rather than a first name. A pseudonym invites the
 * question of where it came from; a role label is the same claim the consent
 * form and the instructions already make, so the three agree. It also keeps
 * the label identical for every participant, which a name could not do without
 * someone eventually noticing that everyone met the same person.
 *
 * The label is a role, but the VOICE is a person — see the P1 prompt. If the
 * counterpart ever starts writing like a system, this label stops being
 * credible and starts being a tell.
 */
const SPEAKER_LABEL: Record<Speaker, string> = {
  participant: "You",
  counterpart: "Other Participant",
  participant_proxy: "Your AI Proxy",
  counterpart_proxy: "Their AI Proxy",
  counterpart_principal: "Other Participant",
  system: "System",
};

/**
 * What a transcript is allowed to render.
 *
 * Deliberately narrower than `TranscriptMessage`: there is no field here for
 * internal provenance, so a component physically cannot show which elements
 * the Explorer generated. The route strips it too, but that is a rule someone
 * could forget; this is a type error. Do not widen it to the stored shape.
 */
export interface DisplayMessage {
  id: string;
  speaker: Speaker;
  text: string;
}

export function Transcript({
  messages,
  pending,
  emptyHint,
  flow,
  endRef: externalEndRef,
}: {
  messages: DisplayMessage[];
  pending?: boolean;
  emptyHint?: string;
  /**
   * Lay the whole thing out in the page instead of scrolling inside a box.
   * Used where the transcript is the thing being read rather than a live
   * conversation being added to — a box that scrolls internally invites
   * skipping, and a completed AI-AI negotiation has to be read.
   */
  flow?: boolean;
  /** Marker at the end of the messages, for "have they reached the bottom". */
  endRef?: React.Ref<HTMLDivElement>;
}) {
  const ownEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Following a live conversation. In flow mode the participant controls the
    // scroll, so moving it under them would be wrong.
    if (flow) return;
    ownEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending, flow]);

  return (
    <div
      className={
        flow
          ? "flex flex-col gap-3 p-4"
          : "flex h-full min-h-80 flex-col gap-3 overflow-y-auto p-4"
      }
    >
      {messages.length === 0 && !pending ? (
        <p className="m-auto max-w-xs text-center text-sm text-[var(--ink-2)]">
          {emptyHint ?? "No messages yet."}
        </p>
      ) : null}

      {messages.map((m) => {
        const own =
          m.speaker === "participant" || m.speaker === "participant_proxy";
        if (m.speaker === "system") {
          return (
            <p
              key={m.id}
              className="mx-auto max-w-md text-center text-xs text-[var(--ink-2)]"
            >
              {m.text}
            </p>
          );
        }
        return (
          <div
            key={m.id}
            className={`flex flex-col ${own ? "items-end" : "items-start"}`}
          >
            <span className="mb-1 text-xs text-[var(--ink-2)]">
              {SPEAKER_LABEL[m.speaker]}
            </span>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                own
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border border-[var(--line)] bg-[var(--surface-muted)]"
              }`}
            >
              {m.text}
            </div>
          </div>
        );
      })}

      {pending ? (
        <div className="flex items-start">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-2.5">
            <span className="inline-flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ink-2)]"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          </div>
        </div>
      ) : null}

      <div ref={ownEndRef} />
      <div ref={externalEndRef} />
    </div>
  );
}

/**
 * Message length cap (Design §7 노출량 통제), read from one place.
 *
 * Both sides are held to it, because message length is one of the things
 * matched across conditions — an Explorer that writes twice as much as a
 * Delegate to fit an extra reason would confound the contrast with sheer
 * airtime, which is what pilot gate 10 checks.
 */
export const MAX_MESSAGE_CHARS = NEGOTIATION.maxMessageChars;

export function MessageComposer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = "Write your message…",
  sendLabel = "Send",
  cue,
}: {
  /** Controlled, so mockup mode can put a written message in place. */
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  sendLabel?: string;
  /**
   * It is the participant's turn and they can act on it. Gives the box a
   * visible edge, because "is it my move?" is a real question in a
   * conversation that answers itself several seconds later.
   */
  cue?: boolean;
}) {
  const trimmed = value.trim();
  const over = value.length > MAX_MESSAGE_CHARS;
  const left = MAX_MESSAGE_CHARS - value.length;

  function submit() {
    if (!trimmed || disabled || over) return;
    onSend(trimmed);
  }

  return (
    <div className="border-t border-[var(--line)] p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          rows={3}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className={`flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--focus)] disabled:bg-[var(--surface-muted)] ${
            cue && !value
              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
              : "border-[var(--line)]"
          }`}
        />
        <Button onClick={submit} disabled={disabled || !trimmed || over}>
          {sendLabel}
        </Button>
      </div>
      <p
        className={`mt-1.5 text-right text-xs tabular-nums ${
          over ? "text-red-600" : "text-[var(--ink-3)]"
        }`}
      >
        {left} characters left
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage rail
// ---------------------------------------------------------------------------

/**
 * Where you are in the five stages, and what this one is for.
 *
 * A five-step exchange with a fixed structure is only legible if the structure
 * is on screen. Without this, a participant three messages in has no way to
 * know whether two more turns are coming or twenty, and the pacing of what
 * they concede depends on that guess — which would put a nuisance variable
 * straight into the primary outcome.
 *
 * Identical in both conditions and for both roles.
 */
export function StageRail({
  stage,
  goals,
  note,
}: {
  stage: StageId;
  goals: Record<StageId, string>;
  /** One line on what to do right now. */
  note?: string;
}) {
  const stages: StageId[] = [1, 2, 3, 4, 5];
  return (
    <div className="border-b border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
      <ol className="mb-2 flex items-center gap-1.5">
        {stages.map((s) => (
          <li key={s} className="flex flex-1 items-center gap-1.5">
            <span
              className={
                s < stage
                  ? "h-1.5 flex-1 rounded-full bg-[var(--accent)]/40"
                  : s === stage
                    ? "h-1.5 flex-1 rounded-full bg-[var(--accent)]"
                    : "h-1.5 flex-1 rounded-full bg-[var(--line-strong)]"
              }
            />
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[0.8125rem] font-semibold">
          Step {stage} of 5 · {goals[stage]}
        </p>
        {note ? (
          <p className="text-[0.8125rem] text-[var(--ink-2)]">{note}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * "The other participant is watching this too" (Design §4 관전 중).
 *
 * Shown throughout a Proxy negotiation. It is the thing that makes the
 * exchange feel observed rather than private, which is the condition the
 * social-cost measures are asked about — a participant who believed nobody
 * else saw the exchange would be answering about a different situation.
 */
export function SpectatorBanner() {
  return (
    <p className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--accent-soft)] px-4 py-2 text-[0.8125rem] text-[var(--ink-2)]">
      <span aria-hidden>👀</span>
      The other participant is watching this too. Neither of you can step in.
    </p>
  );
}
