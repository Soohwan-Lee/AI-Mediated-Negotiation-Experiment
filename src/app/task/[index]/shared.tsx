"use client";

/**
 * Phases shared by the Baseline and Proxy tasks (Experimental Design Ver.2.4
 * §8).
 *
 * The order of the first three matters and is not arbitrary:
 *
 *   brief → preferences (+ mandate, in Proxy) → RISK → negotiate
 *
 * PREFERENCES come before anything about how this task will run. They are the
 * first point on the trajectory the study measures — what you wanted, then
 * what you entrusted, then what you opened with, then what survived the
 * challenge, then what reached the final package — and taking them after the
 * condition were visible would contaminate the baseline.
 *
 * RISK comes next and before any negotiation, because it asks what the
 * participant EXPECTS raising their requirement to cost, not what it did.
 *
 * The brief is the one phase that puts the briefing in the main column: it is
 * being read for the first time. From the next phase on it lives in the rail,
 * so it is never taken away.
 */

import {
  useEffect,
  useState,
  type Dispatch,
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
  ReasonBox,
  TaskCover,
  TaskHeader,
  TaskLayout,
} from "@/components/session";
import { OptionChips } from "@/components/issues";
import { ActionBar } from "@/components/study-chrome";
import { Callout, Card, CardTitle, Cue, Page } from "@/components/ui";
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
import type { NegotiationTask, Package, Role } from "@/lib/types";

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
  onStart,
}: {
  taskIndex: 1 | 2;
  steps: string[];
  onStart: () => void;
}) {
  const first = taskIndex === 1;

  return (
    <TaskCover
      counter={{ index: taskIndex, total: 2 }}
      eyebrow="Negotiation task"
      title={first ? "Task 1 starts here" : "Task 2, the last one"}
      lead={
        first ? (
          <>
            <p>
              The practice round is over — this one is the real thing. You will
              be working through a project with{" "}
              {/* The counterpart is presented as another participant
                  throughout the study and is disclosed only at the debriefing.
                  Saying it plainly here is the same claim the rest of the
                  interface makes, in the place the participant is most likely
                  to form an expectation about who they are talking to. */}
              another participant who has the other side of it, and neither of
              you can settle anything alone.
            </p>
            <p>
              Your own briefing is private. It stays on screen for the whole
              task, so there is nothing to memorise now.
            </p>
          </>
        ) : (
          <>
            <p>
              This is the second and last task. It is a different project, with
              a different briefing, and the way you work through it may not be
              the way the first task worked.
            </p>
            <p>
              The other side is a different participant, and nothing carries
              over from the first task.
            </p>
          </>
        )
      }
      steps={steps}
      minutes={STAGE_MINUTES.task}
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

        <Card className="mb-5">
          <CardTitle>📋 The situation</CardTitle>
          {/* The scenario is read once and carefully, so it keeps a reading
              measure even though the task column is wide. */}
          <p className="max-w-prose text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            {task.publicBrief}
          </p>
          <p className="mt-3 text-[0.875rem] text-[var(--ink-3)]">
            Both sides can see this much. Everything below is yours alone.
          </p>
        </Card>

        <BriefingPanel task={task} role={role} />
      </Page>

      <ActionBar
        label="I've read my briefing"
        onClick={onContinue}
        note="It stays beside you for the whole task."
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Phase: preferences on all three terms
// ---------------------------------------------------------------------------

export interface Preferences {
  /** Issue id → the option you would like. */
  preferred: Record<string, string | null>;
  /** Issue id → the least you would settle for. */
  minimum: Record<string, string | null>;
}

/**
 * "What do you want, and what is the least you'd take" on every term.
 *
 * ALL THREE TERMS ARE ENTERED THE SAME WAY. Design §5 principle 4 is explicit
 * about this, and it is the reason the requirement issue gets no extra
 * control, no highlight, and no separate heading: singling it out would tell
 * the participant which term the study is about, and pilot gate 6 exists to
 * catch exactly that kind of transparency.
 *
 * Used by BOTH conditions. In Baseline it is a private plan; in Proxy the same
 * two numbers per term become the mandate the AI Proxy is bound by. Keeping
 * one screen for both is what makes the two conditions comparable at the point
 * where the participant decides what they want.
 */
export function PreferenceForm({
  taskIndex,
  task,
  role,
  steps,
  stepIndex,
  isProxy,
  onContinue,
}: {
  taskIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  stepIndex: number;
  isProxy: boolean;
  onContinue: (prefs: Preferences) => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const [preferred, setPreferred] = useState<Record<string, string | null>>(
    Object.fromEntries(task.issues.map((i) => [i.id, null])),
  );
  const [minimum, setMinimum] = useState<Record<string, string | null>>(
    Object.fromEntries(task.issues.map((i) => [i.id, null])),
  );

  useDevAutofill(() => {
    // Best option for this participant on every term, and a floor one step
    // past their requirement threshold — a mandate that keeps the requirement
    // and pays for it elsewhere, which is the trajectory worth reading.
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
      // Hold the requirement at the threshold; give the other terms away.
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
  const canContinue = useDevGate(missing.length === 0);

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
            title="What you want from this"
            steps={steps}
            current={stepIndex}
          />

          <div className="mb-5">
            <Callout tone="private" title="🔒 Only you see this">
              <p>
                {isProxy
                  ? "These two answers per term are the limits your AI Proxy negotiates inside. It will open at what you want and will not go past the least you would take."
                  : "Nobody else sees this — not the other side, not later in the task. It is recorded so we can compare what you wanted with how things turned out."}
              </p>
            </Callout>
          </div>

          <div className="space-y-4">
            {task.issues.map((issue) => (
              <Card key={issue.id} id={`q-pref-${issue.id}`}>
                <CardTitle hint={issue.description}>{issue.label}</CardTitle>

                {/* The per-issue rationale, beside the score, at every point
                    the participant chooses a level. Design §5 requires it to
                    stay next to the number: a participant reading only the
                    score column optimizes points and ignores the situation,
                    and the situation is the study. */}
                <p className="mb-4 max-w-prose rounded-[var(--radius)] bg-[var(--surface-muted)] px-3 py-2 text-[0.8125rem] leading-relaxed text-[var(--ink-2)]">
                  💡 {issue.rationale[role]}
                </p>

                <p className="mb-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
                  What you would like
                </p>
                <div className="mb-4">
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
                  <p className="mb-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
                    The least you would settle for
                  </p>
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
        </TaskLayout>
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
// Phase: RISK, immediately before the negotiation
// ---------------------------------------------------------------------------

/**
 * The two RISK items (Design §9.2).
 *
 * Its own screen, right before the negotiation opens, because it asks what the
 * participant expects it to cost to raise their requirement — an expectation,
 * which stops being one the moment anything has happened.
 */
export function RiskForm({
  taskIndex,
  task,
  role,
  steps,
  stepIndex,
  /**
   * What the button says. Baseline goes straight into the negotiation from
   * here; Proxy still has the mandate screens to come, and a button promising
   * a negotiation that does not start is a small lie the participant catches
   * immediately.
   */
  continueLabel = "Continue",
  onContinue,
}: {
  taskIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  stepIndex: number;
  continueLabel?: string;
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
            title="One last thing before you start"
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
        label={continueLabel}
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
// Phase: waiting for the other participant
// ---------------------------------------------------------------------------

/**
 * The four-to-five second "waiting for the other participant" pause (Design §8
 * step 3).
 *
 * It exists to make the counterpart read as a person on the other end of a
 * connection rather than a screen that appears instantly, and the suspicion
 * probe is a pilot gate. Deliberately short and honest about what it says: a
 * fake queue position or a progress bar that pretends to measure something
 * would be a second deception on top of the one the IRB approved.
 */
export function Matchmaking({ onReady }: { onReady: () => void }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wait = pauseMs(NEGOTIATION.matchmakingMs);
    const id = window.setTimeout(() => {
      setReady(true);
      onReady();
    }, wait);
    return () => window.clearTimeout(id);
    // Runs once on mount. `onReady` changes identity every render and would
    // restart the timer forever if it were a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page>
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <span
          aria-hidden
          className="mb-5 inline-flex gap-1.5"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)]"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        <p className="text-[1.0625rem] font-semibold">
          {ready ? "Connected." : "Waiting for the other participant\u2026"}
        </p>
        <p className="mt-1.5 max-w-prose text-[0.875rem] text-[var(--ink-2)]">
          They are finishing their own briefing. This usually takes a few
          seconds.
        </p>
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Reason attachment (Baseline)
// ---------------------------------------------------------------------------

/**
 * "Attach one of your reasons to this message."
 *
 * WHY THIS EXISTS. Design §4's acceptance rule needs a deterministic answer to
 * "has a reason been given for this requirement", and §4 puts that judgement
 * with the system rather than the model. Free text cannot supply it without
 * asking a model to grade an argument, which is precisely the decision the
 * design refuses to hand back.
 *
 * WHAT IT MUST NOT DO. It may not tell the participant that attaching a reason
 * helps, may not default to one, and may not treat the sensitive cards as the
 * better answer. It presents the same two boxes as the briefing, in the same
 * order, with nothing selected — the choice of which to voice is a measure,
 * and a control that nudges it destroys the thing it records.
 */
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
    <div className="border-t border-[var(--line)] bg-[var(--private)]/40 px-4 py-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[0.8125rem] text-[var(--private-ink)]">
          {selected ? (
            <>
              <span aria-hidden>📎</span> Saying this reason:{" "}
              <span className="font-medium">
                {selected.text.slice(0, 60)}
                {selected.text.length > 60 ? "\u2026" : ""}
              </span>
            </>
          ) : (
            <>
              <span aria-hidden>📎</span> Say one of your reasons with this
              message (optional)
            </>
          )}
        </span>
        <span className="shrink-0 text-[0.75rem] font-medium text-[var(--private-strong)]">
          {open ? "Close" : "Choose"}
        </span>
      </button>

      {open ? (
        <div className="mt-3">
          <ReasonBox
            title="Work reasons"
            cards={cards.filter((c) => c.layer === "work")}
          >
            {(card) => (
              <ReasonChoice
                card={card}
                checked={value === card.id}
                voiced={alreadyVoiced.includes(card.id)}
                onToggle={() =>
                  onChange(value === card.id ? null : card.id)
                }
              />
            )}
          </ReasonBox>
          <ReasonBox
            title="Sensitive background"
            note={task.roleBriefs[role].disclosureRisk}
            sensitive
            cards={cards.filter((c) => c.layer === "sensitive")}
          >
            {(card) => (
              <ReasonChoice
                card={card}
                checked={value === card.id}
                voiced={alreadyVoiced.includes(card.id)}
                onToggle={() =>
                  onChange(value === card.id ? null : card.id)
                }
              />
            )}
          </ReasonBox>
          <p className="mt-2 text-[0.75rem] text-[var(--private-ink)]">
            You write the message yourself — this only records which of your
            reasons you brought up.
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
      className={
        checked
          ? "flex cursor-pointer gap-2.5 rounded-[var(--radius)] border-2 border-[var(--accent)] bg-[var(--surface)] p-2.5"
          : "flex cursor-pointer gap-2.5 rounded-[var(--radius)] border-2 border-transparent p-2.5 hover:bg-[var(--surface)]/60"
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="text-[0.8125rem] leading-relaxed">
        {card.text}
        {voiced ? (
          <span className="ml-1.5 text-[0.75rem] text-[var(--ink-3)]">
            (already said)
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
          package. Saying "below the level you decided you needed" would report
          a concession that never happened. Both roles see this line now, since
          both hold a requirement. */}
      {terms ? (
        <p className="mt-3 border-t border-[var(--private-line)] pt-3 text-[0.8125rem]">
          {requirement.label}:{" "}
          {held
            ? "at or above the level you decided you needed."
            : "below the level you decided you needed."}
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

// ---------------------------------------------------------------------------
// Phase: the participant negotiates directly (Proxy condition)
// ---------------------------------------------------------------------------

/**
 * After the two AI Proxies have finished, the participant takes over and
 * negotiates with the other participant themselves.
 *
 * WHY THIS EXISTS. Watching a proxy settle something on your behalf and then
 * being asked how it felt is a different experiment from having to carry the
 * result into a conversation with the person it was settled with. The second
 * is the one this study is about: the AI speaks first, and then the
 * participant has to live with what it said in front of the other side.
 *
 * THE PROXY TRANSCRIPT STAYS ON SCREEN. That is not a convenience. Every
 * measure that follows — whether the other side's requirement read as
 * genuinely theirs, who is answerable for what was asked, whether the AI
 * represented them well — is a judgement about words the participant needs to
 * be able to re-read while they respond to them. Taking the transcript away
 * would make those items a memory test.
 *
 * The counterpart is the same controlled counterpart as in Baseline, at the
 * same thresholds, so the two conditions differ in what came BEFORE the direct
 * conversation rather than in how that conversation is run.
 */
export function DirectNegotiation({
  taskIndex,
  task,
  role,
  steps,
  stepIndex,
  proxyTranscript,
  openingPackage,
  /**
   * Did the participant's AI Proxy actually voice a reason for the
   * requirement?
   *
   * Passed in rather than assumed. Hardcoding `true` here made the
   * reason-linked rule inert for every Proxy participant while it changed the
   * counterpart's move for most packages in Baseline — a mechanical asymmetry
   * in the primary outcome, along the primary contrast. And the assumption is
   * not even always true: an emergency stop can end the proxy exchange before
   * it speaks, and a guardrail block can strip the reason out of the message
   * that was meant to carry it.
   */
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
  /** What the two AI Proxies said. Read-only, always on screen. */
  proxyTranscript: DisplayMessage[];
  /** The package the proxies reached, if any. Where this conversation starts. */
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
  // `settled` is OUTSIDE the dev gate on purpose. `useDevGate` exists to let a
  // walkthrough past an unfilled form, but "the conversation is over" is not a
  // validation to skip — bypassing it let the send loop keep firing after the
  // counterpart had accepted, which logged the same ending five times.
  const canSend = useDevGate(complete) && !settled;
  const yourTurn = !pending && canSend && !settled;

  useDevAutofill(() => {
    if (settled) return;
    // Named, so the mockup shows a person defending a specific term rather
    // than a generic pleasantry — which is the thing worth reading on this
    // screen: does taking over from your own proxy sound natural?
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
    setMessages((m) => [...m, own]);
    setDraft("");

    const voiced = attachedReasonId
      ? [...new Set([...voicedReasonIds, attachedReasonId])]
      : voicedReasonIds;
    setVoicedReasonIds(voiced);
    setAttachedReasonId(null);

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
        // The counterpart's script position, stored on the direct messages as
        // it is on every other message. Without it this last segment of the
        // trajectory is the one with no stage attribution.
        stage: counterpartStageAfter(replies + DIRECT_STAGE_OFFSET),
        proposal: Object.keys(offer).length > 0 ? offer : undefined,
        reasonCardId: attachedReasonId ?? undefined,
      });
    }

    setPending(true);
    try {
      // The proxies already made the case, so the counterpart picks its script
      // up mid-way rather than opening again — it has already opened, stated
      // its priority and challenged, through its own proxy. Starting from the
      // trade stage is what makes this a continuation instead of a rerun.
      const stageNow = counterpartStageAfter(replies + DIRECT_STAGE_OFFSET);
      const decision = counterpartStep(
        task,
        counterpartRole,
        stageNow,
        offer,
        lastCounterpartPackage,
        {
          // Either the proxy voiced a reason on the participant's behalf, or
          // the participant has attached one themselves since taking over.
          // Both count, and the ReasonPicker below is a real control because
          // of it.
          reasonGivenForRequirement: reasonAlreadyVoiced || voiced.length > 0,
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
            reasonGiven: reasonAlreadyVoiced || voiced.length > 0,
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
        // Every ending logs, not only the timeout one, so the direct
        // conversation's started event always has a matching ended event.
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
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1 text-[0.8125rem] text-[var(--ink-2)]">
                <span aria-hidden>⏱</span>
                <CountdownTimer
                  seconds={NEGOTIATION_SECONDS}
                  running={!settled}
                  onTick={setSecondsRemaining}
                  /* Running the clock out is an outcome, not a dead end. A
                     participant who stops typing at 00:00 used to be left on a
                     screen with no button and nothing to do — the exchange only
                     ended inside `send`, so someone who sent nothing was
                     stranded. Time expiring now closes the exchange the same
                     way an impasse does. */
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

          {/* What the proxies said, kept where it can be re-read. Collapsed by
              default so it does not push the live conversation off the screen,
              open on demand — and open by default when there is nothing to
              show in the live box yet. */}
          <ProxyTranscriptPanel
            transcript={proxyTranscript}
            openByDefault={messages.length === 0}
          />

          <Card className="mb-5 flex flex-col" padded={false} cue={yourTurn}>
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
              <div>
                <p className="text-[0.875rem] font-medium">
                  💬 You and the other participant
                </p>
                <p className="text-[0.8125rem] text-[var(--ink-2)]">
                  {settled === "agreed"
                    ? "You have both settled on a package."
                    : settled === "impasse"
                      ? "The conversation ended without an agreement."
                      : "This is you writing, not your AI Proxy."}
                </p>
              </div>
              {settled ? null : pending ? (
                <Cue tone="quiet">Waiting for their reply</Cue>
              ) : yourTurn ? (
                <Cue>Your turn</Cue>
              ) : (
                <Cue tone="quiet">Choose your terms first</Cue>
              )}
            </div>
            <Transcript
              messages={messages}
              pending={pending}
              emptyHint="Your AI Proxy has stopped. Anything you say from here is yours."
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
                  ? "This conversation has finished."
                  : canSend
                    ? "Write your message…"
                    : "Choose an option on each term first."
              }
            />
          </Card>

          <Card cue={!complete}>
            <CardTitle
              hint="Where the AI Proxies left it. Change anything you want to put differently."
              aside={
                !complete ? (
                  <Cue>{task.issues.length - chosen} to choose</Cue>
                ) : null
              }
            >
              📦 The package on the table
            </CardTitle>
            <div className="space-y-4">
              {task.issues.map((issue) => (
                <div key={issue.id}>
                  <p className="mb-1.5 text-[0.8125rem] font-medium">
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
          label="Continue"
          onClick={() => onSettled(finalPackage)}
          note={
            settled === "agreed"
              ? "You have a package to review."
              : "No agreement was reached."
          }
        />
      ) : (
        <ActionBar
          note={`${chosen} of ${task.issues.length} terms chosen${
            secondsRemaining <= 0 ? " · time is up" : ""
          }`}
        />
      )}
    </>
  );
}

/**
 * Where the counterpart's script picks up in the direct conversation.
 *
 * Three, so its first reply is a trade rather than an opening: through its own
 * proxy it has already opened, stated its priority and sent the standardized
 * challenge. Replaying those would make the participant answer a challenge
 * they watched being answered, and would give the Proxy arm two challenges
 * where Baseline has one.
 */
const DIRECT_STAGE_OFFSET = 3;

/** Counterpart lines for mockup mode. Ideal trajectory, as everywhere else. */
const DIRECT_MOCK_REPLIES = [
  "yeah, I watched the whole thing. || honestly I think they landed somewhere reasonable — I can live with where it ended up.",
  "that works for me. || shall we call it settled there?",
  "agreed. good to have it sorted.",
];

/**
 * The AI Proxies' conversation, kept available during the direct one.
 *
 * Collapsible rather than always expanded: ten messages above a live chat
 * pushes the thing the participant is doing off the screen. Collapsible rather
 * than a link or a modal: every measure that follows asks them to judge what
 * was said, so re-reading it has to cost one click, not a navigation.
 */
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
    <Card className="mb-5" padded={false}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="block text-[0.9375rem] font-semibold">
            🤖 What the AI Proxies said
          </span>
          <span className="block text-[0.8125rem] text-[var(--ink-2)]">
            {transcript.length} messages. This is what you are both working
            from.
          </span>
        </span>
        <span className="shrink-0 text-[0.8125rem] font-medium text-[var(--accent)]">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-[var(--line)]">
          <Transcript messages={transcript} flow />
        </div>
      ) : null}
    </Card>
  );
}
