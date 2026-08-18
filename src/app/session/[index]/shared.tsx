"use client";

/**
 * Phases shared by the Baseline and Proxy sessions (Methods ver.1.8 §Per-task
 * flow).
 *
 * The order of the first three matters and is not arbitrary:
 *
 *   brief → private target → jeopardy → (opening | mandate)
 *
 * The PRIVATE TARGET is recorded before the participant sees anything about
 * how this session works. It is the first point on the trajectory the study
 * measures — private target, then what was entrusted, then what was opened
 * with, then what survived the challenge, then what reached the final package
 * — and if it were taken after the condition were visible it would already be
 * contaminated by it.
 *
 * The JEOPARDY items come next and before any negotiation, because they ask
 * what the participant expects to happen, not what did.
 *
 * The brief is the one phase that puts the briefing in the main column: it is
 * being read for the first time. From the next phase on it lives in the rail,
 * so it is never taken away.
 */

import { useState } from "react";
import { MeasureBlock, type Answers } from "@/components/measure";
import { BriefingPanel, SessionHeader, SessionLayout } from "@/components/session";
import { OptionChips } from "@/components/issues";
import { ActionBar } from "@/components/study-chrome";
import { Callout, Card, CardTitle, Page } from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import {
  dummyAnswer,
  jeopardyItems,
  postTaskItems,
  withFocal,
  type Item,
} from "@/lib/measures";
import { useParticipant } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { focalIssue, packageValue, preservesFocalThreshold } from "@/lib/tasks";
import type { NegotiationTask, Package, Role } from "@/lib/types";

// ---------------------------------------------------------------------------
// Phase: scenario brief
// ---------------------------------------------------------------------------

