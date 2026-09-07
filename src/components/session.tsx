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

import {
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { IssueValueTable } from "./issues";
import { ActionBar } from "./study-chrome";
import { Card, CardTitle, Page, PrivateTag, cx } from "./ui";
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
// ---------------------------------------------------------------------------
// The AI Proxy, as a representative rather than a form
// ---------------------------------------------------------------------------

/**
 * What each policy is allowed to do with the participant's reasons (§7).
 *
 * BOTH principals must be told the policy; neither may ever be told the
 * CONDITION NAME. The two strings are deliberately matched in length and
 * shape — if one arm read as a longer or more careful explanation than the
 * other, the disclosure itself would become a cue about which arm a
 * participant is in, on the very contrast it exists to support.
 *
 * It lives here rather than in the proxy task because the mandate, the
 * rehearsal and the confirm screen all show the same identity block, and the
 * policy sentence is the ONLY thing in that block that differs between the two
 * policies.
 */
export const POLICY_DISCLOSURE: Record<
  "user_specified" | "ai_supplemented",
  string
> = {
  user_specified:
    "Both AI Proxies in this task pass on the reasons their own person ticked as they are, changing only the wording. Nothing is added or left out, on either side.",
  ai_supplemented:
    "Both AI Proxies in this task shorten a sensitive reason to the kind of situation it is, leaving the specifics out, and say it alongside other reasons anyone in that role might give. Neither proxy marks which reason came from their own person.",
};

/**
 * One block, three screens: who this thing is and what it will do.
 *
 * The mandate, the rehearsal and the confirm sheet are the whole of the
 * delegation, and they read as three unrelated forms unless the same
 * representative is standing at the top of each one. The avatar and the label
 * are the ones the transcript uses for `participant_proxy` (see
 * `SPEAKER_CONFIG` in components/negotiation.tsx), so the proxy a participant
 * briefs here is visibly the proxy they later watch speak.
 *
 * DECEPTION INTEGRITY: the two policies render an IDENTICAL block apart from
 * `POLICY_DISCLOSURE`. Nothing else here may branch on the policy, and the
 * condition name appears nowhere.
 */
export function ProxyIdentity({
  policy,
  status,
  footnote,
  className,
}: {
  policy: "user_specified" | "ai_supplemented";
  status?: string;
  /** One muted line under the policy sentence — the mandate screen uses it to
      say what happens after this screen. Never anything policy-specific. */
  footnote?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 sm:p-5 shadow-2xs",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {/* The avatar is deliberately larger than a list glyph. This is the
            representative the participant is about to hand a mandate to, and
            on three otherwise form-shaped screens it is the only thing that
            says so before a word is read. Same glyph as the transcript's
            `participant_proxy`, so it is visibly the same proxy throughout. */}
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[1.75rem] ring-4 ring-white/70 shadow-2xs"
        >
          🤖
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-wider text-indigo-700">
            Your AI Proxy
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-indigo-950 font-medium">
            It will negotiate with the other participant&rsquo;s AI Proxy on
            your behalf, saying only what you hand it here.
          </p>
          {status ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-2.5 py-0.5 text-[0.6875rem] font-bold text-indigo-900">
              {status}
            </p>
          ) : null}
        </div>
      </div>
      <p className="mt-3.5 border-t border-indigo-200/70 pt-3.5 text-xs sm:text-sm leading-relaxed text-indigo-950/90">
        {POLICY_DISCLOSURE[policy]}
      </p>
      {footnote ? (
        <p className="mt-2 text-xs leading-relaxed text-indigo-900/70">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}

/**
 * `**...**` in a story string becomes `<strong>`, and nothing else is markup.
 *
 * The emphasis is on STRUCTURAL signposts only — the term that cannot move,
 * "there is something only you know", "a reason you can say safely", "if that
 * is all you say". It never falls on a clause that reads as advice to disclose
 * or to withhold: the disclosure decision is the study's primary outcome, so a
 * screen that leans on it would be staging what it measures. Odd segments of
 * the split are the emphasised ones; an unpaired `**` therefore renders as
 * plain text rather than swallowing the rest of the paragraph.
 */
function emphasise(text: string) {
  return text.split("**").map((segment, index) =>
    index % 2 === 1
      ? <strong key={index} className="font-semibold text-[var(--private-strong)]">{segment}</strong>
      : <span key={index}>{segment}</span>,
  );
}

/**
 * Headings follow the four paragraphs in the current design's role story.
 *
 * The emoji is a scanning aid, not decoration: the four sections do four
 * different jobs and a reader mid-negotiation is looking for one of them. The
 * last section sits in its own box because it is the one that describes a
 * cost — but the box stays in the private (sand) tone, because the surface is
 * what says who can see the content (interface rule 1) and this is all
 * private.
 *
 * `compact` is what the briefing rail passes: the same treatment at the rail's
 * 13px, with no figure and tighter spacing. The illustration lives on the
 * TaskBrief page and never in the rail.
 */
export function RoleStory({ story, compact = false }: { story: string; compact?: boolean }) {
  const paragraphs = story.split("\n\n").map(p => p.trim()).filter(Boolean);
  const headings = [
    { emoji: "👤", label: "Your role on the team" },
    { emoji: "🎯", label: "What matters to you" },
    { emoji: "💼", label: "Your work situation" },
    { emoji: "⚖️", label: "What sharing could mean" },
  ];
  const labelled = paragraphs.length === headings.length;
  return <div className={compact ? "space-y-3" : "space-y-4"}>
    {paragraphs.map((paragraph, index) => {
      const heading = labelled ? headings[index] : null;
      const boxed = labelled && index === headings.length - 1;
      return <section
        key={index}
        className={boxed
          ? cx(
            "rounded-xl border border-[var(--private-line)] bg-white/60",
            compact ? "px-2.5 py-2" : "px-4 py-3.5",
          )
          : undefined}
      >
        {heading ? <h3 className={cx(
          "flex items-baseline gap-1.5 font-bold tracking-tight text-[var(--private-strong)]",
          compact ? "mb-1 text-[0.8125rem]" : "mb-1.5 text-[0.9375rem]",
        )}>
          <span aria-hidden="true" className={compact ? "text-[0.75rem]" : "text-sm"}>{heading.emoji}</span>
          {heading.label}
        </h3> : null}
        <p className={cx(
          "text-[var(--private-ink)]",
          compact ? "text-[0.8125rem] leading-6" : "text-sm leading-7",
        )}>{emphasise(paragraph)}</p>
      </section>;
    })}
  </div>;
}

export function BriefingPanel({
  task,
  role,
}: {
  task: NegotiationTask;
  role: Role;
}) {
  const brief = task.roleBriefs[role];
  const [activeTab, setActiveTab] = useState<"situation" | "points" | "reasons">("points");
  const tabId = useId();
  const hasReasons = brief.reasonCards.length > 0;
  const tabs: Array<{ id: "situation" | "points" | "reasons"; label: string }> = [
    { id: "situation" as const, label: "Situation" },
    { id: "points" as const, label: "Points" },
    ...(hasReasons ? [{ id: "reasons" as const, label: "Reasons" }] : []),
  ];
  const currentTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : "points";
  const maximumPoints = task.issues.reduce(
    (sum, issue) => sum + Math.max(...issue.options.map((option) => option.points[role])),
    0,
  );

  function selectTab(index: number) {
    const next = tabs[index];
    setActiveTab(next.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`${tabId}-tab-${next.id}`)?.focus();
    });
  }

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    selectTab(next);
  }

  const memberContext =
    role === "member" && !/senior|experienced/i.test(brief.organizationalPosition)
      ? "You are an experienced member of the project team. "
      : "";

  return (
    <Card padded={false} tone="private" className="p-4 text-[var(--private-ink)]">
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-[var(--private-line)] pb-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--private-strong)]">
            Your private briefing
          </p>
          <h2 className="mt-0.5 text-sm font-semibold leading-snug text-[var(--ink)]">
            {task.title}
          </h2>
        </div>
        <PrivateTag />
      </div>

      <section aria-labelledby={`${tabId}-role`} className="mb-3 rounded-xl border border-amber-200 bg-white/75 p-3">
        <p id={`${tabId}-role`} className="text-xs font-bold uppercase tracking-wider text-[var(--private-strong)]">
          Your role
        </p>
        <h3 className="mt-0.5 text-base font-bold leading-snug text-[var(--ink)]">
          {role === "leader" ? "Team lead" : "Team member"}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-[var(--private-ink)]/90">
          {memberContext}{brief.organizationalPosition}
        </p>
      </section>

      <section aria-labelledby={`${tabId}-goals`} className="mb-3 rounded-xl bg-amber-100/55 p-3">
        <h3 id={`${tabId}-goals`} className="text-sm font-bold text-[var(--ink)]">
          Your goals
        </h3>
        <ul className="mt-2 space-y-2 text-sm leading-relaxed">
          {brief.objectives.map((objective, index) => (
            <li key={objective} className="flex items-start gap-2">
              <span className="tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-amber-300 bg-white text-[0.6875rem] font-bold text-[var(--private-strong)]">
                {index + 1}
              </span>
              <span>{objective}</span>
            </li>
          ))}
        </ul>
      </section>

      {hasReasons ? (
        <p className="mb-3 rounded-lg border border-[var(--private-line)] bg-white/70 px-3 py-2 text-xs leading-relaxed text-[var(--private-ink)]">
          Sharing sensitive background is optional. The other person cannot see this briefing.
        </p>
      ) : (
        <p className="mb-3 rounded-lg border border-[var(--private-line)] bg-white/70 px-3 py-2 text-xs leading-relaxed text-[var(--private-ink)]">
          The other person cannot see this briefing.
        </p>
      )}

      <div
        role="tablist"
        aria-label="Briefing sections"
        className={cx(
          "mb-3 grid gap-1 rounded-xl border border-amber-200 bg-amber-100/55 p-1",
          hasReasons ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        {tabs.map((tab, index) => {
          const selected = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`${tabId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${tabId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => moveTab(event, index)}
              className={cx(
                "min-w-0 rounded-lg px-2 py-2 text-sm font-semibold transition-colors",
                selected
                  ? "bg-white text-[var(--ink)] shadow-2xs"
                  : "text-[var(--private-strong)] hover:bg-white/60",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <section
        id={`${tabId}-panel-situation`}
        role="tabpanel"
        aria-labelledby={`${tabId}-tab-situation`}
        tabIndex={0}
        hidden={currentTab !== "situation"}
        className="rounded-xl border border-[var(--private-line)] bg-[var(--private-surface)] p-3"
      >
        <RoleStory story={brief.roleStory} compact />
      </section>

      <section
        id={`${tabId}-panel-points`}
        role="tabpanel"
        aria-labelledby={`${tabId}-tab-points`}
        tabIndex={0}
        hidden={currentTab !== "points"}
      >
        <p className="mb-2 text-xs leading-relaxed text-[var(--private-ink)]/85">
          More points mean an option fits your goals better. These values are private.
        </p>
        <dl className="mb-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-[var(--private-line)] bg-white/75 px-2.5 py-2">
            <dt className="font-medium text-[var(--private-ink)]/75">Maximum</dt>
            <dd className="mt-0.5 font-bold tabular-nums text-[var(--ink)]">
              {maximumPoints.toLocaleString()} pts
            </dd>
          </div>
          <div className="rounded-lg border border-[var(--private-line)] bg-white/75 px-2.5 py-2">
            <dt className="font-medium text-[var(--private-ink)]/75">No agreement</dt>
            <dd className="mt-0.5 font-bold tabular-nums text-[var(--ink)]">
              {task.reservationPoints.toLocaleString()} pts
            </dd>
          </div>
        </dl>
        <IssueValueTable
          issues={task.issues}
          role={role}
          reservationPoints={task.reservationPoints}
          showKey={false}
          compact
        />
        <div className="mt-3 rounded-xl border border-[var(--private-line)] bg-white/75 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--private-strong)]">
            If there is no agreement
          </p>
          <p className="mt-1 text-sm leading-relaxed">{brief.batnaSummary}</p>
        </div>
      </section>

      {hasReasons ? (
        <section
          id={`${tabId}-panel-reasons`}
          role="tabpanel"
          aria-labelledby={`${tabId}-tab-reasons`}
          tabIndex={0}
          hidden={currentTab !== "reasons"}
        >
          <p className="mb-2.5 rounded-lg border border-[var(--private-line)] bg-amber-100/60 p-2.5 text-xs font-medium leading-relaxed">
            {brief.requirementNote}
          </p>
          <p className="mb-2.5 text-xs leading-relaxed text-[var(--private-ink)]/85">
            You hold a <strong>work reason</strong> that is not awkward to say
            and <strong>sensitive background</strong> that is yours to keep. {brief.disclosureRisk}
          </p>
          <IssueReasonGroups task={task} role={role} />
        </section>
      ) : null}
    </Card>
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
    /*
     * COLOUR SAYS COSTLY, NOT FORBIDDEN (interface rules 1 and 6).
     *
     * The sensitive box was amber on amber: `IssueReasonGroups` renders it on
     * a slate group card that itself sits on the sand private surface, so a
     * light amber tint separated it from the WORK box by almost nothing and
     * from the rail's own ground by less than that. Rule 6 wants these two
     * boxes read as different KINDS of thing, because which box a participant
     * draws from is the measure.
     *
     * Rose rather than a deeper amber, and rose rather than red. Amber is
     * already spoken for — it is the private/sand family (rule 1), so any
     * amount of it reads as "this is your side of the table" and not as "this
     * one costs something to say". Rose is the nearest warm hue that is not
     * that family and still sits inside it: a warm tint on a light ground,
     * with the ink and the border carrying the weight rather than the fill.
     * A saturated red-600 ground would read as a form validation error, which
     * is a different claim — that the participant has done something wrong —
     * and it would also read as an instruction not to tick, which the study
     * may not give. Disclosure is the primary outcome; the colour may say the
     * sentence is costly, which `brief.disclosureRisk` already says in words,
     * and must not say what to do about it.
     *
     * No ring and no animation here: rule 9 reserves the cue for the one thing
     * a screen is waiting for, and this box is not waiting for anything.
     */
    <div
      className={cx(
        "mb-2.5 rounded-xl border p-3 last:mb-0 shadow-2xs transition-all",
        sensitive
          ? "border-rose-300 bg-rose-50 text-rose-950"
          : "border-slate-200 bg-white text-slate-900",
      )}
    >
      <p
        className={cx(
          "mb-1 flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide",
          sensitive ? "text-rose-800" : "text-slate-700",
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
              <p className="text-xs sm:text-sm leading-relaxed break-words">
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
 * colours here, on the mandate screen, and in the Direct picker alike.
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
  /**
   * Lift the floating briefing button clear of a composer.
   *
   * Below `lg` the briefing is behind one tap, and that trigger is a FIXED
   * overlay sitting one action-bar's height off the bottom. On screens that
   * END in a sticky action bar that is the right place — it rides just above
   * the Continue button. THE NEGOTIATION SCREENS HAVE NO ACTION BAR: their
   * last element is the composer, in normal flow, so the trigger landed
   * squarely on top of it. Measured at 390px it covered the textarea's right
   * edge AND the whole Send button (button 237-374px, Send 258-359px), so a
   * mobile participant could read their own half-hidden draft and had no way
   * to send it.
   *
   * That is the negotiation, lost on the one viewport with no fallback: rule 5
   * says the briefing is never taken away, but it may not take the composer
   * away either.
   */
  composerBelow = false,
}: {
  briefing: ReactNode;
  children: ReactNode;
  composerBelow?: boolean;
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
        aria-expanded={open}
        className={cx(
          "fixed right-4 z-20 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-400 px-5 py-3 text-xs sm:text-sm font-extrabold text-slate-900 shadow-xl lg:hidden cursor-pointer hover:scale-105 active:scale-95 transition-all",
          // Above the action bar where there is one; well clear of the
          // composer where there is not.
          composerBelow
            ? "bottom-[calc(var(--actionbar-h)+6.5rem)]"
            : "bottom-[calc(var(--actionbar-h)+1rem)]",
        )}
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
          <div
            role="region"
            aria-label="Your private briefing"
            className="absolute inset-y-0 right-0 flex w-[min(26rem,100%)] flex-col bg-[var(--private-surface)] shadow-2xl"
          >
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
