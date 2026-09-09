"use client";

/**
 * Where the task landed, shared by both conditions.
 *
 * THERE IS NO LONGER AN APPROVE/REJECT STEP, and its removal follows from the
 * ver.2.4 handover. Ratification made sense when the AI Proxies produced the
 * final package on their own and the participant had never spoken: something
 * had to stand between a machine's agreement and the participant's own. Now
 * both arms end with the participant themselves agreeing a package in
 * conversation, so asking "do you accept this?" immediately afterwards asks
 * them to re-decide what they have just decided. Worse, it offers a way to
 * undo an agreement that the other side has no matching way to undo, which is
 * not a control either arm's counterpart has.
 *
 * ONE JUDGEMENT REMAINS: what they want to do about THE OTHER SIDE'S
 * requirement. That is not a duplicate of the negotiation — it is the §9.3.1
 * uptake code, and reading it off the transcript afterwards would mean a coder
 * inferring an intention the participant can simply be asked for. Both roles
 * answer it, because ver.2.4 gives both roles a requirement.
 *
 * The outcome is therefore recorded straight from the package the two of them
 * reached. `ownRequirementPreserved` is coded from the package regardless of
 * how they feel about it, which is what §9.3.1 asks for.
 *
 * THE TRANSCRIPTS ARE NOT HERE ANY MORE (Ver.2.24 §7). This screen used to
 * carry the participant's own conversation, the proxies' exchange, and a
 * scroll-to-the-end gate on the uptake question — three chat panels on a
 * screen whose job is to say what was settled, and a gate that made a paid
 * worker scroll back through a conversation they had just had. What every
 * §9.4 item needs is the transcript on the SURVEY screens that ask about it,
 * where `ProxyTranscriptPanel` and `TranscriptReview` still live.
 *
 * The transcript props are still ACCEPTED rather than removed: both arms pass
 * them, and dropping them from the signature would be an edit in files this
 * change does not own. They are simply not rendered here.
 */

import type { DisplayMessage } from "@/components/negotiation";
import { useRef, useState } from "react";
import { BriefingPanel, TaskHeader, TaskLayout } from "@/components/session";
import { ActionBar } from "@/components/study-chrome";
import { Card, CardTitle, Page } from "@/components/ui";
import { codeOutcome, type SbTiming } from "@/lib/negotiation/machine";
import { useParticipant } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import {
  counterRequirementIssue,
  preservesRequirement,
  requirementIssue,
} from "@/lib/tasks";
import type { NegotiationTask, Package, Role } from "@/lib/types";
import { OutcomeValue, TermsList } from "./shared";

