import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const welcome = read("../src/app/page.tsx");
const guide = read("../src/components/briefing-guide.tsx");
const session = read("../src/components/session.tsx");
const shared = read("../src/app/task/[index]/shared.tsx");
const practice = read("../src/app/practice/[index]/practice-round.tsx");
const measures = read("../src/lib/measures.ts");
const illustrations = read("../src/lib/illustrations.ts");
const proxyArt = read("../src/components/proxy-art.tsx");
const proxyTask = read("../src/app/task/[index]/proxy-task.tsx");
const debriefing = read("../src/app/debriefing/page.tsx");

test("eligibility is based on English ability and work experience, not US residence", () => {
  assert.match(welcome, /read and write English comfortably/);
  assert.match(welcome, /at least one year of work experience/);
  assert.doesNotMatch(welcome, /reside in the United States/);
});

test("welcome gives the broad study purpose and stable fictional-role setup", () => {
  assert.match(welcome, /This study looks at how people reach agreements at work\./);
  assert.match(welcome, /same assigned role in two fictional workplace\s+scenarios/);
  assert.match(welcome, /In one task, you chat directly with another\s+participant/);
  assert.match(welcome, /In the other, an <strong>AI Proxy<\/strong>/);
  assert.match(welcome, /talk with the\s+other participant to confirm the agreement/);
});

test("participants are explicitly told never to reveal any option point value", () => {
  assert.match(guide, /Never share your point values/);
  assert.match(guide, /how many points any option gives you/);
  assert.match(guide, /Discuss the work terms and your reasons instead/);
  assert.match(shared, /border-rose-300 bg-rose-50[\s\S]*aria-hidden[\s\S]*Do not share point numbers in the conversation\./);
});

test("sensitive context is framed as fictional role information without a benefit pitch", () => {
  assert.match(guide, /belonging to this fictional role/);
  assert.match(guide, /not a request for your real personal history/);
  assert.match(guide, /The bonus is real money paid through Prolific after the study\./);
  assert.match(session, /sensitive private context for your assigned role/);
  assert.doesNotMatch(session, /help the other side understand/);
  assert.doesNotMatch(shared, /help the other person understand/);
});

test("the situation stays expanded in the negotiation briefing rail", () => {
  assert.match(session, /<details open className="group [^"]*rounded-lg/);
});

test("task cover button describes opening the task briefing", () => {
  assert.match(shared, /actionLabel=\{`Read Task \$\{taskIndex\} briefing`\}/);
  assert.doesNotMatch(shared, /actionLabel=\{`Start Task \$\{taskIndex\}`\}/);
});

test("the Proxy cover makes delegation, observation, and direct final agreement explicit", () => {
  assert.match(shared, /Your AI Proxy negotiates on your behalf\./);
  assert.match(proxyArt, /Choose your preferred options and which reasons your Proxy may share\./);
  assert.match(proxyArt, /The two AI Proxies negotiate based on those instructions\. You watch\./);
  assert.match(proxyArt, /Review the Proxy exchange and proposed terms\./);
  assert.match(proxyArt, /Discuss the proposal directly with the other participant and both agree on the final terms\./);
});

test("the Proxy setup explains the participant's choices and the final direct agreement", () => {
  assert.match(proxyTask, /title="Check your AI Proxy setup"/);
  assert.match(proxyTask, /I will always share your work reason and say which issue[\s\S]*matters more; you choose whether I may share your sensitive[\s\S]*background\./);
  assert.match(proxyTask, /Your work reason is always included\. Your sensitive[\s\S]*background is included only if you selected it\./);
  assert.match(proxyTask, /\{c\.relayed \?\? c\.text\}/);
  assert.match(proxyTask, /Your Proxy also adds two work arguments based on the[\s\S]*information you authorize/);
  assert.doesNotMatch(proxyTask, /Additional work considerations from this[\s\S]*Proxy:/);
  assert.match(proxyTask, /Then discuss or change the proposed terms directly with the other participant\. Both of you must agree\./);
  assert.doesNotMatch(proxyTask, /Authorize your AI Proxy|Authorize my AI Proxy and start/);
});

