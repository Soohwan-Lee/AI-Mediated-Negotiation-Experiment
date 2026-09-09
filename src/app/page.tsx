"use client";

/**
 * Welcome + informed consent. Everything a participant agrees to is presented
 * on this route before the consent action becomes available.
 *
 * The information is divided into three short reading pages. This keeps the
 * obligations legible without collecting consent early: `beginStudy` is only
 * reachable from the final page, after overview and privacy/rights.
 *
 * IRB NOTE: this study uses deception — the counterpart is a controlled LLM
 * presented as another participant, and the reward decision is scenario-level
 * only. Neither is disclosed here; both are disclosed in full at /debriefing
 * (Methods §Debriefing and Completion). The text below is truthful about
 * everything else: what is collected, that stopping is free, and that some
 * details are withheld until the end.
 *
 * UNIST IRB DETERMINED THE STUDY EXEMPT. An exemption is not an approval, so
 * the participant-facing copy says exactly that and shows the exemption number
 * supplied by the IRB. /api/preflight checks that the number is not a
 * placeholder before recruiting.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  PreviousReading,
  ReadingProgress,
} from "@/components/briefing-guide";
import { NavigationNotice } from "@/components/navigation-notice";
import { ActionBar } from "@/components/study-chrome";
import {
  Callout,
  Card,
  CardTitle,
  Checkbox,
  Page,
  PageHeader,
  cx,
} from "@/components/ui";
import { useDevAutofill, useDevGate } from "@/lib/dev-mode";
import {
  CONSENT_INFORMATION_PAGES,
  canBeginConsent,
} from "@/lib/consent-flow";
import { useParticipant } from "@/lib/participant-context";
import { STAGE_MINUTES, STUDY, nextHref } from "@/lib/study-config";

/**
 * "£6" rather than "£6.00" for the headline tile only.
 *
 * The stored strings keep their pence because they are money and the tests
 * compare them numerically; a 40-point display number reads better without
 * two zeros that never change. Anywhere the amount sits inside a sentence it
 * keeps its pence, because there it is a figure being quoted rather than a
 * headline.
 */
function trimPence(amount: string): string {
  return amount.replace(/\.00$/, "");
}

const BASE_HOURLY_RATE = (
  (Number(STUDY.compensation) / STUDY.estimatedMinutes) * 60
).toFixed(2);

/**
 * Every stage the participant sits through, with its minutes.
 *
 * DERIVED FROM `STAGE_MINUTES` so the promised times cannot drift from the
 * flow, and COMPLETE so the rows add up to what the stat card above them
 * says. The list used to start at the background questions and stop at the
 * final ones, leaving out this consent page and the debriefing — four
 * minutes of real reading — so the visible rows summed to 37 against a
 * 41-minute budget. A participant who adds the column and gets a smaller
 * number than the headline has been given two different answers to the same
 * question on one screen, and the smaller one is the one that underpays
 * whoever is slower than the estimate.
 *
 * `stepMinutesTotal` below is asserted against `TOTAL_MINUTES` in
 * tests/study-config.test.mjs, so a stage added to the flow without a row
 * here fails rather than quietly shrinking the column.
 */
