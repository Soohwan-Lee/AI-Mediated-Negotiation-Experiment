/**
 * The P5 route's contract (Ver.2.21 §6.2a).
 *
 * WHAT THESE PIN, and why each is worth a test:
 *
 *  - A FAILED CLASSIFICATION IS NEVER A LABEL. `none` is a real answer — the
 *    participant said nothing with a reason in it — so a route that answered
 *    `none` on a provider error would pin the whole Direct arm at the bottom
 *    rung with nothing in the audit log to show why. Both failure classes must
 *    be non-2xx.
 *  - THE INPUT IS AN ARRAY OF STRINGS. The judgement is cumulative, so the
 *    body carries every message so far; an empty array is not a conversation,
 *    and a non-string entry would interpolate as "[object Object]" into the
 *    prompt the tier is read from.
 *  - COUNTER TERMS ARE RESOLVED SERVER-SIDE, BOTH OR NEITHER. The model
 *    answers in the task's own words. Free text must never become an option
 *    id, and a half-resolved package is dropped rather than completed with a
 *    guess — completing it would be the model deciding a term of the
 *    agreement, which §6.7 forbids.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

class ModelNotConfiguredError extends Error {}

const TASK_A = {
  id: "task_a",
  issues: [
    {
      id: "office_days",
      label: "Days a week in the office",
      options: [
        { id: "od1", label: "4 days" },
        { id: "od2", label: "3 days" },
        { id: "od3", label: "2 days" },
        { id: "od4", label: "1 day" },
      ],
    },
    {
      id: "client_presentations",
      label: "Client meetings the Member presents at",
      options: [
        { id: "cp1", label: "1 of 4" },
        { id: "cp2", label: "2 of 4" },
        { id: "cp3", label: "3 of 4" },
        { id: "cp4", label: "4 of 4" },
      ],
    },
  ],
};

async function loadRoute(classifyReason) {
  const source = await readFile(
    new URL("../src/app/api/classify-reason/route.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const loadedModule = { exports: {} };
  const dependencies = {
    "next/server": {
      NextResponse: { json: (body, init) => Response.json(body, init) },
    },
    "@/lib/ai/client": { classifyReason },
    "@/lib/ai/config": { ModelNotConfiguredError },
    "@/lib/tasks": { getTask: (id) => (id === "task_a" ? TASK_A : undefined) },
  };
  const require = (specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected dependency: ${specifier}`);
  };
  new Function("require", "module", "exports", "console", outputText)(
    require,
    loadedModule,
    loadedModule.exports,
    { error() {}, info() {}, warn() {} },
  );
  return loadedModule.exports.POST;
}

function request(body = {}) {
  return new Request("https://example.test/api/classify-reason", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskId: "task_a",
      role: "leader",
      messages: ["hello"],
      ...body,
    }),
  });
}

/** A complete, valid classifier result, so each test varies one thing. */
function result(overrides = {}) {
  return {
    label: "none",
    priorityClaim: false,
    confidence: 0.9,
    stance: "none",
    counterTerms: {},
    offTopic: false,
    bonusRequest: false,
    ruleRequest: false,
    firstReasonOpportunity: true,
    withdrawalRequest: false,
    stubbed: false,
    ...overrides,
  };
}

test("ordinary classifier failure is 503 and never returns a none label", async () => {
  const POST = await loadRoute(async () => {
    throw new Error("provider failed");
  });
  const response = await POST(request());
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal("label" in body, false);
});

test("missing model configuration is also a recoverable 503", async () => {
  const POST = await loadRoute(async () => {
    throw new ModelNotConfiguredError("missing");
  });
  const response = await POST(request());
  assert.equal(response.status, 503);
  assert.equal("label" in (await response.json()), false);
});

for (const label of ["none", "WR", "SB"]) {
  test(`valid ${label} classification remains a successful response`, async () => {
    const POST = await loadRoute(async () => result({ label }));
    const response = await POST(request());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.label, label);
    assert.equal(body.priority_claim, false);
    assert.equal(body.stance, "none");
    assert.equal(body.stubbed, false);
  });
}

