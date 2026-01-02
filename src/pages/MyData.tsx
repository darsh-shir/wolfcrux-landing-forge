import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Calendar, DollarSign, BarChart3 } from "lucide-react";

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

const MyData = () => {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [tradingData, setTradingData] = useState<TradingData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

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
    
    // Fetch trading accounts
    const { data: accountsData } = await supabase
      .from("trading_accounts")
      .select("*")
      .order("account_name");

    if (accountsData) {
      setAccounts(accountsData);
    }

    // Fetch trading data
    const { data: tradesData } = await supabase
      .from("trading_data")
      .select("*")
      .order("trade_date", { ascending: false });

    if (tradesData) {
      setTradingData(tradesData);
    }

    setDataLoading(false);
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.account_name || "Unknown";
  };

  const totalPnl = tradingData.reduce((sum, t) => sum + Number(t.net_pnl), 0);
  const totalShares = tradingData.reduce((sum, t) => sum + t.shares_traded, 0);
  const tradingDays = tradingData.filter((t) => !t.is_holiday).length;

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
              My Trading Data
            </h1>
            <p className="text-muted-foreground font-['Inter'] mt-2">
              View your trading performance and account details
            </p>
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

          {/* Accounts */}
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
                    const accountPnl = tradingData
                      .filter((t) => t.account_id === account.id)
                      .reduce((sum, t) => sum + Number(t.net_pnl), 0);
                    
                    return (
                      <div
                        key={account.id}
                        className="p-4 border rounded-lg bg-muted/50"
                      >
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
              ) : tradingData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No trading data found.
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
                      {tradingData.map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell className="font-medium">
                            {new Date(trade.trade_date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
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
        </div>
      </div>
      <Footer />
    </>
  );
};

export default MyData;
