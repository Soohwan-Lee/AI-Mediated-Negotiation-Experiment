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
import { PRACTICE_TASK, requirementIssue } from "@/lib/tasks";

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
  "Hi! Here's my opening thought on the arrangement — what matters most on your side?";

/** Same, for the Proxy branch's rehearsal box. */
const PRACTICE_PROXY_DRAFT = "What will you open with?";

/**
 * The micro-steps, in order, per branch.
 *
 * `read` / `pick1` / `pick2` / … are ids rather than numbers so that inserting
 * one does not renumber every comparison in the file. The step counter shown
 * in the bubble is the index in this list, so it always matches what the
 * participant is actually doing.
 */
const DIRECT_STEPS = [
  "read",
  "pick1",
  "pick2",
  "send",
  "wait",
  "done",
  "check",
] as const;

const PROXY_STEPS = [
  "read",
  "pick1",
  "pick2",
  "share",
  "ask",
  "wait",
  "done",
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
  "issue1",
  "share",
  "composer",
  "checkAnswer",
]);

const STEP_STAGE: Record<Step, 1 | 2 | 3 | 4> = {
  read: 1,
  pick1: 2,
  pick2: 2,
  share: 2,
  send: 3,
  ask: 3,
  wait: 3,
  done: 3,
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
  const [offer, setOffer] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState(PRACTICE_DRAFT);

  // Proxy practice states
  const [proxyPreferred, setProxyPreferred] = useState<Record<string, string>>({});
  const [proxyReasonChecked, setProxyReasonChecked] = useState(true);
  const [proxyReasonTouched, setProxyReasonTouched] = useState(false);
  const [proxyChatMessages, setProxyChatMessages] = useState<DisplayMessage[]>([]);
  const [proxyDraft, setProxyDraft] = useState(PRACTICE_PROXY_DRAFT);
  const [proxyPending, setProxyPending] = useState(false);

  // Comprehension check states
  const [reasonAnswer, setReasonAnswer] = useState("");
  const [reasonSubmitted, setReasonSubmitted] = useState(false);
  const bypass = useDevBypass();

  const role = assignment?.role ?? "leader";
  const plan = assignment ? sessionPlan(assignment, 1) : null;
  const isProxy = plan ? isProxyCondition(plan.condition) : false;
  const task = PRACTICE_TASK;
  const practiceReason = requirementIssue(task, role).rationale[role];
  const prac1 = practiceReasonItem(role);
  const reasonCorrect = reasonAnswer === PRACTICE_REASON_ANSWER;

  const steps: readonly Step[] = isProxy ? PROXY_STEPS : DIRECT_STEPS;
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const stage = STEP_STAGE[step];

  useDevAutofill(() => {
    setOffer(
      Object.fromEntries(
        PRACTICE_TASK.issues.map((i) => [
          i.id,
          [...i.options].sort((a, b) => b.points[role] - a.points[role])[0].id,
        ]),
      ),
    );
    setProxyPreferred(
      Object.fromEntries(
        PRACTICE_TASK.issues.map((i) => [
          i.id,
          [...i.options].sort((a, b) => b.points[role] - a.points[role])[0].id,
        ]),
      ),
    );
    setDraft(PRACTICE_DRAFT);
    setProxyDraft(PRACTICE_PROXY_DRAFT);
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

  const firstPicked = isProxy
    ? task.issues[0].id in proxyPreferred
    : task.issues[0].id in offer;
  const secondPicked = isProxy
    ? task.issues[1].id in proxyPreferred
    : task.issues[1].id in offer;
  const participantSpoke = isProxy
    ? proxyChatMessages.some((m) => m.speaker === "participant")
    : messages.some((m) => m.speaker === "participant");
  const replyArrived = isProxy
    ? proxyChatMessages.some((m) => m.speaker === "participant_proxy")
    : messages.some((m) => m.speaker === "counterpart");

  const stepDone: Record<Step, boolean> = {
    read: false, // reading has no action; its bubble carries the button
    pick1: firstPicked,
    pick2: secondPicked,
    share: proxyReasonTouched,
    send: participantSpoke,
    ask: participantSpoke,
    wait: replyArrived,
    done: false, // ends on the bubble's own Continue
    check: false, // ends on Check My Answer / Start Task 1
  };

  const done = stepDone[step];

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
      const ringed = document.querySelector(".cue-ring, .cue-ring-private");
      (ringed ?? document.querySelector('[aria-live="polite"]'))?.scrollIntoView(
        { behavior: "smooth", block: "center" },
      );
    }, 60);
    return () => window.clearTimeout(id);
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

  async function sendProxyRehearsal(text: string) {
    const includePracticeReason = proxyReasonChecked;
    setProxyChatMessages((m) => [
      ...m,
      { id: `pr-user-${m.length}`, speaker: "participant", text },
    ]);
    setProxyPending(true);
    await new Promise((r) => setTimeout(r, 900));
    setProxyChatMessages((m) => [
      ...m,
      {
        id: `pr-ai-${m.length}`,
        speaker: "participant_proxy",
        text: includePracticeReason
          ? "In this practice example, I’ll start from the goals you selected. The practice workplace reason is included, so I can use it when it helps explain those goals. Any package the two proxies reach is tentative — you decide afterwards whether to approve it, change it, or refuse it."
          : "In this practice example, I’ll start from the goals you selected. The practice workplace reason is not included, so I’ll work from those goals alone. Any package the two proxies reach is tentative — you decide afterwards whether to approve it, change it, or refuse it.",
      },
    ]);
    setProxyPending(false);
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
    | "issue0"
    | "issue1"
    | "share"
    | "composer"
    | "coach"
    | "question"
    | "checkAnswer"
    | null;

  const cueTarget: CueTarget = (() => {
    switch (step) {
      case "read":
        return "briefing";
      case "pick1":
        return "issue0";
      case "pick2":
        return "issue1";
      case "share":
        return "share";
      case "send":
      case "ask":
        return "composer";
      case "wait":
        return null;
      case "done":
        return "coach";
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
        eyebrow="Tutorial · Practice Sandbox"
        title="Interactive Practice Round"
        doesNotCount
        scene={isProxy ? "proxy" : "direct"}
        lead={
          <>
            <p className="mb-2 text-slate-800 font-medium">
              Welcome to the interactive practice session! Before starting the real tasks, this round lets you try out the controls with a simple practice scenario.
            </p>
            <p className="text-slate-600 text-sm">
              {isProxy
                ? "In your first task, an AI Proxy will negotiate from your instructions, and then the decision comes back to you. This practice walks you through those controls one click at a time: choosing goals, the sharing control, and a private question to your Proxy."
                : "In your first task you will chat with the other participant directly. This practice walks you through those controls one click at a time: building an offer package and sending a message."}
            </p>
          </>
        }
        steps={
          isProxy
            ? [
                { label: "Step 1: Read the situation", hint: "See the shared scenario and your private workplace context" },
                { label: "Step 2: Set two practice goals", hint: "One option on each term, then try the sharing control" },
                { label: "Step 3: Consult your AI Proxy", hint: "The question is typed for you — just press Ask Proxy" },
                { label: "Step 4: Answer one quick check", hint: "Confirm that points and reasons are clear" },
              ]
            : [
                { label: "Step 1: Read the situation", hint: "See the shared scenario and your private workplace context" },
                { label: "Step 2: Build a practice proposal", hint: "One option on each of the two terms" },
                { label: "Step 3: Send one practice message", hint: "The message is typed for you — just press Send" },
                { label: "Step 4: Answer one quick check", hint: "Confirm that points and reasons are clear" },
              ]
        }
        minutes={STAGE_MINUTES.practice}
        note={
          <Callout title="🛡️ Safe Sandbox" tone="neutral">
            <p>
              Nothing in this practice round affects your task outcome or
              payment. We will point at each control in turn — take as much
              time as you need.
            </p>
          </Callout>
        }
        actionLabel="Start Interactive Practice →"
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
    isProxy ? "Ask Proxy" : "Try chat",
    "Quick check",
  ];

  const firstIssue = task.issues[0];
  const secondIssue = task.issues[1];

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
      title: "First, read your briefing",
      body: "Your situation, your points and your private workplace context are in the panel on the right — it has the glowing edge. Only you can see it. Press the button below when you have had a look.",
      nextLabel: "I've read it",
      onNext: advance,
    },
    pick1: {
      title: `Now pick any option for “${firstIssue.label}”`,
      body: "The four buttons are in the highlighted box just below. Any of them is fine — this is practice. It moves on by itself as soon as you pick one.",
    },
    pick2: {
      title: `Now the second term, “${secondIssue.label}”`,
      body: "Same again in the highlighted box below. Any option is fine.",
    },
    share: {
      title: "Now try the sharing control",
      body: "The box at the bottom decides whether your Proxy may use the practice reason. Tick it or untick it — either way is fine here, and you can change it back.",
    },
    send: {
      title: "We typed a practice message for you",
      body: "It is already in the box below. All you need to do is press the glowing Send button.",
    },
    ask: {
      title: "We typed a practice question for you",
      body: "It is already in the box below. All you need to do is press the glowing Ask Proxy button.",
    },
    wait: {
      title: isProxy ? "Your Proxy is replying…" : "The other side is replying…",
      body: "Nothing to press. In a real task the reply takes a moment too, and this is what waiting looks like.",
    },
    done: {
      title: "That is the whole exchange",
      body: isProxy
        ? "The reply is above. In the real task your Proxy negotiates on its own and the package comes back to you for a decision."
        : "The reply is above. In the real task you keep going like this until you both agree or the clock runs out.",
      nextLabel: "Continue",
      onNext: advance,
    },
    check: {
      title: "Last, one quick check",
      body: reasonAnswer
        ? "Now press the glowing Check My Answer button at the bottom of the screen."
        : "Pick one answer in the highlighted card below. Your briefing stays on the right while you do.",
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
  const actionDisabled =
    step === "check"
      ? !canContinue && !reasonAnswer
      : !bypass && !stepDone[step] && step !== "read" && step !== "done";

  const actionNote = (() => {
    switch (step) {
      case "read":
        return "This is a neutral practice situation. It does not affect your task outcome or payment.";
      case "pick1":
      case "pick2":
        return "Pick any option in the highlighted box — it moves on by itself.";
      case "share":
        return "Tick or untick the sharing box. Either way is fine in practice.";
      case "send":
      case "ask":
        return "The message is already written. Press the glowing button to send it.";
      case "wait":
        return "Waiting for the practice reply…";
      case "done":
        return "Practice exchange complete.";
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
      nextCue={cueTarget === "coach"}
    >
      <p>{coach.body}</p>
    </Coach>
  );

  /**
   * Which issue box carries the ring, by index. `-1` when the ring is not on a
   * term at all — the map above owns that decision, so this is a read of it
   * rather than a second rule that could disagree.
   */
  const ringedIssueIndex =
    cueTarget === "issue0" ? 0 : cueTarget === "issue1" ? 1 : -1;

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
          <PageHeader
            eyebrow="Practice Sandbox"
            title="Let’s Try It Together"
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
            rail beside it) the bubble sits here. On `pick2` and `share` it is
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
                {task.issues.map((issue, index) => (
                  <div key={issue.id}>
                    {/* The bubble for the second term sits directly above that
                        term's box, so bubble and control read as one unit. */}
                    {cueTarget === "issue1" && index === 1 ? (
                      <CoachAnchor>{coachBubble("down", true)}</CoachAnchor>
                    ) : null}
                    <div
                      className={cx(
                        "rounded-xl border border-slate-200 bg-slate-50/70 p-3.5",
                        // ONE ring on the screen (rule 9), owned by `cueTarget`.
                        // It marks WHERE to press and says nothing about which
                        // chip inside it to choose.
                        ringedIssueIndex === index ? "cue-ring-private" : "",
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
                            setProxyPreferred((previous) => ({
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
              <label
                className={cx(
                  "mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-300 bg-white/70 p-3 text-sm font-medium text-amber-950",
                  cueTarget === "share" ? "cue-ring-private" : "",
                )}
              >
                <input
                  type="checkbox"
                  checked={proxyReasonChecked}
                  onChange={(event) => {
                    setProxyReasonChecked(event.target.checked);
                    // Either direction finishes the step. The tutorial must not
                    // reward one setting over the other — which box a
                    // participant is willing to draw from is the measure, and
                    // a practice round that nudged it would be teaching the
                    // outcome.
                    setProxyReasonTouched(true);
                  }}
                  className="mt-0.5 h-4 w-4 rounded text-blue-600"
                />
                <span>
                  <strong>Practice workplace reason:</strong> “{practiceReason}”
                  Try the sharing control here; this example does not affect the
                  real task.
                </span>
              </label>
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
                {task.issues.map((issue, index) => (
                  <div key={issue.id}>
                    {cueTarget === "issue1" && index === 1 ? (
                      <CoachAnchor>{coachBubble("down", true)}</CoachAnchor>
                    ) : null}
                    <div
                      className={cx(
                        "rounded-xl border border-slate-200 bg-slate-50/70 p-3.5",
                        ringedIssueIndex === index ? "cue-ring" : "",
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
                            setOffer((previous) => ({
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
            <Card
              tone="private"
              className="mb-6 flex flex-col overflow-hidden border-amber-300"
              padded={false}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-amber-200 bg-amber-50/70 px-4 py-3 sm:px-5">
                <div>
                  <p className="text-base font-bold text-[var(--private-ink)]">
                    Ask Your AI Proxy a Practice Question
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--private-ink)]">
                    This practice uses a sample reply.
                  </p>
                </div>
                <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-950">
                  Private · only you and your Proxy
                </span>
              </div>
              <Transcript
                messages={proxyChatMessages}
                pending={proxyPending}
                pendingSpeaker="participant_proxy"
                emptyHint="The practice question is already typed below — just press Ask Proxy."
              />
              {/* Directly above the composer, so the tail lands on the box and
                  the button rather than on the card's header several hundred
                  pixels up. */}
              {cueTarget === "composer" ? (
                <div className="border-t border-slate-200 bg-white px-3.5 pt-3.5 sm:px-4">
                  <CoachAnchor className="-mb-2">
                    {coachBubble("down", true)}
                  </CoachAnchor>
                </div>
              ) : null}
              <MessageComposer
                value={proxyDraft}
                onChange={setProxyDraft}
                onSend={(text) => {
                  setProxyDraft("");
                  void sendProxyRehearsal(text);
                }}
                disabled={proxyPending}
                placeholder="Type a practice question…"
                sendLabel="Ask Proxy"
                // The ring goes on the SEND BUTTON, not the box: the box is
                // already full, so ringing it would point at nothing to do.
                cueSend={cueTarget === "composer"}
              />
            </Card>
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
                emptyHint="The practice message is already typed below — just press Send."
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
                          ? "Correct — you are ready"
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
