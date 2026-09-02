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
import type { Speaker } from "@/lib/types";
import { Button, cx } from "./ui";

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
  onTick?: (remaining: number) => void;
  running?: boolean;
}) {
  const [remaining, setRemaining] = useState(seconds);

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
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs sm:text-sm font-mono font-bold tracking-tight shadow-2xs transition-all",
        low
          ? "border-red-300 bg-red-50 text-red-600 animate-pulse"
          : "border-slate-200 bg-white text-[var(--ink-2)]",
      )}
      aria-live="off"
    >
      <span aria-hidden>{low ? "⚠️" : "⏱️"}</span>
      <span>{mm}:{ss}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

const SPEAKER_CONFIG: Record<Speaker, { label: string; avatar: string; badgeClass: string }> = {
  participant: {
    label: "You",
    avatar: "🧑‍💼",
    badgeClass: "text-blue-900 bg-blue-50 border-blue-200",
  },
  counterpart: {
    label: "Other Participant",
    avatar: "👤",
    badgeClass: "text-slate-800 bg-slate-100 border-slate-200",
  },
  participant_proxy: {
    label: "Your AI Proxy",
    avatar: "🤖",
    badgeClass: "text-indigo-900 bg-indigo-50 border-indigo-200",
  },
  counterpart_proxy: {
    label: "Their AI Proxy",
    avatar: "🤖",
    badgeClass: "text-purple-900 bg-purple-50 border-purple-200",
  },
  counterpart_principal: {
    label: "Other Participant",
    avatar: "👤",
    badgeClass: "text-slate-800 bg-slate-100 border-slate-200",
  },
  system: {
    label: "System",
    avatar: "📢",
    badgeClass: "text-slate-700 bg-slate-100 border-slate-200",
  },
};

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
  flow?: boolean;
  endRef?: React.Ref<HTMLDivElement>;
}) {
  const ownEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (flow) return;
    ownEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending, flow]);

  return (
    <div
      className={
        flow
          ? "flex flex-col gap-3.5 p-4 sm:p-5"
          : "flex h-full min-h-80 flex-col gap-3.5 overflow-y-auto p-4 sm:p-5 bg-slate-50/40"
      }
    >
      {messages.length === 0 && !pending ? (
        <div className="m-auto max-w-xs text-center py-8">
          <span className="text-3xl mb-2 block opacity-70">💬</span>
          <p className="text-sm font-medium text-[var(--ink-3)]">
            {emptyHint ?? "No messages yet. Send a message to begin!"}
          </p>
        </div>
      ) : null}

      {messages.map((m) => {
        const own =
          m.speaker === "participant" || m.speaker === "participant_proxy";
        const ownProxy = m.speaker === "participant_proxy";
        const isCounterpartProxy = m.speaker === "counterpart_proxy";
        const config = SPEAKER_CONFIG[m.speaker] ?? SPEAKER_CONFIG.system;

        if (m.speaker === "system") {
          return (
            <div key={m.id} className="mx-auto my-2 max-w-md text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[var(--ink-3)] shadow-2xs">
                <span>📢</span> {m.text}
              </span>
            </div>
          );
        }

        // "||" marks bubble breaks (Design §12 P1): one turn arrives as one
        // to three short bubbles, the way a person actually types in a work
        // chat. Rendering the marker literally was a tell in itself — no
        // human sends "||" — so the turn is split here, one bubble per
        // segment under a single speaker header, with a short stagger so
        // later bubbles land the way follow-up messages do.
        const bubbles = m.text
          .split("||")
          .map((b) => b.trim())
          .filter(Boolean);

        return (
          <div
            key={m.id}
            className={cx("flex flex-col gap-1", own ? "items-end" : "items-start")}
          >
            <div className="flex items-center gap-1.5 px-1">
              <span className="text-xs">{config.avatar}</span>
              <span className="text-xs font-bold text-[var(--ink-3)]">
                {config.label}
              </span>
            </div>
            {bubbles.map((bubble, i) => (
              <div
                key={`${m.id}-${i}`}
                style={
                  flow ? undefined : { animationDelay: `${i * 0.45}s` }
                }
                className={cx(
                  "max-w-[85%] sm:max-w-[78%] px-4 py-3 text-sm sm:text-[0.9375rem] leading-relaxed shadow-2xs",
                  flow ? undefined : "bubble-in",
                  ownProxy
                    ? "rounded-2xl border-2 border-blue-500 bg-blue-50/80 text-slate-900 font-medium"
                    : own
                      ? "rounded-2xl bg-[var(--accent)] text-white font-normal shadow-sm"
                      : isCounterpartProxy
                        ? "rounded-2xl border-2 border-purple-400 bg-purple-50/70 text-slate-900 font-medium"
                        : "rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xs",
                  i === 0 && (own ? "rounded-tr-xs" : "rounded-tl-xs"),
                )}
              >
                {bubble}
              </div>
            ))}
          </div>
        );
      })}

      {pending ? (
        <div className="flex items-start gap-2 pt-1">
          <span className="text-xs mt-1">🤖</span>
          <div className="rounded-2xl rounded-tl-xs border border-slate-200 bg-white px-4 py-3 shadow-2xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-xs font-medium text-[var(--ink-3)] mr-1">Replying</span>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)]"
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
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  sendLabel?: string;
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
    <div className="border-t border-slate-200 bg-white p-3.5 sm:p-4 rounded-b-2xl">
      <div className="flex items-end gap-2.5">
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
          className={cx(
            "flex-1 resize-none rounded-xl border px-3.5 py-2.5 text-sm sm:text-base outline-none transition-all placeholder:text-[var(--ink-4)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--focus-ring)] disabled:bg-slate-50 shadow-2xs",
            cue && !value ? "cue-ring" : "border-slate-300",
          )}
        />
        <Button
          onClick={submit}
          disabled={disabled || !trimmed || over}
          className="h-11 px-5 shadow-sm"
        >
          <span>{sendLabel}</span>
          <span aria-hidden className="text-base">🚀</span>
        </Button>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--ink-3)] px-1">
        <span>Press <strong className="font-semibold text-slate-600">Enter</strong> to send</span>
        <span
          className={cx(
            "tabular font-semibold",
            over ? "text-red-600 font-bold" : "text-[var(--ink-3)]",
          )}
        >
          {left} characters left
        </span>
      </div>
    </div>
  );
}

export function SpectatorBanner() {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-blue-200 bg-blue-50/90 px-4 py-2.5 text-xs sm:text-sm font-semibold text-blue-900 shadow-2xs">
      <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
      <span aria-hidden>👀</span>
      <span>LIVE SPECTATING: The other participant is watching this exchange too.</span>
    </div>
  );
}
