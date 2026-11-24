/**
 * Wolfcrux payout engine — the single source of truth for monthly payouts.
 *
 * Used by the admin Payout Sheet, the trader's Payout Summary, Pool View and
 * every screen that shows a trader's level, so they can never disagree.
 * Pure functions only: no database access, no dates from the clock.
 *
 * Rules (agreed with management, Nov 2026):
 *  1. Per-person P&L: on days two partners sit together, that day's P&L and
 *     shares are split 50/50. On days only one of them is present, that
 *     person gets the whole day (a "solo" day).
 *  2. Share cost: $14 per 1,000 shares on the person's own share of shares.
 *  3. Software cost: the seat cost (default $1,000) every month from joining;
 *     halved ($500 each) if the person sat with a partner on any day that month.
 *  4. Net profit = P&L − share cost − software cost + transfers (net amounts
 *     moved between traders at month end).
 *  5. Losses carry forward: STO is paid only on profit above earlier
 *     unrecovered losses. LTO is not offset and can be negative.
 *  6. STO / LTO use the person's own level % (or manual % if configured).
 *  7. Leave deduction % reduces both STO and (positive) LTO.
 *  8. Second-PC 25%: a trader with no partner days pays 25% of STO after
 *     leave. A trader with some partner days pays 25% of the STO earned on
 *     their solo days: (solo P&L − solo share cost) × STO% × (1 − leave%) × 25%.
 *  9. Level = highest level whose trading-days OR profit requirement is met.
 */

export const SHARE_COST_PER_1000 = 14;
export const DEFAULT_SEAT_COST = 1000;
export const SECOND_PC_SHARE = 0.25;

export interface LevelDef {
  level: number;
  label: string;
  stoPercent: number;
  ltoPercent: number;
  daysRequired: number;
  profitRequired: number;
  /** Minimum total LTO pool before any LTO can be released. */
  ltoReleaseMin: number;
}

/** Current level table. Management can change it; keep it in one place. */
export const DEFAULT_LEVELS: LevelDef[] = [
  { level: 0, label: "Junior Equity Analyst", stoPercent: 20, ltoPercent: 0, daysRequired: 0, profitRequired: 0, ltoReleaseMin: 0 },
  { level: 1, label: "Equity Analyst", stoPercent: 25, ltoPercent: 10, daysRequired: 125, profitRequired: 50_000, ltoReleaseMin: 10_000 },
  { level: 2, label: "Senior Equity Analyst", stoPercent: 35, ltoPercent: 15, daysRequired: 275, profitRequired: 150_000, ltoReleaseMin: 20_000 },
  { level: 3, label: "Lead Equity Analyst", stoPercent: 45, ltoPercent: 20, daysRequired: 400, profitRequired: 300_000, ltoReleaseMin: 35_000 },
  { level: 4, label: "Chief Equity Analyst", stoPercent: 55, ltoPercent: 25, daysRequired: 600, profitRequired: 500_000, ltoReleaseMin: 60_000 },
];

/** Highest level reached by trading days OR cumulative net profit. */
export function levelFor(tradingDays: number, cumulativeProfit: number, levels: LevelDef[] = DEFAULT_LEVELS): LevelDef {
  const sorted = [...levels].sort((a, b) => a.level - b.level);
  let result = sorted[0];
  for (const l of sorted) {
    if (tradingDays >= l.daysRequired || cumulativeProfit >= l.profitRequired) result = l;
  }
  return result;
}

export function nextLevelAfter(level: number, levels: LevelDef[] = DEFAULT_LEVELS): LevelDef | null {
  return [...levels].sort((a, b) => a.level - b.level).find((l) => l.level > level) ?? null;
}

export const shareCost = (shares: number) => (shares / 1000) * SHARE_COST_PER_1000;

// ---------------------------------------------------------------------------
// Attribution: who earned what on each trade row
// ---------------------------------------------------------------------------

export interface TradeRow {
  trade_date: string; // YYYY-MM-DD
  user_id: string; // primary trader (seat owner for the row)
  trader2_id: string | null;
  trader2_role: string | null; // "partner" | "trainee" | null
  trader1_attendance?: string | null;
  trader2_attendance?: string | null;
  net_pnl: number | string;
  shares_traded: number | string;
}

