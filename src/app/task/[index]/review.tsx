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
 * The transcript is here too, and the screen waits for its end to come into
 * view. Moving on without reading how it was reached would make the
 * representation and ownership items meaningless — and OWN-AI4
 * (over-reliance) is interpreted against exactly this: whether they looked.
 */

import { useEffect, useRef, useState } from "react";
import { Transcript, type DisplayMessage } from "@/components/negotiation";
import { BriefingPanel, TaskHeader, TaskLayout } from "@/components/session";
import { ActionBar } from "@/components/study-chrome";
import {
  Callout,
  Card,
  CardTitle,
  Cue,
  Page,
  cx,
} from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { codeOutcome } from "@/lib/negotiation/machine";
import { useParticipant } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import {
  counterRequirementIssue,
  preservesRequirement,
  requirementIssue,
} from "@/lib/tasks";
import type { NegotiationTask, Package, Role } from "@/lib/types";
import {
  DecisionButton,
  OutcomeValue,
  ProxyTranscriptPanel,
  TermsList,
} from "./shared";

/**
 * How the participant responded to the other side's requirement.
 *
 *  accommodate  accepted as it stands
 *  trade        kept, but paid for elsewhere
 *  reduce       asked to go below it, or refused
 */
type RequirementResponse = "accommodate" | "trade" | "reduce";

