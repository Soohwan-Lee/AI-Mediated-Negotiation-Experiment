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
import { useRef, useState } from "react";
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
import { getStore } from "@/lib/store";
import { STUDY, nextHref } from "@/lib/study-config";
import {
  readDebriefDraft,
  writeDebriefDraft,
} from "@/lib/debrief-draft";

export default function DebriefingPage() {
  usePageEnter("debriefing");
  const router = useRouter();
  const { assignment, participantKey, saveResponses, logEvent } = useParticipant();
  const [acknowledged, setAcknowledged] = useState(false);
  const [comments, setComments] = useState(() =>
    participantKey ? readDebriefDraft(participantKey) : "",
  );
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const submitting = useRef(false);

  const isMember = assignment?.role === "member";

  useDevAutofill(() => setAcknowledged(true));

  const canContinue = useDevGate(acknowledged);

  async function handleFinish() {
    if (!canContinue || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setSaveFailed(false);
    try {
      await saveResponses("debriefing", { acknowledged, comments });
      if (!(await getStore().confirmSaved())) {
        setSaveFailed(true);
        return;
      }
      logEvent("debriefing_acknowledged");
      router.push(nextHref("debriefing"));
    } catch {
      setSaveFailed(true);
    } finally {
      submitting.current = false;
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
              Some elements of this study were not disclosed in full detail prior to the tasks in order to investigate genuine interpersonal dynamics. Our Institutional Review Board reviewed this study and determined it exempt. Everything is explained below.
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
                  ? "2. No Bonus Recommendation Was Made About You (Full Pay Guaranteed)"
                  : "2. Bonus Recommendations Were Scenario-Only (Full Pay Guaranteed)"}
              </h2>
            </div>
            {/* Retract the scenario claim explicitly: no counterpart recommendation
                or upward evaluation existed, and neither affected actual payment. */}
            <p className="text-xs sm:text-sm leading-relaxed text-slate-700">
              {isMember ? (
                <>
                  You were told the Leader would recommend a bonus for you after each
                  task.{" "}
                  <strong className="text-slate-900">
                    No such recommendation was ever made about you, by anyone — there was no
                    other participant to make one. Your upward evaluation was not sent
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
                  After each task you recommended the other side&apos;s bonus, and were told
                  they wrote an upward evaluation of you. Because there was no other
                  participant,{" "}
                  <strong className="text-slate-900">
                    no one received or lost money as a result of your recommendation, and no
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
              Some workplace requests are hard to justify without saying
              something that reflects badly on you. This study asks what
              changes when an AI Proxy makes that case on your behalf instead
              of you making it yourself — whether people are more willing to
              have a sensitive reason used, and how the AI&rsquo;s participation
              in constructing reasons changes reputation concerns and judgments
              of responsibility. Participants were assigned either a Proxy that
              used only the included reasons, or one that used the same included
              reasons and added two work arguments without labeling individual
              sentences by source. Each
              participant was informed of the assigned policy, which both
              Proxies in that session used.
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
              Questions about the study or your participation? Contact principal investigator {STUDY.irb.principalInvestigator} at <span className="font-semibold text-slate-800">{STUDY.irb.researcherEmail}</span>. {STUDY.irb.institution} IRB determined this study exempt (#{STUDY.irb.exemptionNumber}).
            </p>
          </Card>
        </div>

        <fieldset disabled={busy}>
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardTitle hint="Please confirm before generating your completion code:">
            Acknowledgement & Feedback
          </CardTitle>

          <div className="mt-3">
            <Checkbox checked={acknowledged} onChange={(value) => { if (!submitting.current) setAcknowledged(value); }}>
              <span className="font-bold text-slate-900">
                I have read and understood this debriefing explanation.
              </span>
            </Checkbox>
          </div>

          <div className="mt-5">
            <Field label="Optional: Any feedback or comments for the research team?">
              <TextArea
                value={comments}
                onChange={(value) => {
                  if (submitting.current) return;
                  setComments(value);
                  if (participantKey) writeDebriefDraft(participantKey, value);
                }}
                rows={3}
                placeholder="Share any thoughts about your experience (optional)…"
              />
            </Field>
          </div>
        </Card>
        </fieldset>
        {saveFailed ? <div className="mt-5" role="alert"><Callout tone="warning"><p>We couldn&apos;t save yet. Your answers are still here. Please retry.</p></Callout></div> : null}
      </Page>

      <ActionBar
        label={saveFailed ? "Retry saving" : "Acknowledge & Get Prolific Completion Code"}
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
