"use client";

/**
 * Proxy session (Methods ver.1.8 §Delegate Proxy, §Explorer Proxy).
 *
 * Flow: brief → private target → mandate → confirm → AI-AI negotiation
 *       → review → ratify → post-task questions.
 *
 * DECEPTION INTEGRITY: Delegate and Explorer render the SAME interface. The
 * only difference is what the backend permits the agents to do. The review
 * never marks which elements came from the mandate and which the agent
 * explored — provenance is stripped server-side. Nothing in this file may
 * branch on `policy` except the value passed to the API and to the scripted
 * exchange used in mockup mode.
 *
 * THE MANDATE IS THREE FIELDS PER TERM, NOT SEVEN. It used to ask for an aim,
 * a floor, a priority label, a rationale policy and a free-text note, which
 * meant a participant had to hold five ideas about each of six issues before
 * anything happened. ver.1.8 asks where to open, how far the assistant may go,
 * and whether there is a line it may not cross — and the reasons move out of
 * the per-issue grid into two cards of their own, because that is where the
 * real decision is. Whether the focal threshold ends up in the hard-boundary
 * field is the MANDATE behavioural code; which reason card is marked sayable
 * is the disclosure measure.
 */

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { OptionChips } from "@/components/issues";
import { type DisplayMessage } from "@/components/negotiation";
import { BriefingPanel, SessionHeader, SessionLayout } from "@/components/session";
import { ActionBar } from "@/components/study-chrome";
import { Callout, Card, CardTitle, Page, cx } from "@/components/ui";
import {
  useDevActions,
  useDevAutofill,
  useDevGate,
  useDevMockAi,
} from "@/lib/dev-mode";
import { STAGES } from "@/lib/negotiation/machine";
import { scriptedSession } from "@/lib/negotiation/script";
import { useParticipant, usePageEnter } from "@/lib/participant-context";
import { getStore } from "@/lib/store";
import { nextHref } from "@/lib/study-config";
import { focalIssue, getTask } from "@/lib/tasks";
import type {
  Issue,
  IssueMandate,
  Mandate,
  Package,
  ReasonCard,
  ReasonPermission,
  Role,
  StageId,
  TaskId,
} from "@/lib/types";
import { ReviewPhase } from "./review";
import { PostTaskSurvey, PrivateTargetForm, SessionBrief } from "./shared";

type Phase =
  | "brief"
  | "target"
  | "mandate"
  | "confirm"
  | "negotiating"
  | "review"
  | "post";

const PHASES: Phase[] = [
  "brief",
  "target",
  "mandate",
  "confirm",
  "negotiating",
  "review",
  "post",
];

const STEP_LABELS = [
  "Your briefing",
  "Before you begin",
  "Instruct your assistant",
  "Confirm",
  "Negotiating",
  "Review",
  "Questions",
];

/** Total messages in the exchange: one per side per stage (Appendix E1). */
const TOTAL_TURNS = STAGES.length * 2;

function emptyMandate(
  task: ReturnType<typeof getTask>,
  role: Role,
  sessionIndex: 1 | 2,
): Mandate {
  const reasons = task.roleBriefs[role].focalReasons ?? [];
  return {
    sessionIndex,
    issues: task.issues.map<IssueMandate>((issue) => ({
      issueId: issue.id,
      preferredOptionId: null,
      acceptableFloorOptionId: null,
      hardBoundaryOptionId: null,
    })),
    // Defaults follow Appendix A8: a work reason starts sayable, a private
    // circumstance starts private. Both can be changed, and the change is the
    // datum — so the defaults must be the ones the design specifies, not
    // whichever is more convenient.
    reasonPermissions: Object.fromEntries(
      reasons.map((r) => [r.id, r.defaultPermission]),
    ),
    allowConditionalTrade: true,
    revisionCount: 0,
  };
}

