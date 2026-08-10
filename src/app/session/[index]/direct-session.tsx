"use client";

/**
 * Direct condition session (Methods §Direct session).
 *
 * The participant writes their own messages and submits their own offers. The
 * counterpart is presented as another participant; it is a controlled LLM
 * behind /api/counterpart.
 *
 * Phases: brief -> initial preference -> negotiate -> final decision.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { getTask } from "@/lib/tasks";
import { NEGOTIATION, nextHref } from "@/lib/study-config";
import type { Role, TaskId } from "@/lib/types";
import { Button, Card, PageHeader, PageShell } from "@/components/ui";
import {
  CountdownTimer,
  IssueReference,
  MessageComposer,
  OfferPanel,
  RoleScorecard,
  Transcript,
  type DisplayMessage,
} from "@/components/negotiation";
import { SessionBrief, InitialPreferenceForm, FinalDecision } from "./shared";

type Phase = "brief" | "preference" | "negotiate" | "decide";

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
  const [confidence, setConfidence] = useState(50);
  const [turnsUsed, setTurnsUsed] = useState(0);

  const turnsRemaining = NEGOTIATION.maxTurnsPerSide - turnsUsed;

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

      const data = (await res.json()) as { message?: string; error?: string };
      const reply =
        data.message ??
        "Sorry, I got distracted for a second — could you say that again?";

      // A small delay keeps the exchange from feeling instantaneous.
      // TBD (Methods §B3): fixed delay vs. naturalistic jitter.
      await new Promise((r) =>
        setTimeout(r, NEGOTIATION.counterpartDelayMs),
      );

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

  // --- phase: brief ------------------------------------------------------
  if (phase === "brief") {
    return (
      <SessionBrief
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        onContinue={() => setPhase("preference")}
      />
    );
  }

  // --- phase: initial preference ----------------------------------------
  if (phase === "preference") {
    return (
      <InitialPreferenceForm
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        onContinue={() => {
          logEvent("negotiation_started", undefined, { sessionIndex });
          setPhase("negotiate");
        }}
      />
    );
  }

  // --- phase: final decision --------------------------------------------
  if (phase === "decide") {
    return (
      <FinalDecision
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        terms={offer}
        confidence={confidence}
        onConfidenceChange={setConfidence}
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

  // --- phase: negotiate --------------------------------------------------
  return (
    <PageShell wide>
      <div className="mb-6 flex items-baseline justify-between">
        <PageHeader
          eyebrow={`Session ${sessionIndex} of 2`}
          title={task.title}
        />
        <div className="flex items-center gap-4 text-sm">
          <span className="text-[var(--muted)]">
            Turns left: {Math.max(turnsRemaining, 0)}
          </span>
          <CountdownTimer
            seconds={NEGOTIATION.sessionSeconds}
            onExpire={() => setPhase("decide")}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="flex flex-col p-0">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-medium">Negotiation</p>
            <p className="text-xs text-[var(--muted)]">
              You are messaging the other participant directly.
            </p>
          </div>
          <Transcript
            messages={messages}
            pending={pending}
            emptyHint="Send the first message to begin. You might open with what matters most to you."
          />
          <MessageComposer
            onSend={sendMessage}
            disabled={pending || turnsRemaining <= 0}
            placeholder={
              turnsRemaining <= 0
                ? "No turns remaining — please finalize below."
                : "Write your message…"
            }
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
          <Button
            onClick={() => setPhase("decide")}
            variant="secondary"
            className="w-full"
          >
            Finalize this session
          </Button>
          <RoleScorecard task={task} role={role} />
          <IssueReference issues={task.issues} role={role} showPoints />
        </div>
      </div>
    </PageShell>
  );
}