/** Present, late and half-day count as present; absent and holiday do not. Missing = present. */
export const isPresent = (attendance: string | null | undefined) =>
  !attendance || !["absent", "holiday"].includes(attendance.toLowerCase());

export interface PersonDayShare {
  date: string;
  pnl: number;
  shares: number;
  /** Sat together with a partner (P&L split 50/50). */
  together: boolean;
  partnerId: string | null;
  /** Person was present that day (counts as a trading day). */
  present: boolean;
}

/** The part of one trade row that belongs to `personId` (null if none). */
export function shareOfRow(personId: string, row: TradeRow): PersonDayShare | null {
  const pnl = Number(row.net_pnl) || 0;
  const shares = Number(row.shares_traded) || 0;
  const isPartnerRow = (row.trader2_role || "").toLowerCase() === "partner" && !!row.trader2_id;
  const p1 = isPresent(row.trader1_attendance);
  const p2 = isPartnerRow && isPresent(row.trader2_attendance);

  if (row.user_id === personId) {
    if (p1 && p2) return { date: row.trade_date, pnl: pnl / 2, shares: shares / 2, together: true, partnerId: row.trader2_id, present: true };
    if (p1) return { date: row.trade_date, pnl, shares, together: false, partnerId: null, present: true };
    if (p2) return null; // partner traded the seat alone that day
    // Nobody marked present but the row has numbers: keep them with the seat owner.
    if (pnl !== 0 || shares !== 0) return { date: row.trade_date, pnl, shares, together: false, partnerId: null, present: false };
    return null;
  }
  if (isPartnerRow && row.trader2_id === personId) {
    if (p1 && p2) return { date: row.trade_date, pnl: pnl / 2, shares: shares / 2, together: true, partnerId: row.user_id, present: true };
    if (p2) return { date: row.trade_date, pnl, shares, together: false, partnerId: null, present: true };
  }
  return null;
}

// ---------------------------------------------------------------------------
// One month for one person
// ---------------------------------------------------------------------------

export interface MonthInput {
  /** This person's shares of every row in the month (from shareOfRow). */
  days: PersonDayShare[];
  /** Seat software cost for the month (halved automatically if partnered). */
  seatCost: number;
  /** Net amount moved in (+) or out (−) at month end. */
  transfersNet?: number;
  /** Leave deduction %, e.g. 4 for 4%. */
  leavePct?: number;
  /** Unrecovered losses carried in from earlier months (≥ 0). */
  priorDeficit?: number;
  stoPercent: number;
  ltoPercent: number;
}

