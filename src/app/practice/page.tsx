"use client";

/**
 * Practice round (Experimental Design Ver.2.4 §8 step 4).
 *
 * A short neutral scenario that does not overlap with Task A or B, run on the
 * same controls the real tasks use, so nothing in a real task is a surprise.
 * Practice data is kept for comprehension and debugging only and is excluded
 * from the primary analysis.
 *
 * ONE PRACTICE ROUND, NOT TWO. The old flow put one before each task, which
 * meant the second was a rehearsal of an interface the participant had already
 * used twice — and cost four minutes to teach nothing.
 *
 * PRAC1 IS HERE FOR A REASON. Design §5 adds a payoff–reason check because a
 * participant who reads only the score column will optimize points and ignore
 * the situation, and the situation is what the study is about. It is asked
 * where a correct answer is a REASON rather than a number, so answering it
 * requires having read the two together.
 *
 * ---------------------------------------------------------------------------
 * MICRO-STEPS: one action at a time, hand-held.
 *
 * The tutorial is a sequence of small steps, each of which rings exactly ONE
 * control, puts the coach bubble immediately beside that control, and advances
 * BY ITSELF the moment the action is done. The participant never has to work
 * out what the tutorial wants next, and never has to press Continue to get
 * from one micro-step to the next inside a stage.
 *
 * Two constraints shape everything below and neither may be relaxed:
 *
 *  - ONE RING (interface rule 9). `cueTarget` names, for each micro-step, the
 *    single thing that carries `.cue-ring` / `.cue-ring-private`. Everything
 *    that can be ringed reads that one value rather than deciding for itself,
 *    so two rings cannot coexist by accident.
 *  - A CUE POINTS, IT DOES NOT ANSWER. Every line of coach copy says WHAT to
 *    press and WHERE it is. None says which option, which reason, or which
 *    answer — "pick any option" and "either way is fine" are the shapes that
 *    are allowed. This is the practice round, whose data is excluded, and even
 *    here the copy stays answer-free so the participant does not carry a
 *    suggested habit into a real task.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OptionChips } from "@/components/issues";
import {
  MessageComposer,
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";
import { PhaseStrip } from "@/components/briefing-guide";
import { BriefingPanel, TaskCover, TaskLayout } from "@/components/session";
import { ActionBar, BackButton } from "@/components/study-chrome";
import { Coach, CoachAnchor } from "@/components/tutorial";
import {
  Callout,
  Card,
  CardTitle,
  ChoiceList,
  Page,
  PageHeader,
  cx,
} from "@/components/ui";
import { isProxyCondition, sessionPlan } from "@/lib/assignment";
import { useDevAutofill, useDevBypass } from "@/lib/dev-mode";
import { PRACTICE_REASON_ANSWER, practiceReasonItem } from "@/lib/measures";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { STAGE_MINUTES, nextHref } from "@/lib/study-config";
import { PRACTICE_TASK } from "@/lib/tasks";
import type { Role } from "@/lib/types";
import { bestWish } from "@/app/task/[index]/shared";

/**
 * The message the tutorial types INTO THE COMPOSER FOR THE PARTICIPANT.
 *
 * PRACTICE ONLY, and it may never be copied to a task screen. On /practice the
 * scenario is neutral, there is no reason card to draw from, and the data is
 * excluded from the analysis — so what is being taught is purely "this is the
 * box, this is the send button". On a real task screen a pre-filled message is
 * the study writing the participant's opening: it would put words on the
 * disclosure ladder that the classifier then scores, which is the primary
 * outcome. Nothing in the real flow pre-fills a composer.
 *
 * The text itself is deliberately empty of content: it names no option, no
 * points and no reason, so it cannot model an opening move either.
 */
const PRACTICE_DRAFT =
  "Hi! Here's my opening thought on the arrangement. What matters most on your side?";

/**
 * The two practice reasons, one per box.
 *
 * WRITTEN HERE rather than read off the task, because the practice task
 * carries no reason cards and the issue rationale is already on screen twice
 * (in the goals card and in the briefing rail). A third verbatim copy in the
 * sharing box made the two boxes look like one repeated sentence, which is
 * exactly the collapse interface rule 6 exists to prevent.
 *
 * Both are deliberately mild. The practice scenario is neutral (§8.7, ninth
 * point): a background card written as a real face confession would rehearse
 * the disclosure decision the study measures, on the one round that exists
 * because it has nothing to bias.
 */
const PRACTICE_REASONS: Record<Role, { work: string; background: string }> = {
  leader: {
    work: "The quarterly review is coming up, so when the move happens affects how much settles before it.",
    background:
      "You would rather not say in front of the whole team how far behind the review has left you.",
  },
  member: {
    work: "You are at your desk most of the day, so the printer's spot affects how often you are up and down.",
    background:
      "You would rather not say in front of the whole team how often you are getting up and down.",
  },
};

/**
 * The watched exchange, on the practice scenario.
 *
 * THIRD PERSON, like every real proxy (Ver.2.19): each says "the team lead I
 * represent", never "I" about its principal's situation. If a scripted proxy
 * sounds like the person, the delegation stops being visible, which is the one
 * thing the Proxy arm cannot afford to teach wrong.
 *
 * It names no reason of either kind and reaches a plain split, because the
 * practice scenario is neutral (§8.7, ninth point): a scripted exchange where
 * saying more won more would teach that disclosure pays, on the round that
 * exists precisely because it has no decision to bias.
 */
