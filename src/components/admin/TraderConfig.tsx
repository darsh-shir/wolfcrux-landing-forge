import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Save, Settings, Copy } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface TraderConfigData {
  id?: string;
  user_id: string;
  payout_percentage: number;
  software_cost: number;
  month: number;
  year: number;
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

  useEffect(() => { fetchConfigs(); }, [selectedMonth, selectedYear]);

  const fetchConfigs = async () => {
    setLoading(true);
    setEditing({});
    const { data, error } = await supabase
      .from("trader_config")
      .select("*")
      .eq("month", selectedMonth)
      .eq("year", selectedYear);
    if (!error && data) setConfigs(data as TraderConfigData[]);
    setLoading(false);
  };

  const initFromPreviousMonth = async () => {
    let prevMonth = selectedMonth - 1;
    let prevYear = selectedYear;
    if (prevMonth < 1) { prevMonth = 12; prevYear -= 1; }

    const { data: prevData } = await supabase
      .from("trader_config")
      .select("*")
      .eq("month", prevMonth)
      .eq("year", prevYear);

    if (prevData && prevData.length > 0) {
      const inserts = prevData.map((cfg: any) => ({
        user_id: cfg.user_id,
        payout_percentage: cfg.payout_percentage,
        software_cost: cfg.software_cost,
        month: selectedMonth,
        year: selectedYear,
      }));

      const { error } = await supabase.from("trader_config").insert(inserts);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Copied", description: `Config carried forward from ${MONTH_NAMES[prevMonth - 1]} ${prevYear}` });
        fetchConfigs();
      }
    } else {
      toast({ title: "No Data", description: "No previous month config found to copy", variant: "destructive" });
    }
  };

  const getConfig = (userId: string): TraderConfigData => {
    return editing[userId] || configs.find(c => c.user_id === userId) || {
      user_id: userId, payout_percentage: 0, software_cost: 0,
      month: selectedMonth, year: selectedYear,
    };
  };

  const handleChange = (userId: string, field: keyof TraderConfigData, value: any) => {
    const current = { ...(editing[userId] || getConfig(userId)), [field]: value };
    setEditing(prev => ({ ...prev, [userId]: current }));
  };

  const saveConfig = async (userId: string) => {
    const cfg = getConfig(userId);
    const existing = configs.find(c => c.user_id === userId);

    const payload = {
      user_id: userId,
      payout_percentage: cfg.payout_percentage,
      software_cost: cfg.software_cost,
      month: selectedMonth,
      year: selectedYear,
    };

    if (existing?.id) {
      const { error } = await supabase.from("trader_config").update(payload).eq("id", (existing as any).id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("trader_config").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }

    await propagateToFutureMonths(userId, payload);
    toast({ title: "Saved", description: "Trader config saved & propagated to future months" });
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
          software_cost: payload.software_cost,
        }).eq("id", fc.id);
      }
    }
  };

  const hasConfigsForMonth = configs.length > 0;

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
            {!hasConfigsForMonth && (
              <Button variant="outline" size="sm" onClick={initFromPreviousMonth} className="gap-1">
                <Copy className="h-4 w-4" />
                Copy from Previous
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Set each trader's payout %. Software cost is set per-trader in the Payout Sheet tab.
          Trainee = 25% of trader's payout, Partner = 50%.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trader</TableHead>
                <TableHead>Payout %</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => {
                const cfg = getConfig(user.user_id);
                return (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>
                      <Input type="number" className="w-20" step="1" value={cfg.payout_percentage || ""}
                        onChange={e => handleChange(user.user_id, "payout_percentage", Number(e.target.value))}
                        placeholder="0" />
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => saveConfig(user.user_id)}>
                        <Save className="h-4 w-4" />
                      </Button>
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
