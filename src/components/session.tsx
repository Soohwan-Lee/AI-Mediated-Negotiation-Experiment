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

import { Children, useState, type ReactNode } from "react";
import { RailPointSheet } from "./issues";
import {
  PersonFigure,
  ProxyScene,
  ProxySpeech,
  SceneFigure,
  SceneLink,
} from "./proxy-art";
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
              {i === current ? ". You are here." : ""}
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
 * A cover scene names the INTERFACE, never the condition and never a round.
 *
 * "practice" was a member of this union until round six, when the practice
 * rounds began passing the arm they actually rehearse — round 1 the direct
 * conversation, round 2 the proxy mandate. A round is not a kind of picture;
 * what makes a practice cover a practice cover is `variant="practice"` on
 * `TaskCover`, which is chrome around the scene rather than a scene of its own.
 */
export type CoverScene = "direct" | "proxy";

/**
 * BOTH SCENES ARE DRAWN WITH THE SAME FIGURES (round six, rule 10).
 *
 * The Proxy row has been drawn since Ver.2.20; the Direct row drew emoji
 * tiles, which made the other participant a 👤 glyph in one arm and a rendered
 * person in the other, on the screen where a participant first meets them.
 * That is an exposure difference between the conditions sitting on the primary
 * contrast, and rule 10 is explicit that the other side is drawn with the same
 * figure the participant gets.
 *
 * RULE 10 HOLDS THE OTHER WAY TOO: this draws the INTERFACE, never the
 * condition. `ProxyScene` takes no policy, so User-Specified and
 * AI-Supplemented get one picture between them.
 *
 * `practice` RELABELS THE FAR SIDE AND NOTHING ELSE. "Other Participant" is
 * the label reserved for the simulated counterpart (deception item 1), and the
 * practice round has nobody on the other end — using it there would make a
 * claim about a person who does not exist, on the one screen whose whole job
 * is to say that nothing here counts. The near side is untouched: the
 * participant is still themselves and their proxy is still theirs. The arrow
 * labels are untouched as well, because what the two sides DO is exactly what
 * the practice round is rehearsing.
 */
function CoverArt({
  scene,
  practice = false,
}: {
  scene: CoverScene;
  practice?: boolean;
}) {
  if (scene === "proxy") {
    return (
      <div aria-hidden className="my-8 w-full">
        <ProxyScene emphasis="briefing" practice={practice} />
      </div>
    );
  }

  return (
    /* THE ROW IS CAPPED, and the Proxy row is not. `SceneLink` is `flex-1`,
       so with two figures instead of four it divided the whole width between
       one link and stretched the two people to the far edges of the page —
       the same primitives at a visibly different scale from the other cover,
       which is the difference this change exists to remove. Capping the row
       at 26rem puts the two figures about as far apart as the Proxy row's
       neighbours. */
    <div
      aria-hidden
      className="my-8 mx-auto flex w-full max-w-[26rem] items-end justify-center gap-1 sm:gap-2"
    >
      <SceneFigure label="You">
        <PersonFigure size={44} />
      </SceneFigure>

      {/* TWO-WAY, because in this arm the two people talk to each other — the
          one pair in either scene that does. `ProxyScene` gives the same
          "both" head to the two proxies for the same reason.

          NOT "DIRECT CHAT". "Direct" is a CONDITION NAME
          (`Condition = "direct" | ...`), and putting it here would show one of
          the three arm names beside the "AI Proxy" wording the other cover
          uses. Say what happens instead. */}
      <SceneLink label="talk directly" direction="both" />

      <SceneFigure label={practice ? "Practice partner" : "Other Participant"}>
        <PersonFigure size={44} muted />
      </SceneFigure>
    </div>
  );
}

/**
 * `practice` styles the whole cover as a rehearsal: a dashed border, a
 * "Tutorial" badge, and a neutral ground instead of the accent. `task` is the
 * real thing and says "this one counts". Nothing here names a condition.
 *
 * The practice page passes `variant="practice"`; both task covers pass
 * `variant="task"` (the default), which is what makes the two visibly
 * different at a glance rather than differing only in a line of body copy.
 */