export function SessionBrief({
  sessionIndex,
  task,
  role,
  steps,
  onContinue,
}: {
  sessionIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  onContinue: () => void;
}) {
  return (
    <>
      <Page width="wide">
        <SessionHeader
          sessionIndex={sessionIndex}
          title={task.title}
          steps={steps}
          current={0}
        />

        <Card className="mb-5">
          <CardTitle>The situation</CardTitle>
          {/* The scenario is read once and carefully, so it keeps a reading
              measure even though the session column is wide. */}
          <p className="max-w-prose text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            {task.publicBrief}
          </p>
          <p className="mt-3 text-[0.875rem] text-[var(--ink-3)]">
            Both sides can see this much. What follows is yours alone.
          </p>
        </Card>

        <BriefingPanel task={task} role={role} />
      </Page>

      <ActionBar
        label="I've read my briefing"
        onClick={onContinue}
        note="It stays available for the whole session."
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Phase: private target + pre-task jeopardy
// ---------------------------------------------------------------------------

/**
 * "What level would be enough for you?" plus the two jeopardy items.
 *
 * One screen rather than two, because they are the same moment: what you
 * privately think you need, and what you expect it to cost to ask for it.
 * Nothing on this screen may show how the session will work — that is what
 * makes the target usable as a baseline.
 */
export function PrivateTargetForm({
  sessionIndex,
  task,
  role,
  steps,
  onContinue,
}: {
  sessionIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  onContinue: (targetOptionId: string | null) => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const focal = focalIssue(task);
  const items = withFocal(jeopardyItems(role), task);

  const [target, setTarget] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});

  useDevAutofill(() => {
    // The threshold level for a Member — what they judge just enough, which is
    // what makes holding it through the challenge meaningful. A Leader is
    // being asked about the other side's term, and the level they think would
    // be enough is a lower one.
    const index =
      role === "member" ? (focal.focalThresholdIndex ?? 1) : focal.options.length - 2;
    setTarget(focal.options[index].id);
    setAnswers(Object.fromEntries(items.map((i) => [i.id, dummyAnswer(i)])));
  }, `target-s${sessionIndex}`);

  const missing = [
    ...(target === null ? [`target-${focal.id}`] : []),
    ...items.filter((i) => answers[i.id] === undefined).map((i) => i.id),
  ];
  const canContinue = useDevGate(missing.length === 0);

  async function save() {
    if (!canContinue) return;
    if (participantKey) {
      await getStore().saveResponses(
        participantKey,
        `private_target_s${sessionIndex}`,
        { privateTarget: target, taskId: task.id, role, ...answers },
      );
    }
    logEvent("initial_preference_saved", { taskId: task.id }, { sessionIndex });
    onContinue(target);
  }

  return (
    <>
      <Page width="wide">
        <SessionLayout briefing={<BriefingPanel task={task} role={role} />}>
          <SessionHeader
            sessionIndex={sessionIndex}
            title="Before you begin"
            steps={steps}
            current={1}
          />

          <div className="mb-5">
            <Callout tone="private" title="This stays private">
              <p>
                Nobody else sees this — not the other party, not at any later
                point in the session. It is recorded so we can compare what you
                thought you needed with how things turned out.
              </p>
            </Callout>
          </div>

          <Card className="mb-5" id={`q-target-${focal.id}`}>
            <CardTitle
              hint={`Not what you will ask for — what would actually be enough.`}
            >
              What level of {focal.label.toLowerCase()} would be enough for you?
            </CardTitle>
            <OptionChips
              issue={focal}
              role={role}
              name={`target-${focal.id}`}
              value={target}
              onChange={setTarget}
            />
          </Card>

          <MeasureBlock
            block={{
              id: "jeopardy",
              title: "What you expect",
              hint: "1 = Strongly disagree, 7 = Strongly agree",
              items,
            }}
            answers={answers}
            onChange={(id, value) =>
              setAnswers((prev) => ({ ...prev, [id]: value }))
            }
          />
        </SessionLayout>
      </Page>

      <ActionBar
        label="Continue"
        onClick={save}
        disabled={!canContinue}
        remaining={missing.length}
        firstUnansweredId={missing[0] ?? null}
        note={missing.length === 0 ? "Ready." : ""}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Phase: post-task questionnaire
// ---------------------------------------------------------------------------

/**
 * The seven-to-fourteen items for this session, asked while it is still in
 * mind rather than saved up for the end of the study (Methods ver.1.8
 * §Estimated survey burden).
 */
export function PostTaskSurvey({
  sessionIndex,
  task,
  role,
  isProxy,
  steps,
  onDone,
}: {
  sessionIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  isProxy: boolean;
  steps: string[];
  onDone: () => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const items: Item[] = withFocal(postTaskItems(role, isProxy), task);
  const [answers, setAnswers] = useState<Answers>({});

  useDevAutofill(
    () => setAnswers(Object.fromEntries(items.map((i) => [i.id, dummyAnswer(i)]))),
    `post-s${sessionIndex}`,
  );

  const missing = items
    .filter((i) => answers[i.id] === undefined)
    .map((i) => i.id);
  const canContinue = useDevGate(missing.length === 0);

  async function save() {
    if (!canContinue) return;
    if (participantKey) {
      await getStore().saveResponses(
        participantKey,
        `post_task_s${sessionIndex}`,
        answers,
      );
    }
    logEvent("survey_saved", { block: `post_task_s${sessionIndex}` }, {
      sessionIndex,
    });
    onDone();
  }

  return (
    <>
      <Page width="wide">
        <SessionLayout briefing={<BriefingPanel task={task} role={role} />}>
          <SessionHeader
            sessionIndex={sessionIndex}
            title="A few questions about this session"
            steps={steps}
            current={steps.length - 1}
          />

          <MeasureBlock
            block={{
              id: `post_task_${sessionIndex}`,
              title: "Thinking back to what just happened",
              items,
            }}
            answers={answers}
            onChange={(id, value) =>
              setAnswers((prev) => ({ ...prev, [id]: value }))
            }
          />
        </SessionLayout>
      </Page>

      <ActionBar
        label={sessionIndex === 1 ? "Continue to the next session" : "Continue"}
        onClick={save}
        disabled={!canContinue}
        remaining={missing.length}
        firstUnansweredId={missing[0] ?? null}
        note={missing.length === 0 ? "" : `${missing.length} left`}
      />
    </>
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
  const focal = focalIssue(task);
  const value = terms ? packageValue(task, terms) : null;
  const mine = value ? value[role] : task.reservationPoints;
  const held = terms ? preservesFocalThreshold(task, terms[focal.id]) : false;

  return (
    <Card tone="private" className="text-[var(--private-ink)]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em]">
          What this is worth to you
        </span>
        <span className="tabular text-[1.125rem] font-semibold text-[var(--ink)]">
          {mine.toLocaleString()}
        </span>
      </div>
      <p className="text-[0.8125rem]">
        {terms
          ? mine >= task.reservationPoints
            ? `Above your fallback of ${task.reservationPoints.toLocaleString()}.`
            : `Below your fallback of ${task.reservationPoints.toLocaleString()}.`
          : `No agreement — you receive your fallback of ${task.reservationPoints.toLocaleString()}.`}
      </p>
      {/* On an impasse the requirement was not lost — there was simply no
          package. Saying "below the level you judged workable" would report a
          concession that never happened. */}
      {role === "member" && terms ? (
        <p className="mt-3 border-t border-[var(--private-line)] pt-3 text-[0.8125rem]">
          {focal.label}:{" "}
          {held
            ? "at or above the level you judged workable."
            : "below the level you judged workable."}
        </p>
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
      className={
        selected
          ? "rounded-[var(--radius)] border-2 border-[var(--accent)] bg-[var(--accent-soft)] p-3.5 text-left"
          : "rounded-[var(--radius)] border-2 border-[var(--line)] p-3.5 text-left transition-colors hover:border-[var(--ink-3)]"
      }
    >
      <span className="block text-[0.9375rem] font-semibold">{label}</span>
      <span className="block text-[0.8125rem] text-[var(--ink-2)]">{hint}</span>
    </button>
  );
}
