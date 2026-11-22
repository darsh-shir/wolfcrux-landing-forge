/**
 * Trader levels now live in the shared payout engine (src/lib/payoutEngine.ts).
 * This file only re-exports them so older imports keep working.
 */
export {
  DEFAULT_LEVELS as LEVELS,
  levelFor,
  nextLevelAfter,
  shareCost as calcBrokerage,
  SHARE_COST_PER_1000 as BROKERAGE_PER_1000_SHARES,
  type LevelDef,
} from "@/lib/payoutEngine";
