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

import { useEffect, useState } from "react";
import { MeasureBlock, type Answers } from "@/components/measure";
import {
  BriefingPanel,
  ReasonBox,
  TaskHeader,
  TaskLayout,
} from "@/components/session";
import { OptionChips } from "@/components/issues";
import { ActionBar } from "@/components/study-chrome";
import { Callout, Card, CardTitle, Page } from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { dummyAnswer, riskBlock } from "@/lib/measures";
import { useParticipant } from "@/lib/participant-context";
import { NEGOTIATION, pauseMs } from "@/lib/study-config";
import { getStore } from "@/lib/store";
import {
  packageValue,
  preservesRequirement,
  requirementIssue,
} from "@/lib/tasks";
import type { NegotiationTask, Package, Role } from "@/lib/types";

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