const PROXY_WATCH_SCRIPT: ReadonlyArray<{
  speaker: DisplayMessage["speaker"];
  text: string;
}> = [
  {
    speaker: "participant_proxy",
    text: "I represent one of the two of you here. On the move week and the printer, my side has a preference on each.",
  },
  {
    speaker: "counterpart_proxy",
    text: "Likewise. The colleague I represent has told me what they are hoping for on both.",
  },
  {
    speaker: "participant_proxy",
    text: "Then let us put one option on each and see where that leaves us.",
  },
  {
    speaker: "counterpart_proxy",
    text: "Agreed. That is a package we can both take back.",
  },
];

/**
 * The micro-steps, in order, per branch.
 *
 * `read` / `pick` / `send` / … are ids rather than numbers so that inserting
 * one does not renumber every comparison in the file. The step counter shown
 * in the bubble is the index in this list, so it always matches what the
 * participant is actually doing.
 */
/**
 * FIVE STEPS DIRECT, SIX PROXY, and the cuts are deliberate.
 *
 * The tutorial used to walk the two terms as two separate micro-steps
 * (`pick1`, `pick2`) and then stop on a `done` step whose only content was
 * "that was the exchange". Both were teaching the same control twice: a
 * participant who has picked an option on one term does not need to be told
 * where the buttons are on the other, and a step whose action is pressing
 * Continue is a page of reading, not practice.
 *
 * `pick` now covers both terms and finishes when both are set; the reply
 * arriving finishes `wait`, which then hands straight to the check. The feel
 * to aim for is "have a quick look at what you'll do", not a lesson.
 */
const DIRECT_STEPS = ["read", "pick", "send", "wait", "check"] as const;

/**
 * THE REHEARSAL STEP IS GONE. Ver.2.24 removes the "ask your proxy a question
 * before it runs" screen from the real Proxy task, so a tutorial that taught
 * it would rehearse a control the participant never meets — and would spend
 * two of six steps doing it. What replaced it is what the real task actually
 * does after the mandate: the two proxies negotiate while you watch, and then
 * the decision comes back to you.
 */
const PROXY_STEPS = [
  "read",
  "pick",
  "share",
  "watch",
  "decide",
  "check",
] as const;

type Step = (typeof DIRECT_STEPS)[number] | (typeof PROXY_STEPS)[number];

/**
 * Which stage of the four-part progress rail each micro-step belongs to. The
 * rail is the participant's map of the whole round; the micro-steps are the
 * turn-by-turn directions inside it.
 */
/**
 * Cue targets whose bubble is rendered NEXT TO THE CONTROL rather than at the
 * top of the column, because the control is far enough down the card that a
 * bubble at the top would point at the card's header instead of the thing to
 * press. The column-top bubble is suppressed for exactly these, so there is
 * never a second bubble on the screen.
 */
const BUBBLE_IN_PLACE: ReadonlySet<string | null> = new Set([
  "share",
  "composer",
  "decision",
  "checkAnswer",
]);

const STEP_STAGE: Record<Step, 1 | 2 | 3 | 4> = {
  read: 1,
  pick: 2,
  share: 2,
  send: 3,
  wait: 3,
  watch: 3,
  decide: 3,
  check: 4,
};

