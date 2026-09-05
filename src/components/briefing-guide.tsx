"use client";

import { useState } from "react";
import { ActionBar, BackButton } from "./study-chrome";
import { Card, CardTitle, Page, PageHeader } from "./ui";
import { STUDY } from "@/lib/study-config";
import type { Role } from "@/lib/types";

/** Neutral workplace scenes: no secret, recommended trade, or emotional reaction. */
export function WorkplaceScene({ scene }: { scene: "team" | "terms" | "private" | "decision" }) {
  return (
    <svg viewBox="0 0 240 120" className="h-28 w-full" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="238" height="118" rx="12" fill="#f1f5f9" />
      {scene === "team" ? (
        <g stroke="#334155" strokeWidth="2" fill="none">
          <rect x="22" y="18" width="60" height="43" rx="3" stroke="#94a3b8" />
          <path d="M52 18v43M22 40h60M28 98h184M65 98v-9q0-23 23-23t23 23v9M130 98v-9q0-23 23-23t23 23v9" />
          <circle cx="88" cy="48" r="13" fill="#cbd5e1" />
          <circle cx="153" cy="48" r="13" fill="#cbd5e1" />
          <path d="M185 21h32v23h-20l-9 7v-7h-3z" fill="#fff" stroke="#94a3b8" />
        </g>
      ) : scene === "terms" ? (
        <g stroke="#334155" strokeWidth="2" fill="#fff">
          <rect x="43" y="21" width="65" height="78" rx="6" />
          <rect x="131" y="21" width="65" height="78" rx="6" />
          <path d="M56 39h39M144 39h39M70 55h25M158 55h25M70 71h25M158 71h25M70 87h25M158 87h25" stroke="#94a3b8" />
          {[55, 71, 87].map(y => <g key={y}><circle cx="59" cy={y} r="3" /><circle cx="147" cy={y} r="3" /></g>)}
        </g>
      ) : scene === "private" ? (
        <g stroke="#8b652f" strokeWidth="2" fill="#fff8ea">
          <rect x="69" y="17" width="85" height="86" rx="5" />
          <path d="M84 36h54M84 50h41M84 64h34M84 78h24" stroke="#c5a574" />
          <rect x="134" y="67" width="36" height="29" rx="4" />
          <path d="M142 67v-9a10 10 0 0 1 20 0v9" />
          <circle cx="152" cy="81" r="3" fill="#8b652f" />
        </g>
      ) : (
        <g stroke="#334155" strokeWidth="2" fill="#fff">
          <path d="M38 27h73v38H63L48 77V65H38zM131 51h72v37h-10v13l-15-13h-47z" />
          <path d="M53 41h41M53 51h28M146 65h41M146 75h28" stroke="#94a3b8" />
        </g>
      )}
    </svg>
  );
}

export function ReadingProgress({ labels, current }: { labels: readonly string[]; current: number }) {
  return (
    <ol aria-label="Briefing pages" className="mb-7 flex flex-wrap gap-x-5 gap-y-2 border-b border-slate-200 pb-4">
      {labels.map((label, index) => (
        <li key={label} aria-current={index === current ? "step" : undefined}
          className={`text-sm ${index === current ? "font-bold text-slate-900" : "text-slate-500"}`}>
          <span className="mr-2 tabular-nums">{index + 1}.</span>{label}
        </li>
      ))}
    </ol>
  );
}

export function PreviousReading({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick}
    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
    Back
  </button>;
}

const GUIDE_PAGES = ["The setting", "Your role", "The rules"] as const;

