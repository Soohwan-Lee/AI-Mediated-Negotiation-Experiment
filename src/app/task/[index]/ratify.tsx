"use client";

/**
 * RATIFY — the decision the participant kept (Ver.2.13 §7, §9.3).
 *
 * After watching their AI Proxy negotiate, the participant decides what
 * happens to the package it reached: approve it as it stands, ask for a
 * change, or refuse it. Approving ends the task; the other two open a
 * three-minute closing conversation with the other participant.
 *
 * WHY THIS SCREEN IS BACK. Ver.2.12 deleted a ratification screen, and its
 * reasoning was right about the shape it had: when BOTH arms ended with the
 * participant agreeing a package in conversation, a following "do you accept
 * this?" made them re-decide what they had just decided, and handed the Proxy
 * arm a way to undo an agreement Direct could not undo. Ver.2.13 changes
 * that shape. The closing conversation is no longer how a Proxy task ends by
 * default — it is where modify-or-reject LEADS. The construct this study is
 * built on is delegation of VOICE with RETENTION OF THE DECISION (§2.6), and
 * this screen is that retained decision. `RATIFY` is confirmatory for RQ3.
 *
 * IT MUST NOT RECOMMEND AN ANSWER. Approving is not the safe option and
 * refusing is not the bold one. The three controls carry equal visual weight,
 * none is pre-selected (interface rule 2), and no copy suggests what a
 * sensible participant does — the distribution across the three IS the
 * finding. The two-step on refusing is a guard against a misclick, not a
 * discouragement: it is the one choice that leaves nothing standing.
 *
 * The proxies' full exchange stays on the screen, because judging it is
 * exactly what the participant is being asked to do.
 */

import { useState } from "react";
import type { DisplayMessage } from "@/components/negotiation";
import { PackageValue } from "@/components/issues";
import { BriefingPanel, TaskHeader, TaskLayout } from "@/components/session";
import { ActionBar } from "@/components/study-chrome";
import { Callout, Card, CardTitle, Cue, Page, cx } from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { useParticipant } from "@/lib/participant-context";
import type { NegotiationTask, Package, Role } from "@/lib/types";
import { ProxyTranscriptPanel } from "./shared";

export type RatifyChoice = "approved_as_is" | "modified" | "rejected";

const OPTIONS: Array<{
  id: RatifyChoice;
  icon: string;
  label: string;
  hint: string;
}> = [
  // ALL THREE HINTS NAME THE SAME NEXT STEP, and that is now literally true:
  // every choice leads to the closing conversation. What differs is what the
  // participant carries INTO it — the package as it stands, the package as
  // something to change, or nothing at all.
  //
  // Keeping the shape identical across the three is also what stops the screen
  // recommending an answer (§7): when one option ended the task and two did
  // not, "the task is done" read as the quick way out, and the distribution
  // across the three IS the finding.
  {
    id: "approved_as_is",
    icon: "✓",
    label: "Approve it as it stands",
    hint: "You put this package to the other participant yourself, as it stands.",
  },
  {
    id: "modified",
    icon: "✎",
    label: "Ask for a change",
    hint: "You talk to the other participant directly, with this package on the table to change.",
  },
  {
    id: "rejected",
    icon: "✕",
    label: "Refuse it",
    hint: "You talk to the other participant directly, with nothing on the table.",
  },
];

