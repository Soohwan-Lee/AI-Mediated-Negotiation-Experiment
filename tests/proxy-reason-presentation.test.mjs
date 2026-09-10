import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PROXY_WORK_BENEFITS,
  cardOfLayer,
  getTask,
  scorePackage,
} = await import("../src/lib/tasks.ts");
const { ADDITION_TRANSITION, PROXY_REASON_BASES, formatProxyReasonBubbles, renderProxyReason } = await import(
  "../src/lib/proxy-reason-presentation.ts"
);
const { scriptedTask } = await import("../src/lib/negotiation/script.ts");

const TASKS = ["task_a", "task_b"];
const ROLES = ["leader", "member"];
const POLICIES = ["user_specified", "ai_supplemented"];
const TRANSITION = ADDITION_TRANSITION;
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
        assert.equal(specified.base, PROXY_REASON_BASES[taskId][role][layer]);
        assert.notEqual(specified.base, card.relayed);
        assert.doesNotMatch(specified.base, /They say|I represent|they told me/);
        assert.doesNotMatch(specified.base, /\bI think\b/i);
        assert.equal(specified.addition, null);
        assert.equal(specified.text, specified.base);

        assert.equal(supplemented.addition.transition, TRANSITION);
        assert.deepEqual(
          supplemented.addition.benefits,
          [PROXY_WORK_BENEFITS[taskId][role].wr1,
            PROXY_WORK_BENEFITS[taskId][role][layer === "sensitive" ? "sb1" : "wr2"]],
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
            assert.ok(transcript.includes(PROXY_REASON_BASES[taskId][role].sensitive));
            assert.ok(transcript.includes(PROXY_REASON_BASES[taskId][counterpartRole].sensitive));
          } else {
            assert.ok(!transcript.includes(PROXY_REASON_BASES[taskId][role].sensitive));
            assert.ok(!transcript.includes(PROXY_REASON_BASES[taskId][counterpartRole].sensitive));
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

test("WR-only uses two balanced arguments; SB replaces only the second argument", () => {
  for (const taskId of TASKS) {
    const task = getTask(taskId);
    for (const role of ROLES) {
      const approved = PROXY_WORK_BENEFITS[taskId][role];
      const wr = renderProxyReason(task, role, cardOfLayer(task, role, "work"), "ai_supplemented");
      const sb = renderProxyReason(task, role, cardOfLayer(task, role, "sensitive"), "ai_supplemented");
      assert.deepEqual(Object.keys(approved).sort(), ["sb1", "wr1", "wr2"]);
      assert.equal(new Set(Object.values(approved)).size, 3);
      assert.deepEqual(wr.addition.benefits, [approved.wr1, approved.wr2]);
      assert.deepEqual(sb.addition.benefits, [approved.wr1, approved.sb1]);
      assert.ok(!wr.text.includes(approved.sb1));
      assert.ok(!sb.text.includes(approved.wr2));
      for (const side of ROLES) {
        assert.ok(!wr.text.includes(PROXY_WORK_BENEFITS[taskId][side].sb1));
      }
      assert.doesNotMatch(wr.text, /director|privately|not (?:been told|passed)|mistaken|client contact|report was lacking/i);
    }
  }
});

test("SB-related arguments explicitly support the role's focal request", () => {
  const priorities = {
    task_a: {
      leader: /more days together in the office/,
      member: /Leader handle more presentations.*Member's need to switch between analysis and presentation preparation/,
    },
    task_b: {
      leader: /Member on the project more days/,
      member: /Leader prepare more weekly reports.*Member's report-checking time/,
    },
  };
  for (const taskId of TASKS) for (const role of ROLES) {
    assert.match(PROXY_WORK_BENEFITS[taskId][role].sb1, priorities[taskId][role]);
  }
});

const FACT_ANCHORS = {
  task_a: {
    leader: {
      work: [/client expectations/i, /first few weeks/i, /coordination/i, /presentations/i, /office attendance/i],
      sensitive: [/Leader made to the director before consulting the team/, /four office days a week/, /director has already reported this upward/, /team has not been told/],
    },
    member: {
      work: [/broad analysis workload this quarter/, /Commuting and meetings on office days reduce analysis time/, /preparation takes several days/],
      sensitive: [/after the last presentation/, /client contact told the Member privately/, /would prefer the Leader to present in future/, /Member has not passed this request on to the Leader/],
    },
  },
  task_b: {
    leader: {
      work: [/first four weeks/i, /Staffing keeps early work moving/, /client reporting builds trust/, /Both project days and reporting duties/],
      sensitive: [/Leader's mistaken staffing estimate/, /submitted plan/, /Member working four days a week/, /requesting more staff would reveal the error to the director/, /team has not been told/],
    },
    member: {
      work: [/Two of the Member's current projects/, /overlapping deadlines this month/, /would delay existing work/, /each weekly report takes separate preparation time/],
      sensitive: [/last month's report/, /client contact directly told the Member/, /report was lacking/, /Leader to prepare future reports/, /Member has not passed this feedback on to the Leader/],
    },
  },
};

for (const taskId of TASKS) for (const role of ROLES) for (const layer of ["work", "sensitive"]) {
  test(`${taskId}/${role}/${layer}: shared reframing preserves the event facts`, () => {
    const task = getTask(taskId);
    for (const policy of POLICIES) {
      const result = renderProxyReason(task, role, cardOfLayer(task, role, layer), policy);
      for (const anchor of FACT_ANCHORS[taskId][role][layer]) assert.match(result.base, anchor);
    }
  });
}

test("the renderer rejects a card from another role or task", () => {
  const task = getTask("task_a");
  assert.throws(() => renderProxyReason(task, "member", cardOfLayer(task, "leader", "sensitive"), "ai_supplemented"));
  assert.throws(() => renderProxyReason(task, "member", cardOfLayer(getTask("task_b"), "member", "work"), "ai_supplemented"));
});
