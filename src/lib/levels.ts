/**
 * Single source of truth for trader level milestones.
 * MUST stay in sync with the DB triggers in supabase/migrations.
 */

export interface LevelDef {
  level: number;
  /** Cumulative net profit (USD) required to reach this level. */
  threshold: number;
  /** STO % at this level (milestone-mode). */
  sto: number;
  /** LTO % at this level (milestone-mode). */
  lto: number;
  /** Minimum LTO pool required to release LTO at this level (USD). */
  ltoReleaseThreshold: number | null;
  label: string;
}

export const LEVELS: LevelDef[] = [
  { level: 0, threshold: 0,       sto: 20, lto: 0,  ltoReleaseThreshold: null,    label: "L0" },
  { level: 1, threshold: 50_000,  sto: 25, lto: 10, ltoReleaseThreshold: 10_000,  label: "L1" },
  { level: 2, threshold: 150_000, sto: 35, lto: 15, ltoReleaseThreshold: 25_000,  label: "L2" },
  { level: 3, threshold: 300_000, sto: 45, lto: 20, ltoReleaseThreshold: 50_000,  label: "L3" },
  { level: 4, threshold: 500_000, sto: 55, lto: 25, ltoReleaseThreshold: null,    label: "L4" },
];

/** Level for a given cumulative net profit. */
export function levelForProfit(profit: number): LevelDef {
  let result = LEVELS[0];
  for (const l of LEVELS) if (profit >= l.threshold) result = l;
  return result;
}

/** Next level above the current cumulative profit, or null if maxed. */
export function nextLevel(profit: number): LevelDef | null {
  return LEVELS.find((l) => l.threshold > profit) ?? null;
}

/** Progress (0..1) toward next level. */
export function progressToNext(profit: number): number {
  const cur = levelForProfit(profit);
  const nxt = nextLevel(profit);
  if (!nxt) return 1;
  return Math.max(0, Math.min(1, (profit - cur.threshold) / (nxt.threshold - cur.threshold)));
}

/** Brokerage fee — $14 per 1000 shares. */
export const BROKERAGE_PER_1000_SHARES = 14;

export const calcBrokerage = (shares: number) =>
  (shares / 1000) * BROKERAGE_PER_1000_SHARES;

export const calcNetPnL = (gross: number, shares: number) =>
  gross - calcBrokerage(shares);
