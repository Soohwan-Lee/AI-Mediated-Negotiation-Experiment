/**
 * The guard that stops a misconfigured deployment collecting worthless data.
 *
 * WHAT IT IS PROTECTING AGAINST. With no `OPENAI_API_KEY`, `generateAction`
 * returns a canned "[SCAFFOLD] No model configured…" action and every route
 * still answers 200. The negotiation then runs to a coded outcome and the
 * questionnaire records judgements about a counterpart that never spoke —
 * with nothing in the UI, the transcript or the export marking the session as
 * void. The run LOOKS successful, which is what makes it the worst class of
 * bug in this repo.
 *
 * `npm run simulate` structurally cannot catch it: it reads `.env.local`
 * directly, so it is always configured. These tests are the only automated
 * check, and they are matrix tests because the rule has two independent
 * inputs and a deliberate asymmetry between them.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getApiKey,
  isLiveStudy,
  modelReadiness,
  ModelNotConfiguredError,
} from "../src/lib/ai/config.ts";

/** Run `fn` with a patched env, restoring whatever was there before. */
function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const NO_KEY = { OPENAI_API_KEY: undefined };
const KEY = { OPENAI_API_KEY: "sk-test-not-a-real-key" };
const DEV_OFF = { NEXT_PUBLIC_DEV_TOOLS: "off" };
const DEV_ON = { NEXT_PUBLIC_DEV_TOOLS: undefined };
const PROD = { VERCEL_ENV: "production" };
const NOT_PROD = { VERCEL_ENV: undefined };

test("a blank key counts as absent, not as a configured empty string", () => {
  // This is how it actually goes wrong: the variable is left in the dashboard
  // (or in .env.local) with its value deleted. A plain null check passes it
  // through and the failure moves to the API call, far from the cause.
  withEnv({ OPENAI_API_KEY: "" }, () => assert.equal(getApiKey(), null));
  withEnv({ OPENAI_API_KEY: "   " }, () => assert.equal(getApiKey(), null));
  withEnv({ OPENAI_API_KEY: "  sk-x  " }, () =>
    assert.equal(getApiKey(), "sk-x"),
  );
});

test("either signal alone marks the study live", () => {
  withEnv({ ...DEV_OFF, ...NOT_PROD }, () => assert.equal(isLiveStudy(), true));
  withEnv({ ...DEV_ON, ...PROD }, () => assert.equal(isLiveStudy(), true));
  withEnv({ ...DEV_OFF, ...PROD }, () => assert.equal(isLiveStudy(), true));
  withEnv({ ...DEV_ON, ...NOT_PROD }, () => assert.equal(isLiveStudy(), false));
});

test("the readiness matrix: refuse only where a participant could be reading", () => {
  // Configured — always ready, live or not.
  withEnv({ ...KEY, ...DEV_OFF, ...PROD }, () =>
    assert.equal(modelReadiness().ready, true),
  );
  withEnv({ ...KEY, ...DEV_ON, ...NOT_PROD }, () =>
    assert.equal(modelReadiness().ready, true),
  );

  // THE SCAFFOLD SURVIVES LOCALLY. Walking the whole flow without credentials
  // is what it is for, and taking that away would be a real cost with no
  // matching benefit — no participant can reach a dev build.
  withEnv({ ...NO_KEY, ...DEV_ON, ...NOT_PROD }, () => {
    const r = modelReadiness();
    assert.equal(r.ready, true);
    assert.equal(r.keyConfigured, false);
    assert.equal(r.reason, null);
  });

  // Unconfigured AND live, by either signal — refuse, with a stated reason.
  for (const live of [
    { ...DEV_OFF, ...NOT_PROD },
    { ...DEV_ON, ...PROD },
  ]) {
    withEnv({ ...NO_KEY, ...live }, () => {
      const r = modelReadiness();
      assert.equal(r.ready, false, "must refuse an unconfigured live study");
      assert.equal(r.live, true);
      assert.match(r.reason ?? "", /OPENAI_API_KEY/);
    });
  }
});

test("the readiness reason never contains the key itself", () => {
  // A reason string is printed to logs and returned by /api/preflight. It
  // reports PRESENCE only — a masked key still leaks its length and tail.
  withEnv({ OPENAI_API_KEY: "sk-super-secret-value", ...DEV_OFF }, () => {
    const r = modelReadiness();
    assert.equal(r.reason, null);
    assert.equal(JSON.stringify(r).includes("super-secret"), false);
  });
});

test("the config error is its own class, so routes can tell it apart", () => {
  // `/api/classify-reason` answers an ordinary model failure with
  // `{label:"none"}` on purpose — the tier only rises, so a floor is
  // recoverable. The same answer for a study with NO MODEL AT ALL would floor
  // every message of every session in silence. Same shape, opposite meaning,
  // so they must not share a catch.
  const err = new ModelNotConfiguredError("no model");
  assert.ok(err instanceof Error);
  assert.ok(err instanceof ModelNotConfiguredError);
  assert.equal(err.code, "model_not_configured");
});
