// ==========================================
// Core Payout Calculation Engine for Wolfcrux
// ==========================================

export interface MilestoneLevel {
  level: number;
  label: string;
  stoPercent: number;
  ltoPercent: number;
  monthsRequired: number;      // months from account start
  profitRequired: number;      // cumulative net profit threshold
}

export const MILESTONES: MilestoneLevel[] = [
  { level: 0, label: "Start",       stoPercent: 20, ltoPercent: 0,  monthsRequired: 0,  profitRequired: 0 },
  { level: 1, label: "Level 1",     stoPercent: 25, ltoPercent: 10, monthsRequired: 6,  profitRequired: 50000 },
  { level: 2, label: "Level 2",     stoPercent: 35, ltoPercent: 15, monthsRequired: 12, profitRequired: 150000 },
  { level: 3, label: "Level 3",     stoPercent: 45, ltoPercent: 20, monthsRequired: 18, profitRequired: 300000 },
  { level: 4, label: "Level 4",     stoPercent: 55, ltoPercent: 25, monthsRequired: 24, profitRequired: 500000 },
];

/**
 * Determine milestone level based on months active and cumulative profit.
 * Whichever milestone is reached first (time OR profit) applies.
 */
export function getMilestoneLevel(
  monthsSinceStart: number,
  cumulativeNetProfit: number
): MilestoneLevel {
  let currentLevel = MILESTONES[0];
  for (let i = MILESTONES.length - 1; i >= 1; i--) {
    const m = MILESTONES[i];
    if (monthsSinceStart >= m.monthsRequired || cumulativeNetProfit >= m.profitRequired) {
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
  let runningBalance = previousYearCarryForward;
  const monthlyBreakdown: Array<any> = [];
  let deductionPercent = 0;

  for (let m = 1; m <= selectedMonth; m++) {
    // Add monthly entitlement
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

    runningBalance -= totalUsed;

    monthlyBreakdown.push({
      month: m,
      entitlement: 1.5,
      fullDaysUsed,
      halfDaysUsed,
      lateCount,
      lateConverted,
      totalUsed,
      balance: runningBalance,
    });

    // Calculate deduction only for the selected month
    if (m === selectedMonth && runningBalance < 0) {
      // The negative balance represents excess usage
      const excessDays = Math.abs(runningBalance);
      
      // Calculate deduction: each full day excess = 4%, each half day = 2%
      // We need to figure out how many full and half days of excess
      // The excess comes from THIS month's usage beyond what was available
      const availableBeforeThisMonth = runningBalance + totalUsed;
      const excessThisMonth = Math.max(0, totalUsed - Math.max(0, availableBeforeThisMonth));
      
      // Excess full days and half days from THIS month
      // We calculate as: excess in terms of "day units"
      // Each full excess day = 4%, each half excess day = 2%
      // Simplification: deductionPercent = excessDays * 4 (since 0.5 day * 4 = 2%)
      deductionPercent = excessThisMonth * 4;
    }
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
 * Calculate months between two dates.
 */
export function monthsBetween(startDate: Date, endDate: Date): number {
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
}
