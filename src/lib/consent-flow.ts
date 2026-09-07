/** Ordered information shown before the study may create a participant session. */
export const CONSENT_INFORMATION_PAGES = [
  "Study overview",
  "Privacy and rights",
  "Your consent",
] as const;

/**
 * Consent is valid only on the final information page and after both required
 * confirmations. Keeping this outside the component makes the boundary easy
 * to test independently of browser rendering.
 */
export function canBeginConsent(page: number, confirmationsComplete: boolean) {
  return (
    page === CONSENT_INFORMATION_PAGES.length - 1 && confirmationsComplete
  );
}
