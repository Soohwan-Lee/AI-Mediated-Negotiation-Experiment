import { test } from "node:test";
import assert from "node:assert/strict";

const {
  COMPREHENSION_ANSWERS,
  COMPREHENSION_BLOCK,
  COMPREHENSION_REMEDIATION,
} = await import("../src/lib/measures.ts");

test("COMP2 plainly checks that both people must agree", () => {
  const item = COMPREHENSION_BLOCK.items.find(({ id }) => id === "COMP2");

  assert.equal(item?.kind, "choice");
  assert.equal(
    item?.text,
    "Can either person make the final decision on both working conditions without the other person agreeing?",
  );
  assert.equal(COMPREHENSION_ANSWERS.COMP2, "no");
  assert.equal(
    COMPREHENSION_REMEDIATION.COMP2,
    "Neither person can decide the working conditions alone. Both people must agree on both conditions; otherwise, the default conditions apply.",
  );
});
