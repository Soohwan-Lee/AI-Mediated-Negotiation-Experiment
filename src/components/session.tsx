"use client";

/**
 * Task shell: where you are in the task, and your briefing, always.
 *
 * The briefing is the whole problem with this study's interface. Three terms
 * with four levels each, private point values, a role story
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
import { ProxyScene, ProxySpeech } from "./proxy-art";
import { ActionBar } from "./study-chrome";
import { Card, CardTitle, Page, PrivateTag, cx } from "./ui";
import { STUDY } from "@/lib/study-config";
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
  /* THE PROXY COVER IS DRAWN, not emoji. It is the first time a participant
     meets the representative they are about to brief, and the four screens
     after it (mandate, rehearsal, confirm, handover) all carry the same
     figure — so the cover has to be the same figure too, or the character
     starts one screen late. The other two scenes keep their emoji row: there
     is no representative in them.

     RULE 10 STILL HOLDS: this draws the INTERFACE. Both policies get this
     picture, and `ProxyScene` takes no policy to branch on. */
  if (scene === "proxy") {
    return (
      <div aria-hidden className="my-8 w-full">
        <ProxyScene emphasis="briefing" />
      </div>
    );
  }

  const figures =
    scene === "direct"
        ? [
            { emoji: "🧑‍💼", label: "You" },
            /* NOT "Direct Chat". "Direct" is a CONDITION NAME
               (`Condition = "direct" | ...`), and this scene is shown on the
               Direct arm's own cover AND on the Proxy arm's handover — so the
               label put one of the three arm names on screen, in the one place
               a participant could compare it against the "AI Proxy" wording
               next to it. Say what happens instead of what the arm is called;
               everything else on these covers already does. */
            { emoji: "💬", label: "You talk directly", joint: true },
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
 * CONDITION NAME.
 *
 * THE TWO STRINGS ARE NOT MATCHED IN LENGTH, AND SINCE VER.2.21 THAT IS
 * DELIBERATE. They are translations of §8.7's own two texts, which differ in
 * length because the two policies differ in how much a participant has to be
 * told before the handling is fully disclosed: AI-Supplemented adds reasons,
 * re-attributes the whole to the proxy, marks nothing as the participant's,
 * and shows none of the added sentences beforehand. Every one of those is a
 * fact the participant needs in order to consent to the handling and to answer
 * the §9.4 items about it, so trimming for symmetry would buy a cosmetic match
 * by withholding disclosure. The earlier build did trim, and the cost was
 * exactly that: four §8.7 points went missing from the AI-Supplemented arm.
 * The MATCHED pair is `POLICY_NOTE`, and the explainer below holds its two
 * bodies close for the same reason — but where a design sentence and the
 * symmetry pull apart, the design sentence wins.
 *
 * TWO CLAUSES, ALWAYS, AND THE SECOND IS THE LOAD-BEARING ONE. Each string
 * says what YOUR proxy does and then that the OTHER participant's proxy does
 * exactly the same. `AI-Supplemented − User-Specified` is a contrast between
 * two ways of being represented, and it is only clean if every participant
 * knows the rule is COMMON KNOWLEDGE rather than something imposed on them
 * alone: a participant who thinks only their own side is being shortened is
 * answering the §9.4 items about an asymmetry that does not exist.
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
    "Your AI Proxy keeps what your chosen reasons say and puts it in its own words, as your representative. It adds no new reasons. The other participant's AI Proxy works exactly the same way.",
  ai_supplemented:
    "Your AI Proxy leaves out the specific event and any mention of you personally, keeping one sentence on what kind of situation it is. It adds work reasons of its own and presents the whole thing as its own assessment (“Having reviewed the situation…”). It does not mark which part came from you. The summary and the added reasons are passed on as support for your request. You won’t see the added sentences beforehand. The other participant's AI Proxy works exactly the same way.",
};

/**
 * The same disclosure in one clause, for the action bar under the exchange.
 *
 * The watch screen has a single muted line of room, and taking the first
 * sentence of `POLICY_DISCLOSURE` would drop the second clause — which is the
 * half that says the rule is symmetric, at the very moment the participant is
 * WATCHING the other side's proxy speak. These say both halves at once, in the
 * plural, and are matched in length for the same reason the full strings are.
 */
export const POLICY_NOTE: Record<
  "user_specified" | "ai_supplemented",
  string
> = {
  user_specified:
    "Both AI Proxies keep what their own person's reasons say and put it in their own words.",
  ai_supplemented:
    "Both AI Proxies keep one sentence on the kind of situation, and add work reasons of their own.",
};

