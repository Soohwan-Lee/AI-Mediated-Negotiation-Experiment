"use client";

/**
 * Completion (Methods §9).
 *
 * Issues the Prolific completion code. This page is reached regardless of the
 * data-withdrawal choice on the debriefing page — withdrawing data must never
 * cost the participant their payment.
 */

import { useEffect, useState } from "react";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { STUDY } from "@/lib/study-config";
import { Button, Card, PageHeader, PageShell } from "@/components/ui";

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
    <PageShell>
      <div className="py-8">
        <PageHeader
          title="You're all done"
          subtitle="Thank you for taking part in this research."
        />

        <Card className="mb-6 text-center">
          <p className="mb-2 text-xs uppercase tracking-widest text-[var(--muted)]">
            Your completion code
          </p>
          <p className="mb-4 font-mono text-2xl font-semibold tracking-wider">
            {STUDY.prolificCompletionCode}
          </p>
          <Button onClick={copyCode} variant="secondary">
            {copied ? "Copied" : "Copy code"}
          </Button>
        </Card>

        <Card className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">To get paid</h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Return to Prolific and submit the code above, or use the button
            below to complete your submission automatically. Your payment will
            be approved once your submission is recorded.
          </p>
          <a
            href={STUDY.prolificCompletionUrl}
            className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)] transition-colors hover:bg-black"
          >
            Return to Prolific
          </a>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold">Questions?</h2>
          <p className="text-sm text-[var(--muted)]">
            If you have any questions about this study, contact the research
            team at {STUDY.irb.researcherEmail}. For questions about your rights
            as a research participant, contact {STUDY.irb.contactEmail}{" "}
            (protocol {STUDY.irb.protocolNumber}).
          </p>
          <p className="mt-4 text-xs text-[var(--muted)]">
            You may now close this window.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
