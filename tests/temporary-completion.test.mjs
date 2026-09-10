import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { STUDY, completionSettings } from "../src/lib/study-config.ts";

async function route(name, { code = "TESTONLY", model = true, storage = true, timing = true, complete = true } = {}) {
  const source = await readFile(new URL(`../src/app/api/${name}/route.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  const deps = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/ai/config": { AI_CONFIG: { apiKeyEnvVar: "OPENAI_API_KEY" }, modelReadiness: () => ({ ready: model, live: true, keyConfigured: model }) },
    "@/lib/study-config": { STUDY: { ...STUDY, prolificCompletionCode: code }, completionSettings: () => completionSettings(code), timingIsHonest: () => timing, TOTAL_MINUTES: 45 },
    "@/lib/server/study-db": {
      storageReady: async () => storage, readBody: async () => ({}), participantFor: async () => ({ participant_key: "fixture" }),
      database: async () => { if (!complete) throw new Error("incomplete"); return { status: "completed" }; },
      failure: () => Response.json({ error: "incomplete" }, { status: 409 }), StudyError: Error,
    },
  };
  new Function("require", "module", "exports", compiled)(key => { assert.ok(deps[key], key); return deps[key]; }, loaded, loaded.exports);
  return loaded.exports;
}

test("temporary code permits entry only with every other production guard", async () => {
  const old = process.env.NEXT_PUBLIC_DEV_TOOLS;
  try {
    process.env.NEXT_PUBLIC_DEV_TOOLS = "off";
    for (const [options, expected] of [[{}, 200], [{ model: false }, 503], [{ storage: false }, 503], [{ timing: false }, 503], [{ code: "TBD-X" }, 503]]) {
      const { GET } = await route("preflight", options);
      assert.equal((await GET(new Request("https://fixture/api/preflight?gate=1"))).status, expected);
    }
    process.env.NEXT_PUBLIC_DEV_TOOLS = "on";
    const { GET } = await route("preflight");
    assert.equal((await GET(new Request("https://fixture/api/preflight?gate=1"))).status, 503);
  } finally { if (old === undefined) delete process.env.NEXT_PUBLIC_DEV_TOOLS; else process.env.NEXT_PUBLIC_DEV_TOOLS = old; }
});

test("authorized detailed preflight never calls TESTONLY recruitment-ready", async () => {
  const old = process.env.PREFLIGHT_TOKEN;
  try {
    process.env.PREFLIGHT_TOKEN = "fixture-token";
    const { GET } = await route("preflight");
    const response = await GET(new Request("https://fixture/api/preflight?token=fixture-token"));
    const body = await response.json();
    assert.equal(body.ready, false);
    const check = body.checks.find(c => c.name === "completion_code_set");
    assert.equal(check.pass, false); assert.match(check.detail, /dry run, not recruitment/);
  } finally { if (old === undefined) delete process.env.PREFLIGHT_TOKEN; else process.env.PREFLIGHT_TOKEN = old; }
});

test("temporary finalization still requires saved completion and exposes no Prolific URL or code", async () => {
  const request = () => new Request("https://fixture/api/complete", { method: "POST" });
  const blocked = await route("complete", { complete: false });
  assert.equal((await blocked.POST(request())).status, 409);
  const temporary = await route("complete");
  const result = await (await temporary.POST(request())).json();
  assert.equal(result.complete, true); assert.equal(result.testOnly, true);
  assert.equal(result.completionUrl, null); assert.equal(result.completionCode, null);
  const real = await route("complete", { code: "ABC12345" });
  const live = await (await real.POST(request())).json();
  assert.equal(live.testOnly, false); assert.equal(live.completionCode, "ABC12345");
  assert.equal(live.completionUrl, "https://app.prolific.com/submissions/complete?cc=ABC12345");
});

test("completion UI isolates test confirmation from payment and copy controls", async () => {
  const source = await readFile(new URL("../src/app/complete/page.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(completion.testOnly\) return;/);
  assert.match(source, /completion.testOnly \? \([\s\S]*Test complete[\s\S]*does not register a Prolific submission or payment[\s\S]*\) : <>[\s\S]*Copy Code[\s\S]*Return to Prolific/);
  assert.equal(completionSettings("TESTONLY").submissionUrl, null);
});
