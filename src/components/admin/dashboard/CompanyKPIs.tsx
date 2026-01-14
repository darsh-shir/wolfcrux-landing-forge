import { Card, CardContent } from "@/components/ui/card";
import { 
  TrendingUp, TrendingDown, Users, 
  PiggyBank, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { CompanyStats } from "./types";
import { format, parseISO } from "date-fns";

interface CompanyKPIsProps {
  stats: CompanyStats;
}

const CompanyKPIs = ({ stats }: CompanyKPIsProps) => {
  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (absValue >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const kpis = [
    {
      label: "Total Company PnL",
      value: formatCurrency(stats.totalPnl),
      subLabel: "Lifetime",
      icon: stats.totalPnl >= 0 ? TrendingUp : TrendingDown,
      color: stats.totalPnl >= 0 ? "text-emerald-600" : "text-red-600",
      bgColor: stats.totalPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
    {
      label: "Today PnL",
      value: formatCurrency(stats.todayPnl),
      subLabel: "Today",
      icon: stats.todayPnl >= 0 ? ArrowUpRight : ArrowDownRight,
      color: stats.todayPnl >= 0 ? "text-emerald-600" : "text-red-600",
      bgColor: stats.todayPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
    {
      label: "This Week",
      value: formatCurrency(stats.weekPnl),
      subLabel: "Week PnL",
      icon: stats.weekPnl >= 0 ? ArrowUpRight : ArrowDownRight,
      color: stats.weekPnl >= 0 ? "text-emerald-600" : "text-red-600",
      bgColor: stats.weekPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
    {
      label: "This Month",
      value: formatCurrency(stats.monthPnl),
      subLabel: "Month PnL",
      icon: stats.monthPnl >= 0 ? ArrowUpRight : ArrowDownRight,
      color: stats.monthPnl >= 0 ? "text-emerald-600" : "text-red-600",
      bgColor: stats.monthPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
    {
      label: "Active Employees",
      value: stats.totalActiveEmployees.toString(),
      subLabel: "Trading Staff",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Realized Profit",
      value: formatCurrency(stats.totalRealizedProfit),
      subLabel: "Total Gains",
      icon: PiggyBank,
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Realized Loss",
      value: formatCurrency(stats.totalRealizedLoss),
      subLabel: "Total Losses",
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-500/10",
    },
    {
      label: "Best Day",
      value: formatCurrency(stats.bestDayPnl),
      subLabel: stats.bestDayDate ? format(parseISO(stats.bestDayDate), "MMM d, yyyy") : "N/A",
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Worst Day",
      value: formatCurrency(stats.worstDayPnl),
      subLabel: stats.worstDayDate ? format(parseISO(stats.worstDayDate), "MMM d, yyyy") : "N/A",
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 gap-4">
      {kpis.map((kpi, index) => (
        <Card 
          key={index} 
          className="border-border/50 hover:bg-muted/30 transition-colors"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {kpi.label}
              </span>
              <div className={`p-1.5 rounded-lg ${kpi.bgColor}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </div>
            <div className={`text-xl font-bold ${kpi.color}`}>
              {kpi.value}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {kpi.subLabel}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default CompanyKPIs;
