// Types for Admin Dashboard

export interface DashboardKPI {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface EmployeeStats {
  userId: string;
  name: string;
  email: string;
  status: "Active" | "Inactive";
  totalPnl: number;
  todayPnl: number;
  maxProfit: number;
  maxLoss: number;
  winRate: number;
  avgDailyPnl: number;
  tradingDays: number;
  winningDays: number;
  losingDays: number;
}

export interface DailyPnL {
  date: string;
  pnl: number;
  cumulativePnl: number;
  equity: number;
}

export interface CompanyStats {
  totalPnl: number;
  todayPnl: number;
  weekPnl: number;
  monthPnl: number;
  totalActiveEmployees: number;
  totalRealizedProfit: number;
  totalRealizedLoss: number;
  bestDayPnl: number;
  worstDayPnl: number;
  bestDayDate: string;
  worstDayDate: string;
}

export type DateRangeFilter = "today" | "week" | "month" | "quarter" | "year" | "lifetime" | "custom";
export type ChartGranularity = "daily" | "weekly" | "monthly";