export function ReviewPhase({
  taskIndex,
  task,
  role,
  steps,
  stepIndex,
  tentative,
  hoped,
  behaviour,
  transcript,
  transcriptTitle,
  transcriptHint,
  proxyTranscript,
  isProxy,
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
     * Categories 3 and 4 are structurally exclusive by arm — Direct has no
     * closing stage, and a Proxy participant's only free speech after the
     * counterpart's disclosure IS the closing — which §9.8-5 flags for the
     * χ² test's unit, not for the coding.
     */
    sbTiming?: "none" | "before_counterpart" | "after_counterpart" | "wrap_up";
  };
  transcript: DisplayMessage[];
  transcriptTitle: string;
  transcriptHint: string;
  /**
   * The AI Proxies' exchange, in a Proxy task. Shown ALONGSIDE the
   * participant's own conversation, never instead of it.
   *
   * Both have to be here. The participant's own words are what the decision is
   * about; the proxies' are what several of the following items ask them to
   * judge — whether the other side's requirement read as genuinely theirs,
   * whether their own proxy represented them, who is answerable. Showing only
   * one makes half the questionnaire a memory test.
   */
  proxyTranscript?: DisplayMessage[];
  /** Proxy tasks show the other participant's closing message. */
  isProxy: boolean;
  onDone: () => void;
}) {
  const { participantKey, logEvent } = useParticipant();
  const mine = requirementIssue(task, role);
  const theirs = counterRequirementIssue(task, role);
  const counterpartRole: Role = role === "leader" ? "member" : "leader";

  const theirOption = tentative
    ? theirs.options.find((o) => o.id === tentative[theirs.id])
    : undefined;
  const heldMine = tentative
    ? preservesRequirement(task, role, tentative[mine.id])
    : false;

  /**
   * The counterpart's one closing line. Under Ver.2.12 any agreement was
   * accepted in conversation by the machine's rules, so there is no reject
   * template left — only "confirmed" and "fallback". Inlined so the mockup
   * reads correctly offline; the voice matches P2's register.
   */
  const principalLine = !tentative
    ? "ah, that's a shame. || understood though — we'll go with the fallback plan then."
    : "glad we got that settled. || works for me — confirming it from my side.";

  const [requirementResponse, setRequirementResponse] =
    useState<RequirementResponse | null>(null);

  // The question unlocks once the end of the transcript has been seen. A
  // marker is used rather than a scroll position because a short transcript
  // may already be fully visible, and that counts as read.
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [transcriptSeen, setTranscriptSeen] = useState(false);

  useEffect(() => {
    const el = transcriptEndRef.current;
    if (!el || transcriptSeen) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setTranscriptSeen(true);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [transcriptSeen]);

  useDevAutofill(() => {
    setRequirementResponse((c) => c ?? "accommodate");
    // The gate is "have they read to the end"; in mockup mode nobody has, and
    // waiting for an intersection that will not happen would strand the walk.
    setTranscriptSeen(true);
  }, `review-t${taskIndex}`);

  const canDecide = useDevGate(transcriptSeen);
  const needsRequirementResponse = Boolean(theirOption);
  const canSubmit = useDevGate(
    transcriptSeen && (!needsRequirementResponse || requirementResponse !== null),
  );

  async function submit() {
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
          // The uptake code (§9.3.1). Asked rather than inferred, because a
          // coder reading the transcript would be guessing at an intention the
          // participant can be asked for directly.
          requirementResponse,
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
            const coded = codeOutcome(task, role, tentative, Boolean(tentative));
            return {
              POINTS: coded.participantPoints,
              JOINT: coded.jointPoints,
            };
          })(),
          // §9.3's two disclosure measures, from the arm that ran the exchange.
          RATIFY: behaviour?.ratify ?? null,
          SB: behaviour?.sb ?? false,
          "SB-TIMING": behaviour?.sbTiming ?? "none",
        },
      );
    }

    logEvent(
      "task_outcome_recorded",
      {
        outcome: tentative ? "agreement" : "no_agreement",
        requirementResponse,
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
  }

  return (
    <>
      <Page width="wide">
        <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
          <TaskHeader
            taskIndex={taskIndex}
            title="Negotiation Results & Summary"
            steps={steps}
            current={stepIndex}
          />

          <div className="mb-6">
            {tentative ? (
              <Callout title="✅ Agreement Successfully Reached!">
                <p className="text-sm leading-relaxed text-emerald-950">
                  You and the other participant settled on a complete project package. Below is the breakdown of agreed terms, your personal payoff points, and the full exchange transcript.
                </p>
              </Callout>
            ) : (
              <Callout title="⚠️ Negotiation Concluded Without Agreement" tone="warning">
                <p className="text-sm leading-relaxed text-amber-950">
                  The negotiation ended without settling all terms. The project reverts to the standard fallback plan, and your fallback score applies.
                </p>
              </Callout>
            )}
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Card className="border-slate-200 bg-white">
              <CardTitle
                hint={
                  hoped
                    ? "What you set out to get, next to what was agreed:"
                    : "Settled option for each term:"
                }
              >
                📦 Final Agreed Package
              </CardTitle>
              <div className="mt-3">
                {tentative ? (
                  hoped ? (
                    <div className="space-y-2.5">
                      {task.issues.map((issue) => {
                        const hopedLabel = issue.options.find(
                          (o) => o.id === hoped[issue.id],
                        )?.label;
                        const agreedLabel = issue.options.find(
                          (o) => o.id === tentative[issue.id],
                        )?.label;
                        const same = hoped[issue.id] === tentative[issue.id];
                        return (
                          <div
                            key={issue.id}
                            className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                          >
                            <p className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                              {issue.label}
                            </p>
                            <p className="mt-1 text-xs sm:text-sm text-[var(--ink-2)]">
                              You hoped for{" "}
                              <strong className="text-slate-800">
                                {hopedLabel ?? "—"}
                              </strong>
                              {" · "}agreed{" "}
                              <strong className="text-slate-800">
                                {agreedLabel ?? "—"}
                              </strong>
                              {same ? " — as you hoped." : "."}
                            </p>
                          </div>
                        );
                      })}
                      {(() => {
                        // The gap is reported on the CORE issue only (§3.3's
                        // neutral shortfall line). A whole-package delta would
                        // show a shortfall even on the best reachable
                        // agreement, because the plan's level on the OTHER
                        // side's term was never winnable — and reading the
                        // maximum as a loss is exactly the editorialising
                        // this screen must not do.
                        const at = (pkg: Package) =>
                          mine.options.find((o) => o.id === pkg[mine.id])
                            ?.points[role] ?? 0;
                        const gap = at(hoped) - at(tentative);
                        if (gap <= 0) return null;
                        return (
                          <p className="text-xs text-[var(--ink-2)]">
                            On {mine.label.toLowerCase()}, the agreement is
                            below what you hoped for — {gap.toLocaleString()}{" "}
                            points less for you on that term.
                          </p>
                        );
                      })()}
                    </div>
                  ) : (
                    <TermsList task={task} terms={tentative} />
                  )
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-center text-xs sm:text-sm font-semibold text-amber-900">
                    No mutual agreement was reached. Fallback conditions apply.
                  </div>
                )}
              </div>
            </Card>
            <OutcomeValue task={task} terms={tentative} role={role} />
          </div>

          {/* Only when the two principals actually spoke. An approver never
              opened a closing conversation (Ver.2.13 §7), so a "post-negotiation
              message" from the other side would be a message nobody sent. */}
          {isProxy && transcript.length > 0 ? (
            <Card className="mb-6 border-slate-200 bg-white">
              <CardTitle hint="Post-negotiation message:">👤 Counterpart Reaction</CardTitle>
              <div className="mt-2">
                <Transcript
                  messages={[
                    {
                      id: "principal-close",
                      speaker: "counterpart_principal",
                      text: principalLine,
                    },
                  ]}
                  flow
                />
              </div>
            </Card>
          ) : null}

          {proxyTranscript?.length ? (
            <ProxyTranscriptPanel transcript={proxyTranscript} />
          ) : null}

          {/* THE PARTICIPANT'S OWN CONVERSATION — when there was one.
              A Proxy participant who approved the package straight off never
              spoke to the other side, and an empty panel captioned "your
              conversation" invites them to look for words they never wrote.
              The proxies' exchange above IS what they are judging in that
              case, and it is already on the screen. The end marker moves with
              the panel so the reflection question still unlocks either way. */}
          {transcript.length > 0 ? (
            <Card className="mb-6 flex flex-col overflow-hidden border-slate-200" padded={false}>
              <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs sm:text-sm font-bold text-[var(--ink)] leading-snug">{transcriptTitle}</h2>
                  <p className="text-xs text-[var(--ink-2)] leading-relaxed break-words">
                    {transcriptHint}{" "}
                    {needsRequirementResponse
                      ? "(Please scroll to the end to unlock the reflection question below)"
                      : ""}
                  </p>
                </div>
                <span className="shrink-0 text-2xs font-bold text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200">
                  {transcript.length} turns
                </span>
              </div>
              <Transcript messages={transcript} flow endRef={transcriptEndRef} />
            </Card>
          ) : (
            <div ref={transcriptEndRef} />
          )}

          {theirOption ? (
            <Card
              className="mb-6 transition-all"
              id="q-requirement-response"
              cue={canDecide && requirementResponse === null}
            >
              <CardTitle
                hint={`They requested ${theirOption.label.toLowerCase()} on ${theirs.label.toLowerCase()}.`}
                aside={
                  canDecide && requirementResponse === null ? (
                    <Cue>Required Response</Cue>
                  ) : null
                }
              >
                🤝 Post-Negotiation Reflection: How did you approach their request?
              </CardTitle>

              {!canDecide ? (
                <div className="mb-4 mt-2">
                  <Callout tone="warning" title="Review Transcript First">
                    <p className="text-xs sm:text-sm">
                      Please scroll through the conversation above to review how the discussion unfolded before answering.
                    </p>
                  </Callout>
                </div>
              ) : null}

              <div
                className={cx(
                  "grid gap-3 transition-opacity sm:grid-cols-3 mt-3",
                  !canDecide && "pointer-events-none opacity-40",
                )}
                aria-disabled={!canDecide}
              >
                <DecisionButton
                  selected={requirementResponse === "accommodate"}
                  onClick={() => setRequirementResponse("accommodate")}
                  label="I Accepted It Fully"
                  hint="Conceded on their preferred level without conditions"
                />
                <DecisionButton
                  selected={requirementResponse === "trade"}
                  onClick={() => setRequirementResponse("trade")}
                  label="I Traded in Exchange"
                  hint="Accepted their request in exchange for concessions on other terms"
                />
                <DecisionButton
                  selected={requirementResponse === "reduce"}
                  onClick={() => setRequirementResponse("reduce")}
                  label="I Pushed Back / Reduced"
                  hint="Negotiated down to a lower level or held my ground"
                />
              </div>
            </Card>
          ) : null}
        </TaskLayout>
      </Page>

      <ActionBar
        label="Continue to Post-Task Survey"
        onClick={submit}
        disabled={!canSubmit}
        note={
          !canDecide
            ? "⚠️ Please scroll to the end of the transcript above."
            : canSubmit
              ? "✓ Ready to proceed"
              : "⚠️ Please select your reflection response above."
        }
      />
    </>
  );
}
