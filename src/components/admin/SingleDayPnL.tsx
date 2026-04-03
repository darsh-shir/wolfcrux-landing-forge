import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, addDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Save, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Users } from "lucide-react";
import { cn, formatCurrencyINR, formatIndian } from "@/lib/utils";

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

interface SingleDayPnLProps {
  users: Profile[];
  accounts: TradingAccount[];
  tradingData: TradingData[];
  onRefresh: () => void;
}

const SingleDayPnL = ({ users, accounts, tradingData, onRefresh }: SingleDayPnLProps) => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editingRows, setEditingRows] = useState<Record<string, { net_pnl: string; shares_traded: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedTraders, setExpandedTraders] = useState<Set<string>>(new Set());

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const getUserName = (userId: string) => {
    const u = users.find((p) => p.user_id === userId);
    return u?.full_name || "Unknown";
  };

  const getAccountInfo = (accountId: string) => {
    const a = accounts.find((acc) => acc.id === accountId);
    return a ? { name: a.account_name, number: a.account_number } : { name: "Unknown", number: null };
  };

  const dayEntries = useMemo(() => {
    return tradingData
      .filter((t) => t.trade_date === dateStr)
      .sort((a, b) => getUserName(a.user_id).localeCompare(getUserName(b.user_id)));
  }, [tradingData, dateStr, users]);

  const companyPnl = useMemo(() => {
    return dayEntries.reduce((sum, t) => sum + Number(t.net_pnl), 0);
  }, [dayEntries]);

  // Group entries by trader
  const traderGroups = useMemo(() => {
    const map: Record<string, { entries: TradingData[]; totalPnl: number; totalShares: number }> = {};
    dayEntries.forEach((t) => {
      if (!map[t.user_id]) {
        map[t.user_id] = { entries: [], totalPnl: 0, totalShares: 0 };
      }
      map[t.user_id].entries.push(t);
      map[t.user_id].totalPnl += Number(t.net_pnl);
      map[t.user_id].totalShares += t.shares_traded;
    });
    return Object.entries(map)
      .map(([userId, data]) => ({ userId, name: getUserName(userId), ...data }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dayEntries, users]);

  // Account-wise breakdown
  const accountBreakdown = useMemo(() => {
    const map: Record<string, { pnl: number; shares: number; traders: string[] }> = {};
    dayEntries.forEach((t) => {
      if (!map[t.account_id]) {
        map[t.account_id] = { pnl: 0, shares: 0, traders: [] };
      }
      map[t.account_id].pnl += Number(t.net_pnl);
      map[t.account_id].shares += t.shares_traded;
      const traderName = getUserName(t.user_id);
      if (!map[t.account_id].traders.includes(traderName)) {
        map[t.account_id].traders.push(traderName);
      }
    });
    return Object.entries(map)
      .map(([accountId, data]) => ({ accountId, ...getAccountInfo(accountId), ...data }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [dayEntries, accounts]);

  const toggleTrader = (userId: string) => {
    setExpandedTraders((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
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

  const totalShares = dayEntries.reduce((sum, t) => sum + t.shares_traded, 0);
  const uniqueTraders = traderGroups.length;

  return (
    <div className="space-y-6">
      {/* Date Selector & Summary */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-xl">Single Day P&L Checker</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setSelectedDate((d) => subDays(d, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" onClick={() => setSelectedDate((d) => addDays(d, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={cn("rounded-lg p-4 border", companyPnl >= 0 ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800")}>
              <p className="text-sm text-muted-foreground">Company P&L</p>
              <div className="flex items-center gap-2">
                {companyPnl >= 0 ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
                <p className={cn("text-2xl font-bold", companyPnl >= 0 ? "text-green-600" : "text-red-600")}>
                  ${companyPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <div className="rounded-lg p-4 border bg-muted/30">
              <p className="text-sm text-muted-foreground">Total Traders</p>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <p className="text-2xl font-bold">{uniqueTraders}</p>
              </div>
            </div>
            <div className="rounded-lg p-4 border bg-muted/30">
              <p className="text-sm text-muted-foreground">Total Entries</p>
              <p className="text-2xl font-bold">{dayEntries.length}</p>
            </div>
            <div className="rounded-lg p-4 border bg-muted/30">
              <p className="text-sm text-muted-foreground">Total Shares</p>
              <p className="text-2xl font-bold">{formatIndian(totalShares)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                      {formatCurrencyINR(acc.pnl)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {acc.traders.join(", ")} • {formatIndian(acc.shares)} shares
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trader-wise Grouped Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trader P&L — {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          {traderGroups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No entries for this date.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Trader</TableHead>
                    <TableHead className="text-center">Accounts</TableHead>
                    <TableHead className="text-right">Total P&L</TableHead>
                    <TableHead className="text-right">Total Shares</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {traderGroups.map((group) => {
                    const isExpanded = expandedTraders.has(group.userId);
                    return (
                      <>
                        <TableRow
                          key={group.userId}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleTrader(group.userId)}
                        >
                          <TableCell>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-medium">{group.name}</TableCell>
                          <TableCell className="text-center">{group.entries.length}</TableCell>
                          <TableCell className="text-right">
                            <span className={cn("font-semibold", group.totalPnl >= 0 ? "text-green-600" : "text-red-600")}>
                              ${group.totalPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{group.totalShares.toLocaleString()}</TableCell>
                        </TableRow>
                        {isExpanded &&
                          group.entries.map((entry) => {
                            const isEditing = !!editingRows[entry.id];
                            const editData = editingRows[entry.id];
                            const accInfo = getAccountInfo(entry.account_id);
                            return (
                              <TableRow key={entry.id} className="bg-muted/20">
                                <TableCell></TableCell>
                                <TableCell className="pl-8">
                                  <div>
                                    <p className="text-sm font-medium">{accInfo.name}</p>
                                    {accInfo.number && <p className="text-xs text-muted-foreground">{accInfo.number}</p>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="text-xs text-muted-foreground">
                                    {entry.is_holiday ? "Holiday" : (entry as any).trader1_attendance || "Present"}
                                  </span>
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
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    <span className={cn("text-sm", Number(entry.net_pnl) >= 0 ? "text-green-600" : "text-red-600")}>
                                      ${Number(entry.net_pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {isEditing ? (
                                      <>
                                        <Input
                                          type="number"
                                          value={editData.shares_traded}
                                          onChange={(e) =>
                                            setEditingRows((prev) => ({
                                              ...prev,
                                              [entry.id]: { ...prev[entry.id], shares_traded: e.target.value },
                                            }))
                                          }
                                          className="w-24 text-right"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEntry(entry.id); }} disabled={saving === entry.id}>
                                          <Save className="h-3 w-3 mr-1" />
                                          {saving === entry.id ? "..." : "Save"}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); cancelEditing(entry.id); }}>
                                          Cancel
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-sm">{entry.shares_traded.toLocaleString()}</span>
                                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); startEditing(entry); }}>
                                          Edit
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </>
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

export default SingleDayPnL;
