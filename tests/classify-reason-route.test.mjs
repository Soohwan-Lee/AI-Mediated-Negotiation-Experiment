import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

class ModelNotConfiguredError extends Error {}

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
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/ai/client": { classifyReason },
    "@/lib/ai/config": { ModelNotConfiguredError },
    "@/lib/tasks": { getTask: (id) => id === "task_a" ? { id } : undefined },
  };
  const require = (specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected dependency: ${specifier}`);
  };
  new Function("require", "module", "exports", "console", outputText)(
    require,
    loadedModule,
    loadedModule.exports,
    { error() {} },
  );
  return loadedModule.exports.POST;
}

function request() {
  return new Request("https://example.test/api/classify-reason", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: "task_a", role: "leader", message: "hello" }),
  });
}

test("ordinary classifier failure is 503 and never returns a none label", async () => {
  const POST = await loadRoute(async () => { throw new Error("provider failed"); });
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
  assert.equal("label" in await response.json(), false);
});

for (const label of ["none", "SB"]) {
  test(`valid ${label} classification remains a successful response`, async () => {
    const POST = await loadRoute(async () => ({ label, confidence: 0.9, stubbed: false }));
    const response = await POST(request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { label, confidence: 0.9, stubbed: false });
  });
}