/**
 * The two arms' explainer copy, written to ONE shape so it cannot cue the arm.
 *
 * THE SENTENCES ARE THE DESIGN'S, NOT THIS FILE'S (Ver.2.21 §8.7). Both the
 * policy description and the worked example are fixed in the design document
 * and translated here into plain English. What a participant is told about the
 * handling IS half the manipulation — the other half is the handling itself —
 * so rewriting these for tone would change the independent variable. Anything
 * added around them is structure, never content.
 *
 * Everything is structurally paired: the same two table rows, three bullets,
 * and one worked example with the same four beats — the shared background,
 * what the proxy says, a closing line, and the line saying the other
 * participant's proxy works the same way. The two bodies are within ~14% of
 * each other in characters. A participant cannot tell from the AMOUNT of
 * explanation which arm they are in, only from its content, which is the
 * manipulation and is meant to be visible.
 *
 * THE EXAMPLE IS THE DESIGN'S PRACTICE SITUATION, and §8.7 is explicit about
 * why: it is a holiday week, not office days or client meetings or project
 * days. An example built from a real card would put that card's sentence on
 * screen one more time while the participant is deciding whether to share it,
 * which is the primary outcome being nudged. Both arms use the SAME shared
 * background and differ only in what the proxy does with it.
 *
 * IT MAY NOT COACH. §8.7 rules out any scene in which sharing the background
 * wins a bigger concession — the instructions and the practice round must
 * never signal that disclosure is the right answer. Nothing here says which
 * reason moves the counterpart, or that one handling is better than the other.
 *
 * THIRD PERSON (Ver.2.19). The proxy says "I" about itself, "you" about the
 * participant, and "the team member I represent" inside the quoted example —
 * the delegation has to stay visible in the very sentences that demonstrate it.
 */
const POLICY_EXPLAINER: Record<
  "user_specified" | "ai_supplemented",
  {
    mine: string;
    theirs: string;
    bullets: readonly string[];
    exampleLead: string;
    tickedLead: string;
    ticked: string;
    saidLead: string;
    said: string;
    exampleTail: string;
    same: string;
  }
> = {
  user_specified: {
    mine: "I keep what your chosen reasons say and put it in my own words, as your representative.",
    theirs:
      "Their AI Proxy keeps what their chosen reasons say and puts it in its own words, the same way.",
    bullets: [
      "I keep what your reasons say — the event, and that it is yours — and put it in my own words.",
      "I add no reasons of my own, so every reason the other side hears is one you chose.",
      "I say it as your representative, so it is clear the reason comes from you rather than from me.",
    ],
    exampleLead:
      "A practice situation, not this task — two people deciding which week one of them takes off.",
    tickedLead: "The background the team member chose to share:",
    ticked:
      "Actually, I have a hospital check-up that week, and I haven't told the team yet.",
    saidLead: "What their AI Proxy says to the other side:",
    said:
      "The team member I represent tells me they have a hospital check-up scheduled that week. They haven't told the team yet.",
    exampleTail:
      "The check-up, and the fact that the team has not been told, both go across in full. Only the wording is mine rather than theirs, and it goes across as support for what they are asking for.",
    same:
      "The other participant's AI Proxy works exactly the same way with their reasons, so what you hear from it reaches you in the same shape.",
  },
  ai_supplemented: {
    mine: "I keep one sentence on the kind of situation it is, add work reasons, and give it as my own view.",
    theirs:
      "Their AI Proxy keeps one sentence on the kind of situation, adds work reasons, and gives its own view too.",
    bullets: [
      "I drop the specific event and any mention of you, and keep one sentence on the kind of situation it is.",
      "I add work reasons of my own, and you will not see those added sentences before the negotiation.",
      "I give the whole thing as my own assessment, and which part came from you is not marked.",
    ],
    exampleLead:
      "A practice situation, not this task — two people deciding which week one of them takes off.",
    tickedLead: "The background the team member chose to share:",
    ticked:
      "Actually, I have a hospital check-up that week, and I haven't told the team yet.",
    saidLead: "What their AI Proxy says to the other side:",
    said:
      "Having reviewed the situation on the side of the team member I represent, I think that week should be kept free. Three reasons: there is a personal appointment that week, the project load is lightest that week, and settling it early makes cover easier to arrange.",
    exampleTail:
      "The check-up became \u201Ca personal appointment\u201D, and the other two reasons are mine rather than theirs. All three go across as support for what they are asking for.",
    same:
      "The other participant's AI Proxy works exactly the same way with their reasons, so what you hear from it reaches you in the same shape.",
  },
};

