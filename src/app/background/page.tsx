"use client";

/**
 * Demographic & background survey (Methods §2, Appendix A2-A5).
 *
 * Includes the three covariate indices that enter the primary LMM:
 * FNE (3 items), NSE (4 items), AIAE (4 items). Item wording is taken from
 * Appendix A; these are adapted short indices, not full validated scales.
 *
 * Completed before condition assignment is revealed and before any task.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { nextHref } from "@/lib/study-config";
import {
  Button,
  Card,
  Field,
  Likert,
  PageHeader,
  PageShell,
  RadioGroup,
  Select,
  TextInput,
} from "@/components/ui";
import type { SurveyResponses } from "@/lib/types";

const FNE_ITEMS = [
  {
    id: "FNE1",
    text: "I tend to worry about the possibility that other people will evaluate me negatively.",
  },
  {
    id: "FNE2",
    text: "After expressing my opinion, I worry about what other people may think of me.",
  },
  {
    id: "FNE3_R",
    text: "I generally feel comfortable even when other people are evaluating me.",
  },
];

const NSE_ITEMS = [
  {
    id: "NSE1",
    text: "I can clearly express the requirements that matter to me in a negotiation.",
  },
  {
    id: "NSE2",
    text: "I can maintain an important priority even when the counterpart disagrees.",
  },
  {
    id: "NSE3",
    text: "I can identify trade-offs that benefit both sides across multiple issues.",
  },
  {
    id: "NSE4",
    text: "I can judge when to concede and when to protect a minimum acceptable condition.",
  },
];

const AIAE_ITEMS = [
  {
    id: "AIAE1",
    text: "I believe that having access to an AI agent can improve my performance in a task like this.",
  },
  {
    id: "AIAE2",
    text: "I believe that an AI agent can provide information or proposals I can trust.",
  },
  {
    id: "AIAE3",
    text: "I believe that an AI agent can help me see options or strategies I might otherwise miss.",
  },
  {
    id: "AIAE4",
    text: "I believe that an AI agent can reduce the mental workload of a task like this.",
  },
];

export default function BackgroundPage() {
  usePageEnter("background");
  const router = useRouter();
  const { saveResponses, logEvent } = useParticipant();
  const [r, setR] = useState<SurveyResponses>({});
  const [busy, setBusy] = useState(false);

  const set = (id: string, v: string | number) =>
    setR((prev) => ({ ...prev, [id]: v }));
  const num = (id: string) => (r[id] as number) ?? null;
  const str = (id: string) => (r[id] as string) ?? "";

  const likertIds = [
    ...FNE_ITEMS.map((i) => i.id),
    ...NSE_ITEMS.map((i) => i.id),
    ...AIAE_ITEMS.map((i) => i.id),
    "english_proficiency",
    "negotiation_frequency",
    "power_negotiation_experience",
    "llm_use_frequency",
    "agent_familiarity",
  ];

  const complete =
    Boolean(str("age") && str("gender") && str("education") && str("employment")) &&
    likertIds.every((id) => num(id) !== null);

  useDevAutofill(() => {
    setR((prev) => ({
      ...prev,
      age: "34",
      gender: "female",
      education: "bachelors",
      employment: "full_time",
      occupation: "Software",
      years_experience: "8",
      manager_experience: "previously",
      ...Object.fromEntries(likertIds.map((id) => [id, 4])),
    }));
  });

  const canContinue = useDevGate(complete);

  async function handleNext() {
    setBusy(true);
    try {
      await saveResponses("background", r);
      logEvent("page_complete", undefined, { page: "background" });
      router.push(nextHref("background"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="About you"
        subtitle="These questions help us describe who took part. There are no right or wrong answers."
      />

      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold">Demographics</h2>

        <Field label="Age" required>
          <TextInput
            type="number"
            value={str("age")}
            onChange={(v) => set("age", v)}
            placeholder="e.g. 34"
          />
        </Field>

        <Field label="Gender" required>
          <Select
            value={str("gender")}
            onChange={(v) => set("gender", v)}
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "nonbinary", label: "Non-binary or gender diverse" },
              { value: "self_describe", label: "Prefer to self-describe" },
              { value: "no_answer", label: "Prefer not to answer" },
            ]}
          />
        </Field>

        <Field label="Highest level of education completed" required>
          <Select
            value={str("education")}
            onChange={(v) => set("education", v)}
            options={[
              { value: "hs_or_below", label: "High school or below" },
              { value: "some_college", label: "Some college" },
              { value: "bachelors", label: "Bachelor's degree" },
              { value: "masters", label: "Master's degree" },
              { value: "doctorate", label: "Doctorate" },
              { value: "other", label: "Other" },
            ]}
          />
        </Field>

        <Field label="Employment status" required>
          <Select
            value={str("employment")}
            onChange={(v) => set("employment", v)}
            options={[
              { value: "full_time", label: "Employed full-time" },
              { value: "part_time", label: "Employed part-time" },
              { value: "self_employed", label: "Self-employed" },
              { value: "student", label: "Student" },
              { value: "not_employed", label: "Not currently employed" },
              { value: "other", label: "Other" },
            ]}
          />
        </Field>

        <Field label="Occupation or industry">
          <TextInput
            value={str("occupation")}
            onChange={(v) => set("occupation", v)}
            placeholder="e.g. Software, Healthcare, Education"
          />
        </Field>

        <Field label="Years of professional or organizational experience">
          <TextInput
            type="number"
            value={str("years_experience")}
            onChange={(v) => set("years_experience", v)}
            placeholder="e.g. 8"
          />
        </Field>

        <Field label="Have you held a manager or team-leader role?">
          <RadioGroup
            name="manager_experience"
            value={str("manager_experience")}
            onChange={(v) => set("manager_experience", v)}
            options={[
              { value: "never", label: "Never" },
              { value: "previously", label: "Previously" },
              { value: "currently", label: "Currently" },
            ]}
          />
        </Field>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-1 text-base font-semibold">Experience</h2>
        <p className="mb-2 text-xs text-[var(--muted)]">
          Please rate each item on the scale shown.
        </p>
        <Likert
          id="english_proficiency"
          statement="How proficient are you in English?"
          value={num("english_proficiency")}
          onChange={(v) => set("english_proficiency", v)}
          lowAnchor="Not at all proficient"
          highAnchor="Native-like"
        />
        <Likert
          id="negotiation_frequency"
          statement="How often do you negotiate at work or in a team?"
          value={num("negotiation_frequency")}
          onChange={(v) => set("negotiation_frequency", v)}
          lowAnchor="Never"
          highAnchor="Very often"
        />
        <Likert
          id="power_negotiation_experience"
          statement="How often have you negotiated with someone who could affect your evaluation, reward, or opportunities?"
          value={num("power_negotiation_experience")}
          onChange={(v) => set("power_negotiation_experience", v)}
          lowAnchor="Never"
          highAnchor="Very often"
        />
        <Likert
          id="llm_use_frequency"
          statement="How often have you used AI chat tools in the past six months?"
          value={num("llm_use_frequency")}
          onChange={(v) => set("llm_use_frequency", v)}
          lowAnchor="Never"
          highAnchor="Very frequently"
        />
        <Likert
          id="agent_familiarity"
          statement="How familiar are you with AI agents that can act on your behalf?"
          value={num("agent_familiarity")}
          onChange={(v) => set("agent_familiarity", v)}
          lowAnchor="Not at all familiar"
          highAnchor="Very familiar"
        />
      </Card>

      <Card className="mb-6">
        <h2 className="mb-1 text-base font-semibold">
          How you see yourself
        </h2>
        <p className="mb-2 text-xs text-[var(--muted)]">
          1 = Strongly disagree, 7 = Strongly agree
        </p>
        {[...FNE_ITEMS, ...NSE_ITEMS].map((item) => (
          <Likert
            key={item.id}
            id={item.id}
            statement={item.text}
            value={num(item.id)}
            onChange={(v) => set(item.id, v)}
          />
        ))}
      </Card>

      <Card className="mb-8">
        <h2 className="mb-1 text-base font-semibold">
          Your expectations about AI tools
        </h2>
        <p className="mb-2 text-xs text-[var(--muted)]">
          1 = Strongly disagree, 7 = Strongly agree
        </p>
        {AIAE_ITEMS.map((item) => (
          <Likert
            key={item.id}
            id={item.id}
            statement={item.text}
            value={num(item.id)}
            onChange={(v) => set(item.id, v)}
          />
        ))}
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">
          {complete ? "All required items answered." : "Please answer all required items."}
        </p>
        <Button onClick={handleNext} disabled={!canContinue || busy}>
          {busy ? "Saving…" : "Continue"}
        </Button>
      </div>
    </PageShell>
  );
}