export default function PracticePage() {
  usePageEnter("practice");

  const router = useRouter();
  const [phase, setPhase] = useState<"intro" | "practice">("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const { assignment, logEvent, saveResponses } = useParticipant();

  // Direct practice states
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [offerEdits, setOfferEdits] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState(PRACTICE_DRAFT);

  // Proxy practice states
  //
  // THE GOALS DEFAULT TO BEST-ON-BOTH, like the real wish screen (§8.6). They
  // used to start empty, so the practice round's first act was choosing from
  // nothing while the real task opens already answered — teaching a starting
  // state the participant never meets again. `bestWish` is the same function
  // the real screen uses, so the two cannot drift.
  const [proxyEdits, setProxyEdits] = useState<Record<string, string>>({});
  // The one tickable box, and it starts UNTICKED like the real mandate's
  // sensitive card (§8.7: work on, sensitive off). `touched` is what finishes
  // the step, in either direction — a tutorial that only advanced on a tick
  // would be teaching disclosure as the completed answer.
  const [proxyBackgroundChecked, setProxyBackgroundChecked] = useState(false);
  const [proxyReasonTouched, setProxyReasonTouched] = useState(false);
  const [proxyWatchMessages, setProxyWatchMessages] = useState<DisplayMessage[]>([]);
  const [proxyWatchPending, setProxyWatchPending] = useState(false);
  const [proxyDecision, setProxyDecision] = useState<string | null>(null);

  // Comprehension check states
  const [reasonAnswer, setReasonAnswer] = useState("");
  const [reasonSubmitted, setReasonSubmitted] = useState(false);
  const bypass = useDevBypass();

  const role = assignment?.role ?? "leader";

  /**
   * BOTH TERMS START AT THE PARTICIPANT'S OWN BEST OPTION (§8.6).
   *
   * The real wish screen defaults that way, so the practice round has to as
   * well, or it teaches a starting state the participant never meets again.
   *
   * DERIVED, NOT SEEDED. `assignment` arrives a render late and option order
   * is role-relative, so a lazy initializer would fill the boxes with the
   * OTHER side's best option, and an effect that corrected it afterwards is a
   * setState cascade the linter rightly refuses. Reading the default at render
   * time is both correct on the first paint and impossible to get out of step:
   * the state below holds only what the participant has actually changed.
   */
  const defaultGoals = bestWish(PRACTICE_TASK, role);
  /** The default, with whatever the participant has changed laid over it. */
  const offer = { ...defaultGoals, ...offerEdits };
  const proxyPreferred = { ...defaultGoals, ...proxyEdits };
  const plan = assignment ? sessionPlan(assignment, 1) : null;
  const isProxy = plan ? isProxyCondition(plan.condition) : false;
  const task = PRACTICE_TASK;
  const prac1 = practiceReasonItem(role);
  const reasonCorrect = reasonAnswer === PRACTICE_REASON_ANSWER;

  const steps: readonly Step[] = isProxy ? PROXY_STEPS : DIRECT_STEPS;
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const stage = STEP_STAGE[step];

  useDevAutofill(() => {
    // The goals fill themselves now: both terms are derived from `bestWish`
    // and only edits are stored, so there is nothing here to pre-answer.
    setDraft(PRACTICE_DRAFT);
    setProxyBackgroundChecked(false);
    setProxyReasonTouched(true);
    setProxyDecision((cur) => cur ?? "approve");
    setReasonAnswer(PRACTICE_REASON_ANSWER);
    // The key carries the micro-step, not just the phase: the whole tutorial
    // is one component, so without it the filler runs once and every later
    // micro-step arrives empty (see `useDevAutofill`'s own note).
  }, `practice-${phase}-${step}`);

  /**
   * AUTO-ADVANCE, and why it needs a latch.
   *
   * Each micro-step names the condition that finishes it; when that becomes
   * true the tutorial moves on by itself, so nothing inside a stage needs a
   * Continue press.
   *
   * The trap is BACK. Every completion condition is a property of the
   * participant's own state — a term is picked, a message was sent — and those
   * stay true after the step is left. Stepping back onto a finished step would
   * therefore bounce straight forward again, and Back would look broken.
   *
   * So the step advances only on a RISING EDGE — the condition must have been
   * FALSE on this same step a render ago. Arriving on an already-finished step
   * is not an edge, so the tutorial stays there and the participant sees the
   * step they asked for; the action bar's Continue is how they leave it again.
   */
  const arrivedSatisfiedAt = useRef<{ index: number; done: boolean } | null>(
    null,
  );

  const participantSpoke = messages.some((m) => m.speaker === "participant");
  const replyArrived = messages.some((m) => m.speaker === "counterpart");
  /** The watched exchange has run to its end. */
  const proxiesFinished = proxyWatchMessages.length >= PROXY_WATCH_SCRIPT.length;

  const stepDone: Record<Step, boolean> = {
    read: false, // reading has no action; its bubble carries the button
    /**
     * ENDS ON ITS OWN BUTTON, not on a pick, because both terms ARRIVE
     * answered (§8.6's best-on-both default, seeded above). A completion
     * condition of "both are set" would be true the moment the step opened
     * and the tutorial would skip straight past the goals card.
     *
     * What the step teaches is therefore the real thing: these are already
     * set to your best on each term, and you may change them. It must not
     * require a change — departing from the default is `WISH-DEV`, an
     * outcome, and a tutorial that made changing them the way forward would
     * inflate it.
     */
    pick: false,
    share: proxyReasonTouched,
    send: participantSpoke,
    wait: replyArrived,
    // Watching is not an action, so the step ends when the exchange does.
    watch: proxiesFinished,
    // Any of the three decisions finishes it, and the tutorial must not prefer
    // one: which of approve / change / refuse a participant picks is `RATIFY`,
    // a confirmatory measure (§9.3).
    decide: proxyDecision !== null,
    check: false, // ends on Check My Answer / Start Task 1
  };

  const done = stepDone[step];

  /**
   * Play the watched exchange, one message at a time.
   *
   * Paced rather than dumped, because in the real task this is minutes of
   * reading and the point of the step is that watching is what you do. Guarded
   * against a double start so a second press cannot interleave two runs.
   */
  async function playProxyExchange() {
    if (proxyWatchPending || proxyWatchMessages.length) return;
    // The first await comes BEFORE any setState, so starting this from the
    // step-change effect schedules the updates rather than running them
    // synchronously inside it.
    await new Promise((r) => setTimeout(r, 400));
    setProxyWatchPending(true);
    for (let i = 0; i < PROXY_WATCH_SCRIPT.length; i += 1) {
      await new Promise((r) => setTimeout(r, i === 0 ? 300 : 1100));
      const line = PROXY_WATCH_SCRIPT[i];
      setProxyWatchMessages((m) => [
        ...m,
        { id: `pw${i}`, speaker: line.speaker, text: line.text },
      ]);
    }
    setProxyWatchPending(false);
  }

  /**
   * Bring the step's ringed control into view.
   *
   * Without this the tutorial can point at something below the fold: the two
   * composers and the sharing box sit at the bottom of a tall card, so a
   * participant told to "press the glowing button" would be looking at a
   * screen with no glowing button on it. Scrolling to the top of the page —
   * which is what the coarse-step version did — makes that worse rather than
   * better on exactly those steps.
   *
   * It reads the DOM rather than a ref because the ring's owner changes with
   * the step, and `cueTarget` already decides which single element carries it.
   * `wait` has no ring, so nothing moves — correct: nothing is waiting on the
   * participant there.
   */
  useEffect(() => {
    if (phase !== "practice") return;
    const id = window.setTimeout(() => {
      // THE WATCHED EXCHANGE STARTS ITSELF when its step opens, because
      // watching is not something the participant presses for. It runs inside
      // this timeout rather than in the effect body so the state updates are
      // scheduled rather than synchronous, and it guards its own double start
      // so arriving on the step twice replays nothing.
      if (step === "watch") void playProxyExchange();
      const ringed = document.querySelector(".cue-ring, .cue-ring-private");
      (ringed ?? document.querySelector('[aria-live="polite"]'))?.scrollIntoView(
        { behavior: "smooth", block: "center" },
      );
    }, 60);
    return () => window.clearTimeout(id);
    // `playExchangeRef` is a ref and `step` is derived from `stepIndex`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex]);

  useEffect(() => {
    if (phase !== "practice") return;

    const previous = arrivedSatisfiedAt.current;
    // Remember, for the NEXT run, what this step's completion looked like on
    // this one. Keyed by index so a Back press onto a different step reads as
    // an arrival rather than as a change.
    arrivedSatisfiedAt.current = { index: stepIndex, done };

    if (!done) return;
    // Rising edge only: the same step must have been unfinished a moment ago.
    // An arrival on an already-finished step (Back) is not an edge, so the
    // tutorial stays put and the participant sees the step they asked for.
    if (previous?.index !== stepIndex || previous.done) return;

    setStepIndex((index) => (index === stepIndex ? index + 1 : index));
  }, [phase, done, stepIndex]);

  if (!assignment) {
    return (
      <Page>
        <p className="text-sm text-[var(--ink-2)]">Loading…</p>
      </Page>
    );
  }

  function finish() {
    logEvent("comprehension_answer", {
      item: "PRAC1",
      answer: reasonAnswer,
      correct: reasonCorrect,
    });
    void saveResponses("practice", { PRAC1: reasonAnswer });
    logEvent("page_complete", undefined, { page: "practice" });
    router.push(nextHref("practice"));
  }

  async function sendPractice(text: string) {
    setMessages((m) => [
      ...m,
      { id: `p${m.length}`, speaker: "participant", text },
    ]);
    setPending(true);
    await new Promise((r) => setTimeout(r, 1000));
    setMessages((m) => [
      ...m,
      {
        id: `c${m.length}`,
        speaker: "counterpart",
        text: "Thanks for the proposal! In this practice round, you can see how messages and offers update in real time.",
      },
    ]);
    setPending(false);
  }

  /**
   * THE SINGLE RING (interface rule 9).
   *
   * Exactly one target per micro-step, and every ring-able element in the tree
   * below asks this rather than deciding for itself. `null` means nothing on
   * the screen is waiting to be pressed — the `wait` step, where the only
   * thing to do is let a reply arrive.
   *
   * `briefing` is the sand rail, so its ring is the private one; the rest are
   * shared surfaces and take the blue one, except the proxy mandate card,
   * which is private too.
   */
  type CueTarget =
    | "briefing"
    | "share"
    | "composer"
    | "coach"
    | "decision"
    | "question"
    | "checkAnswer"
    | null;

  const cueTarget: CueTarget = (() => {
    switch (step) {
      case "read":
        return "briefing";
      case "pick":
        // The ring goes on the coach's own button. Both terms arrive answered,
        // so there is no empty control to point at, and ringing one of the two
        // term boxes would read as "change this one" — a cue suggesting an
        // answer on a value that is itself recorded (`WISH-DEV`).
        return "coach";
      case "share":
        return "share";
      case "send":
        return "composer";
      case "wait":
        return null;
      case "watch":
        // Nothing to press while the two proxies talk, exactly as in the real
        // task. The bubble's button appears only once they have finished.
        return proxiesFinished ? "coach" : null;
      case "decide":
        return "decision";
      case "check":
        // Before an answer is chosen the question card is what is waiting;
        // after it, the button that checks it. Never both.
        return reasonAnswer ? "checkAnswer" : "question";
    }
  })();

  const canContinue = bypass || (reasonSubmitted && reasonCorrect);

  function goToStep(index: number) {
    // No scroll here: the effect above brings the new step's RINGED CONTROL
    // into view, which is the thing the participant needs to see. Scrolling to
    // the top of the page instead would hide the composer and the sharing box.
    setStepIndex(Math.max(0, Math.min(index, steps.length - 1)));
  }

  function advance() {
    goToStep(stepIndex + 1);
  }

  function goBack() {
    if (stepIndex === 0) {
      setPhase("intro");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    goToStep(stepIndex - 1);
  }

  if (phase === "intro") {
    return (
      <TaskCover
        eyebrow="Practice · Does not count"
        title="A quick look at what you'll do"
        doesNotCount
        /* The practice scene, not the arm's own: this cover must read as
           practice at a glance, and drawing the Direct/Proxy interface here
           would make the practice cover look like a task cover. `CoverScene`
           gained "practice" from the task-screens stream. */
        scene="practice"
        lead={
          <p className="text-slate-700">
            {isProxy
              ? "In Task 1 an AI Proxy negotiates from your instructions, and the decision comes back to you. Here is a short run through those controls."
              : "In Task 1 you chat with the other participant yourself. Here is a short run through those controls."}
          </p>
        }
        steps={
          isProxy
            ? [
                { label: "Read the situation", hint: "Your private briefing is on the right" },
                { label: "Set two goals", hint: "Both terms start at your best option" },
                { label: "Watch the two proxies", hint: "Yours and the other side's" },
                { label: "Make the decision", hint: "Approve, ask for a change, or refuse" },
                { label: "One quick question", hint: "About points and reasons" },
              ]
            : [
                { label: "Read the situation", hint: "Your private briefing is on the right" },
                { label: "Build a proposal", hint: "One option on each term" },
                { label: "Send a message", hint: "The message is already typed" },
                { label: "One quick question", hint: "About points and reasons" },
              ]
        }
        minutes={STAGE_MINUTES.practice}
        note={
          <Callout title="Practice only" tone="neutral">
            <p>
              <strong>Nothing here affects your points or your payment.</strong>{" "}
              We point at each control in turn. Take as long as you like.
            </p>
          </Callout>
        }
        actionLabel="Start practice"
        onStart={() => {
          setPhase("practice");
          goToStep(0);
        }}
        secondary={<BackButton from="practice" />}
      />
    );
  }

  const progressSteps = [
    "Situation",
    isProxy ? "Set goals" : "Build proposal",
    isProxy ? "Watch and decide" : "Try chat",
    "Quick check",
  ];


  /**
   * What each micro-step's bubble says.
   *
   * Every one names a control and where it is. None names an option, a reason
   * or an answer. `share` in particular says "either way is fine", because the
   * whole study is about which box a participant draws from and a tutorial
   * that recommended one would be teaching the outcome.
   */
  const COACH: Record<
    Step,
    { title: string; body: string; nextLabel?: string; onNext?: () => void }
  > = {
    read: {
      title: "Start with your briefing",
      body: "It is the glowing panel on the right, and only you can see it. Have a look, then press the button.",
      nextLabel: "I've read it",
      onNext: advance,
    },
    pick: {
      title: "Your goals are already set",
      body: `Both terms start at your best option. Change them if you like, or leave them as they are.`,
      nextLabel: "Got it",
      onNext: advance,
    },
    share: {
      title: "Try it: the sharing box",
      body: "The work reason always goes across. The one thing to decide is the background box. Tick it or leave it.",
    },
    send: {
      title: "Try it: click Send",
      body: "We have typed a practice message for you. Just press the glowing Send button.",
    },
    watch: {
      title: proxiesFinished ? "That is the exchange" : "Now the two proxies talk",
      body: proxiesFinished
        ? "In the real task this part takes a few minutes. You read it as it happens."
        : "Nothing to press. Yours speaks for you, and the other side's speaks for them.",
      nextLabel: "Continue",
      onNext: proxiesFinished ? advance : undefined,
    },
    decide: {
      title: "Last, the decision is yours",
      body: "Approve what they reached, ask for a change, or refuse it. Any of the three is fine here.",
    },
    wait: {
      title: isProxy ? "Your Proxy is replying…" : "The other side is replying…",
      body: "Nothing to press. Replies take a moment in a real task too.",
    },
    check: {
      title: "Last one, a quick question",
      body: reasonAnswer
        ? "Press the glowing button to check your answer."
        : "Pick an answer in the card below. Your briefing stays on the right.",
    },
  };

  const coach = COACH[step];

  const actionLabel =
    step !== "check"
      ? "Continue"
      : canContinue
        ? "Start Task 1 (Real Session) →"
        : "Check My Answer";

  /**
   * The action bar exists for the last step and for the dev bypass. Everything
   * before `check` advances on the action itself, so the bar's button is a
   * fallback rather than the route through the tutorial — it is disabled while
   * the micro-step is still waiting, which is what keeps the bubble's own
   * instruction the only live thing on the screen.
   */
  /**
   * The bar is a MIRROR of the bubble's button, never a way past a step.
   *
   * `read` and `pick` end on the bubble's own button rather than on an action,
   * so the bar is live on them too and does the same thing. Every other step
   * stays disabled until its own condition is met — including `decide`, which
   * was skippable for a moment: the bar was enabled before any of the three
   * decisions had been taken, so a participant could Continue past the one
   * control the step exists to show them.
   */
  const endsOnItsOwnButton = step === "read" || step === "pick";

  const actionDisabled =
    step === "check"
      ? !canContinue && !reasonAnswer
      : !bypass && !stepDone[step] && !endsOnItsOwnButton;

  const actionNote = (() => {
    switch (step) {
      case "read":
        return "Nothing here affects your task points or payment.";
      case "pick":
        return "Both terms already start at your best option.";
      case "share":
        return "Tick or untick the sharing box. Either is fine in practice.";
      case "send":
        return "The message is already written. Press the glowing button.";
      case "watch":
        return proxiesFinished
          ? "The two proxies have finished."
          : "Watching. Nothing to press.";
      case "decide":
        return "Approve, ask for a change, or refuse. Any is fine in practice.";
      case "wait":
        return "Waiting for the practice reply…";
      case "check":
        return canContinue
          ? "Practice complete. You are ready to begin Task 1."
          : reasonSubmitted
            ? "Please review your selected answer above."
            : !reasonAnswer
              ? "Select an answer, then check it."
              : "";
    }
  })();

  function handleAction() {
    if (actionDisabled) return;
    if (step !== "check") {
      advance();
      return;
    }
    if (canContinue) {
      finish();
      return;
    }
    setReasonSubmitted(true);
  }

  /** The coach bubble for the current step, rendered wherever it belongs. */
  const coachBubble = (point: "down" | "right" | "up", compact = false) => (
    <Coach
      step={stepIndex + 1}
      total={steps.length}
      title={coach.title}
      point={point}
      compact={compact}
      waiting={step === "wait"}
      onNext={coach.onNext}
      nextLabel={coach.nextLabel}
      // Set where the thing to press IS this bubble's own button — the goals
      // step, whose card arrives already answered, and the watched exchange.
      // Still one ring: the caller rings no control on those steps.
      nextCue={cueTarget === "coach"}
    >
      <p>{coach.body}</p>
    </Coach>
  );

  // The two picking micro-steps and (in the Proxy branch) the sharing one all
  // render the same card, so the card is shown for any of them.
  const showChoices = stage === 2;
  const showExchange = stage === 3;

  return (
    <>
      <Page width="wide">
        <TaskLayout
          briefing={
            // The `read` micro-step points at the briefing, so the screen's one
            // ring goes here — the panel IS the control that step asks the
            // participant to use. The wrapper carries no colour of its own: it
            // is a transparent border that the ring paints, so the panel's own
            // sand surface still says the contents are private (rule 1). Every
            // later step drops it, because the ring moves with `cueTarget` and
            // there is only ever one.
            //
            // `TaskLayout` renders this node twice — the `lg` rail and the
            // mobile drawer — but only one is ever ON SCREEN (the rail is
            // `hidden lg:block`, the drawer `lg:hidden` and only mounted when
            // opened), so the participant never sees two rings.
            <div
              className={cx(
                "rounded-2xl border border-transparent",
                // The rail is a private (sand) surface, so its ring is the
                // private one (rule 1: the ring colour must not contradict the
                // card it sits on).
                cueTarget === "briefing" ? "cue-ring-private" : "",
              )}
            >
              <BriefingPanel task={task} role={role} />
            </div>
          }
        >
          {/* The strip repeats here because the practice round is the one
              phase a participant could mistake for a task that scores, and it
              is the phase they are IN while reading this. */}
          <PhaseStrip current="practice" />
          <PageHeader
            eyebrow="Practice · Does not count"
            title="Try the controls"
          />

          <ol
            aria-label="Practice progress"
            className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {progressSteps.map((label, index) => {
              const number = index + 1;
              const complete = number < stage;
              const current = number === stage;
              return (
                <li
                  key={label}
                  aria-current={current ? "step" : undefined}
                  className={cx(
                    "rounded-xl border px-3 py-1.5 text-sm font-bold",
                    complete
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : current
                        ? "border-blue-300 bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-white text-slate-400",
                  )}
                >
                  {complete ? `✓ ${number}` : number}. {label}
                </li>
              );
            })}
          </ol>

          {/*
            The bubble and the control it points at are one unit. On the steps
            whose control is at the top of the column (or, at `read`, in the
            rail beside it) the bubble sits here. On the second term and on `share` it is
            rendered INSIDE the card, immediately above the box it points at,
            so the tail always lands on the thing being talked about.
          */}
          {BUBBLE_IN_PLACE.has(cueTarget) ? null : (
            <CoachAnchor>
              {coachBubble(cueTarget === "briefing" ? "right" : "down")}
            </CoachAnchor>
          )}

          {stage === 1 ? (
            <Card className="mb-6 border-blue-300 bg-white p-4" padded={false}>
              <CardTitle>
                The Practice Situation: {task.title.replace(/^Practice — /, "")}
              </CardTitle>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                {task.publicBrief}
              </p>
              {/*
                This step's ring lives on the briefing panel above — the panel
                IS the control — so this card carries none.
              */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                Your private points and workplace context are in the side panel.
                You will use both in the next steps.
              </div>
            </Card>
          ) : null}

          {showChoices && isProxy ? (
            <Card
              tone="private"
              className="mb-6 border-amber-300 p-4"
              padded={false}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Set Your Practice Goals</CardTitle>
                <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-950">
                  Private · only you and your Proxy
                </span>
              </div>
              <p className="text-sm leading-relaxed text-[var(--private-ink)]">
                Your Proxy starts from these goals. Any package it reaches later
                comes back to you for a decision.
              </p>
              <div className="mt-4 space-y-4">
                {task.issues.map((issue) => (
                  <div key={issue.id}>
                    <div
                      className={cx(
                        "rounded-xl border border-slate-200 bg-slate-50/70 p-3.5",
                        // ONE ring on the screen (rule 9), owned by `cueTarget`.
                        // It marks WHERE to press and says nothing about which
                        // chip inside it to choose.

                      )}
                    >
                      <p className="text-sm font-bold text-slate-900">{issue.label}</p>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
                        {issue.rationale[role]}
                      </p>
                      <div className="mt-2">
                        <OptionChips
                          issue={issue}
                          role={role}
                          name={`practice-proxy-pref-${issue.id}`}
                          value={proxyPreferred[issue.id] ?? null}
                          onChange={(value) =>
                            setProxyEdits((previous) => ({
                              ...previous,
                              [issue.id]: value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {cueTarget === "share" ? (
                <div className="mt-4">
                  <CoachAnchor>{coachBubble("down", true)}</CoachAnchor>
                </div>
              ) : null}

              {/*
                THE SHAPE OF THE REAL MANDATE, on practice text (§8.7). Two
                boxes: the work reason ticked and LOCKED with the label that
                says so, and ONE tickable background box. It used to be a
                single tickable box labelled "Practice workplace reason",
                which taught the wrong control entirely — the participant
                arrived at the real mandate having practised unticking the one
                thing that is never theirs to untick, and having never met the
                one decision that is.

                The ring goes on the TICKABLE box only. The locked one is not
                waiting for anything (rule 9), and both states of the tickable
                one are labelled so that ticking does not read as the finished
                answer.
              */}
              <div
                className={cx(
                  "mt-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3",
                )}
              >
                <p className="mb-2 text-[0.6875rem] font-extrabold uppercase tracking-[0.09em] text-slate-500">
                  Work reason
                </p>
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 shadow-2xs">
                  <input
                    type="checkbox"
                    checked
                    disabled
                    readOnly
                    aria-label="Practice work reason, always shared"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-slate-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[0.6875rem] font-bold text-slate-700">
                      <span aria-hidden>🔓</span>
                      Always shared
                    </span>
                    <span className="block text-xs sm:text-sm leading-relaxed text-slate-800 font-medium">
                      {PRACTICE_REASONS[role].work}
                    </span>
                  </span>
                </div>

                <p className="mb-2 mt-4 text-[0.6875rem] font-extrabold uppercase tracking-[0.09em] text-rose-700">
                  Practice background
                </p>
                <label
                  className={cx(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 shadow-2xs transition-all",
                    proxyBackgroundChecked
                      ? "border-rose-400 bg-white text-rose-950 ring-2 ring-rose-400/20"
                      : "border-rose-200 bg-white/70 hover:border-rose-300",
                    cueTarget === "share" ? "cue-ring-private" : "",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={proxyBackgroundChecked}
                    onChange={(event) => {
                      setProxyBackgroundChecked(event.target.checked);
                      // Either direction finishes the step. The tutorial must
                      // not reward one setting over the other: which box a
                      // participant is willing to draw from is the measure,
                      // and a practice round that nudged it would be teaching
                      // the outcome.
                      setProxyReasonTouched(true);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-rose-300 text-rose-600 accent-rose-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx(
                        "mb-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-bold",
                        proxyBackgroundChecked
                          ? "border-rose-300 bg-rose-50 text-rose-800"
                          : "border-slate-200 bg-slate-50 text-slate-600",
                      )}
                    >
                      <span aria-hidden>{proxyBackgroundChecked ? "🤖" : "🚫"}</span>
                      {proxyBackgroundChecked
                        ? "Your proxy may share this"
                        : "Your proxy will not share this"}
                    </span>
                    <span className="block text-xs sm:text-sm leading-relaxed text-slate-800 font-medium">
                      {PRACTICE_REASONS[role].background}
                    </span>
                  </span>
                </label>
              </div>
            </Card>
          ) : null}

          {showChoices && !isProxy ? (
            <Card className="mb-6 border-blue-300 bg-white p-4" padded={false}>
              <CardTitle>Build a Practice Proposal</CardTitle>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                These selections prepare a draft package. Nothing is sent from
                this step.
              </p>
              <div className="mt-4 space-y-4">
                {task.issues.map((issue) => (
                  <div key={issue.id}>
                    <div
                      className={cx(
                        "rounded-xl border border-slate-200 bg-slate-50/70 p-3.5",

                      )}
                    >
                      <p className="text-sm font-bold text-slate-900">{issue.label}</p>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
                        {issue.rationale[role]}
                      </p>
                      <div className="mt-2">
                        <OptionChips
                          issue={issue}
                          role={role}
                          name={`practice-${issue.id}`}
                          value={offer[issue.id] ?? null}
                          onChange={(value) =>
                            setOfferEdits((previous) => ({
                              ...previous,
                              [issue.id]: value,
                            }))
                          }
                          allowNone
                          noneLabel="Not specified"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {showExchange && isProxy ? (
            <>
              {/* WATCHING, not rehearsing. Ver.2.24 removes the "ask your
                  proxy before it runs" screen from the real task, so this is
                  the shape the participant actually meets: the two proxies
                  talk, and then the decision comes back. The transcript is a
                  SHARED surface (rule 1) because both sides can see it. */}
              <Card
                className="mb-6 flex flex-col overflow-hidden border-blue-300 bg-white"
                padded={false}
              >
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                  <p className="text-base font-bold text-slate-900">
                    The Two AI Proxies
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    Yours speaks for you. Theirs speaks for the other side.
                  </p>
                </div>
                <Transcript
                  messages={proxyWatchMessages}
                  pending={proxyWatchPending}
                  pendingSpeaker="participant_proxy"
                  emptyHint="The practice exchange is about to start."
                />
              </Card>

              {step === "decide" ? (
                <>
                  <CoachAnchor>{coachBubble("down", true)}</CoachAnchor>
                  <Card
                    className={cx(
                      "mb-6 p-4",
                      cueTarget === "decision" ? "cue-ring" : "",
                    )}
                    padded={false}
                  >
                    <CardTitle>What would you like to do?</CardTitle>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Nothing is settled until you choose.
                    </p>
                    {/* THE THREE CARRY EQUAL WEIGHT (§7). None is
                        pre-selected, none is styled as the recommended one,
                        and the copy suggests nothing — the distribution
                        across the three is `RATIFY`, a confirmatory
                        measure. */}
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {[
                        ["approve", "Approve it"],
                        ["change", "Ask for a change"],
                        ["refuse", "Refuse it"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setProxyDecision(value)}
                          className={cx(
                            "rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors",
                            proxyDecision === value
                              ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {proxyDecision ? (
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">
                        In the real task, approving finishes it. Asking for a
                        change or refusing opens a short chat with the other
                        participant.
                      </p>
                    ) : null}
                  </Card>
                </>
              ) : null}
            </>
          ) : null}

          {showExchange && !isProxy ? (
            <Card
              className="mb-6 flex flex-col overflow-hidden border-blue-300 bg-white"
              padded={false}
            >
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                <p className="text-base font-bold text-slate-900">
                  Send a Practice Message
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                  This sandbox returns a fixed sample reply.
                </p>
              </div>
              <Transcript
                messages={messages}
                pending={pending}
                emptyHint="The practice message is already typed below. Just press Send."
              />
              {/* Same as the Proxy branch above: adjacent to the composer, not
                  at the top of the card. */}
              {cueTarget === "composer" ? (
                <div className="border-t border-slate-200 bg-white px-3.5 pt-3.5 sm:px-4">
                  <CoachAnchor className="-mb-2">
                    {coachBubble("down", true)}
                  </CoachAnchor>
                </div>
              ) : null}
              <MessageComposer
                value={draft}
                onChange={setDraft}
                onSend={(text) => {
                  setDraft("");
                  void sendPractice(text);
                }}
                disabled={pending}
                placeholder="Type a practice message…"
                cueSend={cueTarget === "composer"}
              />
            </Card>
          ) : null}

          {stage === 4 ? (
            <Card
              id={`q-${prac1.id}`}
              className={cx(
                "mb-6 border-blue-300 bg-white p-4",
                reasonSubmitted && reasonCorrect
                  ? "border-emerald-300 bg-emerald-50/20"
                  : "",
                // Marks that an answer is expected, never which one (rule 9),
                // and comes off the moment one is selected — at which point
                // the ring moves to the button that checks it.
                cueTarget === "question" ? "cue-ring" : "",
              )}
              padded={false}
            >
              <CardTitle>Check Your Understanding</CardTitle>
              <p className="my-3 text-sm font-bold text-slate-900">{prac1.text}</p>
              {prac1.kind === "choice" ? (
                <ChoiceList
                  name={prac1.id}
                  value={reasonAnswer}
                  onChange={(value) => {
                    setReasonAnswer(value);
                    setReasonSubmitted(false);
                  }}
                  options={prac1.options}
                />
              ) : null}
              {reasonSubmitted && !reasonCorrect ? (
                <div className="mt-3">
                  <Callout title="Helpful hint" tone="warning">
                    <p className="text-xs sm:text-sm">
                      Points show how valuable an option is in the scenario. The
                      briefing explains the workplace reason behind that value.
                    </p>
                  </Callout>
                </div>
              ) : null}

              {/*
                The last micro-step's control is the action bar's own button,
                which is shared chrome and takes no ring. So the bubble renders
                a copy of it here, right under the question, and that copy
                carries the screen's one ring. Pressing either does the same
                thing.
              */}
              {cueTarget === "checkAnswer" ? (
                <div className="mt-4">
                  <CoachAnchor>
                    <Coach
                      step={stepIndex + 1}
                      total={steps.length}
                      title={
                        canContinue
                          ? "Correct, you are ready"
                          : "Now check your answer"
                      }
                      // NOT `point="up"`. Geometrically the bubble sits below
                      // the options, but a tail pointing up would land on the
                      // LAST option and read as a nod towards that answer —
                      // rule 9 forbids a cue that suggests one. The button
                      // being pointed at is inside the bubble, so no tail is
                      // the honest rendering.
                      point="none"
                      compact
                      onNext={handleAction}
                      nextLabel={actionLabel.replace(/\s*→$/, "")}
                      nextCue
                    >
                      <p>
                        {canContinue
                          ? "That is the whole practice round. Press the button to begin Task 1."
                          : "Press the glowing button below. The same button is at the bottom of the screen."}
                      </p>
                    </Coach>
                  </CoachAnchor>
                </div>
              ) : null}
            </Card>
          ) : null}
        </TaskLayout>
      </Page>

      <ActionBar
        label={actionLabel}
        onClick={handleAction}
        disabled={actionDisabled}
        note={actionNote}
        secondary={
          <button
            type="button"
            onClick={goBack}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            ← Back
          </button>
        }
      />
    </>
  );
}