const STEPS = [
  {
    // The page they are reading. It is not padding: consent is the one stage
    // whose whole purpose is to be read before deciding.
    title: "Read this and decide",
    detail: "What the study involves, what is recorded, and your rights.",
    minutes: STAGE_MINUTES.consent,
  },
  {
    title: "A few questions about you",
    detail: "Background and experience. No right answers.",
    minutes: STAGE_MINUTES.background,
  },
  {
    title: "Instructions, and a short check",
    detail: "Learn your role and the rules, then complete a quick check.",
    minutes: STAGE_MINUTES.instruction,
  },
  {
    // Both rounds on one row. They are the same scenario and carry the same
    // promise that nothing counts, and giving the second its own row would put
    // a step between the two tasks that reads as a third task.
    title: "Two short practice rounds",
    detail: "One before each task, on a scenario that does not count.",
    minutes: STAGE_MINUTES.practice + STAGE_MINUTES.practice2,
  },
  {
    title: "Two negotiation tasks",
    detail:
      "Negotiate directly once and use an AI Proxy once. Questions follow each task.",
    minutes:
      2 * (STAGE_MINUTES.task + STAGE_MINUTES.taskSurvey + STAGE_MINUTES.reward) +
      STAGE_MINUTES.proxyObservation,
  },
  {
    title: "Final questions",
    // The explanation moved to its own row below, so this no longer promises
    // it as part of the same three minutes.
    detail: "A few about the study as a whole.",
    minutes: STAGE_MINUTES.wrapUp,
  },
  {
    title: "The full explanation",
    detail: "What the study was about, and confirming your data may be used.",
    minutes: STAGE_MINUTES.debrief,
  },
];

/**
 * What the rows add up to. Exported for the test that pins it against
 * `TOTAL_MINUTES`; the stat card advertises `STUDY.estimatedMinutes`, which
 * may round this DOWN by at most a minute (`timingIsHonest`).
 */
export const stepMinutesTotal = STEPS.reduce((sum, s) => sum + s.minutes, 0);

