"use client";

/**
 * Floating developer / mockup panel.
 *
 * Present by default on every build, including deployed ones, so the layout
 * can be walked wherever it is running. It names conditions and shows the
 * assignment, so it must be gone before recruiting:
 * `NEXT_PUBLIC_DEV_TOOLS=off` — see the note in `lib/dev-mode`. The ON/OFF and
 * hide controls here are per-browser and protect nothing on their own.
 *
 * Deliberately styled as a dark, cramped tool so it can never be mistaken for
 * part of the instrument.
 */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { resolveAssignment } from "@/lib/assignment";
import {
  DEV_TOOLS_AVAILABLE,
  IS_LIVE_DEPLOYMENT,
  useDevMode,
  type DevSlot,
} from "@/lib/dev-mode";
import { useParticipant } from "@/lib/participant-context";
import { FLOW } from "@/lib/study-config";
import type { ProxyPolicy, Role, SequenceId } from "@/lib/types";

const ROLES: Role[] = ["leader", "member"];
const POLICIES: ProxyPolicy[] = ["delegate", "explorer"];
const SEQUENCES: SequenceId[] = ["seq1", "seq2", "seq3", "seq4"];

/** Session-index-parameterized routes need a concrete index to link to. */
const PAGE_LINKS = FLOW.map((s) => ({ key: s.key, href: s.href, label: s.label }));

