/**
 * Module hooks behind `ts-register.mjs`: resolve extensionless relative
 * imports to their `.ts` files, and transpile `.ts` on load.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    // The TS sources import each other without extensions ("./types"), which
    // Node's ESM resolver rejects. Retry with `.ts` before giving up.
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL
    ) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    throw error;
  }
}

export async function load(url, context, next) {
  if (url.endsWith(".ts")) {
    const source = await readFile(new URL(url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        verbatimModuleSyntax: false,
      },
      fileName: fileURLToPath(url),
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
  return next(url, context);
}