export function RatifyPhase({
  taskIndex,
  task,
  role,
  steps,
  stepIndex,
  tentative,
  proxyTranscript,
  onDecide,
}: {
  taskIndex: 1 | 2;
  task: NegotiationTask;
  role: Role;
  steps: string[];
  stepIndex: number;
  /** The proxies' tentative package. Null only if the exchange was stopped. */
  tentative: Package | null;
  proxyTranscript: DisplayMessage[];
  onDecide: (choice: RatifyChoice) => void;
}) {
  const { logEvent } = useParticipant();
  const [choice, setChoice] = useState<RatifyChoice | null>(null);
  /** Two-step on refusing — the one choice here that leaves nothing standing. */
  const [confirmReject, setConfirmReject] = useState(false);

  useDevAutofill(() => setChoice("approved_as_is"), `ratify-t${taskIndex}`);

  const complete =
    choice !== null && (choice !== "rejected" || confirmReject) && tentative !== null;
  const gated = useDevGate(complete);

  return (
    <>
      <Page width="wide">
        <TaskLayout briefing={<BriefingPanel task={task} role={role} />}>
          <TaskHeader
            taskIndex={taskIndex}
            title="Your Decision on the Proxies' Package"
            steps={steps}
            current={stepIndex}
          />

          <ProxyTranscriptPanel transcript={proxyTranscript} />

          <Card className="mb-6">
            <CardTitle>What the two AI Proxies arrived at</CardTitle>
            {tentative ? (
              <>
                <div className="mt-3 space-y-2.5">
                  {task.issues.map((issue) => (
                    <div
                      key={issue.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5"
                    >
                      <span className="text-sm text-slate-600">
                        {issue.label}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {issue.options.find((o) => o.id === tentative[issue.id])
                          ?.label ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3.5">
                  {/* The participant's OWN value only — never the other
                      side's, never the joint total (§7, pilot gate 6). */}
                  <PackageValue
                    issues={task.issues}
                    role={role}
                    selection={tentative}
                    reservationPoints={task.reservationPoints}
                  />
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                Your AI Proxy did not reach a package. You will settle this
                directly with the other participant.
              </p>
            )}
          </Card>

          <Card className={cx("mb-6", !choice && tentative && "cue-ring")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>This part is yours</CardTitle>
              {!choice && tentative ? <Cue>Your decision</Cue> : null}
            </div>
            <p className="mt-1.5 mb-3.5 text-sm text-slate-600">
              Your AI Proxy could speak for you. It cannot settle anything for
              you — nothing is final until you say so.
            </p>

            {tentative ? (
              <div className="grid gap-2.5">
                {OPTIONS.map((o) => {
                  const on = choice === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setChoice(o.id);
                        setConfirmReject(false);
                      }}
                      className={cx(
                        "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
                        on
                          ? "border-slate-800 bg-slate-50 shadow-2xs"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      )}
                      aria-pressed={on}
                    >
                      <span
                        className={cx(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                          on
                            ? "bg-slate-800 text-white"
                            : "bg-slate-100 text-slate-500",
                        )}
                        aria-hidden
                      >
                        {o.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900">
                          {o.label}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {o.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                There is nothing to approve or refuse, so you go straight to the
                closing conversation.
              </p>
            )}

            {choice === "rejected" ? (
              <div className="mt-3.5">
                <Callout title="Refusing this package" tone="warning">
                  <p className="mb-2.5">
                    Nothing the proxies agreed will stand. You will have three
                    minutes with the other participant, starting from nothing.
                  </p>
                  <label className="flex items-start gap-2.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={confirmReject}
                      onChange={(e) => setConfirmReject(e.target.checked)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>Yes, refuse it and start from nothing.</span>
                  </label>
                </Callout>
              </div>
            ) : null}
          </Card>
        </TaskLayout>
      </Page>

      <ActionBar
        onClick={() => {
          // RATIFY is recorded HERE, where the decision is actually taken.
          // Inferring it afterwards from what the closing conversation
          // produced would code a participant who asked for a change and then
          // agreed the same package as having approved it — a different
          // behaviour, on a confirmatory outcome.
          const decided: RatifyChoice = tentative ? choice! : "rejected";
          logEvent(
            "task_outcome_recorded",
            { ratify: decided, hadPackage: Boolean(tentative) },
            { sessionIndex: taskIndex },
          );
          onDecide(decided);
        }}
        label={
          !tentative
            ? "Go to the closing conversation"
            : "Continue"
        }
        disabled={tentative ? !gated : false}
      />
    </>
  );
}
