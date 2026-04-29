// ==========================================
// Core Payout Calculation Engine for Wolfcrux
// ==========================================

export interface MilestoneLevel {
  level: number;
  label: string;
  stoPercent: number;
  ltoPercent: number;
  daysRequired: number;        // trading days as primary trader
  profitRequired: number;      // cumulative net profit threshold
}

export const MILESTONES: MilestoneLevel[] = [
  { level: 0, label: "Junior Equity Analyst",  stoPercent: 20, ltoPercent: 0,  daysRequired: 0,   profitRequired: 0 },
  { level: 1, label: "Equity Analyst",         stoPercent: 25, ltoPercent: 10, daysRequired: 125, profitRequired: 50000 },
  { level: 2, label: "Senior Equity Analyst",  stoPercent: 35, ltoPercent: 15, daysRequired: 275, profitRequired: 150000 },
  { level: 3, label: "Lead Equity Analyst",    stoPercent: 45, ltoPercent: 20, daysRequired: 400, profitRequired: 300000 },
  { level: 4, label: "Chief Equity Analyst",   stoPercent: 55, ltoPercent: 25, daysRequired: 600, profitRequired: 500000 },
];

export interface LeaveBalanceSummary {
  fullDaysUsed: number;
  halfDaysUsed: number;
  lateCount: number;
  lateConverted: number;
  totalUsed: number;
  carryIn: number;
  monthlyAllowance: number;
  monthPending: number;
  totalAvailable: number;
  endBalanceRaw: number;
  balance: number;
  excess: number;
  deductionPercent: number;
}

/**
 * Determine milestone level based on trading days and cumulative profit.
 * Whichever milestone is reached first (days OR profit) applies.
 */
export function getMilestoneLevel(
  tradingDays: number,
  cumulativeNetProfit: number
): MilestoneLevel {
  let currentLevel = MILESTONES[0];
  for (let i = MILESTONES.length - 1; i >= 1; i--) {
    const m = MILESTONES[i];
    if (tradingDays >= m.daysRequired || cumulativeNetProfit >= m.profitRequired) {
      currentLevel = m;
      break;
    }
  }
  return currentLevel;
}

/**
 * Get the next milestone target (or null if at max level).
 */
export function getNextMilestone(currentLevel: number): MilestoneLevel | null {
  const nextIdx = currentLevel + 1;
  return nextIdx < MILESTONES.length ? MILESTONES[nextIdx] : null;
}

/**
 * Calculate share cost: $14 per 1000 shares traded.
 */
export function calculateShareCost(sharesTraded: number): number {
  return (sharesTraded / 1000) * 14;
}

export function getLeaveBalanceSummary(
  attendanceRecords: Array<{ record_date: string; status: string }>,
  selectedMonth: number,
  selectedYear: number,
  previousYearCarryForward: number = 0
): LeaveBalanceSummary {
  if (selectedYear < 2026 || selectedMonth < 1 || selectedMonth > 12) {
    return {
      fullDaysUsed: 0,
      halfDaysUsed: 0,
      lateCount: 0,
      lateConverted: 0,
      totalUsed: 0,
      carryIn: 0,
      monthlyAllowance: 0,
      monthPending: 0,
      totalAvailable: 0,
      endBalanceRaw: 0,
      balance: 0,
      excess: 0,
      deductionPercent: 0,
    };
  }

  let runningCarry = previousYearCarryForward;
  let selectedSummary: LeaveBalanceSummary = {
    fullDaysUsed: 0,
    halfDaysUsed: 0,
    lateCount: 0,
    lateConverted: 0,
    totalUsed: 0,
    carryIn: previousYearCarryForward,
    monthlyAllowance: 1.5,
    monthPending: 1.5,
    totalAvailable: previousYearCarryForward + 1.5,
    endBalanceRaw: previousYearCarryForward + 1.5,
    balance: Math.max(0, previousYearCarryForward + 1.5),
    excess: Math.max(0, -(previousYearCarryForward + 1.5)),
    deductionPercent: 0,
  };

  for (let m = 1; m <= selectedMonth; m++) {
    const monthRecords = attendanceRecords.filter((r) => {
      const d = new Date(r.record_date);
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === m;
    });

    const fullDaysUsed = monthRecords.filter((r) => r.status === "absent").length;
    const halfDaysUsed = monthRecords.filter((r) => r.status === "half_day").length;
    const lateCount = monthRecords.filter((r) => r.status === "late").length;
    const lateConverted = Math.floor(lateCount / 3) * 0.5;
    const totalUsed = fullDaysUsed + halfDaysUsed * 0.5 + lateConverted;
    const carryIn = runningCarry;
    const monthlyAllowance = 1.5;
    const monthPending = monthlyAllowance - totalUsed;
    const totalAvailable = carryIn + monthlyAllowance;
    const endBalanceRaw = carryIn + monthPending;
    const balance = Math.max(0, endBalanceRaw);
    const excess = Math.max(0, -endBalanceRaw);

    selectedSummary = {
      fullDaysUsed,
      halfDaysUsed,
      lateCount,
      lateConverted,
      totalUsed,
      carryIn,
      monthlyAllowance,
      monthPending,
      totalAvailable,
      endBalanceRaw,
      balance,
      excess,
      deductionPercent: excess * 4,
    };

    runningCarry = balance;
  }

  return selectedSummary;
}