export interface MonthResult {
  grossPnl: number;
  shares: number;
  shareCost: number;
  softwareCost: number;
  transfersNet: number;
  netProfit: number;
  partnered: boolean;
  togetherDays: number;
  soloDays: number;
  tradingDays: number;
  soloPnl: number;
  soloShares: number;
  priorDeficit: number;
  /** Profit STO is paid on, after recovering earlier losses. */
  stoBase: number;
  deficitAfter: number;
  stoPercent: number;
  ltoPercent: number;
  sto: number;
  lto: number;
  leavePct: number;
  leaveDeductionSto: number;
  leaveDeductionLto: number;
  secondPcShare: number;
  finalSto: number;
  finalLto: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeMonth(input: MonthInput): MonthResult {
  const days = input.days;
  const grossPnl = days.reduce((s, d) => s + d.pnl, 0);
  const shares = days.reduce((s, d) => s + d.shares, 0);
  const partnered = days.some((d) => d.together);
  const presentDates = new Set(days.filter((d) => d.present).map((d) => d.date));
  const togetherDates = new Set(days.filter((d) => d.together).map((d) => d.date));
  const solo = days.filter((d) => !d.together);
  const soloPnl = solo.reduce((s, d) => s + d.pnl, 0);
  const soloShares = solo.reduce((s, d) => s + d.shares, 0);

  const sc = shareCost(shares);
  const softwareCost = partnered ? input.seatCost / 2 : input.seatCost;
  const transfersNet = input.transfersNet ?? 0;
  const netProfit = grossPnl - sc - softwareCost + transfersNet;

  const priorDeficit = Math.max(0, input.priorDeficit ?? 0);
  const stoBase = Math.max(0, netProfit - priorDeficit);
  const deficitAfter = Math.max(0, priorDeficit - netProfit);

  const sto = stoBase * (input.stoPercent / 100);
  const lto = netProfit * (input.ltoPercent / 100);

  const leavePct = Math.max(0, input.leavePct ?? 0);
  const leaveFactor = Math.min(1, leavePct / 100);
  const leaveDeductionSto = sto * leaveFactor;
  const leaveDeductionLto = lto > 0 ? lto * leaveFactor : 0;
  const stoAfterLeave = sto - leaveDeductionSto;

  let secondPcShare: number;
  if (!partnered) {
    secondPcShare = stoAfterLeave * SECOND_PC_SHARE;
  } else {
    const soloNet = soloPnl - shareCost(soloShares);
    secondPcShare = Math.max(0, soloNet) * (input.stoPercent / 100) * (1 - leaveFactor) * SECOND_PC_SHARE;
  }
  secondPcShare = Math.max(0, Math.min(secondPcShare, stoAfterLeave));

  return {
    grossPnl,
    shares,
    shareCost: sc,
    softwareCost,
    transfersNet,
    netProfit,
    partnered,
    togetherDays: togetherDates.size,
    soloDays: [...presentDates].filter((d) => !togetherDates.has(d)).length,
    tradingDays: presentDates.size,
    soloPnl,
    soloShares,
    priorDeficit,
    stoBase,
    deficitAfter,
    stoPercent: input.stoPercent,
    ltoPercent: input.ltoPercent,
    sto,
    lto,
    leavePct,
    leaveDeductionSto,
    leaveDeductionLto,
    secondPcShare,
    finalSto: stoAfterLeave - secondPcShare,
    finalLto: lto - leaveDeductionLto,
  };
}

// ---------------------------------------------------------------------------
// A person's whole history: levels, carried losses, cumulative profit
// ---------------------------------------------------------------------------

export interface MonthConfig {
  /** Seat software cost for that month (default $1,000). */
  seatCost?: number;
  /** "manual" uses the percentages below; anything else uses the level table. */
  mode?: string;
  stoPercent?: number;
  ltoPercent?: number;
  /** Leave deduction % for that month (only affects that month's payout). */
  leavePct?: number;
  transfersNet?: number;
}

export interface Baseline {
  /** History before this date is represented by the baseline figures. */
  asOfDate: string;
  days: number;
  netProfit: number;
}

export interface HistoryInput {
  personId: string;
  /** Every trade row where the person is the primary trader or the partner. */
  rows: TradeRow[];
  /** Calculate up to and including this month (YYYY-MM). */
  throughMonth: string;
  /** Software cost is charged every month from this month (YYYY-MM). */
  startMonth?: string | null;
  baseline?: Baseline | null;
  configFor?: (monthKey: string) => MonthConfig | undefined;
  levels?: LevelDef[];
  /**
   * Manual levels set by the admin. Each change applies to its whole month
   * (YYYY-MM) and every month after it until the next change. Months before
   * the first change fall back to the automatic days-OR-profit level.
   */
  levelChanges?: LevelChange[];
  /** Admin's milestone net P&L for a month (YYYY-MM), replacing the website's figure for milestones only. */
  milestoneOverrides?: Map<string, number>;
}

export interface LevelChange {
  month: string; // YYYY-MM
  level: number;
  /** Per-person % for this level; the level's default when not set. */
  stoPercent?: number | null;
  ltoPercent?: number | null;
}

export interface HistoryMonth extends MonthResult {
  month: string; // YYYY-MM
  level: LevelDef;
  /** True when the level came from the admin's level history. */
  manualLevel: boolean;
  /** Net P&L counted towards milestones this month (admin figure if set). */
  milestoneNet: number;
  /** Trading days / profit at the START of the month (used for the level). */
  daysBefore: number;
  profitBefore: number;
}

export interface HistoryResult {
  months: HistoryMonth[];
  byMonth: Map<string, HistoryMonth>;
  /** Totals after the last computed month. */
  totalDays: number;
  totalProfit: number;
  /** The level in force now (admin's level history, else automatic). */
  currentLevel: LevelDef;
  /** Level the days-OR-profit rule would give now (for "ready to upgrade"). */
  eligibleLevel: LevelDef;
  /** STO / LTO % in force now. */
  currentStoPercent: number;
  currentLtoPercent: number;
  /** First month (YYYY-MM) of the current level/% run, if known from level history. */
  levelSince: string | null;
}

export const monthKeyOf = (date: string) => date.slice(0, 7);

export const addMonths = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
};

