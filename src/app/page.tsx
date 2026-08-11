"use client";

/**
 * Welcome + informed consent.
 *
 * IRB NOTE: this study uses deception — the counterpart is a controlled LLM
 * presented as another participant, and the reward decision is scenario-level
 * only. Neither is disclosed here; both are disclosed in full at
 * /debriefing (Methods §Debriefing and Completion). The consent text below is
 * written to be truthful about everything else: what is collected, that
 * withdrawal is free, and that some details are withheld until the end.
 *
 * The IRB text is PLACEHOLDER and must be replaced with the approved protocol
 * language before recruitment.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionBar } from "@/components/study-chrome";
import {
  Callout,
  Card,
  Checkbox,
  Page,
  PageHeader,
} from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { useParticipant } from "@/lib/participant-context";
import { STUDY, nextHref } from "@/lib/study-config";

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
          subtitle="Please read this before deciding whether to take part."
        />

        <Card className="mb-6" tone="muted">
          <dl className="grid grid-cols-3 gap-4">
            <Fact label="Takes about" value={`${STUDY.estimatedMinutes} min`} />
            <Fact label="You are paid" value={`$${STUDY.compensationUsd}`} />
            <Fact label="Equivalent to" value={`$${STUDY.hourlyEquivalentUsd}/hr`} />
          </dl>
        </Card>

        <div className="prose-study mb-6">
          <h2>What is this study?</h2>
          <p>
            This is a study about workplace negotiation and how people
            communicate when software tools are involved. You will read a short
            workplace scenario, take on a role, and negotiate an agreement with
            another party. You will do this twice, using a different interface
            each time, and then answer questions about your experience.
          </p>

          <h2>What will you be asked to do?</h2>
          <ul>
            <li>Answer a short background survey.</li>
            <li>Read instructions and answer a few questions about them.</li>
            <li>
              Do two practice rounds and two negotiations of about ten minutes
              each.
            </li>
            <li>Answer a questionnaire about both sessions.</li>
          </ul>

          <h2>What is recorded?</h2>
          <ul>
            <li>Your survey answers.</li>
            <li>The messages and offers you send.</li>
            <li>
              The instructions and limits you set for the software tool, and any
              changes you make to them.
            </li>
            <li>Clicks, decisions, and timestamps as you move through.</li>
            <li>The negotiation transcripts.</li>
          </ul>
          <p>
            Your answers are stored under a study code. Your Prolific ID is kept
            separately and used only to confirm completion and pay you. Nothing
            published will identify you. Please do not type your name or other
            identifying details into the text boxes.
          </p>

          <h2>Risks and benefits</h2>
          <p>
            Risks are minimal and comparable to an everyday conversation at
            work. Some scenarios ask you to negotiate over workload, credit, or
            evaluation, which a few people find mildly uncomfortable. There is
            no benefit to you beyond the payment above.
          </p>
        </div>

        <div className="mb-6">
          <Callout title="Some details are withheld until the end" tone="warning">
            <p>
              To keep the study valid, a few specific details about its design
              are not described up front. You will get the full explanation on
              the last page, before you finish. If it concerns you at that
              point, you can withdraw your data and still keep your payment.
            </p>
          </Callout>
        </div>

        <div className="prose-study mb-8">
          <h2>Taking part is voluntary</h2>
          <p>
            You can stop at any time by closing this window, and you can skip
            any question you would rather not answer. Stopping will not affect
            your standing on Prolific. If you do stop, please return your
            submission there so the slot is released.
          </p>

          <h2>Questions</h2>
          <p>
            This study is run by {STUDY.irb.principalInvestigator} at{" "}
            {STUDY.irb.institution} and reviewed by its Institutional Review
            Board (protocol {STUDY.irb.protocolNumber}). About the research,
            contact {STUDY.irb.researcherEmail}. About your rights as a
            participant, contact {STUDY.irb.contactEmail}.
          </p>
        </div>

        <Card>
          <h2 className="mb-4 text-[0.95rem] font-semibold">Your consent</h2>
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-[var(--ink-3)]">
        {label}
      </dt>
      <dd className="mt-1 text-[1.0625rem] font-semibold">{value}</dd>
    </div>
  );
}
