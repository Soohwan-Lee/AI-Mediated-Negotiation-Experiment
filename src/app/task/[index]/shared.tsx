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
import Image from "next/image";
import { MeasureBlock, type Answers } from "@/components/measure";
import { NavigationNotice } from "@/components/navigation-notice";
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
import { fetchJsonWithRetry } from "@/lib/negotiation/recoverable-request";
import {
  BriefingPanel,
  ProxyIdentity,
  RoleStory,
  IssueReasonGroups,
  TaskCover,
  type CoverScene,
  TaskHeader,
  TaskLayout,
} from "@/components/session";
import { ProxyFigure } from "@/components/proxy-art";
import { OptionChips, PackageValue, PointsKey, IssueValueTable } from "@/components/issues";
import { ActionBar } from "@/components/study-chrome";
import { ReadingProgress, PreviousReading } from "@/components/briefing-guide";
import { Callout, Card, CardTitle, Cue, Page, PrivateTag, cx } from "@/components/ui";
import { useDevAutofill, useDevGate, useDevMockAi } from "@/lib/dev-mode";
import { dummyAnswer, riskBlock } from "@/lib/measures";
import { comparePointsToFallback } from "@/lib/points-display";
import { useParticipant } from "@/lib/participant-context";
import {
  NEGOTIATION,
  STAGE_MINUTES,
  awaitCounterpartDelay,
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
              : "This is the second and final task. You keep your role, with a new situation, new private information, and a different participant."}
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

