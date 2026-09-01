"use client";

/**
 * Phases shared by the Baseline and Proxy tasks (Experimental Design Ver.2.4
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
  NEGOTIATION_SECONDS,
  counterpartStageAfter,
  counterpartStep,
} from "@/lib/negotiation/machine";
import {
  BriefingPanel,
  IssueReasonGroups,
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
              ? "The practice round is over — this one counts. You are settling a schedule with another participant who holds the other role."
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
                instructions for an AI Proxy — what to aim for, how far it may go,
                and which of your reasons it may say out loud — and it puts your
                case for you while you watch.
              </p>
              <p className="text-blue-900">
                The other participant has one too. When the two proxies finish,{" "}
                <strong>you take over and settle it yourself</strong>, with their
                whole conversation on screen. Nothing is agreed until you agree it.
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
        <Card className="mb-6 border-slate-200 bg-white">
          <CardTitle hint="Public context known to both participants:">
            📋 Project Scenario: {task.title}
          </CardTitle>
          <p className="text-sm sm:text-base leading-relaxed text-slate-700 mt-2">
            {task.publicBrief}
          </p>
          <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600 border border-slate-200">
            <span>🌐</span>
            <span>Both parties share the project background above. Your personal goals and situation below are private.</span>
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

export interface Preferences {
  preferred: Record<string, string | null>;
  minimum: Record<string, string | null>;
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
  const [minimum, setMinimum] = useState<Record<string, string | null>>(
    () =>
      initial?.minimum ??
      Object.fromEntries(task.issues.map((i) => [i.id, null])),
  );

  useDevAutofill(() => {
    const best = (issueId: string) => {
      const issue = task.issues.find((i) => i.id === issueId)!;
      return [...issue.options].sort(
        (a, b) => b.points[role] - a.points[role],
      )[0].id;
    };
    const floor = (issueId: string) => {
      const issue = task.issues.find((i) => i.id === issueId)!;
      const ranked = [...issue.options].sort(
        (a, b) => b.points[role] - a.points[role],
      );
      const isRequirement = issueId === task.requirementIssueId[role];
      return isRequirement
        ? ranked[issue.requirementThresholdIndex ?? 1].id
        : ranked[ranked.length - 1].id;
    };
    setPreferred(
      Object.fromEntries(task.issues.map((i) => [i.id, best(i.id)])),
    );
    setMinimum(Object.fromEntries(task.issues.map((i) => [i.id, floor(i.id)])));
  }, `prefs-t${taskIndex}`);

  const missing = task.issues.flatMap((i) => [
    ...(preferred[i.id] ? [] : [`pref-${i.id}`]),
    ...(minimum[i.id] ? [] : [`min-${i.id}`]),
  ]);
  const canContinue = useDevGate(missing.length === 0 && reasonsComplete);

  async function save() {
    if (!canContinue) return;
    const prefs = { preferred, minimum };
    if (participantKey) {
      await getStore().saveResponses(
        participantKey,
        `preferences_t${taskIndex}`,
        { taskId: task.id, role, preferred, minimum },
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
                ? "Configure Your Mandate & Permitted Reasons"
                : "Define Your Initial Preferences"
            }
            steps={steps}
            current={stepIndex}
          />

          <div className="mb-6">
            <Callout tone="private" title="🔒 Strictly Confidential · Your Negotiation Boundaries">
              <p className="text-xs sm:text-sm leading-relaxed">
                {isProxy
                  ? "Tell your AI Proxy where to start and where to stop. It uses these two limits to negotiate safely on your behalf."
                  : "These selections record your starting priorities to measure your agreement. Your counterpart never sees your points or choices."}
              </p>

              {isProxy ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-amber-200 text-xs">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-emerald-950">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <span>🏆</span> 1. Your Best Goal (Opening Ask)
                    </p>
                    <p className="text-2xs sm:text-xs text-emerald-900 leading-relaxed">
                      What you ideally hope to get. Your AI Proxy will ask for this first to aim high.
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-amber-950">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <span>🛡️</span> 2. Your Walkaway Limit (Absolute Minimum)
                    </p>
                    <p className="text-2xs sm:text-xs text-amber-900 leading-relaxed">
                      The lowest option you can accept. If the counterpart pushes back, your proxy may compromise, but <strong>will never agree below this limit</strong>.
                    </p>
                  </div>
                </div>
              ) : null}

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

                <div className="mb-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                      🏆 1. Your Best Goal (Aim high)
                    </p>
                    <span className="text-2xs text-slate-500">Proxy opens asking for this</span>
                  </div>
                  <OptionChips
                    issue={issue}
                    role={role}
                    name={`pref-${issue.id}`}
                    value={preferred[issue.id]}
                    onChange={(v) =>
                      setPreferred((prev) => ({ ...prev, [issue.id]: v }))
                    }
                  />
                </div>

                <div id={`q-min-${issue.id}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-amber-700">
                      🛡️ 2. Your Walkaway Limit (Lowest acceptable)
                    </p>
                    <span className="text-2xs text-slate-500">Proxy will NEVER go below this</span>
                  </div>
                  <OptionChips
                    issue={issue}
                    role={role}
                    name={`min-${issue.id}`}
                    value={minimum[issue.id]}
                    onChange={(v) =>
                      setMinimum((prev) => ({ ...prev, [issue.id]: v }))
                    }
                  />
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-5 space-y-2 rounded-2xl border border-[var(--private-line)] bg-amber-50/50 p-4 sm:p-5 shadow-2xs">
            <PackageValue
              issues={task.issues}
              role={role}
              reservationPoints={task.reservationPoints}
              selection={preferred}
              label="If you achieve your Best Goal"
            />
            <PackageValue
              issues={task.issues}
              role={role}
              reservationPoints={task.reservationPoints}
              selection={minimum}
              label="At your lowest Walkaway Limit"
            />
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
            <li className="flex items-center gap-2 text-emerald-700 font-semibold">
              <span>✓</span> Your mandate instructions locked
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
// Reason attachment (Baseline)
// ---------------------------------------------------------------------------

export function ReasonPicker({
  task,
  role,
  value,
  onChange,
  alreadyVoiced,
}: {
  task: NegotiationTask;
  role: Role;
  value: string | null;
  onChange: (id: string | null) => void;
  alreadyVoiced: string[];
}) {
  const [open, setOpen] = useState(false);
  const cards = task.roleBriefs[role].reasonCards;
  if (!cards.length) return null;

  const selected = cards.find((c) => c.id === value);

  return (
    <div className="border-t border-slate-200 bg-amber-50/50 px-4 py-3 sm:px-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left transition-colors"
      >
        <span className="text-xs sm:text-sm text-[var(--private-ink)] font-medium">
          {selected ? (
            <>
              <span aria-hidden className="mr-1">📎</span> Saying this reason:{" "}
              <span className="font-bold text-slate-900">
                &ldquo;{selected.text.slice(0, 50)}
                {selected.text.length > 50 ? "…" : ""}&rdquo;
              </span>
            </>
          ) : (
            <>
              <span aria-hidden className="mr-1">📎</span> Attach a rationale card to this message (optional)
            </>
          )}
        </span>
        <span className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-900 shadow-2xs hover:bg-amber-50">
          {open ? "▲ Close" : "▼ Choose"}
        </span>
      </button>

      {open ? (
        <div className="mt-3.5 space-y-3">
          <IssueReasonGroups
            task={task}
            role={role}
            renderCard={(card) => (
              <ReasonChoice
                card={card}
                checked={value === card.id}
                voiced={alreadyVoiced.includes(card.id)}
                onToggle={() =>
                  onChange(value === card.id ? null : card.id)
                }
              />
            )}
          />
          <p className="text-xs text-amber-900/80 font-medium">
            💡 You write your own message text — selecting a card records which background rationale you voiced.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ReasonChoice({
  card,
  checked,
  voiced,
  onToggle,
}: {
  card: { id: string; text: string };
  checked: boolean;
  voiced: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all shadow-2xs",
        checked
          ? "border-blue-500 bg-blue-50/80 text-blue-950 ring-2 ring-blue-500/20"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 accent-blue-600"
      />
      <span className="text-xs sm:text-sm leading-relaxed text-slate-800 font-medium">
        {card.text}
        {voiced ? (
          <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-bold text-slate-600">
            already mentioned
          </span>
        ) : null}
      </span>
    </label>
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
  reasonAlreadyVoiced,
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
  reasonAlreadyVoiced: boolean;
  messages: DisplayMessage[];
  setMessages: Dispatch<SetStateAction<DisplayMessage[]>>;
  offer: Package;
  setOffer: Dispatch<SetStateAction<Package>>;
  onSettled: (finalPackage: Package | null) => void;
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
  const [secondsRemaining, setSecondsRemaining] = useState(NEGOTIATION_SECONDS);
  const [attachedReasonId, setAttachedReasonId] = useState<string | null>(null);
  const [voicedReasonIds, setVoicedReasonIds] = useState<string[]>([]);
  const [reasonRequested, setReasonRequested] = useState(false);
  const [lastCounterpartPackage, setLastCounterpartPackage] =
    useState<Package | null>(openingPackage);

  const chosen = task.issues.filter((i) => offer[i.id]).length;
  const complete = chosen === task.issues.length;
  const canSend = useDevGate(complete) && !settled;
  const yourTurn = !pending && canSend && !settled;

  useDevAutofill(() => {
    if (settled) return;
    setDraft(
      replies === 0
        ? `Thanks for going through all that. || the ${requirement.label.toLowerCase()} is the part I really need to hold — that's the one that changes how the work actually goes for me. happy to stay flexible on the rest.`
        : "that works for me. || glad we got there.",
    );
  }, `direct-t${taskIndex}-${replies}`);

  async function send(text: string) {
    const own: DisplayMessage = {
      id: `d-p${messages.length}`,
      speaker: "participant",
      text,
    };
    const next = [...messages, own];
    setMessages(next);
    setDraft("");

    const voiced = attachedReasonId
      ? [...new Set([...voicedReasonIds, attachedReasonId])]
      : voicedReasonIds;
    setVoicedReasonIds(voiced);
    setAttachedReasonId(null);
    const requirementReasonGiven =
      reasonAlreadyVoiced ||
      voiced.some(
        (id) =>
          task.roleBriefs[role].reasonCards.find((c) => c.id === id)
            ?.issueId === requirement.id,
      );

    logEvent(
      "message_sent",
      {
        phase: "direct",
        length: text.length,
        secondsRemaining,
        requirementOption: offer[requirement.id] ?? null,
        reasonCardId: attachedReasonId,
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
        proposal: Object.keys(offer).length > 0 ? offer : undefined,
        reasonCardId: attachedReasonId ?? undefined,
      });
    }

    setPending(true);
    try {
      const stageNow = counterpartStageAfter(replies + DIRECT_STAGE_OFFSET);
      const decision = counterpartStep(
        task,
        counterpartRole,
        stageNow,
        offer,
        lastCounterpartPackage,
        {
          reasonGivenForRequirement: requirementReasonGiven,
          reasonAlreadyRequested: reasonRequested,
          secondsRemaining,
        },
      );
      if (decision.awaitingReason) setReasonRequested(true);

      let reply: string;
      if (mockAi) {
        reply = DIRECT_MOCK_REPLIES[Math.min(replies, DIRECT_MOCK_REPLIES.length - 1)];
        await new Promise((r) => setTimeout(r, 500));
      } else {
        const res = await fetch("/api/counterpart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: task.id,
            participantRole: role,
            stage: stageNow,
            incoming: offer,
            lastCounterpartPackage,
            reasonGiven: requirementReasonGiven,
            reasonAlreadyRequested: reasonRequested,
            secondsRemaining,
            afterProxy: true,
            history: [...messages, own].map((m) => ({
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

      if (decision.proposal) setLastCounterpartPackage(decision.proposal);

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
          stage: stageNow,
          proposal: decision.proposal ?? undefined,
          decidedAction: decision.action,
        });
      }

      setReplies((n) => n + 1);
      if (decision.accepts || decision.impasse) {
        setFinalPackage(decision.accepts ? (decision.proposal ?? offer) : null);
        setSettled(decision.accepts ? "agreed" : "impasse");
        logEvent(
          "negotiation_ended",
          {
            phase: "direct",
            reason: decision.accepts ? "agreed" : "impasse",
            replies: replies + 1,
            secondsRemaining,
          },
          { sessionIndex: taskIndex },
        );
      }
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
            title={task.title}
            steps={steps}
            current={stepIndex}
            aside={
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                <span aria-hidden>⏱</span>
                <CountdownTimer
                  seconds={NEGOTIATION_SECONDS}
                  running={!settled}
                  onTick={setSecondsRemaining}
                  onExpire={() => {
                    if (settled) return;
                    setFinalPackage(null);
                    setSettled("impasse");
                    logEvent(
                      "negotiation_ended",
                      { phase: "direct", reason: "timeout" },
                      { sessionIndex: taskIndex },
                    );
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
                  💬 Direct Chat with Counterpart
                </p>
                <p className="text-xs text-[var(--ink-2)]">
                  {settled === "agreed"
                    ? "✓ You have reached a mutual agreement!"
                    : settled === "impasse"
                      ? "⚠️ The negotiation ended without an agreement."
                      : "You are speaking directly with the other participant."}
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
              emptyHint="Your AI Proxy has completed its turn. Send a message to take over!"
            />
            <ReasonPicker
              task={task}
              role={role}
              value={attachedReasonId}
              onChange={setAttachedReasonId}
              alreadyVoiced={voicedReasonIds}
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
          onClick={() => onSettled(settled === "agreed" ? finalPackage : null)}
          note={
            settled === "agreed"
              ? "✓ Agreement reached! Proceed to review."
              : "⚠️ Impasse recorded. Proceed to review."
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

const DIRECT_STAGE_OFFSET = 3;

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
  policy: "delegate" | "explorer";
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
