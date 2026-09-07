import { test } from "node:test";
import assert from "node:assert/strict";

const { comparePointsToFallback } = await import("../src/lib/points-display.ts");

test("fallback comparison distinguishes equality from above and below", () => {
  assert.equal(comparePointsToFallback(601, 600), "above");
  assert.equal(comparePointsToFallback(600, 600), "equal");
  assert.equal(comparePointsToFallback(599, 600), "below");
});
