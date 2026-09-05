"use client";

/**
 * Phases shared by the Direct and Proxy tasks (Experimental Design Ver.2.4
 * §8).
 *
 * The order of the first three matters and is not arbitrary:
 *
 *   brief → RISK → levels (+ reason cards, in Proxy) → negotiate
 *
 * RISK IS FIRST, straight after the briefing and before anything about the
 * participant's own position is committed. It asks what they EXPECT raising
 * their requirement to cost — an expectation, which stops being one the moment
 * a decision has been taken. Asking it here is also what keeps the two arms
 * identical on this point, now that the Proxy arm settles levels and reason
 * cards on a single screen: "after the levels screen" would mean "after the
 * mandate" in one arm and not the other, and RISK is §10 gate 4's
 * task-equivalence instrument.
 *
 * THE LEVELS come next. They are the first point on the trajectory the study
 * measures — what you wanted, then what you entrusted, then what you opened
 * with, then what survived the challenge, then what reached the final
 * package — and taking them after the condition were visible would contaminate
 * the baseline.
 *
 * The brief is the one phase that puts the briefing in the main column: it is
 * being read for the first time. From the next phase on it lives in the rail,
 * so it is never taken away.
 */

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { MeasureBlock, type Answers } from "@/components/measure";
import {
  CountdownTimer,
  MessageComposer,
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";
import {
  CLOSING_SECONDS,
  DIRECT_STAGE_OFFSET,
  counterpartStageAfter,
  counterpartStep,
  foldTier,
  LABEL_TIER,
  mentionsScoreNumbers,
  type ReasonTier,
} from "@/lib/negotiation/machine";
import {
  BriefingPanel,
  TaskCover,
  type CoverScene,
  TaskHeader,
  TaskLayout,
} from "@/components/session";
import { OptionChips, PackageValue, PointsKey } from "@/components/issues";
import { ActionBar } from "@/components/study-chrome";
import { Callout, Card, CardTitle, Cue, Page, cx } from "@/components/ui";
import { useDevAutofill, useDevGate, useDevMockAi } from "@/lib/dev-mode";
import { dummyAnswer, riskBlock } from "@/lib/measures";
import { useParticipant } from "@/lib/participant-context";
import {
  NEGOTIATION,
  STAGE_MINUTES,
  counterpartDelayMs,
  pauseMs,
} from "@/lib/study-config";
import { getStore } from "@/lib/store";
import {
  packageValue,
  preservesRequirement,
  requirementIssue,
} from "@/lib/tasks";
import type { Mandate, NegotiationTask, Package, Role } from "@/lib/types";

// ---------------------------------------------------------------------------
// Phase: the cover
// ---------------------------------------------------------------------------

/**
 * "Task 1 of 2 starts now."
 *
 * The practice round used to end on a button that dropped the participant
 * straight into a briefing for the task that counts, with nothing marking the
 * change. This is the marker: which of the two tasks this is, what it asks of
 * them, and roughly how long it takes.
 *
 * Shared by both conditions so the wording is identical where it can be. The
 * step list is the only part that differs, and it comes from the task's own
 * phases — interface phases, never a condition name.
 */
export function TaskIntro({
  taskIndex,
  steps,
  scene,
  minutes,
  onStart,
}: {
  taskIndex: 1 | 2;
  steps: Array<string | { label: string; hint: string }>;
  minutes?: number;
  scene: CoverScene;
  onStart: () => void;
}) {
  const first = taskIndex === 1;

  return (
    <TaskCover
      counter={{ index: taskIndex, total: 2 }}
      eyebrow={`Study Phase · Task ${taskIndex} of 2`}
      title={first ? "Task 1 Starts Here" : "Task 2 (Final Task)"}
      lead={
        <>
          <p className="mb-2 text-slate-800 font-medium">
            {first
              ? "The practice round is over — this one counts. You are settling two working conditions with another participant who holds the other role."
              : "This is the second and final task. New situation, new briefing, and a different participant — nothing carries over from Task 1."}
          </p>

          {/* WHAT AN AI PROXY IS, ON THE FIRST SCREEN THAT MENTIONS ONE.
              This used to arrive on the mandate screen, under the levels a
              participant had already been asked to set — so the first time they
              met the idea, they were mid-decision about it. The cover is the
              orientation screen; this is where it belongs.

              Keyed off `scene`, which the interface already varies, so it names
              no condition (deception item 2). Both arms get the same amount of
              orientation, which is also what keeps the two covers matched. */}
          {scene === "proxy" ? (
            <div className="mb-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-sm leading-relaxed text-blue-950">
              <p className="mb-1.5 font-bold">🤖 In this task, an AI Proxy speaks first</p>
              <p className="mb-2 text-blue-900">
                You do not talk to the other participant straight away. You write
                instructions for an AI Proxy — what to aim for, and which of your
                reasons it may say out loud — and it puts your case for you while
                you watch.
              </p>
              <p className="text-blue-900">
                The other participant has one too. When the two proxies finish,{" "}
                <strong>the decision comes back to you</strong>: approve what they
                reached, ask for a change, or refuse it. Nothing is settled until
                you say so.
              </p>
            </div>
          ) : (
            <div className="mb-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-sm leading-relaxed text-blue-950">
              <p className="mb-1.5 font-bold">💬 In this task, you negotiate directly</p>
              <p className="text-blue-900">
                You write to the other participant yourself, in a live chat, and
                the two of you settle both terms between you.
              </p>
            </div>
          )}

          <p className="text-slate-600 text-sm">
            Your private briefing stays pinned in the sidebar the whole time.
            Neither of you can settle anything alone.
          </p>
        </>
      }
      steps={steps}
      scene={scene}
      minutes={minutes ?? STAGE_MINUTES.task}
      actionLabel={`Start Task ${taskIndex}`}
      onStart={onStart}
    />
  );
}

// ---------------------------------------------------------------------------
// Phase: scenario brief
// ---------------------------------------------------------------------------

export function TaskBrief({
  taskIndex,
  task,
  role,
  steps,
  onContinue,
}: {
  taskIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  onContinue: () => void;
}) {
  return (
    <>
      <Page width="wide">
        <TaskHeader
          taskIndex={taskIndex}
          title={task.title}
          steps={steps}
          current={0}
        />

        {/* Shared Public Scenario */}
        <Card className="mb-6 border-blue-100/80 bg-gradient-to-br from-white to-blue-50/20">
          <CardTitle hint="What you and your colleague both know about this project:">
            📋 The Project Setting: {task.title}
          </CardTitle>
          <p className="text-sm sm:text-base leading-relaxed text-slate-700 mt-2">
            {task.publicBrief}
          </p>
          <div className="mt-3.5 flex items-center gap-2.5 rounded-xl bg-blue-50/80 p-3 text-xs font-semibold text-blue-900 border border-blue-200/60">
            <span className="text-base">🌐</span>
            <span>Shared Workplace Setting: Both you and your colleague share the project background above. Your personal goals and private story below are confidential to you.</span>
          </div>
        </Card>

        {/* THE WHOLE BRIEFING, EXPANDED, AND ONLY HERE.
            `defaultOpen` exists for this one screen: it is the phase where the
            briefing is READ for the first time, and a section folded shut is a
            section a participant may not know exists at all.

            Do not replace this with a hand-built summary. It was once cut down
            to the role story and the objectives, which dropped the payoff
            table, the fallback, and every reason card off the screen — and
            since the sidebar's own folds were collapsed at the time, a
            participant could reach the mandate screen having never seen their
            own numbers or their cards anywhere. Interface rule 5: anything a
            participant is expected to negotiate from belongs in the briefing,
            and it is never taken away. */}
        <div className="mb-6">
          <BriefingPanel task={task} role={role} defaultOpen />
        </div>
      </Page>

      <ActionBar
        label="I have read my briefing"
        onClick={onContinue}
        note="💡 It stays pinned in the sidebar for the whole task."
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Phase: preferences on both terms
// ---------------------------------------------------------------------------

/**
 * The participant's hoped-for package (Ver.2.13 §8.6), on both terms, in both
 * arms.
 *
 * THE WALKAWAY LIMIT IS GONE. It was a second level per issue — a floor the
 * proxy could not cross — and §2.6 removed it for three reasons that all
 * point the same way. It could not change the outcome, because the
 * counterpart's policy is decisive; all it could do was manufacture an
 * impasse. It mixed mandate-SETTING skill into a result that is supposed to
 * turn on disclosure alone. And it made the entry screen twice the size in
 * the arm that had it, for a control the other arm did not have.
 *
 * What is left is what both arms share: what you hope for, which the review
 * screen sets beside what was actually agreed.
 */
export interface Preferences {
  preferred: Record<string, string | null>;
}

export function PreferenceForm({
  taskIndex,
  task,
  role,
  steps,
  stepIndex,
  isProxy,
  reasons,
  reasonsComplete = true,
  initial,
  onContinue,
}: {
  taskIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  stepIndex: number;
  isProxy: boolean;
  reasons?: ReactNode;
  reasonsComplete?: boolean;
  initial?: Preferences;
  onContinue: (prefs: Preferences) => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const [preferred, setPreferred] = useState<Record<string, string | null>>(
    () =>
      initial?.preferred ??
      Object.fromEntries(task.issues.map((i) => [i.id, null])),
  );
  useDevAutofill(() => {
    const best = (issueId: string) => {
      const issue = task.issues.find((i) => i.id === issueId)!;
      return [...issue.options].sort(
        (a, b) => b.points[role] - a.points[role],
      )[0].id;
    };
    setPreferred(
      Object.fromEntries(task.issues.map((i) => [i.id, best(i.id)])),
    );
  }, `prefs-t${taskIndex}`);

  const missing = task.issues
    .filter((i) => !preferred[i.id])
    .map((i) => `pref-${i.id}`);
  const canContinue = useDevGate(missing.length === 0 && reasonsComplete);

  async function save() {
    if (!canContinue) return;
    const prefs = { preferred };
    if (participantKey) {
      await getStore().saveResponses(
        participantKey,
        `preferences_t${taskIndex}`,
        { taskId: task.id, role, preferred },
      );
    }
    logEvent("initial_preference_saved", { taskId: task.id }, {
      sessionIndex: taskIndex,
    });
    onContinue(prefs);
  }

  return (
    <>
      <Page width="wide">
        <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
          <TaskHeader
            taskIndex={taskIndex}
            title={
              isProxy
                ? "What You Want, and What Your Proxy May Say"
                : "What You Want From This Negotiation"
            }
            steps={steps}
            current={stepIndex}
          />

          <div className="mb-6">
            <Callout tone="private" title="🔒 Private to You · Set Your Goals">
              <p className="text-xs sm:text-sm leading-relaxed">
                Select the option you would like to aim for on each of the two terms. The other
                person never sees your selections.{" "}
                {isProxy
                  ? "Your AI Proxy opens by asking for these choices."
                  : "Afterwards, you will see your original goals beside the final agreed package."}
              </p>

              <PointsKey
                issues={task.issues}
                role={role}
                reservationPoints={task.reservationPoints}
                className="mt-3"
              />
            </Callout>
          </div>

          <div className="space-y-4">
            {task.issues.map((issue) => (
              <Card key={issue.id} id={`q-pref-${issue.id}`} className="border-slate-200 bg-white">
                <CardTitle hint={issue.description}>{issue.label}</CardTitle>

                <div className="mb-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5 text-xs text-indigo-950 font-medium">
                  💡 <strong>Your Context:</strong> {issue.rationale[role]}
                </div>

                {/* ONE CONTROL PER TERM, and the two terms look identical.
                    §5 principle 1: an extra control on one of them would say
                    which term the study is about without a word. */}
                <OptionChips
                  issue={issue}
                  role={role}
                  name={`pref-${issue.id}`}
                  value={preferred[issue.id]}
                  onChange={(v) =>
                    setPreferred((prev) => ({ ...prev, [issue.id]: v }))
                  }
                />
              </Card>
            ))}
          </div>

          {/* WHAT THIS NUMBER IS, AND WHAT IT IS NOT. It prices the package
              the participant just chose — nothing more. Under the ladder what
              a package is actually worth depends on the reasons that get
              voiced (§3.3), so presenting it as an expected outcome would
              forecast a number the negotiation does not owe them. */}
          <div className="mt-5 space-y-2 rounded-2xl border border-[var(--private-line)] bg-amber-50/50 p-4 sm:p-5 shadow-2xs">
            <PackageValue
              issues={task.issues}
              role={role}
              reservationPoints={task.reservationPoints}
              selection={preferred}
              label="What this would be worth to you"
            />
            <p className="pt-1 text-xs leading-relaxed text-[var(--private-ink)]">
              This prices the package you just chose. Where the negotiation
              actually lands is up to the conversation.
            </p>
          </div>

          {reasons ? <div className="mt-6">{reasons}</div> : null}
        </TaskLayout>
      </Page>

      <ActionBar
        label="Continue"
        onClick={save}
        disabled={!canContinue}
        remaining={missing.length}
        firstUnansweredId={missing[0] ?? null}
        note={
          missing.length > 0
            ? ""
            : reasonsComplete
              ? "✓ Ready to proceed"
              : "⚠️ Please select at least one work reason"
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Phase: RISK, straight after the briefing
// ---------------------------------------------------------------------------

export function RiskForm({
  taskIndex,
  task,
  role,
  steps,
  stepIndex,
  onContinue,
}: {
  taskIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  stepIndex: number;
  onContinue: () => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const block = riskBlock(task, role);
  const [answers, setAnswers] = useState<Answers>({});

  useDevAutofill(
    () =>
      setAnswers(
        Object.fromEntries(block.items.map((i) => [i.id, dummyAnswer(i)])),
      ),
    `risk-t${taskIndex}`,
  );

  const missing = block.items
    .filter((i) => answers[i.id] === undefined)
    .map((i) => i.id);
  const canContinue = useDevGate(missing.length === 0);

  async function save() {
    if (!canContinue) return;
    if (participantKey) {
      await getStore().saveResponses(participantKey, `risk_t${taskIndex}`, {
        taskId: task.id,
        role,
        ...answers,
      });
    }
    logEvent("survey_saved", { block: `risk_t${taskIndex}` }, {
      sessionIndex: taskIndex,
    });
    onContinue();
  }

  return (
    <>
      <Page width="wide">
        <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
          <TaskHeader
            taskIndex={taskIndex}
            title="Two Quick Questions Before You Begin"
            steps={steps}
            current={stepIndex}
          />

          <MeasureBlock
            block={block}
            answers={answers}
            onChange={(id, value) =>
              setAnswers((prev) => ({ ...prev, [id]: value }))
            }
          />
        </TaskLayout>
      </Page>

      <ActionBar
        label="Continue"
        onClick={save}
        disabled={!canContinue}
        remaining={missing.length}
        firstUnansweredId={missing[0] ?? null}
        note={missing.length === 0 ? "✓ Ready" : ""}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Phase: waiting for the other participant
// ---------------------------------------------------------------------------

export function Matchmaking({ onReady }: { onReady: () => void }) {
  const [stage, setStage] = useState<"searching" | "found" | "syncing">("searching");

  useEffect(() => {
    const totalWait = pauseMs(NEGOTIATION.matchmakingMs);
    const t1 = window.setTimeout(() => setStage("found"), Math.max(800, totalWait * 0.45));
    const t2 = window.setTimeout(() => setStage("syncing"), Math.max(1600, totalWait * 0.8));
    const t3 = window.setTimeout(() => {
      onReady();
    }, totalWait);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [onReady]);

  return (
    <Page>
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        {/* Radar / Peer Avatar Graphic */}
        <div className="relative mb-8 flex items-center justify-center">
          <div className="absolute h-36 w-36 sm:h-44 sm:w-44 rounded-full border border-blue-200 bg-blue-50/40 animate-ping opacity-75" />
          <div className="absolute h-28 w-28 sm:h-32 sm:w-32 rounded-full border-2 border-blue-300/60 bg-blue-100/30 animate-pulse" />
          
          <div className="relative z-10 flex items-center gap-4 sm:gap-6 rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 shadow-md">
            <div className="flex flex-col items-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl border border-blue-200 shadow-2xs">
                🧑‍💼
              </span>
              <span className="mt-1.5 text-2xs font-bold text-slate-700">You (Ready)</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-xs font-mono font-bold text-blue-600 animate-pulse">
                {stage === "searching" ? "•••••" : "──✓──"}
              </span>
              <span className="text-2xs font-semibold text-slate-400">
                {stage === "searching" ? "Searching" : "Paired"}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <span className={cx(
                "flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-all duration-300 shadow-2xs",
                stage === "searching"
                  ? "bg-slate-100 text-slate-400 border border-dashed border-slate-300 animate-pulse"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-300 scale-105",
              )}>
                {stage === "searching" ? "👤" : "🤝"}
              </span>
              <span className="mt-1.5 text-2xs font-bold text-slate-700">
                {stage === "searching" ? "Partner (Waiting…)" : "Partner Connected"}
              </span>
            </div>
          </div>
        </div>

        {/* Status texts */}
        <div className="max-w-md space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-xs font-extrabold text-blue-900 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span>
              {stage === "searching"
                ? "Connecting with Counterpart…"
                : stage === "found"
                  ? "Partner Found · Joining Room…"
                  : "Both Ready · Initializing Negotiation…"}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            {stage === "searching"
              ? "Waiting for the other participant…"
              : "Participant connected!"}
          </h1>

          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            {stage === "searching"
              ? "You are being paired with another participant who has just completed the setup. Please stay on this screen — negotiations begin automatically as soon as both are synced."
              : "Both parties are now synchronized in the workspace. Entering the live session room now…"}
          </p>
        </div>

        {/* Live system queue checklist */}
        <div className="mt-8 w-full max-w-sm rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left shadow-2xs">
          <p className="text-2xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
            Session Synchronization
          </p>
          <ul className="space-y-1.5 text-xs">
            {/* ARM-NEUTRAL WORDING. This screen is shared, and "mandate"
                only exists in one arm — a Direct participant was being told
                their mandate was locked when they never wrote one. Words that
                belong to one condition do not go on a shared screen
                (deception item 2). */}
            <li className="flex items-center gap-2 text-emerald-700 font-semibold">
              <span>✓</span> Your choices locked
            </li>
            <li className={cx(
              "flex items-center gap-2 font-semibold transition-colors",
              stage !== "searching" ? "text-emerald-700" : "text-blue-700 animate-pulse",
            )}>
              <span>{stage !== "searching" ? "✓" : "⏳"}</span>
              <span>{stage !== "searching" ? "Counterpart participant joined" : "Matching active participant from queue…"}</span>
            </li>
            <li className={cx(
              "flex items-center gap-2 font-semibold transition-colors",
              stage === "syncing" ? "text-emerald-700" : "text-slate-400",
            )}>
              <span>{stage === "syncing" ? "✓" : "○"}</span> Live room state synchronized
            </li>
          </ul>
        </div>
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

export function TermsList({
  task,
  terms,
}: {
  task: NegotiationTask;
  terms: Record<string, string | null | undefined>;
}) {
  return (
    <dl className="divide-y divide-[var(--line)]">
      {task.issues.map((issue) => {
        const option = issue.options.find((o) => o.id === terms[issue.id]);
        return (
          <div
            key={issue.id}
            className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
          >
            <dt className="text-[0.875rem] text-[var(--ink-2)]">
              {issue.label}
            </dt>
            <dd className="text-right text-[0.9375rem] font-medium">
              {option?.label ?? (
                <span className="font-normal text-[var(--ink-3)]">
                  Not settled
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * What the package is worth to you, and whether it clears your fallback.
 *
 * Private, so it lives on a sand card: your own score is exactly the kind of
 * value the other side must not be assumed to see (globals.css, "colour
 * encodes visibility").
 */
export function OutcomeValue({
  task,
  terms,
  role,
}: {
  task: NegotiationTask;
  terms: Package | null;
  role: Role;
}) {
  const requirement = requirementIssue(task, role);
  const value = terms ? packageValue(task, terms) : null;
  const mine = value ? value[role] : task.reservationPoints;
  const held = terms
    ? preservesRequirement(task, role, terms[requirement.id])
    : false;

  return (
    <Card tone="private" className="text-[var(--private-ink)] border-amber-300 bg-amber-50/60 shadow-2xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900">
          🏆 Your Score & Payoff
        </span>
        <span className="text-xl sm:text-2xl font-black text-amber-950 font-mono">
          {mine.toLocaleString()} pts
        </span>
      </div>
      <p className="text-xs sm:text-sm font-medium leading-relaxed">
        {terms
          ? mine >= task.reservationPoints
            ? `✓ Above your fallback score of ${task.reservationPoints.toLocaleString()} pts.`
            : `⚠️ Below your fallback score of ${task.reservationPoints.toLocaleString()} pts.`
          : `⚠️ No agreement reached — fallback score of ${task.reservationPoints.toLocaleString()} pts applies.`}
      </p>
      {/* THE REQUIREMENT ISSUE IS NOT NAMED HERE. This line used to read
          "{requirement.label}: ✓ At or above your required threshold", which
          with three terms singled out one of three and with two terms is a
          straight binary disclosure of which term the study is about — shown
          at the end of Task 1, before its questionnaire and before Task 2.
          Design §5 principle 1 again, and the same leak the reason-card
          heading was stripped to prevent.

          The participant already knows which term they needed: it is in their
          own briefing, in their objectives, and on the card they were choosing
          whether to voice. What the interface must not do is CONFIRM it as the
          study's variable by labelling it. So the line still reports whether
          they held what they needed — which is the outcome they care about —
          without naming the term back to them. */}
      {terms ? (
        <div className="mt-3 border-t border-amber-200/80 pt-3 text-xs sm:text-sm font-semibold text-amber-900">
          <span className={held ? "text-emerald-700" : "text-amber-800"}>
            {held
              ? "✓ You held the level you said you needed."
              : "⚠️ You ended below the level you said you needed."}
          </span>
        </div>
      ) : null}
    </Card>
  );
}

export function DecisionButton({
  selected,
  onClick,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-2xl border-2 p-4 text-left transition-all shadow-2xs",
        selected
          ? "border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60",
      )}
    >
      <span className="block text-sm sm:text-base font-bold text-slate-900">{label}</span>
      <span className="mt-1 block text-xs sm:text-sm font-medium text-slate-600">{hint}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Phase: the participant negotiates directly (Proxy condition)
// ---------------------------------------------------------------------------

export function DirectNegotiation({
  taskIndex,
  task,
  role,
  steps,
  stepIndex,
  proxyTranscript,
  openingPackage,
  refused = false,
  proxyVoicedTier,
  messages,
  setMessages,
  offer,
  setOffer,
  onSettled,
}: {
  taskIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  stepIndex: number;
  proxyTranscript: DisplayMessage[];
  openingPackage: Package | null;
  /**
   * Did the participant REFUSE the proxies' package (RATIFY = rejected)?
   *
   * `openingPackage` being null cannot say why on its own, and the two causes
   * need different words: a refuser knows perfectly well their proxies
   * settled on something, so telling them otherwise contradicts the screen
   * they came from.
   */
  refused?: boolean;
  /**
   * The credibility tier the participant's OWN proxy earned in the AI-AI
   * exchange (Ver.2.12 §6.2) — what was actually VOICED, not what was
   * authorized: an emergency stop or a guardrail block can leave an
   * authorized card unsaid, and assuming it was said made the rule inert for
   * every Proxy participant once before.
   */
  proxyVoicedTier: ReasonTier;
  messages: DisplayMessage[];
  setMessages: Dispatch<SetStateAction<DisplayMessage[]>>;
  offer: Package;
  setOffer: Dispatch<SetStateAction<Package>>;
  onSettled: (
    finalPackage: Package | null,
    meta: {
      /**
       * Did the participant tag their own SB in this closing conversation?
       * Feeds SB-TIMING's "wrap_up" category (§9.3) — the only route to it,
       * and available only to someone whose proxy did not already voice it.
       */
      selfDisclosed: boolean;
    },
  ) => void;
}) {
  const { logEvent, participantKey } = useParticipant();
  const counterpartRole: Role = role === "leader" ? "member" : "leader";
  const requirement = requirementIssue(task, role);
  const mockAi = useDevMockAi();

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [replies, setReplies] = useState(0);
  const [settled, setSettled] = useState<"agreed" | "impasse" | null>(null);
  const [finalPackage, setFinalPackage] = useState<Package | null>(
    openingPackage,
  );
  const [secondsRemaining, setSecondsRemaining] = useState(CLOSING_SECONDS);
  /**
   * The rung the participant's own words have reached in this closing (§6.2a).
   * No card buttons here either — Ver.2.20 removed them from both places the
   * participant speaks for themselves, so the two are the same act.
   */
  const [personalTier, setPersonalTier] = useState<ReasonTier>("none");
  const [selfDisclosed, setSelfDisclosed] = useState(false);
  /** SCRIPT-ASKWHY / SCRIPT-NONUM / SCRIPT-CLOSE are each one-shot. */
  const [askedWhy, setAskedWhy] = useState(false);
  const [numbersReminded, setNumbersReminded] = useState(false);
  /** Any participant message so far mentioned score numbers (one-shot pool). */
  const [numbersEver, setNumbersEver] = useState(false);
  const [softCloseOffered, setSoftCloseOffered] = useState(false);
  const [lastCounterpartPackage, setLastCounterpartPackage] =
    useState<Package | null>(openingPackage);
  /** Two-step guard on "end without agreement". */
  const [confirmDecline, setConfirmDecline] = useState(false);
  /** Synchronous mirror of `settled`, so two callers in one tick cannot both win. */
  const settledRef = useRef(false);

  const chosen = task.issues.filter((i) => offer[i.id]).length;
  const complete = chosen === task.issues.length;
  const canSend = useDevGate(complete) && !settled;
  const yourTurn = !pending && canSend && !settled;

  /**
   * The ladder carries over from the AI-AI exchange and only ever RISES: what
   * the proxy earned, raised by whatever the participant says here in person.
   *
   * This is the one place `SB-TIMING = wrap_up` can happen — a participant who
   * authorized nothing, watched the proxies settle at the priority rung, and
   * then said the thing themselves.
   */
  const tier: ReasonTier = foldTier(proxyVoicedTier, personalTier);

  useDevAutofill(() => {
    if (settled) return;
    setDraft(
      replies === 0
        ? `thanks for going through all that. || from my side the package they landed on works — happy to confirm it if you are.`
        : "that works for me. || glad we got there.",
    );
  }, `direct-t${taskIndex}-${replies}`);

  function settle(
    kind: "agreed" | "impasse",
    pkg: Package | null,
    reason: string,
  ) {
    // The ref, not the state, is what the guards read: `setSettled` does not
    // take effect until the next render, and both callers here can fire
    // inside the same tick.
    if (settledRef.current) return;
    settledRef.current = true;
    setFinalPackage(pkg);
    setSettled(kind);
    logEvent(
      "negotiation_ended",
      {
        phase: "direct",
        reason,
        replies,
        secondsRemaining,
        tier,
        selfDisclosed,
      },
      { sessionIndex: taskIndex },
    );
  }

  /**
   * RATIFY IS NOT INFERRED HERE ANY MORE (Ver.2.13 §9.3). It is recorded on
   * the decision screen, where the participant actually takes it. Reading it
   * back off the final package — as this used to — coded a participant who
   * asked for a change and then agreed the very same package as an approver,
   * which is a different behaviour on a confirmatory outcome.
   */
  function finish(kind: "agreed" | "impasse", pkg: Package | null) {
    // How it ended — "declined" vs "timeout" — is already on the
    // `negotiation_ended` event that `settle()` writes, which is where an
    // audit looks for it.
    onSettled(kind === "agreed" ? pkg : null, { selfDisclosed });
  }

  async function send(text: string, sentOffer: Package = offer) {
    const own: DisplayMessage = {
      id: `d-p${messages.length}`,
      speaker: "participant",
      text,
    };
    const next = [...messages, own];
    setMessages(next);
    setDraft("");
    setConfirmDecline(false);

    // The classifier reads this message (§6.2a); the rung it earns counts
    // from THIS turn, because a confession should land the moment it is made.
    type ReasonLabel = "none" | "WR" | "PRI" | "SB";
    let label: ReasonLabel = "none";
    if (!mockAi) {
      try {
        const res = await fetch("/api/classify-reason", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id, role, message: text }),
        });
        const data = (await res.json()) as { label?: ReasonLabel };
        if (data.label) label = data.label;
      } catch (error) {
        console.warn("[classify-reason] failed", error);
      }
    }

    const personalNow = foldTier(personalTier, LABEL_TIER[label]);
    setPersonalTier(personalNow);
    if (label === "SB") setSelfDisclosed(true);
    const tierNow: ReasonTier = foldTier(proxyVoicedTier, personalNow);

    logEvent(
      "message_sent",
      {
        phase: "direct",
        length: text.length,
        secondsRemaining,
        requirementOption: sentOffer[requirement.id] ?? null,
        reasonLabel: label,
        tier: tierNow,
      },
      { sessionIndex: taskIndex },
    );

    if (participantKey) {
      void getStore().appendMessage(participantKey, {
        id: own.id,
        sessionIndex: taskIndex,
        speaker: "participant",
        text,
        createdAt: new Date().toISOString(),
        stage: counterpartStageAfter(replies + DIRECT_STAGE_OFFSET),
        proposal: Object.keys(sentOffer).length > 0 ? sentOffer : undefined,
      });
    }

    setPending(true);
    try {
      const stageNow = counterpartStageAfter(replies + DIRECT_STAGE_OFFSET);
      const mentioned = numbersEver || mentionsScoreNumbers(text);
      if (mentioned !== numbersEver) setNumbersEver(mentioned);
      const decision = counterpartStep(task, counterpartRole, stageNow, sentOffer, {
        tier: tierNow,
        askedWhy,
        numbersReminded,
        numbersMentionedNow: mentioned,
        secondsRemaining,
        softCloseOffered,
      });
      if (decision.action === "ask_why") setAskedWhy(true);
      if (decision.action === "nonum") setNumbersReminded(true);
      if (decision.action === "soft_close") setSoftCloseOffered(true);

      let reply: string;
      if (mockAi) {
        reply = decision.accepts
          ? DIRECT_MOCK_REPLIES[1]
          : DIRECT_MOCK_REPLIES[Math.min(replies, DIRECT_MOCK_REPLIES.length - 1)];
        await new Promise((r) => setTimeout(r, 500));
      } else {
        const res = await fetch("/api/counterpart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: task.id,
            participantRole: role,
            stage: stageNow,
            incoming: sentOffer,
            tier: tierNow,
            askedWhy,
            numbersReminded,
            // Sent, not re-derived server-side: the client codes the outcome
            // from its own `counterpartStep`, so every input to that call has
            // to reach the route unchanged or the two can disagree about
            // whether the exchange was agreed.
            numbersMentionedNow: mentioned,
            secondsRemaining,
            softCloseOffered,
            afterProxy: true,
            history: next.map((m) => ({
              role: m.speaker === "participant" ? "user" : "assistant",
              content: m.text,
            })),
          }),
        });
        const data = (await res.json()) as {
          message?: string;
          proposal?: Package | null;
        };
        reply = data.message ?? "sorry — could you say that again?";
        await new Promise((r) => setTimeout(r, counterpartDelayMs(reply.length)));
      }

      // THE VISIBLE CARD FOLLOWS THE COUNTERPROPOSAL, and this is not
      // cosmetic. `offer` is the "Current Negotiation Package" chip card;
      // `lastCounterpartPackage` is what "✓ Accept the package on the table"
      // actually sends. They were separate, and nothing synced them.
      //
      // A participant at the work rung who edits the chips to their own best
      // level and sends it gets `balance` back — the machine holds them one
      // option down. That counterpackage silently became the accept target
      // while the card still showed what they had asked for, so the button's
      // own label pointed at the wrong package and one click committed them
      // to 2,300 where the card said 3,000.
      //
      // `acceptStanding` does call `setOffer` first, but React batches it with
      // the `send()` on the next line, so the correction painted only after
      // the commitment it was meant to inform.
      if (decision.proposal) {
        setLastCounterpartPackage(decision.proposal);
        setOffer(decision.proposal);
      }

      const counter: DisplayMessage = {
        id: `d-c${messages.length}`,
        speaker: "counterpart",
        text: reply,
      };
      setMessages((m) => [...m, counter]);

      if (participantKey) {
        void getStore().appendMessage(participantKey, {
          id: counter.id,
          sessionIndex: taskIndex,
          speaker: "counterpart",
          text: reply,
          createdAt: new Date().toISOString(),
          stage: decision.stage,
          proposal: decision.proposal ?? undefined,
          decidedAction: decision.action,
        });
      }

      setReplies((n) => n + 1);
      // FIRST SETTLEMENT WINS. `onExpire` guards on `settled` and this did
      // not, so a reply still in flight when the clock ran out overwrote the
      // recorded impasse with an agreement — two `negotiation_ended` events
      // for one exchange, and which one survived decided by network timing.
      // The reply delay is 8-25s on a 180s closing clock, so a message sent
      // near the end is genuinely likely to land after zero. Direct has the
      // same shape on a 600s clock, which made this an asymmetry on the
      // primary contrast as well as a bug.
      if (!settledRef.current && (decision.accepts || decision.impasse)) {
        settle(
          decision.accepts ? "agreed" : "impasse",
          decision.accepts ? (decision.proposal ?? sentOffer) : null,
          decision.accepts ? "agreed" : "impasse",
        );
      }
    } finally {
      setPending(false);
    }
  }

  /**
   * The explicit accept: take the counterpart's standing proposal as-is.
   * Deterministic — no model reads the participant's words to decide whether
   * they agreed — and the same control the Direct arm has, so closing works
   * identically across conditions.
   */
  function acceptStanding() {
    if (!lastCounterpartPackage || pending || settled) return;
    setOffer(lastCounterpartPackage);
    void send(
      "that works for me — let's go with that.",
      lastCounterpartPackage,
    );
  }

  return (
    <>
      <Page width="wide">
        <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
          <TaskHeader
            taskIndex={taskIndex}
            title={task.title}
            steps={steps}
            current={stepIndex}
            aside={
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                <span aria-hidden>⏱</span>
                <CountdownTimer
                  seconds={CLOSING_SECONDS}
                  running={!settled}
                  onTick={setSecondsRemaining}
                  onExpire={() => {
                    if (settled) return;
                    settle("impasse", null, "timeout");
                  }}
                />
              </span>
            }
          />

          <ProxyTranscriptPanel transcript={proxyTranscript} />

          <Card className="mb-6 flex flex-col overflow-hidden border-slate-200" padded={false}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5">
              <div>
                <p className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                  💬 Close It Together
                </p>
                <p className="text-xs text-[var(--ink-2)]">
                  {settled === "agreed"
                    ? "✓ You have reached a mutual agreement!"
                    : settled === "impasse"
                      ? "⚠️ The negotiation ended without an agreement."
                      : openingPackage
                        ? "You are talking directly with the other participant. Confirm, adjust, or decline what the proxies reached."
                        : // NO STANDING PACKAGE, and two different things
                          // bring a participant here: they refused what their
                          // proxies reached, or the exchange never produced
                          // one. Either way there is nothing to confirm or
                          // decline — saying otherwise sent them looking for
                          // an Accept button that is correctly not rendered —
                          // but telling a refuser their proxies "did not
                          // settle" contradicts the screen they just left.
                          refused
                          ? "You refused what the proxies reached, so nothing is on the table. Choose a level on each term below, then put it to the other participant."
                          : "Your proxies did not settle on a package. Choose a level on each term below, then put it to the other participant."}
                </p>
              </div>
              {settled ? null : pending ? (
                <Cue tone="quiet">Waiting for reply…</Cue>
              ) : yourTurn ? (
                <Cue>Your Turn</Cue>
              ) : (
                <Cue tone="quiet">Select terms first</Cue>
              )}
            </div>
            <Transcript
              messages={messages}
              pending={pending}
              emptyHint={
                openingPackage
                  ? "The proxies are done. Say hello and settle it — or accept the package below."
                  : "Set the levels you want below, then put them to the other participant."
              }
            />
            <MessageComposer
              value={draft}
              onChange={setDraft}
              onSend={send}
              disabled={pending || !canSend}
              cue={yourTurn}
              placeholder={
                settled
                  ? "This conversation has concluded."
                  : canSend
                    ? "Type your message to the other participant…"
                    : "Please choose an option for each term first."
              }
            />
          </Card>

          {!settled ? (
            <div className="mb-6 flex flex-wrap items-center gap-3">
              {lastCounterpartPackage ? (
                <button
                  type="button"
                  onClick={acceptStanding}
                  disabled={pending}
                  className="rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-2xs transition-colors hover:bg-emerald-100 disabled:opacity-50"
                >
                  ✓ Accept the package on the table
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (!confirmDecline) {
                    setConfirmDecline(true);
                    return;
                  }
                  settle("impasse", null, "declined");
                }}
                disabled={pending}
                className={cx(
                  "rounded-xl border px-4 py-2.5 text-sm font-bold shadow-2xs transition-colors disabled:opacity-50",
                  confirmDecline
                    ? "border-red-400 bg-red-50 text-red-800 hover:bg-red-100"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                )}
              >
                {confirmDecline
                  ? "Really end without an agreement? Click again to confirm."
                  : "✗ End without agreement"}
              </button>
              {confirmDecline ? (
                <button
                  type="button"
                  onClick={() => setConfirmDecline(false)}
                  className="text-xs font-semibold text-slate-500 underline underline-offset-4"
                >
                  Keep talking
                </button>
              ) : null}
            </div>
          ) : null}

          <Card cue={!complete} className="mb-6">
            <CardTitle
              hint="Proposal package currently on the table. Adjust options as you negotiate:"
              aside={
                !complete ? (
                  <Cue>{task.issues.length - chosen} term(s) left</Cue>
                ) : null
              }
            >
              📦 Current Negotiation Package
            </CardTitle>
            <div className="space-y-4 mt-3">
              {task.issues.map((issue) => (
                <div key={issue.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                  <p className="mb-2 text-xs sm:text-sm font-bold text-[var(--ink)]">
                    {issue.label}
                  </p>
                  <OptionChips
                    issue={issue}
                    role={role}
                    name={`direct-${issue.id}`}
                    value={offer[issue.id] ?? null}
                    onChange={(v) =>
                      setOffer((prev) => ({ ...prev, [issue.id]: v }))
                    }
                    allowNone
                    noneLabel="Not specified"
                  />
                </div>
              ))}
            </div>
          </Card>
        </TaskLayout>
      </Page>

      {settled ? (
        <ActionBar
          label="Continue to Review"
          onClick={() =>
            finish(settled, settled === "agreed" ? finalPackage : null)
          }
          note={
            settled === "agreed"
              ? "✓ Agreement reached! Proceed to review."
              : "⚠️ No agreement. Proceed to review."
          }
        />
      ) : (
        <ActionBar
          note={`${chosen} of ${task.issues.length} terms selected${
            secondsRemaining <= 0 ? " · time expired" : ""
          }`}
        />
      )}
    </>
  );
}

const DIRECT_MOCK_REPLIES = [
  "yeah, I watched the whole thing. || honestly I think they landed somewhere reasonable — I can live with where it ended up.",
  "that works for me. || shall we call it settled there?",
  "agreed. good to have it sorted.",
];

export function ProxyTranscriptPanel({
  transcript,
  openByDefault,
}: {
  transcript: DisplayMessage[];
  openByDefault?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(openByDefault));
  if (!transcript.length) return null;

  return (
    <Card className="mb-6 overflow-hidden border-slate-200" padded={false}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left bg-slate-50/80 hover:bg-slate-100/70 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <span className="text-lg">🤖</span>
          <span>
            <span className="block text-xs sm:text-sm font-bold text-slate-900">
              AI Proxy Exchange History
            </span>
            <span className="block text-xs text-slate-500 font-medium">
              {transcript.length} messages exchanged between AI Proxies
            </span>
          </span>
        </span>
        <span className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs">
          {open ? "▲ Hide" : "▼ Show"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-slate-200">
          <Transcript messages={transcript} flow />
        </div>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Phase: rehearsal — questioning your own AI Proxy before it runs
// ---------------------------------------------------------------------------

export function RehearsalChat({
  taskIndex,
  task,
  role,
  policy,
  mandate,
  steps,
  stepIndex,
  onBackToMandate,
  onContinue,
}: {
  taskIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  policy: "user_specified" | "ai_supplemented";
  mandate: Mandate;
  steps: string[];
  stepIndex: number;
  onBackToMandate: () => void;
  onContinue: () => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mockAi = useDevMockAi();

  useDevAutofill(
    () => setDraft("what will you say if they push back on my main term?"),
    `rehearsal-t${taskIndex}`,
  );

  async function record(message: DisplayMessage, blocked?: boolean) {
    if (!participantKey) return;
    await getStore().appendRehearsalMessage(participantKey, {
      id: message.id,
      sessionIndex: taskIndex,
      speaker: message.speaker === "participant" ? "participant" : "proxy",
      text: message.text,
      createdAt: new Date().toISOString(),
      blocked,
      revisionCount: mandate.revisionCount,
    });
  }

  async function ask(text: string) {
    const mine: DisplayMessage = {
      id: `r-you-${messages.length}`,
      speaker: "participant",
      text,
    };
    const history = [...messages, mine];
    setMessages(history);
    void record(mine);
    setPending(true);
    setError(null);

    if (mockAi) {
      await new Promise((r) => setTimeout(r, 500));
      const reply: DisplayMessage = {
        id: `r-proxy-${history.length}`,
        speaker: "participant_proxy",
        text: "I'll hold your main term at the level you set and offer movement on the other two instead. If they push back on it I'll give one of the reasons you've ticked — I won't raise anything you left unticked.",
      };
      setMessages([...history, reply]);
      void record(reply);
      setPending(false);
      return;
    }

    try {
      const response = await fetch("/api/proxy-rehearsal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          role,
          policy,
          mandate,
          history: history.map((m) => ({
            role: m.speaker === "participant" ? "user" : "assistant",
            content: m.text,
          })),
        }),
      });
      const data = (await response.json()) as {
        text?: string;
        blocked?: boolean;
        error?: string;
      };
      if (!response.ok || !data.text) {
        throw new Error(data.error ?? "Could not reach your AI Proxy.");
      }
      const reply: DisplayMessage = {
        id: `r-proxy-${history.length}`,
        speaker: "participant_proxy",
        text: data.text,
      };
      setMessages([...history, reply]);
      void record(reply, data.blocked);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not reach your AI Proxy.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Page width="wide">
        <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
          <TaskHeader
            taskIndex={taskIndex}
            title="Q&A with Your AI Proxy (Optional)"
            steps={steps}
            current={stepIndex}
          />

          <div className="mb-6">
            <Callout title="💬 Ask Anything About Your Instructions" tone="neutral">
              <p className="mb-1 text-sm leading-relaxed text-slate-800">
                You can ask how it plans to open, where it will hold the line, or which reasons it will voice. The other participant cannot see this chat.
              </p>
              <p className="text-xs text-slate-600">
                This check is optional — you can proceed immediately or go back to adjust your mandate instructions.
              </p>
            </Callout>
          </div>

          {error ? (
            <div className="mb-6">
              <Callout tone="warning" title="Notice">
                <p>{error}</p>
              </Callout>
            </div>
          ) : null}

          <Card padded={false} className="flex flex-col overflow-hidden border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5">
              <p className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                🤖 AI Proxy Strategy Consultation
              </p>
            </div>
            <Transcript
              messages={messages}
              pending={pending}
              emptyHint="Ask a question below, e.g. &ldquo;What will you open with?&rdquo; or &ldquo;How will you defend my main priority?&rdquo;"
            />
            <MessageComposer
              value={draft}
              onChange={setDraft}
              onSend={(text) => {
                setDraft("");
                void ask(text);
              }}
              disabled={pending}
              placeholder="Ask your AI Proxy a question…"
              sendLabel="Ask"
              cue={messages.length === 0 && !pending}
            />
          </Card>
        </TaskLayout>
      </Page>

      <ActionBar
        label="Continue to Proxy Negotiation"
        onClick={() => {
          logEvent(
            "rehearsal_finished",
            { turns: messages.filter((m) => m.speaker === "participant").length },
            { sessionIndex: taskIndex },
          );
          onContinue();
        }}
        note="💡 Your AI Proxy has not begun live negotiations yet."
        secondary={
          <button
            type="button"
            onClick={onBackToMandate}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            ← Modify Instructions
          </button>
        }
      />
    </>
  );
}
