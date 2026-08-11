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
        eyebrow="Finished"
        title="You're all done"
        subtitle="Thank you for taking part in this research."
      />

      <Card className="mb-5 text-center">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--ink-3)]">
          Your completion code
        </p>
        <p className="tabular my-4 text-3xl font-semibold tracking-wide">
          {STUDY.prolificCompletionCode}
        </p>
        <button
          type="button"
          onClick={copyCode}
          className="rounded-[var(--radius)] border border-[var(--line-strong)] px-4 py-2 text-[0.875rem] font-medium transition-colors hover:bg-[var(--surface-muted)]"
        >
          {copied ? "Copied" : "Copy code"}
        </button>
      </Card>

      <Card className="mb-5">
        <CardTitle hint="Your payment is approved once your submission is recorded.">
          To get paid
        </CardTitle>
        <p className="mb-4 text-[0.9375rem] text-[var(--ink-2)]">
          Go back to Prolific and submit the code above, or use the button below
          to complete your submission automatically.
        </p>
        <a
          href={STUDY.prolificCompletionUrl}
          className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--accent)] px-5 py-2.5 text-[0.9375rem] font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          Return to Prolific
          <span aria-hidden>→</span>
        </a>
      </Card>

      <Card tone="muted">
        <CardTitle>Questions</CardTitle>
        <p className="text-[0.9375rem] text-[var(--ink-2)]">
          About the study, contact {STUDY.irb.researcherEmail}. About your
          rights as a research participant, contact {STUDY.irb.contactEmail}{" "}
          (protocol {STUDY.irb.protocolNumber}).
        </p>
        <p className="mt-4 text-sm text-[var(--ink-3)]">
          You may now close this window.
        </p>
      </Card>
    </Page>
  );
}
