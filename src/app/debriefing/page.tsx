"use client";

/**
 * Debriefing (Methods §9).
 *
 * Full disclosure of the deception, before the completion code is issued:
 *  - the counterpart was a researcher-controlled LLM, not another participant
 *  - the counterpart's AI Proxy was likewise part of the study protocol
 *  - the reward decision was scenario-only and changed nobody's payment
 *  - why this could not be disclosed up front
 *
 * The completion code is on the NEXT page and is issued unconditionally.
 *
 * NOTE: there is deliberately no post-debriefing data-withdrawal option here.
 * Confirm that against the approved protocol before recruitment — an IRB
 * reviewing a deception study often requires one.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionBar } from "@/components/study-chrome";
import {
  Callout,
  Card,
  CardTitle,
  Checkbox,
  Field,
  Page,
  PageHeader,
  TextArea,
} from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { STUDY, nextHref } from "@/lib/study-config";

export default function DebriefingPage() {
  usePageEnter("debriefing");
  const router = useRouter();
  const { assignment, saveResponses, logEvent } = useParticipant();
  const [acknowledged, setAcknowledged] = useState(false);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);

  const isMember = assignment?.role === "member";

  useDevAutofill(() => setAcknowledged(true));

  const canContinue = useDevGate(acknowledged);

  async function handleFinish() {
    if (!canContinue) return;
    setBusy(true);
    try {
      await saveResponses("debriefing", { acknowledged, comments });
      logEvent("debriefing_acknowledged");
      router.push(nextHref("debriefing"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Page>
        <PageHeader
          eyebrow="Final Step · Research Debriefing"
          title="Full Research Disclosure & Debriefing"
          subtitle="Thank you for taking part. Now that you have finished, here is the full explanation of the study design."
        />

        <div className="mb-6">
          <Callout title="⚠️ Important: Please Read Carefully" tone="warning">
            <p className="text-xs sm:text-sm leading-relaxed text-amber-950">
              Some elements of this study were not disclosed in full detail prior to the tasks in order to investigate genuine interpersonal dynamics. This methodology was approved by our Institutional Review Board. Everything is explained below.
            </p>
          </Callout>
        </div>

        <div className="space-y-3.5 mb-8">
          <Card className="border-slate-200 bg-white">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl">🤖</span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                1. The Counterpart was a Standardized AI Agent
              </h2>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-700">
              There was no other live human participant. Counterpart responses and offers followed a fixed research protocol, ensuring a completely consistent and fair comparison across all conditions.
            </p>
          </Card>

          <Card className="border-slate-200 bg-white">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl">💵</span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                {isMember
                  ? "2. No Bonus Decision Was Made About You (Full Pay Guaranteed)"
                  : "2. Reward Decisions Were Scenario-Only (Full Pay Guaranteed)"}
              </h2>
            </div>
            {/* The Member's half of this is the disclosure that closes deception
                item 4, and it has to RETRACT, not reassure. They waited twice in
                front of a screen reading "The Project Leader is evaluating your
                performance bonus…", and that screen implies a decision was made
                about them. Saying only that no penalty occurred leaves the
                implication standing — it reads as "a decision happened and it
                went fine". Saying plainly that no such decision was ever made is
                the whole disclosure. There is no number to explain away, which
                is exactly why the sentence has to do the work instead. */}
            <p className="text-xs sm:text-sm leading-relaxed text-slate-700">
              {isMember ? (
                <>
                  After each task you wrote an upward evaluation of the manager and then
                  waited while they decided a bonus for you.{" "}
                  <strong className="text-slate-900">
                    No such decision was ever made about you, by anyone — there was no
                    other participant to make one — and your evaluation was not passed
                    to any director
                  </strong>
                  ; there is none. Both were recorded only as research data. Nothing you
                  did in either task affected your payment. Every participant is paid the
                  same {STUDY.currencySymbol}{STUDY.totalPaid} in full — the{" "}
                  {STUDY.currencySymbol}{STUDY.compensation} base and the{" "}
                  {STUDY.currencySymbol}{STUDY.bonusAmount} bonus together — whatever
                  happened in either negotiation.
                </>
              ) : (
                <>
                  After each task you decided the other side&apos;s bonus, and were told
                  they wrote an upward evaluation of you. Because there was no other
                  participant,{" "}
                  <strong className="text-slate-900">
                    no one received or lost money as a result of your decision, and no
                    evaluation of you was ever written or forwarded
                  </strong>{" "}
                  — your choices were recorded as research data about how authority is
                  used. Every participant, in either role, is paid the same{" "}
                  {STUDY.currencySymbol}{STUDY.totalPaid} in full — the{" "}
                  {STUDY.currencySymbol}{STUDY.compensation} base and the{" "}
                  {STUDY.currencySymbol}{STUDY.bonusAmount} bonus together.
                </>
              )}
            </p>
          </Card>

          <Card className="border-slate-200 bg-white">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl">🔀</span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                3. Purpose: Direct vs. AI-Mediated Delegation
              </h2>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-700">
              We study how delegating to an AI Proxy (under <em>User-Specified</em> vs. <em>AI-Supplemented</em> policies) helps people overcome social hesitation when advocating for sensitive workplace priorities.
            </p>
          </Card>

          <Card className="border-slate-200 bg-white">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl">❓</span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                4. Why Prior Disclosure Was Withheld
              </h2>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-700">
              Studying natural self-advocacy requires participants to believe messages are read by a peer. Knowing the partner was automated in advance would have changed natural negotiation behavior.
            </p>
          </Card>

          <Card className="border-slate-200 bg-slate-50/70">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl">💬</span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Research Contacts
              </h2>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
              Questions? Contact <span className="font-semibold text-slate-800">{STUDY.irb.researcherEmail}</span> or {STUDY.irb.institution} IRB at <span className="font-semibold text-slate-800">{STUDY.irb.contactEmail}</span> (Protocol #{STUDY.irb.protocolNumber}).
            </p>
          </Card>
        </div>

        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardTitle hint="Please confirm before generating your completion code:">
            Acknowledgement & Feedback
          </CardTitle>

          <div className="mt-3">
            <Checkbox checked={acknowledged} onChange={setAcknowledged}>
              <span className="font-bold text-slate-900">
                I have read and understood this debriefing explanation.
              </span>
            </Checkbox>
          </div>

          <div className="mt-5">
            <Field label="Optional: Any feedback or comments for the research team?">
              <TextArea
                value={comments}
                onChange={setComments}
                rows={3}
                placeholder="Share any thoughts about your experience (optional)…"
              />
            </Field>
          </div>
        </Card>
      </Page>

      <ActionBar
        label="Acknowledge & Get Prolific Completion Code"
        onClick={handleFinish}
        disabled={!canContinue}
        busy={busy}
        note={
          acknowledged ? "✓ Ready for completion code" : "⚠️ Please check the acknowledgement box above."
        }
      />
    </>
  );
}
