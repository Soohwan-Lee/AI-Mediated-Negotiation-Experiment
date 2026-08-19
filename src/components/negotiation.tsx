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
import type { Speaker } from "@/lib/types";
import { Button } from "./ui";

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

export function CountdownTimer({
  seconds,
  onExpire,
  running = true,
}: {
  seconds: number;
  onExpire?: () => void;
  running?: boolean;
}) {
  const [remaining, setRemaining] = useState(seconds);

  // Keep the latest callback without restarting the interval when the parent
  // re-renders with a new function identity.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(id);
          onExpireRef.current?.();
          return 0;
        }
        return r - 1;
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

const SPEAKER_LABEL: Record<Speaker, string> = {
  participant: "You",
  counterpart: "Counterpart",
  participant_proxy: "Your Proxy",
  counterpart_proxy: "Counterpart's Proxy",
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
        const own = m.speaker === "participant" || m.speaker === "participant_proxy";
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
 * Message length cap, from Appendix E1.
 *
 * Both sides are held to it, because message length is one of the things
 * matched across conditions — a Proxy that writes twice as much as a person
 * would confound the comparison with sheer airtime.
 */
export const MAX_MESSAGE_CHARS = 280;

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
