/**
 * Single source of truth for all numeric formatting in the app.
 * Wraps the existing Indian-numbering helpers in `lib/utils`.
 */
export { formatIndian, formatCurrencyINR, formatCurrencyCompact } from "@/lib/utils";
import { formatCurrencyINR } from "@/lib/utils";

/** Format USD with Indian grouping (default 2 decimals). */
export const formatUSD = (value: number, decimals = 2) =>
  formatCurrencyINR(value, "$", decimals);

/** Format INR with Indian grouping (default 0 decimals). */
export const formatINR = (value: number, decimals = 0) =>
  formatCurrencyINR(value, "₹", decimals);

/** Signed USD — explicit + on positives. Useful for P&L deltas. */
export const formatSignedUSD = (value: number, decimals = 2) =>
  (value >= 0 ? "+" : "") + formatUSD(value, decimals);

/** Format a percentage with fixed decimals. */
export const formatPercent = (value: number, decimals = 1) =>
  `${value.toFixed(decimals)}%`;