/**
 * The instruction, in the words the assistant would use.
 *
 * Written back under every card so the participant can check what they have
 * actually said. Selections are easy to misread; a sentence is not.
 *
 * "Trade down" was the wrong phrase and had to go. Options are listed in the
 * order that favours whichever ROLE the term belongs to, so on the Leader's
 * scope term a Member's concession runs UP the list — and the sentence read
 * "I'll trade down to 5 workflows" for a floor that was in fact the most
 * generous position available. It now says which end it will settle at, which
 * is true whichever direction the list runs.
 */
function instructionSentence(issue: Issue, im: IssueMandate): string {
  const label = (id: string | null) =>
    issue.options.find((o) => o.id === id)?.label;

  const open = label(im.preferredOptionId);
  const floor = label(im.acceptableFloorOptionId);
  const boundary = label(im.hardBoundaryOptionId);

  const parts: string[] = [];
  parts.push(open ? `I'll open by asking for ${open}.` : "I'll open on this term.");
  if (floor && floor !== open) {
    parts.push(`I'll settle as far as ${floor} if it buys something elsewhere.`);
  } else if (floor) {
    parts.push("I won't move from there.");
  }
  if (boundary) parts.push(`I will not go past ${boundary}, whatever happens.`);
  else parts.push("There's no line I have to hold here.");

  return parts.join(" ");
}

