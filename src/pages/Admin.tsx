import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, BarChart3, Calendar, LayoutDashboard, DollarSign, Wallet, Building2, FileText, Settings, Landmark, ClipboardCheck, CalendarRange, TrendingUp, Lock } from "lucide-react";
import UserManagement from "@/components/admin/UserManagement";
import TradingDataEntry from "@/components/admin/TradingDataEntry";
import TradingDataView from "@/components/admin/TradingDataView";
import LeavesManagement from "@/components/admin/LeavesManagement";
import AdminDashboard from "@/components/admin/dashboard/AdminDashboard";
import PayoutTracker from "@/components/admin/PayoutTracker";
import PayoutSheet from "@/components/admin/PayoutSheet";
import SalaryBackup from "@/components/admin/SalaryBackup";
import DeskCost from "@/components/admin/DeskCost";
import TraderConfig from "@/components/admin/TraderConfig";
import PoolView from "@/components/admin/PoolView";
import SingleDayPnL from "@/components/admin/SingleDayPnL";
import MonthlyPnL from "@/components/admin/MonthlyPnL";
import TraderProgress from "@/components/admin/TraderProgress";
import LtoView from "@/components/admin/LtoView";

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

const Admin = () => {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [tradingData, setTradingData] = useState<TradingData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedTrader, setSelectedTrader] = useState("");

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

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-background pt-24 pb-12 px-4">
        <div className="max-w-[1600px] mx-auto">
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="bg-muted/30 border border-border/50">
              <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-background">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-background">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="trading" className="gap-2 data-[state=active]:bg-background">
                <BarChart3 className="h-4 w-4" />
                Trading Data
              </TabsTrigger>
              <TabsTrigger value="leaves" className="gap-2 data-[state=active]:bg-background">
                <Calendar className="h-4 w-4" />
                Leaves
              </TabsTrigger>
              <TabsTrigger value="payouts" className="gap-2 data-[state=active]:bg-background">
                <FileText className="h-4 w-4" />
                Payout Sheet
              </TabsTrigger>
              <TabsTrigger value="payout-tracker" className="gap-2 data-[state=active]:bg-background">
                <DollarSign className="h-4 w-4" />
                Payout Tracker
              </TabsTrigger>
              <TabsTrigger value="salary-backup" className="gap-2 data-[state=active]:bg-background">
                <Wallet className="h-4 w-4" />
                Salary Backup
              </TabsTrigger>
              <TabsTrigger value="desk-cost" className="gap-2 data-[state=active]:bg-background">
                <Building2 className="h-4 w-4" />
                Desk Cost
              </TabsTrigger>
              <TabsTrigger value="trader-config" className="gap-2 data-[state=active]:bg-background">
                <Settings className="h-4 w-4" />
                Trader Config
              </TabsTrigger>
              <TabsTrigger value="pool" className="gap-2 data-[state=active]:bg-background">
                <Landmark className="h-4 w-4" />
                Pool
              </TabsTrigger>
              <TabsTrigger value="single-day" className="gap-2 data-[state=active]:bg-background">
                <ClipboardCheck className="h-4 w-4" />
                Single Day P&L
              </TabsTrigger>
              <TabsTrigger value="monthly-pnl" className="gap-2 data-[state=active]:bg-background">
                <CalendarRange className="h-4 w-4" />
                Monthly P&L
              </TabsTrigger>
              <TabsTrigger value="progress" className="gap-2 data-[state=active]:bg-background">
                <TrendingUp className="h-4 w-4" />
                Trader Progress
              </TabsTrigger>
            </TabsList>

            {/* DASHBOARD TAB */}
            <TabsContent value="dashboard">
              <AdminDashboard 
                users={users} 
                accounts={accounts} 
                tradingData={tradingData} 
              />
            </TabsContent>

            {/* USERS TAB */}
            <TabsContent value="users">
              <UserManagement 
                users={users} 
                accounts={accounts} 
                onRefresh={fetchAllData} 
              />
            </TabsContent>

            {/* TRADING DATA TAB */}
            <TabsContent value="trading">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <TradingDataEntry 
                    users={users} 
                    accounts={accounts} 
                    onRefresh={fetchAllData}
                    onTraderChange={setSelectedTrader}
                  />
                </div>
                <div className="lg:col-span-2">
                  <TradingDataView 
                    users={users} 
                    accounts={accounts} 
                    tradingData={tradingData} 
                    onRefresh={fetchAllData}
                    filterByTrader={selectedTrader}
                  />
                </div>
              </div>
            </TabsContent>

            {/* LEAVES TAB */}
            <TabsContent value="leaves">
              <LeavesManagement users={users} />
            </TabsContent>

            {/* PAYOUT SHEET TAB */}
            <TabsContent value="payouts">
              <PayoutSheet users={users} />
            </TabsContent>

            {/* PAYOUT TRACKER TAB */}
            <TabsContent value="payout-tracker">
              <PayoutTracker users={users} />
            </TabsContent>

            {/* SALARY BACKUP TAB */}
            <TabsContent value="salary-backup">
              <SalaryBackup users={users} />
            </TabsContent>

            {/* DESK COST TAB */}
            <TabsContent value="desk-cost">
              <DeskCost users={users} />
            </TabsContent>

            {/* TRADER CONFIG TAB */}
            <TabsContent value="trader-config">
              <TraderConfig users={users} />
            </TabsContent>

            {/* POOL TAB */}
            <TabsContent value="pool">
              <PoolView users={users} />
            </TabsContent>

            {/* SINGLE DAY P&L TAB */}
            <TabsContent value="single-day">
              <SingleDayPnL
                users={users}
                accounts={accounts}
                tradingData={tradingData}
                onRefresh={fetchAllData}
              />
            </TabsContent>

            {/* MONTHLY P&L TAB */}
            <TabsContent value="monthly-pnl">
              <MonthlyPnL
                users={users}
                accounts={accounts}
                tradingData={tradingData}
                onRefresh={fetchAllData}
              />
            </TabsContent>
            {/* TRADER PROGRESS TAB */}
            <TabsContent value="progress">
              <TraderProgress />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Admin;
