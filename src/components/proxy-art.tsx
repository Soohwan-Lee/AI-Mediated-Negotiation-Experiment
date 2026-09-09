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
 *  - A ROBOT, AND NOT A PERSON. The counterpart is presented as another
 *    Prolific participant and is the ONE thing the study may not give away
 *    ("Things the participant must never learn" #1), so the proxy has to be
 *    unmistakably machinery beside the person figure it stands next to on the
 *    handover scene. A rounded head with a square screen face, two dot eyes,
 *    an antenna and a boxy body reads as a machine at a glance and never as a
 *    human silhouette. The earlier emblem — a shield on a plinth — read as a
 *    badge of office and participants had to be told what it was.
 *  - FRIENDLY, NOT A MASCOT. Rounded corners and a level gaze, no smile, no
 *    limbs waving. The participant is about to hand it a confession, and a toy
 *    would make the handover feel like a game.
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

import { useId, type ReactNode } from "react";
import { STUDY } from "@/lib/study-config";
import type { Role } from "@/lib/types";
import { cx } from "./ui";

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-1 text-center sm:px-2">
      <span className="sr-only">{label}</span>
      <svg
        aria-hidden
        viewBox="0 0 56 18"
        className="h-4 w-10 text-slate-400 sm:w-14"
      >
        <path
          d="M2 9h47m-7-6 7 6-7 6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      <span className="hidden text-[0.625rem] font-bold leading-tight text-slate-500 sm:block">
        {label}
      </span>
    </div>
  );
}

/**
 * A role-and-payment map shown before practice.
 *
 * This is deliberately made from labelled shapes rather than character art:
 * the relationship is the information. Both roles see the same two decision
 * paths, while the participant's own role is the only emphasized node. Money
 * and the upward evaluation stay on separate rows so neither can be mistaken
 * for the other.
 */
export function RoleDecisionFlow({ role }: { role: Role }) {
  const titleId = useId();
  const isLeader = role === "leader";
  const own =
    "border-blue-300 bg-blue-50 text-blue-950 ring-2 ring-blue-100";
  const other = "border-slate-200 bg-white text-slate-800";
  const node =
    "min-w-0 flex-1 rounded-xl border px-3 py-3 text-center shadow-2xs sm:px-4";

  return (
    <figure
      aria-labelledby={titleId}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 shadow-2xs"
    >
      <figcaption
        id={titleId}
        className="border-b border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 sm:px-5"
      >
        Two separate decisions after each negotiation
      </figcaption>

      <div className="space-y-3 p-3 sm:p-5">
        <div className="flex items-stretch" aria-label="Bonus recommendation path">
          <div className={cx(node, isLeader ? own : other)}>
            <span className="block text-[0.625rem] font-extrabold uppercase tracking-wider text-slate-500">
              Team lead {isLeader ? <span className="ml-1 rounded-full bg-blue-700 px-1.5 py-0.5 text-white">You</span> : null}
            </span>
            <strong className="mt-1 block text-sm">Recommends the member&apos;s bonus</strong>
          </div>
          <FlowArrow label="after each task" />
          <div className={cx(node, !isLeader ? own : other)}>
            <span className="block text-[0.625rem] font-extrabold uppercase tracking-wider text-slate-500">
              Team member {!isLeader ? <span className="ml-1 rounded-full bg-blue-700 px-1.5 py-0.5 text-white">You</span> : null}
            </span>
            <strong className="mt-1 block text-sm">
              Up to {STUDY.currencySymbol}{STUDY.bonusPerTask} per task
            </strong>
          </div>
        </div>

        <div className="flex items-stretch" aria-label="Upward evaluation path">
          <div className={cx(node, !isLeader ? own : other)}>
            <span className="block text-[0.625rem] font-extrabold uppercase tracking-wider text-slate-500">
              Team member {!isLeader ? <span className="ml-1 rounded-full bg-blue-700 px-1.5 py-0.5 text-white">You</span> : null}
            </span>
            <strong className="mt-1 block text-sm">Evaluates the team lead</strong>
          </div>
          <FlowArrow label="sent to" />
          <div className={cx(node, other)}>
            <span className="block text-[0.625rem] font-extrabold uppercase tracking-wider text-slate-500">
              Project director
            </span>
            <strong className="mt-1 block text-sm">Receives that evaluation</strong>
          </div>
        </div>

        <p className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs leading-relaxed text-slate-600">
          The team lead and team member still decide the working conditions
          <strong className="text-slate-900"> together</strong>.
        </p>
      </div>
    </figure>
  );
}

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
    screen: "#eef2ff",
  },
  theirs: {
    plinth: "#e2e8f0",
    body: "#f1f5f9",
    bodyLine: "#94a3b8",
    core: "#475569",
    accent: "#94a3b8",
    screen: "#f8fafc",
  },
} as const;

