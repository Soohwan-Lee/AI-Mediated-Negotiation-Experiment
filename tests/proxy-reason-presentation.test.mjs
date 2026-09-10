import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PROXY_WORK_BENEFITS,
  cardOfLayer,
  getTask,
  scorePackage,
} = await import("../src/lib/tasks.ts");
const { formatProxyReasonBubbles, renderProxyReason } = await import(
  "../src/lib/proxy-reason-presentation.ts"
);
const { scriptedTask } = await import("../src/lib/negotiation/script.ts");

const TASKS = ["task_a", "task_b"];
const ROLES = ["leader", "member"];
const POLICIES = ["user_specified", "ai_supplemented"];
const TRANSITION = "In addition, considering the work arrangements,";
const other = (role) => (role === "leader" ? "member" : "leader");

function count(text, needle) {
  return text.split(needle).length - 1;
}

test("the renderer keeps the authorized reason identical and adds exactly two approved work benefits", () => {
  for (const taskId of TASKS) {
    const task = getTask(taskId);
    for (const role of ROLES) {
      for (const layer of ["work", "sensitive"]) {
        const card = cardOfLayer(task, role, layer);
        const specified = renderProxyReason(
          task,
          role,
          card,
          "user_specified",
        );
        const supplemented = renderProxyReason(
          task,
          role,
          card,
          "ai_supplemented",
        );

        assert.equal(supplemented.base, specified.base);
        assert.ok(specified.base.includes(card.relayed));
        assert.match(specified.base, /Based on the circumstances provided,/);
        assert.doesNotMatch(specified.base, /\bI think\b/i);
        assert.equal(specified.addition, null);
        assert.equal(specified.text, specified.base);

        assert.equal(supplemented.addition.transition, TRANSITION);
        assert.deepEqual(
          supplemented.addition.benefits,
          PROXY_WORK_BENEFITS[taskId][role],
        );
        assert.equal(supplemented.addition.benefits.length, 2);
        for (const benefit of supplemented.addition.benefits) {
          assert.ok(supplemented.text.includes(benefit));
          assert.match(benefit, /\b(?:could|may help)\b/i);
        }
        assert.equal(count(supplemented.text, TRANSITION), 1);
        assert.ok(supplemented.text.startsWith(`${specified.base} `));
        const formatted = formatProxyReasonBubbles(supplemented);
        assert.equal(formatted.replaceAll(" || ", " "), supplemented.text);
        assert.ok(
          formatted.split(" || ").every((bubble) => bubble.length <= 220),
        );
      }
    }
  }
});

test("all task, role, policy and SB cells preserve the disclosure gate and outcomes", () => {
  for (const taskId of TASKS) {
    const task = getTask(taskId);
    for (const role of ROLES) {
      const counterpartRole = other(role);
      for (const sbAuthorized of [false, true]) {
        const layer = sbAuthorized ? "sensitive" : "work";
        const expectedPoints = sbAuthorized ? 3000 : 1000;
        const participantCard = cardOfLayer(task, role, layer);
        const counterpartCard = cardOfLayer(task, counterpartRole, layer);
        const participantSb = cardOfLayer(task, role, "sensitive");
        const counterpartSb = cardOfLayer(task, counterpartRole, "sensitive");
        const scripts = Object.fromEntries(
          POLICIES.map((policy) => [
            policy,
            scriptedTask(task, role, policy, sbAuthorized),
          ]),
        );

        assert.deepEqual(
          scripts.user_specified.messages.map(({ stage, speaker }) => ({ stage, speaker })),
          scripts.ai_supplemented.messages.map(({ stage, speaker }) => ({ stage, speaker })),
        );
        assert.deepEqual(
          scripts.user_specified.tentative,
          scripts.ai_supplemented.tentative,
        );

        for (const policy of POLICIES) {
          const script = scripts[policy];
          assert.equal(scorePackage(task, script.tentative, role), expectedPoints);
          assert.equal(
            scorePackage(task, script.tentative, counterpartRole),
            expectedPoints,
          );

          const participantReason = script.messages.find(
            (message) =>
              message.speaker === "participant_proxy" &&
              message.reasonCardId === participantCard.id,
          );
          const counterpartReason = script.messages.find(
            (message) =>
              message.speaker === "counterpart_proxy" &&
              message.reasonCardId === counterpartCard.id,
          );
          assert.ok(participantReason);
          assert.ok(counterpartReason);

          for (const [speaker, message, speakerRole, card] of [
            ["participant_proxy", participantReason, role, participantCard],
            ["counterpart_proxy", counterpartReason, counterpartRole, counterpartCard],
          ]) {
            const rendered = renderProxyReason(task, speakerRole, card, policy);
            assert.ok(message.text.replaceAll(" || ", " ").includes(rendered.base));
            const speakerText = script.messages
              .filter((candidate) => candidate.speaker === speaker)
              .map((candidate) => candidate.text)
              .join(" ");
            assert.equal(
              count(speakerText, TRANSITION),
              policy === "ai_supplemented" ? 1 : 0,
            );
            assert.equal(
              message.internalProvenance,
              policy === "ai_supplemented"
                ? "principal_reason_with_ai_work_benefits"
                : "principal_reason",
            );
          }

          const transcript = script.messages
            .map((message) => message.text)
            .join(" ")
            .replaceAll(" || ", " ");
          if (sbAuthorized) {
            assert.ok(transcript.includes(participantSb.relayed));
            assert.ok(transcript.includes(counterpartSb.relayed));
          } else {
            assert.ok(!transcript.includes(participantSb.relayed));
            assert.ok(!transcript.includes(counterpartSb.relayed));
            assert.ok(
              !script.messages.some(
                (message) =>
                  message.reasonCardId === participantSb.id ||
                  message.reasonCardId === counterpartSb.id,
              ),
            );
          }
        }
      }
    }
  }
});
