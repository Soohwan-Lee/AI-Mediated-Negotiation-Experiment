import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { fetchJsonWithRetry } from "../src/lib/negotiation/recoverable-request.ts";

const proxySource = readFileSync(
  new URL("../src/app/task/[index]/proxy-task.tsx", import.meta.url),
  "utf8",
);

const validTurn = {
  message: { id: "m1", speaker: "participant_proxy", text: "A reply." },
  done: false,
};

test("one failed Proxy attempt retries the same turn and commits one reply after the prefix", async () => {
  const originalFetch = globalThis.fetch;
  const prefix = [
    { id: "m0", speaker: "counterpart_proxy", text: "The opening." },
  ];
  const collected = [...prefix];
  const bodies = [];
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    bodies.push(init?.body);
    return calls === 1
      ? new Response("{}", { status: 503 })
      : Response.json(validTurn);
  };

  try {
    const body = JSON.stringify({
      turn: 1,
      history: collected.map(({ speaker, text }) => ({ speaker, text })),
    });
    const reply = await fetchJsonWithRetry(
      "/api/proxy-negotiation",
      { method: "POST", body },
      {
        backoffMs: 0,
        validate: (value) =>
          typeof value === "object" &&
          value !== null &&
          "message" in value &&
          value.message?.text === "A reply.",
      },
    );
    collected.push(reply.message);

    assert.equal(calls, 2);
    assert.deepEqual(bodies, [body, body]);
    assert.deepEqual(collected.map((message) => message.id), ["m0", "m1"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("exhausted Proxy retries preserve the committed prefix and cannot restart authorization", async () => {
  const originalFetch = globalThis.fetch;
  const collected = [
    { id: "m0", speaker: "counterpart_proxy", text: "The opening." },
  ];
  globalThis.fetch = async () => new Response("{}", { status: 503 });
  try {
    await assert.rejects(
      fetchJsonWithRetry(
        "/api/proxy-negotiation",
        { method: "POST", body: "{}" },
        { backoffMs: 0 },
      ),
    );
    assert.deepEqual(collected.map((message) => message.id), ["m0"]);
    assert.doesNotMatch(proxySource, /catch[\s\S]{0,800}setPhase\("confirm"\)/);
    assert.match(proxySource, /The proxy exchange ended because of a technical problem/);
    assert.match(proxySource, /markTaskInterrupted\(participantKey, taskIndex\)/);
    assert.match(proxySource, /router\.replace\("\/study-stop\?reason=technical"\)/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Emergency Stop aborts the pending request and the reply has no commit path", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  const collected = [
    { id: "m0", speaker: "counterpart_proxy", text: "The opening." },
  ];
  globalThis.fetch = async (_input, init) =>
    await new Promise((_resolve, reject) => {
      init.signal.addEventListener(
        "abort",
        () => reject(new DOMException("aborted", "AbortError")),
        { once: true },
      );
    });
  try {
    const pending = fetchJsonWithRetry(
      "/api/proxy-negotiation",
      { method: "POST", body: "{}" },
      { signal: controller.signal, backoffMs: 0 },
    );
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.deepEqual(collected.map((message) => message.id), ["m0"]);
    assert.match(
      proxySource,
      /if \(!isCurrent\(\) \|\| stopped\.current\) break;[\s\S]{0,500}if \(data\.impasse\)/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unmount aborts the active Proxy run and invalidates its generation", () => {
  assert.match(proxySource, /runGeneration\.current \+= 1;/);
  assert.match(proxySource, /activeRun\.current\?\.abort\(\);/);
  assert.match(
    proxySource,
    /if \(!mounted\.current \|\| runGeneration\.current !== generation\) return;/,
  );
  const mockAbortBoundary = proxySource.slice(
    proxySource.indexOf("if (!controller.signal.aborted) {"),
    proxySource.indexOf("const played ="),
  );
  assert.match(
    mockAbortBoundary,
    /if \(!mounted\.current \|\| runGeneration\.current !== generation\) return;/,
  );
});

test("normal review completion advances only after the completed marker is confirmed", () => {
  assert.match(
    proxySource,
    /const run = markTaskCompleted\(participantKey, taskIndex\);[\s\S]{0,250}if \(run\?\.status !== "completed"\)[\s\S]{0,250}router\.replace\("\/study-stop\?reason=technical"\);/,
  );
});
