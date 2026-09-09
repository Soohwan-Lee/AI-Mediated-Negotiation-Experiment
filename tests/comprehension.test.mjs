import { test } from "node:test";
import assert from "node:assert/strict";

const {
  COMPREHENSION_ANSWERS,
  COMPREHENSION_BLOCK,
  COMPREHENSION_REMEDIATION,
} = await import("../src/lib/measures.ts");

test("IC2 plainly checks that both people must agree", () => {
  const item = COMPREHENSION_BLOCK.items.find(({ id }) => id === "IC2");

  assert.equal(item?.kind, "choice");
  assert.equal(
    item?.text,
    "Can either side fix both terms alone?",
  );
  assert.equal(COMPREHENSION_ANSWERS.IC2, "no");
  assert.equal(
    COMPREHENSION_REMEDIATION.IC2,
    "Neither side can decide both terms alone. Both sides must agree.",
  );
});
