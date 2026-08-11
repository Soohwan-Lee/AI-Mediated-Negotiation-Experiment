"use client";

/**
 * Direct condition session (Methods §Direct session).
 *
 * The participant writes their own messages and makes their own offers. The
 * counterpart is presented as another participant; it is a controlled LLM
 * behind /api/counterpart.
 *
 * Phases: brief -> priorities -> negotiate -> decide. The briefing sits in the
 * rail from the second phase on, so nothing has to be remembered.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OptionChips } from "@/components/issues";
import {
  CountdownTimer,
  MessageComposer,
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";
import { BriefingPanel, SessionHeader, SessionLayout } from "@/components/session";
import { ActionBar } from "@/components/study-chrome";
import { Card, CardTitle, Page } from "@/components/ui";
import { useDevActions, useDevMockAi } from "@/lib/dev-mode";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { NEGOTIATION, nextHref } from "@/lib/study-config";
import { getTask } from "@/lib/tasks";
import type { Role, TaskId } from "@/lib/types";
import { FinalDecision, InitialPreferenceForm, SessionBrief } from "./shared";

type Phase = "brief" | "preference" | "negotiate" | "decide";

const PHASES: Phase[] = ["brief", "preference", "negotiate", "decide"];
const STEP_LABELS = ["Your briefing", "Your priorities", "Negotiate", "Decide"];

/** Dev-mode stand-ins, so the chat fills up with no model call. */
const MOCK_REPLIES = [
  "[mock] Thanks for setting that out. Timeline is where I have least room — could we trade there?",
  "[mock] I can live with that on credit if the review rights stay with me.",
  "[mock] That works apart from the workload split. Here is a counter-proposal.",
];

export function DirectSession({
  sessionIndex,
  taskId,
  role,
}: {
  sessionIndex: 1 | 2;
  taskId: TaskId;
  role: Role;
}) {
  usePageEnter(`session-${sessionIndex}`);
  const router = useRouter();
  const { logEvent, participantKey } = useParticipant();
  const task = getTask(taskId);

  const [phase, setPhase] = useState<Phase>("brief");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [offer, setOffer] = useState<Record<string, string>>({});
  const [turnsUsed, setTurnsUsed] = useState(0);

  const turnsRemaining = NEGOTIATION.maxTurnsPerSide - turnsUsed;
  const mockAi = useDevMockAi();

  useDevActions(
    `session-${sessionIndex}`,
    PHASES.map((p, i) => ({
      id: p,
      label: STEP_LABELS[i],
      active: phase === p,
      run: () => setPhase(p),
    })),
  );

  async function sendMessage(text: string) {
    const own: DisplayMessage = {
      id: `p${messages.length}`,
      speaker: "participant",
      text,
    };
    const next = [...messages, own];
    setMessages(next);
    setTurnsUsed((t) => t + 1);
    logEvent("message_sent", { length: text.length }, { sessionIndex });

    if (participantKey) {
      void getStore().appendMessage(participantKey, {
        id: own.id,
        sessionIndex,
        speaker: "participant",
        text,
        createdAt: new Date().toISOString(),
      });
    }

    setPending(true);
    try {
      let reply: string;

      if (mockAi) {
        reply = MOCK_REPLIES[turnsUsed % MOCK_REPLIES.length];
        await new Promise((r) => setTimeout(r, 300));
      } else {
        const res = await fetch("/api/counterpart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            participantRole: role,
            turnsRemaining,
            history: next.map((m) => ({
              role: m.speaker === "participant" ? "user" : "assistant",
              content: m.text,
            })),
          }),
        });

        const data = (await res.json()) as { message?: string };
        reply =
          data.message ??
          "Sorry, I lost my train of thought — could you say that again?";

        // A small delay keeps the exchange from feeling instantaneous.
        // TBD (Methods §B3): fixed delay vs. naturalistic jitter.
        await new Promise((r) => setTimeout(r, NEGOTIATION.counterpartDelayMs));
      }

      const counter: DisplayMessage = {
        id: `c${next.length}`,
        speaker: "counterpart",
        text: reply,
      };
      setMessages((m) => [...m, counter]);

      if (participantKey) {
        void getStore().appendMessage(participantKey, {
          id: counter.id,
          sessionIndex,
          speaker: "counterpart",
          text: reply,
          createdAt: new Date().toISOString(),
        });
      }
    } finally {
      setPending(false);
    }
  }

  if (phase === "brief") {
    return (
      <SessionBrief
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        onContinue={() => setPhase("preference")}
      />
    );
  }

  if (phase === "preference") {
    return (
      <InitialPreferenceForm
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        onContinue={() => {
          logEvent("negotiation_started", undefined, { sessionIndex });
          setPhase("negotiate");
        }}
      />
    );
  }

  if (phase === "decide") {
    return (
      <FinalDecision
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        terms={offer}
        onDone={() => {
          logEvent("page_complete", undefined, {
            page: `session-${sessionIndex}`,
            sessionIndex,
          });
          router.push(
            sessionIndex === 1 ? nextHref("session-1") : nextHref("session-2"),
          );
        }}
      />
    );
  }

  const offered = task.issues.filter((i) => offer[i.id]).length;

  return (
    <>
      <Page width="wide">
        <SessionLayout briefing={<BriefingPanel task={task} role={role} />}>
          <SessionHeader
            sessionIndex={sessionIndex}
            title={task.title}
            steps={STEP_LABELS}
            current={2}
            aside={
              <div className="flex shrink-0 items-center gap-3 text-[0.8125rem] text-[var(--ink-2)]">
                <span>
                  <span className="tabular font-medium text-[var(--ink)]">
                    {Math.max(turnsRemaining, 0)}
                  </span>{" "}
                  turns left
                </span>
                <CountdownTimer
                  seconds={NEGOTIATION.sessionSeconds}
                  onExpire={() => setPhase("decide")}
                />
              </div>
            }
          />

          <Card className="mb-5 flex flex-col" padded={false}>
            <div className="border-b border-[var(--line)] px-4 py-3">
              <p className="text-[0.875rem] font-medium">
                Messages with the other party
              </p>
              <p className="text-[0.8125rem] text-[var(--ink-2)]">
                They can see everything you write here.
              </p>
            </div>
            <Transcript
              messages={messages}
              pending={pending}
              emptyHint="Send the first message to begin. Opening with what matters most to you is a reasonable start."
            />
            <MessageComposer
              onSend={sendMessage}
              disabled={pending || turnsRemaining <= 0}
              placeholder={
                turnsRemaining <= 0
                  ? "No turns left — finish below."
                  : "Write your message…"
              }
            />
          </Card>

          <Card>
            <CardTitle hint="This is the package you are proposing. Update it as the conversation moves.">
              Your current offer
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
                    name={`offer-${issue.id}`}
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
        label="Finish this session"
        onClick={() => setPhase("decide")}
        note={`${offered} of ${task.issues.length} issues in your offer`}
      />
    </>
  );
}
