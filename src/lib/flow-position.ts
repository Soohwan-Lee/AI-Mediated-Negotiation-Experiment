/**
 * How far through the flow this browser has got.
 *
 * Shared by the navigation guard, which bounces arrivals at an earlier step
 * forward, and by the Back control, which has to lower the mark or the guard
 * would immediately undo a deliberate step back.
 */

const FURTHEST_KEY = "amne:furthest";

export function readFurthest(): number {
  if (typeof window === "undefined") return 0;
  const stored = Number(window.localStorage.getItem(FURTHEST_KEY) ?? "0");
  return Number.isFinite(stored) ? stored : 0;
}

export function writeFurthest(index: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FURTHEST_KEY, String(index));
}