const RECORDED = [
  "Your survey answers",
  "Messages, offers, and negotiation transcripts",
  "The goals and sharing choices you give your AI Proxy",
  "Clicks, decisions, and timestamps",
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
  const [infoPage, setInfoPage] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
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
    setIsEligible(true);
    setAgreed(true);
  });

  const canProceed = useDevGate(agreed && isEligible);

  function moveInfo(next: number) {
    setInfoPage(next);
    window.scrollTo({ top: 0 });
  }

  async function handleConsent() {
    // Consent can only be collected after both information pages have been
    // shown. The ActionBar already enforces this in the UI; keep the same
    // boundary here so a later refactor cannot wire this handler to an early
    // page and begin a session prematurely.
    if (!canBeginConsent(infoPage, canProceed)) return;
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
      try {
        await beginStudy();
      } catch {
        // The slot claim is the server's now, so it can fail the way any
        // request can — and a participant with no assignment has no study to
        // enter. Same plain wording as the readiness refusal above: nothing
        // technical, because the screen is read by participants.
        setUnavailable(true);
        return;
      }
      router.push(nextHref("welcome"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Page>
        <ReadingProgress labels={CONSENT_INFORMATION_PAGES} current={infoPage} ariaLabel="Consent information" />

        {infoPage === 0 ? (
          <>
            <PageHeader
              eyebrow="Welcome · Information 1 of 3"
              title={STUDY.title}
              subtitle="Before you decide, see what you will do, how long it takes, and how payment works."
            />

            {/*
              THE DESKTOP NOTICE COMES FIRST, above the payment tiles.
              A participant who reads the pay and the time before learning
              their phone cannot run the study has already decided to take
              part on a device that will waste their forty minutes.
            */}
            <div
              className={cx(
                "mb-4 flex items-start gap-3 rounded-2xl border p-3.5 text-sm font-medium shadow-2xs",
                isNarrow
                  ? "border-red-300 bg-red-50 text-red-950"
                  : "border-amber-200 bg-amber-50/80 text-amber-950",
              )}
            >
              <span aria-hidden className="mt-0.5 text-lg">{isNarrow ? "⚠" : "▣"}</span>
              <p className="min-w-0 flex-1 leading-relaxed">
                <strong>{isNarrow ? "This screen is too small. " : "Computer required. "}</strong>
                {isNarrow
                  ? "Open this link on a desktop or laptop, or widen this window. The chat and your private briefing must fit side by side."
                  : "The chat and your private briefing sit side by side, so a phone or small tablet cannot run this study."}
              </p>
            </div>

            <NavigationNotice className="mb-4" />

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                icon="⏱"
                label="Time"
                value={`~${STUDY.estimatedMinutes} min`}
                hint="From consent to debrief"
                tone="blue"
              />
              <StatCard
                icon="£"
                label="Payment"
                value={`${STUDY.currencySymbol}${trimPence(STUDY.minTotal)}–${STUDY.currencySymbol}${trimPence(STUDY.maxTotal)}`}
                hint="Total, depending on your role"
                tone="emerald"
              />
              <StatCard
                icon="↗"
                label="Rate"
                value={`${STUDY.currencySymbol}${BASE_HOURLY_RATE}/hr`}
                hint="Base rate"
                tone="indigo"
              />
            </div>

            <Card>
              <CardTitle>What you will do</CardTitle>
              {/*
                "AI PROXY" IS NAMED HERE, ONCE, WITH ITS GLOSS. Every later
                screen uses the term — guide page 3, the comprehension check,
                the mandate, the questionnaire — and this page called it "a
                software tool", so the first place a participant met the name
                was a question testing them on it.

                Naming it discloses no condition. Both Proxy policies are
                called "AI Proxy" and Direct has none, so the word says which
                INTERFACE a task uses and not which of the three arms the
                participant is in ("Things the participant must never learn"
                #2). §7 requires the policy be disclosed anyway, on the screen
                where the mandate is set.
              */}
              <p className="mb-4 max-w-prose text-sm leading-relaxed text-slate-700 sm:text-base">
                You negotiate two workplace arrangements with another
                participant. You chat directly in one task. In the other an{" "}
                <strong>AI Proxy</strong> (a software tool) speaks for you
                first. You then talk with the other participant to confirm the
                final agreement.
              </p>
              <ol className="grid gap-2.5 sm:grid-cols-2">
                {STEPS.map((step, i) => (
                  <li
                    key={step.title}
                    className={cx(
                      "flex items-start gap-3 rounded-xl bg-slate-50 p-3",
                      // The last row spans both columns only when the count
                      // is ODD and it would otherwise sit alone. With an even
                      // count it pairs like every other row.
                      STEPS.length % 2 === 1 &&
                        i === STEPS.length - 1 &&
                        "sm:col-span-2",
                    )}
                  >
                    <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-white text-xs font-bold text-[var(--accent)]">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-bold text-slate-900">{step.title}</p>
                        <span className="tabular shrink-0 text-xs font-semibold text-slate-500">
                          {step.minutes} min
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </>
        ) : infoPage === 1 ? (
          <>
            <PageHeader
              eyebrow="Before You Decide · Information 2 of 3"
              title="Your data and your choice"
              subtitle="Here is what we record, how we store it, and what taking part means for you."
            />

            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <Card>
                <CardTitle hint="Used for research analysis">
                  What we record
                </CardTitle>
                <ul className="space-y-2.5">
                  {RECORDED.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                      <span aria-hidden className="mt-0.5 font-bold text-emerald-700">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card>
                <CardTitle hint="Stored under a research ID">
                  How we protect it
                </CardTitle>
                <p className="text-sm leading-relaxed text-slate-700">
                  Responses are stored under an anonymous research ID. Your
                  Prolific ID is used only to process payment.
                </p>
                {/* Not a box inside the box. The undertaking is the reader's,
                    not ours, so it is set apart by weight rather than by a
                    second surface. */}
                <p className="mt-3 border-t border-slate-200 pt-3 text-sm leading-relaxed text-slate-900">
                  <strong>Please stay anonymous.</strong> Do not type your name,
                  your employer, or any other identifying detail, in the chat
                  or in any text box.
                </p>
              </Card>
            </div>

            <Card className="mb-5">
              <CardTitle>Important to know</CardTitle>
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm font-bold text-slate-900">Risks and benefits</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-slate-600">
                    The tasks involve minimal, everyday workplace discussion.
                    There is no direct benefit beyond the advertised payment.
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-bold text-slate-900">Taking part is voluntary</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-slate-600">
                    You may stop at any time by closing this tab, without a
                    penalty on Prolific.
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-bold text-slate-900">Full explanation at the end</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-slate-600">
                    Some study details are withheld until the debrief so the
                    tasks work as intended.
                  </dd>
                </div>
              </dl>
            </Card>

            <Card tone="muted">
              <CardTitle>Questions or concerns</CardTitle>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Research team
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {STUDY.irb.principalInvestigator}, {STUDY.irb.institution}
                    <br />
                    <a href={`mailto:${STUDY.irb.researcherEmail}`} className="font-bold text-[var(--accent)] hover:underline">
                      {STUDY.irb.researcherEmail}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Ethics review
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {STUDY.irb.institution} IRB determined this study exempt
                    <br />#{STUDY.irb.exemptionNumber}
                  </dd>
                </div>
              </dl>
            </Card>
          </>
        ) : (
          <>
            <PageHeader
              eyebrow="Your Choice · Information 3 of 3"
              title="Would you like to take part?"
              subtitle="Check the two boxes below only if you understand the study information and want to continue."
            />

            <Card className="mb-5" tone="muted">
              <CardTitle>One last review</CardTitle>
              <ul className="grid gap-3 text-sm leading-relaxed text-slate-700 sm:grid-cols-2">
                <li><strong>Time:</strong> about {STUDY.estimatedMinutes} minutes on a desktop or laptop.</li>
                <li><strong>Payment:</strong> {STUDY.currencySymbol}{STUDY.minTotal}–{STUDY.currencySymbol}{STUDY.maxTotal} in total. Your role decides the amount.</li>
                <li><strong>Activities:</strong> background questions, two practice rounds, two negotiations, and surveys.</li>
                <li><strong>Your choice:</strong> you can stop at any time without penalty.</li>
                <li className="sm:col-span-2"><strong>In the chat:</strong> stay anonymous, and never give the other side the numbers from your point sheet.</li>
              </ul>
            </Card>

            <Card className="border-2 border-indigo-200 bg-indigo-50/20 shadow-sm">
              <CardTitle hint="Both confirmations are required to begin.">
                Your informed consent
              </CardTitle>
              <div className="mt-3 space-y-3">
                <Checkbox checked={isEligible} onChange={setIsEligible}>
                  <strong className="font-bold text-[var(--ink)]">Eligibility: </strong>
                  I am at least 18 years old, can read and write English comfortably,
                  and have at least one year of work experience.
                </Checkbox>
                <Checkbox checked={agreed} onChange={setAgreed}>
                  <strong className="font-bold text-[var(--ink)]">Voluntary consent: </strong>
                  I have read and understood the information above. I understand
                  that participation is voluntary, and I agree to take part.
                </Checkbox>
              </div>
            </Card>

            {unavailable ? (
              <div className="mt-5">
                <Callout tone="warning" title="The study is not available right now">
                  Something on our side is not ready, so we cannot start your
                  session. Please try again in a few minutes. If it still does
                  not work, return your submission on Prolific. Nothing has been
                  recorded.
                </Callout>
              </div>
            ) : null}
          </>
        )}
      </Page>

      <ActionBar
        label={
          infoPage === 0
            ? "Next: privacy and rights"
            : infoPage === 1
              ? "Next: consent"
              : "Agree and begin study"
        }
        onClick={
          infoPage < CONSENT_INFORMATION_PAGES.length - 1
            ? () => moveInfo(infoPage + 1)
            : handleConsent
        }
        disabled={infoPage === CONSENT_INFORMATION_PAGES.length - 1 && !canProceed}
        busy={infoPage === CONSENT_INFORMATION_PAGES.length - 1 && busy}
        secondary={
          infoPage > 0 ? (
            <PreviousReading
              onClick={() => moveInfo(infoPage - 1)}
              disabled={busy}
            />
          ) : undefined
        }
        note={
          infoPage === CONSENT_INFORMATION_PAGES.length - 1
            ? prolific.prolificPid
              ? "Prolific ID detected."
              : "Preview mode: no Prolific ID detected."
            : `Information ${infoPage + 1} of ${CONSENT_INFORMATION_PAGES.length}`
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