/**
 * Calculate net trading profit.
 * Net Profit = Gross Profit - Share Cost - Software Cost
 */
export function calculateNetProfit(
  grossProfit: number,
  sharesTraded: number,
  softwareCost: number
): { shareCost: number; netProfit: number } {
  const shareCost = calculateShareCost(sharesTraded);
  const netProfit = grossProfit - shareCost - softwareCost;
  return { shareCost, netProfit };
}

/**
 * Calculate STO payout due date.
 * STO is held for 2 months and paid at the beginning of the 3rd month.
 * January profit → paid April 1
 */
export function getSTOPayoutDate(month: number, year: number): Date {
  // Add 3 months to get payout date (1st of that month)
  let payoutMonth = month + 3;
  let payoutYear = year;
  if (payoutMonth > 12) {
    payoutMonth -= 12;
    payoutYear += 1;
  }
  return new Date(payoutYear, payoutMonth - 1, 1);
}

/**
 * Calculate LTO unlock date.
 * LTO is locked for 12 months.
 * January 2025 LTO → released January 2026
 */
export function getLTOUnlockDate(month: number, year: number): Date {
  return new Date(year + 1, month - 1, 1);
}

/**
 * Calculate leave deductions.
 * 
 * Rules:
 * - 1.5 leave days per month
 * - 3 late marks = 0.5 day deducted from leave balance  
 * - Unused leaves carry forward
 * - If excess leaves used beyond balance:
 *   - Each excess half day = 2% payout deduction
 *   - Each excess full day = 4% payout deduction
 * 
 * Returns the total deduction percentage to apply to STO payout.
 */
export function calculateLeaveDeduction(
  attendanceRecords: Array<{ record_date: string; status: string }>,
  selectedMonth: number,
  selectedYear: number,
  previousYearCarryForward: number = 0
): {
  deductionPercent: number;
  carryForwardBalance: number;
  monthlyBreakdown: Array<{
    month: number;
    entitlement: number;
    fullDaysUsed: number;
    halfDaysUsed: number;
    lateCount: number;
    lateConverted: number;
    totalUsed: number;
    balance: number;
  }>;
} {
  if (selectedYear < 2026) {
    return {
      deductionPercent: 0,
      carryForwardBalance: 0,
      monthlyBreakdown: [],
    };
  }

  let runningBalance = previousYearCarryForward;
  const monthlyBreakdown: Array<any> = [];
  let deductionPercent = 0;

  for (let m = 1; m <= selectedMonth; m++) {
    // Add monthly entitlement
    const carryIn = runningBalance;
    runningBalance += 1.5;

    const monthRecords = attendanceRecords.filter((r) => {
      const d = new Date(r.record_date);
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === m;
    });

    const fullDaysUsed = monthRecords.filter((r) => r.status === "absent").length;
    const halfDaysUsed = monthRecords.filter((r) => r.status === "half_day").length;
    const lateCount = monthRecords.filter((r) => r.status === "late").length;
    const lateConverted = Math.floor(lateCount / 3) * 0.5; // 3 lates = 0.5 day

    const totalUsed = fullDaysUsed + halfDaysUsed * 0.5 + lateConverted;

    const rawBalance = runningBalance - totalUsed;
    const balance = Math.max(0, rawBalance);
    const excess = Math.max(0, -rawBalance);

    monthlyBreakdown.push({
      month: m,
      entitlement: 1.5,
      carryIn,
      fullDaysUsed,
      halfDaysUsed,
      lateCount,
      lateConverted,
      totalUsed,
      balance,
      excess,
    });

    if (m === selectedMonth) {
      deductionPercent = excess * 4;
    }

    runningBalance = balance;
  }

  return {
    deductionPercent,
    carryForwardBalance: runningBalance,
    monthlyBreakdown,
  };
}

