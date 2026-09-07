import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONSENT_INFORMATION_PAGES,
  canBeginConsent,
} from "../src/lib/consent-flow.ts";

test("a study session cannot begin from an information page", () => {
  assert.equal(CONSENT_INFORMATION_PAGES.length, 3);
  assert.equal(canBeginConsent(0, true), false);
  assert.equal(canBeginConsent(1, true), false);
});

test("the final page still requires both consent confirmations", () => {
  const finalPage = CONSENT_INFORMATION_PAGES.length - 1;
  assert.equal(canBeginConsent(finalPage, false), false);
  assert.equal(canBeginConsent(finalPage, true), true);
});
