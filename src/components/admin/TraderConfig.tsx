import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, Settings } from "lucide-react";
import { getMilestoneLevel } from "@/lib/payoutCalculations";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  joining_date?: string | null;
}

interface TraderConfigData {
  id?: string;
  user_id: string;
  payout_percentage: number;
  sto_percentage: number;
  lto_percentage: number;
  config_mode: string;
  software_cost: number;
  month: number;
  year: number;
}

interface TraderMilestone {
  user_id: string;
  cumulative_net_profit: number;
  current_level: number;
}

interface TraderConfigProps {
  users: Profile[];
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1;
const currentYear = currentDate.getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const TraderConfig = ({ users }: TraderConfigProps) => {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<TraderConfigData[]>([]);
  const [editing, setEditing] = useState<Record<string, TraderConfigData>>({});
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isInherited, setIsInherited] = useState(false);
  const [milestones, setMilestones] = useState<TraderMilestone[]>([]);
  const [tradingDaysMap, setTradingDaysMap] = useState<Record<string, number>>({});

  useEffect(() => { fetchConfigs(); }, [selectedMonth, selectedYear]);

  const fetchConfigs = async () => {
    setLoading(true);
    setEditing({});
    setIsInherited(false);

    const [configRes, milestoneRes] = await Promise.all([
      supabase.from("trader_config").select("*").eq("month", selectedMonth).eq("year", selectedYear),
      supabase.from("trader_milestones").select("user_id, cumulative_net_profit, current_level"),
    ]);

    setMilestones((milestoneRes.data || []) as TraderMilestone[]);

    // Fetch all trading data for day counts (paginated)
    const allTrades: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("trading_data")
        .select("user_id, trade_date, trader2_id, trader2_role")
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      allTrades.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
    const daysMap: Record<string, Set<string>> = {};
    allTrades.forEach((t) => {
      if (!daysMap[t.user_id]) daysMap[t.user_id] = new Set();
      daysMap[t.user_id].add(t.trade_date);
      if (t.trader2_id && t.trader2_role?.toLowerCase() === "partner") {
        if (!daysMap[t.trader2_id]) daysMap[t.trader2_id] = new Set();
        daysMap[t.trader2_id].add(t.trade_date);
      }
    });
    const countMap: Record<string, number> = {};
    Object.entries(daysMap).forEach(([uid, set]) => { countMap[uid] = set.size; });
    setTradingDaysMap(countMap);

    if (!configRes.error && configRes.data && configRes.data.length > 0) {
      setConfigs(configRes.data.map(c => ({
        ...c,
        sto_percentage: c.sto_percentage ?? c.payout_percentage ?? 0,
        lto_percentage: c.lto_percentage ?? 0,
        config_mode: c.config_mode ?? 'manual',
      })) as TraderConfigData[]);
    } else {
      const { data: fallback } = await supabase
        .from("trader_config")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(100);

      if (fallback && fallback.length > 0) {
        const latestYear = fallback[0].year;
        const latestMonth = fallback[0].month;
        const latestConfigs = fallback.filter(
          (c: any) => c.year === latestYear && c.month === latestMonth
        );
        setConfigs(
          latestConfigs.map((c: any) => ({
            user_id: c.user_id,
            payout_percentage: c.payout_percentage,
            sto_percentage: c.sto_percentage ?? c.payout_percentage ?? 0,
            lto_percentage: c.lto_percentage ?? 0,
            config_mode: c.config_mode ?? 'manual',
            software_cost: c.software_cost,
            month: selectedMonth,
            year: selectedYear,
          }))
        );
        setIsInherited(true);
      } else {
        setConfigs([]);
      }
    }
    setLoading(false);
  };

  const getConfig = (userId: string): TraderConfigData => {
    return editing[userId] || configs.find(c => c.user_id === userId) || {
      user_id: userId, payout_percentage: 0, sto_percentage: 0, lto_percentage: 0,
      config_mode: 'manual', software_cost: 1000, month: selectedMonth, year: selectedYear,
    };
  };

  const isEdited = (userId: string) => Boolean(editing[userId]);

  const getMilestoneForUser = (userId: string) => {
    const milestone = milestones.find(m => m.user_id === userId);
    if (!milestone) return null;
    const tradingDays = tradingDaysMap[userId] || 0;
    return getMilestoneLevel(tradingDays, milestone.cumulative_net_profit);
  };