/**
 * The policy in full, under the one-paragraph disclosure (§7).
 *
 * A `<details>`, not state: the mandate opens it because that is the screen
 * where the rule is being ACTED on, and the later screens leave it closed
 * because by then it has been read and the decision there is a different one.
 * `<details>` also keeps find-in-page working on a closed section and survives
 * the re-renders these screens produce.
 *
 * THE TWO COLUMNS ARE WORD-FOR-WORD IDENTICAL APART FROM THE PRONOUN. That is
 * the point of the table: the symmetry is easier to believe when it can be
 * read off the layout rather than taken on trust from a sentence.
 */
export function PolicyExplainer({
  policy,
  defaultOpen = false,
}: {
  policy: "user_specified" | "ai_supplemented";
  /** Open on arrival. The mandate passes this; nothing else does. */
  defaultOpen?: boolean;
}) {
  const copy = POLICY_EXPLAINER[policy];

  return (
    <details
      open={defaultOpen}
      className="group mt-2 rounded-lg border border-indigo-100 bg-white/70"
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-indigo-900 marker:content-none sm:text-[0.8125rem]">
        <span aria-hidden className="mr-1.5 inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        How both AI Proxies handle reasons in this task
      </summary>

      <div className="border-t border-indigo-100 px-3 py-3 text-xs leading-relaxed text-indigo-950/90 sm:text-[0.8125rem]">
        {/* Two rows rather than two columns below `sm`: the wording is what
            has to be comparable, and a two-column grid at 360px turns each
            cell into a narrow ribbon nobody reads across. */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md bg-indigo-50/70 p-2.5">
            <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-indigo-700">
              Your AI Proxy
            </p>
            <p className="mt-1">{copy.mine}</p>
          </div>
          <div className="rounded-md bg-indigo-50/70 p-2.5">
            <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-indigo-700">
              The other participant&rsquo;s AI Proxy
            </p>
            <p className="mt-1">{copy.theirs}</p>
          </div>
        </div>

        <ul className="mt-3 space-y-1.5">
          {copy.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span aria-hidden className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {/* THE EXAMPLE IS NOT THIS TASK'S MATERIAL. See the note on
            `POLICY_EXPLAINER`: §8.7 fixes it as a holiday week, so nothing
            here rehearses a card the participant is about to decide about. */}
        <div className="mt-3 rounded-md border border-indigo-100 bg-indigo-50/40 p-2.5">
          <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-indigo-700">
            Example
          </p>
          <p className="mt-1.5">{copy.exampleLead}</p>

          <p className="mt-2.5">{copy.tickedLead}</p>
          <p className="mt-1 border-l-2 border-indigo-300 pl-2.5 italic">
            &ldquo;{copy.ticked}&rdquo;
          </p>

          <p className="mt-2.5">{copy.saidLead}</p>
          <p className="mt-1 border-l-2 border-indigo-300 pl-2.5 italic">
            &ldquo;{copy.said}&rdquo;
          </p>

          <p className="mt-2.5 text-indigo-900/80">{copy.exampleTail}</p>
        </div>

        <p className="mt-3">{copy.same}</p>
      </div>
    </details>
  );
}

/**
 * One representative, four screens: who this thing is, in its own voice.
 *
 * The mandate, the rehearsal, the confirm sheet and the handover are the whole
 * of the delegation, and they read as four unrelated forms unless the same
 * representative is standing at the top of each one SAYING what it is about to
 * do. It was an emoji and a third-person sentence ("It will negotiate…"),
 * which describes a feature. The participant is delegating their voice, and
 * §9.4 later asks them who was answerable for what got said — so the thing
 * they briefed had better have spoken to them at least once.
 *
 * VOICE (Ver.2.19, applied to the participant's own side). The proxy says "I"
 * about ITSELF and "you" about the participant. It never says "I" about the
 * participant's circumstances, and it never claims their confession as its
 * own — that rule is what keeps the delegation visible, and it is the rule the
 * mockup's scripted proxy broke by pasting card text verbatim.
 *
 * IT MAY NOT COACH. `speech` is written at the call site and every line of it
 * is checked against two things: it may not name which reason works (the
 * ladder is never taught — Design §8.1), and it may not suggest what a
 * sensible participant ticks. Disclosure is the primary outcome; a
 * representative that leaned on it would be staging what the study measures.
 *
 * DECEPTION INTEGRITY: the two policies render an IDENTICAL block apart from
 * `POLICY_DISCLOSURE`. Nothing else here may branch on the policy, and the
 * condition name appears nowhere.
 */
export function ProxyIdentity({
  policy,
  status,
  footnote,
  speech,
  scene,
  explainerOpen = false,
  className,
}: {
  policy: "user_specified" | "ai_supplemented";
  status?: string;
  /** Open the policy explainer on arrival. The MANDATE passes this and
      nothing else does: that is the screen where the rule is being acted on,
      and it is the same prop in both arms, so it cannot cue the condition. */
  explainerOpen?: boolean;
  /** One muted line under the policy sentence — the mandate screen uses it to
      say what happens after this screen. Never anything policy-specific. */
  footnote?: ReactNode;
  /** What the representative says on this screen. Defaults to its standing
      introduction; every screen in the delegation passes its own. */
  speech?: ReactNode;
  /** Draw the four-figure scene under the speech (mandate and handover). */
  scene?: "briefing" | "table";
  className?: string;
}) {
  return (
    <ProxySpeech status={status} scene={scene} className={className}>
      {speech ?? (
        <p>
          I&rsquo;ll be negotiating with the other participant&rsquo;s AI Proxy
          on your behalf. I only say what you hand me here.
        </p>
      )}

      {/* The §7 disclosure, verbatim and in the same place on every screen.
          It is the ONE string that differs between the two policies, so it
          keeps its own surface inside the speech rather than being folded into
          a sentence the proxy speaks — a policy the proxy narrated would vary
          in tone between arms, and its wording is fixed for exactly that
          reason. */}
      <div className="mt-3 rounded-lg bg-indigo-50/70 px-3 py-2">
        <p className="text-xs leading-relaxed text-indigo-950/90 sm:text-[0.8125rem]">
          {POLICY_DISCLOSURE[policy]}
        </p>
        {/* The same component, the same prop, in both arms. The explainer
            differs in CONTENT because the policies differ; it may never
            differ in whether it is there. */}
        <PolicyExplainer policy={policy} defaultOpen={explainerOpen} />
      </div>

      {footnote ? (
        <p className="mt-2 text-xs leading-relaxed text-indigo-900/70">
          {footnote}
        </p>
      ) : null}
    </ProxySpeech>
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
 * Headings follow the role-story paragraphs in the current design.
 *
 * The numbered headings are scanning aids: the four sections do four
 * different jobs and a reader mid-negotiation is looking for one of them.
 * They remain neutral labels: the interface must not tell participants what
 * sharing a reason will mean for how the other person evaluates them.
 *
 * `compact` is what the briefing rail passes: the same treatment at the rail's
 * 13px, with no figure and tighter spacing. The illustration lives on the
 * TaskBrief page and never in the rail.
 */
export function RoleStory({ story, compact = false }: { story: string; compact?: boolean }) {
  const paragraphs = story.split("\n\n").map(p => p.trim()).filter(Boolean);
  const headings = paragraphs.length === 3
    ? ["Your role on the team", "What matters to you", "What you can share"]
    : paragraphs.length === 4
      ? ["Your role on the team", "What matters to you", "What you can share", "Your choice about sharing"]
      : [];
  const labelled = headings.length > 0;
  return <div className={compact ? "space-y-3" : "space-y-4"}>
    {paragraphs.map((paragraph, index) => {
      const heading = labelled ? headings[index] : null;
      return <section
        key={index}
      >
        {heading ? <h3 className={cx(
          "flex items-baseline gap-1.5 font-bold tracking-tight text-[var(--private-strong)]",
          compact ? "mb-1 text-[0.8125rem]" : "mb-1.5 text-[0.9375rem]",
        )}>
          <span aria-hidden="true" className="tabular flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--private-line)] bg-white text-[0.625rem]">
            {index + 1}
          </span>
          {heading}
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
        <p className="mt-2 border-t border-amber-200 pt-2 text-xs leading-relaxed text-[var(--private-ink)]">
          {role === "leader" ? (
            <>
              <strong>Payment: {STUDY.currencySymbol}{STUDY.totalPaid} guaranteed.</strong>{" "}
              Recommending the member&apos;s bonus does not reduce it.
            </>
          ) : (
            <>
              <strong>Payment: {STUDY.currencySymbol}{STUDY.compensation} guaranteed.</strong>{" "}
              The leader can recommend up to {STUDY.currencySymbol}{STUDY.bonusAmount} across both tasks.
            </>
          )}
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
          <strong>These task points are not money.</strong> More points mean an
          option fits your goals better, and the values are private.
        </p>
        <dl className="mb-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-[var(--private-line)] bg-white/75 px-2.5 py-2">
            <dt className="font-medium text-[var(--private-ink)]/75">Maximum</dt>
            <dd className="mt-0.5 font-bold tabular-nums text-[var(--ink)]">
              {maximumPoints.toLocaleString()} pts
            </dd>
          </div>
          <div className="rounded-lg border border-[var(--private-line)] bg-white/75 px-2.5 py-2">
            {/* "Both score 0" rather than a bare 0 (§8.1, Ver.2.21). There is
                no fallback plan since Ver.2.21, and an unqualified "0 pts"
                reads as a penalty aimed at this participant; saying it applies
                to both is what §8.1 already tells everyone, so it leaks
                nothing about the other side's sheet. */}
            <dt className="font-medium text-[var(--private-ink)]/75">No agreement (both)</dt>
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
          {/* THE RISK SENTENCE MOVED OUT OF THIS LINE. `disclosureRisk` is
              role-specific and forecasts a particular bad impression, which
              §8.1's researcher note rules out ("부정적 결과를 예고하는 역할별
              경고… 추가하지 않음"). What the notice may say is the ⚠ caption
              under the sensitive box — the same sentence in both arms, naming
              both sides of the decision. */}
          <p className="mb-2.5 text-xs leading-relaxed text-[var(--private-ink)]/85">
            You hold a <strong>work reason</strong> that is not awkward to say
            and <strong>sensitive background</strong> that is yours to keep.
          </p>
          <IssueReasonGroups task={task} role={role} />
        </section>
      ) : null}
    </Card>
  );
}

/**
 * §8.1's common pre-disclosure notice, cut to one line.
 *
 * IT APPEARS IN BOTH ARMS AND NOWHERE ELSE: under the SB card in the briefing
 * panel (which is the only place a Direct participant ever sees the two boxes,
 * there being no picker in the composer since Ver.2.20), and under the SB
 * checkbox on the Proxy arm's mandate. §8.7 requires the same sentence in both
 * — a caption in one arm only would be an exposure difference on the primary
 * outcome, along the primary contrast.
 *
 * WHAT IT SAYS AND WHAT IT MUST NOT. It names both sides of the decision: it
 * may help them understand the ask, and it may shape how they see you and be
 * weighed afterwards. It never forecasts a bad outcome, never says AI
 * protects, never says disclosure gets a better result, and it is never
 * followed by a confirmation step. §8.1's researcher note is explicit that no
 * answer here may be presented as the sensible one, because which answer
 * people give IS the primary outcome.
 *
 * It is exported from ONE place so the two arms cannot drift a word apart.
 */
export const SB_CAPTION =
  "Sharing this can help the other side understand what you're asking for. It can also shape how they see you, and it may be weighed in the bonus or evaluation afterwards.";

/** The caption as it renders — one ⚠ line, no ring, no animation (rule 9). */
export function SensitiveCaption({ className }: { className?: string }) {
  return (
    <p
      className={cx(
        "flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-rose-900/90 sm:text-xs",
        className,
      )}
    >
      <span aria-hidden className="shrink-0">
        ⚠
      </span>
      <span>{SB_CAPTION}</span>
    </p>
  );
}

export function ReasonBox({
  title,
  note,
  cards,
  sensitive,
  caption,
  children,
}: {
  title: string;
  note?: string;
  cards: Array<{ id: string; text: string }>;
  sensitive?: boolean;
  /** Rendered under the cards — §8.7's ⚠ line on the sensitive box. */
  caption?: ReactNode;
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
      {caption}
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
  caption = true,
}: {
  task: NegotiationTask;
  role: Role;
  renderCard?: (card: { id: string; text: string }) => ReactNode;
  /**
   * Show §8.7's ⚠ line under the sensitive box. On by default, because the
   * briefing panel is where a Direct participant sees these two boxes for the
   * whole negotiation and the caption has to be there.
   *
   * The brief phase turns it OFF: that screen carries §8.1's notice in full,
   * directly below, and the caption is a one-line repeat of that same notice.
   * Two versions of one sentence, stacked, reads as the interface pressing the
   * point — which on the primary outcome is exactly what §8.1's researcher
   * note forbids.
   */
  caption?: boolean;
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
        /* §8.7: the same one-line notice in both arms. The mandate screen
           passes its own copy under the checkbox, because there the caption
           belongs to a control rather than to the box; everywhere else — the
           briefing panel, the brief phase — it belongs to the box, which is
           what this renders. */
        caption={caption ? <SensitiveCaption className="mt-2.5" /> : null}
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
