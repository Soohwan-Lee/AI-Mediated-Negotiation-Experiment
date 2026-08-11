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
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { useParticipant } from "@/lib/participant-context";
import { STUDY, nextHref } from "@/lib/study-config";
import {
  Button,
  Callout,
  Card,
  Divider,
  PageHeader,
  PageShell,
} from "@/components/ui";

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

  const canProceed = useDevGate(agreed && isAdult) && !busy;

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
    <PageShell>
      <PageHeader
        eyebrow="Research study"
        title={STUDY.title}
        subtitle="Please read the information below before deciding whether to take part."
      />

      <Card className="mb-6">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-[var(--muted)]">Duration</dt>
            <dd className="font-medium">
              About {STUDY.estimatedMinutes} minutes
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Payment</dt>
            <dd className="font-medium">${STUDY.compensationUsd}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Equivalent rate</dt>
            <dd className="font-medium">
              ${STUDY.hourlyEquivalentUsd} / hour
            </dd>
          </div>
        </dl>
      </Card>

      <div className="prose-study text-sm">
        <h2 className="mb-2 text-base font-semibold">What is this study?</h2>
        <p>
          This is a research study about workplace negotiation and how people
          communicate when software tools are involved. You will read a short
          workplace scenario, take on a role, and negotiate an agreement with
          another party. You will do this twice, using a different interface
          each time, and then answer a questionnaire about your experience.
        </p>

        <h2 className="mb-2 mt-6 text-base font-semibold">
          What will you be asked to do?
        </h2>
        <ul>
          <li>Answer a short background and demographics survey.</li>
          <li>Read instructions and complete a brief comprehension check.</li>
          <li>
            Complete two practice rounds and two negotiation sessions of about
            10 minutes each.
          </li>
          <li>Answer a questionnaire about both sessions.</li>
        </ul>

        <h2 className="mb-2 mt-6 text-base font-semibold">
          What information is collected?
        </h2>
        <ul>
          <li>Your survey responses.</li>
          <li>The negotiation messages and structured offers you submit.</li>
          <li>
            The instructions and boundaries you set for the software tool, and
            any revisions you make to them.
          </li>
          <li>
            Clicks, decisions, and timestamps recorded as you move through the
            study.
          </li>
          <li>Negotiation transcripts generated during the sessions.</li>
        </ul>
        <p>
          Your responses are stored under a pseudonymous study code. Your
          Prolific ID is stored separately from your responses and is used only
          to confirm completion and issue payment. Research outputs will not
          identify you. Please do not type your name or other identifying
          details into free-text boxes.
        </p>

        <h2 className="mb-2 mt-6 text-base font-semibold">
          Risks and benefits
        </h2>
        <p>
          Risks are minimal and comparable to everyday workplace conversation.
          Some scenarios ask you to negotiate over issues such as workload,
          credit, or evaluation, which some people may find mildly
          uncomfortable. There is no direct benefit to you beyond the payment
          described above.
        </p>

        <Callout title="Some details are withheld until the end">
          To keep the study valid, a few specific details about its design and
          purpose are not described up front. You will receive a complete
          explanation on the final page, before you finish. If anything in that
          explanation concerns you, you may withdraw your data at that point
          and still keep your payment.
        </Callout>

        <h2 className="mb-2 mt-6 text-base font-semibold">
          Your participation is voluntary
        </h2>
        <p>
          You may stop at any time by closing this window, and you may skip any
          question you prefer not to answer. Choosing to stop will not affect
          your standing on Prolific. If you stop early, please return your
          submission on Prolific so the slot can be released.
        </p>

        <h2 className="mb-2 mt-6 text-base font-semibold">Questions?</h2>
        <p>
          This study is conducted by {STUDY.irb.principalInvestigator} at{" "}
          {STUDY.irb.institution} and has been reviewed by its Institutional
          Review Board (protocol {STUDY.irb.protocolNumber}). For questions
          about the research, contact {STUDY.irb.researcherEmail}. For questions
          about your rights as a research participant, contact{" "}
          {STUDY.irb.contactEmail}.
        </p>
      </div>

      <Divider />

      <Card>
        <h2 className="mb-4 text-base font-semibold">Consent</h2>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={isAdult}
              onChange={(e) => setIsAdult(e.target.checked)}
              className="mt-1"
            />
            <span>
              I am at least 18 years old and currently reside in the United
              States.
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1"
            />
            <span>
              I have read and understood the information above. I understand
              that my participation is voluntary and that I may stop at any
              time. I agree to take part in this study.
            </span>
          </label>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-[var(--muted)]">
            {prolific.prolificPid
              ? "Prolific session detected."
              : "No Prolific ID detected — this is fine for previewing."}
          </p>
          <Button onClick={handleConsent} disabled={!canProceed}>
            {busy ? "Starting…" : "I agree — begin"}
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}
