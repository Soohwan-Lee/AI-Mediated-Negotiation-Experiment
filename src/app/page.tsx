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
import { useState, type ReactNode } from "react";
import { ActionBar } from "@/components/study-chrome";
import { Callout, Card, CardTitle, Checkbox, Page, PageHeader } from "@/components/ui";
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
          eyebrow="Research study"
          title={STUDY.title}
          subtitle="A study about workplace negotiation, and how people communicate when software tools are involved."
        />

        {/* The three things anyone decides on first. */}
        <Card className="mb-5" tone="muted">
          <dl className="grid grid-cols-3 gap-4">
            <Fact icon={<ClockIcon />} label="Takes about" value={`${STUDY.estimatedMinutes} min`} />
            <Fact icon={<CoinIcon />} label="You are paid" value={`$${STUDY.compensationUsd}`} />
            <Fact icon={<RateIcon />} label="Equivalent to" value={`$${STUDY.hourlyEquivalentUsd}/hr`} />
          </dl>
        </Card>

        <Card className="mb-5">
          <CardTitle>What you will do</CardTitle>
          <ol className="relative">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex gap-4 pb-5 last:pb-0">
                {/* Connector, drawn between the markers rather than under them. */}
                {i < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute left-[13px] top-8 h-[calc(100%-2rem)] w-px bg-[var(--line)]"
                  />
                ) : null}
                <span
                  aria-hidden
                  className="tabular relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--surface)] text-[0.75rem] font-semibold"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[0.9375rem] font-medium">{step.title}</p>
                    <span className="tabular shrink-0 text-[0.8125rem] text-[var(--ink-3)]">
                      {step.minutes} min
                    </span>
                  </div>
                  <p className="text-[0.875rem] text-[var(--ink-2)]">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="mb-5 grid gap-5 sm:grid-cols-2">
          <Card>
            <CardTitle>What is recorded</CardTitle>
            <ul className="space-y-1.5">
              {RECORDED.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-[0.875rem] text-[var(--ink-2)]"
                >
                  <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--ink-3)]" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardTitle>How it is kept</CardTitle>
            <p className="text-[0.875rem] leading-relaxed text-[var(--ink-2)]">
              Your answers are stored under a study code. Your Prolific ID is
              kept separately and used only to confirm completion and pay you.
              Nothing published will identify you.
            </p>
            <p className="mt-3 text-[0.875rem] leading-relaxed text-[var(--ink-2)]">
              Please do not type your name or other identifying details into the
              text boxes.
            </p>
          </Card>
        </div>

        <div className="mb-5 grid gap-5 sm:grid-cols-2">
          <Card>
            <CardTitle>Risks</CardTitle>
            <p className="text-[0.875rem] leading-relaxed text-[var(--ink-2)]">
              Minimal, and comparable to an everyday conversation at work. Some
              scenarios ask you to negotiate over workload, credit, or
              evaluation, which a few people find mildly uncomfortable. There is
              no benefit to you beyond the payment above.
            </p>
          </Card>

          <Card>
            <CardTitle>Taking part is voluntary</CardTitle>
            <p className="text-[0.875rem] leading-relaxed text-[var(--ink-2)]">
              You can stop at any time by closing this window, and it will not
              affect your standing on Prolific. If you do stop, please return
              your submission there so the slot is released.
            </p>
          </Card>
        </div>

        <div className="mb-5">
          <Callout title="Some details are withheld until the end" tone="warning">
            <p>
              To keep the study valid, a few specific details about its design
              are not described up front. You will get the full explanation on
              the last page, before you finish.
            </p>
          </Callout>
        </div>

        <Card className="mb-5" tone="muted">
          <CardTitle>Who is running this</CardTitle>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-[var(--ink-3)]">
                Researcher
              </dt>
              <dd className="text-[0.875rem]">
                {STUDY.irb.principalInvestigator}, {STUDY.irb.institution}
                <br />
                <a
                  href={`mailto:${STUDY.irb.researcherEmail}`}
                  className="text-[var(--accent)] underline underline-offset-2"
                >
                  {STUDY.irb.researcherEmail}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-[var(--ink-3)]">
                Your rights as a participant
              </dt>
              <dd className="text-[0.875rem]">
                {STUDY.irb.institution} Institutional Review Board
                <br />
                {STUDY.irb.contactEmail} (protocol {STUDY.irb.protocolNumber})
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardTitle>Your consent</CardTitle>
          <div className="space-y-3">
            <Checkbox checked={isAdult} onChange={setIsAdult}>
              I am at least 18 years old and currently live in the United
              States.
            </Checkbox>
            <Checkbox checked={agreed} onChange={setAgreed}>
              I have read and understood the information above. I understand
              that taking part is voluntary and that I may stop at any time. I
              agree to take part.
            </Checkbox>
          </div>
        </Card>
      </Page>

      <ActionBar
        label="Agree and begin"
        onClick={handleConsent}
        disabled={!canProceed}
        busy={busy}
        note={
          prolific.prolificPid
            ? "Prolific session detected."
            : "No Prolific ID detected — fine for previewing."
        }
      />
    </>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-[var(--ink-3)]">
        {icon}
        {label}
      </dt>
      <dd className="text-[1.0625rem] font-semibold">{value}</dd>
    </div>
  );
}

// Inline so the page has no external requests and no icon dependency.
const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function ClockIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5a3 3 0 0 0-3-1.5c-1.7 0-3 .9-3 2s1.3 2 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-3-1.5" />
    </svg>
  );
}

function RateIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 19h16" />
      <path d="M7 19v-6M12 19V7M17 19v-9" />
    </svg>
  );
}