test("the priority_claim flag travels beside the label", async () => {
  const POST = await loadRoute(async () =>
    result({ label: "WR", priorityClaim: true }),
  );
  const body = await (await POST(request())).json();
  assert.equal(body.label, "WR");
  assert.equal(body.priority_claim, true);
});

test("Ver.2.26 safety flags and conditional stance travel intact", async () => {
  const POST = await loadRoute(async () => result({
    stance: "conditional",
    offTopic: true,
    bonusRequest: true,
    ruleRequest: true,
    firstReasonOpportunity: false,
    withdrawalRequest: true,
  }));
  const body = await (await POST(request())).json();
  assert.equal(body.stance, "conditional");
  assert.equal(body.off_topic, true);
  assert.equal(body.bonus_request, true);
  assert.equal(body.rule_request, true);
  assert.equal(body.first_reason_opportunity, false);
  assert.equal(body.withdrawal_request, true);
});

test("an obvious conditional £0.50 demand cannot lose the bonus boundary", async () => {
  const POST = await loadRoute(async () => result({
    stance: "conditional",
    bonusRequest: false,
  }));
  const body = await (
    await POST(request({ messages: ["I agree if you guarantee £0.50."] }))
  ).json();
  assert.equal(body.stance, "conditional");
  assert.equal(body.bonus_request, true);
});

test("every participant message is sent to the classifier, in order", async () => {
  let seen = null;
  const POST = await loadRoute(async ({ ctx }) => {
    seen = ctx.messages;
    return result();
  });
  await POST(request({ messages: ["first", "second", "third"] }));
  assert.deepEqual(seen, ["first", "second", "third"]);
});

for (const [name, messages] of [
  ["an empty array", []],
  ["a non-array", "hello"],
  ["a non-string entry", ["ok", { text: "no" }]],
  ["only blank strings", ["   ", ""]],
]) {
  test(`${name} is a 400, not a classification`, async () => {
    const POST = await loadRoute(async () => {
      throw new Error("must not be called");
    });
    const response = await POST(request({ messages }));
    assert.equal(response.status, 400);
  });
}

test("a counter is resolved from the task's own option labels", async () => {
  const POST = await loadRoute(async () =>
    result({
      stance: "counter",
      counterTerms: {
        "Days a week in the office": "2 days",
        "Client meetings the Member presents at": "1 of 4",
      },
    }),
  );
  const body = await (await POST(request())).json();
  assert.equal(body.stance, "counter");
  assert.deepEqual(body.counter_terms, {
    office_days: "od3",
    client_presentations: "cp1",
  });
});

test("a counter naming only one issue is dropped whole", async () => {
  const POST = await loadRoute(async () =>
    result({
      stance: "counter",
      counterTerms: { "Days a week in the office": "2 days" },
    }),
  );
  const body = await (await POST(request())).json();
  assert.equal(body.stance, "counter");
  assert.equal("counter_terms" in body, false);
});

test("an option the task does not have never becomes an id", async () => {
  const POST = await loadRoute(async () =>
    result({
      stance: "counter",
      counterTerms: {
        "Days a week in the office": "5 days",
        "Client meetings the Member presents at": "1 of 4",
      },
    }),
  );
  const body = await (await POST(request())).json();
  assert.equal("counter_terms" in body, false);
});

test("counter terms are not resolved when the stance is not a counter", async () => {
  const POST = await loadRoute(async () =>
    result({
      stance: "accept",
      counterTerms: {
        "Days a week in the office": "2 days",
        "Client meetings the Member presents at": "1 of 4",
      },
    }),
  );
  const body = await (await POST(request())).json();
  assert.equal(body.stance, "accept");
  assert.equal("counter_terms" in body, false);
});

test("the stub flag survives, because `none` means two things", async () => {
  const POST = await loadRoute(async () => result({ stubbed: true }));
  const body = await (await POST(request())).json();
  assert.equal(body.stubbed, true);
});

test("an unknown role is a 400 rather than a 500", async () => {
  const POST = await loadRoute(async () => result());
  const response = await POST(request({ role: "director" }));
  assert.equal(response.status, 400);
});

test("null and array request bodies are clean 400 responses", async () => {
  const POST = await loadRoute(async () => result());
  for (const body of [null, []]) {
    const response = await POST(new Request("https://example.test/api/classify-reason", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
    assert.equal(response.status, 400);
  }
});