test("the Proxy emergency helper distinguishes stopping before and after a proposal", () => {
  assert.match(proxyTask, /Stopping before the Proxies[\s\S]*reach a proposal or impasse ends the study/);
  assert.match(proxyTask, /After that point,[\s\S]*your Proxy steps back and you take over yourself/);
});

test("both Proxy policies preserve facts and explain information-dependent additions", () => {
  assert.match(session, /Your Proxy \+ Their Proxy: same rule/);
  assert.match(session, /Both follow the same rule described below\./);
  assert.equal(session.split("rephrase the reasons you authorize into clear, work-focused language").length - 1, 2);
  assert.match(session, /preserve the facts and add no new reasons/);
  assert.match(session, /add two work-related arguments based on the information you authorize/);
  assert.doesNotMatch(session, /introduced as the AI's additional considerations|Additional work considerations|Individual sentences will not/);
  const sharedExampleBase = "The requested week of leave coincides with the Member's hospital check-up. The Member has not yet told the team about the check-up.";
  assert.equal(session.split(sharedExampleBase).length - 1, 2);
  assert.match(session, /Confirming leave dates early could give colleagues time to prepare handovers/);
  assert.match(session, /Planning cover for that week could help colleagues handle work while the Member attends the check-up/);
  assert.match(session, /A policy example, separate from the practice and tasks/);
  assert.doesNotMatch(session, /A practice situation|leaves out the specific event|personal appointment|own assessment/);
  assert.doesNotMatch(session, /SB1|WR1|WR2|stronger argument|better outcome|more persuasive/);
  assert.doesNotMatch(proxyTask, /summarize this in one[\s\S]*sentence without the specific event/);
});

test("debriefing accurately distinguishes the assigned Proxy policies", () => {
  assert.match(debriefing, /AI&rsquo;s participation[\s\S]*reputation concerns and judgments[\s\S]*of responsibility/);
  assert.match(debriefing, /used only the included reasons, or one that used the same included[\s\S]*reasons and added two work arguments without labeling individual/);
  assert.match(debriefing, /assigned policy, which both[\s\S]*Proxies in that session used/);
  assert.doesNotMatch(debriefing, /summarised a[\s\S]*sensitive reason|Both were[\s\S]*described to you/);
});

test("practice teaches the prominent mutual-confirmation acceptance control", () => {
  assert.match(practice, /Accept current offer/);
  assert.match(practice, /both of you confirm the same two terms/);
  assert.match(practice, /comes back to you for a final confirmation/);
  assert.doesNotMatch(practice, /comes back to you for a decision/);
  assert.match(practice, /sendProxyConfirmation/);
  assert.match(practice, /disabled=\{!proxyCounterpartConfirmed \|\| acceptedOffer\}/);
  assert.doesNotMatch(practice, /setProxyDecision/);
  assert.doesNotMatch(practice, /writeStopReason/);
  assert.match(measures, /both confirm the final agreement/);
});

test("practice uses a neutral send rehearsal without changing the Proxy confirmation", () => {
  assert.match(practice, /const PRACTICE_DRAFT = "Hi, I'm ready to start\.";/);
  assert.doesNotMatch(practice, /opening thought|What matters most on your side\?|Thanks for the proposal/);
  assert.match(practice, /Press the button to begin Task \$\{taskIndex\}\./);
  assert.doesNotMatch(practice, /Press the button to begin Task 1\./);
  assert.match(
    practice,
    /const PROXY_CONFIRM_DRAFT =\s*\n\s*"The two terms shown above work for me\. Do you confirm the same agreement\?";/,
  );
});

test("task brief illustrations use the Ver.2.27 asset set and native issue captions", () => {
  for (const filename of [
    "design227-task-a.png",
    "design227-task-a-leader.png",
    "design227-task-a-member.png",
    "design227-task-b.png",
    "design227-task-b-leader.png",
    "design227-task-b-member.png",
  ]) assert.match(illustrations, new RegExp(filename.replace(".", "\\.")));
  assert.equal((illustrations.match(/design227-[^\"]+\?v=20260910/g) ?? []).length, 6);
  assert.match(shared, /Issue 1 · Office days per week/);
  assert.match(shared, /Issue 2 · Member-written weekly client reports/);
});
