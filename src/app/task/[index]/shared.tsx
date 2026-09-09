"use client";

/**
 * Phases shared by the Direct and Proxy tasks (Experimental Design Ver.2.4
 * §8).
 *
 * The opening order matters and is not arbitrary:
 *
 *   brief → levels (+ reason cards, in Proxy) → negotiate
 *
 * THE LEVELS follow the briefing. They are the first point on the trajectory the study
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
  NUDGE_AFTER_SILENT_SECONDS,
  codeOutcome,
  counterpartStageAfter,
  counterpartStep,
  foldTier,
  LABEL_TIER,
  mentionsScoreNumbers,
  type ExchangeState,
  type ReasonTier,
  type SbTiming,
} from "@/lib/negotiation/machine";
import { fetchJsonWithRetry } from "@/lib/negotiation/recoverable-request";
import {
  INITIAL_EXCHANGE_STATE,
  foldExchangeState,
  isClassificationResponse,
  isCounterpartResponse,
  resolveCounterTerms,
  storedLabel,
  takeExchangeState,
  mockClassify,
  type ClassificationResponse,
  type ClassifierLogEntry,
  type CounterpartResponse,
  type HeldExchangeState,
} from "./turn-contract";
import {
  BriefingPanel,
  RoleStory,
  IssueReasonGroups,
  TaskCover,
  type CoverScene,
  TaskHeader,
  TaskLayout,
} from "@/components/session";
import { DirectFlowSteps, ProxyFlowSteps } from "@/components/proxy-art";
import { OptionChips, PackageValue, IssueValueTable } from "@/components/issues";
import { ActionBar } from "@/components/study-chrome";
import { ReadingProgress, PreviousReading } from "@/components/briefing-guide";
import { Card, CardTitle, Cue, Page, PrivateTag, cx } from "@/components/ui";
import { useDevAutofill, useDevGate, useDevMockAi } from "@/lib/dev-mode";
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
  cardOfLayer,
  packageValue,
  preservesRequirement,
  requirementIssue,
} from "@/lib/tasks";
// MOCKUP MODE ONLY. The offline stand-in for P5 reuses the guardrail's
// vocabulary matcher rather than inventing a second one; see `mockClassify`.
import { leaksForbiddenReason } from "@/lib/ai/reason-leak";
import type {
  Issue,
  NegotiationTask,
  Package,
  Role,
} from "@/lib/types";

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
  scene,
  minutes,
  onStart,
}: {
  taskIndex: 1 | 2;
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
              ? "The practice round is over. You are settling two working conditions with another participant who holds the other role."
              : "This is the second and final task. You keep your role. New situation, new private information, and a different participant."}
          </p>

          {/* WHAT AN AI PROXY IS, ON THE FIRST SCREEN THAT MENTIONS ONE.
              This used to arrive on the mandate screen, under the levels a
              participant had already been asked to set — so the first time they
              met the idea, they were mid-decision about it. The cover is the
              orientation screen; this is where it belongs.

              Keyed off `scene`, which the interface already varies, so it names
              no condition (deception item 2). Both arms get the same amount of
              orientation, which is also what keeps the two covers matched. */}
          {/* DRAWN STEPS IN BOTH ARMS, IN THE SAME WRAPPER (round six).
              The Proxy cover has had four illustrated cards since Ver.2.20;
              Direct had a blue callout of two sentences. That is an
              orientation difference between the two arms on the screen where
              a participant decides whether the study is worth an hour, and it
              sits inside `Pooled Proxy − Direct`. Same wrapper, same heading
              weight, same card treatment; only the number of steps differs,
              which is a fact about the two interfaces rather than a
              difference in how much orientation each arm gets.

              NEITHER ROW DRAWS A CONDITION (interface rule 10). Both
              components take no policy, and User-Specified and
              AI-Supplemented get the same four cards. */}
          {scene === "proxy" ? (
            <div className="mb-3">
              <p className="mb-2.5 font-bold text-blue-950">
                <span aria-hidden>🤖</span>{" "}
                In this task, an AI Proxy speaks for you.
              </p>
              <ProxyFlowSteps />
            </div>
          ) : (
            <div className="mb-3">
              <p className="mb-2.5 font-bold text-blue-950">
                <span aria-hidden>💬</span>{" "}
                In this task, you talk to the other participant yourself.
              </p>
              <DirectFlowSteps />
            </div>
          )}

          <p className="text-slate-600 text-sm">
            Your private briefing stays pinned in the sidebar the whole time.
            Neither of you can settle anything alone.
          </p>
        </>
      }
      /* BOTH COVERS DRAW THEIR STEPS INSTEAD OF LISTING THEM, so neither
         passes the written list: the `lead` above already carries the same
         beats as illustrated cards, and passing both put the same content on
         one screen twice. `TaskCover` keeps its `steps` prop, because the
         practice cover still lists its steps in writing. */
      steps={[]}
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

