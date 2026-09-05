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
 * THE STUDY IS IRB-APPROVED (`STUDY.irb.approved`), so the screens state that
 * rather than showing a protocol number that is not yet filled in. The NUMBER
 * itself is still a placeholder and must be set from the approval letter
 * before recruiting — /api/preflight checks it. It is not invented in the
 * meantime: a consent form is a record, and a made-up number would misstate to
 * a participant which approval covers them.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActionBar } from "@/components/study-chrome";
import {
  Callout,
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
      "A briefing, the negotiation itself, then some questions and a decision about the other person.",
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

/**
 * Is the viewport too narrow to run the study in?
 *
 * 1024 is the breakpoint the layout itself uses: below `lg` the briefing panel
 * stops being a pinned rail and goes behind a tap (`TaskLayout`), which is the
 * point at which "read your private briefing while you negotiate" stops being
 * possible side by side. So the threshold is not a guess — it is where the
 * interface changes shape.
 *
 * A LIVE MEASUREMENT, NOT A USER-AGENT SNIFF. What matters is the viewport the
 * study will actually run in: a half-width window on a laptop has exactly the
 * same problem as a phone, and a tablet held in landscape may be fine. It
 * re-checks on resize so the warning clears the moment someone widens the
 * window, rather than stranding a reader who has already fixed it.
 *
 * Starts `false` so server and first client render agree; the effect corrects
 * it immediately. Erring that way means a desktop reader never sees a flash of
 * the red warning, while a phone reader sees it one frame late.
 */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return narrow;
}

