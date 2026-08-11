"use client";

/**
 * Condition-specific practice (Methods §4).
 *
 * Uses the SAME interface as the upcoming main session, on a short neutral
 * scenario that does not overlap with Task A or B. Practice data is kept for
 * comprehension and debugging only and is excluded from primary analysis.
 *
 * The point is that nothing in the real session is a surprise, so this screen
 * names what the participant is about to be asked to do rather than only
 * letting them poke at controls.
 */

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { OptionChips } from "@/components/issues";
import {
  MessageComposer,
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";
import { BriefingPanel, SessionLayout } from "@/components/session";
import { ActionBar, BackButton } from "@/components/study-chrome";
import { Callout, Card, CardTitle, Page, PageHeader } from "@/components/ui";
import { isProxyCondition, sessionPlan } from "@/lib/assignment";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { NEGOTIATION } from "@/lib/study-config";
import { PRACTICE_TASK } from "@/lib/tasks";

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
      <Page>
        <p className="text-sm text-[var(--ink-2)]">Loading…</p>
      </Page>
    );
  }

  const plan = sessionPlan(assignment, sessionIndex);
  const isProxy = isProxyCondition(plan.condition);
  const task = PRACTICE_TASK;
  const role = assignment.role;

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
        text: "Thanks — that works for me. This is only practice, so try the controls however you like.",
      },
    ]);
    setPending(false);
  }

  return (
    <>
      <Page width="wide">
        <SessionLayout briefing={<BriefingPanel task={task} role={role} />}>
          <PageHeader
            eyebrow={`Practice for session ${sessionIndex}`}
            title="Try the interface"
            subtitle="Nothing here counts. Take a minute to get used to it."
          />

          <div className="mb-5">
            <Callout title={isProxy ? "In the session ahead" : "In the session ahead"}>
              {isProxy ? (
                <p>
                  You will set instructions and limits for an assistant, which
                  then negotiates with the other party&apos;s assistant while
                  you wait. You review what it agreed and decide whether to
                  accept it.
                </p>
              ) : (
                <p>
                  You will write messages to the other party yourself and build
                  up an offer as you go. When you are done you decide whether to
                  accept where things landed.
                </p>
              )}
            </Callout>
          </div>

          <Card className="mb-5">
            <CardTitle>The practice scenario</CardTitle>
            <p className="text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
              {task.publicBrief}
            </p>
          </Card>

          <Card className="mb-5 flex flex-col" padded={false}>
            <div className="border-b border-[var(--line)] px-4 py-3">
              <p className="text-[0.875rem] font-medium">Practice messages</p>
            </div>
            <Transcript
              messages={messages}
              pending={pending}
              emptyHint="Send anything to see how this works."
            />
            <MessageComposer
              onSend={sendPractice}
              disabled={pending}
              placeholder="Try writing something…"
            />
          </Card>

          <Card>
            <CardTitle hint="Choosing a level on each issue is how you make an offer.">
              Practice offer
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
                    name={`practice-${issue.id}`}
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
        </SessionLayout>
      </Page>

      <ActionBar
        label={`Start session ${sessionIndex}`}
        onClick={finish}
        note="Practice is not recorded as a result."
        secondary={
          // Only before the first session. After that the previous step is a
          // completed session, which cannot be re-entered.
          sessionIndex === 1 ? <BackButton from="practice-1" /> : null
        }
      />
    </>
  );
}
