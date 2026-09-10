"use client";

import { useEffect, useState } from "react";
import { Card } from "./ui";
import { LoadRetry } from "./load-retry";
import { getStore } from "@/lib/store";
import type { Speaker, TranscriptMessage } from "@/lib/types";

const SPEAKER_LABEL: Record<Speaker, string> = {
  participant: "You",
  counterpart: "Other Participant",
  participant_proxy: "Your AI Proxy",
  counterpart_proxy: "Other Participant's AI Proxy",
  counterpart_principal: "Other Participant",
  system: "Study",
};

export function TranscriptReview({
  participantKey,
  taskIndex,
}: {
  participantKey: string | null;
  taskIndex: 1 | 2;
}) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!participantKey) return;
    let active = true;
    void getStore().loadMessages(participantKey, taskIndex).then((saved) => {
      if (active) setMessages(saved);
    }).catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [participantKey, taskIndex, attempt]);

  if (loadFailed) return <LoadRetry label="the negotiation transcript" onRetry={() => { setLoadFailed(false); setAttempt((value) => value + 1); }} />;

  if (messages.length === 0) return null;

  return (
    <details className="mb-5">
      <summary className="cursor-pointer text-sm font-bold text-[var(--accent)]">
        Review this negotiation
      </summary>
      <Card className="mt-3 max-h-80 overflow-y-auto">
        <div className="space-y-3">
          {messages.map((message) => (
            <div key={message.id} className="border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
              <p className="text-xs font-bold text-[var(--ink-3)]">
                {SPEAKER_LABEL[message.speaker]}
              </p>
              <div className="mt-1 space-y-1 text-sm leading-relaxed text-[var(--ink)]">
                {message.text.split("||").map((bubble, index) => (
                  <p key={index} className="whitespace-pre-wrap">{bubble.trim()}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </details>
  );
}