/**
 * The figure itself: a friendly robot.
 *
 * A rounded head with a screen face, two dot eyes and a short antenna, on a
 * boxy body. The ANTENNA LIGHT is the only part that changes state — filled
 * and haloed while `speaking`, hollow otherwise — because a figure that
 * animated its whole body would pull attention off the decision the screen is
 * actually for. That is the "attending" mark the shield emblem used to carry
 * at the centre of the badge.
 *
 * MINE vs THEIRS is one warm accent stroke and nothing else: same silhouette,
 * same construction, same size.
 */
export function ProxyFigure({
  side = "mine",
  size = 72,
  speaking = false,
  className,
}: {
  side?: ProxySide;
  size?: number;
  /** Fills the antenna light, for "at the table" moments. */
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
      {/* The ground it stands on. */}
      <ellipse cx="32" cy="67" rx="20" ry="3.5" fill={c.plinth} opacity="0.7" />

      {/* Antenna, and the light on top of it. */}
      <path d="M32 11 V5" stroke={c.bodyLine} strokeWidth="2" strokeLinecap="round" />
      {speaking ? (
        <circle cx="32" cy="4" r="6" fill={c.accent} opacity="0.22" />
      ) : null}
      <circle
        cx="32"
        cy="4"
        r="3"
        fill={speaking ? c.accent : "none"}
        stroke={c.accent}
        strokeWidth="2"
      />

      {/* Head. */}
      <rect
        x="12"
        y="11"
        width="40"
        height="30"
        rx="11"
        fill={c.body}
        stroke={c.bodyLine}
        strokeWidth="2"
      />

      {/* Screen face, with two eyes on it. */}
      <rect
        x="18.5"
        y="18"
        width="27"
        height="16"
        rx="6"
        fill={c.screen}
        stroke={c.bodyLine}
        strokeWidth="1.6"
      />
      <circle cx="26.5" cy="26" r="2.8" fill={c.core} />
      <circle cx="37.5" cy="26" r="2.8" fill={c.core} />

      {/* Ears. */}
      <rect x="7.5" y="21" width="4" height="10" rx="2" fill={c.bodyLine} opacity="0.55" />
      <rect x="52.5" y="21" width="4" height="10" rx="2" fill={c.bodyLine} opacity="0.55" />

      {/* Neck. */}
      <rect x="28.5" y="41" width="7" height="4" fill={c.bodyLine} opacity="0.45" />

      {/* Body. */}
      <rect
        x="16"
        y="44"
        width="32"
        height="21"
        rx="7"
        fill={c.body}
        stroke={c.bodyLine}
        strokeWidth="2"
      />

      {/* The mandate line across its front: the thing it was given. Warm on
          the participant's own proxy; neutral on the other side's. */}
      <path d="M23 52 H41" stroke={c.accent} strokeWidth="3" strokeLinecap="round" />
      <path
        d="M25 58 H39"
        stroke={c.bodyLine}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
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

/**
 * The link between two figures in a scene, and it is DIRECTIONAL.
 *
 * Who talks to whom is the whole content of this picture, so the arrowheads
 * carry it: a participant briefs their own proxy and does not talk to the
 * other side, while the two proxies talk to each other. An undirected dashed
 * rule said only "these two are related", which left the participant to guess
 * the part the scene exists to show.
 */
function SceneLink({
  label,
  direction = "right",
}: {
  label?: string;
  /** "both" draws a head at each end — the two proxies negotiating. */
  direction?: "right" | "left" | "both";
}) {
  return (
    <div aria-hidden className="flex min-w-8 flex-1 flex-col items-center gap-1 px-1">
      <svg viewBox="0 0 60 12" className="h-3 w-full text-slate-400">
        <path
          d="M4 6 H56"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {direction !== "left" ? (
          <path
            d="M51 2 L56 6 L51 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {direction !== "right" ? (
          <path
            d="M9 2 L4 6 L9 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {label ? (
        <span className="text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-3)]">
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

      {/* One way: you brief your proxy, and you do not talk to the other
          side while the proxies are at the table. */}
      <SceneLink label="briefs" />

      <SceneFigure label="Your AI Proxy">
        <ProxyFigure side="mine" size={emphasis === "table" ? 58 : 52} speaking={emphasis === "table"} />
      </SceneFigure>

      {/* Two ways: this is the only pair that talks to each other. */}
      <SceneLink label="negotiate" direction="both" />

      <SceneFigure label="Their AI Proxy">
        <ProxyFigure side="theirs" size={emphasis === "table" ? 58 : 52} speaking={emphasis === "table"} />
      </SceneFigure>

      {/* Points LEFT: the other participant briefs their own proxy, the same
          one-way handover the participant made at the far end of the row. */}
      <SceneLink label="briefs" direction="left" />

      <SceneFigure label="Other Participant">
        <PersonFigure size={44} muted />
      </SceneFigure>
    </div>
  );
}

/**
 * The four steps of a Proxy task, drawn once, before the exchange.
 *
 * Participants arrive at the mandate screen without a picture of what the
 * next twenty minutes look like, and the written version of it ran to a
 * paragraph nobody finished. One short line per step, each with its own small
 * scene, is the same information in a fifth of the reading.
 *
 * NO CONDITION NAME, and no policy branch (interface rule 10): every Proxy
 * participant sees this identical row. Step ④ is conditional in the flow and
 * says so in its own words, because a step drawn as unconditional would tell
 * an approver they were about to do something they will not do.
 */
export function ProxyFlowSteps({ className }: { className?: string }) {
  const steps: Array<{ art: ReactNode; label: string }> = [
    {
      art: (
        <>
          <PersonFigure size={30} />
          <SceneLink />
          <ProxyFigure side="mine" size={34} />
        </>
      ),
      label: "You brief your AI Proxy.",
    },
    {
      art: (
        <>
          <ProxyFigure side="mine" size={34} speaking />
          <SceneLink direction="both" />
          <ProxyFigure side="theirs" size={34} speaking />
        </>
      ),
      label: "The two AI Proxies negotiate. You watch.",
    },
    {
      art: (
        <>
          <PersonFigure size={30} />
          <SceneLink direction="left" />
          <span aria-hidden className="text-xl">📋</span>
          <SceneLink />
          <PersonFigure size={30} muted />
        </>
      ),
      label:
        "You both see the result. Approve it, ask for a change, or refuse.",
    },
    {
      art: (
        <>
          <PersonFigure size={30} />
          <SceneLink direction="both" />
          <PersonFigure size={30} muted />
        </>
      ),
      label:
        "If either of you wants a change, you finish it in a short chat.",
    },
  ];

  return (
    <ol
      className={cx(
        "grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {steps.map((step, index) => (
        <li
          key={step.label}
          className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-2xs"
        >
          <div aria-hidden className="flex h-11 items-center justify-center gap-0.5">
            {step.art}
          </div>
          <p className="mt-2.5 flex items-start gap-2 text-[0.8125rem] leading-snug text-[var(--ink-2)]">
            <span
              aria-hidden
              className="tabular mt-px flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[0.625rem] font-black text-indigo-800"
            >
              {index + 1}
            </span>
            <span className="min-w-0">{step.label}</span>
          </p>
        </li>
      ))}
    </ol>
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
