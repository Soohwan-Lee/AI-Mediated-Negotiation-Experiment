"use client";

/**
 * Welcome + informed consent. Everything a participant agrees to is on this
 * one screen.
 *
 * It is laid out rather than written out: the facts as a row, the study as a
 * numbered sequence with times, the recorded data as a short list. A consent
 * form that reads as an essay gets skimmed, and skimmed consent is not
 * consent — the point of the structure is that the obligations are legible in
 * one pass.
 *
 * IRB NOTE: this study uses deception — the counterpart is a controlled LLM
 * presented as another participant, and the reward decision is scenario-level
 * only. Neither is disclosed here; both are disclosed in full at /debriefing
 * (Methods §Debriefing and Completion). The text below is truthful about
 * everything else: what is collected, that stopping is free, and that some
 * details are withheld until the end.
 *
 * The IRB text is PLACEHOLDER and must be replaced with the approved protocol
 * language before recruitment.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionBar } from "@/components/study-chrome";
import {
  Card,
  CardTitle,
  Checkbox,
  KeyPoint,
  Page,
  PageHeader,
  SummaryGrid,
  cx,
} from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { useParticipant } from "@/lib/participant-context";
import { STAGE_MINUTES, STUDY, nextHref } from "@/lib/study-config";

/** Derived from STAGE_MINUTES so the promised times cannot drift from the flow. */
const STEPS = [
  {
    title: "A few questions about you",
    detail: "Background and experience. No right answers.",
    minutes: STAGE_MINUTES.background,
  },
  {
    title: "Instructions, and a short check",
    detail: "Your role in the scenario, then three questions on it.",
    minutes: STAGE_MINUTES.instruction,
  },
  {
    title: "A practice round",
    detail: "The same controls, on a scenario that does not count.",
    minutes: STAGE_MINUTES.practice,
  },
  {
    title: "Two negotiation tasks",
    detail:
      "Each has a ten-minute limit, then some questions and a bonus decision.",
    minutes: 2 * (STAGE_MINUTES.task + STAGE_MINUTES.taskSurvey + STAGE_MINUTES.reward),
  },
  {
    title: "Final questions",
    detail: "A few about the study as a whole, then the explanation.",
    minutes: STAGE_MINUTES.wrapUp,
  },
];

const RECORDED = [
  "Your survey answers",
  "The messages and offers you send",
  "The instructions and limits you set for the software tool",
  "Clicks, decisions, and timestamps",
  "The negotiation transcripts",
];

