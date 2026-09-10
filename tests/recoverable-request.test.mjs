import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchJsonWithRetry,
  nextCountdownValue,
  waitForDelay,
  RECOVERABLE_REQUEST_ATTEMPTS,
  RECOVERABLE_REQUEST_TIMEOUT_MS,
} from "../src/lib/negotiation/recoverable-request.ts";

test("the browser timeout outlives the server function without becoming unbounded", () => {
  assert.ok(
    RECOVERABLE_REQUEST_TIMEOUT_MS > 60_000,
    "the browser must not preempt the 60-second model route",
  );
  assert.ok(
    RECOVERABLE_REQUEST_TIMEOUT_MS <= 65_000,
    "one failed attempt must still have a bounded deadline",
  );
});

test("superseding a typing delay releases the serialized next turn immediately", async () => {
  const controller = new AbortController();
  const started = Date.now();
  const waiting = waitForDelay(10_000, controller.signal);
  controller.abort();
  await assert.rejects(waiting, { name: "AbortError" });
  assert.ok(Date.now() - started < 1000);
});

test("an already-aborted delay cannot hold the next turn", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(waitForDelay(10_000, controller.signal), { name: "AbortError" });
});

test("a recoverable request stops after three attempts", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("{}", { status: 503 });
  };
  try {
    await assert.rejects(
      fetchJsonWithRetry("https://example.test", {}, { backoffMs: 0 }),
    );
    assert.equal(calls, RECOVERABLE_REQUEST_ATTEMPTS);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a recoverable request returns the successful retry", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const bodies = [];
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    bodies.push(init?.body);
    return calls < 3
      ? new Response("{}", { status: 503 })
      : Response.json({ label: "SB" });
  };
  try {
    const result = await fetchJsonWithRetry(
      "https://example.test",
      {},
      {
        backoffMs: 0,
        validate: (value) =>
          typeof value === "object" && value !== null && "label" in value,
      },
    );
    assert.deepEqual(result, { label: "SB" });
    assert.equal(calls, 3);
    assert.deepEqual(new Set(bodies).size, 1, "every attempt must replay one immutable body");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a paused countdown holds and then resumes from the same second", () => {
  const paused = nextCountdownValue(17, true, true);
  assert.equal(paused, 17);
  assert.equal(nextCountdownValue(paused, true, false), 16);
});

test("an invalid successful payload is retried and never accepted", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ label: "unexpected" });
  };
  try {
    await assert.rejects(
      fetchJsonWithRetry("https://example.test", {}, {
        backoffMs: 0,
        validate: (value) =>
          typeof value === "object" && value !== null &&
          "label" in value && value.label === "SB",
      }),
      /incomplete/i,
    );
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an outer abort cancels the active request without another attempt", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    return await new Promise((_resolve, reject) => {
      init.signal.addEventListener(
        "abort",
        () => reject(new DOMException("aborted", "AbortError")),
        { once: true },
      );
    });
  };
  try {
    const pending = fetchJsonWithRetry("https://example.test", {}, {
      signal: controller.signal,
      timeoutMs: 1_000,
      backoffMs: 0,
    });
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("each hanging attempt is cut off by the request timeout", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    return await new Promise((_resolve, reject) => {
      init.signal.addEventListener(
        "abort",
        () => reject(new DOMException("timed out", "AbortError")),
        { once: true },
      );
    });
  };
  try {
    const startedAt = Date.now();
    await assert.rejects(
      fetchJsonWithRetry("https://example.test", {}, {
        timeoutMs: 5,
        backoffMs: 0,
      }),
    );
    assert.equal(calls, 3);
    assert.ok(Date.now() - startedAt < 500, "timeout budget must remain bounded");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