export default function ConsentPage() {
  const router = useRouter();
  const { beginStudy, prolific } = useParticipant();
  const [agreed, setAgreed] = useState(false);
  const [isAdult, setIsAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  /**
   * Set when the deployment cannot actually run a participant.
   *
   * THE FAILURE THIS CATCHES IS SILENT. With no model key configured the
   * counterpart serves a canned "[SCAFFOLD] No model configured…" line and
   * every route still answers 200, so the study would run to a coded outcome
   * against a counterpart that never spoke — and nothing downstream would mark
   * the session as void.
   *
   * Checked HERE, before consent, because it is the only place refusing is
   * free: the participant has given nothing up yet. A per-turn check cannot
   * carry it (a 503 from the classifier is swallowed into a `none` tier, and
   * the Direct arm has no error state at all, so it would simply have the
   * counterpart apologise forever mid-negotiation).
   */
  const [unavailable, setUnavailable] = useState(false);
  const isNarrow = useIsNarrow();

  useDevAutofill(() => {
    setIsAdult(true);
    setAgreed(true);
  });

  const canProceed = useDevGate(agreed && isAdult);

  async function handleConsent() {
    if (!canProceed) return;
    setBusy(true);
    setUnavailable(false);
    try {
      // THE READINESS CHECK IS ITS OWN TRY, and the scope is the point: a
      // failure inside `beginStudy` (storage, say) is a different fault with a
      // different remedy, and answering it with "the study is not available"
      // would send a participant away from a study that is in fact running.
      //
      // The server is the only side that can see the env, so it is asked.
      // `gate=1` returns one boolean and nothing else — naming the model or
      // the environment here would tell a participant reading their network
      // tab what the other party is.
      let ready: boolean;
      try {
        const res = await fetch("/api/preflight?gate=1", { cache: "no-store" });
        ready = res.ok;
      } catch {
        // FAILING CLOSED ON A NETWORK ERROR IS THE DELIBERATE CHOICE, and it
        // is not free: a transient blip turns a willing participant away, and
        // they are paid people whose time this wastes. It is still the right
        // way round. The alternative admits them to a study that may be
        // serving placeholder text, which produces a full set of measures
        // about a counterpart that never spoke — unusable data, and no way to
        // tell those sessions from good ones afterwards. A refused
        // participant can retry in a minute; a silently void session cannot
        // be recovered at all.
        ready = false;
      }
      if (!ready) {
        setUnavailable(true);
        return;
      }
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
          eyebrow="Interactive Simulation · Workplace Study"
          title={STUDY.title}
          subtitle="An interactive study exploring how colleagues communicate priorities and reach agreement on workplace arrangements."
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
            hint={`+ up to ${STUDY.currencySymbol}${STUDY.bonusAmount} bonus`}
            tone="emerald"
          />
          <StatCard
            icon="📈"
            label="Equivalent Rate"
            value={`${STUDY.currencySymbol}${STUDY.hourlyEquivalent}/hr`}
            hint="At Prolific's fair-pay rate"
            tone="indigo"
          />
        </div>

        {/*
          DEVICE REQUIREMENT, NOT A RECOMMENDATION.
          
          It read "highly recommended" while the study is in practice not
          completable on a phone: the briefing sits behind a drawer, the
          negotiation composer and the package card compete for a 390px column,
          and a participant who starts on mobile discovers this forty minutes
          in, having already been paid for nothing. Saying so plainly on the
          first screen is cheaper for them than any layout fix, and it is the
          honest thing to put in front of a paid worker before they commit
          an hour.

          The screen-width test is a live check rather than a user-agent
          sniff — what matters is the viewport the study will actually run in,
          and a small window on a laptop has the same problem as a phone.
        */}
        <div
          className={cx(
            "mb-6 flex items-start gap-3 rounded-2xl border p-3.5 sm:p-4 text-xs sm:text-sm font-medium shadow-2xs",
            isNarrow
              ? "border-red-300 bg-red-50 text-red-950"
              : "border-amber-200 bg-amber-50/80 text-amber-950",
          )}
        >
          <span className="text-xl shrink-0">{isNarrow ? "⚠️" : "💻"}</span>
          <div className="min-w-0 flex-1 leading-relaxed">
            {isNarrow ? (
              <>
                <strong className="font-extrabold text-red-900">
                  This screen is too small for the study.{" "}
                </strong>
                <span>
                  Please open this link on a desktop or laptop — or widen this
                  window if you are on one. The study has a live chat beside a
                  private briefing you need to read while negotiating, and that
                  does not fit here. If you continue on this device you are
                  likely to be unable to finish, so we would rather you came
                  back on a larger screen.
                </span>
              </>
            ) : (
              <>
                <strong className="font-extrabold text-amber-900">
                  Desktop or laptop required:{" "}
                </strong>
                <span>
                  This study puts a live chat beside a private briefing you read
                  while negotiating. It is not usable on a phone or a small
                  tablet, so please take part on a computer.
                </span>
              </>
            )}
          </div>
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
                You will take part in <strong>two short workplace negotiation scenarios</strong>, agreeing working arrangements with another participant. In one scenario, a <strong>software tool negotiates on your behalf</strong> before you finish the conversation. Afterwards, you will answer short questions about how each went.
              </p>
            </div>
          </div>
        </Card>

        {/* Study Overview Cards */}
        <div className="mb-6">
          <SummaryGrid cols={3}>
            <KeyPoint icon="💬" title="Negotiation Tasks">
              Take part in 2 simulated workplace scenarios (~10 mins each).
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
          {/* The total is SUMMED FROM THE STEPS, never written in. A
              hardcoded figure here said "approx. 25-30 minutes" directly
              under a badge reading ~55 min, and called five steps four —
              the first thing a participant reads about how long this takes,
              contradicting itself twice. */}
          <CardTitle
            hint={`${STEPS.length} parts, about ${STEPS.reduce((n, s) => n + s.minutes, 0) + STAGE_MINUTES.consent} minutes in total:`}
          >
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
            <CardTitle hint="Recorded strictly for research analysis">
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
            <CardTitle hint="Confidential & completely anonymous">
              🛡️ How Data is Kept
            </CardTitle>
            <p className="text-xs sm:text-sm leading-relaxed text-[var(--ink-2)]">
              All responses are stored under an anonymous research ID. Your Prolific ID is used solely for compensation payout.
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
                <span className="text-slate-600 font-medium">
                  {STUDY.irb.approved
                    ? "Reviewed and approved"
                    : `Protocol #${STUDY.irb.protocolNumber}`}{" "}
                  · {STUDY.irb.contactEmail}
                </span>
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

        {unavailable ? (
          /*
           * NO TECHNICAL DETAIL, and that is deliberate on two counts. The
           * reader is a paid worker who needs to know whether to wait or to
           * return the submission — not to debug someone else's deployment —
           * and naming a model or an API key would disclose the counterpart's
           * nature to every participant who ever saw this screen, which is the
           * first item on the "must never learn mid-study" list.
           */
          <Callout tone="warning" title="The study is not available right now">
            Something on our side is not ready, so we cannot start your session.
            Please close this page and try again in a few minutes. If it still
            does not work, return your submission on Prolific — you will not be
            penalised for it, and nothing has been recorded.
          </Callout>
        ) : null}
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
