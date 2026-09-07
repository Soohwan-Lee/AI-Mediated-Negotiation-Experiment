"use client";

/**
 * The AI Proxy, drawn.
 *
 * Four delegation screens — the mandate, the rehearsal, the confirm sheet and
 * the handover — are the whole of "someone else will speak for me", and until
 * now they were four forms with an emoji at the top. The measures in §9.4 ask
 * the participant to judge what was said ON THEIR BEHALF and who is answerable
 * for it (OTHER-AI4), and a question about a representative is easier to
 * answer about something that had a face.
 *
 * WHAT IS DRAWN, AND WHY IT IS DRAWN THIS WAY:
 *
 *  - NOT A HUMANOID FACE. The counterpart is presented as another Prolific
 *    participant and is the ONE thing the study may not give away ("Things the
 *    participant must never learn" #1). A representative drawn with eyes, a
 *    mouth and a head would sit one small step from the figure used for a
 *    person, and the two are side by side on the handover scene. So the proxy
 *    is an EMBLEM: a shield-shaped badge on a plinth, holding a folder. It
 *    reads as an office of representation rather than as a creature.
 *  - NOT A CUTE MASCOT either. The participant is about to hand it a
 *    confession; a toy would make the handover feel like a game, and how
 *    costly that handover feels is the thing RISK and PERC measure.
 *  - THE SAME PICTURE UNDER BOTH POLICIES (interface rule 10: the art draws
 *    the INTERFACE, never the condition). Nothing in this file takes a policy,
 *    a condition or a role. There is nothing here to branch on.
 *
 * MINE vs THEIRS is carried by ONE warm accent on the participant's own proxy
 * and by nothing else: same silhouette, same construction, same size. If the
 * two figures differed in shape, "their proxy" would read as a different KIND
 * of agent, and §9.4's items about the other side's representative would be
 * answered about a picture rather than about what it said.
 *
 * COLOUR: navy/indigo, the shared-table family (interface rule 1). These
 * figures appear on shared white surfaces and inside the participant's own
 * private sand panels alike, so they may not carry the sand tone themselves —
 * a sand-coloured emblem on a white card would say "this is private" about a
 * thing that is about to speak in public. The warm accent is a single stroke,
 * well under the weight that would read as a private surface.
 */

import type { ReactNode } from "react";
import { cx } from "./ui";

/**
 * `mine` is the participant's own representative; `theirs` is the other
 * participant's. Both are AI Proxies and both are drawn the same; only the
 * accent differs.
 */
export type ProxySide = "mine" | "theirs";

const INK = {
  mine: {
    plinth: "#c7d2fe",
    body: "#e0e7ff",
    bodyLine: "#6366f1",
    core: "#4338ca",
    accent: "#d97706",
    folder: "#ffffff",
  },
  theirs: {
    plinth: "#e2e8f0",
    body: "#f1f5f9",
    bodyLine: "#94a3b8",
    core: "#475569",
    accent: "#94a3b8",
    folder: "#ffffff",
  },
} as const;

/**
 * The figure itself.
 *
 * A shield on a plinth, a folder held at its side, and a single filled dot at
 * the centre of the shield — the "attending" mark. The dot is the only part
 * that ever changes state (`speaking` fills the ring around it), because a
 * figure that animated its whole body would pull attention off the decision
 * the screen is actually for.
 */
export function ProxyFigure({
  side = "mine",
  size = 72,
  speaking = false,
  className,
}: {
  side?: ProxySide;
  size?: number;
  /** Draws the outer ring filled, for "at the table" moments. */
  speaking?: boolean;
  className?: string;
}) {
  const c = INK[side];
  return (
    <svg
      viewBox="0 0 64 72"
      width={size}
      height={(size * 72) / 64}
      role="img"
      aria-label={side === "mine" ? "Your AI Proxy" : "The other participant's AI Proxy"}
      className={cx("shrink-0", className)}
    >
      {/* Plinth: the figure stands at a table rather than floating. */}
      <ellipse cx="32" cy="66" rx="21" ry="4" fill={c.plinth} opacity="0.7" />
      <rect x="27" y="55" width="10" height="9" rx="2.5" fill={c.plinth} />

      {/* The badge body. */}
      <path
        d="M32 5 L54 13 V32 C54 45 44 53.5 32 57 C20 53.5 10 45 10 32 V13 Z"
        fill={c.body}
        stroke={c.bodyLine}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Attending mark: a ring and a core. Filled while speaking. */}
      <circle
        cx="32"
        cy="27"
        r="10"
        fill={speaking ? c.core : "none"}
        stroke={c.core}
        strokeWidth="2"
        opacity={speaking ? 0.18 : 0.55}
      />
      <circle cx="32" cy="27" r="4.5" fill={c.core} />

      {/* The mandate line: a single rule across the badge, the thing it was
          given. Warm on the participant's own; neutral on the other side's. */}
      <path
        d="M18 42 H46"
        stroke={c.accent}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M22 48.5 H42"
        stroke={c.bodyLine}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* The folder it carries: what it was handed, kept shut. */}
      <g>
        <rect
          x="42"
          y="36"
          width="16"
          height="20"
          rx="2.5"
          fill={c.folder}
          stroke={c.bodyLine}
          strokeWidth="1.8"
        />
        <path
          d="M46 42 H54 M46 46.5 H52"
          stroke={c.bodyLine}
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M42 40 H58"
          stroke={c.accent}
          strokeWidth="2"
          strokeLinecap="round"
          opacity={side === "mine" ? 1 : 0.45}
        />
      </g>
    </svg>
  );
}

