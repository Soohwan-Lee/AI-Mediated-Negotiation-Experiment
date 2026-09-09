"use client";

/**
 * Practice round (Experimental Design Ver.2.4 §8 step 4).
 *
 * A short neutral scenario that does not overlap with Task A or B, run on the
 * same controls the real tasks use, so nothing in a real task is a surprise.
 * Practice data is kept for comprehension and debugging only and is excluded
 * from the primary analysis.
 *
 * ONE PRACTICE BEFORE EACH TASK, IN THAT TASK'S ARM (PI decision,
 * 2026-09-09). This reverses an earlier simplification, and the reason it was
 * wrong is worth keeping: the single round ran `sessionPlan(assignment, 1)`,
 * so it always rehearsed TASK 1's condition. Since every participant does one
 * Direct task and one Proxy task, whichever arm fell second was met cold —
 * a Proxy-second participant saw the mandate, the watched exchange and RATIFY
 * for the first time inside the task being measured, while a Proxy-first
 * participant had rehearsed all three. That is an interface difference sitting
 * on `Pooled Proxy − Direct`, which is the contrast the whole study makes.
 *
 * The old objection — that the second round rehearsed controls already used —
 * was answering the wrong question. It is true of the SCENARIO and the
 * chrome, which is why round 2 is shorter and says so; it is false of the
 * arm, which is the half that matters.
 *
 * ROUND 2 IS SHORTER, and what it drops is the comprehension item. CHK5 is a
 * check on whether the participant read the points and the situation
 * together, and that is a fact about the person rather than about the
 * interface — asking it twice would measure practice at answering it. Round 2
 * teaches the other arm's controls and nothing else.
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
import { STAGE_MINUTES, nextHref, type FlowKey } from "@/lib/study-config";
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

export function PracticeRound({ taskIndex }: { taskIndex: 1 | 2 }) {
  // The event carries WHICH practice, so the two rounds are separable in the
  // log. They rehearse different arms, so collapsing them would make a
  // Proxy-first and a Proxy-second session look identical here.
  usePageEnter(`practice-${taskIndex}`);
  const isSecond = taskIndex === 2;
  const flowKey: FlowKey = isSecond ? "practice-2" : "practice";

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
  /*
    THE PRACTICE REHEARSES ITS OWN TASK'S ARM. This read `1` unconditionally,
    which is the defect the second round exists to fix — see the file header.
  */
  const plan = assignment ? sessionPlan(assignment, taskIndex) : null;
  const isProxy = plan ? isProxyCondition(plan.condition) : false;
  const task = PRACTICE_TASK;
  const prac1 = practiceReasonItem(role);
  const reasonCorrect = reasonAnswer === PRACTICE_REASON_ANSWER;

  /*
    ROUND 2 DROPS THE COMPREHENSION STEP. CHK5 is asked once, in round 1; see
    the file header for why asking it twice would measure the wrong thing.
    Everything before it is identical, so the two rounds teach the same
    controls in the same order for whichever arm they are rehearsing.
  */
  const allSteps: readonly Step[] = isProxy ? PROXY_STEPS : DIRECT_STEPS;
  const steps: readonly Step[] = isSecond
    ? allSteps.filter((s) => s !== "check")
    : allSteps;
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const stage = STEP_STAGE[step];
  /*
    ROUND 2 ENDS ON ITS ARM'S LAST STEP, not on `check`, which it does not
    have. Derived from the steps array rather than from a step NAME so both
    arms and both rounds fall out of one rule: Direct round 2 finishes on
    `wait`, Proxy round 2 on `decide`.
  */
  const isLastStep = stepIndex >= steps.length - 1;

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
  /*
    `finish` is declared below the effect that needs it, and it closes over
    state the effect must not list as a dependency (re-running the arrival
    effect on every answer change would break its rising-edge rule). A ref
    holding the latest one is the narrow fix: the effect calls whatever
    `finish` is current at the moment the last step completes.
  */
  const finishRef = useRef<() => void>(() => {});

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

    /*
      THE LAST STEP HAS NOWHERE TO ADVANCE TO, and round 2 is the case that
      exposed it. In round 1 the final step is `check`, whose `stepDone` is
      permanently false, so this line could increment unguarded and never run
      off the end. Round 2 drops `check`, so its final step is one that DOES
      complete — `decide` in the Proxy arm, `wait` in the Direct one — and the
      unclamped increment walked `stepIndex` past the array. The bubble read
      "Step 6 of 5", the ring stayed on a control that had already been used,
      and the round could not be finished at all.

      Completing the last step is the participant saying they are done, so it
      finishes the round rather than advancing into nothing.
    */
    const atEnd = stepIndex >= steps.length - 1;
    finishRef.current = finish;
    // Scheduled rather than run in the effect body, the way the sibling
    // effect above already schedules its scroll: the transition is a
    // consequence of the participant's action, not a synchronisation, and
    // setting state synchronously here cascades a render.
    const id = window.setTimeout(() => {
      if (atEnd) {
        if (isSecond) finishRef.current();
        return;
      }
      setStepIndex((index) => (index === stepIndex ? index + 1 : index));
    }, 0);
    return () => window.clearTimeout(id);
    // `finish` is deliberately NOT a dependency. It closes over the
    // comprehension answer and the router, so listing it would re-run this
    // effect on every keystroke — and this effect's whole contract is the
    // rising edge of `done` for one `stepIndex`. Re-running it would make an
    // arrival look like a change and advance the tutorial by itself. The ref
    // above exists to give the timeout the current `finish` without putting
    // it in the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, done, stepIndex, steps.length, isSecond]);

  if (!assignment) {
    return (
      <Page>
        <p className="text-sm text-[var(--ink-2)]">Loading…</p>
      </Page>
    );
  }

  function finish() {
    // Round 2 has no comprehension step, so there is no answer to record and
    // writing an empty PRAC1 would put a blank row beside a real one.
    if (!isSecond) {
      logEvent("comprehension_answer", {
        item: "PRAC1",
        answer: reasonAnswer,
        correct: reasonCorrect,
      });
      void saveResponses("practice", { PRAC1: reasonAnswer });
    }
    logEvent("page_complete", undefined, { page: `practice-${taskIndex}` });
    router.push(nextHref(flowKey));
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
        eyebrow={isSecond ? "Practice round 2" : "Practice round"}
        title={
          isSecond
            ? "The same practice, the other way round"
            : "A quick look at what you'll do"
        }
        doesNotCount
        /*
          EACH ROUND DRAWS THE ARM IT REHEARSES. One shared `practice` scene
          put a two-person conversation above copy saying an AI Proxy
          negotiates for you, which is the wrong picture for whichever round
          it contradicts — and since the two rounds rehearse different arms,
          one scene could only ever be right for one of them.

          What still says "this is practice" is `variant="practice"`: the
          dashed border, the neutral ground and the Tutorial badge, which the
          task covers never get. That is chrome around the scene rather than a
          claim inside it, so the two remain unmistakable while the scene
          stays honest about what the round is about to teach.
        */
        scene={isProxy ? "proxy" : "direct"}
        variant="practice"
        lead={
          /*
            ROUND 2 SAYS WHAT IS THE SAME AND WHAT IS DIFFERENT, in one line.
            The scenario and the controls' chrome are familiar; the way of
            negotiating is not, and that is the only reason this round exists.
            It never names the CONDITION — "you chat yourself" and "an AI
            Proxy speaks for you" describe the interface, which the task
            screens describe anyway, and the condition name is never disclosed
            mid-study.
          */
          <p className="text-slate-700">
            {isSecond ? (
              <>
                Same practice scenario as before, and it still does not count.
                Task {taskIndex} works the other way:{" "}
                {isProxy
                  ? "an AI Proxy negotiates from your instructions, and the decision comes back to you."
                  : "you chat with the other participant yourself."}
              </>
            ) : isProxy ? (
              "In Task 1 an AI Proxy negotiates from your instructions, and the decision comes back to you. Here is a short run through those controls."
            ) : (
              "In Task 1 you chat with the other participant yourself. Here is a short run through those controls."
            )}
          </p>
        }
        steps={
          isProxy
            ? [
                { label: "Read the situation", hint: "Your private briefing is on the right" },
                { label: "Set two goals", hint: "Both terms start at your best option" },
                { label: "Watch the two proxies", hint: "Yours and the other side's" },
                { label: "Make the decision", hint: "Approve, ask for a change, or refuse" },
                ...(isSecond
                  ? []
                  : [{ label: "One quick question", hint: "About points and reasons" }]),
              ]
            : [
                { label: "Read the situation", hint: "Your private briefing is on the right" },
                {
                  label: "Set two goals",
                  hint: "Both terms start at your best option",
                },
                { label: "Send a message", hint: "The message is already typed" },
                ...(isSecond
                  ? []
                  : [{ label: "One quick question", hint: "About points and reasons" }]),
              ]
        }
        minutes={isSecond ? STAGE_MINUTES.practice2 : STAGE_MINUTES.practice}
        note={
          <Callout title="Practice only" tone="neutral">
            <p>
              Nothing here affects your points or your payment. We point at
              each control in turn.
            </p>
          </Callout>
        }
        actionLabel={isSecond ? "Start the short practice" : "Start practice"}
        onStart={() => {
          setPhase("practice");
          goToStep(0);
        }}
        /* `backStep` returns null for `practice-2` — the step before it is
           Task 1's reward and REMARK, which may not be re-entered — and
           `BackButton` renders nothing in that case. Passing the flow key
           rather than a literal keeps that decision in study-config. */
        secondary={<BackButton from={flowKey} />}
      />
    );
  }

  /*
    ROUND 2 HAS NO QUICK CHECK, so its rail must not promise one. The rail is
    the participant's map of the round; a fourth stage that never arrives
    makes the round look unfinished at the moment it ends.
  */
  const progressSteps = [
    "Situation",
    // THE SAME LABEL IN BOTH ARMS, because it is the same act and the same
    // one control (§8.6): both terms arrive at the participant's best option
    // and may be changed. "Build proposal" named the mid-negotiation offer
    // composer instead, which is a different screen with a different rule.
    "Set goals",
    isProxy ? "Watch and decide" : "Try chat",
    ...(isSecond ? [] : ["Quick check"]),
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
      body: "The glowing panel on the right is yours alone. Have a look, then press the button.",
      nextLabel: "I've read it",
      onNext: advance,
    },
    pick: {
      title: "Your goals are already set",
      body: "Both terms start at your best option. Change them or leave them.",
      nextLabel: "Got it",
      onNext: advance,
    },
    share: {
      title: "Try it: the sharing box",
      body: "The work reason always goes across. The one thing you decide is the background box.",
    },
    send: {
      title: "Try it: click Send",
      body: "A practice message is already typed. Press the glowing Send button.",
    },
    watch: {
      title: proxiesFinished ? "That is the exchange" : "Now the two proxies talk",
      body: proxiesFinished
        ? "In the real task this takes a few minutes, and you read it as it happens."
        : "Nothing to press. Yours speaks for you, theirs for them.",
      nextLabel: "Continue",
      onNext: proxiesFinished ? advance : undefined,
    },
    decide: {
      title: "Last, the decision is yours",
      body: "Approve what they reached, ask for a change, or refuse it.",
    },
    /*
      ON ROUND 2 THE REPLY IS THE END OF THE PRACTICE. Round 1 hands `wait`
      straight to the comprehension step, so its bubble needs no button;
      round 2 has nothing after it, and a bubble that only ever says "nothing
      to press" would leave the participant with no visible way on. The button
      appears once the reply has actually landed, so it never invites a press
      while the transcript is still filling.
    */
    wait: {
      title: isProxy ? "Your Proxy is replying…" : "The other side is replying…",
      body:
        isSecond && isLastStep && !pending
          ? "That is the practice round. Press the button to begin the task."
          : "Nothing to press. Replies take a moment in a real task too.",
      nextLabel: `Start Task ${taskIndex}`,
      onNext: isSecond && isLastStep && !pending ? finish : undefined,
    },
    check: {
      title: "Last one, a quick question",
      body: reasonAnswer
        ? "Press the glowing button to check your answer."
        : "Pick an answer in the card below.",
    },
  };

  const coach = COACH[step];

  const actionLabel =
    step === "check"
      ? canContinue
        ? `Start Task ${taskIndex} (Real Session) →`
        : "Check My Answer"
      : isSecond && isLastStep
        ? `Start Task ${taskIndex} (Real Session) →`
        : "Continue";

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

  /*
    THE BAR'S NOTE IS NOT A SECOND COPY OF THE BUBBLE. It said the same
    sentence twice on the same screen, so the note now carries only what the
    bubble cannot: that nothing here counts, and — on the steps where any
    answer is acceptable — that the participant cannot get it wrong. Where the
    bubble already says everything, the note is empty.
  */
  const actionNote = (() => {
    switch (step) {
      case "read":
      case "pick":
        return "Nothing here affects your points or your payment.";
      case "share":
        return "Either way is fine in practice.";
      case "decide":
        return isSecond && isLastStep
          ? `Practice complete. You are ready to begin Task ${taskIndex}.`
          : "Either way is fine in practice.";
      case "send":
        return "";
      case "watch":
        return proxiesFinished ? "" : "Watching. Nothing to press.";
      case "wait":
        return isSecond && isLastStep && !pending
          ? `Practice complete. You are ready to begin Task ${taskIndex}.`
          : "Waiting for the practice reply…";
      case "check":
        return canContinue
          ? `Practice complete. You are ready to begin Task ${taskIndex}.`
          : reasonSubmitted
            ? "Please review your selected answer above."
            : !reasonAnswer
              ? "Select an answer, then check it."
              : "";
    }
  })();

  function handleAction() {
    if (actionDisabled) return;
    if (step === "check") {
      if (canContinue) {
        finish();
        return;
      }
      setReasonSubmitted(true);
      return;
    }
    // Round 2's last step has no `check` after it, so the action that would
    // advance is the one that leaves.
    if (isSecond && isLastStep) {
      finish();
      return;
    }
    advance();
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
          <PhaseStrip current={isSecond ? "practice2" : "practice"} />
          <PageHeader
            eyebrow="Practice · Does not count"
            title="Try the controls"
          />

          <ol
            aria-label="Practice progress"
            // Columns follow the rail's own length: round 2 has three
            // stages, and a four-column grid would leave a gap where the
            // quick check used to be.
            className={cx(
              "mb-3 grid grid-cols-2 gap-2",
              progressSteps.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3",
            )}
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
              {/*
                THE HEADING IS THE REAL SCREEN'S. `PreferenceForm` titles the
                Direct prefs step "Choose your starting goals"; this said
                "Build a Practice Proposal", which names a different act — the
                mid-negotiation offer composer, where a package IS assembled
                and sent. Rehearsing the wrong verb sends the participant
                looking for a control the prefs screen does not have.
              */}
              <CardTitle>Choose your starting goals</CardTitle>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Nothing is sent from this step.
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
                          /*
                            NO `allowNone`, and this is the same one control
                            the real prefs screen gives (§8.6). It carried a
                            "Not specified" chip copied from the OFFER
                            COMPOSER — the mid-negotiation drawer, where a
                            half package is a real and deliberately blocked
                            state. On the prefs screen there is no such
                            option: both terms arrive at the participant's
                            best and may be changed. A tutorial that offered
                            a third state taught a control the participant
                            never meets, and it put an unanswered starting
                            point in front of a screen that is answered by
                            design.
                          */
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
                          : "Press the glowing button below."}
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
