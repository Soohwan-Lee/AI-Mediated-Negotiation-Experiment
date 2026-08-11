"use client";

/**
 * Debriefing (Methods §9).
 *
 * Full disclosure of the deception, before the completion code is issued:
 *  - the counterpart was a researcher-controlled LLM, not another participant
 *  - the counterpart's assistant was likewise part of the study protocol
 *  - the reward decision was scenario-only and changed nobody's payment
 *  - why this could not be disclosed up front
 *
 * Also offers data withdrawal, which must not cost the participant their
 * payment. The completion code is on the NEXT page and is issued regardless of
 * the withdrawal choice.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { STUDY, nextHref, stepNumber } from "@/lib/study-config";
import {
  Button,
  Callout,
  Card,
  Divider,
  PageHeader,
  PageShell,
  ProgressBar,
  TextArea,
} from "@/components/ui";

export default function DebriefingPage() {
  usePageEnter("debriefing");
  const router = useRouter();
  const { assignment, saveResponses, logEvent } = useParticipant();
  const [acknowledged, setAcknowledged] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);

  const isMember = assignment?.role === "member";

  useDevAutofill(() => setAcknowledged(true));

  const canContinue = useDevGate(acknowledged);

  async function handleFinish() {
    setBusy(true);
    try {
      await saveResponses("debriefing", {
        acknowledged,
        withdrawRequested: withdraw,
        comments,
      });
      logEvent("debriefing_acknowledged", { withdrawRequested: withdraw });
      router.push(nextHref("debriefing"));
    } finally {
      setBusy(false);
    }
  }

  const { step, total } = stepNumber("debriefing");

  return (
    <PageShell>
      <ProgressBar step={step} total={total} label="Debriefing" />
      <PageHeader
        title="What this study was really about"
        subtitle="Thank you for taking part. Now that you have finished, here is the full picture."
      />

      <Callout title="Please read this carefully" tone="warning">
        Some parts of this study were not described accurately at the start.
        This was necessary for the research question, and it was reviewed and
        approved by our Institutional Review Board. Everything is explained
        below.
      </Callout>

      <div className="prose-study mt-6 text-sm">
        <h2 className="mb-2 text-base font-semibold">
          The other party was not another participant
        </h2>
        <p>
          You were told that you were negotiating with another person taking
          part in the study. In fact, <strong>there was no other
          participant</strong>. The counterpart&apos;s messages were generated
          by a researcher-controlled AI system following a fixed script of
          priorities and concession rules, identical for everyone.
        </p>
        <p>
          In the session where assistants negotiated, the
          &ldquo;counterpart&apos;s assistant&rdquo; was likewise part of the
          study system, not a tool belonging to a real person.
        </p>

        <h2 className="mb-2 mt-6 text-base font-semibold">
          The reward decision was part of the scenario only
        </h2>
        {isMember ? (
          <p>
            You were shown a reward decision presented as the Project
            Leader&apos;s judgment of your contribution.{" "}
            <strong>
              That decision was not made by any person, and it did not depend on
              anything you did.
            </strong>{" "}
            Every participant in your role saw the same standardized number. It
            has no effect whatsoever on your payment — you will receive the full
            amount advertised on Prolific, exactly as described in the consent
            form.
          </p>
        ) : (
          <p>
            You were asked to make a reward decision regarding the other party.
            Because there was no other participant,{" "}
            <strong>your decision did not affect anyone&apos;s payment.</strong>{" "}
            It was recorded only as data about how people use authority in this
            kind of scenario. Your own payment is unaffected: you will receive
            the full amount advertised on Prolific.
          </p>
        )}

        <h2 className="mb-2 mt-6 text-base font-semibold">
          Why we could not tell you in advance
        </h2>
        <p>
          This study examines how people raise requirements that are legitimate
          but socially awkward to state, and whether having an AI assistant
          negotiate on their behalf changes that. That depends on you genuinely
          expecting a real person to read what was said and form an impression
          of you. If you had known the counterpart was a system, that
          expectation would disappear and the behavior we study would not
          occur.
        </p>
        <p>
          Using a controlled counterpart also means every participant faced the
          same negotiating partner, so differences between people reflect the
          study conditions rather than who they happened to be paired with.
        </p>

        <h2 className="mb-2 mt-6 text-base font-semibold">
          If any of this troubles you
        </h2>
        <p>
          Some people find it uncomfortable to learn that an interaction was
          simulated, or to reflect on a reward decision that felt real at the
          time. That reaction is understandable. If you feel any distress about
          your participation, please contact the research team at{" "}
          {STUDY.irb.researcherEmail}. You may also contact{" "}
          {STUDY.irb.institution}&apos;s Institutional Review Board at{" "}
          {STUDY.irb.contactEmail} (protocol {STUDY.irb.protocolNumber}) with
          questions about your rights as a research participant.
        </p>
        <p>
          We ask that you not share these details with other Prolific workers,
          since the study depends on participants not knowing them in advance.
        </p>
      </div>

      <Divider />

      <Card>
        <h2 className="mb-4 text-base font-semibold">Your choices</h2>

        <label className="mb-4 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1"
          />
          <span>I have read and understood this explanation.</span>
        </label>

        <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] p-3 text-sm">
          <input
            type="checkbox"
            checked={withdraw}
            onChange={(e) => setWithdraw(e.target.checked)}
            className="mt-1"
          />
          <span>
            Now that I know the full details, I would like my data withdrawn
            from the study.{" "}
            <span className="text-[var(--muted)]">
              You will still receive your full payment, and you will still get
              your completion code on the next page.
            </span>
          </span>
        </label>

        <div className="mb-2">
          <label className="mb-2 block text-sm font-medium">
            Any comments or questions for the research team?
          </label>
          <TextArea
            value={comments}
            onChange={setComments}
            rows={3}
            placeholder="Optional."
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleFinish} disabled={!canContinue || busy}>
            {busy ? "Saving…" : "Continue"}
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}