/** All pages are read in both modes before any preference or mandate decision. */
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
              {/* THE QUOTED WORK-REASON CARD IS DROPPED HERE (round six). It
                  is shown in full, in its own box, on brief page 4 — two
                  clicks after this one — so the brief was reading the same
                  card twice. What survives is the two sentences the card does
                  not carry: which term the work reason does NOT name, and
                  that what to pass on is the participant's choice. */}
              <RoleStory story={brief.roleStory} hideCardQuote />
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
            {/* THE OBJECTIVES STAY, AS TWO LINES RATHER THAN A BULLET LIST
                UNDER A PARAGRAPH. They are not chrome: each role's pair says
                which term they are trying to hold and which one they can give
                ground on, which is the whole of what the participant is
                playing for. What went is the surrounding explanation — "task
                points are not money" is now the one clause it needed to
                be. */}
            <ul className="mb-4 space-y-1.5 text-sm leading-relaxed">
              {brief.objectives.map(objective => (
                <li key={objective} className="flex items-start gap-2">
                  <span aria-hidden className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--private-strong)]" />
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
            {/* "MORE POINTS IS BETTER" MOVED OUT OF HERE. `PointsKey` below
                says it in its own first clause, so the page said it twice in
                two lines. What stays is the half `PointsKey` does not say and
                that a paid participant needs: the points are not the money. */}
            <p className="mb-3.5 text-sm leading-relaxed text-[var(--private-ink)]">
              Points are not money. They show how well an agreement fits your goals.
            </p>
            <IssueValueTable issues={task.issues} role={role} reservationPoints={task.reservationPoints} />
            <p className="mt-4 text-sm font-bold">Do not share point numbers in the conversation.</p>
          </Card>
        ) : (
          <Card tone="private">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <CardTitle>What you can explain</CardTitle><PrivateTag />
            </div>
            <p className="mb-4 text-sm leading-relaxed">{brief.requirementNote}</p>
            {/* No ⚠ caption here — §8.1's notice below IS that sentence, in
                full. See `IssueReasonGroups`. */}
            <IssueReasonGroups task={task} role={role} caption={false} />
            {/* §8.1's COMMON PRE-DISCLOSURE NOTICE, in full, once. It is shown
                after the cards and before anything is decided, in both arms
                and both roles, in identical words — which is what §8.1
                requires ("두 방식·두 역할에 같은 문구를 사용함").

                IT REPLACED `disclosureRisk`, which is role-specific and
                forecasts a particular bad impression ("could make you look
                like a lead who answers for their team"). §8.1's researcher
                note rules that out by name: no role-specific warning of a
                negative consequence, and no confirmation pop-up. The notice
                names BOTH sides of the decision and then says the choice is
                theirs — because which way they choose is the primary
                outcome, and a screen that recommends an answer measures the
                recommendation. */}
            <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50/70 p-4">
              <p className="text-sm font-bold text-rose-900">
                Before you decide about the sensitive background
              </p>
              {/* THE ROLE-SPECIFIC LINE NAMES THE CHANNEL, NOT AN OUTCOME.
                  §8.1's researcher note rules out a role-specific warning that
                  forecasts a bad impression; it does not rule out saying WHERE
                  the other person's judgement lands, which every participant
                  has already been told on the orientation pages. Both roles
                  get one such line, of the same shape, so the notice stays
                  symmetric across the four cells. */}
              <p className="mt-1.5 text-sm leading-relaxed text-rose-950">
                Sharing it can help the other person understand what
                you&rsquo;re asking for. It can also shape how they see you.
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-rose-950">
                {role === "leader"
                  ? "What you share may be weighed when the team member writes the evaluation of you."
                  : "What you share may be weighed when the team lead recommends your bonus."}
              </p>
              <p className="mt-1.5 text-sm font-semibold leading-relaxed text-rose-950">
                Whether to share is your choice. You can reach an agreement
                without it.
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed">These are the facts of your role; you do not need to use the exact wording.</p>
          </Card>
        )}
      </Page>
      <ActionBar
        label={page === 3 ? "Continue to task setup" : `Next: ${labels[page + 1].toLowerCase()}`}
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

/**
 * The participant's own best option on a term.
 *
 * NOT `options[0]`. Option order is role-relative — each issue lists its
 * options best-first for whichever role the term favours — so on the other
 * side's priority term `options[0]` is worth nothing to this participant.
 */
function bestOptionId(issue: Issue, role: Role): string {
  return [...issue.options].sort((a, b) => b.points[role] - a.points[role])[0]
    .id;
}