export function StudyOrientation({ role, onContinue }: { role: Role; onContinue: () => void }) {
  const [page, setPage] = useState(0);
  const isLeader = role === "leader";
  function move(next: number) {
    setPage(next);
    window.scrollTo({ top: 0 });
  }
  return (
    <>
      <Page>
        <ReadingProgress labels={GUIDE_PAGES} current={page} />
        <PageHeader eyebrow={`Study guide · ${page + 1} of 3`}
          title={["Two colleagues. Two working conditions.", `You are the ${isLeader ? "team lead" : "senior team member"}`, "What to do in each negotiation"][page]}
          subtitle={["You will play a role in a company project team. Here is the setting before you see your first task.", "You keep this role in both tasks. The other participant plays the other role.", "Read these rules before a short check and one practice round."][page]} />

        {page === 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              { scene: "team" as const, title: "1. Work on the same team", text: "You and another participant play a team lead and a senior team member at the same company." },
              { scene: "terms" as const, title: "2. Set two working conditions", text: "Choose one option for each condition. Both people must agree to the complete package." },
              { scene: "private" as const, title: "3. Read your own briefing", text: "You each have private goals, background information, and a point sheet. You cannot see the other person's sheet." },
              { scene: "decision" as const, title: "4. Negotiate, then reflect", text: "In one task you chat directly. In the other, an AI Proxy speaks for you. Questions and a bonus decision or evaluation follow each task." },
            ].map(item => (
              <section key={item.scene} className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
                <WorkplaceScene scene={item.scene} />
                <h2 className="mt-4 text-base font-bold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </section>
            ))}
          </div>
        ) : page === 1 ? (
          <div className="space-y-5">
            <Card tone="private">
              <CardTitle>Your role</CardTitle>
              <p className="mt-2 text-base leading-relaxed">{isLeader
                ? "You lead the project and answer to the director. You finalize the working conditions once both people agree. You also influence the member's evaluation and future work assignments."
                : "You are an experienced team member trusted to work directly with the client. You can ask for changes or refuse a proposed package."}</p>
            </Card>
            <Card>
              <CardTitle>After each task</CardTitle>
              <dl className="mt-4 space-y-4 text-sm leading-relaxed">
                <div><dt className="font-bold text-slate-900">The team lead decides a bonus</dt>
                  <dd className="mt-1 text-slate-600">The lead chooses the member&apos;s recommended performance bonus, up to {STUDY.currencySymbol}{STUDY.bonusPerTask} per task.</dd></div>
                <div><dt className="font-bold text-slate-900">The member evaluates the lead</dt>
                  <dd className="mt-1 text-slate-600">The member writes an upward evaluation of the lead that goes to the project director.</dd></div>
              </dl>
            </Card>
            <Card>
              <CardTitle>Both people receive the same instruction</CardTitle>
              <blockquote className="mt-3 border-l-2 border-slate-400 pl-4 text-base leading-relaxed">
                Consider not just the result, but the negotiation as a whole and whether you would want to work with this person again.
              </blockquote>
              <p className="mt-3 text-sm text-slate-600">Your points describe how well the agreed conditions fit your goals. They do not automatically determine the bonus.</p>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardTitle>Agree on both conditions</CardTitle>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Each condition has four options. Your aim is a package worth more points to you. If you do not agree on both, you each receive the fallback score. Direct negotiation lasts up to 10 minutes; you can finish sooner when you agree.</p>
            </Card>
            <Card tone="private">
              <CardTitle>Keep point values private</CardTitle>
              <p className="mt-2 text-sm leading-relaxed">Discuss the working conditions and why they matter. Never share the numbers from your point sheet in any form.</p>
            </Card>
            <Card>
              <CardTitle>Choose what to explain</CardTitle>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">You can explain your priorities and ask about the other person&apos;s situation. They adjust conditions based on the reasons they hear. A more specific explanation can help them justify a larger change.</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-900">Sharing sensitive background is optional. You can negotiate and reach an agreement without it. If you or your AI Proxy shares it, the other person may consider it in their later bonus decision or upward evaluation.</p>
            </Card>
            <Card>
              <CardTitle>Two ways of taking part</CardTitle>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">In direct chat, use your own words; you do not need to repeat the briefing exactly. In the AI Proxy task, choose what your representative may share, watch the exchange, then approve, request changes, or refuse its proposed agreement. That task explains its policy before you choose.</p>
            </Card>
          </div>
        )}
      </Page>
      <ActionBar label={page === 2 ? "Continue to the quick check" : `Next: ${GUIDE_PAGES[page + 1].toLowerCase()}`}
        onClick={() => page === 2 ? onContinue() : move(page + 1)}
        note={`Guide page ${page + 1} of 3`}
        secondary={page > 0 ? <PreviousReading onClick={() => move(page - 1)} /> : <BackButton from="instruction" />} />
    </>
  );
}
