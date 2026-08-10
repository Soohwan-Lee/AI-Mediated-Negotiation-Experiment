"use client";

/**
 * Post-task questionnaire (Methods §6, Appendix A9-A16).
 *
 * Structure:
 *  1. Condition-indexed blocks: the same common items asked once per session,
 *     labelled "Session 1"/"Session 2" — never by condition name.
 *  2. Proxy-only block, shown only for the session that used an assistant.
 *  3. Comparison + open-ended items.
 *  4. Suspicion probe LAST, before any disclosure (Methods §A17).
 *
 * This is the full candidate bank from Appendix A. Per Methods §Measurement
 * principles the battery is reduced after pilot — trim here, not in analysis.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { isProxyCondition, sessionPlan } from "@/lib/assignment";
import { nextHref, stepNumber } from "@/lib/study-config";
import {
  Button,
  Card,
  Field,
  Likert,
  PageHeader,
  PageShell,
  ProgressBar,
  RadioGroup,
  TextArea,
} from "@/components/ui";
import type { SurveyResponses } from "@/lib/types";

/** Asked once per session. */
const COMMON_ITEMS = [
  { id: "SAFE1", text: "I could keep a difficult-to-raise requirement in consideration without having to defend every possible proposal as my settled position." },
  { id: "SAFE2_R", text: "I felt that I had to censor an important requirement because of how the counterpart might react." },
  { id: "EXP1", text: "I worried that the counterpart would evaluate me negatively because of the requirements raised in the negotiation." },
  { id: "EXP2", text: "The negotiation made my personally sensitive priorities feel exposed to the counterpart." },
  { id: "DIAG1", text: "The proposals made on my behalf revealed my actual priorities to the counterpart." },
  { id: "DIAG2", text: "The counterpart could infer which requirements were genuinely important to me." },
  { id: "DIAG3", text: "Each proposal made on my behalf was likely to be interpreted as my settled position." },
  { id: "REP1", text: "The requirements that mattered to me were adequately represented in the negotiation." },
  { id: "OWN1", text: "The final negotiating position still felt like mine." },
  { id: "PROC1", text: "Overall, I was satisfied with the negotiation process." },
  { id: "PROC2", text: "The process was fair and gave meaningful consideration to my requirements." },
  { id: "PROC3", text: "I developed a clear understanding of the counterpart's priorities and constraints." },
  { id: "OUT1", text: "I am satisfied with the tentative or final outcome." },
  { id: "OUT2", text: "I would be willing to accept and implement this agreement in a real situation." },
  { id: "WORK2", text: "I felt frustrated or stressed during the negotiation." },
  { id: "CRED1", text: "The requirements presented by the counterpart seemed accurate." },
  { id: "CRED2", text: "The requirements presented by the counterpart seemed authentic." },
  { id: "CRED3", text: "The requirements presented by the counterpart seemed believable." },
  { id: "SER1", text: "I treated the counterpart's requirements as matters that were genuinely important to them." },
  { id: "ACC1", text: "I was willing to accommodate the counterpart's important requirements when a workable trade was available." },
  { id: "NEG1", text: "The requirements raised in the negotiation made me evaluate the counterpart more negatively." },
];