export function computeHistory(input: HistoryInput): HistoryResult {
  const levels = input.levels ?? DEFAULT_LEVELS;
  const baselineDate = input.baseline?.asOfDate ?? "";

  // Attribute every row to this person, grouped by month.
  const byMonthDays = new Map<string, PersonDayShare[]>();
  for (const row of input.rows) {
    if (baselineDate && row.trade_date < baselineDate) continue; // covered by the baseline
    const share = shareOfRow(input.personId, row);
    if (!share) continue;
    const key = monthKeyOf(row.trade_date);
    if (!byMonthDays.has(key)) byMonthDays.set(key, []);
    byMonthDays.get(key)!.push(share);
  }

  // First month to calculate: joining month (or first trade if unknown), not
  // before the baseline date (earlier history is in the baseline figures),
  // and never later than the first recorded trade.
  const firstActivity = [...byMonthDays.keys()].sort()[0];
  let first = input.startMonth || firstActivity || input.throughMonth;
  if (baselineDate && monthKeyOf(baselineDate) > first) first = monthKeyOf(baselineDate);
  if (firstActivity && firstActivity < first) first = firstActivity;

  let days = input.baseline?.days ?? 0;
  let profit = input.baseline?.netProfit ?? 0;
  let deficit = 0;
  const months: HistoryMonth[] = [];

  const changes = [...(input.levelChanges ?? [])].sort((a, b) => a.month.localeCompare(b.month));
  const changeFor = (key: string) => {
    let found: LevelChange | null = null;
    for (const c of changes) if (c.month <= key) found = c;
    return found;
  };
  const levelDef = (n: number) => levels.find((l) => l.level === n) ?? levels[Math.min(Math.max(n, 0), levels.length - 1)];

  for (let key = first; key <= input.throughMonth; key = addMonths(key, 1)) {
    const cfg = input.configFor?.(key) ?? {};
    const change = changeFor(key);
    const level = change ? levelDef(change.level) : levelFor(days, profit, levels);
    const levelSto = change?.stoPercent != null ? Number(change.stoPercent) : level.stoPercent;
    const levelLto = change?.ltoPercent != null ? Number(change.ltoPercent) : level.ltoPercent;
    // A one-month manual % in Trader Config still wins for that month.
    const manual = cfg.mode === "manual" && (cfg.stoPercent ?? 0) > 0;
    const r = computeMonth({
      days: byMonthDays.get(key) ?? [],
      seatCost: cfg.seatCost ?? DEFAULT_SEAT_COST,
      transfersNet: cfg.transfersNet ?? 0,
      leavePct: cfg.leavePct ?? 0,
      priorDeficit: deficit,
      stoPercent: manual ? Number(cfg.stoPercent) : levelSto,
      ltoPercent: manual ? Number(cfg.ltoPercent ?? 0) : levelLto,
    });
    const milestoneNet = input.milestoneOverrides?.get(key) ?? r.netProfit;
    months.push({ ...r, month: key, level, manualLevel: !!change, milestoneNet, daysBefore: days, profitBefore: profit });
    days += r.tradingDays;
    profit += milestoneNet;
    deficit = r.deficitAfter;
  }

  return {
    months,
    byMonth: new Map(months.map((m) => [m.month, m])),
    totalDays: days,
    totalProfit: profit,
    ...currentLevelInfo(),
  };

  function currentLevelInfo() {
    const nowChange = changeFor(input.throughMonth);
    const eligible = levelFor(days, profit, levels);
    const current = nowChange ? levelDef(nowChange.level) : eligible;
    const sto = nowChange?.stoPercent != null ? Number(nowChange.stoPercent) : current.stoPercent;
    const lto = nowChange?.ltoPercent != null ? Number(nowChange.ltoPercent) : current.ltoPercent;
    return {
      currentLevel: current,
      eligibleLevel: eligible,
      currentStoPercent: sto,
      currentLtoPercent: lto,
      levelSince: nowChange?.month ?? null,
    };
  }
}

/** Round money for display/storage. */
export const money = round2;
