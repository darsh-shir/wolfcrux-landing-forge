import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAllTradeRows } from "@/lib/tradeCache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/ui/save-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "lucide-react";
import { getMilestoneLevel } from "@/lib/payoutCalculations";
import { loadAllTraderHistories } from "@/hooks/useTraderHistory";
import { fetchAllRows, must } from "@/lib/fetchAllRows";

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
  const [defaultPct, setDefaultPct] = useState<Record<string, { sto: number; lto: number; manual: boolean; stoUsed: number; ltoUsed: number }>>({});
  const [milestones, setMilestones] = useState<TraderMilestone[]>([]);
  const [tradingDaysMap, setTradingDaysMap] = useState<Record<string, number>>({});
  const [profitMap, setProfitMap] = useState<Record<string, number>>({});

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

    // Trading days and net profit per trader from the shared payout engine.
    const tradeUsers = await getAllTradeRows().catch(() => [] as any[]);
    const ids = new Set<string>();
    tradeUsers.forEach((t: any) => {
      ids.add(t.user_id);
      if (t.trader2_id && t.trader2_role?.toLowerCase() === "partner") ids.add(t.trader2_id);
    });
    const countMap: Record<string, number> = {};
    const profits: Record<string, number> = {};
    const levelPct: Record<string, { sto: number; lto: number; manual: boolean; stoUsed: number; ltoUsed: number }> = {};
    try {
      const histories = await loadAllTraderHistories([...ids]);
      const key = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
      histories.forEach((h, uid) => {
        countMap[uid] = h.totalDays;
        profits[uid] = h.totalProfit;
        // % the payout engine uses for this month by default (level history or days/profit).
        const m = h.byMonth.get(key);
        levelPct[uid] = m ? { sto: m.level.stoPercent, lto: m.level.ltoPercent, manual: m.manualLevel, stoUsed: m.stoPercent, ltoUsed: m.ltoPercent }
          : { sto: h.currentStoPercent, lto: h.currentLtoPercent, manual: !!h.levelSince, stoUsed: h.currentStoPercent, ltoUsed: h.currentLtoPercent };
      });
    } catch {
      /* leave maps empty; levels show as unknown */
    }
    setTradingDaysMap(countMap);
    setDefaultPct(levelPct);
    setProfitMap(profits);

    if (!configRes.error && configRes.data && configRes.data.length > 0) {
      setConfigs(configRes.data.map(c => ({
        ...c,
        sto_percentage: c.sto_percentage ?? c.payout_percentage ?? 0,
        lto_percentage: c.lto_percentage ?? 0,
        config_mode: c.config_mode ?? 'manual',
      })) as TraderConfigData[]);
    } else {
      // Nothing saved for this month: payouts use the defaults (level % and
      // $1,000 seat), so show those rather than another month's settings.
      setConfigs([]);
      setIsInherited(true);
    }
    setLoading(false);
  };

  const getConfig = (userId: string): TraderConfigData => {
    const ml = getMilestoneForUser(userId);
    const d = defaultPct[userId];
    const sto = d ? d.stoUsed : ml?.stoPercent ?? 0;
    const lto = d ? d.ltoUsed : ml?.ltoPercent ?? 0;
    return editing[userId] || configs.find(c => c.user_id === userId) || {
      user_id: userId,
      payout_percentage: sto + lto,
      sto_percentage: sto,
      lto_percentage: lto,
      config_mode: 'milestone', software_cost: 1000, month: selectedMonth, year: selectedYear,
    };
  };

  const isEdited = (userId: string) => Boolean(editing[userId]);

  const getMilestoneForUser = (userId: string) => {
    if (tradingDaysMap[userId] === undefined && profitMap[userId] === undefined) return null;
    return getMilestoneLevel(tradingDaysMap[userId] || 0, profitMap[userId] || 0);
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
      const d = defaultPct[userId];
      const ml = d ? { stoPercent: d.stoUsed, ltoPercent: d.ltoUsed } : getMilestoneForUser(userId);
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

    toast({ title: "Saved", description: `Only ${new Date(selectedYear, selectedMonth - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" })} was changed` });
    setEditing(prev => { const n = { ...prev }; delete n[userId]; return n; });
    fetchConfigs();
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
                Nothing saved for this month · defaults shown
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Choose <strong>Manual</strong> to set STO & LTO % yourself, or <strong>Milestone</strong> to auto-calculate based on tenure & profit.
          A change here applies <strong>only to the month selected</strong>; other months keep their own settings.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[900px]">
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
                        <SaveButton onClick={() => {
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
                        }} />
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