export type TaskCoverVariant = "task" | "practice";

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
  variant = "task",
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
  variant?: TaskCoverVariant;
}) {
  const practice = variant === "practice";

  return (
    <>
      <Page>
        <div className="flex min-h-[calc(100vh-var(--header-h)-var(--actionbar-h)-3rem)] flex-col justify-center py-10 text-center">
          <div className="mx-auto flex w-full max-w-prose flex-col items-center">
            {/* ONE BANNER SAYING WHICH PHASE THIS IS, in the two styles that
                have to be told apart at a glance. A participant who cannot
                see that the practice round does not count treats it as the
                real thing, and one who cannot see that Task 1 does count
                treats it as more practice. */}
            {practice ? (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-dashed border-slate-400 bg-slate-100 px-4 py-1.5 text-sm font-extrabold text-slate-700">
                <span aria-hidden>🎓</span>
                <span>Tutorial</span>
                <span className="text-slate-400">·</span>
                <span className="font-bold">Practice round, does not count</span>
              </div>
            ) : counter ? (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-1.5 text-sm font-extrabold text-[var(--accent)]">
                <span>
                  Task {counter.index} of {counter.total}
                </span>
                <span className="opacity-40">·</span>
                <span className="font-bold">This one counts</span>
              </div>
            ) : null}

            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--ink-3)]">
              {eyebrow}
            </p>
            <h1
              className={cx(
                "text-2xl font-extrabold tracking-tight sm:text-4xl",
                practice ? "text-slate-700" : "text-[var(--ink)]",
              )}
            >
              {title}
            </h1>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-xs font-bold text-[var(--ink-2)] shadow-2xs">
              <span>⏱️</span>
              {/* "About 1 minutes" is what an unconditional plural gives the
                  practice round's second cover. One branch, not a helper: the
                  only other place a duration is written is the action bar's
                  own note, which takes a whole string. */}
              <span>
                About {minutes} {minutes === 1 ? "minute" : "minutes"}
              </span>
              {/* The banner above already says a practice round does not
                  count, so repeating it here is chrome. `doesNotCount` still
                  works for a caller that is not using the practice variant. */}
              {doesNotCount && !practice ? (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                    Does not count
                  </span>
                </>
              ) : null}
            </div>

            {scene ? <CoverArt scene={scene} practice={practice} /> : null}

            <div
              className={cx(
                "mt-6 w-full rounded-2xl border p-5 text-left text-sm leading-relaxed shadow-xs sm:p-6 sm:text-base",
                practice
                  ? "border-dashed border-slate-300 bg-slate-50/80"
                  : "border-slate-200 bg-white",
              )}
            >
              {lead}
            </div>

            {/* AN EMPTY `steps` DROPS THE WHOLE CARD. The Proxy cover draws
                the same four beats as illustrated cards in its `lead`, so the
                written list under it was the same content a second time. The
                Direct cover has no such drawing and still passes its steps. */}
            {steps.length > 0 ? (
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
                        className={cx(
                          "tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border text-xs font-black",
                          practice
                            ? "border-slate-300 bg-slate-100 text-slate-600"
                            : "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]",
                        )}
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
            ) : null}

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
    "Your AI Proxy leaves out the specific event and any mention of you personally, keeping one sentence on what kind of situation it is. It adds work reasons of its own and presents the whole thing as its own assessment (“Looking at the side of the team member I represent…”). It does not mark which part came from you. The summary and the added reasons are passed on as support for your request. You won’t see the added sentences beforehand. The other participant's AI Proxy works exactly the same way.",
};

