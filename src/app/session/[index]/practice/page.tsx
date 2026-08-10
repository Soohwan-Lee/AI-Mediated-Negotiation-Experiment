"use client";

/**
 * Condition-specific practice (Methods §4).
 *
 * Uses the SAME interface as the upcoming main session but a short, neutral
 * scenario that does not overlap with Task A or B. Practice data is recorded
 * for comprehension and debugging only and is excluded from primary analysis.
 */

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { isProxyCondition, sessionPlan } from "@/lib/assignment";
import { PRACTICE_TASK } from "@/lib/tasks";
import { NEGOTIATION } from "@/lib/study-config";
import {
  Button,
  Callout,
  Card,
  PageHeader,
  PageShell,
} from "@/components/ui";
import {
  IssueReference,
  MessageComposer,
  OfferPanel,
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";

export default function PracticePage({
  params,
}: {
  params: Promise<{ index: string }>;
}) {
  const { index } = use(params);
  const sessionIndex = (Number(index) === 2 ? 2 : 1) as 1 | 2;
  usePageEnter(`practice-${sessionIndex}`);

  const router = useRouter();
  const { assignment, logEvent } = useParticipant();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [offer, setOffer] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  if (!assignment) {
    return (
      <PageShell>
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </PageShell>
    );
  }

  const plan = sessionPlan(assignment, sessionIndex);
  const isProxy = isProxyCondition(plan.condition);
  const task = PRACTICE_TASK;

  function finish() {
    logEvent("page_complete", undefined, { page: `practice-${sessionIndex}` });
    router.push(`/session/${sessionIndex}`);
  }

  async function sendPractice(text: string) {
    setMessages((m) => [
      ...m,
      { id: `p${m.length}`, speaker: "participant", text },
    ]);
    setPending(true);
    await new Promise((r) => setTimeout(r, NEGOTIATION.counterpartDelayMs));
    setMessages((m) => [
      ...m,
      {
        id: `c${m.length}`,
        speaker: "counterpart",
        text: "Thanks — that works for me. This is just a practice round, so feel free to try the controls.",
      },
    ]);
    setPending(false);
  }

  return (
    <PageShell wide>
      <PageHeader
        eyebrow={`Practice for session ${sessionIndex}`}
        title="Try the interface"
        subtitle="This is a practice round. Nothing here counts toward your results."
      />

      <div className="mb-6">
        <Callout>
          {isProxy ? (
            <p>
              In the upcoming session you will set instructions for an assistant
              that negotiates for you. Here you can see how the negotiation and
              review screens look. Take a minute to get familiar with them.
            </p>
          ) : (
            <p>
              In the upcoming session you will write messages and submit offers
              yourself. Try sending a message and setting an offer below.
            </p>
          )}
        </Callout>
      </div>

      <Card className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Practice scenario</h2>
        <p className="text-sm text-[var(--muted)]">{task.publicBrief}</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="flex flex-col p-0">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-medium">
              {isProxy ? "Example conversation" : "Practice conversation"}
            </p>
          </div>
          <Transcript
            messages={messages}
            pending={pending}
            emptyHint="Send a message to see how this works."
          />
          <MessageComposer
            onSend={sendPractice}
            disabled={pending}
            placeholder="Try writing something…"
          />
        </Card>

        <div className="space-y-4">
          <OfferPanel
            issues={task.issues}
            selection={offer}
            onChange={(issueId, optionId) =>
              setOffer((prev) => ({ ...prev, [issueId]: optionId }))
            }
          />
          <IssueReference issues={task.issues} role={assignment.role} />
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={finish}>
          I&apos;m ready — start session {sessionIndex}
        </Button>
      </div>
    </PageShell>
  );
}