/**
 * Full monthly payout calculation for a trader.
 */
export interface MonthlyPayoutResult {
  // P&L
  grossProfit: number;
  sharesTraded: number;
  shareCost: number;
  softwareCost: number;
  netProfit: number;

  // Milestone & percentages
  milestoneLevel: MilestoneLevel;
  stoPercent: number;
  ltoPercent: number;

  // STO calculation
  stoAmount: number;           // netProfit * stoPercent
  leaveDeductionPct: number;
  leaveDeductionAmount: number;
  traineePoolContribution: number; // 25% of STO after leave deductions
  finalStoAmount: number;      // After leave deductions and pool contribution
  stoPayoutDate: Date;

  // LTO calculation
  ltoAmount: number;           // netProfit * ltoPercent
  ltoUnlockDate: Date;
}

export function calculateMonthlyPayout(params: {
  grossProfit: number;
  sharesTraded: number;
  softwareCost: number;
  stoPercent: number;
  ltoPercent: number;
  leaveDeductionPct: number;
  hasTrainee: boolean;
  month: number;
  year: number;
}): MonthlyPayoutResult {
  const { grossProfit, sharesTraded, softwareCost, stoPercent, ltoPercent, leaveDeductionPct, hasTrainee, month, year } = params;

  const { shareCost, netProfit } = calculateNetProfit(grossProfit, sharesTraded, softwareCost);

  const stoAmount = netProfit > 0 ? netProfit * (stoPercent / 100) : 0;
  const ltoAmount = netProfit > 0 ? netProfit * (ltoPercent / 100) : 0;

  const leaveDeductionAmount = stoAmount * (leaveDeductionPct / 100);
  const stoAfterLeave = stoAmount - leaveDeductionAmount;

  // Trainee pool: 25% of STO (after leave deductions)
  const traineePoolContribution = hasTrainee ? stoAfterLeave * 0.25 : 0;
  const finalStoAmount = stoAfterLeave - traineePoolContribution;

  const stoPayoutDate = getSTOPayoutDate(month, year);
  const ltoUnlockDate = getLTOUnlockDate(month, year);

  return {
    grossProfit,
    sharesTraded,
    shareCost,
    softwareCost,
    netProfit,
    milestoneLevel: MILESTONES[0], // Caller should set this
    stoPercent,
    ltoPercent,
    stoAmount,
    leaveDeductionPct,
    leaveDeductionAmount,
    traineePoolContribution,
    finalStoAmount,
    stoPayoutDate,
    ltoAmount,
    ltoUnlockDate,
  };
}

/**
 * @deprecated Use trading day counts instead of month calculations.
 */
export function monthsBetween(startDate: Date, endDate: Date): number {
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
}

// ==========================================
// LTO Release Threshold Rules
// ==========================================
// Minimum cumulative LTO pool required before any LTO can be released,
// based on the trader's CURRENT milestone level. As level increases the
// minimum requirement increases. Level 4 is TBD — using 50000 as a placeholder.
export const LTO_RELEASE_THRESHOLDS: Record<number, number> = {
  0: 0,
  1: 10000,
  2: 25000,
  3: 50000,
  4: 50000, // TBD — to be decided
};

export function getLtoReleaseThreshold(currentLevel: number): number {
  return LTO_RELEASE_THRESHOLDS[currentLevel] ?? 0;
}

/**
 * Decide if an LTO entry is eligible to be released.
 * Eligible only when:
 *   1. Its 12-month unlock date has passed, AND
 *   2. The trader's TOTAL LTO pool (locked + released) has reached the
 *      minimum threshold for their current milestone level.
 */
export function isLtoEntryReleasable(params: {
  unlockDate: string | Date;
  currentLevel: number;
  totalLtoPool: number; // sum of all lto_amount across the trader (locked + released)
  now?: Date;
}): boolean {
  const { unlockDate, currentLevel, totalLtoPool } = params;
  const now = params.now ?? new Date();
  const unlock = unlockDate instanceof Date ? unlockDate : new Date(unlockDate);
  if (unlock > now) return false;
  const threshold = getLtoReleaseThreshold(currentLevel);
  return totalLtoPool >= threshold;
}
