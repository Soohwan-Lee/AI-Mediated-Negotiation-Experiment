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

export default function PracticePage() {
  usePageEnter("practice");

  const router = useRouter();
  const [phase, setPhase] = useState<"intro" | "practice">("intro");
  const { assignment, logEvent, saveResponses } = useParticipant();

  // Baseline practice states
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [offer, setOffer] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");

  // Proxy practice states
  const [proxyPreferred, setProxyPreferred] = useState<Record<string, string>>({});
  const [proxyMinimum, setProxyMinimum] = useState<Record<string, string>>({});
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
    setProxyMinimum(
      Object.fromEntries(
        PRACTICE_TASK.issues.map((i) => [
          i.id,
          [...i.options].sort((a, b) => a.points[role] - b.points[role])[0].id,
        ]),
      ),
    );
    setDraft(
      role === "leader"
        ? "hi! the deep-clean week is the main thing for me — could we do next week?"
        : "hi! where the machine goes is the main thing for me — could we keep it behind the counter?",
    );
    setProxyDraft("How will you argue for the week I picked?");
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
        text: "I will open by proposing your Best Goal on both terms. If the counterpart pushes back, I will defend your position and will never compromise below your Walkaway Limit, using the work reasons you authorized.",
      },
    ]);
    setProxyPending(false);
  }

  // Active step calculation for interactive guidance
  const baselineOfferChosen = Object.keys(offer).length >= task.issues.length;
  const baselineMessageSent = messages.length > 0;
  const proxyMandateChosen =
    Object.keys(proxyPreferred).length >= task.issues.length &&
    Object.keys(proxyMinimum).length >= task.issues.length;
  const proxyRehearsalDone = proxyChatMessages.length > 0;

  const currentStep = isProxy
    ? !proxyMandateChosen
      ? 1
      : !proxyRehearsalDone
        ? 2
        : !reasonCorrect
          ? 3
          : 4
    : !baselineOfferChosen
      ? 1
      : !baselineMessageSent
        ? 2
        : !reasonCorrect
          ? 3
          : 4;

  const canContinue = bypass || (reasonSubmitted && reasonCorrect);

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
                ? "In your first task, an AI Proxy will negotiate from your instructions before you finish the conversation yourself. This practice shows you those controls: setting goals, writing instructions, and checking them."
                : "In your first task you will chat with the other participant directly. This practice shows you those controls: building an offer package and sending messages."}
            </p>
          </>
        }
        steps={
          isProxy
            ? [
                { label: "Step 1: Check your practice goals", hint: "Review the private situation in the sidebar" },
                { label: "Step 2: Set your negotiation boundaries", hint: "Choose your best goal (aim high) and walkaway limit (lowest acceptable)" },
                { label: "Step 3: Consult your AI Proxy", hint: "Ask a test question to see how it will defend your position" },
                { label: "Step 4: Quick 1-question check", hint: "Confirm that points and reasons are clear" },
              ]
            : [
                { label: "Step 1: Check your practice goals", hint: "Review the private situation in the sidebar" },
                { label: "Step 2: Build a proposal package", hint: "Select an option for each of the practice terms" },
                { label: "Step 3: Send a test message", hint: "Type a message to see how the live conversation works" },
                { label: "Step 4: Quick 1-question check", hint: "Confirm that points and reasons are clear" },
              ]
        }
        minutes={STAGE_MINUTES.practice}
        note={
          <Callout title="🛡️ Safe Sandbox" tone="neutral">
            <p>
              Nothing in this practice round affects your payment or recorded outcomes. Take as much time as you need to get comfortable with the controls!
            </p>
          </Callout>
        }
        actionLabel="Start Interactive Practice →"
        onStart={() => setPhase("practice")}
        secondary={<BackButton from="practice" />}
      />
    );
  }

  return (
    <>
      <Page width="wide">
        <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
          <PageHeader
            eyebrow="Practice Sandbox"
            title="Interactive Practice: Step-by-Step Guide"
            subtitle="Follow the numbered steps below to try each control before the real task begins."
          />

          {/* Interactive Stepper Progress Bar */}
          <div className="mb-6 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white p-4 shadow-sm">
            <p className="text-2xs font-extrabold uppercase tracking-widest text-blue-800 mb-2">
              Practice Progress Tracker
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className={cx(
                "rounded-xl border p-2 text-center transition-all",
                currentStep > 1
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 font-bold"
                  : currentStep === 1
                    ? "border-blue-500 bg-white text-blue-900 font-extrabold ring-2 ring-blue-400/40 shadow-xs"
                    : "border-slate-200 bg-white/70 text-slate-500",
              )}>
                <span className="text-xs">{currentStep > 1 ? "✓ 1. Set Terms" : "👉 1. Set Terms"}</span>
              </div>

              <div className={cx(
                "rounded-xl border p-2 text-center transition-all",
                currentStep > 2
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 font-bold"
                  : currentStep === 2
                    ? "border-blue-500 bg-white text-blue-900 font-extrabold ring-2 ring-blue-400/40 shadow-xs"
                    : "border-slate-200 bg-white/70 text-slate-500",
              )}>
                <span className="text-xs">
                  {currentStep > 2 ? "✓ 2. Test Exchange" : currentStep === 2 ? "👉 2. Test Exchange" : "2. Test Exchange"}
                </span>
              </div>

              <div className={cx(
                "rounded-xl border p-2 text-center transition-all",
                currentStep > 3
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 font-bold"
                  : currentStep === 3
                    ? "border-blue-500 bg-white text-blue-900 font-extrabold ring-2 ring-blue-400/40 shadow-xs"
                    : "border-slate-200 bg-white/70 text-slate-500",
              )}>
                <span className="text-xs">
                  {currentStep > 3 ? "✓ 3. Quick Check" : currentStep === 3 ? "👉 3. Quick Check" : "3. Quick Check"}
                </span>
              </div>

              <div className={cx(
                "rounded-xl border p-2 text-center transition-all",
                canContinue
                  ? "border-emerald-400 bg-emerald-100 text-emerald-950 font-black shadow-xs"
                  : "border-slate-200 bg-white/70 text-slate-400",
              )}>
                <span className="text-xs">{canContinue ? "🎉 4. Start Task 1" : "4. Start Task 1"}</span>
              </div>
            </div>
          </div>

          {/* Scenario Context Card */}
          <Card className="mb-6 border-slate-200 bg-white">
            <CardTitle hint="Practice scenario — nothing here counts:">
              📋 The Practice Scenario: {task.title.replace(/^Practice — /, "")}
            </CardTitle>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-700 mt-2">
              {task.publicBrief}
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-200">
              <span>💡</span>
              <span>Your private points and preferences are shown on the right sidebar. Check what pays you more!</span>
            </div>
          </Card>

          {/* ========================================================================= */}
          {/* BRANCH A: PROXY CONDITION PRACTICE                                      */}
          {/* ========================================================================= */}
          {isProxy ? (
            <>
              {/* Step 1 for Proxy: Set Mandate Bounds */}
              <Card
                className={cx(
                  "mb-6 transition-all",
                  currentStep === 1 ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md" : "border-slate-200",
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-2xs font-extrabold text-blue-900">
                    Step 1 of 3 · AI Proxy Mandate Configuration
                  </span>
                  {proxyMandateChosen ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      ✓ Bounds Set
                    </span>
                  ) : null}
                </div>
                <CardTitle hint="Set your boundaries: where to start aiming high, and where to stop conceding:">
                  🎯 Step 1: Configure Your AI Proxy Instructions
                </CardTitle>

                {/* Helpful Mini Guide */}
                <div className="mt-2.5 mb-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-2.5 text-xs text-blue-950">
                  <div>
                    <span className="font-bold flex items-center gap-1 text-emerald-800">
                      <span>🏆</span> 1. Your Best Goal:
                    </span>
                    <p className="text-2xs text-slate-600 mt-0.5">
                      The best option you hope to get. Proxy will open asking for this first.
                    </p>
                  </div>
                  <div>
                    <span className="font-bold flex items-center gap-1 text-amber-800">
                      <span>🛡️</span> 2. Your Walkaway Limit:
                    </span>
                    <p className="text-2xs text-slate-600 mt-0.5">
                      The lowest option you can tolerate. Proxy will <strong>never go below this</strong>.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mt-3">
                  {task.issues.map((issue) => (
                    <div key={issue.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <p className="text-xs sm:text-sm font-bold text-slate-900">{issue.label}</p>
                        <span className="text-2xs text-slate-500">{issue.rationale[role]}</span>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-2xs font-extrabold uppercase tracking-wider text-emerald-700">
                            🏆 1. Your Best Goal (Aim high)
                          </p>
                          <span className="text-2xs text-slate-500">Proxy opens with this</span>
                        </div>
                        <OptionChips
                          issue={issue}
                          role={role}
                          name={`practice-proxy-pref-${issue.id}`}
                          value={proxyPreferred[issue.id] ?? null}
                          onChange={(v) => setProxyPreferred((p) => ({ ...p, [issue.id]: v }))}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-2xs font-extrabold uppercase tracking-wider text-amber-700">
                            🛡️ 2. Your Walkaway Limit (Absolute minimum)
                          </p>
                          <span className="text-2xs text-slate-500">Proxy will NEVER compromise below this</span>
                        </div>
                        <OptionChips
                          issue={issue}
                          role={role}
                          name={`practice-proxy-min-${issue.id}`}
                          value={proxyMinimum[issue.id] ?? null}
                          onChange={(v) => setProxyMinimum((p) => ({ ...p, [issue.id]: v }))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Step 2 for Proxy: Permitted Reason Authorization & Rehearsal Q&A */}
              <Card
                className={cx(
                  "mb-6 flex flex-col overflow-hidden border-slate-200 transition-all",
                  currentStep === 2 ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md" : "",
                )}
                padded={false}
              >
                <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-2xs font-extrabold text-blue-900">
                        Step 2 of 3 · AI Proxy Consultation (Rehearsal)
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-900">
                      🤖 Test Your AI Proxy with a Question
                    </p>
                  </div>
                  {proxyRehearsalDone ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      ✓ Consultation Tested
                    </span>
                  ) : null}
                </div>

                <div className="p-4 border-b border-slate-200 bg-amber-50/40">
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-amber-950 font-medium">
                    <input
                      type="checkbox"
                      checked={proxyReasonChecked}
                      onChange={(e) => setProxyReasonChecked(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded text-blue-600"
                    />
                    <span>
                      <strong>Authorized Workplace Reason:</strong> &ldquo;The quarterly inspection is right after that week.&rdquo; (The proxy will only say reasons you keep checked).
                    </span>
                  </label>
                </div>

                <Transcript
                  messages={proxyChatMessages}
                  pending={proxyPending}
                  emptyHint="Ask your AI Proxy anything, e.g. &ldquo;What will you open with?&rdquo; or click the suggestion below."
                />

                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-2">
                  <span className="text-2xs font-bold text-slate-500">Quick Test Prompts:</span>
                  <button
                    type="button"
                    onClick={() => void sendProxyRehearsal("How will you argue for the week I picked?")}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs"
                  >
                    &ldquo;How will you argue for the week I picked?&rdquo;
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendProxyRehearsal("Will you compromise below my floor?")}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs"
                  >
                    &ldquo;Will you compromise below my floor?&rdquo;
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
                  placeholder="Type a test question for your AI Proxy…"
                  sendLabel="Ask Proxy"
                />
              </Card>
            </>
          ) : (
            /* ========================================================================= */
            /* BRANCH B: BASELINE DIRECT NEGOTIATION PRACTICE                            */
            /* ========================================================================= */
            <>
              {/* Step 1 for Baseline: Offer Builder */}
              <Card
                className={cx(
                  "mb-6 transition-all",
                  currentStep === 1 ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md" : "border-slate-200",
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-2xs font-extrabold text-blue-900">
                    Step 1 of 3 · Offer Package Builder
                  </span>
                  {baselineOfferChosen ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      ✓ Package Selected
                    </span>
                  ) : null}
                </div>
                <CardTitle hint="Selecting an option on each term builds your proposal package:">
                  📦 Step 1: Select Your Proposed Terms
                </CardTitle>

                <div className="space-y-4 mt-3">
                  {task.issues.map((issue) => (
                    <div key={issue.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <p className="text-xs sm:text-sm font-bold text-slate-900">{issue.label}</p>
                        <span className="text-2xs text-slate-500">💡 {issue.rationale[role]}</span>
                      </div>
                      <OptionChips
                        issue={issue}
                        role={role}
                        name={`practice-${issue.id}`}
                        value={offer[issue.id] ?? null}
                        onChange={(v) => setOffer((prev) => ({ ...prev, [issue.id]: v }))}
                        allowNone
                        noneLabel="Not specified"
                      />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Step 2 for Baseline: Live Chatbox */}
              <Card
                className={cx(
                  "mb-6 flex flex-col overflow-hidden border-slate-200 transition-all",
                  currentStep === 2 ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md" : "",
                )}
                padded={false}
              >
                <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-2xs font-extrabold text-blue-900">
                        Step 2 of 3 · Live Chatbox
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-900">
                      💬 Step 2: Send a Sample Message
                    </p>
                  </div>
                  {baselineMessageSent ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      ✓ Message Exchanged
                    </span>
                  ) : null}
                </div>
                <Transcript
                  messages={messages}
                  pending={pending}
                  emptyHint="Type a message below or click the pre-filled sample to test the chat response!"
                />
                <MessageComposer
                  value={draft}
                  onChange={setDraft}
                  onSend={(text) => {
                    setDraft("");
                    void sendPractice(text);
                  }}
                  disabled={pending}
                  placeholder="Type a sample message here…"
                />
              </Card>
            </>
          )}

          {/* ========================================================================= */}
          {/* Step 3: Quick Comprehension Question (Applies to both)                    */}
          {/* ========================================================================= */}
          <Card
            id={`q-${prac1.id}`}
            className={cx(
              "mb-6 transition-all",
              currentStep === 3 ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md" : "border-slate-200",
              reasonSubmitted && reasonCorrect ? "border-emerald-300 bg-emerald-50/20" : "",
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-2xs font-extrabold text-blue-900">
                Step 3 of 3 · Quick Comprehension Check
              </span>
              {reasonSubmitted && reasonCorrect ? (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  ✓ Answer Verified
                </span>
              ) : null}
            </div>
            <CardTitle hint="One quick question to confirm that points and scenario reasons are understood:">
              ✅ Step 3: Check Your Understanding
            </CardTitle>
            <p className="my-2 text-xs sm:text-sm font-bold text-slate-900">
              {prac1.text}
            </p>
            {prac1.kind === "choice" ? (
              <ChoiceList
                name={prac1.id}
                value={reasonAnswer}
                onChange={(v) => {
                  setReasonAnswer(v);
                  setReasonSubmitted(false);
                }}
                options={prac1.options}
              />
            ) : null}
            {reasonSubmitted && !reasonCorrect ? (
              <div className="mt-3">
                <Callout title="💡 Helpful Hint" tone="warning">
                  <p className="text-xs sm:text-sm">
                    Points reflect how valuable an option is for your scenario; the briefing explains the workplace reasons why.
                  </p>
                </Callout>
              </div>
            ) : null}
          </Card>
        </TaskLayout>
      </Page>

      <ActionBar
        label={canContinue ? "Start Task 1 (Real Session) →" : "Check My Answer"}
        onClick={canContinue ? finish : () => setReasonSubmitted(true)}
        disabled={!canContinue && !reasonAnswer}
        note={
          canContinue
            ? "🎉 Excellent! Practice round complete. Ready to begin Task 1."
            : reasonSubmitted
              ? "⚠️ Please review your selected answer above."
              : !reasonAnswer
                ? "💡 Select an answer in Step 3 above to verify."
                : ""
        }
        secondary={<BackButton from="practice" />}
      />
    </>
  );
}