/** The wish package, both terms at the participant's own best (§8.6). */
export function bestWish(
  task: NegotiationTask,
  role: Role,
): Record<string, string> {
  return Object.fromEntries(
    task.issues.map((issue) => [issue.id, bestOptionId(issue, role)]),
  );
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
  /**
   * THE ONE DELIBERATE EXCEPTION TO INTERFACE RULE 2 (§8.6, Ver.2.21).
   *
   * Nothing else on this study starts answered, because a pre-selected control
   * is submitted by everyone who does not engage and cannot be told apart from
   * a considered answer. Here the default is specified: both terms at the
   * participant's OWN BEST option.
   *
   * TWO THINGS DEPEND ON IT. The wish is the proxy's acceptance line as well
   * as its target — a proxy holding a wish no package can match pushes to the
   * ceiling its reasons allow and brings back what it reached, so a blank or
   * a modest wish would change how far the proxy goes for reasons that have
   * nothing to do with disclosure. And REMARK's fixed line ("your demands were
   * a bit strong") presupposes the participant asked for their best; a modest
   * wish would make that comment factually wrong for them.
   *
   * Departure from it is therefore the thing worth recording, not the
   * selection: `WISH-DEV` is an audit flag, and §13-25 switches REMARK to
   * demand-free wording if it clears 20% at pilot.
   */
  const defaults = bestWish(task, role);
  const [preferred, setPreferred] = useState<Record<string, string | null>>(
    () => initial?.preferred ?? { ...defaults },
  );
  useDevAutofill(() => {
    setPreferred({ ...defaults });
  }, `prefs-t${taskIndex}`);

  const missing = task.issues
    .filter((i) => !preferred[i.id])
    .map((i) => `pref-${i.id}`);
  const canContinue = useDevGate(missing.length === 0 && reasonsComplete);

  /** Did they move off the pre-selected best-on-both (§8.6, `WISH-DEV`)? */
  const wishDeviated = task.issues.some(
    (issue) => preferred[issue.id] !== defaults[issue.id],
  );

  async function save() {
    if (!canContinue) return;
    const prefs = { preferred };
    if (participantKey) {
      await getStore().saveResponses(
        participantKey,
        `preferences_t${taskIndex}`,
        {
          taskId: task.id,
          role,
          preferred,
          [`WISH-DEV_t${taskIndex}`]: wishDeviated,
        },
      );
    }
    logEvent(
      "initial_preference_saved",
      { taskId: task.id, wishDeviated },
      {
        sessionIndex: taskIndex,
      },
    );
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

          {identity ? <div className="mb-5">{identity}</div> : null}

          {/* §8.6, in the participant's words. Three facts and no advice:
              pick what you would like, the other side never sees it, and it
              comes back beside the real outcome. It may not say that a bolder
              or a softer wish does better — where the negotiation lands turns
              on the reasons voiced, and teaching that would stage the primary
              outcome.

              IT WAS A CALLOUT WITH A TITLE, A PARAGRAPH AND THE FULL POINTS
              KEY. On the Proxy arm that sat between the representative and
              the two term cards, and the whole screen ran past a laptop fold
              before the one decision on it came into view. Two lines and the
              same key, unboxed. */}
          <p className="mb-4 text-sm leading-relaxed text-[var(--ink-2)]">
            <strong className="text-[var(--ink)]">
              Pick the option you&rsquo;d like on each issue.
            </strong>{" "}
            The other side never sees this.
            {isProxy
              ? " Your AI Proxy aims for what you pick, and at the end you approve what it reached, ask for a change, or refuse it."
              : ""}
          </p>

          {/* THE "HOW YOUR POINTS WORK" BOX IS GONE FROM THIS SCREEN (round
              six). It carried the two anchors — the most this task can pay
              you and what no agreement pays — and the briefing rail beside it
              now carries the same two on one line, under the point sheet. Two
              copies of one pair of numbers is what the rail exists to make
              unnecessary, and on the Proxy arm this box sat between the
              representative and the one decision on the screen, pushing the
              sensitive checkbox past the fold. The per-option "+N pts" chips
              and the price box below stay: they price THIS participant's own
              selection, which the rail cannot do. */}
          {/* TWO COLUMNS FROM `md` UP, HEADED POSITIONALLY. "Issue 1" and
              "Issue 2" are the same two words in the same order for both
              roles and say nothing about which term the study is about (§5
              principle 1); what they do say is that there are exactly two
              choices to make, which stacked cards left the participant to
              infer from a scroll. The two cards stay byte-for-byte identical
              in structure — one control each, no extra control on either. */}
          <div className="grid gap-4 md:grid-cols-2">
            {task.issues.map((issue, index) => (
              <Card key={issue.id} id={`q-pref-${issue.id}`} className="border-slate-200 bg-white">
                <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-[var(--ink-3)]">
                  Issue {index + 1}
                </p>
                {/* NO "YOUR CONTEXT" CALLOUT. `issue.rationale[role]` is
                    already on screen, in the briefing rail's payoff section
                    ("Why it matters to you"), which is pinned beside this
                    from `lg` up and one tap away below it. Two copies of one
                    sentence on the same screen is what the rail is for. */}
                <CardTitle hint={issue.description}>{issue.label}</CardTitle>

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
          <div className="mt-4">
            <PackageValue
              issues={task.issues}
              role={role}
              reservationPoints={task.reservationPoints}
              selection={preferred}
              label="What this would be worth to you"
            />
          </div>

          {reasons ? (
            <div className="mt-7">
              {/* A section BELOW both term cards, never nested in one of them
                  (§5 principle 4): nesting would make one term card visibly
                  taller and carry a control the other does not, which names
                  the study's term without a word.

                  THE NUMBERED "1"/"2" PAIR IS GONE. It labelled the term
                  cards as step one and this as step two, which was true but
                  cost a whole heading block above the cards on a screen that
                  had to be shortened. The two headings say which is which on
                  their own. */}
              {/* NO HEADING OF ITS OWN. The Proxy arm passes a section that
                  already carries one, so this added a second heading saying
                  nearly the same words directly above it. Direct passes no
                  reasons at all. */}
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
              {/* "OTHER PARTICIPANT", NEVER "PARTNER" (deception item 1).
                  The other side is labelled "Other Participant" everywhere it
                  is named — a role label rather than a name, matching what the
                  consent form and the instructions already say. "Partner" is a
                  second name for the same figure, and a participant who meets
                  two names for one person has been told something the study
                  does not intend. */}
              <span className="mt-1.5 text-2xs font-bold text-slate-700">
                {stage === "searching"
                  ? "Other Participant (Waiting…)"
                  : "Other Participant Connected"}
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
                ? "Connecting with the other participant…"
                : stage === "found"
                  ? "Other Participant Found · Joining Room…"
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
              ? "You are being paired with another participant who has just completed the setup. Please stay on this screen. Negotiations begin automatically as soon as both are synced."
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
              <span>
                {stage !== "searching"
                  ? "Other participant joined"
                  : "Matching active participant from queue…"}
              </span>
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
 * What the package is worth to you.
 *
 * THERE IS NO FALLBACK PLAN ANY MORE (§3.2, Ver.2.21). No agreement means
 * nothing is settled and both sides score zero — so "your fallback total
 * applies" described a safety net that no longer exists, and a participant who
 * read it would be told they had come away with something. Every screen here
 * says the same three words instead: nothing is settled.
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
          Nothing was settled, so there are no agreed terms to break down.
        </p>
      )}

      <div className="mt-3 border-t border-amber-200 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-bold text-[var(--ink)]">
            {terms ? "Final total" : "Your total"}
          </span>
          <span className="shrink-0 text-xl font-black tabular-nums text-amber-950">
            {mine.toLocaleString()} pts
          </span>
        </div>
        {terms ? (
          <p className="mt-1 text-xs leading-relaxed text-[var(--private-ink)]/80">
            {comparison === "above"
              ? `${(mine - task.reservationPoints).toLocaleString()} points more than you would have had with no agreement.`
              : comparison === "below"
                ? `${(task.reservationPoints - mine).toLocaleString()} points below what no agreement would have paid.`
                : "The same as no agreement would have paid."}
          </p>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-[var(--private-ink)]/80">
            Nothing was settled on either condition, so this task pays
            nothing.
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

/**
 * The participant's own conversation — the Proxy arm's two-minute closing,
 * and (through `baseline-task.tsx`, which passes the same props) the Direct
 * arm's five minutes.
 *
 * THESE TWO MUST STAY BEHAVIOURALLY IDENTICAL. They are the only two places a
 * participant speaks for themselves, so a difference between them lands on
 * `Pooled Proxy − Direct` itself. Everything below that could differ is a
 * prop: the clock, the seeded stage offset, the disclosure policy, the tier
 * the conversation starts from.
 */
interface StagedTurn {
  /** Every participant message in this task, in order — the classifier reads all of them. */
  texts: string[];
  /** The new message only, for the transcript row and the store. */
  text: string;
  sentOffer: Package;
  sentPackage: Package | null;
  ownId: string;
  createdAt: string;
  secondsAtSend: number;
  classification?: ClassificationResponse;
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
  sbFirstChoice,
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
   * The rung the participant's OWN proxy earned in the AI-AI exchange — what
   * was actually VOICED, not what was authorized: an emergency stop or a
   * guardrail block can leave an authorized card unsaid, and assuming it was
   * said made the rule inert for every Proxy participant once before.
   *
   * Since Ver.2.21 the proxy's floor is `work`, the same as a Direct
   * participant's, because the priority rung that used to sit above it is
   * gone (§6.5, §6.9 #12).
   *
   * IT DRIVES THE LADDER, NOT `SB`. What the proxy actually got out is what
   * the counterpart heard and what this conversation inherits. The
   * participant's own first disclosure CHOICE is `sbFirstChoice` below, and
   * the two are different facts whenever a guardrail block or an emergency
   * stop leaves an authorized card unsaid.
   */
  proxyVoicedTier: ReasonTier;
  /**
   * `SB` — the participant's first disclosure choice (§6.3, §9.3).
   *
   * In the Proxy arm this is the mandate checkbox, sealed at DECISION-LOCK
   * before anyone spoke; in the Direct arm the caller passes null, because
   * there the lock is taken inside the conversation and this component has
   * nothing to do with it (`baseline-task.tsx` owns that).
   *
   * It is a PROP rather than something derived here, because deriving it from
   * `proxyVoicedTier` — as this used to — silently recoded a participant whose
   * ticked card was blocked as a non-discloser, inside RQ1's confirmatory
   * outcome, in one arm only.
   */
  sbFirstChoice: boolean;
  messages: DisplayMessage[];
  setMessages: Dispatch<SetStateAction<DisplayMessage[]>>;
  offer: Package;
  setOffer: Dispatch<SetStateAction<Package>>;
  onSettled: (
    finalPackage: Package | null,
    meta: {
      /**
       * Did the participant voice their own SB in this conversation?
       * Feeds `SB-TIMING = wrap_up` (§9.3, §6.9 #2) — the only route to it,
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
  const [stagedTurn, setStagedTurn] = useState<StagedTurn | null>(null);
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
  /**
   * The classifier's `priority_claim` flag (§6.2). It buys no rung — Ver.2.21
   * deleted the one it used to — and its whole effect is one SCRIPT-ASKWHY,
   * which is where the participant HEARS that a claim without a reason moves
   * nothing.
   */
  const [priorityClaimed, setPriorityClaimed] = useState(false);
  /** Confidence in the CURRENT label, for SCRIPT-CLARIFY (§6.2). */
  const [labelConfidence, setLabelConfidence] = useState<number | undefined>(
    undefined,
  );
  /**
   * The one-shot script flags, held as ONE object.
   *
   * The counterpart route now returns the state it advanced and the client
   * replaces what it holds; splitting these into eight `useState` calls is
   * what made a field get dropped on the merge last time, which turns a
   * one-shot script into a no-shot or an every-turn one.
   */
  const [exchange, setExchange] = useState<HeldExchangeState>(() => ({
    ...INITIAL_EXCHANGE_STATE,
    // The counterpart disclosed through its own proxy while the participant
    // watched (§6.3). Repeating it in person would give the Proxy arm two
    // disclosures where Direct has one.
    counterpartSbDisclosed: true,
  }));
  /** Any participant message so far mentioned score numbers (one-shot pool). */
  const [numbersEver, setNumbersEver] = useState(false);
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
   * one was offered at.
   */
  const [standingTier, setStandingTier] = useState<ReasonTier>(proxyVoicedTier);
  /** Synchronous mirror of `settled`, so two callers in one tick cannot both win. */
  const settledRef = useRef(false);
  /**
   * The proposal drawer opens ONCE, by itself, the first time the counterpart
   * puts a package on the table — identical to the Direct arm's rule and for
   * the same reason. It is seeded open when the participant arrives carrying
   * the proxies' package, because that package IS what this conversation is
   * about.
   */
  const [proposalOpen, setProposalOpen] = useState(Boolean(openingPackage));
  const openedOnCounterProposal = useRef(Boolean(openingPackage));

  /**
   * Every participant message in this task, in order, for the CUMULATIVE
   * classifier (§6.2a). A ref rather than derived from `messages` because a
   * turn that is folded into the one in flight has to append to it
   * synchronously, before any render.
   */
  const participantTexts = useRef<string[]>([]);
  /** The stored `{text, label, confidence, stance}` log, for gate 19's κ. */
  const classifierLog = useRef<ClassifierLogEntry[]>([]);
  /** When the participant last sent anything, for the client-timed nudge. */
  const lastParticipantAt = useRef<number>(Date.now());
  const nudgeRequested = useRef(false);
  /** A message that arrived while a turn was in flight, waiting to be folded. */
  const queuedText = useRef<string | null>(null);

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
      : "No proposal attached. You are just talking.";
  // THE COMPOSER STAYS OPEN WHILE THE REPLY IS COMING (§6.1 stage 3). The
  // turn boundary is the moment the counterpart's reply RENDERS, so anything
  // sent before then belongs to the same turn — and a locked composer would
  // make that impossible to do. What arrives during the delay cancels the
  // pending reply and is folded in.
  const canSend = useDevGate(!partial) && !settled;
  // One cue on the screen, and it is the composer's (interface rule 9). The
  // package card is not waiting for anything now that a message may be sent
  // without one, so it carries no ring and no pill.
  const yourTurn = !pending && canSend && !settled;

  /**
   * The ladder carries over from the AI-AI exchange and only ever RISES: what
   * the proxy earned, raised by whatever the participant says here in person.
   *
   * This is the one place `SB-TIMING = wrap_up` can happen — a participant
   * whose proxy voiced only the work reason, who then says the thing
   * themselves.
   */
  const tier: ReasonTier = foldTier(proxyVoicedTier, personalTier);

  /* NO `||` IN A PARTICIPANT'S OWN DRAFT. The double pipe is the
     counterpart's BUBBLE-SPLIT marker: `splitIntoBubbles` reads it out of
     model output and it never survives into rendered text. A participant
     types into a plain textarea and would never write one, so a mockup draft
     carrying it showed a literal "||" sitting in the composer — a mockup of
     an interface nobody uses. Two sentences instead, which is what the split
     was standing in for. */
  useDevAutofill(() => {
    if (settled) return;
    setDraft(
      replies === 0
        ? "thanks for going through all that. from my side the package they landed on works, and I am happy to confirm it if you are."
        : "that works for me. glad we got there.",
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
    const committedTier = committed?.tier ?? tier;
    const committedSelf = committed?.selfDisclosed ?? selfDisclosed;
    // THE OUTCOME IS CODED BY THE MACHINE, not by this screen. `codeOutcome`
    // owns "no agreement is worth nothing" (§3.2) and the requirement
    // trajectory the review screen reads; recomputing either here is how the
    // two came to disagree about what an impasse pays.
    const outcome = codeOutcome(task, role, pkg, kind === "agreed");
    logEvent(
      "negotiation_ended",
      {
        phase: "direct",
        reason,
        replies: committed?.replies ?? replies,
        secondsRemaining: committed?.secondsRemaining ?? secondsRemaining,
        tier: committedTier,
        selfDisclosed: committedSelf,
        priorityClaimed,
        outcome,
      },
      { sessionIndex: taskIndex },
    );
    void persistTaskRecord(committedTier, committedSelf, outcome);
  }

  /**
   * Everything §9.3 and §6.2 need from this conversation, written once when it
   * ends.
   *
   * IT IS ONE WRITE, NOT ONE PER FIELD, and the classifier log travels with
   * it: gate 19's κ is computed off `{text, label, confidence}` for every
   * participant message, and a per-message write would put a request on the
   * wire on every turn, which is a timing tell as well as a stall.
   */
  async function persistTaskRecord(
    finalTier: ReasonTier,
    disclosedHere: boolean,
    outcome: ReturnType<typeof codeOutcome>,
  ) {
    if (!participantKey) return;
    /**
     * `SB` IS ALREADY DECIDED WHEN THIS SCREEN OPENS (§6.3, §9.3).
     *
     * The Proxy arm's first reason opportunity was the mandate checkbox,
     * sealed at DECISION-LOCK before anyone spoke — so this conversation
     * cannot change it, and the value arrives as a prop rather than being
     * derived from what the proxies managed to say.
     *
     * A confession made HERE still raises the tier and still pays 3,000. It is
     * `wrap_up`, not `first_chance` (§6.9 #2), which is the whole reason the
     * two are separate fields.
     */
    const sbTiming: SbTiming = sbFirstChoice
      ? "first_chance"
      : disclosedHere
        ? "wrap_up"
        : "never";
    await getStore().saveResponses(
      participantKey,
      `negotiation_t${taskIndex}`,
      {
        taskId: task.id,
        role,
        phase: "closing",
        tier: finalTier,
        [`SB_t${taskIndex}`]: sbFirstChoice,
        [`SB-TIMING_t${taskIndex}`]: sbTiming,
        sbFirstChoice,
        sbTiming,
        priorityClaimed,
        // JSON, NOT NESTED OBJECTS. `ResponseValue` is deliberately flat —
        // one row per item id is what makes the export a table — so the two
        // structured records travel as text and are parsed by the analysis
        // rather than reshaping a type the whole questionnaire depends on.
        classifierLog: JSON.stringify(classifierLog.current),
        outcome: JSON.stringify(outcome),
        participantPoints: outcome.participantPoints,
        jointPoints: outcome.jointPoints,
      },
    );
  }

  /**
   * RATIFY IS NOT INFERRED HERE (§9.3). It is recorded on the decision screen,
   * where the participant actually takes it. Reading it back off the final
   * package coded a participant who asked for a change and then agreed the
   * very same package as an approver, which is a different behaviour on a
   * confirmatory outcome.
   */
  function finish(kind: "agreed" | "impasse", pkg: Package | null) {
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

  async function runStagedTurn(initialTurn: StagedTurn) {
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
          ? // MOCK ONLY — see `mockClassify`. This was the constant
            // `{ label: "none" }`, which recorded a typed confession as a
            // non-disclosure and settled the task a rung low. It reads
            // vocabulary, never meaning, and nothing a result depends on may
            // come from it.
            mockClassify(
              turn.texts,
              {
                sensitive: cardOfLayer(task, role, "sensitive"),
                work: cardOfLayer(task, role, "work"),
                // The vocabulary a participant can use WITHOUT having drawn on
                // a card: the issue names and the public brief. Subtracting it
                // first is what stops "the presentations matter to me" scoring
                // as the presentation card — the same trick the guardrail uses.
                sayable: [
                  task.publicBrief,
                  ...task.issues.flatMap((i) => [i.label, i.description]),
                ],
              },
              leaksForbiddenReason,
            )
          : await fetchJsonWithRetry<ClassificationResponse>(
              "/api/classify-reason",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // THE WHOLE LIST, EVERY TIME (§6.2a). A confession arrives in
                // two or three messages; judged one at a time under the
                // "ambiguous goes lower" rule, it would systematically fail to
                // register, and that floor would then read as the Proxy arm's
                // protective effect.
                body: JSON.stringify({
                  taskId: task.id,
                  role,
                  messages: turn.texts,
                }),
              },
              {
                signal: controller.signal,
                onFailure: failedAttempt,
                validate: isClassificationResponse,
              },
            );
        turn = { ...turn, classification };
        if (mounted.current && generation === turnGeneration.current) {
          setStagedTurn(turn);
        }
      }

      const {
        label,
        confidence,
        stubbed: classifierStubbed = false,
        stance = "none",
        priority_claim: priorityNow = false,
      } = classification;
      const personalNow = foldTier(personalTier, LABEL_TIER[label]);
      const selfDisclosedNow = selfDisclosed || label === "SB";
      const tierNow: ReasonTier = foldTier(proxyVoicedTier, personalNow);
      const priorityClaimedNow = priorityClaimed || priorityNow;

      /**
       * STANCE, RESOLVED BEFORE THE MACHINE SEES IT (§6.2, §6.9 #18).
       *
       * `accept` means the participant agreed in words to what is on the
       * table, so the standing package travels as their offer — the same
       * thing the Accept button does, by the same deterministic route.
       * `counter` means they named terms in prose, which is then treated
       * exactly like a package from the drawer. Neither hands the model a
       * decision: the classifier reports what was said, and `machine.ts`
       * still decides whether it is acceptable.
       */
      const counterPackage = resolveCounterTerms(
        task.issues,
        classification.counter_terms,
      );
      const incoming: Package | null =
        stance === "accept" && lastCounterpartPackage
          ? lastCounterpartPackage
          : stance === "counter" && counterPackage
            ? counterPackage
            : turn.sentPackage;

      const own: DisplayMessage = {
        id: turn.ownId,
        speaker: "participant",
        text: turn.text,
      };
      const next = [...messages, own];
      const turnStartedAt = Date.now();
      const stageNow = counterpartStageAfter(replies + DIRECT_STAGE_OFFSET);
      const mentioned = numbersEver || mentionsScoreNumbers(turn.text);
      // A turn that carries a message is never a silent one, whatever the
      // nudge timer thought a moment ago.
      const silentNow = false;
      const stateForTurn: ExchangeState = {
        ...exchange,
        tier: tierNow,
        disclosurePolicy: "fixed",
        priorityClaimed: priorityClaimedNow,
        labelConfidence: confidence,
        participantSilent: silentNow,
        numbersMentionedNow: mentioned,
        secondsRemaining: turn.secondsAtSend,
      };
      let reply: string;
      let counterProposal: Package | null = null;
      let nextState: HeldExchangeState;
      let settledNow: "agreed" | "impasse" | null;
      if (mockAi) {
        /**
         * MOCKUP MODE IS THE ONE PLACE THIS CLIENT RUNS THE MACHINE ITSELF.
         *
         * It never calls the route, so there is no `state` and no `settled` to
         * read. The LIVE path below must not do this — see the note there.
         * Identical to the Direct arm's mockup branch, which is the point.
         */
        const decision = counterpartStep(
          task,
          counterpartRole,
          stageNow,
          incoming,
          stateForTurn,
        );
        counterProposal = decision.proposal;
        nextState = foldExchangeState(exchange, undefined, {
          askedWhy: decision.action === "ask_why",
          askSitUsed: decision.action === "ask_sit",
          nudgeUsed: decision.action === "nudge",
          numbersReminded: decision.action === "nonum",
          softCloseOffered: decision.action === "soft_close",
          counterpartSbDisclosed:
            decision.action === "disclose_sb" ||
            decision.action === "disclose_sb_and_accept",
          reasonlessTurns:
            tierNow === "none" ? (exchange.reasonlessTurns ?? 0) + 1 : 0,
          clarifyUsedForTier:
            decision.action === "clarify" ? tierNow : exchange.clarifyUsedForTier,
        });
        settledNow = decision.impasse
          ? "impasse"
          : decision.accepts
            ? "agreed"
            : null;
        reply = decision.accepts
          ? DIRECT_MOCK_REPLIES[1]
          : DIRECT_MOCK_REPLIES[Math.min(replies, DIRECT_MOCK_REPLIES.length - 1)];
      } else {
        const data = await fetchJsonWithRetry<CounterpartResponse>(
          "/api/counterpart",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: task.id,
              participantRole: role,
              stage: stageNow,
              incoming,
              afterProxy: true,
              history: next.map((m) => ({
                role: m.speaker === "participant" ? "user" : "assistant",
                content: m.text,
              })),
              // THE WHOLE EXCHANGE STATE, sent and replaced. Every input the
              // client coded its own outcome from has to reach the route
              // unchanged, or the two can disagree about whether the exchange
              // was agreed.
              ...stateForTurn,
            }),
          },
          {
            signal: controller.signal,
            onFailure: failedAttempt,
            validate: isCounterpartResponse,
          },
        );
        /**
         * THE ROUTE'S ANSWER IS THE AUTHORITY, AND THE CLIENT DOES NOT
         * RE-DERIVE IT (Ver.2.21 contract).
         *
         * The response carries the message, the package, the FULL advanced
         * state with every one-shot flag already folded in, and `settled`.
         * It deliberately does NOT carry the decided action: a network tab
         * showing `propose_tier` or `ask_why` tells the participant the other
         * party is a script, which is the one thing this arm cannot survive
         * (§8.1, "the counterpart is an AI").
         *
         * Nothing here branches on which script fired. Identical to the Direct
         * arm's live branch — these are the two places a participant speaks for
         * themselves, so a difference lands on `Pooled Proxy − Direct`.
         */
        reply = data.message;
        counterProposal = data.proposal ?? null;
        nextState = takeExchangeState(data.state, exchange);
        settledNow = data.settled ?? null;
      }

      // One delay for both branches, counting the generation time already
      // spent. The budget used to apply only to the live branch, so mockup
      // mode replied in 500ms, and it was ADDED to the model's own latency
      // rather than absorbing it.
      await awaitCounterpartDelay(reply.length, turnStartedAt);

      if (!mounted.current || generation !== turnGeneration.current || settledRef.current) return;

      setPersonalTier(personalNow);
      setSelfDisclosed(selfDisclosedNow);
      setPriorityClaimed(priorityClaimedNow);
      setLabelConfidence(confidence);
      setNumbersEver(mentioned);

      /**
       * `SB-TIMING = wrap_up` IS THE ONLY LOCK THIS SCREEN CAN MOVE (§6.9 #2).
       *
       * The Proxy arm's first reason opportunity was the mandate checkbox,
       * sealed at DECISION-LOCK before anyone spoke, so `SB` is already decided
       * and this conversation cannot change it. A confession made here still
       * raises the tier and still pays 3,000 — it is recorded as `wrap_up`,
       * which `persistTaskRecord` derives from `selfDisclosed`.
       *
       * That asymmetry is the design, not an omission: a participant whose
       * proxy voiced the SB has nothing left to disclose here, and one whose
       * proxy did not is making a new decision, in person, after watching.
       */
      // THE ROUTE'S STATE, TAKEN WHOLE. It folded every one-shot flag from the
      // move it actually made; re-deriving them here would be this client
      // guessing at a decision the wire deliberately does not name. Mockup mode
      // reaches the same object through `foldExchangeState` above, which is the
      // only place a local fold is legitimate.
      setExchange(nextState);

      // THE VISIBLE CARD FOLLOWS THE COUNTERPROPOSAL, and this is not
      // cosmetic. `offer` is the drawer's chip selection; `lastCounterpartPackage`
      // is what "✓ Accept the package on the table" actually sends. They were
      // separate, and nothing synced them — so one click could commit a
      // participant to a package the card was not showing.
      if (counterProposal) {
        setLastCounterpartPackage(counterProposal);
        setStandingTier(tierNow);
        setOffer(counterProposal);
        if (!openedOnCounterProposal.current) {
          openedOnCounterProposal.current = true;
          setProposalOpen(true);
        }
      } else if (tierNow !== standingTier) {
        // Nothing came back to replace it and the rung has moved, so the
        // package on screen can no longer be accepted. Take the button away
        // rather than leave one that silently does nothing.
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
      nudgeRequested.current = false;

      classifierLog.current = [
        ...classifierLog.current,
        {
          text: turn.text,
          label,
          confidence: confidence ?? null,
          stance,
          priorityClaim: priorityNow,
          tier: tierNow,
          messageIndex: turn.texts.length - 1,
          createdAt: turn.createdAt,
        },
      ];

      logEvent(
        "message_sent",
        {
          phase: "direct",
          length: turn.text.length,
          secondsRemaining: turn.secondsAtSend,
          requirementOption: turn.sentOffer[requirement.id] ?? null,
          reasonLabel: label,
          reasonConfidence: confidence,
          reasonStance: stance,
          priorityClaim: priorityNow,
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
          reasonLabel: storedLabel(label),
          reasonConfidence: confidence,
        });
        void getStore().appendMessage(participantKey, {
          id: counter.id,
          sessionIndex: taskIndex,
          speaker: "counterpart",
          text: reply,
          createdAt: new Date().toISOString(),
          // NO `decidedAction`. The route no longer sends the script name and
          // this client no longer knows it — the audit's copy is written
          // server-side, where it cannot reach a participant's network tab.
          stage: stageNow,
          proposal: counterProposal ?? undefined,
        });
      }

      finishRecovery();
      // FIRST SETTLEMENT WINS. `onExpire` guards on `settled` and this did
      // not, so a reply still in flight when the clock ran out overwrote the
      // recorded impasse with an agreement — two `negotiation_ended` events
      // for one exchange, decided by network timing.
      // THE EXCHANGE ENDS ON `settled`, NEVER ON AN ACTION NAME. It arrives on
      // the combined disclose-and-accept turn too, which is exactly why looking
      // for an "accept" move would miss the case §6.1 stage 6 added.
      if (!settledRef.current && settledNow) {
        settle(
          settledNow,
          settledNow === "agreed" ? (counterProposal ?? incoming) : null,
          settledNow,
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
      } else if (queuedText.current !== null) {
        // A message arrived while this reply was still on the wire and could
        // not be folded into it. Send it now rather than dropping it — the
        // participant pressed send and watched their words disappear
        // otherwise.
        const queued = queuedText.current;
        queuedText.current = null;
        void send(queued);
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

  /**
   * Send a participant message.
   *
   * THE TURN BOUNDARY IS THE MOMENT THE REPLY RENDERS (§6.1 stage 3), so a
   * message sent while the counterpart's delay is still running is FOLDED
   * INTO THE SAME TURN: the pending reply is cancelled, the whole message list
   * is re-classified, and the counterpart answers the new state once.
   *
   * That is what makes the LOCK land on everything the participant said in
   * their first reason turn rather than on whichever fragment arrived first —
   * and `SB` (the confirmatory outcome) is exactly that lock. Without it,
   * someone who writes a confession as "actually, there's something" then
   * "the client asked for the lead" is recorded as a non-discloser on the
   * strength of the first half.
   *
   * A message that arrives after the reply has already rendered is a new turn.
   * One in-flight request at a time, always: a second is queued, never
   * dropped.
   */
  async function send(text: string, sentOffer: Package = offer) {
    if (settledRef.current) return;
    lastParticipantAt.current = Date.now();
    nudgeRequested.current = false;

    if (pending || stagedTurn) {
      const inFlight = stagedTurn;
      // The reply has not rendered yet, so this belongs to the turn in
      // flight. Cancel it and re-run with both messages classified together.
      if (inFlight) {
        turnGeneration.current += 1;
        activeRequest.current?.abort();
        activeRequest.current = null;
        participantTexts.current = [...participantTexts.current, text];
        // The two messages become two transcript rows; only the new one is
        // appended here, because the first was already committed to the list
        // when its own turn began.
        const merged: StagedTurn = {
          texts: [...participantTexts.current],
          text,
          sentOffer: { ...sentOffer },
          sentPackage:
            Object.keys(sentOffer).length > 0 ? { ...sentOffer } : null,
          ownId: `d-p${messages.length + 1}`,
          createdAt: new Date().toISOString(),
          secondsAtSend: secondsRemaining,
        };
        setMessages((prev) => [
          ...prev,
          { id: inFlight.ownId, speaker: "participant", text: inFlight.text },
        ]);
        setStagedTurn(merged);
        setDraft("");
        await runStagedTurn(merged);
        return;
      }
      // No staged turn to fold into (a retry is running, say). Queue it.
      queuedText.current = text;
      setDraft("");
      return;
    }

    participantTexts.current = [...participantTexts.current, text];
    const immutableOffer = { ...sentOffer };
    const turn: StagedTurn = {
      texts: [...participantTexts.current],
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
   * SCRIPT-NUDGE, timed on the CLIENT (§6.2, §6.9 #17).
   *
   * The counterpart has nothing to answer — no package arrived, no reason was
   * given — so there is no turn to hang the nudge on. The client watches the
   * silence instead, asks the route for exactly one nudge turn, and then the
   * counterpart simply waits, which is what §6.9 #17 describes.
   *
   * It runs through the same `counterpartStep` as everything else, so the
   * machine still owns whether the nudge is available: `nudgeUsed` latches on
   * this turn and every later silence produces nothing.
   */
  async function runNudge() {
    if (settledRef.current || pending || stagedTurn) return;
    if (exchange.nudgeUsed || nudgeRequested.current) return;
    nudgeRequested.current = true;
    const generation = turnGeneration.current + 1;
    turnGeneration.current = generation;
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    try {
      const stageNow = counterpartStageAfter(replies + DIRECT_STAGE_OFFSET);
      const stateForTurn: ExchangeState = {
        ...exchange,
        tier,
        disclosurePolicy: "fixed",
        priorityClaimed,
        labelConfidence,
        participantSilent: true,
        numbersMentionedNow: false,
        secondsRemaining,
      };
      let reply: string;
      let nextState: HeldExchangeState;
      let proposalNow: Package | null = null;
      let settledNow: "agreed" | "impasse" | null = null;
      if (mockAi) {
        // Mockup mode has no route, so the machine answers — and it may
        // legitimately decline: the nudge sits below SCRIPT-CLOSE in the guard
        // order, so near the end of the clock a silence is answered by the
        // closing offer instead.
        const decision = counterpartStep(
          task,
          counterpartRole,
          stageNow,
          null,
          stateForTurn,
        );
        if (decision.action !== "nudge") return;
        reply = "still there? || no rush — say whatever comes to mind.";
        nextState = foldExchangeState(exchange, undefined, { nudgeUsed: true });
      } else {
        const data = await fetchJsonWithRetry<CounterpartResponse>(
          "/api/counterpart",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: task.id,
              participantRole: role,
              stage: stageNow,
              incoming: null,
              afterProxy: true,
              history: messages.map((m) => ({
                role: m.speaker === "participant" ? "user" : "assistant",
                content: m.text,
              })),
              ...stateForTurn,
            }),
          },
          {
            signal: controller.signal,
            validate: isCounterpartResponse,
          },
        );
        /**
         * WHATEVER COMES BACK IS THE TURN, and this client does not check
         * which script it was. The request is made only when the state's own
         * preconditions hold, so a nudge is available — but SCRIPT-CLOSE
         * outranks it, and near the end of a two-minute clock that is the
         * right move to show. Suppressing it would leave a silent participant
         * with no closing offer at all, which is the route to a zero.
         */
        reply = data.message;
        proposalNow = data.proposal ?? null;
        nextState = takeExchangeState(data.state, exchange);
        settledNow = data.settled ?? null;
      }
      if (!mounted.current || generation !== turnGeneration.current || settledRef.current) {
        return;
      }
      const counter: DisplayMessage = {
        id: `d-nudge${messages.length}`,
        speaker: "counterpart",
        text: reply,
      };
      setMessages((prev) => [...prev, counter]);
      setExchange(nextState);
      // A closing offer arriving here carries a package, and it has to reach
      // the Accept button like any other — otherwise the one move that rescues
      // a silent participant from a zero would be visible and unacceptable.
      if (proposalNow) {
        setLastCounterpartPackage(proposalNow);
        setStandingTier(tier);
        setOffer(proposalNow);
        if (!openedOnCounterProposal.current) {
          openedOnCounterProposal.current = true;
          setProposalOpen(true);
        }
      }
      if (participantKey) {
        void getStore().appendMessage(participantKey, {
          id: counter.id,
          sessionIndex: taskIndex,
          speaker: "counterpart",
          text: reply,
          createdAt: new Date().toISOString(),
          stage: stageNow,
          proposal: proposalNow ?? undefined,
        });
      }
      if (!settledRef.current && settledNow) {
        settle(
          settledNow,
          settledNow === "agreed" ? proposalNow : null,
          settledNow,
          {
            replies,
            secondsRemaining,
            tier,
            selfDisclosed,
          },
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // A failed nudge is not worth a recovery banner: nothing the participant
      // did is waiting on it, and the retry path is for their own messages.
      console.error("[nudge]", error);
      nudgeRequested.current = false;
    } finally {
      if (mounted.current && generation === turnGeneration.current) {
        setPending(false);
        activeRequest.current = null;
      }
    }
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
                      ? "⚠️ Time ran out. Nothing is settled, so you both score 0 for this task."
                      : openingPackage
                        ? "You are talking directly with the other participant. Confirm or adjust what the proxies reached."
                        : // NO STANDING PACKAGE, and two different things
                          // bring a participant here: they refused what their
                          // proxies reached, or the exchange never produced
                          // one. Either way there is nothing to confirm or
                          // adjust — but telling a refuser their proxies "did
                          // not settle" contradicts the screen they just left.
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
                  onTick={(remaining) => {
                    setSecondsRemaining(remaining);
                    // SCRIPT-NUDGE is client-timed because a silence produces
                    // no turn to hang it on. Requested once; the machine's
                    // `nudgeUsed` decides whether it is still available.
                    if (
                      !settledRef.current &&
                      !pending &&
                      !stagedTurn &&
                      !exchange.nudgeUsed &&
                      !nudgeRequested.current &&
                      Date.now() - lastParticipantAt.current >=
                        NUDGE_AFTER_SILENT_SECONDS * 1000
                    ) {
                      void runNudge();
                    }
                  }}
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
                  ? "The proxies are done. Say hello and settle it. Or accept the package below."
                  : "Write to the other participant to get started."
              }
            />
            <MessageComposer
              value={stagedTurn && pending ? draft : (stagedTurn?.text ?? draft)}
              onChange={setDraft}
              onSend={send}
              /* THE COMPOSER STAYS OPEN WHILE THE REPLY IS COMING (§6.1
                 stage 3). What arrives before the reply renders is folded into
                 the same turn; a locked composer would make the turn boundary
                 the moment of SENDING rather than the moment of ANSWERING,
                 and the LOCK — `SB`, the confirmatory outcome — is taken at
                 the end of the turn. */
              disabled={!canSend}
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
              the Proxy arm a route to the no-agreement outcome that Direct has
              no counterpart for — on the primary contrast, taken by the
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
              : "⚠️ No agreement. 0 points for this task. Proceed to review."
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
