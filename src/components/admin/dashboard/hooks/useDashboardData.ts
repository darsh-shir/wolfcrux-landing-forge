import { useMemo } from "react";
import { 
  startOfDay, endOfDay, startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, 
  startOfYear, endOfYear, parseISO, format, subDays, isWithinInterval 
} from "date-fns";
import { CompanyStats, EmployeeStats, DailyPnL, DateRangeFilter } from "../types";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface TradingData {
  id: string;
  user_id: string;
  account_id: string;
  trade_date: string;
  net_pnl: number;
  shares_traded: number;
  is_holiday: boolean;
}

interface TradingAccount {
  id: string;
  user_id: string | null;
  account_name: string;
}

interface UseDashboardDataProps {
  users: Profile[];
  tradingData: TradingData[];
  accounts: TradingAccount[];
  dateFilter: DateRangeFilter;
  customDateRange?: { start: Date; end: Date };
}

export const useDashboardData = ({
  users,
  tradingData,
  accounts,
  dateFilter,
  customDateRange,
}: UseDashboardDataProps) => {
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "quarter":
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case "year":
        return { start: startOfYear(now), end: endOfYear(now) };
      case "custom":
        return customDateRange || { start: subDays(now, 30), end: now };
      case "lifetime":
      default:
        return { start: new Date(2020, 0, 1), end: now };
    }
  }, [dateFilter, customDateRange]);

  const filteredData = useMemo(() => {
    return tradingData.filter((t) => {
      const tradeDate = parseISO(t.trade_date);
      return isWithinInterval(tradeDate, { start: dateRange.start, end: dateRange.end });
    });
  }, [tradingData, dateRange]);

  // Company Stats
  const companyStats = useMemo((): CompanyStats => {
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);

    let totalPnl = 0;
    let todayPnl = 0;
    let weekPnl = 0;
    let monthPnl = 0;
    let totalRealizedProfit = 0;
    let totalRealizedLoss = 0;
    let bestDayPnl = -Infinity;
    let worstDayPnl = Infinity;
    let bestDayDate = "";
    let worstDayDate = "";

    // Group by date for daily aggregation
    const dailyPnls: Record<string, number> = {};
    
    tradingData.forEach((t) => {
      const pnl = Number(t.net_pnl);
      const date = t.trade_date;
      const tradeDate = parseISO(date);

      totalPnl += pnl;
      if (pnl > 0) totalRealizedProfit += pnl;
      if (pnl < 0) totalRealizedLoss += Math.abs(pnl);

      if (date === todayStr) todayPnl += pnl;
      if (tradeDate >= weekStart) weekPnl += pnl;
      if (tradeDate >= monthStart) monthPnl += pnl;

      dailyPnls[date] = (dailyPnls[date] || 0) + pnl;
    });

    // Find best and worst days
    Object.entries(dailyPnls).forEach(([date, pnl]) => {
      if (pnl > bestDayPnl) {
        bestDayPnl = pnl;
        bestDayDate = date;
      }
      if (pnl < worstDayPnl) {
        worstDayPnl = pnl;
        worstDayDate = date;
      }
    });

    // Calculate drawdown
    let maxEquity = 0;
    let maxDrawdown = 0;
    let runningEquity = 0;
    
    const sortedDates = Object.keys(dailyPnls).sort();
    sortedDates.forEach((date) => {
      runningEquity += dailyPnls[date];
      maxEquity = Math.max(maxEquity, runningEquity);
      const drawdown = maxEquity - runningEquity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    });

    const activeUsers = new Set(tradingData.map((t) => t.user_id));
    const totalCapitalDeployed = accounts.length * 25000; // Assuming $25k per account

    return {
      totalPnl,
      todayPnl,
      weekPnl,
      monthPnl,
      totalActiveEmployees: activeUsers.size,
      totalCapitalDeployed,
      totalRealizedProfit,
      totalRealizedLoss,
      netCompanyEquity: totalCapitalDeployed + totalPnl,
      maxDrawdown,
      bestDayPnl: bestDayPnl === -Infinity ? 0 : bestDayPnl,
      worstDayPnl: worstDayPnl === Infinity ? 0 : worstDayPnl,
      bestDayDate,
      worstDayDate,
    };
  }, [tradingData, accounts]);

  // Employee Stats
  const employeeStats = useMemo((): EmployeeStats[] => {
    const statsMap: Record<string, {
      trades: TradingData[];
      dailyPnls: Record<string, number>;
    }> = {};

    filteredData.forEach((t) => {
      if (!statsMap[t.user_id]) {
        statsMap[t.user_id] = { trades: [], dailyPnls: {} };
      }
      statsMap[t.user_id].trades.push(t);
      const date = t.trade_date;
      statsMap[t.user_id].dailyPnls[date] = 
        (statsMap[t.user_id].dailyPnls[date] || 0) + Number(t.net_pnl);
    });

    return users.map((user) => {
      const data = statsMap[user.user_id];
      if (!data) {
        return {
          userId: user.user_id,
          name: user.full_name,
          email: user.email,
          status: "Inactive" as const,
          totalPnl: 0,
          todayPnl: 0,
          maxProfit: 0,
          maxLoss: 0,
          winRate: 0,
          avgDailyPnl: 0,
          maxDrawdown: 0,
          capitalAllocated: 0,
          currentEquity: 0,
          tradingDays: 0,
          winningDays: 0,
          losingDays: 0,
        };
      }

      const { trades, dailyPnls } = data;
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const totalPnl = trades.reduce((sum, t) => sum + Number(t.net_pnl), 0);
      const todayPnl = dailyPnls[todayStr] || 0;
      
      const dailyValues = Object.values(dailyPnls);
      const maxProfit = dailyValues.length > 0 ? Math.max(...dailyValues) : 0;
      const maxLoss = dailyValues.length > 0 ? Math.min(...dailyValues) : 0;
      
      const winningDays = dailyValues.filter((v) => v > 0).length;
      const losingDays = dailyValues.filter((v) => v < 0).length;
      const tradingDays = dailyValues.length;
      const winRate = tradingDays > 0 ? (winningDays / tradingDays) * 100 : 0;
      const avgDailyPnl = tradingDays > 0 ? totalPnl / tradingDays : 0;

      // Calculate max drawdown
      let maxEquity = 0;
      let maxDrawdown = 0;
      let runningEquity = 0;
      
      const sortedDates = Object.keys(dailyPnls).sort();
      sortedDates.forEach((date) => {
        runningEquity += dailyPnls[date];
        maxEquity = Math.max(maxEquity, runningEquity);
        const drawdown = maxEquity - runningEquity;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      });

      const capitalAllocated = 25000; // Base capital
      const currentEquity = capitalAllocated + totalPnl;

      return {
        userId: user.user_id,
        name: user.full_name,
        email: user.email,
        status: trades.length > 0 ? ("Active" as const) : ("Inactive" as const),
        totalPnl,
        todayPnl,
        maxProfit,
        maxLoss,
        winRate,
        avgDailyPnl,
        maxDrawdown,
        capitalAllocated,
        currentEquity,
        tradingDays,
        winningDays,
        losingDays,
      };
    });
  }, [users, filteredData]);

  // Daily PnL for charts
  const dailyPnLData = useMemo((): DailyPnL[] => {
    const dailyMap: Record<string, number> = {};
    
    filteredData.forEach((t) => {
      const date = t.trade_date;
      dailyMap[date] = (dailyMap[date] || 0) + Number(t.net_pnl);
    });

    const sortedDates = Object.keys(dailyMap).sort();
    let cumulativePnl = 0;
    const baseEquity = accounts.length * 25000;

    return sortedDates.map((date) => {
      const pnl = dailyMap[date];
      cumulativePnl += pnl;
      return {
        date,
        pnl,
        cumulativePnl,
        equity: baseEquity + cumulativePnl,
      };
    });
  }, [filteredData, accounts]);

  // Employee Daily PnL for comparison
  const getEmployeeDailyPnL = (userId: string): DailyPnL[] => {
    const dailyMap: Record<string, number> = {};
    
    filteredData
      .filter((t) => t.user_id === userId)
      .forEach((t) => {
        const date = t.trade_date;
        dailyMap[date] = (dailyMap[date] || 0) + Number(t.net_pnl);
      });

    const sortedDates = Object.keys(dailyMap).sort();
    let cumulativePnl = 0;
    const baseEquity = 25000;

    return sortedDates.map((date) => {
      const pnl = dailyMap[date];
      cumulativePnl += pnl;
      return {
        date,
        pnl,
        cumulativePnl,
        equity: baseEquity + cumulativePnl,
      };
    });
  };

  return {
    dateRange,
    companyStats,
    employeeStats,
    dailyPnLData,
    getEmployeeDailyPnL,
    filteredData,
  };
};
