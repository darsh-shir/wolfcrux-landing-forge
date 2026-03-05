import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface TradingAccount {
  id: string;
  user_id: string | null;
  account_name: string;
  account_number: string | null;
}

interface TradingData {
  id: string;
  user_id: string;
  account_id: string;
  trade_date: string;
  net_pnl: number;
  shares_traded: number;
  is_holiday: boolean;
  late_remarks: string | null;
  notes: string | null;
}

interface MonthlyPnLProps {
  users: Profile[];
  accounts: TradingAccount[];
  tradingData: TradingData[];
  onRefresh: () => void;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MonthlyPnL = ({ users, accounts, tradingData, onRefresh }: MonthlyPnLProps) => {
  const { toast } = useToast();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [editingRows, setEditingRows] = useState<Record<string, { net_pnl: string; shares_traded: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const getUserName = (userId: string) => {
    const u = users.find((p) => p.user_id === userId);
    return u?.full_name || "Unknown";
  };

  const getAccountInfo = (accountId: string) => {
    const a = accounts.find((acc) => acc.id === accountId);
    return a ? { name: a.account_name, number: a.account_number } : { name: "Unknown", number: null };
  };

  // Filter entries for the selected month
  const monthEntries = useMemo(() => {
    return tradingData
      .filter((t) => {
        const d = new Date(t.trade_date);
        return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
      })
      .sort((a, b) => {
        const nameComp = getUserName(a.user_id).localeCompare(getUserName(b.user_id));
        if (nameComp !== 0) return nameComp;
        return a.trade_date.localeCompare(b.trade_date);
      });
  }, [tradingData, selectedMonth, selectedYear, users]);

  const companyPnl = useMemo(() => monthEntries.reduce((sum, t) => sum + Number(t.net_pnl), 0), [monthEntries]);
  const totalShares = useMemo(() => monthEntries.reduce((sum, t) => sum + t.shares_traded, 0), [monthEntries]);
  const tradingDays = useMemo(() => new Set(monthEntries.map((t) => t.trade_date)).size, [monthEntries]);

  // Account-wise breakdown
  const accountBreakdown = useMemo(() => {
    const map: Record<string, { pnl: number; shares: number; traders: string[]; days: Set<string> }> = {};
    monthEntries.forEach((t) => {
      if (!map[t.account_id]) {
        map[t.account_id] = { pnl: 0, shares: 0, traders: [], days: new Set() };
      }
      map[t.account_id].pnl += Number(t.net_pnl);
      map[t.account_id].shares += t.shares_traded;
      map[t.account_id].days.add(t.trade_date);
      const traderName = getUserName(t.user_id);
      if (!map[t.account_id].traders.includes(traderName)) {
        map[t.account_id].traders.push(traderName);
      }
    });
    return Object.entries(map)
      .map(([accountId, data]) => ({
        accountId,
        ...getAccountInfo(accountId),
        pnl: data.pnl,
        shares: data.shares,
        traders: data.traders,
        days: data.days.size,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [monthEntries, accounts]);

  // Trader-wise breakdown
  const traderBreakdown = useMemo(() => {
    const map: Record<string, { pnl: number; shares: number; days: Set<string> }> = {};
    monthEntries.forEach((t) => {
      if (!map[t.user_id]) {
        map[t.user_id] = { pnl: 0, shares: 0, days: new Set() };
      }
      map[t.user_id].pnl += Number(t.net_pnl);
      map[t.user_id].shares += t.shares_traded;
      map[t.user_id].days.add(t.trade_date);
    });
    return Object.entries(map)
      .map(([userId, data]) => ({
        userId,
        name: getUserName(userId),
        pnl: data.pnl,
        shares: data.shares,
        days: data.days.size,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [monthEntries, users]);

  const navigateMonth = (dir: number) => {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const startEditing = (entry: TradingData) => {
    setEditingRows((prev) => ({
      ...prev,
      [entry.id]: { net_pnl: String(entry.net_pnl), shares_traded: String(entry.shares_traded) },
    }));
  };

  const cancelEditing = (id: string) => {
    setEditingRows((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveEntry = async (id: string) => {
    const edit = editingRows[id];
    if (!edit) return;
    setSaving(id);
    const { error } = await supabase
      .from("trading_data")
      .update({ net_pnl: parseFloat(edit.net_pnl) || 0, shares_traded: parseInt(edit.shares_traded) || 0 })
      .eq("id", id);
    setSaving(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Entry updated successfully" });
      cancelEditing(id);
      onRefresh();
    }
  };

  const years = Array.from(new Set(tradingData.map((t) => new Date(t.trade_date).getFullYear()))).sort((a, b) => b - a);
  if (!years.includes(selectedYear)) years.push(selectedYear);
  years.sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {/* Month/Year Selector & Company P&L Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-xl">Monthly P&L Checker</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={cn(
              "rounded-lg p-4 border",
              companyPnl >= 0 ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
            )}>
              <p className="text-sm text-muted-foreground">Company P&L</p>
              <div className="flex items-center gap-2">
                {companyPnl >= 0 ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
                <p className={cn("text-2xl font-bold", companyPnl >= 0 ? "text-green-600" : "text-red-600")}>
                  ${companyPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <div className="rounded-lg p-4 border bg-muted/30">
              <p className="text-sm text-muted-foreground">Total Entries</p>
              <p className="text-2xl font-bold">{monthEntries.length}</p>
            </div>
            <div className="rounded-lg p-4 border bg-muted/30">
              <p className="text-sm text-muted-foreground">Trading Days</p>
              <p className="text-2xl font-bold">{tradingDays}</p>
            </div>
            <div className="rounded-lg p-4 border bg-muted/30">
              <p className="text-sm text-muted-foreground">Total Shares</p>
              <p className="text-2xl font-bold">{totalShares.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trader-wise Breakdown */}
      {traderBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trader-wise P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {traderBreakdown.map((t) => (
                <div key={t.userId} className="rounded-lg border p-3 space-y-1">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className={cn("font-bold text-sm", t.pnl >= 0 ? "text-green-600" : "text-red-600")}>
                      ${t.pnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.days} days • {t.shares.toLocaleString()} shares
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account-wise Breakdown */}
      {accountBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account-wise P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {accountBreakdown.map((acc) => (
                <div key={acc.accountId} className="rounded-lg border p-3 space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{acc.name}</p>
                      {acc.number && <p className="text-xs text-muted-foreground">{acc.number}</p>}
                    </div>
                    <p className={cn("font-bold text-sm", acc.pnl >= 0 ? "text-green-600" : "text-red-600")}>
                      ${acc.pnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {acc.traders.join(", ")} • {acc.days} days • {acc.shares.toLocaleString()} shares
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Entries Table (Editable) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Entries — {MONTHS[selectedMonth - 1]} {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {monthEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No entries for this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Trader</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Net P&L</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthEntries.map((entry) => {
                    const isEditing = !!editingRows[entry.id];
                    const editData = editingRows[entry.id];
                    const accInfo = getAccountInfo(entry.account_id);

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">{format(new Date(entry.trade_date), "dd MMM")}</TableCell>
                        <TableCell className="font-medium">{getUserName(entry.user_id)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{accInfo.name}</p>
                            {accInfo.number && <p className="text-xs text-muted-foreground">{accInfo.number}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editData.net_pnl}
                              onChange={(e) =>
                                setEditingRows((prev) => ({
                                  ...prev,
                                  [entry.id]: { ...prev[entry.id], net_pnl: e.target.value },
                                }))
                              }
                              className="w-28 ml-auto text-right"
                            />
                          ) : (
                            <span className={cn("font-semibold", Number(entry.net_pnl) >= 0 ? "text-green-600" : "text-red-600")}>
                              ${Number(entry.net_pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editData.shares_traded}
                              onChange={(e) =>
                                setEditingRows((prev) => ({
                                  ...prev,
                                  [entry.id]: { ...prev[entry.id], shares_traded: e.target.value },
                                }))
                              }
                              className="w-24 ml-auto text-right"
                            />
                          ) : (
                            <span>{entry.shares_traded.toLocaleString()}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground truncate max-w-[120px] block">
                            {entry.notes || entry.late_remarks || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {isEditing ? (
                            <div className="flex gap-1 justify-center">
                              <Button size="sm" onClick={() => saveEntry(entry.id)} disabled={saving === entry.id}>
                                <Save className="h-3 w-3 mr-1" />
                                {saving === entry.id ? "..." : "Save"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => cancelEditing(entry.id)}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => startEditing(entry)}>
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlyPnL;