export function DevPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const dev = useDevMode();
  const { assignment, participantKey } = useParticipant();
  const [open, setOpen] = useState(false);

  // Ctrl/Cmd + Shift + D toggles the panel, and brings it back after "Hide".
  // Without this, hiding it would be one-way per browser.
  const { update, hidden } = dev;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (hidden) update({ hidden: false });
        setOpen((o) => hidden || !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hidden, update]);

  if (!DEV_TOOLS_AVAILABLE) return null;
  if (dev.hidden && !open) return null;

  function setSlot(patch: Partial<DevSlot>) {
    dev.update({ slot: { ...dev.slot, ...patch }, slotOverride: true });
  }

  /** Preview of what the current dev slot expands into. */
  const preview = resolveAssignment(
    participantKey ?? "DEV",
    dev.slot,
    new Date(0).toISOString(),
  );

  /** Wipes participant data but keeps the dev settings themselves. */
  function resetParticipant() {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("amne:") && k !== "amne:dev") doomed.push(k);
    }
    doomed.forEach((k) => window.localStorage.removeItem(k));
    // A hard reload, not router.push: the participant context holds the key
    // and assignment in memory, and only a fresh document clears them.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Developer panel (Ctrl+Shift+D)"
        className={`fixed bottom-4 right-4 z-50 rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold shadow-lg transition-colors ${
          dev.enabled
            ? "bg-emerald-600 text-white hover:bg-emerald-500"
            : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
        }`}
      >
        DEV {dev.enabled ? "ON" : "OFF"}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-h-[85vh] w-80 flex-col overflow-hidden rounded-xl bg-neutral-900 text-[11px] text-neutral-200 shadow-2xl ring-1 ring-black/40">
      <div className="flex items-center justify-between border-b border-neutral-700 px-3 py-2">
        <span className="font-mono text-[11px] font-semibold tracking-wider text-emerald-400">
          DEV / MOCKUP
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dev.update({ enabled: !dev.enabled })}
            className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
              dev.enabled
                ? "bg-emerald-600 text-white"
                : "bg-neutral-700 text-neutral-300"
            }`}
          >
            {dev.enabled ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-1 text-neutral-400 hover:text-white"
            aria-label="Close developer panel"
          >
            ✕
          </button>
        </div>
      </div>

      {IS_LIVE_DEPLOYMENT ? (
        <p className="border-b border-amber-700/40 bg-amber-950/60 px-3 py-2 text-[10px] leading-relaxed text-amber-200">
          This is the live deployment. Set{" "}
          <code className="font-mono">NEXT_PUBLIC_DEV_TOOLS=off</code> and
          redeploy before recruiting — hiding the panel only affects this
          browser.
        </p>
      ) : null}

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {!dev.enabled ? (
          <p className="py-4 text-center text-neutral-400">
            Dev mode is off. The flow behaves exactly as it will for
            participants.
          </p>
        ) : (
          <>
            <Section title="Behavior">
              <Toggle
                label="Mockup mode"
                hint="Fill every screen on arrival — walk the flow with Continue"
                checked={dev.autoFill}
                onChange={(v) => dev.update({ autoFill: v })}
              />
              <Toggle
                label="Skip required fields"
                hint="Continue stays enabled with items unanswered"
                checked={dev.skipValidation}
                onChange={(v) => dev.update({ skipValidation: v })}
              />
              <Toggle
                label="Mock AI turns"
                hint="Play the written exchange instead of calling the model"
                checked={dev.mockAi}
                onChange={(v) => dev.update({ mockAi: v })}
              />
            </Section>

            {dev.autofill ? (
              <Section title="This page">
                <button
                  type="button"
                  onClick={dev.autofill}
                  className="w-full rounded bg-neutral-700 px-2 py-1.5 text-left hover:bg-neutral-600"
                >
                  Fill this page with dummy answers
                </button>
              </Section>
            ) : null}

            {dev.actions.length > 0 ? (
              <Section title="Jump to phase">
                <div className="flex flex-wrap gap-1">
                  {dev.actions.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={a.run}
                      className={`rounded px-2 py-1 ${
                        a.active
                          ? "bg-emerald-600 text-white"
                          : "bg-neutral-700 hover:bg-neutral-600"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </Section>
            ) : null}

            <Section title="Assignment">
              <div className="mb-2 space-y-1">
                <SlotRow label="Role">
                  {ROLES.map((r) => (
                    <Chip
                      key={r}
                      active={dev.slot.role === r}
                      onClick={() => setSlot({ role: r })}
                    >
                      {r}
                    </Chip>
                  ))}
                </SlotRow>
                <SlotRow label="Proxy">
                  {POLICIES.map((p) => (
                    <Chip
                      key={p}
                      active={dev.slot.proxyPolicy === p}
                      onClick={() => setSlot({ proxyPolicy: p })}
                    >
                      {p}
                    </Chip>
                  ))}
                </SlotRow>
                <SlotRow label="Seq">
                  {SEQUENCES.map((s) => (
                    <Chip
                      key={s}
                      active={dev.slot.sequenceId === s}
                      onClick={() => setSlot({ sequenceId: s })}
                    >
                      {s.replace("seq", "")}
                    </Chip>
                  ))}
                </SlotRow>
              </div>

              <p className="mb-2 font-mono text-[10px] leading-relaxed text-neutral-400">
                S1 {preview.sessions[0].condition} / {preview.sessions[0].taskId}
                <br />
                S2 {preview.sessions[1].condition} / {preview.sessions[1].taskId}
              </p>

              <Toggle
                label="Override claimed slot"
                hint={
                  assignment
                    ? `claimed: ${assignment.role} · ${assignment.proxyPolicy} · ${assignment.sequenceId}`
                    : "no slot claimed yet — the override supplies one"
                }
                checked={dev.slotOverride}
                onChange={(v) => dev.update({ slotOverride: v })}
              />
            </Section>

            <Section title="Go to page">
              <div className="flex flex-col gap-0.5">
                {PAGE_LINKS.map((p) => {
                  const current = pathname === p.href;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => router.push(p.href)}
                      className={`rounded px-2 py-1 text-left ${
                        current
                          ? "bg-emerald-600 text-white"
                          : "hover:bg-neutral-700"
                      }`}
                    >
                      {p.label}
                      <span className="ml-1.5 font-mono text-[10px] text-neutral-400">
                        {p.href}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="Reset">
              <button
                type="button"
                onClick={resetParticipant}
                className="w-full rounded bg-red-900/60 px-2 py-1.5 text-left text-red-200 hover:bg-red-900"
              >
                Clear participant data and restart
              </button>
              <p className="mt-1 font-mono text-[10px] text-neutral-500">
                key: {participantKey ?? "—"}
              </p>
            </Section>

            <Section title="Get it out of the way">
              <button
                type="button"
                onClick={() => {
                  dev.update({ hidden: true });
                  setOpen(false);
                }}
                className="w-full rounded bg-neutral-700 px-2 py-1.5 text-left hover:bg-neutral-600"
              >
                Hide the panel
              </button>
              <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
                Press Ctrl/Cmd+Shift+D to bring it back. This browser only — it
                does not hide the panel from anyone else.
              </p>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel primitives — local to this file, deliberately not in components/ui.
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-neutral-800 py-2 last:border-b-0">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        {title}
      </p>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mb-1 flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-emerald-500"
      />
      <span>
        {label}
        {hint ? (
          <span className="block text-[10px] text-neutral-500">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

function SlotRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 font-mono text-[10px] text-neutral-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-0.5 font-mono text-[10px] ${
        active ? "bg-emerald-600 text-white" : "bg-neutral-700 hover:bg-neutral-600"
      }`}
    >
      {children}
    </button>
  );
}