  const handleChange = (userId: string, field: keyof TraderConfigData, value: any) => {
    const current = { ...(editing[userId] || getConfig(userId)) };
    (current as any)[field] = value;

    // Auto-calculate total payout_percentage
    if (field === 'sto_percentage' || field === 'lto_percentage') {
      current.payout_percentage = Number(current.sto_percentage) + Number(current.lto_percentage);
    }

    // When switching to milestone, auto-fill from milestone
    if (field === 'config_mode' && value === 'milestone') {
      const ml = getMilestoneForUser(userId);
      if (ml) {
        current.sto_percentage = ml.stoPercent;
        current.lto_percentage = ml.ltoPercent;
        current.payout_percentage = ml.stoPercent + ml.ltoPercent;
      }
    }

    setEditing(prev => ({ ...prev, [userId]: current }));
  };

  const saveConfig = async (userId: string) => {
    const cfg = getConfig(userId);

    const { data: existing } = await supabase
      .from("trader_config")
      .select("id")
      .eq("user_id", userId)
      .eq("month", selectedMonth)
      .eq("year", selectedYear)
      .maybeSingle();

    const payload = {
      user_id: userId,
      payout_percentage: cfg.payout_percentage,
      sto_percentage: cfg.sto_percentage,
      lto_percentage: cfg.lto_percentage,
      config_mode: cfg.config_mode,
      software_cost: cfg.software_cost,
      month: selectedMonth,
      year: selectedYear,
    };

    if (existing?.id) {
      const { error } = await supabase.from("trader_config").update(payload).eq("id", existing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("trader_config").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }

    await propagateToFutureMonths(userId, payload);
    toast({ title: "Saved", description: "Config saved & propagated to future months" });
    setEditing(prev => { const n = { ...prev }; delete n[userId]; return n; });
    fetchConfigs();
  };

  const propagateToFutureMonths = async (userId: string, payload: any) => {
    const { data: futureConfigs } = await supabase
      .from("trader_config")
      .select("id, month, year")
      .eq("user_id", userId)
      .or(`year.gt.${selectedYear},and(year.eq.${selectedYear},month.gt.${selectedMonth})`);

    if (futureConfigs && futureConfigs.length > 0) {
      for (const fc of futureConfigs) {
        await supabase.from("trader_config").update({
          payout_percentage: payload.payout_percentage,
          sto_percentage: payload.sto_percentage,
          lto_percentage: payload.lto_percentage,
          config_mode: payload.config_mode,
          software_cost: payload.software_cost,
        }).eq("id", fc.id);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Trader Configuration
          </CardTitle>
          <div className="flex gap-2 items-center">
            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isInherited && (
              <Badge variant="secondary" className="text-xs">
                Inherited from previous month
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Choose <strong>Manual</strong> to set STO & LTO % yourself, or <strong>Milestone</strong> to auto-calculate based on tenure & profit.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trader</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>STO %</TableHead>
                <TableHead>LTO %</TableHead>
                <TableHead>Total %</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => {
                const cfg = getConfig(user.user_id);
                const isMilestone = cfg.config_mode === 'milestone';
                const ml = getMilestoneForUser(user.user_id);

                return (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>
                      <Select
                        value={cfg.config_mode}
                        onValueChange={v => handleChange(user.user_id, "config_mode", v)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="milestone">Milestone</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {isMilestone ? (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{ml?.stoPercent ?? 0}%</span>
                          {ml && <Badge variant="outline" className="text-[10px]">{ml.label}</Badge>}
                        </div>
                      ) : (
                        <Input type="number" className="w-20" step="1"
                          value={cfg.sto_percentage || ""}
                          onChange={e => handleChange(user.user_id, "sto_percentage", Number(e.target.value))}
                          placeholder="0" />
                      )}
                    </TableCell>
                    <TableCell>
                      {isMilestone ? (
                        <span className="font-medium">{ml?.ltoPercent ?? 0}%</span>
                      ) : (
                        <Input type="number" className="w-20" step="1"
                          value={cfg.lto_percentage || ""}
                          onChange={e => handleChange(user.user_id, "lto_percentage", Number(e.target.value))}
                          placeholder="0" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-bold">
                        {isMilestone
                          ? `${(ml?.stoPercent ?? 0) + (ml?.ltoPercent ?? 0)}%`
                          : `${Number(cfg.sto_percentage) + Number(cfg.lto_percentage)}%`
                        }
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isEdited(user.user_id) ? (
                        <Button size="sm" onClick={() => {
                          if (isMilestone && ml) {
                            handleChange(user.user_id, "sto_percentage", ml.stoPercent);
                            handleChange(user.user_id, "lto_percentage", ml.ltoPercent);
                            const updated = {
                              ...cfg,
                              sto_percentage: ml.stoPercent,
                              lto_percentage: ml.ltoPercent,
                              payout_percentage: ml.stoPercent + ml.ltoPercent,
                            };
                            setEditing(prev => ({ ...prev, [user.user_id]: updated }));
                            setTimeout(() => saveConfig(user.user_id), 0);
                            return;
                          }
                          saveConfig(user.user_id);
                        }}>
                          <Save className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default TraderConfig;