/**
 * The participant, as a matching emblem.
 *
 * Deliberately NOT a photographic or facial figure either, for the same reason
 * the proxy is not: the handover scene puts "you", "your proxy", "their proxy"
 * and "the other participant" in one row, and the two people must be drawn
 * with the SAME figure or the other side would read as less of a person than
 * the participant. `CoverArt` in components/session.tsx already does that with
 * one emoji for both; this keeps the same rule in the drawn scene.
 */
function PersonFigure({ size = 56, muted = false }: { size?: number; muted?: boolean }) {
  const line = muted ? "#94a3b8" : "#475569";
  const fill = muted ? "#f1f5f9" : "#e2e8f0";
  return (
    <svg
      viewBox="0 0 64 72"
      width={size}
      height={(size * 72) / 64}
      role="img"
      aria-label="A participant"
      className="shrink-0"
    >
      <ellipse cx="32" cy="66" rx="19" ry="4" fill={line} opacity="0.16" />
      <circle cx="32" cy="22" r="11" fill={fill} stroke={line} strokeWidth="2" />
      <path
        d="M12 60 C12 46 21 39 32 39 C43 39 52 46 52 60 Z"
        fill={fill}
        stroke={line}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One labelled figure in a scene.
 */
function SceneFigure({
  children,
  label,
  sublabel,
}: {
  children: ReactNode;
  label: string;
  sublabel?: string;
}) {
  return (
    <div className="flex w-24 flex-col items-center text-center sm:w-28">
      {children}
      <span className="mt-1.5 text-[0.6875rem] font-extrabold leading-tight text-[var(--ink-2)] sm:text-xs">
        {label}
      </span>
      {sublabel ? (
        <span className="text-[0.625rem] leading-tight text-[var(--ink-3)]">
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}

/** The dashed link between two figures in a scene. */
function SceneLink({ label }: { label?: string }) {
  return (
    <div aria-hidden className="flex min-w-8 flex-1 flex-col items-center gap-1 px-1">
      <svg viewBox="0 0 60 8" className="h-2 w-full" preserveAspectRatio="none">
        <path
          d="M1 4 H59"
          stroke="#cbd5e1"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 5"
        />
      </svg>
      {label ? (
        <span className="text-[0.5625rem] font-bold uppercase tracking-wider text-[var(--ink-4)]">
          {label}
        </span>
      ) : null}
    </div>
  );
}

/**
 * "You → your proxy → their proxy → them", drawn once.
 *
 * The SAME picture under both policies. It draws who speaks to whom, which is
 * a property of the interface both arms share; nothing here may vary with a
 * condition.
 *
 * `emphasis` only moves where the eye lands, never who is in the picture:
 * "briefing" is the participant handing over, "table" is the two proxies
 * meeting.
 */
export function ProxyScene({
  emphasis = "briefing",
  className,
}: {
  emphasis?: "briefing" | "table";
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex w-full items-end justify-center gap-1 sm:gap-2",
        className,
      )}
    >
      <SceneFigure label="You">
        <PersonFigure size={44} muted={emphasis === "table"} />
      </SceneFigure>

      <SceneLink label={emphasis === "briefing" ? "your brief" : undefined} />

      <SceneFigure label="Your AI Proxy">
        <ProxyFigure side="mine" size={emphasis === "table" ? 58 : 52} speaking={emphasis === "table"} />
      </SceneFigure>

      <SceneLink label={emphasis === "table" ? "negotiating" : "the table"} />

      <SceneFigure label="Their AI Proxy">
        <ProxyFigure side="theirs" size={emphasis === "table" ? 58 : 52} speaking={emphasis === "table"} />
      </SceneFigure>

      <SceneLink />

      <SceneFigure label="Other Participant">
        <PersonFigure size={44} muted />
      </SceneFigure>
    </div>
  );
}

/**
 * A line spoken by the participant's own representative.
 *
 * SURFACE: white/navy, i.e. the SHARED family (interface rule 1). What the
 * proxy says here is not private information — it is the proxy describing its
 * own job — and putting it on the sand surface would say "the counterpart
 * cannot see this", which is a claim about visibility, not about who is
 * talking. The private sand surfaces on these screens stay where they are: the
 * reason cards, the point figures, the briefing.
 *
 * VOICE (Ver.2.19): the proxy may say "I" about ITSELF. It may never say "I"
 * about the participant's circumstances, and it addresses the participant as
 * "you". Every string passed in here is checked against that rule at the call
 * site; nothing in this component generates text.
 */
export function ProxySpeech({
  children,
  status,
  scene,
  className,
}: {
  children: ReactNode;
  /** A small state pill under the name, e.g. "Waiting for your go-ahead". */
  status?: string;
  /** Draw the full four-figure scene beneath the speech instead of nothing. */
  scene?: "briefing" | "table";
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-2xs",
        className,
      )}
    >
      <div className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
        <div className="relative shrink-0">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 ring-1 ring-indigo-100 sm:h-[4.5rem] sm:w-[4.5rem]">
            <ProxyFigure side="mine" size={46} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-wider text-indigo-700">
            Your AI Proxy
          </p>

          {/* The spoken line. A quote mark rather than a chat bubble tail: this
              is a representative addressing its principal, not a chat. */}
          <div className="mt-1.5 border-l-2 border-indigo-200 pl-3 text-sm leading-relaxed text-indigo-950">
            {children}
          </div>

          {status ? (
            <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/70 px-2.5 py-0.5 text-[0.6875rem] font-bold text-indigo-900">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              {status}
            </p>
          ) : null}
        </div>
      </div>

      {scene ? (
        <div className="border-t border-indigo-100 bg-indigo-50/40 px-3 py-3.5 sm:px-5">
          <ProxyScene emphasis={scene} />
        </div>
      ) : null}
    </div>
  );
}
