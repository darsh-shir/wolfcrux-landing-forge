import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, BarChart3, Building2, Trash2 } from "lucide-react";

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

const Admin = () => {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [tradingData, setTradingData] = useState<TradingData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Form states
  const [selectedUser, setSelectedUser] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const [selectedAccount, setSelectedAccount] = useState("");
  const [tradeDate, setTradeDate] = useState("");
  const [netPnl, setNetPnl] = useState("");
  const [sharesTraded, setSharesTraded] = useState("");
  const [isHoliday, setIsHoliday] = useState(false);
  const [lateRemarks, setLateRemarks] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    } else if (!loading && user && !isAdmin) {
      navigate("/my-data");
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges.",
        variant: "destructive",
      });
    }
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchAllData();
    }
  }, [user, isAdmin]);

  const fetchAllData = async () => {
    setDataLoading(true);

    const [usersRes, accountsRes, tradesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("trading_accounts").select("*").order("account_name"),
      supabase.from("trading_data").select("*").order("trade_date", { ascending: false }),
    ]);

    if (usersRes.data) setUsers(usersRes.data);
    if (accountsRes.data) setAccounts(accountsRes.data);
    if (tradesRes.data) setTradingData(tradesRes.data);

    setDataLoading(false);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser || !accountName) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("trading_accounts").insert({
      user_id: selectedUser,
      account_name: accountName,
      account_number: accountNumber || null,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Trading account created" });
      setAccountName("");
      setAccountNumber("");
      setSelectedUser("");
      fetchAllData();
    }
  };

  const handleAddTradingData = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAccount || !tradeDate) {
      toast({ title: "Error", description: "Please select an account and date", variant: "destructive" });
      return;
    }

    const account = accounts.find((a) => a.id === selectedAccount);
    if (!account) return;

    const { error } = await supabase.from("trading_data").insert({
      user_id: account.user_id,
      account_id: selectedAccount,
      trade_date: tradeDate,
      net_pnl: parseFloat(netPnl) || 0,
      shares_traded: parseInt(sharesTraded) || 0,
      is_holiday: isHoliday,
      late_remarks: lateRemarks || null,
      notes: notes || null,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Trading data added" });
      setSelectedAccount("");
      setTradeDate("");
      setNetPnl("");
      setSharesTraded("");
      setIsHoliday(false);
      setLateRemarks("");
      setNotes("");
      fetchAllData();
    }
  };

  const handleDeleteTrade = async (id: string) => {
    const { error } = await supabase.from("trading_data").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Trading entry removed" });
      fetchAllData();
    }
  };

  const getUserName = (userId: string) => {
    const u = users.find((p) => p.user_id === userId);
    return u?.full_name || "Unknown";
  };

  const getAccountName = (accountId: string) => {
    const a = accounts.find((acc) => acc.id === accountId);
    return a?.account_name || "Unknown";
  };

  if (loading || !isAdmin) {
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
              Admin Panel
            </h1>
            <p className="text-muted-foreground font-['Inter'] mt-2">
              Manage users, accounts, and trading data
            </p>
          </div>

          <Tabs defaultValue="accounts" className="space-y-6">
            <TabsList>
              <TabsTrigger value="accounts" className="gap-2">
                <Building2 className="h-4 w-4" />
                Accounts
              </TabsTrigger>
              <TabsTrigger value="trading" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Trading Data
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
            </TabsList>

            {/* ACCOUNTS TAB */}
            <TabsContent value="accounts">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Create Trading Account
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateAccount} className="space-y-4">
                      <div className="space-y-2">
                        <Label>User</Label>
                        <Select value={selectedUser} onValueChange={setSelectedUser}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((u) => (
                              <SelectItem key={u.user_id} value={u.user_id}>
                                {u.full_name} ({u.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Account Name</Label>
                        <Input
                          value={accountName}
                          onChange={(e) => setAccountName(e.target.value)}
                          placeholder="e.g., Primary Account"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Account Number (optional)</Label>
                        <Input
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          placeholder="e.g., ACC-12345"
                        />
                      </div>
                      <Button type="submit" className="w-full">
                        Create Account
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>All Trading Accounts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dataLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {accounts.map((acc) => (
                          <div
                            key={acc.id}
                            className="p-3 border rounded-lg flex justify-between items-center"
                          >
                            <div>
                              <p className="font-medium">{acc.account_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {getUserName(acc.user_id)} • {acc.account_number || "No number"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TRADING DATA TAB */}
            <TabsContent value="trading">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Add Trading Entry
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAddTradingData} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Trading Account</Label>
                        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.account_name} ({getUserName(acc.user_id)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Trade Date</Label>
                        <Input
                          type="date"
                          value={tradeDate}
                          onChange={(e) => setTradeDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Net P&L ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={netPnl}
                          onChange={(e) => setNetPnl(e.target.value)}
                          placeholder="e.g., 1500.50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Shares Traded</Label>
                        <Input
                          type="number"
                          value={sharesTraded}
                          onChange={(e) => setSharesTraded(e.target.value)}
                          placeholder="e.g., 5000"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isHoliday}
                          onCheckedChange={setIsHoliday}
                        />
                        <Label>Holiday (no trading)</Label>
                      </div>
                      <div className="space-y-2">
                        <Label>Late Remarks</Label>
                        <Input
                          value={lateRemarks}
                          onChange={(e) => setLateRemarks(e.target.value)}
                          placeholder="Any late remarks..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Additional notes..."
                          rows={3}
                        />
                      </div>
                      <Button type="submit" className="w-full">
                        Add Entry
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>All Trading Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dataLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>User</TableHead>
                              <TableHead>Account</TableHead>
                              <TableHead className="text-right">P&L</TableHead>
                              <TableHead className="text-right">Shares</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tradingData.map((trade) => (
                              <TableRow key={trade.id}>
                                <TableCell>
                                  {new Date(trade.trade_date).toLocaleDateString()}
                                </TableCell>
                                <TableCell>{getUserName(trade.user_id)}</TableCell>
                                <TableCell>{getAccountName(trade.account_id)}</TableCell>
                                <TableCell className={`text-right font-semibold ${Number(trade.net_pnl) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  ${Number(trade.net_pnl).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">{trade.shares_traded}</TableCell>
                                <TableCell>
                                  {trade.is_holiday ? "Holiday" : "Trading"}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteTrade(trade.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
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
            </TabsContent>

            {/* USERS TAB */}
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>All Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    To create new users, go to your backend dashboard and create them via the Authentication section.
                  </p>
                  {dataLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Accounts</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.full_name}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>
                              {accounts.filter((a) => a.user_id === u.user_id).length}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Admin;
