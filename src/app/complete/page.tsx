"use client";

/**
 * Completion (Methods §9).
 *
 * Issues the Prolific completion code, unconditionally. Whatever a participant
 * did or did not do earlier, reaching this page means they are paid.
 */

import { useEffect, useState } from "react";
import { Card, CardTitle, Page, PageHeader } from "@/components/ui";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { STUDY } from "@/lib/study-config";

export default function CompletePage() {
  usePageEnter("complete");
  const { logEvent } = useParticipant();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    logEvent("study_completed");
  }, [logEvent]);

  async function copyCode() {
    await navigator.clipboard.writeText(STUDY.prolificCompletionCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Study Completed · 100%"
        title="🎉 You're All Done!"
        subtitle="Thank you very much for your time and contribution to this research study."
      />

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

      <Card tone="muted" className="border-slate-200">
        <CardTitle>Research Contact & Questions</CardTitle>
        <p className="text-xs sm:text-sm leading-relaxed text-slate-600 mt-2">
          For any questions about the study or findings, please contact <span className="font-semibold text-slate-800">{STUDY.irb.researcherEmail}</span>. About your rights as a participant, contact {STUDY.irb.institution} IRB at <span className="font-semibold text-slate-800">{STUDY.irb.contactEmail}</span> (Protocol #{STUDY.irb.protocolNumber}).
        </p>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          ✓ Your data is safely submitted. You may now close this browser tab once you have registered completion on Prolific.
        </p>
      </Card>
    </Page>
  );
}
