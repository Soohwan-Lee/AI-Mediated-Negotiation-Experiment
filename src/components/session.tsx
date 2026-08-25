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
  /** Phase labels, in order. */
  steps: string[];
  /** Index of the phase being shown. */
  current: number;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-3)]">
            Task {taskIndex} of 2
            <span aria-hidden className="mx-2 text-[var(--line-strong)]">
              /
            </span>
            Step {current + 1} of {steps.length}
          </p>
          <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">
            {title}
          </h1>
        </div>
        {aside}
      </div>

      <ol className="flex items-center gap-1">
        {steps.map((label, i) => (
          <li
            key={label}
            className={cx(
              "flex-1 rounded-full transition-colors",
              i === current ? "h-1.5" : "h-1",
              i <= current ? "bg-[var(--accent)]" : "bg-[var(--line)]",
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

/**
 * The screen that opens a practice round or a session.
 *
 * A participant used to cross from the instructions straight into a briefing,
 * and from the practice round straight into the task that counts, with nothing
 * between them but a change of heading. Both are moments where knowing what
 * you are about to be asked for is worth a screen of its own: what this round
 * is, what happens in it, how long it takes, and one button to begin.
 *
 * DECEPTION INTEGRITY: `steps` is the phase list of the task the participant
 * is about to do, which is theirs and only theirs — it names interface phases
 * ("What it may say"), never a condition, and Delegate and Explorer produce
 * the same list. Nothing here may say why this task differs from the last one.
 */
/**
 * Who talks to whom in the round about to start, drawn in emoji.
 *
 * A cover says what is about to happen in a paragraph and a numbered list, and
 * both have to be read. The shape of the exchange — two people talking, or two
 * people who each send a proxy and then talk themselves — is the one thing on
 * the cover that a picture states faster than a sentence, and it is also the
 * thing a participant most needs to have right before they start.
 *
 * DECEPTION INTEGRITY, and this is the whole reason the component takes a
 * `scene` rather than reading the assignment:
 *
 *  - It draws the INTERFACE, never the condition. Delegate and Explorer are
 *    the same picture, because they are the same interface — the difference
 *    between them is which reasons a proxy may voice, which is not a shape.
 *    A participant who compared covers with someone else must find the two
 *    Proxy covers identical.
 *  - The other side is drawn as a person, with the same figure the participant
 *    gets. Drawing them as a machine, or leaving them out, would contradict
 *    what every other screen says about who is on the other end.
 *  - Both arms get a scene. If only one condition had a picture, the picture
 *    itself would become the tell that the two tasks differ in kind.
 *
 * `aria-hidden`, with the same content stated in the lead text — this is a
 * restatement for people who skim, not a source of new information.
 */
export type CoverScene = "direct" | "proxy" | "practice";

function CoverArt({ scene }: { scene: CoverScene }) {
  const figures =
    scene === "proxy"
      ? // You → your proxy … their proxy ← them. The proxies meet in the
        // middle, and the two principals are still the ends of the line,
        // because the participant does take over from theirs.
        [
          { emoji: "🧑‍💼", label: "You" },
          { emoji: "🤖", label: "Your AI Proxy" },
          { emoji: "🤝", label: "", joint: true },
          { emoji: "🤖", label: "Their AI Proxy" },
          { emoji: "🧑‍💼", label: "Other Participant" },
        ]
      : scene === "direct"
        ? [
            { emoji: "🧑‍💼", label: "You" },
            { emoji: "💬", label: "", joint: true },
            { emoji: "🧑‍💼", label: "Other Participant" },
          ]
        : [
            { emoji: "🧑‍💼", label: "You" },
            { emoji: "💬", label: "", joint: true },
            { emoji: "🎯", label: "A practice scenario" },
          ];

  return (
    <div
      aria-hidden
      className="mt-7 flex w-full items-start justify-center gap-2 sm:gap-4"
    >
      {figures.map((f, i) => (
        <div
          key={`${f.emoji}-${i}`}
          className={cx(
            "flex flex-col items-center",
            f.joint ? "pt-3 sm:pt-4" : "w-[4.5rem] sm:w-24",
          )}
        >
          <span
            className={cx(
              "flex items-center justify-center rounded-full",
              f.joint
                ? "text-[1.25rem] sm:text-[1.5rem]"
                : "h-12 w-12 border border-[var(--line)] bg-[var(--surface)] text-[1.5rem] sm:h-14 sm:w-14 sm:text-[1.75rem]",
            )}
          >
            {f.emoji}
          </span>
          {f.label ? (
            <span className="mt-2 text-center text-[0.6875rem] leading-tight text-[var(--ink-3)]">
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
  /** "1 of 2" style marker, shown as a large numeral. Omitted for practice. */
  counter,
  /** Set on a round whose results do not count, which says so plainly. */
  doesNotCount,
  scene,
}: {
  eyebrow: string;
  title: string;
  lead: ReactNode;
  /** What happens in this round, in order. */
  steps: string[];
  /** Rough length, in minutes. */
  minutes: number;
  /** Anything else that has to be said before starting. */
  note?: ReactNode;
  actionLabel: string;
  onStart: () => void;
  secondary?: ReactNode;
  counter?: { index: number; total: number };
  doesNotCount?: boolean;
  /** Who talks to whom in this round. See `CoverArt`. */
  scene?: CoverScene;
}) {
  return (
    <>
      <Page>
        {/* A cover, not a page with a heading.
            It is centred, it is mostly empty, and the only thing to do on it
            is the button — because its whole job is to mark a boundary the
            participant would otherwise cross without noticing. A dense screen
            here would be another thing to read, which is the opposite. */}
        <div className="flex min-h-[calc(100vh-var(--header-h)-var(--actionbar-h)-3rem)] flex-col justify-center py-10 text-center">
          <div className="mx-auto flex w-full max-w-prose flex-col items-center">
            {counter ? (
              <p
                aria-hidden
                className="mb-5 flex items-baseline gap-1 font-semibold tracking-[-0.03em]"
              >
                <span className="text-[3.5rem] leading-none text-[var(--accent)]">
                  {counter.index}
                </span>
                <span className="text-[1.25rem] leading-none text-[var(--ink-3)]">
                  / {counter.total}
                </span>
              </p>
            ) : null}

            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-3)]">
              {eyebrow}
            </p>
            <h1 className="text-[1.875rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
              {title}
            </h1>

            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[0.8125rem] text-[var(--ink-2)]">
              <span aria-hidden>⏱</span> About {minutes} minutes
              {doesNotCount ? (
                <>
                  <span aria-hidden className="text-[var(--line-strong)]">
                    ·
                  </span>
                  <span className="font-medium">Does not count</span>
                </>
              ) : null}
            </span>

            {scene ? <CoverArt scene={scene} /> : null}

            <div className="prose-study mt-6 text-left">{lead}</div>

            <Card tone="muted" className="mt-8 w-full text-left">
              <CardTitle>What happens in this part</CardTitle>
              <ol className="space-y-2.5">
                {steps.map((step, i) => (
                  <li key={step} className="flex items-baseline gap-3">
                    <span
                      aria-hidden
                      className="tabular flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-full border border-[var(--line-strong)] bg-[var(--surface)] text-[0.75rem] font-medium text-[var(--ink-2)]"
                    >
                      {i + 1}
                    </span>
                    <span className="text-[0.9375rem]">{step}</span>
                  </li>
                ))}
              </ol>
            </Card>

            {note ? <div className="mt-4 w-full text-left">{note}</div> : null}
          </div>
        </div>
      </Page>

      {/* The bar carries no status line. There is nothing to count on a cover
          and nothing to warn about, and a sentence there would only repeat
          what the page above it already says. */}
      <ActionBar label={actionLabel} onClick={onStart} secondary={secondary} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Briefing
// ---------------------------------------------------------------------------

/**
 * The private briefing.
 *
 * EVERYTHING IN IT STAYS (interface rule 5) — a participant is expected to
 * negotiate from this, and taking a part away to tidy the panel would take
 * away something they were told to negotiate from. What changed is that it is
 * no longer all expanded at once.
 *
 * As one continuous scroll it held: role, position, a paragraph of situation,
 * objectives, a requirement note, six reason cards in two boxes, the fallback,
 * and the payoff table. In the rail that is several screens, and the payoff
 * table — the part most often wanted DURING a negotiation — sat at the bottom
 * of all of it. So the sections fold, and what is open by default is chosen by
 * what a participant reaches for mid-sentence rather than by document order:
 * the numbers and the fallback, which are lookups, plus the reason cards,
 * which are rule 5's explicit requirement and rule 6's two-box decision. The
 * situation and objectives have been read on the brief phase and fold away;
 * they are one click, never a navigation.
 *
 * `defaultOpen` overrides that on the brief phase, where the whole thing is
 * being read for the first time in the main column and nothing should be
 * hidden behind a control.
 */
export function BriefingPanel({
  task,
  role,
  defaultOpen,
}: {
  task: NegotiationTask;
  role: Role;
  /** Open every section — used where the briefing is being read, not consulted. */
  defaultOpen?: boolean;
}) {
  const brief = task.roleBriefs[role];

  return (
    <Card tone="private" className="text-[var(--private-ink)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[0.95rem] font-semibold text-[var(--ink)]">
          Your briefing
        </h2>
        <PrivateTag />
      </div>

      <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]">
        You are
      </p>
      <p className="mb-2 text-[0.9375rem] font-semibold text-[var(--ink)]">
        {brief.title}
      </p>
      <p className="mb-4 max-w-prose text-[0.8125rem] leading-relaxed">
        {brief.organizationalPosition}
      </p>

      {/* The role story is several sentences of concrete situation, and it is
          the part that has to do the work: a point sheet alone does not make
          anyone reluctant to raise something.

          It does NOT get `.prose-study`. That class sets 1.0625rem, so the
          story rendered half again the size of everything around it and took
          most of the rail on its own — the `text-[0.8125rem]` here was being
          overridden. Prose treatment in a 13px panel means the leading and the
          measure, not the display face. */}
      <Fold title="📄 Your situation" defaultOpen={defaultOpen}>
        <p className="max-w-prose whitespace-pre-line text-[0.8125rem] leading-[1.65]">
          {brief.roleStory}
        </p>
      </Fold>

      <Fold title="🎯 What you want" defaultOpen={defaultOpen}>
        <ul className="list-disc space-y-1 pl-4 text-[0.8125rem]">
          {brief.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </Fold>

      {/* The six reason cards, one issue block at a time (ver.2.5: each term
          has a work reason and a sensitive background). Open by default: rule
          5 names them as something the participant is expected to negotiate
          from, and rule 6's whole measure is which layer they are willing to
          draw from — a decision that has to be visible to be made. The visual
          separation of the two layers is a design requirement, not a
          preference (Design §7 UI 규칙): if the two read as one list that
          decision stops being legible.

          THE HEADING NAMES NO TERM. With cards on the requirement issue only,
          a heading naming it repeated what the story had already said; with
          cards on all three issues, singling one term out here would tell the
          participant which term the study is about (§5 principle 4). The
          three blocks are rendered identically for the same reason. */}
      {brief.reasonCards.length ? (
        <Fold title="💬 Your reasons, term by term" defaultOpen>
          <p className="mb-3 max-w-prose rounded-[var(--radius)] border border-[var(--private-line)] bg-[#fff9ef] p-3 text-[0.8125rem] leading-relaxed">
            {brief.requirementNote}
          </p>
          <p className="mb-3 max-w-prose text-[0.8125rem] leading-relaxed">
            Each term comes with a <strong>work reason</strong> — nothing
            awkward about saying it — and a piece of{" "}
            <strong>sensitive background</strong> that is yours to keep.{" "}
            {brief.disclosureRisk}
          </p>
          <IssueReasonGroups task={task} role={role} />
        </Fold>
      ) : null}

      <Fold title="⚠️ If there is no agreement" defaultOpen>
        <p className="max-w-prose text-[0.8125rem]">{brief.batnaSummary}</p>
      </Fold>

      <Fold title="🔢 What each term is worth to you" defaultOpen last>
        <IssueValueTable
          issues={task.issues}
          role={role}
          reservationPoints={task.reservationPoints}
        />
      </Fold>

      <p className="mt-5 border-t border-[var(--private-line)] pt-3 text-[0.75rem]">
        The other side has their own briefing and cannot see yours.
      </p>
    </Card>
  );
}

/**
 * One foldable section of the briefing.
 *
 * A `<details>` rather than state, so a section the participant opens stays
 * open across the re-renders a live negotiation produces, and so it is
 * keyboard- and screen-reader-navigable without any work. Closed sections keep
 * their content in the DOM, which also means the browser's own find-in-page
 * still reaches it.
 */
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
    <details open={defaultOpen} className={cx("group", last ? "" : "mb-3")}>
      {/* `items-start` and a nudged chevron, because these titles wrap: "Why
          quality review checkpoints matters to you" is two lines in the rail,
          and a vertically centred marker beside a two-line label points at the
          gap between them. */}
      <summary className="flex cursor-pointer list-none items-start justify-between gap-2 rounded-[var(--radius)] py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] hover:text-[var(--ink)] [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span
          aria-hidden
          className="mt-px shrink-0 text-[0.8125rem] leading-none opacity-50 transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="mt-1.5">{children}</div>
    </details>
  );
}

/**
 * One of the two reason boxes.
 *
 * `sensitive` gets a heavier border and its own heading colour so the two
 * groups never read as one list — see the note at the call site.
 */
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
  /** Per-card controls, when the box is interactive (the mandate screen). */
  children?: (card: { id: string; text: string }) => ReactNode;
}) {
  if (!cards.length) return null;
  return (
    <div
      className={cx(
        "mb-3 rounded-[var(--radius)] border p-3 last:mb-0",
        sensitive
          ? "border-[var(--caution)]/35 bg-[var(--caution-soft)]"
          : "border-[var(--private-line)]",
      )}
    >
      <p
        className={cx(
          "mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]",
          sensitive ? "text-[var(--caution)]" : "",
        )}
      >
        {sensitive ? "🔒 " : "💼 "}
        {title}
      </p>
      {note ? (
        <p className="mb-2.5 max-w-prose text-[0.75rem] leading-relaxed opacity-80">
          {note}
        </p>
      ) : null}
      <ul className="space-y-2">
        {cards.map((card) => (
          <li key={card.id}>
            {children ? (
              children(card)
            ) : (
              <p className="max-w-prose text-[0.8125rem] leading-relaxed">
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
 * The six reason cards, one identically-rendered block per issue (Design §7
 * ver.2.5 "issue 블록 단위"): the issue's name, its work reason, its sensitive
 * background. Shared by the briefing panel, the mandate screen, and the
 * Baseline reason picker so the three surfaces present the same structure.
 *
 * THE THREE BLOCKS MUST STAY VISUALLY IDENTICAL — same heading treatment,
 * same two boxes, same order. Cards sit on all three issues now, so any
 * decoration that singled one block out would tell the participant which
 * term the study is about (§5 principle 4), which pilot gate 6 exists to
 * catch.
 */
export function IssueReasonGroups({
  task,
  role,
  renderCard,
}: {
  task: NegotiationTask;
  role: Role;
  /** Per-card control, when the blocks are interactive (mandate, picker). */
  renderCard?: (card: { id: string; text: string }) => ReactNode;
}) {
  const cards = task.roleBriefs[role].reasonCards;
  return (
    <div>
      {task.issues.map((issue) => {
        const onIssue = cards.filter((c) => c.issueId === issue.id);
        if (!onIssue.length) return null;
        return (
          <div key={issue.id} className="mb-4 last:mb-0">
            <p className="mb-1.5 text-[0.75rem] font-semibold text-[var(--ink-2)]">
              {issue.label}
            </p>
            <ReasonBox
              title="Work reason"
              cards={onIssue.filter((c) => c.layer === "work")}
            >
              {renderCard}
            </ReasonBox>
            <ReasonBox
              title="Sensitive background"
              cards={onIssue.filter((c) => c.layer === "sensitive")}
              sensitive
            >
              {renderCard}
            </ReasonBox>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Main column with the briefing beside it.
 *
 * Pinned as a rail from `lg` up, where there is room for it; below that a
 * button opens the same panel over the page. One panel, two placements — the
 * briefing is never a different thing depending on your screen.
 */
export function TaskLayout({
  briefing,
  children,
}: {
  briefing: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    /* The rail carries the whole briefing — three terms, their levels, what
       each is worth, and six reason cards — so it widens with the page rather
       than staying at the width it needed when the column was narrower. */
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-8">
      <div className="min-w-0">{children}</div>

      <aside className="hidden lg:block">
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] max-h-[calc(100vh-var(--header-h)-3rem)] overflow-y-auto">
          {briefing}
        </div>
      </aside>

      {/* Narrow screens: the same panel, on demand. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(var(--actionbar-h)+1rem)] right-4 z-20 rounded-full border border-[var(--private-line)] bg-[var(--private)] px-4 py-2.5 text-[0.8125rem] font-semibold text-[var(--private-ink)] shadow-lg lg:hidden"
      >
        📋 Your briefing
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(24rem,100%)] flex-col bg-[var(--private)]">
            <div className="flex items-center justify-between border-b border-[var(--private-line)] px-4 py-3">
              <span className="text-[0.9375rem] font-semibold">
                Your briefing
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--private-ink)] hover:bg-[#fff9ef]"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{briefing}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
