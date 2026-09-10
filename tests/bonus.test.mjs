import test from "node:test";
import assert from "node:assert/strict";
import { bonusAmountFromPercent, bonusPenceFromPercent } from "../src/lib/bonus.ts";

test("all 101 slider values round to the nearest integer penny", () => {
  for (let percent = 0; percent <= 100; percent++) {
    const expectedPence = Math.floor((percent + 1) / 2);
    assert.equal(bonusPenceFromPercent(percent), expectedPence);
    assert.equal(bonusAmountFromPercent(percent).toFixed(2), (expectedPence / 100).toFixed(2));
  }
  assert.equal(bonusAmountFromPercent(0), 0);
  assert.equal(bonusAmountFromPercent(100), 0.5);
  assert.equal(bonusAmountFromPercent(35), 0.18);
});

test("invalid slider values cannot become a recommendation", () => {
  for (const value of [-1, 101, 0.5, NaN, Infinity]) {
    assert.throws(() => bonusAmountFromPercent(value), RangeError);
  }
});