export function ReviewPhase({
  taskIndex,
  task,
  role,
  steps,
  stepIndex,
  tentative,
  hoped,
  behaviour,
  onDone,
}: {
  taskIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  stepIndex: number;
  tentative: Package | null;
  /**
   * What the participant said they wanted before negotiating — the entry
   * preferences under Direct, the mandate's preferred levels under Proxy.
   * Ver.2.12 §7 asks the result screen to put hoped-for and agreed side by
   * side, per issue, with the participant's own point difference — neutrally,
   * never as praise or blame: on the WR-only path the gap IS the finding, and
   * a screen that editorialised it would be a manipulation of its own.
   */
  hoped?: Package | null;
  /**
   * The behavioural measures the negotiation produced (§9.3), passed in from
   * whichever arm ran it.
   *
   * They are written into the SAME `task_outcome_t{n}` row as everything else
   * this screen records, rather than left in the event log. The event log is
   * an append-only trace for auditing what happened when; the outcome row is
   * what the export reads per task. Splitting one task's outcomes across both
   * would mean reconstructing half of each participant's primary measures by
   * replaying their events, which is exactly the kind of derivation that goes
   * wrong quietly.
   */
  behaviour?: {
    /**
     * RATIFY — Proxy only; null in Direct, which has nothing to ratify.
     * Confirmatory for RQ3 (Ver.2.13 §9.3).
     */
    ratify?: "approved_as_is" | "modified" | "rejected" | null;
    /**
     * SB — the primary confirmatory outcome (RQ1). Was the participant side's
     * sensitive background out BEFORE the counterpart's own disclosure?
     * Proxy: the mandate checkbox, since a checked card is voiced at the
     * proxy's first reason turn, which is stage 2 and so always before the
     * counterpart's stage-4 disclosure. Direct: tagged at the participant's
     * first reason turn.
     */
    sb?: boolean;
    /**
     * SB-TIMING — WHEN it came out, four exclusive categories (§9.3). This
     * one field replaced PRE-RECIP-SB, POST-RECIP-SB, MUTUAL-SB,
     * SELF-DISCLOSE and SB-VOICED, which were five booleans over the same
     * event: the timing is nominal, not five independent facts, and coding it
     * five times was five chances for them to contradict each other.
     * "Voiced at all" is categories 2+3+4; the old SB-VOICED is derivable and
     * so is not stored.
     *
     * THE UNION IS `SbTiming`, IMPORTED FROM THE MACHINE. It was declared
     * inline here with the old category names, so `tsc` could not see the two
     * drifting apart — which is exactly how `voicedTier` broke once, at both
     * ends at once. The names are the design's own: `first_chance` is the
     * LOCK (the first reason turn), `later_turn` a Direct confession after it,
     * `wrap_up` one made in the Proxy arm's closing.
     *
     * Categories 3 and 4 are structurally exclusive by arm — Direct has no
     * closing stage, and a Proxy participant's only free speech after the
     * counterpart's disclosure IS the closing — which §9.8-5 flags for the
     * χ² test's unit, not for the coding.
     */
    sbTiming?: SbTiming;
  };
  /** Accepted and not rendered — see the note at the top of this file. */
  transcript: DisplayMessage[];
  transcriptTitle: string;
  transcriptHint: string;
  /** Accepted and not rendered — see the note at the top of this file. */
  proxyTranscript?: DisplayMessage[];
  /** Accepted and not rendered — see the note at the top of this file. */
  isProxy: boolean;
  onDone: () => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const mine = requirementIssue(task, role);
  const theirs = counterRequirementIssue(task, role);
  const counterpartRole: Role = role === "leader" ? "member" : "leader";

  const heldMine = tentative
    ? preservesRequirement(task, role, tentative[mine.id])
    : false;

  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      if (participantKey) {
        await getStore().saveAgreement(participantKey, {
          sessionIndex: taskIndex,
          terms: task.issues.map((i) => ({
            issueId: i.id,
            optionId: tentative?.[i.id] ?? null,
            unresolved: !tentative?.[i.id],
          })),
          unresolvedIssueIds: tentative
            ? task.issues.filter((i) => !tentative[i.id]).map((i) => i.id)
            : task.issues.map((i) => i.id),
        });
        await getStore().saveResponses(
          participantKey,
          `task_outcome_t${taskIndex}`,
          {
            // Whether the negotiation produced a package at all. This used to be
            // implicit in the ratification choice; with the choice gone it is
            // stated, because "no agreement" and "an agreement" are different
            // outcomes and every downstream measure needs to tell them apart.
            outcome: tentative ? "agreement" : "no_agreement",
            ownRequirementOptionId: tentative?.[mine.id] ?? null,
            ownRequirementPreserved: heldMine,
            theirRequirementOptionId: tentative?.[theirs.id] ?? null,
            theirRequirementPreserved: tentative
              ? preservesRequirement(task, counterpartRole, tentative[theirs.id])
              : false,
            // §3.4's outcome pair, derived by `codeOutcome` rather than
            // recomputed here. UNLOCK, CONCEAL-PREMIUM and MAX-JOINT are GONE
            // (§9.6): under the symmetric package rule JOINT takes one of four
            // values, one per rung plus impasse, so it already encodes the tier
            // reached, the cost of concealing, and whether the maximum opened.
            // Three booleans computed off one number are three ways to disagree
            // with it.
            ...(() => {
              const coded = codeOutcome(
                task,
                role,
                tentative,
                Boolean(tentative),
              );
              return {
                POINTS: coded.participantPoints,
                JOINT: coded.jointPoints,
              };
            })(),
            // §9.3's two disclosure measures, from the arm that ran the exchange.
            RATIFY: behaviour?.ratify ?? null,
            SB: behaviour?.sb ?? false,
            "SB-TIMING": behaviour?.sbTiming ?? "never",
          },
        );
      }

      logEvent(
        "task_outcome_recorded",
        {
          outcome: tentative ? "agreement" : "no_agreement",
        },
        { sessionIndex: taskIndex },
      );

      // A Proxy task fires `negotiation_ended` more than once — once when the AI
      // Proxies finish, once when the direct conversation closes. The marker is
      // what keeps them apart; without it they are distinguishable only by
      // arrival order, and anything that counts or joins on the event
      // double-counts the Proxy arm against a Direct arm that fires it fewer
      // times. This one closes the task itself.
      logEvent("negotiation_ended", { phase: "task_closed" }, {
        sessionIndex: taskIndex,
      });
      onDone();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Page width="wide">
        <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
          <TaskHeader
            taskIndex={taskIndex}
            title="Result"
            steps={steps}
            current={stepIndex}
          />

          {/* ONE SCREEN, THE DECISION ONLY (Ver.2.24 §7).
              The transcripts used to sit here — the participant's own, the
              proxies', and a scroll-to-the-end gate on the uptake question
              below. Three panels of chat on a screen whose job is to say what
              was agreed, and the gate made a paid worker scroll through a
              conversation they had just had. What every §9.4 item needs is
              the transcript on the SURVEY screens that ask about it, not
              here. This screen answers "what did we settle on, and what is it
              worth to me". */}

          {tentative ? (
            <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
              You reached an agreement on both issues.
            </p>
          ) : (
            <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              No agreement. Nothing is settled, and this task scores 0 for both
              of you.
            </p>
          )}

          {/* `items-start` so the left card does not stretch to the height of
              the points card beside it and leave a block of empty white. */}
          <div className="mb-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Card className="border-slate-200 bg-white">
              <CardTitle>{tentative ? "What you agreed" : "Nothing was agreed"}</CardTitle>

              {tentative ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {task.issues.map((issue, index) => {
                    const agreedLabel = issue.options.find(
                      (o) => o.id === tentative[issue.id],
                    )?.label;
                    const hopedLabel = hoped
                      ? issue.options.find((o) => o.id === hoped[issue.id])?.label
                      : null;
                    const same = hoped
                      ? hoped[issue.id] === tentative[issue.id]
                      : false;
                    return (
                      <div
                        key={issue.id}
                        className="overflow-hidden rounded-xl border border-slate-200"
                      >
                        {/* Positional headings, same two words in the same
                            order for both roles — they say there are two
                            issues without saying which one the study is
                            about (§5 principle 1). */}
                        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-[var(--ink-3)]">
                            Issue {index + 1}
                          </p>
                          <p className="text-sm font-bold leading-snug text-[var(--ink)]">
                            {issue.label}
                          </p>
                        </div>
                        <div className="p-3">
                          <p className="text-base font-black text-[var(--ink)]">
                            {agreedLabel ?? "—"}
                          </p>
                          {hopedLabel ? (
                            <p className="mt-1 text-xs text-[var(--ink-3)]">
                              {same
                                ? "As you hoped for."
                                : `You hoped for ${hopedLabel}.`}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3">
                  <TermsList task={task} terms={tentative ?? {}} />
                </div>
              )}

              {/* The gap is reported on the CORE issue only (§3.3's neutral
                  shortfall line). A whole-package delta would show a
                  shortfall even on the best reachable agreement, because the
                  plan's level on the OTHER side's term was never winnable —
                  and reading the maximum as a loss is exactly the
                  editorialising this screen must not do. */}
              {tentative && hoped
                ? (() => {
                    const at = (pkg: Package) =>
                      mine.options.find((o) => o.id === pkg[mine.id])
                        ?.points[role] ?? 0;
                    const gap = at(hoped) - at(tentative);
                    if (gap <= 0) return null;
                    return (
                      <p className="mt-3 text-xs leading-relaxed text-[var(--ink-2)]">
                        On {mine.label.toLowerCase()}, the agreement is below
                        what you hoped for. That is {gap.toLocaleString()}{" "}
                        points less for you on that issue.
                      </p>
                    );
                  })()
                : null}
            </Card>

            <OutcomeValue task={task} terms={tentative} role={role} />
          </div>

        </TaskLayout>
      </Page>

      <ActionBar
        label="Continue"
        onClick={submit}
        busy={busy}
      />
    </>
  );
}