export function ProxySession({
  sessionIndex,
  taskId,
  role,
  policy,
}: {
  sessionIndex: 1 | 2;
  taskId: TaskId;
  role: Role;
  policy: "delegate" | "explorer";
}) {
  usePageEnter(`session-${sessionIndex}`);
  const router = useRouter();
  const { logEvent, participantKey } = useParticipant();
  const task = getTask(taskId);
  const focal = focalIssue(task);
  const reasonCards: ReasonCard[] = task.roleBriefs[role].focalReasons ?? [];

  const [phase, setPhase] = useState<Phase>("brief");
  const [mandate, setMandate] = useState<Mandate>(() =>
    emptyMandate(task, role, sessionIndex),
  );
  const [transcript, setTranscript] = useState<DisplayMessage[]>([]);
  const [tentative, setTentative] = useState<Package | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The participant's instruction when they send a package back once. */
  const [revisionNote, setRevisionNote] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  /**
   * Emergency stop (Appendix C4). Not a pause button: the condition promises
   * the participant a way out "if the system leaves an authorized boundary",
   * and a promise made in the instructions that the interface does not keep is
   * a broken manipulation, not a missing feature.
   *
   * A ref, because the negotiation loop reads it between turns and state
   * captured in that closure would be stale.
   */
  const stopped = useRef(false);
  const [showStopped, setShowStopped] = useState(false);

  const mockAi = useDevMockAi();
  const script = scriptedSession(task, role, policy);

  useDevActions(
    `session-${sessionIndex}`,
    PHASES.map((p, i) => ({
      id: p,
      label: STEP_LABELS[i],
      active: phase === p,
      run: () => {
        if ((p === "review" || p === "post") && transcript.length === 0) {
          setTranscript(
            script.messages.map((m) => ({
              id: m.id,
              speaker: m.speaker,
              text: m.text,
            })),
          );
          setTentative(script.tentative);
        }
        if (p === "negotiating" && progress.total === 0) {
          setProgress({ done: 4, total: TOTAL_TURNS });
        }
        setPhase(p);
      },
    })),
  );

  // Mockup mode fills the mandate the way the worked example in Appendix E8
  // does: open at your own best level on every term, allow the assistant all
  // the way down on the terms you can spend, and put a hard boundary on the
  // focal one at its threshold. That combination is what makes the logroll
  // available — the assistant has scope and timing to give away, and a line it
  // must hold on the term that matters.
  //
  // "Your own best level" is not `options[0]`: options are ordered best-first
  // for whichever ROLE the term favours, so for a Member the scope list starts
  // at the option worth nothing to them.
  useDevAutofill(() => {
    setMandate((m) => ({
      ...m,
      issues: m.issues.map((im) => {
        const issue = task.issues.find((i) => i.id === im.issueId)!;
        const isFocal = issue.id === focal.id;
        const byValue = [...issue.options].sort(
          (a, b) => b.points[role] - a.points[role],
        );
        const threshold =
          issue.options[issue.focalThresholdIndex ?? 1] ?? issue.options[1];
        return {
          ...im,
          preferredOptionId: im.preferredOptionId ?? byValue[0].id,
          acceptableFloorOptionId:
            im.acceptableFloorOptionId ??
            (isFocal ? threshold.id : byValue[byValue.length - 1].id),
          hardBoundaryOptionId:
            im.hardBoundaryOptionId ?? (isFocal ? threshold.id : null),
        };
      }),
    }));
  }, `mandate-s${sessionIndex}`);

  function updateIssue(issueId: string, patch: Partial<IssueMandate>) {
    setMandate((m) => ({
      ...m,
      issues: m.issues.map((i) =>
        i.issueId === issueId ? { ...i, ...patch } : i,
      ),
    }));
  }

  function setPermission(reasonId: string, permission: ReasonPermission) {
    setMandate((m) => ({
      ...m,
      reasonPermissions: { ...m.reasonPermissions, [reasonId]: permission },
    }));
  }

  /**
   * Drives the AI-AI negotiation one stage-turn at a time.
   *
   * The route generates a single turn per request, so the client owns the
   * sequence. Turns are appended as they arrive, which keeps each request
   * short and lets the waiting screen show real progress.
   */
  async function runNegotiation(revision?: string) {
    setPhase("negotiating");
    setError(null);
    setTranscript([]);
    setProgress({ done: 0, total: TOTAL_TURNS });
    stopped.current = false;
    setShowStopped(false);
    logEvent("negotiation_started", { policy }, { sessionIndex });

    if (mockAi) {
      const scripted = script.messages;
      setProgress({ done: 0, total: scripted.length });
      for (let i = 0; i < scripted.length; i += 1) {
        if (stopped.current) break;
        await new Promise((r) => setTimeout(r, 260));
        setTranscript(
          scripted.slice(0, i + 1).map((m) => ({
            id: m.id,
            speaker: m.speaker,
            text: m.text,
          })),
        );
        setProgress({ done: i + 1, total: scripted.length });
      }
      // A stopped negotiation has no agreement — that is what stopping it
      // means. Handing the participant the package the exchange was heading
      // for would make the stop cosmetic.
      setTentative(stopped.current ? null : script.tentative);
      logEvent(
        "negotiation_ended",
        {
          turns: scripted.length,
          mock: true,
          emergencyStop: stopped.current,
          focalByStage: scripted
            .filter((m) => m.speaker === "participant_proxy" && m.proposal)
            .map((m) => ({
              stage: m.stage,
              optionId: m.proposal?.[focal.id] ?? null,
            })),
        },
        { sessionIndex },
      );
      setPhase("review");
      return;
    }

    const collected: DisplayMessage[] = [];
    let lastParticipantPackage: Package | null = null;
    let lastCounterpartPackage: Package | null = null;
    let settled: Package | null = null;
    // The counterpart's closing test can reject the final package. Reading it
    // matters: without this the participant's own stage-5 proposal was the
    // last one carrying a package, so a refusal was silently recorded as a
    // tentative agreement — and a Proxy impasse would have been recoded as an
    // agreement while Baseline recorded it correctly, leaving the two arms
    // disagreeing about what an impasse is.
    let proxyImpasse = false;
    /**
     * Where the focal requirement stood at each of the proxy's turns.
     *
     * The Baseline session gets this for free — the participant sends the
     * messages, so each one is logged with the focal level it carried. A
     * Proxy session has no participant messages at all, so without recording
     * it here the trajectory would jump from what was entrusted straight to
     * the final package, and the two middle transitions ver.1.8 asks to be
     * reported — opening advocacy, and retention after the challenge — would
     * not exist for half the design.
     */
    const focalByStage: Array<{ stage: number; optionId: string | null }> = [];
    // Which reason cards this side has voiced so far. The rationale budget is
    // a whole-task limit, and the route is stateless, so the count lives here.
    const reasonsUsed: string[] = [];

    try {
      for (let turn = 0; turn < TOTAL_TURNS; turn += 1) {
        if (stopped.current) break;
        const res = await fetch("/api/proxy-negotiation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            participantRole: role,
            policy,
            mandate,
            sessionIndex,
            turn,
            lastParticipantPackage,
            lastCounterpartPackage,
            reasonsUsed,
            revisionNote: revision ?? null,
            history: collected.map((m) => ({
              speaker: m.speaker,
              text: m.text,
            })),
          }),
        });

        if (!res.ok) throw new Error(`Request failed: ${res.status}`);

        const data = (await res.json()) as {
          message?: {
            id: string;
            speaker: DisplayMessage["speaker"];
            text: string;
            proposal?: Package;
          };
          done: boolean;
          totalTurns?: number;
          reasonUsed?: string | null;
          stage?: number;
          focalOption?: string | null;
          accepted?: boolean;
          impasse?: boolean;
        };

        if (data.impasse) proxyImpasse = true;

        if (data.reasonUsed) reasonsUsed.push(data.reasonUsed);
        if (
          data.message?.speaker === "participant_proxy" &&
          data.stage !== undefined
        ) {
          focalByStage.push({
            stage: data.stage,
            optionId: data.focalOption ?? null,
          });
        }

        if (data.message) {
          collected.push({
            id: data.message.id,
            speaker: data.message.speaker,
            text: data.message.text,
          });
          setTranscript([...collected]);

          // Persist the message text, not only the trajectory.
          //
          // Two pilot gates need the actual words: the fabricated-personal-
          // fact audit (target zero), and the check that Delegate and Explorer
          // are matched on message length. Both are about what was said, and
          // both were unrunnable while the proxy transcript lived only in
          // React state and vanished on submit. Baseline was already storing
          // its messages; this is the same store, for the other half.
          if (participantKey) {
            void getStore().appendMessage(participantKey, {
              id: data.message.id,
              sessionIndex,
              speaker: data.message.speaker,
              text: data.message.text,
              createdAt: new Date().toISOString(),
              ...(data.stage ? { stage: data.stage as StageId } : {}),
              ...(data.message.proposal
                ? { proposal: data.message.proposal }
                : {}),
            });
          }

          if (data.message.proposal) {
            if (data.message.speaker === "participant_proxy") {
              lastParticipantPackage = data.message.proposal;
            } else {
              lastCounterpartPackage = data.message.proposal;
            }
            settled = data.message.proposal;
          }
        }

        setProgress({ done: turn + 1, total: data.totalTurns ?? TOTAL_TURNS });
        if (data.done) break;
      }

      setTentative(stopped.current || proxyImpasse ? null : settled);
      logEvent(
        "negotiation_ended",
        {
          turns: collected.length,
          emergencyStop: stopped.current,
          impasse: proxyImpasse,
          // The trajectory's middle: what the proxy opened on the focal term
          // (stage 1) and where it stood after the standardized challenge
          // (stage 4).
          focalByStage,
        },
        { sessionIndex },
      );
      setPhase("review");
    } catch (e) {
      console.error(e);
      setError(
        "Something went wrong while your assistant was negotiating. Please try again.",
      );
      setPhase("confirm");
    }
  }

  // --- brief / target -----------------------------------------------------
  if (phase === "brief") {
    return (
      <SessionBrief
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        onContinue={() => setPhase("target")}
      />
    );
  }

  if (phase === "target") {
    return (
      <PrivateTargetForm
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        steps={STEP_LABELS}
        onContinue={() => setPhase("mandate")}
      />
    );
  }

  // --- instruct -----------------------------------------------------------
  if (phase === "mandate") {
    return (
      <MandatePhase
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        mandate={mandate}
        reasonCards={reasonCards}
        onIssueChange={updateIssue}
        onPermissionChange={setPermission}
        onContinue={() => {
          setPhase("confirm");
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  // --- confirm ------------------------------------------------------------
  if (phase === "confirm") {
    return (
      <>
        <Page width="wide">
          <SessionLayout briefing={<BriefingPanel task={task} role={role} />}>
            <SessionHeader
              sessionIndex={sessionIndex}
              title="Here is what your assistant will do"
              steps={STEP_LABELS}
              current={3}
            />

            {error ? (
              <div className="mb-5">
                <Callout tone="warning">
                  <p>{error}</p>
                </Callout>
              </div>
            ) : null}

            <Card className="mb-5">
              <CardTitle hint="Read this back. If it is not what you meant, change it before starting.">
                Your instructions, in its words
              </CardTitle>
              <ul className="space-y-3">
                {mandate.issues.map((im) => {
                  const issue = task.issues.find((i) => i.id === im.issueId)!;
                  return (
                    <li
                      key={im.issueId}
                      className="border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0"
                    >
                      <p className="text-[0.8125rem] font-semibold">
                        {issue.label}
                      </p>
                      <p className="max-w-prose text-[0.9375rem] text-[var(--ink-2)]">
                        {instructionSentence(issue, im)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {reasonCards.length > 0 ? (
              <Card tone="private" className="mb-5 text-[var(--private-ink)]">
                <CardTitle>What it may say about why</CardTitle>
                <ul className="space-y-3">
                  {reasonCards.map((card) => {
                    const sayable =
                      (mandate.reasonPermissions[card.id] ??
                        card.defaultPermission) === "sayable";
                    return (
                      <li key={card.id}>
                        <p className="text-[0.8125rem] font-semibold">
                          {sayable ? "It may say this" : "It will never say this"}
                        </p>
                        <p className="max-w-prose text-[0.8125rem] leading-relaxed">
                          {card.text}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null}
          </SessionLayout>
        </Page>

        <ActionBar
          label="This is right — start"
          onClick={async () => {
            if (participantKey) {
              await getStore().saveMandate(participantKey, mandate);
            }
            logEvent(
              "mandate_saved",
              {
                policy,
                // The MANDATE code: did the participant give their assistant a
                // line to hold on the term that is hard to raise?
                focalHardBoundary:
                  mandate.issues.find((i) => i.issueId === focal.id)
                    ?.hardBoundaryOptionId ?? null,
                reasonPermissions: mandate.reasonPermissions,
              },
              { sessionIndex },
            );
            void runNegotiation();
          }}
          note="It negotiates without checking in, but you can stop it, and nothing is final until you review it."
          secondary={
            <button
              type="button"
              onClick={() => {
                setMandate((m) => ({
                  ...m,
                  revisionCount: m.revisionCount + 1,
                }));
                logEvent("mandate_revised", undefined, { sessionIndex });
                setPhase("mandate");
              }}
              className="rounded-[var(--radius)] px-3 py-2 text-[0.9375rem] font-medium text-[var(--ink-2)] hover:bg-[var(--surface-muted)]"
            >
              Change something
            </button>
          }
        />
      </>
    );
  }

  // --- negotiating (waiting) ---------------------------------------------
  if (phase === "negotiating") {
    const pct =
      progress.total > 0
        ? Math.round((progress.done / progress.total) * 100)
        : 0;

    return (
      <Page>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-6 flex gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)]"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <h1 className="mb-2 text-[1.25rem] font-semibold">
            Your assistant is negotiating
          </h1>
          <p className="mb-8 max-w-sm text-[0.9375rem] text-[var(--ink-2)]">
            Both sides are represented by their assistants. You will see the
            result when it finishes.
          </p>

          {progress.total > 0 ? (
            <div className="w-full max-w-xs">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-[0.8125rem] text-[var(--ink-2)]">
                {progress.done} of {progress.total} exchanges
              </p>
            </div>
          ) : null}

          {/* Appendix C4 promises this in the condition instructions, so it
              has to exist. Deliberately quiet: it is for the case where
              something has gone wrong, not a second way to negotiate. */}
          <button
            type="button"
            onClick={() => {
              stopped.current = true;
              setShowStopped(true);
              logEvent(
                "negotiation_ended",
                { emergencyStop: true, atTurn: progress.done },
                { sessionIndex },
              );
            }}
            disabled={showStopped}
            className="mt-10 text-[0.8125rem] text-[var(--ink-3)] underline underline-offset-4 hover:text-[var(--ink-2)] disabled:no-underline"
          >
            {showStopped ? "Stopping…" : "Stop this now"}
          </button>
          <p className="mt-2 max-w-xs text-[0.75rem] text-[var(--ink-3)]">
            Only if something looks wrong. You will still review whatever was
            reached.
          </p>
        </div>
      </Page>
    );
  }

  if (phase === "post") {
    return (
      <PostTaskSurvey
        sessionIndex={sessionIndex}
        task={task}
        role={role}
        isProxy
        steps={STEP_LABELS}
        onDone={() => {
          logEvent("page_complete", undefined, {
            page: `session-${sessionIndex}`,
            sessionIndex,
          });
          router.push(
            sessionIndex === 1 ? nextHref("session-1") : nextHref("session-2"),
          );
        }}
      />
    );
  }

  // --- review -------------------------------------------------------------
  return (
    <ReviewPhase
      sessionIndex={sessionIndex}
      task={task}
      role={role}
      steps={STEP_LABELS}
      stepIndex={5}
      tentative={tentative}
      transcript={transcript}
      revisionsUsed={mandate.revisionCount}
      transcriptTitle="The full conversation"
      transcriptHint={
        revisionNote
          ? `Your assistant went back with your instruction — “${revisionNote}” — and this is what came of it. ${transcript.length} exchanges in all.`
          : `Every exchange between the two assistants, ${transcript.length} in all.`
      }
      onRevise={async (note) => {
        // The assistant goes back with the participant's instruction attached
        // to its mandate. One revision only — the review screen stops offering
        // it after the first — so this cannot loop.
        setRevisionNote(note);
        setMandate((m) => ({ ...m, revisionCount: m.revisionCount + 1 }));
        logEvent("mandate_revised", { note, fromReview: true }, { sessionIndex });
        await runNegotiation(note);
      }}
      onDone={() => setPhase("post")}
    />
  );
}

// ---------------------------------------------------------------------------
// The mandate screen
// ---------------------------------------------------------------------------

function MandatePhase({
  sessionIndex,
  task,
  role,
  mandate,
  reasonCards,
  onIssueChange,
  onPermissionChange,
  onContinue,
}: {
  sessionIndex: 1 | 2;
  task: ReturnType<typeof getTask>;
  role: Role;
  mandate: Mandate;
  reasonCards: ReasonCard[];
  onIssueChange: (issueId: string, patch: Partial<IssueMandate>) => void;
  onPermissionChange: (reasonId: string, permission: ReasonPermission) => void;
  onContinue: () => void;
}) {
  const missing = mandate.issues
    .filter((im) => !im.preferredOptionId)
    .map((im) => `open-${im.issueId}`);
  const canContinue = useDevGate(missing.length === 0);

  return (
    <>
      <Page width="wide">
        <SessionLayout briefing={<BriefingPanel task={task} role={role} />}>
          <SessionHeader
            sessionIndex={sessionIndex}
            title="Tell your assistant what you want"
            steps={STEP_LABELS}
            current={2}
          />

          <div className="mb-5">
            <Callout title="It will negotiate on its own">
              <p className="max-w-prose">
                Your assistant uses only what you set here. Once it starts you
                cannot step in, but nothing it agrees is final — you review the
                result and decide.
              </p>
            </Callout>
          </div>

          <div className="space-y-4">
            {task.issues.map((issue) => {
              const im = mandate.issues.find((i) => i.issueId === issue.id)!;
              return (
                <MandateCard
                  key={issue.id}
                  issue={issue}
                  im={im}
                  role={role}
                  onChange={(patch) => onIssueChange(issue.id, patch)}
                />
              );
            })}

            {/* The reasons. Separated from the per-term grid because this is
                the decision the study is actually about: what may be said on
                your behalf, and what stays with you. */}
            {reasonCards.length > 0 ? (
              <Card tone="private" className="text-[var(--private-ink)]">
                <CardTitle hint="Your assistant can rephrase these, but cannot add a fact you have not given it.">
                  What it may say about why
                </CardTitle>
                <div className="space-y-4">
                  {reasonCards.map((card) => {
                    const value =
                      mandate.reasonPermissions[card.id] ??
                      card.defaultPermission;
                    return (
                      <div
                        key={card.id}
                        className="rounded-[var(--radius)] border border-[var(--private-line)] p-3.5"
                      >
                        <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]">
                          {card.layer === "work"
                            ? "A reason you could give"
                            : "Harder to say out loud"}
                        </p>
                        <p className="mb-3 max-w-prose text-[0.8125rem] leading-relaxed">
                          {card.text}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              ["sayable", "It may say this"],
                              ["private", "Keep this to yourself"],
                            ] as Array<[ReasonPermission, string]>
                          ).map(([permission, label]) => (
                            <label
                              key={permission}
                              className={cx(
                                "cursor-pointer rounded-full border px-3 py-1.5 text-[0.8125rem] transition-colors",
                                value === permission
                                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                                  : "border-[var(--private-line)] bg-[var(--surface)] hover:border-[var(--ink-3)]",
                              )}
                            >
                              <input
                                type="radio"
                                name={`reason-${card.id}`}
                                checked={value === permission}
                                onChange={() =>
                                  onPermissionChange(card.id, permission)
                                }
                                className="sr-only"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}
          </div>
        </SessionLayout>
      </Page>

      <ActionBar
        label="Review my instructions"
        onClick={onContinue}
        disabled={!canContinue}
        remaining={missing.length}
        firstUnansweredId={missing[0] ?? null}
        note={
          missing.length === 0
            ? "Ready."
            : `${missing.length} term${missing.length === 1 ? "" : "s"} without an opening`
        }
      />
    </>
  );
}

function MandateCard({
  issue,
  im,
  role,
  onChange,
}: {
  issue: Issue;
  im: IssueMandate;
  role: Role;
  onChange: (patch: Partial<IssueMandate>) => void;
}) {
  return (
    <Card id={`q-open-${issue.id}`}>
      <div className="mb-4">
        <p className="text-[0.9375rem] font-semibold">{issue.label}</p>
        <p className="max-w-prose text-[0.875rem] text-[var(--ink-2)]">
          {issue.description}
        </p>
      </div>

      <div className="space-y-4">
        <Row label="Open by asking for">
          <OptionChips
            issue={issue}
            role={role}
            name={`open-${issue.id}`}
            value={im.preferredOptionId}
            onChange={(v) => onChange({ preferredOptionId: v })}
          />
        </Row>

        <Row label="Will settle as far as">
          <OptionChips
            issue={issue}
            role={role}
            name={`floor-${issue.id}`}
            value={im.acceptableFloorOptionId}
            onChange={(v) =>
              onChange({ acceptableFloorOptionId: v === "" ? null : v })
            }
            allowNone
            noneLabel="Anything"
          />
        </Row>

        <Row label="Must never go past">
          <OptionChips
            issue={issue}
            role={role}
            name={`boundary-${issue.id}`}
            value={im.hardBoundaryOptionId}
            onChange={(v) =>
              onChange({ hardBoundaryOptionId: v === "" ? null : v })
            }
            allowNone
            noneLabel="No line here"
          />
        </Row>
      </div>

      <p className="mt-4 max-w-prose rounded-[var(--radius)] border-l-2 border-[var(--accent)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-[0.875rem] leading-relaxed">
        {instructionSentence(issue, im)}
      </p>
    </Card>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[0.8125rem] font-medium">{label}</p>
      {children}
    </div>
  );
}
