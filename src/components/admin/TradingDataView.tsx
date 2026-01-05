import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, User, Building2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO } from "date-fns";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface TradingAccount {
  id: string;
  user_id: string;
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

interface TradingDataViewProps {
  users: Profile[];
  accounts: TradingAccount[];
  tradingData: TradingData[];
  onRefresh: () => void;
}

type TimeFilter = "monthly" | "quarterly" | "yearly";
type ViewMode = "person" | "account";

const TradingDataView = ({ users, accounts, tradingData, onRefresh }: TradingDataViewProps) => {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("person");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("monthly");
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    const q = Math.ceil((new Date().getMonth() + 1) / 3);
    return `${new Date().getFullYear()}-Q${q}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());

  const getUserName = (userId: string) => {
    const u = users.find((p) => p.user_id === userId);
    return u?.full_name || "Unknown";
  };

  const getAccountInfo = (accountId: string) => {
    const a = accounts.find((acc) => acc.id === accountId);
    return a ? { name: a.account_name, number: a.account_number } : { name: "Unknown", number: null };
  };

  // Get date range based on filter
  const dateRange = useMemo(() => {
    const now = new Date();
    if (timeFilter === "monthly") {
      const [year, month] = selectedMonth.split("-").map(Number);
      const date = new Date(year, month - 1);
      return { start: startOfMonth(date), end: endOfMonth(date) };
    } else if (timeFilter === "quarterly") {
      const [year, q] = selectedQuarter.split("-Q").map((s) => parseInt(s));
      const quarterMonth = (q - 1) * 3;
      const date = new Date(year, quarterMonth);
      return { start: startOfQuarter(date), end: endOfQuarter(date) };
    } else {
      const year = parseInt(selectedYear);
      const date = new Date(year, 0);
      return { start: startOfYear(date), end: endOfYear(date) };
    }
  }, [timeFilter, selectedMonth, selectedQuarter, selectedYear]);

  // Filter data by date range
  const filteredData = useMemo(() => {
    return tradingData.filter((t) => {
      const tradeDate = parseISO(t.trade_date);
      return tradeDate >= dateRange.start && tradeDate <= dateRange.end;
    });
  }, [tradingData, dateRange]);

  // Group data by person or account
  const groupedData = useMemo(() => {
    if (viewMode === "person") {
      const grouped: Record<string, TradingData[]> = {};
      filteredData.forEach((t) => {
        if (!grouped[t.user_id]) grouped[t.user_id] = [];
        grouped[t.user_id].push(t);
      });
      return grouped;
    } else {
      const grouped: Record<string, TradingData[]> = {};
      filteredData.forEach((t) => {
        if (!grouped[t.account_id]) grouped[t.account_id] = [];
        grouped[t.account_id].push(t);
      });
      return grouped;
    }
  }, [filteredData, viewMode]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("trading_data").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Trading entry removed" });
      onRefresh();
    }
  };

  // Generate months for dropdown
  const months = useMemo(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      result.push(format(date, "yyyy-MM"));
    }
    return result;
  }, []);

  // Generate quarters for dropdown
  const quarters = useMemo(() => {
    const result = [];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 2; y--) {
      for (let q = 4; q >= 1; q--) {
        result.push(`${y}-Q${q}`);
      }
    }
    return result;
  }, []);

  // Generate years for dropdown
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Trading Data</CardTitle>
          <div className="flex flex-wrap gap-2">
            {/* View Mode Toggle */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="person" className="gap-1">
                  <User className="h-4 w-4" />
                  Person-wise
                </TabsTrigger>
                <TabsTrigger value="account" className="gap-1">
                  <Building2 className="h-4 w-4" />
                  Account-wise
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Time Filter */}
            <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>

            {/* Period Selector */}
            {timeFilter === "monthly" && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {format(parseISO(`${m}-01`), "MMM yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {timeFilter === "quarterly" && (
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quarters.map((q) => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {timeFilter === "yearly" && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {Object.keys(groupedData).length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No trading data for the selected period.
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedData).map(([key, data]) => {
              const totalPnl = data.reduce((sum, t) => sum + Number(t.net_pnl), 0);
              const totalShares = data.reduce((sum, t) => sum + t.shares_traded, 0);
              const label = viewMode === "person" 
                ? getUserName(key) 
                : `${getAccountInfo(key).name} (${getAccountInfo(key).number || "No number"})`;

              return (
                <div key={key} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-3 flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">{label}</h3>
                      <p className="text-sm text-muted-foreground">
                        {data.length} entries | Total Shares: {totalShares.toLocaleString()}
                      </p>
                    </div>
                    <div className={`text-lg font-bold ${totalPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                      ${totalPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        {viewMode === "person" && <TableHead>Account</TableHead>}
                        {viewMode === "account" && <TableHead>Trader</TableHead>}
                        <TableHead className="text-right">P&L</TableHead>
                        <TableHead className="text-right">Shares</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell>
                            {format(parseISO(trade.trade_date), "MMM d, yyyy")}
                          </TableCell>
                          {viewMode === "person" && (
                            <TableCell>
                              {getAccountInfo(trade.account_id).number || getAccountInfo(trade.account_id).name}
                            </TableCell>
                          )}
                          {viewMode === "account" && (
                            <TableCell>{getUserName(trade.user_id)}</TableCell>
                          )}
                          <TableCell className={`text-right font-semibold ${Number(trade.net_pnl) >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ${Number(trade.net_pnl).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">{trade.shares_traded.toLocaleString()}</TableCell>
                          <TableCell>
                            {trade.is_holiday ? "Holiday" : "Trading"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(trade.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradingDataView;
