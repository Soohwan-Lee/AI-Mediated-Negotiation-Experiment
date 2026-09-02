"use client";

/**
 * Task shell: where you are in the task, and your briefing, always.
 *
 * The briefing is the whole problem with this study's interface. Three terms
 * with four levels each, private point values, a fallback score, a role story
 * and six reason cards for the one term that is hard to raise — shown once on
 * an intro screen and then taken away, which is what an ordinary flow does.
 * Nobody holds that. So the briefing is pinned beside the work on a wide
 * screen and one tap away on a narrow one, at every phase, with no way to lose
 * it.
 *
 * DECEPTION INTEGRITY: phase names are generic and identical in wording
 * wherever they can be. Nothing here may hint at which condition a task is.
 */

import { useState, type ReactNode } from "react";
import { IssueValueTable } from "./issues";
import { ActionBar } from "./study-chrome";
import { Card, CardTitle, Page, PrivateTag, cx } from "./ui";
import { cardOfLayer } from "@/lib/tasks";
import type { NegotiationTask, Role } from "@/lib/types";

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/**
 * Where you are in this task.
 *
 * A bar of segments rather than a written trail of phase names. Seven names
 * with separators between them wrapped to three lines inside the task column,
 * which is a lot of chrome to say "third of seven" — and the phase the
 * participant is on is already the heading right above it. The names stay for
 * screen readers, where a trail costs nothing.
 */
