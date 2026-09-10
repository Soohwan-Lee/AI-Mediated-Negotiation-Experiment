import { STUDY } from "./study-config";

const MAX_BONUS_PENCE = Math.round(Number(STUDY.bonusPerTask) * 100);

/** Round once in integer pence, identically for the displayed and saved amount. */
export function bonusPenceFromPercent(percent: number): number {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new RangeError("Bonus percentage must be an integer from 0 to 100");
  }
  return Math.round(percent * MAX_BONUS_PENCE / 100);
}

export function bonusAmountFromPercent(percent: number): number {
  return bonusPenceFromPercent(percent) / 100;
}