/** Asked only for the session that used an assistant. */
const PROXY_ITEMS = [
  { id: "PROXY1", text: "My assistant accurately represented my requirements and priorities." },
  { id: "PROXY2", text: "My assistant stayed within the authority and limits I gave it." },
  { id: "PROXY3", text: "Given my instructions, I could understand why my assistant made its proposals and concessions." },
  { id: "PROXY4", text: "I trusted my assistant's negotiation decisions." },
  { id: "PROXY5", text: "The instruction settings and final review gave me an appropriate level of control." },
  { id: "PROXY6", text: "I worried that my assistant's actions could harm how the counterpart viewed me." },
  { id: "COVER1", text: "The assistant could test possible options without making each one my settled position." },
  { id: "COVER2", text: "The counterpart could not be certain which proposals reflected my own priorities and which were explored by the assistant." },
  { id: "COVER3", text: "This uncertainty made it easier to keep difficult requirements in consideration." },
  { id: "COVER4_R", text: "Even with the assistant, I felt that every proposal would be taken as a direct reflection of what I personally wanted." },
  { id: "UTIL1", text: "Having access to the assistant helped me negotiate more effectively." },
  { id: "UTIL2", text: "The assistant considered options I would not have thought of on my own." },
  { id: "UTIL3", text: "The assistant reduced the mental workload of negotiating." },
  { id: "UTIL4", text: "I would use an assistant like this in a real workplace negotiation if I could set its boundaries." },
  { id: "RAT1", text: "The conversation changed what I genuinely believed was the best agreement." },
  { id: "RAT2", text: "I accepted parts of the tentative agreement even though they differed from what I personally preferred." },
  { id: "RAT3", text: "The fact that both assistants converged made me feel that I should accept the tentative agreement." },
  { id: "RAT4", text: "Because the agreement was reached by two assistants, it seemed more objective or neutral." },
  { id: "RAT5", text: "I would have made the same final decision even if I had not seen that the two assistants agreed." },
  { id: "RAT6", text: "I accepted the tentative agreement partly because reopening the negotiation seemed burdensome." },
];

