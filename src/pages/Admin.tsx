import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, BarChart3, Calendar, LayoutDashboard } from "lucide-react";
import UserManagement from "@/components/admin/UserManagement";
import TradingDataEntry from "@/components/admin/TradingDataEntry";
import TradingDataView from "@/components/admin/TradingDataView";
import LeavesManagement from "@/components/admin/LeavesManagement";
import AdminDashboard from "@/components/admin/dashboard/AdminDashboard";

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
      <div className="min-h-screen bg-[#0a0a0f] pt-24 pb-12 px-4">
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
                  />
                </div>
                <div className="lg:col-span-2">
                  <TradingDataView 
                    users={users} 
                    accounts={accounts} 
                    tradingData={tradingData} 
                    onRefresh={fetchAllData} 
                  />
                </div>
              </div>
            </TabsContent>

            {/* LEAVES TAB */}
            <TabsContent value="leaves">
              <LeavesManagement users={users} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Admin;
