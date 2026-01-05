import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Calendar, DollarSign, BarChart3, Key } from "lucide-react";
import ChangePassword from "@/components/user/ChangePassword";
import LeaveApplication from "@/components/user/LeaveApplication";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO } from "date-fns";

interface TradingAccount {
  id: string;
  account_name: string;
  account_number: string | null;
}

interface TradingData {
  id: string;
  trade_date: string;
  net_pnl: number;
  shares_traded: number;
  is_holiday: boolean;
  late_remarks: string | null;
  notes: string | null;
  account_id: string;
}

type TimeFilter = "monthly" | "quarterly" | "yearly";

const MyData = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [tradingData, setTradingData] = useState<TradingData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Filters
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("monthly");
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    const q = Math.ceil((new Date().getMonth() + 1) / 3);
    return `${new Date().getFullYear()}-Q${q}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setDataLoading(true);
    
    const [accountsRes, tradesRes] = await Promise.all([
      supabase.from("trading_accounts").select("*").order("account_name"),
      supabase.from("trading_data").select("*").order("trade_date", { ascending: false }),
    ]);

    if (accountsRes.data) setAccounts(accountsRes.data);
    if (tradesRes.data) setTradingData(tradesRes.data);

    setDataLoading(false);
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.account_name || "Unknown";
  };

  // Get date range based on filter
  const dateRange = useMemo(() => {
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

  const totalPnl = filteredData.reduce((sum, t) => sum + Number(t.net_pnl), 0);
  const totalShares = filteredData.reduce((sum, t) => sum + t.shares_traded, 0);
  const tradingDays = filteredData.filter((t) => !t.is_holiday).length;

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-background pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold font-['Space_Grotesk'] text-foreground">
              My Dashboard
            </h1>
            <p className="text-muted-foreground font-['Inter'] mt-2">
              View your trading performance and manage your account
            </p>
          </div>

          <Tabs defaultValue="trading" className="space-y-6">
            <TabsList>
              <TabsTrigger value="trading" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Trading Data
              </TabsTrigger>
              <TabsTrigger value="leaves" className="gap-2">
                <Calendar className="h-4 w-4" />
                Leaves
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Key className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* TRADING DATA TAB */}
            <TabsContent value="trading">
              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-6">
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

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${totalPnl >= 0 ? "bg-green-100" : "bg-red-100"}`}>
                        {totalPnl >= 0 ? (
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total P&L</p>
                        <p className={`text-2xl font-bold ${totalPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${totalPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Shares Traded</p>
                        <p className="text-2xl font-bold">{totalShares.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-100">
                        <Calendar className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Trading Days</p>
                        <p className="text-2xl font-bold">{tradingDays}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-100">
                        <DollarSign className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Accounts</p>
                        <p className="text-2xl font-bold">{accounts.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Accounts Summary */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="font-['Space_Grotesk']">My Trading Accounts</CardTitle>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : accounts.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No trading accounts found. Contact your administrator.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {accounts.map((account) => {
                        const accountPnl = filteredData
                          .filter((t) => t.account_id === account.id)
                          .reduce((sum, t) => sum + Number(t.net_pnl), 0);
                        
                        return (
                          <div key={account.id} className="p-4 border rounded-lg bg-muted/50">
                            <h3 className="font-semibold">{account.account_name}</h3>
                            {account.account_number && (
                              <p className="text-sm text-muted-foreground">
                                #{account.account_number}
                              </p>
                            )}
                            <p className={`text-lg font-bold mt-2 ${accountPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                              ${accountPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Trading Data Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Space_Grotesk']">Trading History</CardTitle>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : filteredData.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No trading data for the selected period.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Net P&L</TableHead>
                            <TableHead className="text-right">Shares</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Remarks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredData.map((trade) => (
                            <TableRow key={trade.id}>
                              <TableCell className="font-medium">
                                {format(parseISO(trade.trade_date), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell>{getAccountName(trade.account_id)}</TableCell>
                              <TableCell className={`text-right font-semibold ${Number(trade.net_pnl) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                ${Number(trade.net_pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right">
                                {trade.shares_traded.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                {trade.is_holiday ? (
                                  <Badge variant="secondary">Holiday</Badge>
                                ) : (
                                  <Badge variant="outline">Trading</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {trade.late_remarks || trade.notes || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* LEAVES TAB */}
            <TabsContent value="leaves">
              <LeaveApplication />
            </TabsContent>

            {/* SETTINGS TAB */}
            <TabsContent value="settings">
              <div className="max-w-md">
                <ChangePassword />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default MyData;