export default function SurveyPage() {
  usePageEnter("survey");
  const router = useRouter();
  const { assignment, saveResponses, logEvent } = useParticipant();
  const [r, setR] = useState<SurveyResponses>({});
  const [busy, setBusy] = useState(false);

  const set = (id: string, v: string | number) =>
    setR((prev) => ({ ...prev, [id]: v }));
  const num = (id: string) => (r[id] as number) ?? null;
  const str = (id: string) => (r[id] as string) ?? "";

  /** Which session used an assistant — used to place the proxy-only block. */
  const proxySessionIndex = useMemo(() => {
    if (!assignment) return null;
    return isProxyCondition(sessionPlan(assignment, 1).condition) ? 1 : 2;
  }, [assignment]);

  const requiredIds = useMemo(() => {
    const ids: string[] = [];
    for (const s of [1, 2]) {
      ids.push(...COMMON_ITEMS.map((i) => `${i.id}_s${s}`));
    }
    if (proxySessionIndex) {
      ids.push(...PROXY_ITEMS.map((i) => `${i.id}_s${proxySessionIndex}`));
    }
    return ids;
  }, [proxySessionIndex]);

  const complete =
    requiredIds.every((id) => num(id) !== null) &&
    Boolean(str("preferred_session")) &&
    Boolean(str("SUS1"));

  async function handleNext() {
    setBusy(true);
    try {
      await saveResponses("survey", r);
      logEvent("page_complete", undefined, { page: "survey" });
      router.push(nextHref("survey"));
    } finally {
      setBusy(false);
    }
  }

  const { step, total } = stepNumber("survey");

  return (
    <PageShell>
      <ProgressBar step={step} total={total} label="Questionnaire" />
      <PageHeader
        title="Your experience"
        subtitle="Please answer for each session separately. 1 = Strongly disagree, 7 = Strongly agree."
      />

      {[1, 2].map((s) => (
        <div key={s}>
          <Card className="mb-6">
            <h2 className="mb-1 text-base font-semibold">
              Session {s}
              {proxySessionIndex === s ? " (with an assistant)" : ""}
            </h2>
            <p className="mb-2 text-xs text-[var(--muted)]">
              Thinking back to session {s}:
            </p>
            {COMMON_ITEMS.map((item) => (
              <Likert
                key={`${item.id}_s${s}`}
                id={`${item.id}_s${s}`}
                statement={item.text}
                value={num(`${item.id}_s${s}`)}
                onChange={(v) => set(`${item.id}_s${s}`, v)}
              />
            ))}
            <Likert
              id={`WORK1_s${s}`}
              statement="Thinking about both the difficulty of the negotiation and your own effort, how mentally intensive was this experience?"
              value={num(`WORK1_s${s}`)}
              onChange={(v) => set(`WORK1_s${s}`, v)}
              lowAnchor="Least intensive"
              highAnchor="Most intensive"
            />
          </Card>

          {proxySessionIndex === s ? (
            <Card className="mb-6">
              <h2 className="mb-1 text-base font-semibold">
                Session {s} — about your assistant
              </h2>
              <p className="mb-2 text-xs text-[var(--muted)]">
                These questions are about the session where an assistant
                negotiated for you.
              </p>
              {PROXY_ITEMS.map((item) => (
                <Likert
                  key={`${item.id}_s${s}`}
                  id={`${item.id}_s${s}`}
                  statement={item.text}
                  value={num(`${item.id}_s${s}`)}
                  onChange={(v) => set(`${item.id}_s${s}`, v)}
                />
              ))}
            </Card>
          ) : null}
        </div>
      ))}

      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold">Comparing the two</h2>
        <Field label="Which session did you prefer overall?" required>
          <RadioGroup
            name="preferred_session"
            value={str("preferred_session")}
            onChange={(v) => set("preferred_session", v)}
            options={[
              { value: "s1", label: "Session 1" },
              { value: "s2", label: "Session 2" },
              { value: "no_preference", label: "No preference" },
            ]}
          />
        </Field>
        <Field label="Why?">
          <TextArea
            value={str("preference_reason")}
            onChange={(v) => set("preference_reason", v)}
            placeholder="1–3 sentences."
          />
        </Field>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold">In your own words</h2>
        <Field label="What most influenced whether you protected, traded, or gave up an important requirement? How, if at all, did your role and authority relationship matter?">
          <TextArea
            value={str("open_requirement_power")}
            onChange={(v) => set("open_requirement_power", v)}
            placeholder="1–3 sentences."
          />
        </Field>
        <Field label="Why did you accept, ask to revise, or reject the agreement? Did it matter to you that both sides had converged?">
          <TextArea
            value={str("open_final_decision")}
            onChange={(v) => set("open_final_decision", v)}
            placeholder="1–3 sentences."
          />
        </Field>
        <Field label="Was there any requirement you did not raise, delayed raising, or softened because of how the counterpart might evaluate you?">
          <TextArea
            value={str("open_withheld")}
            onChange={(v) => set("open_withheld", v)}
            placeholder="1–3 sentences."
          />
        </Field>
        <Field label="What did you choose to entrust to your assistant, and what did you keep outside its authority? Describe any moment when it represented you especially well or poorly.">
          <TextArea
            value={str("open_proxy_branch")}
            onChange={(v) => set("open_proxy_branch", v)}
            placeholder="1–3 sentences."
          />
        </Field>
      </Card>

      {/* Suspicion probe last, before any disclosure (Methods §A17). */}
      <Card className="mb-8">
        <h2 className="mb-4 text-base font-semibold">Two final questions</h2>
        <Field
          label="Who or what do you believe generated the counterpart's negotiation behavior?"
          required
        >
          <RadioGroup
            name="SUS1"
            value={str("SUS1")}
            onChange={(v) => set("SUS1", v)}
            options={[
              { value: "another_person", label: "Another person taking part in the study" },
              { value: "software", label: "A software system" },
              { value: "mixed", label: "Some combination of the two" },
              { value: "not_sure", label: "I am not sure" },
            ]}
          />
        </Field>
        <Field label="What do you think this study was trying to test?">
          <TextArea
            value={str("SUS2")}
            onChange={(v) => set("SUS2", v)}
            placeholder="Your best guess."
          />
        </Field>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">
          {complete ? "All required items answered." : "Please answer all rating items."}
        </p>
        <Button onClick={handleNext} disabled={!complete || busy}>
          {busy ? "Saving…" : "Continue"}
        </Button>
      </div>
    </PageShell>
  );
}
