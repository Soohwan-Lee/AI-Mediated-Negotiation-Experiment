"use client";

/**
 * Negotiation-surface components shared by the Direct and Proxy sessions.
 *
 * DECEPTION INTEGRITY: nothing here may reveal that the counterpart is an LLM,
 * or which condition the participant is in. Speaker labels are person-facing
 * ("Counterpart", "Counterpart's Proxy") and internal provenance is never
 * accepted as a prop.
 */

import { useEffect, useRef, useState } from "react";
import type { Issue, NegotiationTask, Role, Speaker } from "@/lib/types";
import { Button, Card } from "./ui";

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
      className={`font-mono text-sm tabular-nums ${low ? "text-red-600" : "text-[var(--muted)]"}`}
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

export interface DisplayMessage {
  id: string;
  speaker: Speaker;
  text: string;
}

export function Transcript({
  messages,
  pending,
  emptyHint,
}: {
  messages: DisplayMessage[];
  pending?: boolean;
  emptyHint?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  return (
    <div className="flex h-full min-h-80 flex-col gap-3 overflow-y-auto p-4">
      {messages.length === 0 && !pending ? (
        <p className="m-auto max-w-xs text-center text-sm text-[var(--muted)]">
          {emptyHint ?? "No messages yet."}
        </p>
      ) : null}

      {messages.map((m) => {
        const own = m.speaker === "participant" || m.speaker === "participant_proxy";
        if (m.speaker === "system") {
          return (
            <p
              key={m.id}
              className="mx-auto max-w-md text-center text-xs text-[var(--muted)]"
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
            <span className="mb-1 text-xs text-[var(--muted)]">
              {SPEAKER_LABEL[m.speaker]}
            </span>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                own
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border border-[var(--border)] bg-[var(--surface-muted)]"
              }`}
            >
              {m.text}
            </div>
          </div>
        );
      })}

      {pending ? (
        <div className="flex items-start">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5">
            <span className="inline-flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted)]"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          </div>
        </div>
      ) : null}

      <div ref={endRef} />
    </div>
  );
}

export function MessageComposer({
  onSend,
  disabled,
  placeholder = "Write your message…",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="flex items-end gap-2 border-t border-[var(--border)] p-3">
      <textarea
        value={text}
        rows={2}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        className="flex-1 resize-none rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--focus)] disabled:bg-[var(--surface-muted)]"
      />
      <Button onClick={submit} disabled={disabled || !text.trim()}>
        Send
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Private scorecard + issue panel
// ---------------------------------------------------------------------------

export function RoleScorecard({
  task,
  role,
}: {
  task: NegotiationTask;
  role: Role;
}) {
  const brief = task.roleBriefs[role];
  return (
    <Card className="text-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Your confidential briefing</h2>
        <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 text-xs text-[var(--muted)]">
          {brief.title}
        </span>
      </div>
      <p className="mb-4 text-[var(--muted)]">{brief.organizationalPosition}</p>

      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Your objectives
      </h3>
      <ul className="mb-4 list-disc pl-5 text-[var(--muted)]">
        {brief.objectives.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>

      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        A requirement that matters to you
      </h3>
      <p className="mb-4">{brief.criticalRequirement}</p>

      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        If no agreement is reached
      </h3>
      <p>{brief.batnaSummary}</p>

      <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
        This briefing is private. The counterpart cannot see it.
      </p>
    </Card>
  );
}

/** Read-only reference list of issues and their available levels. */
export function IssueReference({
  issues,
  role,
  showPoints = false,
}: {
  issues: Issue[];
  role: Role;
  showPoints?: boolean;
}) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Issues under negotiation</h2>
      <div className="space-y-4">
        {issues.map((issue) => (
          <div key={issue.id}>
            <p className="text-sm font-medium">{issue.label}</p>
            <p className="mb-1.5 text-xs text-[var(--muted)]">
              {issue.description}
            </p>
            <ul className="space-y-0.5 text-xs text-[var(--muted)]">
              {issue.options.map((o) => (
                <li key={o.id} className="flex justify-between gap-2">
                  <span>{o.label}</span>
                  {showPoints ? (
                    <span className="font-mono tabular-nums">
                      {o.points[role]}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {showPoints ? (
        <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
          Points show what each level is worth to you. The counterpart has a
          different set of values.
        </p>
      ) : null}
    </Card>
  );
}

/** Structured offer builder used alongside free-text chat. */
export function OfferPanel({
  issues,
  selection,
  onChange,
  onSubmit,
  disabled,
  submitLabel = "Submit offer",
}: {
  issues: Issue[];
  selection: Record<string, string>;
  onChange: (issueId: string, optionId: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  submitLabel?: string;
}) {
  const complete = issues.every((i) => selection[i.id]);
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Your current offer</h2>
      <div className="space-y-3">
        {issues.map((issue) => (
          <div key={issue.id}>
            <label className="mb-1 block text-xs font-medium">
              {issue.label}
            </label>
            <select
              value={selection[issue.id] ?? ""}
              disabled={disabled}
              onChange={(e) => onChange(issue.id, e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--focus)] disabled:bg-[var(--surface-muted)]"
            >
              <option value="">Not specified</option>
              {issue.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {onSubmit ? (
        <Button
          onClick={onSubmit}
          disabled={disabled || !complete}
          className="mt-4 w-full"
        >
          {submitLabel}
        </Button>
      ) : null}
    </Card>
  );
}