export default function ConsentPage() {
  const router = useRouter();
  const { beginStudy, prolific } = useParticipant();
  const [agreed, setAgreed] = useState(false);
  const [isAdult, setIsAdult] = useState(false);
  const [busy, setBusy] = useState(false);

  useDevAutofill(() => {
    setIsAdult(true);
    setAgreed(true);
  });

  const canProceed = useDevGate(agreed && isAdult);

  async function handleConsent() {
    if (!canProceed) return;
    setBusy(true);
    try {
      await beginStudy();
      router.push(nextHref("welcome"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Page>
        <PageHeader
          eyebrow="Research Study · CHI 2027"
          title={STUDY.title}
          subtitle="A study exploring workplace negotiation and communication patterns when software tools are involved."
        />

        {/* 3 Core Stats Cards */}
        <div className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-3 sm:gap-4">
          <StatCard
            icon="⏱️"
            label="Estimated Time"
            value={`~${STUDY.estimatedMinutes} min`}
            hint="5 short parts"
            tone="blue"
          />
          <StatCard
            icon="💵"
            label="Compensation"
            value={`${STUDY.currencySymbol}${STUDY.compensation}`}
            hint="Guaranteed base pay"
            tone="emerald"
          />
          <StatCard
            icon="📈"
            label="Equivalent Rate"
            value={`${STUDY.currencySymbol}${STUDY.hourlyEquivalent}/hr`}
            hint="Well above minimum wage"
            tone="indigo"
          />
        </div>

        {/* Quick Summary Card */}
        <Card className="mb-6 border-blue-100 bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-2xs border border-blue-200">
              💡
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 mb-1">
                What will you do?
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-slate-700">
                You will take part in <strong>two short workplace negotiation scenarios</strong> to agree on project terms with another participant. In one scenario, a <strong>software tool negotiates on your behalf</strong> before you finish the conversation. Afterwards, you will answer short questions about how each went.
              </p>
            </div>
          </div>
        </Card>

        {/* Study Overview Cards */}
        <div className="mb-6">
          <SummaryGrid cols={3}>
            <KeyPoint icon="💬" title="Negotiation Tasks">
              Participate in 2 simulated project decision scenarios (~10 mins each).
            </KeyPoint>
            <KeyPoint icon="🤖" title="AI Assistance">
              Test direct negotiation vs. delegating to an AI Proxy agent.
            </KeyPoint>
            <KeyPoint icon="📝" title="Short Surveys">
              Share your perspective, feelings, and decision experience.
            </KeyPoint>
          </SummaryGrid>
        </div>

        {/* Study Timeline Steps */}
        <Card className="mb-6">
          <CardTitle hint="Standard 4-step sequence (approx. 25–30 minutes total):">
            🗺️ Study Flow Timeline
          </CardTitle>
          <ol className="relative mt-4 space-y-3.5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex items-start gap-3.5">
                {i < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute left-[17px] top-9 h-[calc(100%+0.5rem)] w-[2px] bg-slate-200"
                  />
                ) : null}
                <span
                  aria-hidden
                  className="tabular relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-indigo-200 bg-indigo-50 text-xs font-black text-[var(--accent)] shadow-2xs"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 rounded-xl bg-slate-50/70 p-3 border border-slate-100 shadow-2xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs sm:text-sm font-bold text-[var(--ink)]">{step.title}</p>
                    <span className="tabular shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-2xs font-bold text-[var(--ink-2)] shadow-2xs">
                      ⏱️ {step.minutes}m
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ink-2)] leading-relaxed">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {/* Data & Privacy Section */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardTitle hint="Standard anonymized research telemetry">
              📝 What is Recorded
            </CardTitle>
            <ul className="space-y-2 mt-2">
              {RECORDED.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-xs sm:text-sm text-[var(--ink-2)]"
                >
                  <span aria-hidden className="text-emerald-600 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardTitle hint="Strict research confidentiality">
              🛡️ How Data is Kept
            </CardTitle>
            <p className="text-xs sm:text-sm leading-relaxed text-[var(--ink-2)]">
              All responses are strictly anonymized under a research code. Your Prolific ID is used solely for compensation.
            </p>
            <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/80 p-2 text-2xs sm:text-xs leading-relaxed text-amber-900 font-medium">
              ⚠️ Please do not enter real names or personal contact info in text boxes.
            </div>
          </Card>
        </div>

        {/* Important Terms / IRB obligations */}
        <Card className="mb-6">
          <CardTitle>📋 Important Participant Information</CardTitle>
          <div className="space-y-2.5 mt-3">
            <KeyPoint icon="⚖️" title="Risks & Benefits">
              Minimal everyday workplace discussion tasks. No direct benefit beyond advertised compensation.
            </KeyPoint>
            <KeyPoint icon="🚪" title="Voluntary Participation">
              You may withdraw at any time by closing this tab without penalty on Prolific.
            </KeyPoint>
            <KeyPoint icon="🔎" title="Full Debriefing">
              Complete research context and study design details will be provided at the end.
            </KeyPoint>
          </div>
        </Card>

        {/* Researcher details */}
        <Card className="mb-6" tone="muted">
          <CardTitle>Research Team & Contacts</CardTitle>
          <dl className="grid gap-4 sm:grid-cols-2 text-xs sm:text-sm mt-2">
            <div>
              <dt className="text-2xs font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                Principal Investigator
              </dt>
              <dd className="font-semibold text-slate-800">
                {STUDY.irb.principalInvestigator}, {STUDY.irb.institution}
                <br />
                <a
                  href={`mailto:${STUDY.irb.researcherEmail}`}
                  className="text-[var(--accent)] hover:underline font-bold mt-0.5 inline-block"
                >
                  {STUDY.irb.researcherEmail}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-2xs font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                Institutional Review Board (IRB)
              </dt>
              <dd className="font-semibold text-slate-800">
                {STUDY.irb.institution} IRB
                <br />
                <span className="text-slate-600 font-medium">Protocol #{STUDY.irb.protocolNumber} · {STUDY.irb.contactEmail}</span>
              </dd>
            </div>
          </dl>
        </Card>

        {/* Consent Section */}
        <Card className="border-2 border-indigo-200 bg-indigo-50/20 shadow-sm">
          <CardTitle hint="Please confirm eligibility and consent to proceed:">
            Your Informed Consent
          </CardTitle>
          <div className="space-y-3 mt-3">
            <Checkbox checked={isAdult} onChange={setIsAdult}>
              <strong className="font-bold text-[var(--ink)]">Age & Location: </strong>
              I am at least 18 years old and currently reside in the United States.
            </Checkbox>
            <Checkbox checked={agreed} onChange={setAgreed}>
              <strong className="font-bold text-[var(--ink)]">Voluntary Consent: </strong>
              I have read and understood the information above. I understand that my participation is voluntary and I agree to participate in this study.
            </Checkbox>
          </div>
        </Card>
      </Page>

      <ActionBar
        label="Agree and Begin Study"
        onClick={handleConsent}
        disabled={!canProceed}
        busy={busy}
        note={
          prolific.prolificPid
            ? "✓ Prolific ID detected."
            : "Preview mode (No Prolific ID detected)."
        }
      />
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  hint: string;
  tone: "blue" | "emerald" | "indigo";
}) {
  const toneClasses = {
    blue: "border-blue-200 bg-blue-50/60 text-blue-950",
    emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-950",
    indigo: "border-indigo-200 bg-indigo-50/60 text-indigo-950",
  };

  return (
    <div className={cx("rounded-2xl border p-4 sm:p-5 shadow-xs transition-all", toneClasses[tone])}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>
      <p className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-slate-600">
        {hint}
      </p>
    </div>
  );
}