/** All pages are read in both modes before RISK or any mandate decision. */
export function TaskBrief({
  taskIndex, task, role, steps, onBack, onContinue,
}: {
  taskIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  onBack: () => void;
  onContinue: () => void;
}) {
  const [page, setPage] = useState(0);
  const { logEvent } = useParticipant();
  const brief = task.roleBriefs[role];
  const taskImage = task.id === "task_a"
    ? "/illustrations/task-working-arrangements.png?v=20260907b"
    : "/illustrations/task-new-project.png?v=20260907b";
  const roleImage = role === "leader"
    ? "/illustrations/role-team-lead.png?v=20260907b"
    : "/illustrations/role-team-member.png?v=20260907b";
  const labels = ["The task", "Your situation", "Your points", "Your reasons"];
  function move(next: number) {
    logEvent("page_complete", { briefingPage: page + 1 }, { sessionIndex: taskIndex });
    setPage(next);
    window.scrollTo({ top: 0 });
  }
  return (
    <>
      <Page>
        <TaskHeader taskIndex={taskIndex} title={labels[page]} steps={steps} current={0} />
        <ReadingProgress labels={labels} current={page} />
        {page === 0 ? (
          <div className="space-y-5">
            <Card>
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div>
                  <CardTitle>{task.title}</CardTitle>
                  <p className="mt-3 text-base leading-relaxed text-slate-700">{task.publicBrief}</p>
                  <p className="mt-3 text-sm text-slate-500">Both people know this project background.</p>
                </div>
                <figure className="overflow-hidden rounded-xl border border-slate-200 bg-[#f4efe5]">
                  <Image
                    src={taskImage}
                    width={1536}
                    height={1024}
                    sizes="(min-width: 1024px) 20rem, (min-width: 640px) 44rem, 100vw"
                    alt={task.id === "task_a"
                      ? "An office schedule beside a shared workstation, and a client presentation room with four blank meeting cards."
                      : "A new-project allocation board, and an idle client-call phone and headset beside a blank rota."}
                    className="h-auto w-full"
                  />
                  <figcaption className="grid grid-cols-2 border-t border-slate-200 bg-white/95 text-xs font-semibold leading-relaxed text-slate-700">
                    <span className="border-r border-slate-200 px-3 py-2.5 text-center">{task.issues[0].label}</span>
                    <span className="px-3 py-2.5 text-center">{task.issues[1].label}</span>
                  </figcaption>
                </figure>
              </div>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2">
              {task.issues.map(issue => <Card key={issue.id}>
                <CardTitle>{issue.label}</CardTitle>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{issue.description}</p>
              </Card>)}
            </div>
            <p className="text-sm text-slate-600">You need one agreed option for each condition. Next, read the information only you know.</p>
          </div>
        ) : page === 1 ? (
          <Card tone="private">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{brief.title} · Your private situation</CardTitle><PrivateTag />
            </div>
            {/*
              The role portrait sits beside the story on a wide screen and above
              it on a narrow one, the same figure treatment page 0 gives the task
              image. It is only here: the briefing rail renders RoleStory in
              compact form with no figure, because a 1536x1024 image in a 13px
              rail would push the story itself off the screen.
            */}
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <RoleStory story={brief.roleStory} />
              <figure className="order-first overflow-hidden rounded-xl border border-[var(--private-line)] bg-[#f4efe5] lg:order-none lg:sticky lg:top-24">
                <Image
                  src={roleImage}
                  width={1536}
                  height={1024}
                  sizes="(min-width: 1024px) 16rem, (min-width: 640px) 44rem, 100vw"
                  alt={role === "leader"
                    ? "A team lead at a desk facing a planning board, with the team working behind them."
                    : "A senior team member at their own desk, with a client meeting room behind them."}
                  className="h-auto w-full"
                />
                <figcaption className="border-t border-[var(--private-line)] bg-white/95 px-3 py-2.5 text-center text-xs font-semibold leading-relaxed text-[var(--private-strong)]">
                  You in this task · {brief.title}
                </figcaption>
              </figure>
            </div>
          </Card>
        ) : page === 2 ? (
          <Card tone="private">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Your goals and point sheet</CardTitle><PrivateTag />
            </div>
            <ul className="mb-5 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              {brief.objectives.map(objective => <li key={objective}>{objective}</li>)}
            </ul>
            <IssueValueTable issues={task.issues} role={role} reservationPoints={task.reservationPoints} />
            <p className="mt-5 text-sm leading-relaxed">{brief.batnaSummary}</p>
            <p className="mt-3 text-sm font-semibold">The other person cannot see these values. Do not share point numbers in the conversation.</p>
          </Card>
        ) : (
          <Card tone="private">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <CardTitle>What you can explain</CardTitle><PrivateTag />
            </div>
            <p className="mb-4 text-sm leading-relaxed">{brief.requirementNote}</p>
            <IssueReasonGroups task={task} role={role} />
            <p className="mt-4 text-sm leading-relaxed">{brief.disclosureRisk}</p>
            <p className="mt-4 text-sm leading-relaxed">You choose what to share. Sensitive background is optional: you can negotiate and agree without sharing it. These are the facts of your role; you do not need to use the exact wording.</p>
          </Card>
        )}
      </Page>
      <ActionBar
        label={page === 3 ? "Continue to two short questions" : `Next: ${labels[page + 1].toLowerCase()}`}
        onClick={() => {
          if (page < 3) move(page + 1);
          else {
            logEvent("page_complete", { briefingPage: 4 }, { sessionIndex: taskIndex });
            onContinue();
            window.scrollTo({ top: 0 });
          }
        }}
        secondary={
          <PreviousReading
            onClick={() => (page > 0 ? move(page - 1) : onBack())}
          />
        }
        note={`Briefing ${page + 1} of 4 · Available throughout the task`}
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
  identity,
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
  /* The Proxy arm's representative, shown above the term cards. Direct passes
     none — there is nobody to brief — and the two term cards below are
     byte-for-byte the same in both arms (§5 principle 4). */
  identity?: ReactNode;
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
            title={isProxy ? "Brief your AI Proxy" : "Choose your starting goals"}
            steps={steps}
            current={stepIndex}
          />

          {identity ? <div className="mb-6">{identity}</div> : null}

          <div className="mb-6">
            <Callout
              tone="private"
              title={
                isProxy
                  ? "🔒 Private to you · Your instructions"
                  : "🔒 Private to You · Set Your Goals"
              }
            >
              <p className="text-xs sm:text-sm leading-relaxed">
                Select the option you would like to aim for on each condition. This form is private.{" "}
                {isProxy
                  ? "These are the instructions your AI Proxy will follow: it aims for the options you pick here and says only the reasons you tick below."
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

          {/* THE TWO SECTIONS ARE THE PROXY'S TWO QUESTIONS, ANSWERED. In the
              Proxy arm the screen above it is a representative asking where to
              aim and what it may say; without headings the participant answers
              two questions that were asked as one. Direct passes no identity
              and gets no heading — there is nobody asking, and a heading
              reading "where I should aim" with no speaker would be nonsense.

              THE HEADING IS ABOUT BOTH TERMS AT ONCE and names neither, which
              is what §5 principle 1 requires: a per-issue heading would point
              at the term the study is about. The two term cards under it stay
              byte-for-byte identical, as they are in Direct. */}
          {isProxy ? (
            <div className="mb-3.5 flex items-baseline gap-2.5">
              <span
                aria-hidden
                className="flex h-6 w-6 shrink-0 translate-y-0.5 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-800"
              >
                1
              </span>
              <p className="min-w-0">
                <span className="text-base font-extrabold tracking-tight text-[var(--ink)]">
                  Where I should aim
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-3)] sm:text-sm">
                  Pick the option you want me to open on, for each condition.
                </span>
              </p>
            </div>
          ) : null}

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

          {reasons ? (
            <div className="mt-8">
              {/* Second half of the same act, and the numbering says so. Still
                  a section BELOW both term cards, never nested in one of them
                  (§5 principle 4): nesting would make one term card visibly
                  taller and carry a control the other does not, which names
                  the study's term without a word. */}
              <div className="mb-3.5 flex items-baseline gap-2.5">
                <span
                  aria-hidden
                  className="flex h-6 w-6 shrink-0 translate-y-0.5 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-800"
                >
                  2
                </span>
                <p className="min-w-0">
                  <span className="text-base font-extrabold tracking-tight text-[var(--ink)]">
                    What I may say for you
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-3)] sm:text-sm">
                    Tick anything I&rsquo;m allowed to say out loud.
                  </span>
                </p>
              </div>
              {reasons}
            </div>
          ) : null}
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
  const comparison = comparePointsToFallback(mine, task.reservationPoints);
  const breakdown = terms
    ? task.issues.map((issue) => {
        const option = issue.options.find((candidate) => candidate.id === terms[issue.id]);
        return {
          issueId: issue.id,
          issueLabel: issue.label,
          optionLabel: option?.label ?? "Not settled",
          points: option?.points[role] ?? 0,
        };
      })
    : [];
  const held = terms
    ? preservesRequirement(task, role, terms[requirement.id])
    : false;

  return (
    <Card tone="private" className="border-amber-300 bg-amber-50/60 text-[var(--private-ink)] shadow-2xs">
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
          Your points
        </p>
        <h3 className="mt-1 text-base font-bold text-[var(--ink)]">
          {terms ? "Confirmed result" : "No agreement"}
        </h3>
      </div>

      {terms ? (
        <dl className="space-y-2.5">
          {breakdown.map((row) => (
            <div key={row.issueId} className="rounded-xl border border-amber-200/80 bg-white/80 p-3">
              <dt className="text-xs font-semibold leading-snug text-[var(--private-ink)]">
                {row.issueLabel}
              </dt>
              <dd className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-xs leading-snug text-[var(--private-ink)]/80">
                  {row.optionLabel}
                </span>
                <strong className="shrink-0 text-sm tabular-nums text-[var(--ink)]">
                  {row.points.toLocaleString()} pts
                </strong>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="rounded-xl border border-amber-200/80 bg-white/80 p-3 text-sm leading-relaxed">
          There are no agreed terms to break down. Your fallback total applies.
        </p>
      )}

      <div className="mt-3 border-t border-amber-200 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-bold text-[var(--ink)]">
            {terms ? "Final total" : "Fallback total"}
          </span>
          <span className="shrink-0 text-xl font-black tabular-nums text-amber-950">
            {mine.toLocaleString()} pts
          </span>
        </div>
        {terms ? (
          <p className="mt-1 text-xs leading-relaxed text-[var(--private-ink)]/80">
            {comparison === "above"
              ? `${(mine - task.reservationPoints).toLocaleString()} points above your fallback.`
              : comparison === "below"
                ? `${(task.reservationPoints - mine).toLocaleString()} points below your fallback.`
                : "Equal to your fallback."}
          </p>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-[var(--private-ink)]/80">
            No agreement reached, so the fallback score applies.
          </p>
        )}
      </div>
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
        <div className="mt-3 border-t border-amber-200/80 pt-3 text-xs sm:text-sm font-medium leading-relaxed text-[var(--private-ink)]">
          {held
            ? "This agreement meets the level you said you needed."
            : "This agreement is below the level you said you needed."}
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

type ClosingReasonLabel = "none" | "WR" | "PRI" | "SB";

interface ClosingClassification {
  label: ClosingReasonLabel;
  confidence?: number;
  stubbed?: boolean;
}

interface ClosingStagedTurn {
  text: string;
  sentOffer: Package;
  sentPackage: Package | null;
  ownId: string;
  createdAt: string;
  secondsAtSend: number;
  classification?: ClosingClassification;
}

interface ClosingCounterpartResponse {
  message: string;
  proposal?: Package | null;
}

function isClosingClassification(value: unknown): value is ClosingClassification {
  if (typeof value !== "object" || value === null || !("label" in value)) return false;
  if (!["none", "WR", "PRI", "SB"].includes(String(value.label))) return false;
  if ("confidence" in value && value.confidence !== undefined &&
      (typeof value.confidence !== "number" || !Number.isFinite(value.confidence) ||
       value.confidence < 0 || value.confidence > 1)) return false;
  return true;
}

function isClosingCounterpartResponse(value: unknown): value is ClosingCounterpartResponse {
  return typeof value === "object" && value !== null &&
    "message" in value && typeof value.message === "string" &&
    value.message.trim().length > 0;
}

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
  const [turnError, setTurnError] = useState<string | null>(null);
  const [stagedTurn, setStagedTurn] = useState<ClosingStagedTurn | null>(null);
  const [recovering, setRecovering] = useState(false);
  const recoveryStartedAt = useRef<number | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const turnGeneration = useRef(0);
  const mounted = useRef(true);
  const expiryPending = useRef(false);
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
  /**
   * SCRIPT-MISREAD is once per task, and the flag has to travel — identical
   * to the Direct arm's. Untracked it did two things at once: the counterpart
   * could re-offer the misread on every work-rung turn, and
   * `acceptablePackage` would refuse its own good-faith offer when the
   * participant took it (§6.2 keeps the misread acceptable once made).
   */
  const [misreadOffered, setMisreadOffered] = useState(false);
  const [lastCounterpartPackage, setLastCounterpartPackage] =
    useState<Package | null>(openingPackage);
  /**
   * The rung the standing package was put up at.
   *
   * "✓ Accept the package on the table" sends that package back through the
   * machine, and the machine accepts only the CURRENT tier's package. So once
   * a message raises the tier, the package still on screen is superseded: the
   * machine answers `propose_tier` with `accepts: false` and the button does
   * nothing visible, on the one control that exists so no model has to read
   * the participant's words to decide whether they agreed.
   *
   * The rule is deliberately narrow — clear it only when a counterpart turn
   * brings no replacement package AND the tier has moved past the rung this
   * one was offered at. A turn that carries a proposal replaces it anyway,
   * and a tier that has not moved leaves it acceptable, so neither case may
   * take a live Accept button away from the participant.
   *
   * The proxies' opening package is seeded at the tier the proxies earned.
   */
  const [standingTier, setStandingTier] = useState<ReasonTier>(proxyVoicedTier);
  /** Synchronous mirror of `settled`, so two callers in one tick cannot both win. */
  const settledRef = useRef(false);
  /**
   * The proposal drawer opens ONCE, by itself, the first time the counterpart
   * puts a package on the table — identical to the Direct arm's rule and for
   * the same reason. It is seeded open when the participant arrives carrying
   * the proxies' package, because that package IS what this conversation is
   * about: the screen tells them to confirm or adjust it, so the
   * thing being confirmed cannot start hidden.
   */
  const [proposalOpen, setProposalOpen] = useState(Boolean(openingPackage));
  const openedOnCounterProposal = useRef(Boolean(openingPackage));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      turnGeneration.current += 1;
      activeRequest.current?.abort();
    };
  }, []);

  // THE PACKAGE IS OPTIONAL IN BOTH ARMS, and it has to be: this screen and
  // the Direct arm's are the two places a participant speaks for themselves,
  // so an interface difference between them would land on
  // `Pooled Proxy − Direct` itself. A HALF package is still refused, quietly,
  // for the same reason — it is not a position anyone can answer, and the
  // machine would read it as a lopsided proposal rather than as talk.
  const chosen = task.issues.filter((i) => offer[i.id]).length;
  const complete = chosen === task.issues.length;
  const partial = chosen > 0 && !complete;
  /**
   * What will travel with the next message, said on the closed drawer —
   * identical to the Direct arm's, and load-bearing for the same reason: the
   * package is pre-filled here too (from the proxies' own settlement), so a
   * collapsed drawer without this would have the participant send a package
   * they never saw attached.
   */
  const attachedSummary = partial
    ? "Choose both terms, or neither."
    : complete
      ? `Attached to your next message: ${task.issues
          .map(
            (issue) =>
              issue.options.find((o) => o.id === offer[issue.id])?.label ?? "",
          )
          .filter(Boolean)
          .join(" · ")}`
      : "No proposal attached — you are just talking.";
  const canSend = useDevGate(!partial) && !settled;
  // One cue on the screen, and it is the composer's (interface rule 9). The
  // package card is not waiting for anything now that a message may be sent
  // without one, so it carries no ring and no pill.
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
    committed?: {
      replies: number;
      secondsRemaining: number;
      tier: ReasonTier;
      selfDisclosed: boolean;
    },
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
        replies: committed?.replies ?? replies,
        secondsRemaining: committed?.secondsRemaining ?? secondsRemaining,
        tier: committed?.tier ?? tier,
        selfDisclosed: committed?.selfDisclosed ?? selfDisclosed,
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
    // How it ended is already on the `negotiation_ended` event that `settle()`
    // writes, which is where an audit looks for it. Only "timeout" and
    // "agreed" reach it now: the participant-initiated "declined" route was
    // removed so both arms end the same three ways (see the composer below).
    onSettled(kind === "agreed" ? pkg : null, { selfDisclosed });
  }

  function beginRecovery() {
    if (recoveryStartedAt.current !== null) return;
    recoveryStartedAt.current = Date.now();
    setRecovering(true);
  }

  function finishRecovery() {
    const startedAt = recoveryStartedAt.current;
    if (startedAt === null) return;
    recoveryStartedAt.current = null;
    setRecovering(false);
    logEvent(
      "technical_pause",
      { durationMs: Date.now() - startedAt },
      { sessionIndex: taskIndex },
    );
  }

  async function runStagedTurn(initialTurn: ClosingStagedTurn) {
    const generation = turnGeneration.current + 1;
    turnGeneration.current = generation;
    const controller = new AbortController();
    activeRequest.current?.abort();
    activeRequest.current = controller;
    setPending(true);
    setTurnError(null);
    let turn = initialTurn;

    const failedAttempt = () => {
      if (mounted.current && generation === turnGeneration.current && !settledRef.current) {
        beginRecovery();
      }
    };

    try {
      let classification = turn.classification;
      if (!classification) {
        classification = mockAi
          ? { label: "none" }
          : await fetchJsonWithRetry<ClosingClassification>(
              "/api/classify-reason",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ taskId: task.id, role, message: turn.text }),
              },
              {
                signal: controller.signal,
                onFailure: failedAttempt,
                validate: isClosingClassification,
              },
            );
        turn = { ...turn, classification };
        if (mounted.current && generation === turnGeneration.current) {
          setStagedTurn(turn);
        }
      }

      const { label, confidence, stubbed: classifierStubbed = false } = classification;
      const personalNow = foldTier(personalTier, LABEL_TIER[label]);
      const selfDisclosedNow = selfDisclosed || label === "SB";
      const tierNow: ReasonTier = foldTier(proxyVoicedTier, personalNow);
      const own: DisplayMessage = {
        id: turn.ownId,
        speaker: "participant",
        text: turn.text,
      };
      const next = [...messages, own];
      const turnStartedAt = Date.now();
      const stageNow = counterpartStageAfter(replies + DIRECT_STAGE_OFFSET);
      const mentioned = numbersEver || mentionsScoreNumbers(turn.text);
      const decision = counterpartStep(task, counterpartRole, stageNow, turn.sentPackage, {
        tier: tierNow,
        disclosurePolicy: "fixed",
        askedWhy,
        misreadOffered,
        numbersReminded,
        numbersMentionedNow: mentioned,
        secondsRemaining: turn.secondsAtSend,
        softCloseOffered,
      });
      let reply: string;
      if (mockAi) {
        reply = decision.accepts
          ? DIRECT_MOCK_REPLIES[1]
          : DIRECT_MOCK_REPLIES[Math.min(replies, DIRECT_MOCK_REPLIES.length - 1)];
      } else {
        const data = await fetchJsonWithRetry<ClosingCounterpartResponse>(
          "/api/counterpart",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            taskId: task.id,
            participantRole: role,
            stage: stageNow,
            incoming: turn.sentPackage,
            tier: tierNow,
            askedWhy,
            misreadOffered,
            numbersReminded,
            // Sent, not re-derived server-side: the client codes the outcome
            // from its own `counterpartStep`, so every input to that call has
            // to reach the route unchanged or the two can disagree about
            // whether the exchange was agreed.
            numbersMentionedNow: mentioned,
            secondsRemaining: turn.secondsAtSend,
            softCloseOffered,
            disclosurePolicy: "fixed",
            afterProxy: true,
            history: next.map((m) => ({
              role: m.speaker === "participant" ? "user" : "assistant",
              content: m.text,
            })),
            }),
          },
          {
            signal: controller.signal,
            onFailure: failedAttempt,
            validate: isClosingCounterpartResponse,
          },
        );
        reply = data.message;
      }

      // One delay for both branches, counting the generation time already
      // spent. Same fix and same reason as the Direct arm: the budget used to
      // apply only to the live branch, so mockup mode replied in 500ms, and it
      // was ADDED to the model's own latency rather than absorbing it.
      await awaitCounterpartDelay(reply.length, turnStartedAt);

      if (!mounted.current || generation !== turnGeneration.current || settledRef.current) return;

      setPersonalTier(personalNow);
      setSelfDisclosed(selfDisclosedNow);
      setNumbersEver(mentioned);
      if (decision.action === "ask_why") setAskedWhy(true);
      if (decision.action === "nonum") setNumbersReminded(true);
      if (decision.action === "soft_close") setSoftCloseOffered(true);
      if (decision.action === "misread") setMisreadOffered(true);

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
        setStandingTier(tierNow);
        setOffer(decision.proposal);
        // The drawer opens itself the FIRST time a package arrives, so
        // countering it is one click away. Once only, and identical to the
        // Direct arm's rule.
        if (!openedOnCounterProposal.current) {
          openedOnCounterProposal.current = true;
          setProposalOpen(true);
        }
      } else if (tierNow !== standingTier) {
        // See `standingTier`: nothing came back to replace it and the rung has
        // moved, so the package on screen can no longer be accepted. Take the
        // button away rather than leave one that silently does nothing.
        setLastCounterpartPackage(null);
        setStandingTier(tierNow);
      }

      const counter: DisplayMessage = {
        id: `d-c${next.length}`,
        speaker: "counterpart",
        text: reply,
      };
      setMessages([...next, counter]);
      setReplies((n) => n + 1);
      setStagedTurn(null);
      setDraft("");
      setTurnError(null);

      logEvent(
        "message_sent",
        {
          phase: "direct",
          length: turn.text.length,
          secondsRemaining: turn.secondsAtSend,
          requirementOption: turn.sentOffer[requirement.id] ?? null,
          reasonLabel: label,
          reasonConfidence: confidence,
          classifierStubbed,
          tier: tierNow,
        },
        { sessionIndex: taskIndex },
      );

      if (participantKey) {
        void getStore().appendMessage(participantKey, {
          id: own.id,
          sessionIndex: taskIndex,
          speaker: "participant",
          text: turn.text,
          createdAt: turn.createdAt,
          stage: counterpartStageAfter(replies + DIRECT_STAGE_OFFSET - 1),
          proposal: turn.sentPackage ?? undefined,
          reasonLabel: label,
          reasonConfidence: confidence,
        });
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

      finishRecovery();
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
          decision.accepts ? (decision.proposal ?? turn.sentPackage) : null,
          decision.accepts ? "agreed" : "impasse",
          {
            replies: replies + 1,
            secondsRemaining,
            tier: tierNow,
            selfDisclosed: selfDisclosedNow,
          },
        );
      } else if (!settledRef.current && expiryPending.current) {
        settle("impasse", null, "timeout", {
          replies: replies + 1,
          secondsRemaining: 0,
          tier: tierNow,
          selfDisclosed: selfDisclosedNow,
        });
      }
    } catch (error) {
      if (!mounted.current || generation !== turnGeneration.current || settledRef.current) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("[turn] recovery required", error);
      beginRecovery();
      setStagedTurn(turn);
      setTurnError("Your message is still here. Select Retry.");
    } finally {
      if (mounted.current && generation === turnGeneration.current) {
        setPending(false);
        activeRequest.current = null;
      }
    }
  }

  async function send(text: string, sentOffer: Package = offer) {
    if (pending || stagedTurn || settledRef.current) return;
    const immutableOffer = { ...sentOffer };
    const turn: ClosingStagedTurn = {
      text,
      sentOffer: immutableOffer,
      sentPackage: Object.keys(immutableOffer).length > 0 ? immutableOffer : null,
      ownId: `d-p${messages.length}`,
      createdAt: new Date().toISOString(),
      secondsAtSend: secondsRemaining,
    };
    setStagedTurn(turn);
    setDraft("");
    await runStagedTurn(turn);
  }

  /**
   * The explicit accept: take the counterpart's standing proposal as-is.
   * Deterministic — no model reads the participant's words to decide whether
   * they agreed — and the same control the Direct arm has, so closing works
   * identically across conditions.
   */
  function acceptStanding() {
    if (!lastCounterpartPackage || pending || stagedTurn || settled) return;
    setOffer(lastCounterpartPackage);
    void send(
      "that works for me — let's go with that.",
      lastCounterpartPackage,
    );
  }

  return (
    <>
      <Page width="wide">
        <TaskLayout
          composerBelow
          briefing={<BriefingPanel task={task} role={role} />}
        >
          <TaskHeader
            taskIndex={taskIndex}
            title={task.title}
            steps={steps}
            current={stepIndex}
          />

          <NavigationNotice className="mb-3" />

          <ProxyTranscriptPanel transcript={proxyTranscript} />

          <div className="sticky top-[calc(var(--header-h)+0.25rem)] z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/95 px-4 py-3 shadow-sm backdrop-blur-md sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                  💬 Close It Together
                </p>
                <p className="text-xs text-[var(--ink-2)] leading-relaxed break-words">
                  {settled === "agreed"
                    ? "✓ You have reached a mutual agreement!"
                    : settled === "impasse"
                      ? "⚠️ The negotiation ended without an agreement."
                      : openingPackage
                        ? "You are talking directly with the other participant. Confirm or adjust what the proxies reached."
                        : // NO STANDING PACKAGE, and two different things
                          // bring a participant here: they refused what their
                          // proxies reached, or the exchange never produced
                          // one. Either way there is nothing to confirm or
                          // adjust — saying otherwise sent them looking for
                          // an Accept button that is correctly not rendered —
                          // but telling a refuser their proxies "did not
                          // settle" contradicts the screen they just left.
                          //
                          // NEITHER LINE TELLS THEM TO PICK LEVELS FIRST any
                          // more. A message may be sent with no package at
                          // all, so an instruction to choose levels before
                          // speaking would describe a gate that no longer
                          // exists — and would put the selector back at the
                          // centre of a screen whose subject is the
                          // conversation.
                          refused
                          ? "You refused what the proxies reached, so nothing is on the table. Talk it through with the other participant, and attach a proposal below when you want to put one up."
                          : "Your proxies did not settle on a package. Talk it through with the other participant, and attach a proposal below when you want to put one up."}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <CountdownTimer
                  seconds={CLOSING_SECONDS}
                  running={!settled && !recovering}
                  paused={recovering}
                  onTick={setSecondsRemaining}
                  onExpire={() => {
                    if (settledRef.current) return;
                    if (activeRequest.current || stagedTurn) {
                      expiryPending.current = true;
                      return;
                    }
                    settle("impasse", null, "timeout");
                  }}
                />
                {settled ? null : recovering && pending ? (
                  <Cue tone="quiet">Reconnecting…</Cue>
                ) : recovering ? null : pending ? (
                  <Cue tone="quiet">Waiting for reply…</Cue>
                ) : yourTurn ? (
                  <Cue>Your Turn</Cue>
                ) : null}
              </div>
              {turnError ? (
                <div
                  className="flex basis-full flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
                  role="alert"
                >
                  <p className="text-sm font-medium text-red-800">{turnError}</p>
                  <button
                    type="button"
                    onClick={() => stagedTurn && void runStagedTurn(stagedTurn)}
                    disabled={pending || !stagedTurn}
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-bold text-red-800 disabled:opacity-50"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
          </div>

          <Card className="mb-6 flex flex-col border-slate-200" padded={false}>
            <Transcript
              messages={messages}
              pending={pending}
              emptyHint={
                openingPackage
                  ? "The proxies are done. Say hello and settle it — or accept the package below."
                  : "Write to the other participant to get started."
              }
            />
            <MessageComposer
              value={stagedTurn?.text ?? draft}
              onChange={setDraft}
              onSend={send}
              disabled={pending || Boolean(stagedTurn) || !canSend}
              cue={yourTurn}
              placeholder={
                settled
                  ? "This conversation has concluded."
                  : canSend
                    ? "Type your message to the other participant…"
                    : "Choose both terms below, or neither, before sending."
              }
            />
          </Card>

          {/* NO PARTICIPANT-INITIATED IMPASSE. A closing conversation ends the
              same three ways as the Direct arm's: a package the counterpart
              accepts by the ladder, this explicit Accept, or the clock. The
              "End without agreement" control was only ever here, so it gave
              the Proxy arm a route to the 600 fallback that Direct has no
              counterpart for — on the primary contrast, taken by the
              participant rather than by the machine. Restore it only in BOTH
              arms at once, if at all. */}
          {!settled && lastCounterpartPackage ? (
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={acceptStanding}
                disabled={pending || Boolean(stagedTurn)}
                className="rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-2xs transition-colors hover:bg-emerald-100 disabled:opacity-50"
              >
                ✓ Accept the package on the table
              </button>
            </div>
          ) : null}

          {/* THE PROPOSAL SELECTOR, DEMOTED — identical in copy, position and
              behaviour to the Direct arm's (baseline-task.tsx). The two must
              match: these are the two places a participant speaks for
              themselves, so any difference between them lands on
              `Pooled Proxy − Direct`, which is the contrast the study is
              built to make. If you change one, change the other in the same
              commit. */}
          <details
            open={proposalOpen}
            onToggle={(e) => setProposalOpen(e.currentTarget.open)}
            className="mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]"
          >
            <summary className="cursor-pointer list-none rounded-[var(--radius-lg)] px-5 py-4 sm:px-7">
              <span className="flex items-center justify-between gap-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold leading-snug tracking-tight text-[var(--ink)] sm:text-lg">
                    📦 Attach a proposal (optional)
                  </span>
                  {/* Live, not a static hint — see the Direct arm. */}
                  <span className="mt-1 block text-sm leading-relaxed text-[var(--ink-3)]">
                    {attachedSummary}
                  </span>
                </span>
                <span className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--ink-2)]">
                  {proposalOpen ? "▲ Hide" : "▼ Show"}
                </span>
              </span>
            </summary>
            <fieldset
              disabled={pending || Boolean(stagedTurn)}
              className="space-y-4 px-5 pb-5 disabled:opacity-60 sm:px-7 sm:pb-7"
            >
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
              {/* A half package is the one blocked state, said quietly in the
                  SUMMARY so it is visible with the drawer shut. No cue ring
                  and no pill (interface rule 9). */}
            </fieldset>
          </details>
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
        // No term count: selecting terms is not outstanding business any
        // more. Same line as the Direct arm's.
        <ActionBar note={secondsRemaining <= 0 ? "Time expired" : undefined} />
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
      // The participant's OWN proxy, which is openly an AI — so this one does
      // not need a human's typing rhythm, only enough of a beat that the
      // answer does not appear in the same frame as the question.
      await new Promise((r) => setTimeout(r, 1400 + Math.random() * 900));
      const reply: DisplayMessage = {
        id: `r-proxy-${history.length}`,
        speaker: "participant_proxy",
        text: "I'll hold your main term at the level you set and offer movement on the other term instead. If they push back on it I'll give one of the reasons you've ticked — I won't raise anything you left unticked.",
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
        <TaskLayout
          composerBelow
          briefing={<BriefingPanel task={task} role={role} />}
        >
          <TaskHeader
            taskIndex={taskIndex}
            title="Meet your AI Proxy (optional)"
            steps={steps}
            current={stepIndex}
          />

          {/* The same representative as the mandate and the confirm sheet, so
              the four screens read as one delegation rather than four forms.
              Here it speaks as the thing being QUESTIONED — it has the
              instructions in hand and is offering to be checked. The policy
              sentence inside it is the only thing that differs between the two
              policies.

              IT MAY NOT INVITE A CHANGE IN EITHER DIRECTION. "Ask me anything"
              is neutral; "are you sure you want to hold that back?" would be a
              nudge on the primary outcome, and so would its opposite. No scene
              here either: the exchange has not started, and drawing the table
              would say it had. */}
          <div className="mb-6">
            <ProxyIdentity
              policy={policy}
              status="I have your instructions"
              speech={
                <p>
                  I have what you gave me. Before I go in, ask me anything you
                  like — how I&rsquo;ll open, how I&rsquo;ll answer if they push
                  back, or what I will and won&rsquo;t say. You can still change
                  your instructions after.
                </p>
              }
            />
          </div>

          <div className="mb-6">
            <Callout title="This chat is only between you and your proxy" tone="neutral">
              <p className="mb-1 text-sm leading-relaxed text-slate-800">
                The other participant cannot see it, and nothing you say here is
                proposed or agreed to anyone. Your proxy has not begun
                negotiating.
              </p>
              <p className="text-xs text-slate-600">
                This step is optional — you can go straight on, or go back and change your instructions.
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
            {/* The figure sits ON the chat, so the thing being questioned is
                visibly the same one briefed on the screen before and watched
                on the screen after. */}
            <div className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 sm:px-5">
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 ring-1 ring-indigo-100"
              >
                <ProxyFigure side="mine" size={24} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs sm:text-sm font-bold text-[var(--ink)]">
                  Your AI Proxy
                </span>
                <span className="block text-[0.6875rem] leading-tight text-[var(--ink-3)]">
                  Answering your questions
                </span>
              </span>
            </div>
            <Transcript
              messages={messages}
              pending={pending}
              // The participant's own proxy, not the counterpart.
              pendingSpeaker="participant_proxy"
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
