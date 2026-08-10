"use client";

/**
 * Power dynamics manipulation check (Methods §7, Appendix A6).
 *
 * Placed AFTER the outcome questionnaire so the power items do not prime the
 * negotiation experience or the outcome evaluations.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { nextHref, stepNumber } from "@/lib/study-config";
import {
  Button,
  Card,
  Likert,
  PageHeader,
  PageShell,
  ProgressBar,
} from "@/components/ui";
import type { SurveyResponses } from "@/lib/types";

const POWER_ITEMS = [
  { id: "POW1", text: "The Project Leader had formal authority to direct and evaluate the Team Member's work." },
  { id: "POW2", text: "The Project Leader could influence additional rewards and future opportunities received by the Team Member." },
  { id: "POW3", text: "Compared with the counterpart, I had greater control over important outcomes." },
  { id: "POW4", text: "I needed the counterpart's cooperation to achieve an acceptable outcome." },
  { id: "POW5", text: "Despite the authority difference, both parties needed to negotiate rather than one party simply issuing instructions." },
  { id: "POW6_R", text: "During the session where assistants negotiated, one assistant had more procedural authority or speaking rights than the other." },
];

export default function ManipulationCheckPage() {
  usePageEnter("manipulation-check");
  const router = useRouter();
  const { saveResponses, logEvent } = useParticipant();
  const [r, setR] = useState<SurveyResponses>({});
  const [busy, setBusy] = useState(false);

  const num = (id: string) => (r[id] as number) ?? null;
  const complete = POWER_ITEMS.every((i) => num(i.id) !== null);

  async function handleNext() {
    setBusy(true);
    try {
      await saveResponses("manipulation_check", r);
      logEvent("page_complete", undefined, { page: "manipulation-check" });
      router.push(nextHref("manipulation-check"));
    } finally {
      setBusy(false);
    }
  }

  const { step, total } = stepNumber("manipulation-check");

  return (
    <PageShell>
      <ProgressBar step={step} total={total} label="Final check" />
      <PageHeader
        title="About the roles"
        subtitle="A few questions about how you experienced the roles in the scenario. 1 = Strongly disagree, 7 = Strongly agree."
      />

      <Card className="mb-8">
        {POWER_ITEMS.map((item) => (
          <Likert
            key={item.id}
            id={item.id}
            statement={item.text}
            value={num(item.id)}
            onChange={(v) => setR((prev) => ({ ...prev, [item.id]: v }))}
          />
        ))}
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={!complete || busy}>
          {busy ? "Saving…" : "Continue"}
        </Button>
      </div>
    </PageShell>
  );
}