export function TaskHeader({
  taskIndex,
  title,
  steps,
  current,
  aside,
}: {
  taskIndex: 1 | 2;
  title: string;
  steps: string[];
  current: number;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-[var(--ink-2)] shadow-2xs">
            <span className="text-[var(--accent)] font-extrabold">Task {taskIndex} of 2</span>
            <span className="text-slate-300">/</span>
            <span>Step {current + 1} of {steps.length}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
            {title}
          </h1>
        </div>
        {aside}
      </div>

      <ol className="flex items-center gap-1.5">
        {steps.map((label, i) => (
          <li
            key={label}
            className={cx(
              "flex-1 rounded-full transition-all duration-300",
              i === current ? "h-2 bg-[var(--accent)] shadow-2xs" : "h-1.5",
              i < current ? "bg-[var(--accent)]/50" : i > current ? "bg-slate-200" : "",
            )}
            aria-current={i === current ? "step" : undefined}
          >
            <span className="sr-only">
              {label}
              {i === current ? " — you are here" : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

export type CoverScene = "direct" | "proxy" | "practice";

function CoverArt({ scene }: { scene: CoverScene }) {
  const figures =
    scene === "proxy"
      ? [
          { emoji: "🧑‍💼", label: "You" },
          { emoji: "🤖", label: "Your AI Proxy" },
          { emoji: "🤝", label: "Exchange", joint: true },
          { emoji: "🤖", label: "Their AI Proxy" },
          { emoji: "👤", label: "Other Participant" },
        ]
      : scene === "direct"
        ? [
            { emoji: "🧑‍💼", label: "You" },
            { emoji: "💬", label: "Direct Chat", joint: true },
            { emoji: "👤", label: "Other Participant" },
          ]
        : [
            { emoji: "🧑‍💼", label: "You" },
            { emoji: "💬", label: "Practice", joint: true },
            { emoji: "🎯", label: "Practice Scenario" },
          ];

  return (
    <div
      aria-hidden
      className="my-8 flex w-full flex-wrap items-center justify-center gap-3 sm:gap-5"
    >
      {figures.map((f, i) => (
        <div
          key={`${f.emoji}-${i}`}
          className={cx(
            "flex flex-col items-center",
            f.joint ? "px-1" : "w-20 sm:w-24",
          )}
        >
          <span
            className={cx(
              "flex items-center justify-center rounded-2xl transition-all",
              f.joint
                ? "h-10 w-10 text-xl sm:text-2xl bg-slate-100 border border-slate-200 text-slate-600 shadow-2xs"
                : "h-14 w-14 sm:h-16 sm:w-16 border-2 border-slate-200 bg-white text-2xl sm:text-3xl shadow-sm hover:scale-105",
            )}
          >
            {f.emoji}
          </span>
          {f.label ? (
            <span className="mt-2 text-center text-xs font-bold leading-tight text-[var(--ink-2)]">
              {f.label}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function TaskCover({
  eyebrow,
  title,
  lead,
  steps,
  minutes,
  note,
  actionLabel,
  onStart,
  secondary,
  counter,
  doesNotCount,
  scene,
}: {
  eyebrow: string;
  title: string;
  lead: ReactNode;
  steps: Array<string | { label: string; hint: string }>;
  minutes: number;
  note?: ReactNode;
  actionLabel: string;
  onStart: () => void;
  secondary?: ReactNode;
  counter?: { index: number; total: number };
  doesNotCount?: boolean;
  scene?: CoverScene;
}) {
  return (
    <>
      <Page>
        <div className="flex min-h-[calc(100vh-var(--header-h)-var(--actionbar-h)-3rem)] flex-col justify-center py-10 text-center">
          <div className="mx-auto flex w-full max-w-prose flex-col items-center">
            {counter ? (
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-1 text-sm font-extrabold text-[var(--accent)] shadow-2xs">
                <span>Task {counter.index}</span>
                <span className="opacity-40">/</span>
                <span>{counter.total}</span>
              </div>
            ) : null}

            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--ink-3)]">
              {eyebrow}
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl">
              {title}
            </h1>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-xs font-bold text-[var(--ink-2)] shadow-2xs">
              <span>⏱️</span>
              <span>About {minutes} minutes</span>
              {doesNotCount ? (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Does not count</span>
                </>
              ) : null}
            </div>

            {scene ? <CoverArt scene={scene} /> : null}

            <div className="mt-6 w-full text-left rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs leading-relaxed text-sm sm:text-base">
              {lead}
            </div>

            <Card tone="muted" className="mt-6 w-full text-left">
              <CardTitle>What happens in this part</CardTitle>
              <ol className="space-y-3">
                {steps.map((step, i) => {
                  const label = typeof step === "string" ? step : step.label;
                  const hint = typeof step === "string" ? null : step.hint;
                  return (
                    <li key={label} className="flex items-start gap-3.5 rounded-xl bg-white p-3 border border-slate-100 shadow-2xs">
                      <span
                        aria-hidden
                        className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-xs font-black text-[var(--accent)] border border-[var(--accent-border)]"
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm sm:text-base font-bold text-[var(--ink)]">
                          {label}
                        </span>
                        {hint ? (
                          <span className="mt-0.5 block text-xs sm:text-sm text-[var(--ink-3)] leading-relaxed">
                            {hint}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            {note ? <div className="mt-4 w-full text-left">{note}</div> : null}
          </div>
        </div>
      </Page>

      <ActionBar label={actionLabel} onClick={onStart} secondary={secondary} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Briefing
// ---------------------------------------------------------------------------

/**
 * The briefing in three lines, for the negotiation rail only.
 *
 * WHY IT EXISTS. The briefing is about 470 words at one uniform visual
 * weight — role, story, objectives, two payoff tables, two cards, fallback —
 * so everything is stated and nothing is foregrounded. Mid-negotiation, with
 * the story folded shut and a clock running, a participant needs the shape of
 * their own position in one glance, not a re-read.
 *
 * WHY NOT ON THE BRIEF SCREEN. There every section is expanded, so a summary
 * of the page you are already reading is the same words twice and makes the
 * wall longer rather than shorter. `defaultOpen` marks that screen and this
 * is hidden on it.
 *
 * IT ADDS NO CONTENT AND QUOTES NOTHING AT LENGTH. The goal line is the
 * participant's own first objective; the other two are one short fixed
 * sentence each, pointing at the cards rather than repeating them — the
 * sensitive card's own text sits a few centimetres below in "Permitted
 * Reasons", and printing it twice was how the first version of this made the
 * panel longer instead of clearer.
 *
 * WHAT IT MAY NOT DO. It names neither issue and shows no points: naming the
 * requirement issue in a heading is what §5 principle 1 forbids, and a
 * summary quoting "3,000" beside one term would hand over the shape of the
 * logroll (pilot gate 6).
 */
function BriefingSummary({
  task,
  role,
}: {
  task: NegotiationTask;
  role: Role;
}) {
  const brief = task.roleBriefs[role];
  const sensitive = cardOfLayer(task, role, "sensitive");
  if (!brief.objectives.length || !sensitive) return null;

  const rows: Array<{ icon: string; label: string; body: string }> = [
    { icon: "🎯", label: "What you want", body: brief.objectives[0] },
    {
      icon: "🔒",
      label: "What only you know",
      body: "Your sensitive background, below — saying it is your choice.",
    },
    {
      icon: "⚖️",
      label: "Your dilemma",
      body: "It would make your case, but the other side judges you afterwards.",
    },
  ];

  return (
    <div className="mb-4 rounded-xl border border-[var(--private-line)] bg-[var(--private-soft)] p-3.5 shadow-2xs">
      <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[var(--private-strong)]">
        At a glance
      </p>
      <dl className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-2.5">
            <span aria-hidden className="mt-px shrink-0 text-sm leading-5">
              {row.icon}
            </span>
            <div className="min-w-0">
              <dt className="text-xs font-bold text-[var(--private-strong)]">
                {row.label}
              </dt>
              <dd className="max-w-prose text-xs leading-relaxed text-[var(--private-ink)]/90">
                {row.body}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The role story, split at the paragraph breaks it already has.
 *
 * All four cells are written to the same three-beat shape (§4's face
 * confession depends on it): the professional image the role is given, then
 * what they want and the thing that contradicts it, then what saying it would
 * cost. Those are three different jobs, and running them together as one
 * 900-character block is what makes the briefing feel like homework.
 *
 * The labels are ADDED AROUND the text; not one word of the story itself is
 * changed, because the story's content is validity-bearing. If a task is ever
 * written with a different number of paragraphs this falls back to rendering
 * it whole rather than mislabelling it.
 */
const STORY_HEADINGS = [
  "How you are seen",
  "What you want — and what you are not saying",
  "Why saying it is hard",
];

function RoleStory({ story }: { story: string }) {
  const paragraphs = story
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length !== STORY_HEADINGS.length) {
    return (
      <p className="whitespace-pre-line text-xs sm:text-sm leading-relaxed">
        {story}
      </p>
    );
  }

  return (
    <ol className="space-y-3.5">
      {paragraphs.map((paragraph, i) => (
        <li key={STORY_HEADINGS[i]} className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--private-line)] bg-white text-[0.6875rem] font-bold text-[var(--private-strong)]"
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="mb-0.5 text-xs font-bold text-[var(--private-strong)]">
              {STORY_HEADINGS[i]}
            </p>
            <p className="max-w-prose text-xs sm:text-sm leading-relaxed">
              {paragraph}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function BriefingPanel({
  task,
  role,
  defaultOpen,
}: {
  task: NegotiationTask;
  role: Role;
  defaultOpen?: boolean;
}) {
  const brief = task.roleBriefs[role];

  return (
    <Card tone="private" className="text-[var(--private-ink)]">
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--private-line)] pb-3">
        <h2 className="text-base font-bold text-[var(--private-strong)]">
          Your Briefing
        </h2>
        <PrivateTag />
      </div>

      <div className="mb-4 rounded-xl border border-[var(--private-line)] bg-[var(--private-soft)] p-3.5 shadow-2xs">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--private-strong)]">
          Your Role
        </p>
        <p className="text-base font-extrabold text-[var(--ink)]">
          {brief.title}
        </p>
        <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[var(--private-ink)]/80">
          {brief.organizationalPosition}
        </p>
      </div>

      {/* WHICH SECTIONS START OPEN IS A DESIGN DECISION, NOT A TIDYING ONE
          (interface rule 5). What is open by default is what a participant
          reaches for MID-SENTENCE: the numbers, the fallback, and the reason
          cards — rule 6's decision (which box am I willing to draw from) has to
          be visible to be made. The situation and objectives fold, because by
          then they have been read on the brief phase, where `defaultOpen`
          expands everything.

          These were inverted for a while: the role story — the longest block,
          and the one already read — was pinned open while all three of the
          mid-negotiation sections sat behind a click. Do not "balance" this by
          opening everything either; as one scroll the panel runs to several
          screens and buries the payoff table under the story, which is the
          problem the folds were introduced to solve. */}
      {defaultOpen ? null : <BriefingSummary task={task} role={role} />}

      <div className="space-y-3">
        <Fold title="📄 Your Situation" defaultOpen={defaultOpen}>
          <RoleStory story={brief.roleStory} />
        </Fold>

        <Fold title="🎯 What You Want (Priorities)" defaultOpen={defaultOpen}>
          <ul className="list-disc space-y-1.5 pl-4 text-xs sm:text-sm leading-relaxed">
            {brief.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </Fold>

        <Fold title="🔢 Point Values per Term" defaultOpen>
          <IssueValueTable
            issues={task.issues}
            role={role}
            reservationPoints={task.reservationPoints}
          />
        </Fold>

        {brief.reasonCards.length ? (
          <Fold title="💬 Permitted Reasons" defaultOpen>
            <p className="mb-2.5 rounded-lg border border-[var(--private-line)] bg-amber-100/60 p-2.5 text-xs leading-relaxed font-medium">
              {brief.requirementNote}
            </p>
            {/* `disclosureRisk` belongs HERE, in the panel both arms render, and
                not only on the Proxy mandate screen. It frames what saying a
                sensitive reason may cost — which is the construct PERC measures
                and the thing the study manipulates. Showing it in one arm only
                puts a condition-confounded stimulus directly on the primary
                contrast (`Pooled Proxy − Baseline`): the Proxy arm would be
                warned about evaluative risk and Baseline would not, so any
                difference in disclosure could be the warning rather than the
                delegation. Design Ver.2.11 §5 makes the same requirement of its
                own guidance text — "전 조건에서 동일하게 적용함". */}
            {/* "You have a work reason and a sensitive background" — NOT "each
                term carries" one. The cards sit on one issue now, so a sentence
                promising a pair per term is contradicted by the screen below
                it, and the contradiction tells the participant which term the
                study is about just as surely as a heading would. Say what they
                hold, not where it sits. */}
            <p className="mb-2.5 max-w-prose text-xs leading-relaxed text-[var(--private-ink)]/80">
              You hold a <strong>work reason</strong> — nothing awkward about
              saying it — and a piece of{" "}
              <strong>sensitive background</strong> that is yours to keep.{" "}
              {brief.disclosureRisk}
            </p>
            <IssueReasonGroups task={task} role={role} />
          </Fold>
        ) : null}

        <Fold title="⚠️ Fallback Outcome" defaultOpen last>
          <p className="text-xs sm:text-sm leading-relaxed font-medium">{brief.batnaSummary}</p>
        </Fold>
      </div>

      <p className="mt-5 border-t border-[var(--private-line)] pt-3 text-center text-xs font-semibold text-[var(--private-strong)]">
        🔒 The other side has their own briefing and cannot see yours.
      </p>
    </Card>
  );
}

function Fold({
  title,
  children,
  defaultOpen,
  last,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  last?: boolean;
}) {
  return (
    <details open={defaultOpen} className={cx("group rounded-xl border border-[var(--private-line)] bg-white/70 overflow-hidden shadow-2xs transition-all", last ? "" : "mb-2.5")}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 text-xs sm:text-sm font-bold tracking-tight text-[var(--ink)] hover:bg-amber-100/40 select-none [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span
          aria-hidden
          className="shrink-0 text-sm font-black text-[var(--private-strong)] transition-transform duration-200 group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="border-t border-[var(--private-line)] p-3.5 bg-[var(--private-surface)] text-[var(--private-ink)]">
        {children}
      </div>
    </details>
  );
}

export function ReasonBox({
  title,
  note,
  cards,
  sensitive,
  children,
}: {
  title: string;
  note?: string;
  cards: Array<{ id: string; text: string }>;
  sensitive?: boolean;
  children?: (card: { id: string; text: string }) => ReactNode;
}) {
  if (!cards.length) return null;
  return (
    <div
      className={cx(
        "mb-2.5 rounded-xl border p-3 last:mb-0 shadow-2xs transition-all",
        sensitive
          ? "border-amber-300 bg-amber-50/90 text-amber-950"
          : "border-slate-200 bg-white text-slate-900",
      )}
    >
      <p
        className={cx(
          "mb-1 flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide",
          sensitive ? "text-amber-900" : "text-slate-700",
        )}
      >
        <span>{sensitive ? "🔒" : "💼"}</span>
        <span>{title}</span>
      </p>
      {note ? (
        <p className="mb-2 text-xs leading-relaxed opacity-80">
          {note}
        </p>
      ) : null}
      <ul className="space-y-2">
        {cards.map((card) => (
          <li key={card.id}>
            {children ? (
              children(card)
            ) : (
              <p className="text-xs sm:text-sm leading-relaxed">
                {card.text}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The reason cards, work and sensitive kept visually apart (interface rule 6).
 *
 * NO ISSUE HEADING. It used to group the cards under the label of the issue
 * they argue about, which was safe while every issue carried a pair: the
 * heading repeated what the briefing already showed. Ver.2.11 gives each role
 * cards on their OWN requirement issue only, so that same heading would now
 * name the one term the study is about, on every screen the cards appear —
 * exactly what Design §5 principle 1 forbids ("Issue type·핵심 요구 표시는
 * 비표시"). The cards say which term they argue for in their own text, which
 * is the participant's own briefing rather than a label the interface adds.
 *
 * What must stay is the SPLIT. Which box a participant is willing to draw from
 * is the whole measure, so the two keep their own headings, borders and
 * colours here, on the mandate screen, and in the Baseline picker alike.
 */
export function IssueReasonGroups({
  task,
  role,
  renderCard,
}: {
  task: NegotiationTask;
  role: Role;
  renderCard?: (card: { id: string; text: string }) => ReactNode;
}) {
  const cards = task.roleBriefs[role].reasonCards;
  if (!cards.length) return null;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
      <ReasonBox
        title="Work reason"
        cards={cards.filter((c) => c.layer === "work")}
      >
        {renderCard}
      </ReasonBox>
      <ReasonBox
        title="Sensitive background"
        cards={cards.filter((c) => c.layer === "sensitive")}
        sensitive
      >
        {renderCard}
      </ReasonBox>
    </div>
  );
}

export function TaskLayout({
  briefing,
  children,
}: {
  briefing: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-8">
      <div className="min-w-0">{children}</div>

      <aside className="hidden lg:block">
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] max-h-[calc(100vh-var(--header-h)-3rem)] overflow-y-auto rounded-2xl shadow-sm">
          {briefing}
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(var(--actionbar-h)+1rem)] right-4 z-20 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-400 px-5 py-3 text-xs sm:text-sm font-extrabold text-slate-900 shadow-xl lg:hidden cursor-pointer hover:scale-105 active:scale-95 transition-all"
      >
        <span>📋</span>
        <span>Your Briefing</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(26rem,100%)] flex-col bg-[var(--private-surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--private-line)] px-4 py-3.5 bg-amber-100/50">
              <span className="text-sm font-extrabold text-[var(--private-strong)]">
                Your Briefing (Private)
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
              >
                Close ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{briefing}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
