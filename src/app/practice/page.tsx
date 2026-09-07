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
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
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

export default function PracticePage() {
  usePageEnter("practice");

  const router = useRouter();
  const [phase, setPhase] = useState<"intro" | "practice">("intro");
  const [tutorialStep, setTutorialStep] = useState<1 | 2 | 3 | 4>(1);
  const { assignment, logEvent, saveResponses } = useParticipant();

  // Direct practice states
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [offer, setOffer] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");

  // Proxy practice states
  const [proxyPreferred, setProxyPreferred] = useState<Record<string, string>>({});
  const [proxyReasonChecked, setProxyReasonChecked] = useState(true);
  const [proxyChatMessages, setProxyChatMessages] = useState<DisplayMessage[]>([]);
  const [proxyDraft, setProxyDraft] = useState("");
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
    setDraft(
      role === "leader"
        ? "hi! the move week is the main thing for me — could we do next week?"
        : "hi! where the printer goes is the main thing for me — could we keep it beside my desk?",
    );
    setProxyDraft("How will you argue for the options I picked?");
    setReasonAnswer(PRACTICE_REASON_ANSWER);
  }, `practice-${phase}`);

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

  const baselineOfferChosen = Object.keys(offer).length >= task.issues.length;
  /**
   * Which term still needs a pick at step 2 — the one control the coach's
   * ring goes on, in both branches. `-1` once both are set, which takes the
   * ring off the screen: the step is done and nothing is waiting.
   *
   * Tested with `in`, not truthiness: the Direct branch offers "Not
   * specified", whose value is the empty string, and that is a real answer.
   */
  const stepTwoPicks = isProxy ? proxyPreferred : offer;
  const firstUnpickedIssueIndex =
    tutorialStep === 2
      ? task.issues.findIndex((issue) => !(issue.id in stepTwoPicks))
      : -1;
  const baselineExchangeDone = messages.some(
    (message) => message.speaker === "counterpart",
  );
  const proxyMandateChosen =
    Object.keys(proxyPreferred).length >= task.issues.length;
  const proxyExchangeDone = proxyChatMessages.some(
    (message) => message.speaker === "participant_proxy",
  );
  const choicesComplete = isProxy ? proxyMandateChosen : baselineOfferChosen;
  const exchangeComplete = isProxy ? proxyExchangeDone : baselineExchangeDone;

  const canContinue = bypass || (reasonSubmitted && reasonCorrect);

  function showTutorialStep(step: 1 | 2 | 3 | 4) {
    setTutorialStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    if (tutorialStep === 1) {
      setPhase("intro");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    showTutorialStep((tutorialStep - 1) as 1 | 2 | 3 | 4);
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
                ? "In your first task, an AI Proxy will negotiate from your instructions, and then the decision comes back to you. This practice shows you those controls: choosing goals, trying a private question, and checking your understanding."
                : "In your first task you will chat with the other participant directly. This practice shows you those controls: building an offer package and sending messages."}
            </p>
          </>
        }
        steps={
          isProxy
            ? [
                { label: "Step 1: Read the situation", hint: "See the shared scenario and your private workplace context" },
                { label: "Step 2: Set two practice goals", hint: "Choose what you would like on each term" },
                { label: "Step 3: Consult your AI Proxy", hint: "Ask one practice question and see its reply" },
                { label: "Step 4: Answer one quick check", hint: "Confirm that points and reasons are clear" },
              ]
            : [
                { label: "Step 1: Read the situation", hint: "See the shared scenario and your private workplace context" },
                { label: "Step 2: Build a practice proposal", hint: "Select an option for each term" },
                { label: "Step 3: Send one practice message", hint: "Try the chat and wait for a reply" },
                { label: "Step 4: Answer one quick check", hint: "Confirm that points and reasons are clear" },
              ]
        }
        minutes={STAGE_MINUTES.practice}
        note={
          <Callout title="🛡️ Safe Sandbox" tone="neutral">
            <p>
              Nothing in this practice round affects your task outcome or
              payment. Take as much time as you need to get comfortable with
              the controls.
            </p>
          </Callout>
        }
        actionLabel="Start Interactive Practice →"
        onStart={() => {
          setPhase("practice");
          showTutorialStep(1);
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

  /**
   * What the coach bubble says at each step, and which way its tail points.
   *
   * Every line says WHAT to do and where the control is. None of them says
   * which option to pick, which reason to share, or which answer is right —
   * a cue may say that something is expected, never what (interface rule 9).
   * Step 1's bubble points RIGHT, at the briefing rail; the rest point DOWN,
   * at the control rendered immediately beneath them.
   */
  const coachCopy = [
    {
      title: "First, read your briefing",
      body: "Your situation, your points and your private workplace context are in the panel on the right. Only you can see them.",
      point: "right" as const,
    },
    {
      title: isProxy ? "Now set your practice goals" : "Now build a practice proposal",
      body: isProxy
        ? "Pick one option on each of the two terms below. They are what your AI Proxy would open with."
        : "Pick one option on each of the two terms below. Together they make the package you would open with.",
      point: "down" as const,
    },
    {
      title: isProxy ? "Now ask your AI Proxy" : "Now send a message",
      body: isProxy
        ? "Type a question in the box below, or tap one of the suggestions, and wait for the practice reply."
        : "Write a short message in the box below and send it, then wait for the practice reply.",
      point: "down" as const,
    },
    {
      title: "Last, one quick check",
      body: "Answer the question below. Your briefing stays on the right while you do.",
      point: "down" as const,
    },
  ][tutorialStep - 1];

  // Steps 2, 3 and 4 end when the participant picks, sends or answers
  // something, so the bubble needs no button of its own. Step 1 is reading,
  // which has no completion action — it gets the one "Next".
  const coachNext =
    tutorialStep === 1
      ? () => showTutorialStep(2)
      : undefined;

  const actionLabel =
    tutorialStep === 1
      ? "Continue to Practice Choices →"
      : tutorialStep === 2
        ? isProxy
          ? "Continue to Proxy Question →"
          : "Continue to Practice Chat →"
        : tutorialStep === 3
          ? "Continue to Quick Check →"
          : canContinue
            ? "Start Task 1 (Real Session) →"
            : "Check My Answer";

  const actionDisabled =
    tutorialStep === 2
      ? !bypass && !choicesComplete
      : tutorialStep === 3
        ? !bypass && (!exchangeComplete || pending || proxyPending)
        : tutorialStep === 4
          ? !canContinue && !reasonAnswer
          : false;

  const actionNote =
    tutorialStep === 1
      ? "This is a neutral practice situation. It does not affect your task outcome or payment."
      : tutorialStep === 2
        ? choicesComplete
          ? "Both practice choices are set. You can continue or revise them first."
          : "Choose one option for each of the two terms."
        : tutorialStep === 3
          ? pending || proxyPending
            ? "Waiting for the practice reply…"
            : exchangeComplete
              ? "Practice reply received. You can continue or try another message."
              : isProxy
                ? "Ask one question and wait for the AI Proxy’s practice reply."
                : "Send one message and wait for the practice reply."
          : canContinue
            ? "Practice complete. You are ready to begin Task 1."
            : reasonSubmitted
              ? "Please review your selected answer above."
              : !reasonAnswer
                ? "Select an answer, then check it."
                : "";

  function handleAction() {
    if (actionDisabled) return;
    if (tutorialStep < 4) {
      showTutorialStep((tutorialStep + 1) as 1 | 2 | 3 | 4);
      return;
    }
    if (canContinue) {
      finish();
      return;
    }
    setReasonSubmitted(true);
  }

  return (
    <>
      <Page width="wide">
        <TaskLayout
          briefing={
            // Step 1 points at the briefing, so the step's single cue ring
            // goes here — on the panel, which IS the control that step asks
            // the participant to use. The wrapper carries no colour of its
            // own: it is a transparent border that the ring paints, so the
            // panel's own sand surface still says the contents are private
            // (interface rule 1). Every later step drops it, because the ring
            // moves to that step's control and there is only ever one.
            //
            // `TaskLayout` renders this node twice — the `lg` rail and the
            // mobile drawer — but only one is ever ON SCREEN (the rail is
            // `hidden lg:block`, the drawer `lg:hidden` and only mounted when
            // opened), so the participant never sees two rings.
            <div
              className={cx(
                "rounded-2xl border border-transparent",
                tutorialStep === 1 ? "cue-ring" : "",
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
              const step = index + 1;
              const complete = step < tutorialStep;
              const current = step === tutorialStep;
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
                  {complete ? `✓ ${step}` : step}. {label}
                </li>
              );
            })}
          </ol>

          {/*
            The bubble and the control it points at are one unit: the anchor
            keeps them adjacent in the flow so the tail always lands on the
            card immediately below (or, at step 1, on the rail beside it).
          */}
          <CoachAnchor>
            <Coach
              step={tutorialStep}
              total={4}
              title={coachCopy.title}
              point={coachCopy.point}
              onNext={coachNext}
              nextLabel="I've read it"
            >
              <p>{coachCopy.body}</p>
            </Coach>
          </CoachAnchor>

          {tutorialStep === 1 ? (
            <Card className="mb-6 border-blue-300 bg-white p-4" padded={false}>
              <CardTitle>
                The Practice Situation: {task.title.replace(/^Practice — /, "")}
              </CardTitle>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                {task.publicBrief}
              </p>
              {/*
                Step 1's cue ring lives on the briefing panel, passed into
                `TaskLayout` below — the panel IS the control this step asks
                the participant to use — so this card carries none.
              */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                Your private points and workplace context are in the side panel.
                You will use both in the next steps.
              </div>
            </Card>
          ) : null}

          {tutorialStep === 2 && isProxy ? (
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
                  <div
                    key={issue.id}
                    className={cx(
                      "rounded-xl border border-slate-200 bg-slate-50/70 p-3.5",
                      // ONE ring on the screen (rule 9): it sits on the FIRST
                      // unanswered term, and moves to the second once that one
                      // is picked. It marks where the participant is, and says
                      // nothing about which chip inside it to press.
                      firstUnpickedIssueIndex === index ? "cue-ring" : "",
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
                ))}
              </div>
              <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-300 bg-white/70 p-3 text-sm font-medium text-amber-950">
                <input
                  type="checkbox"
                  checked={proxyReasonChecked}
                  onChange={(event) => setProxyReasonChecked(event.target.checked)}
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

          {tutorialStep === 2 && !isProxy ? (
            <Card className="mb-6 border-blue-300 bg-white p-4" padded={false}>
              <CardTitle>Build a Practice Proposal</CardTitle>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                These selections prepare a draft package. Nothing is sent from
                this step.
              </p>
              <div className="mt-4 space-y-4">
                {task.issues.map((issue, index) => (
                  <div
                    key={issue.id}
                    className={cx(
                      "rounded-xl border border-slate-200 bg-slate-50/70 p-3.5",
                      // Same single ring as the Proxy branch above: the first
                      // term still to be picked, then the second.
                      firstUnpickedIssueIndex === index ? "cue-ring" : "",
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
                ))}
              </div>
            </Card>
          ) : null}

          {tutorialStep === 3 && isProxy ? (
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
                emptyHint="Choose a suggestion or type one question below."
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 p-3">
                <span className="text-sm font-bold text-slate-600">Suggestions:</span>
                <button
                  type="button"
                  onClick={() =>
                    void sendProxyRehearsal(
                      "How will you argue for the options I picked?",
                    )
                  }
                  disabled={proxyPending}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  “How will you argue for the options I picked?”
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void sendProxyRehearsal(
                      "Which reasons are you allowed to share?",
                    )
                  }
                  disabled={proxyPending}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  “Which reasons can you share?”
                </button>
              </div>
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
                // Step 3's single ring, on the control the bubble points at.
                // `MessageComposer` drops it as soon as there is a draft, so
                // it stops marking a box that is no longer empty.
                cue={!proxyPending}
              />
            </Card>
          ) : null}

          {tutorialStep === 3 && !isProxy ? (
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
                emptyHint="Type a short message below, then send it."
              />
              <MessageComposer
                value={draft}
                onChange={setDraft}
                onSend={(text) => {
                  setDraft("");
                  void sendPractice(text);
                }}
                disabled={pending}
                placeholder="Type a practice message…"
                // Step 3's single ring in the Direct branch. Same rule as the
                // Proxy composer above.
                cue={!pending}
              />
            </Card>
          ) : null}

          {tutorialStep === 4 ? (
            <Card
              id={`q-${prac1.id}`}
              className={cx(
                "mb-6 border-blue-300 bg-white p-4",
                reasonSubmitted && reasonCorrect
                  ? "border-emerald-300 bg-emerald-50/20"
                  : "",
                // Step 4's single ring, on the question the coach points at.
                // It marks that an answer is expected and never which one
                // (rule 9), and it comes off the moment one is selected.
                !reasonAnswer ? "cue-ring" : "",
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
