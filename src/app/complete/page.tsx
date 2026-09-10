"use client";

/**
 * Completion (Methods §9).
 *
 * Issues the Prolific completion code only after pending study writes and the
 * idempotent completion event have been confirmed by the active Store.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardTitle, Page, PageHeader } from "@/components/ui";
import { readStopReason } from "@/lib/check-gates";
import { useDevMode } from "@/lib/dev-mode";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { STUDY, completionSettings } from "@/lib/study-config";
import { readTaskRun } from "@/lib/task-run";

type CompletionStatus = "checking" | "failed" | "ready" | "stopped";

export default function CompletePage() {
  usePageEnter("complete");
  const { participantKey } = useParticipant();
  const { enabled: devEnabled } = useDevMode();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<CompletionStatus>("checking");
  const started = useRef(false);
  const store = getStore();
  const completion = completionSettings();

  const confirmCompletion = useCallback(async () => {
    setStatus("checking");

    if (!participantKey) {
      setStatus("stopped");
      return;
    }

    try {
      const stopped = readStopReason(participantKey);
      const taskRuns = ([1, 2] as const).map((index) =>
        readTaskRun(participantKey, index),
      );
      const tasksCompleted = taskRuns.every((run) => run?.status === "completed");
      if (
        store.persistenceKind === "local" && !devEnabled &&
        (stopped === "withdrawal" || stopped === "technical" || !tasksCompleted)
      ) {
        setStatus("stopped");
        return;
      }

      if (!(await store.confirmSaved())) {
        setStatus("failed");
        return;
      }

      if (store.persistenceKind === "remote") {
        const response = await fetch("/api/complete", {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "same-origin", body: "{}", signal: AbortSignal.timeout(15_000),
        });
        const result = await response.json() as { complete?: boolean };
        setStatus(response.ok && result.complete === true ? "ready" : "failed");
      } else {
        await store.logEvent({
          type: "study_completed", participantKey, page: "complete",
          clientTimestamp: new Date().toISOString(),
        });
        setStatus((await store.confirmSaved()) ? "ready" : "failed");
      }
    } catch {
      setStatus("failed");
    }
  }, [devEnabled, participantKey, store]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void confirmCompletion();
  }, [confirmCompletion]);

  async function copyCode() {
    if (completion.testOnly) return;
    await navigator.clipboard.writeText(STUDY.prolificCompletionCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Page>
      <PageHeader
        eyebrow={status === "ready" ? completion.testOnly ? "Test complete" : "Study Completed · 100%" : "Saving your study"}
        title={status === "ready" ? completion.testOnly ? "Test complete" : "🎉 You're All Done!" : "One last check"}
        subtitle={
          status === "ready"
            ? "Thank you very much for your time and contribution to this research study."
            : "Please keep this page open while we confirm your study data."
        }
      />

      {status === "checking" ? (
        <Card className="mb-6 border-slate-200 bg-white text-center">
          <CardTitle>Checking saved data…</CardTitle>
          <p className="mt-2 text-sm text-slate-600">This usually takes only a moment.</p>
        </Card>
      ) : null}

      {status === "failed" ? (
        <Card className="mb-6 border-amber-300 bg-amber-50 text-center">
          <CardTitle>We could not confirm that all data was saved</CardTitle>
          <p className="mt-2 text-sm text-amber-950">
            Please keep this page open and try again. Your completion code will appear after the save is confirmed.
          </p>
          <button
            type="button"
            onClick={() => void confirmCompletion()}
            className="mt-4 rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-800"
          >
            Retry save
          </button>
        </Card>
      ) : null}

      {status === "stopped" ? (
        <Card className="mb-6 border-amber-300 bg-amber-50 text-center">
          <CardTitle>This study session cannot be completed</CardTitle>
          <p className="mt-2 text-sm text-amber-950">
            The completion code is not available because this session was stopped or a task was interrupted. Please contact the research team for next steps.
          </p>
        </Card>
      ) : null}

      {status === "ready" ? (
        <>
          {completion.testOnly ? (
            <Card className="mb-6 border-amber-300 bg-amber-50">
              <CardTitle>Test complete</CardTitle>
              <p className="mt-2 text-sm">This was a dry run using a temporary completion code. It does not register a Prolific submission or payment. Do not use this deployment for recruitment until the real completion code is configured.</p>
            </Card>
          ) : <>
          <Card className="mb-6 border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-blue-50/40 text-center p-6 sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--accent)] mb-2">
              Your Prolific Completion Code
            </p>
            <div className="my-4 inline-flex items-center justify-center rounded-2xl bg-white border-2 border-indigo-200 px-6 py-3 shadow-sm">
              <span className="font-mono text-2xl sm:text-4xl font-black tracking-wider text-slate-950">
                {STUDY.prolificCompletionCode}
              </span>
            </div>
            <div>
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-slate-800 shadow-2xs hover:bg-slate-50 transition-all active:scale-98"
              >
                <span>{copied ? "✓ Copied to Clipboard!" : "📋 Copy Code"}</span>
              </button>
            </div>
          </Card>

          <Card className="mb-6 border-slate-200 bg-white">
        <CardTitle hint="Submit your submission on Prolific to receive payment:">
          💵 How to Receive Your Payment
        </CardTitle>
        <p className="text-xs sm:text-sm leading-relaxed text-slate-700 font-medium mb-4 mt-2">
          Please copy the code above and paste it into Prolific, or click the button below to automatically register your completion on Prolific.
        </p>
        <div>
          <a
            href={STUDY.prolificCompletionUrl}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm sm:text-base font-extrabold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-98"
          >
            <span>Return to Prolific to Complete</span>
            <span aria-hidden>→</span>
          </a>
        </div>
          </Card>

          </>}
          <Card tone="muted" className="border-slate-200">
        <CardTitle>Research Contact & Questions</CardTitle>
        <p className="text-xs sm:text-sm leading-relaxed text-slate-600 mt-2">
          For questions about the study, findings, or your participation, contact principal investigator {STUDY.irb.principalInvestigator} at <span className="font-semibold text-slate-800">{STUDY.irb.researcherEmail}</span>. {STUDY.irb.institution} IRB determined this study exempt (#{STUDY.irb.exemptionNumber}).
        </p>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          {completion.testOnly
            ? store.persistenceKind === "remote" ? "Your test data was saved to the research server." : "Your test data was saved in this browser only."
            : store.persistenceKind === "remote"
            ? "✓ Your study data was saved to the research server. You may close this tab after registering completion on Prolific."
            : "✓ Your study data was saved in this browser. It has not been submitted to a research server. Keep this tab open until you have registered completion on Prolific."}
        </p>
          </Card>
        </>
      ) : null}
    </Page>
  );
}
