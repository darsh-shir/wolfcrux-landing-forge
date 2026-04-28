import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  TrendingUp, TrendingDown, Users, 
  PiggyBank, ArrowUpRight, ArrowDownRight,
  Clock, Lock, Landmark
} from "lucide-react";
import { CompanyStats } from "./types";
import { format, parseISO } from "date-fns";
import { formatCurrencyINR, formatIndian } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import AnimatedNumber from "@/components/AnimatedNumber";

interface CompanyKPIsProps {
  stats: CompanyStats;
}

const CompanyKPIs = ({ stats }: CompanyKPIsProps) => {
  const [stoPending, setStoPending] = useState(0);
  const [ltoLocked, setLtoLocked] = useState(0);
  const [traineePool, setTraineePool] = useState(0);

  useEffect(() => {
    fetchFinancialKPIs();
  }, []);

  const fetchFinancialKPIs = async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [stoRes, ltoRes, poolRes] = await Promise.all([
      supabase.from("sto_ledger").select("final_sto_amount").eq("is_paid", false),
      supabase.from("lto_ledger").select("lto_amount").eq("is_released", false),
      supabase.from("trainee_pool_ledger").select("total_pool_amount").eq("month", month).eq("year", year).maybeSingle(),
    ]);

    if (stoRes.data) setStoPending(stoRes.data.reduce((s, r) => s + Number(r.final_sto_amount), 0));
    if (ltoRes.data) setLtoLocked(ltoRes.data.reduce((s, r) => s + Number(r.lto_amount), 0));
    if (poolRes.data) setTraineePool(Number(poolRes.data.total_pool_amount));
  };

  const formatCurrency = (v: number) => formatCurrencyINR(v, "$", 0);
  const fmtCur = (n: number) => formatCurrency(n);
  const fmtInt = (n: number) => formatIndian(Math.round(n), 0);

  const kpis = [
    {
      label: "Total Company PnL",
      rawValue: stats.totalPnl,
      format: fmtCur,
      subLabel: "Lifetime",
      icon: stats.totalPnl >= 0 ? TrendingUp : TrendingDown,
      color: stats.totalPnl >= 0 ? "text-emerald-600" : "text-red-600",
      bgColor: stats.totalPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
    {
      label: "Today PnL",
      rawValue: stats.todayPnl,
      format: fmtCur,
      subLabel: "Today",
      icon: stats.todayPnl >= 0 ? ArrowUpRight : ArrowDownRight,
      color: stats.todayPnl >= 0 ? "text-emerald-600" : "text-red-600",
      bgColor: stats.todayPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
    {
      label: "This Week",
      rawValue: stats.weekPnl,
      format: fmtCur,
      subLabel: "Week PnL",
      icon: stats.weekPnl >= 0 ? ArrowUpRight : ArrowDownRight,
      color: stats.weekPnl >= 0 ? "text-emerald-600" : "text-red-600",
      bgColor: stats.weekPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
    {
      label: "This Month",
      rawValue: stats.monthPnl,
      format: fmtCur,
      subLabel: "Month PnL",
      icon: stats.monthPnl >= 0 ? ArrowUpRight : ArrowDownRight,
      color: stats.monthPnl >= 0 ? "text-emerald-600" : "text-red-600",
      bgColor: stats.monthPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
    {
      label: "Active Employees",
      rawValue: stats.totalActiveEmployees,
      format: fmtInt,
      subLabel: "Trading Staff",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "STO Pending",
      rawValue: stoPending,
      format: fmtCur,
      subLabel: "Unpaid payouts",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "LTO Locked",
      rawValue: ltoLocked,
      format: fmtCur,
      subLabel: "12-month lock",
      icon: Lock,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Trainee Pool",
      rawValue: traineePool,
      format: fmtCur,
      subLabel: "This month",
      icon: Landmark,
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Best Day",
      rawValue: stats.bestDayPnl,
      format: fmtCur,
      subLabel: stats.bestDayDate ? format(parseISO(stats.bestDayDate), "MMM d, yyyy") : "N/A",
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Worst Day",
      rawValue: stats.worstDayPnl,
      format: fmtCur,
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
          className="border-border/50 hover-lift-sm animate-scale-in group"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wide leading-tight break-words min-w-0 flex-1">
                {kpi.label}
              </span>
              <div className={`shrink-0 p-1.5 rounded-lg ${kpi.bgColor} transition-transform duration-300 group-hover:scale-110`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </div>
            <div className={`text-base sm:text-xl font-bold leading-tight tabular-nums break-words ${kpi.color}`}>
              <AnimatedNumber
                value={kpi.rawValue}
                format={kpi.format}
                resetKey={kpi.rawValue}
              />
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 break-words leading-tight">
              {kpi.subLabel}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default CompanyKPIs;