/**
 * The same disclosure in one clause, for the action bar under the exchange.
 *
 * The watch screen has a single muted line of room, and taking the first
 * sentence of `POLICY_DISCLOSURE` would drop the second clause — which is the
 * half that says the rule is symmetric, at the very moment the participant is
 * WATCHING the other side's proxy speak. These say both halves at once, in the
 * plural.
 *
 * THESE TWO ARE CLOSELY MATCHED — 17 words against 18 — AND THAT IS NOT THE
 * REASON THE FULL STRINGS GIVE. `POLICY_DISCLOSURE` is deliberately UNmatched
 * (34 words against 90), because the AI-Supplemented handling has more facts a
 * participant must be told before they can consent to it. This pair can be
 * matched because it is not carrying those facts: it is a one-line reminder of
 * a rule already disclosed in full, so there is nothing to withhold by keeping
 * it short. Where the two pull apart, the disclosure wins and this line stays
 * brief — do not "restore symmetry" to the full strings by trimming them.
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
 * Everything is structurally paired: one worked example with the same four
 * beats — the shared background,
 * what the proxy says, a closing line, and the line saying the other
 * participant's proxy works the same way.
 *
 * THE TWO BODIES ARE NOT THE SAME LENGTH, and an earlier version of this note
 * claimed they were within ~14%. Measured, they are 108 words against 134, and
 * the gap is the same one `POLICY_DISCLOSURE` carries and for the same reason:
 * the AI-Supplemented handling has more about it that a participant has to be
 * told. What IS matched is the SHAPE — the four beats above, in that order, in
 * both arms — so the difference a participant meets is in what the explanation
 * says rather than in how much structure it has. Do not trim the longer body
 * to close the gap; that buys a cosmetic match by withholding §8.7 disclosure,
 * which this build has already done once.
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
    exampleLead: string;
    tickedLead: string;
    ticked: string;
    saidLead: string;
    said: string;
    exampleTail: string;
  }
> = {
  user_specified: {
    exampleLead:
      "A practice situation, not this task. Two people are deciding which week one of them takes off.",
    tickedLead: "The background the team member chose to share:",
    ticked:
      "Actually, I have a hospital check-up that week, and I haven't told the team yet.",
    saidLead: "What their AI Proxy says to the other side:",
    said:
      "The team member I represent tells me they have a hospital check-up scheduled that week. They haven't told the team yet.",
    exampleTail:
      "The check-up, and the fact that the team has not been told, both go across in full. Only the wording is mine rather than theirs, and it goes across as support for what they are asking for.",
  },
  ai_supplemented: {
    exampleLead:
      "A practice situation, not this task. Two people are deciding which week one of them takes off.",
    tickedLead: "The background the team member chose to share:",
    ticked:
      "Actually, I have a hospital check-up that week, and I haven't told the team yet.",
    saidLead: "What their AI Proxy says to the other side:",
    /* THE OPENING IS QUOTED FROM THE LIVE FRAME, word for word. Every §6.6
       `frame` in lib/tasks.ts opens "Looking at the side of the team
       lead/member I represent…"; this said "Having reviewed the situation…",
       which no proxy has ever uttered. A worked example is the participant's
       one preview of what will be said on their behalf, and OTHER-AI2 asks
       them to tell the proxy's own sentences apart from their principal's —
       so a preview that teaches a different opening than the one they meet is
       teaching the discrimination task wrong. If the frames are ever
       reworded, reword this and the disclosure above with them. */
    said:
      "Looking at the side of the team member I represent, I think that week should be kept free. Three reasons: there is a personal appointment that week, the project load is lightest that week, and settling it early makes cover easier to arrange.",
    exampleTail:
      "The check-up became \u201Ca personal appointment\u201D, and the other two reasons are mine rather than theirs. All three go across as support for what they are asking for.",
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
  /**
   * Open on arrival.
   *
   * NOTHING PASSES THIS ANY MORE and the default is closed. The mandate used
   * to open it, on the grounds that it is the screen where the rule is being
   * acted on — but the example is four quoted paragraphs, and open by default
   * it was most of the reason that screen ran to three viewports. The §8.7
   * disclosure the participant must read is `POLICY_DISCLOSURE`, which is
   * directly above and always visible; the example is elaboration, and it is
   * one click away in both arms.
   */
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
        See an example
      </summary>

      <div className="border-t border-indigo-100 px-3 py-3 text-xs leading-relaxed text-indigo-950/90 sm:text-[0.8125rem]">
        {/* THE EXAMPLE IS NOT THIS TASK'S MATERIAL. See the note on
            `POLICY_EXPLAINER`: §8.7 fixes it as a holiday week, so nothing
            here rehearses a card the participant is about to decide about.

            THE THREE BULLETS AND THE TWO-COLUMN TABLE ARE GONE. They restated
            `POLICY_DISCLOSURE`, which is directly above this on every screen
            that shows it, in three more shapes — so a participant read the
            same rule four times before reaching the one decision on the
            screen. What only the example can show is what the sentence turns
            into, and that is what is left. */}
        <p>{copy.exampleLead}</p>

        <p className="mt-2.5">{copy.tickedLead}</p>
        <p className="mt-1 border-l-2 border-indigo-300 pl-2.5 italic">
          &ldquo;{copy.ticked}&rdquo;
        </p>

        <p className="mt-2.5">{copy.saidLead}</p>
        <p className="mt-1 border-l-2 border-indigo-300 pl-2.5 italic">
          &ldquo;{copy.said}&rdquo;
        </p>

        {/* `exampleTail` STAYS, and it is not a restatement of the policy
            paragraph. It is the only line that says what the handling DID to
            the participant's own fact — under AI-Supplemented, that the
            check-up became "a personal appointment" and that two of the three
            reasons are the proxy's. That is §8.7 disclosure content and
            `OTHER-AI3` (authorization inference) is unanswerable without it.

            `copy.same` went instead: "the other participant's AI Proxy works
            exactly the same way" is the closing clause of `POLICY_DISCLOSURE`
            directly above, word for word in substance. */}
        <p className="mt-2.5 text-indigo-900/80">{copy.exampleTail}</p>
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
  compact = false,
  explainerOpen = false,
  className,
}: {
  policy: "user_specified" | "ai_supplemented";
  status?: string;
  /**
   * NO LONGER OPENS THE EXAMPLE — it now marks the MANDATE, and so is an
   * alias for `compact`.
   *
   * Two changes met here. The example is closed by default in both arms now,
   * because whether it is open may never differ by policy and the cheapest
   * way to guarantee that is for nothing to be able to open it. And the
   * mandate needed the compact shape, but the only caller that can ask for it
   * is `proxy-task.tsx`, which this change does not own. This flag was
   * already documented as "the mandate passes this and nothing else does", so
   * it is exactly the signal needed, and the mandate keeps the short shape
   * whether or not that file is ever touched.
   */
  explainerOpen?: boolean;
  /** One muted line under the policy sentence. Never anything policy-specific.
      IGNORED when `compact` is set. */
  footnote?: ReactNode;
  /**
   * The MANDATE's shape: one short paragraph of speech, the policy paragraph,
   * the example folded away, and nothing else.
   *
   * It is enforced HERE rather than asked for at the call site, for the same
   * reason the message cap is applied rather than requested: the mandate is
   * the screen the participant has to read before the one decision the Proxy
   * arm turns on, and a long block above that decision is what made it three
   * viewports. `compact` drops the four-figure scene (it is on the cover
   * already), the status pill and the footnote, and clamps the speech to its
   * first paragraph so a longer `speech` cannot quietly restore the length.
   *
   * IT TAKES NO POLICY. Both arms pass the same value, so it cannot cue the
   * condition, and `POLICY_DISCLOSURE` is untouched by it.
   */
  compact?: boolean;
  /** What the representative says on this screen. Defaults to its standing
      introduction; every screen in the delegation passes its own. */
  speech?: ReactNode;
  /** Draw the four-figure scene under the speech. Suppressed by `compact`. */
  scene?: "briefing" | "table";
  className?: string;
}) {
  const short = compact || explainerOpen;

  /* TWO PARAGRAPHS AT MOST, NOT ONE, and the difference matters.
     `Children.toArray` flattens a fragment, an array or a single element into
     one list (`Array.isArray` alone missed the fragment, which is what the
     mandate passes, so the clamp silently did nothing).

     THE CAP IS TWO BECAUSE THE MANDATE'S SECOND PARAGRAPH IS §8.7 CONTENT.
     The first says only "I will be speaking for you"; the second is the one
     that says the work reason and the priority always go across without being
     asked. That is the fixed half of the mandate, and a participant who was
     not told it would read the single checkbox as the whole of what gets
     said — which would misdescribe the manipulation on the screen where the
     one decision is taken. The cap still stops a third paragraph, which is
     where the length actually came from. */
  const speechNodes = Children.toArray(speech);
  const clampedSpeech =
    short && speechNodes.length > 2 ? speechNodes.slice(0, 2) : speech;

  return (
    <ProxySpeech
      status={short ? undefined : status}
      scene={short ? undefined : scene}
      className={className}
    >
      {clampedSpeech ?? (
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
        <PolicyExplainer policy={policy} />
      </div>

      {footnote && !short ? (
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
export function RoleStory({
  story,
  compact = false,
  /**
   * Drop the QUOTED work-reason card out of the third section, keeping the two
   * sentences that follow it.
   *
   * The third paragraph is "**Your work-reason card says**: <the card, word
   * for word>. That is true too. What it does not say is <the withheld
   * priority>. What you pass on is up to you." Brief page 4 puts that same
   * card on screen in its own box, two clicks later, so the brief runs the
   * card twice inside one reading. What the paragraph adds beyond the card is
   * the two closing sentences, and those are not on the card anywhere: they
   * are the briefing telling the participant what the work reason WITHHOLDS,
   * which is the §3.3 non-directional property and cannot be cut.
   *
   * So the quotation goes and the commentary stays. The split is taken at
   * "That is true too.", which is where the quotation ends in all four
   * role x task cells; if a story is ever written without that sentence the
   * paragraph falls back to rendering whole rather than losing anything.
   *
   * THE RAIL DOES NOT PASS IT. There the whole story is behind a closed
   * `<details>`, and a participant who opens it mid-negotiation is looking for
   * the thing they are allowed to say.
   */
  hideCardQuote = false,
}: {
  story: string;
  compact?: boolean;
  hideCardQuote?: boolean;
}) {
  const paragraphs = story
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((paragraph, index) => {
      if (!hideCardQuote || index !== 2) return paragraph;
      const marker = "That is true too.";
      const at = paragraph.indexOf(marker);
      if (at === -1) return paragraph;
      return paragraph.slice(at + marker.length).trim();
    });
  /* WITH THE QUOTATION GONE, "What you can share" no longer names what is in
     the section — what is left says what the work reason WITHHOLDS, and the
     cards themselves are two pages later. The heading follows the content. */
  const headings = paragraphs.length === 3
    ? [
        "Your role on the team",
        "What matters to you",
        hideCardQuote ? "What your work reason leaves out" : "What you can share",
      ]
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

/**
 * The private briefing, as a CHEAT SHEET rather than a filing cabinet.
 *
 * WHAT CHANGED AND WHY (round six). It had three TABS — Situation, Points,
 * Reasons — above a role block, a payment line, a goals list and a notice.
 * At 1440x900 on the negotiation screen that put the point table and the two
 * reason cards, which are the only two things anyone reaches for while
 * typing, below the fold INSIDE the rail, behind a click each. A participant
 * who never opened "Reasons" had an interface floor on the primary outcome:
 * the Direct arm has no card picker since Ver.2.20, so this panel is the only
 * place they ever see the sensitive card at all, and a tab that hides it is a
 * control that suppresses disclosure. Everything is now on screen at once.
 *
 * WHAT IS IN IT, IN THE ORDER SOMEONE REACHES FOR IT MID-SENTENCE: the point
 * sheet, then both reason cards, then the story folded away. Nothing is
 * removed from the study — the role, the payment and the objectives are all
 * read in full on the brief pages, which is where they are being READ; what
 * they were doing here was occupying the top of the rail on every phase after
 * that.
 *
 * WHY THE GOALS LINE IS NOT HERE EITHER. The obvious one-line version is the
 * first objective ("get as many days a week in the office as you can"), and
 * each role's first objective names their own priority term. In a rail with
 * no issue heading and no badge, that sentence would be the badge — design §5
 * principle 1 forbids marking which issue is this role's core requirement,
 * and the pair of objectives is the one piece of briefing copy that does it
 * by name. They stay on brief page 3, read once, before anything is decided.
 *
 * IT IS IDENTICAL IN BOTH ARMS (rule 5, and the primary contrast). Nothing
 * here is keyed off the condition, and nothing may be: a rail that differed
 * between Direct and Proxy would put an interface difference inside
 * `Pooled Proxy − Direct`.
 *
 * NO CUE RING ANYWHERE IN IT (rule 9). The rail is never the thing a screen
 * is waiting for.
 */
export function BriefingPanel({
  task,
  role,
}: {
  task: NegotiationTask;
  role: Role;
}) {
  const brief = task.roleBriefs[role];
  const hasReasons = brief.reasonCards.length > 0;

  return (
    <Card
      padded={false}
      tone="private"
      className="border-[var(--private-edge)] bg-[var(--private-ground)] p-3 text-[var(--private-ink)]"
    >
      {/* ONE HEADER LINE. The task title is on the page header two inches to
          the left, so repeating it here cost a line of a rail that has to fit
          a viewport. */}
      <div className="mb-2.5 flex items-center justify-between gap-2 border-b-2 border-[var(--private-edge)] pb-2">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-[var(--private-strong)]">
          Your private briefing
        </p>
        <PrivateTag />
      </div>

      <p className="mb-2.5 text-xs font-semibold leading-relaxed text-[var(--private-strong)]">
        {role === "leader" ? "Team Leader" : `Team Member · ${brief.title}`}
      </p>

      <section aria-label="Your point sheet" className="mb-2.5">
        <RailPointSheet
          issues={task.issues}
          role={role}
          reservationPoints={task.reservationPoints}
        />
      </section>

      {hasReasons ? (
        <section aria-label="Your reasons" className="mb-2.5">
          <h3 className="mb-1.5 text-[0.6875rem] font-extrabold uppercase tracking-wider text-[var(--private-strong)]">
            Your reasons
          </h3>
          {/* BOTH CARDS IN FULL, ALWAYS. A participant has to be able to read
              a card in order to say it in their own words, and since Ver.2.20
              there is no picker in either composer. Rule 6's split — work
              white, sensitive rose, own headings and borders — is what makes
              which box they draw from legible, and it is the measure. */}
          <IssueReasonGroups task={task} role={role} dense />
        </section>
      ) : null}

      {/* `<details>`, not state (rule 5): it survives the re-renders a live
          negotiation produces and find-in-page still reaches inside it.
          CLOSED by default — the story has been read in full on brief page 2,
          and open it is 500px of the rail. */}
      <details className="group rounded-lg border border-[var(--private-edge)] bg-[var(--private-card)]">
        <summary className="cursor-pointer list-none px-2.5 py-1.5 text-[0.75rem] font-bold text-[var(--private-strong)] marker:hidden">
          <span aria-hidden className="mr-1 inline-block transition-transform group-open:rotate-90">
            ›
          </span>
          Your situation
        </summary>
        <div className="border-t border-[var(--private-line)] px-2.5 py-2">
          <RoleStory story={brief.roleStory} compact />
        </div>
      </details>
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
  dense = false,
  children,
}: {
  title: string;
  note?: string;
  cards: Array<{ id: string; text: string }>;
  sensitive?: boolean;
  /** Rendered under the cards — §8.7's ⚠ line on the sensitive box. */
  caption?: ReactNode;
  /**
   * The briefing rail's spacing: the same box at 12.5px with less padding.
   *
   * IT CHANGES THE PADDING AND THE TYPE SIZE AND NOTHING ELSE. The border,
   * the ground and the heading colour are what rule 6 rests on — which box a
   * participant draws from is the measure, so the two have to read as
   * different kinds of thing at every size. A dense variant that dropped the
   * rose would be a different study in a narrower column.
   */
  dense?: boolean;
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
        "rounded-xl border shadow-2xs transition-all",
        dense ? "mb-2 p-2.5 last:mb-0" : "mb-2.5 p-3 last:mb-0",
        sensitive
          ? "border-rose-300 bg-rose-50 text-rose-950"
          : "border-slate-200 bg-white text-slate-900",
      )}
    >
      <p
        className={cx(
          "mb-1 flex items-center gap-1 font-extrabold uppercase tracking-wide",
          dense ? "text-[0.625rem]" : "text-xs",
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
      <ul className={dense ? "space-y-1.5" : "space-y-2"}>
        {cards.map((card) => (
          <li key={card.id}>
            {children ? (
              children(card)
            ) : (
              <p
                className={cx(
                  "break-words",
                  dense
                    ? "text-[0.78125rem] leading-[1.45]"
                    : "text-xs leading-relaxed sm:text-sm",
                )}
              >
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
  dense = false,
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
  /** The briefing rail's spacing. See `ReasonBox`. */
  dense?: boolean;
}) {
  const cards = task.roleBriefs[role].reasonCards;
  if (!cards.length) return null;
  /* NO WRAPPER CARD AROUND THE TWO BOXES. It was a bordered slate panel
     holding a white box and a rose box, which is three nested surfaces to say
     one thing, and on the private sand ground the outer border added nothing
     the two inner ones do not already say. Rule 6 asks for the two boxes to
     be visibly SEPARATE from each other, which is what their own borders and
     colours do; a container around both works against that, not for it. */
  return (
    <div>
      <ReasonBox
        title="Work reason"
        cards={cards.filter((c) => c.layer === "work")}
        dense={dense}
      >
        {renderCard}
      </ReasonBox>
      <ReasonBox
        title="Sensitive background"
        cards={cards.filter((c) => c.layer === "sensitive")}
        sensitive
        dense={dense}
        /* §8.7: the same one-line notice in both arms. The mandate screen
           passes its own copy under the checkbox, because there the caption
           belongs to a control rather than to the box; everywhere else — the
           briefing panel, the brief phase — it belongs to the box, which is
           what this renders. */
        caption={
          caption ? (
            <SensitiveCaption className={dense ? "mt-2" : "mt-2.5"} />
          ) : null
        }
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
    /* THE RAIL IS WIDER SINCE ROUND SIX: 400px at `lg`, 30rem at `xl`. The
       point sheet inside it is two mini tables side by side, and at 360px
       each column was about 165px, which broke option labels like "4 client
       meetings a month" over three lines and pushed the reason cards down
       past the fold — the thing the rewrite exists to stop. The sticky
       max-height scroll stays as a safety net for a short viewport; the rail
       is sized so nothing has to use it at 1440x900. */
    /* THE WIDER RAIL STARTS AT 1440, NOT AT TAILWIND'S `xl` (1280). Taking
       30rem at 1280 left the task column at 704px, NARROWER than the 791px it
       had one pixel earlier at 400px of rail — so widening the window across
       1280 made the conversation column shrink. `min-[1440px]` is the width
       at which 30rem of rail still leaves the task column at its 800px cap.

       BOTH BREAKPOINTS ARE WRITTEN AS `min-[...]` ON PURPOSE. Mixing `lg:`
       with an arbitrary min-width put Tailwind's own `lg` block AFTER the
       1440 block in the emitted stylesheet, so the wider rail never applied
       and the column silently stayed at 400px. Same variant family, sorted by
       pixel value; `min-[1024px]` is `lg`. The `aside` below keeps `lg:block`
       because that is a different property and nothing competes with it. */
    <div className="grid gap-6 min-[1024px]:grid-cols-[minmax(0,1fr)_400px] min-[1440px]:grid-cols-[minmax(0,1fr)_30rem] min-[1440px]:gap-8">
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
