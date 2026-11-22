import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, BarChart3, Calendar, LayoutDashboard, DollarSign, Wallet, Building2, FileText, Settings, Landmark, ClipboardCheck, CalendarRange, TrendingUp, Lock, History, Folder, Fingerprint, Inbox, Briefcase, CalendarCheck } from "lucide-react";
import EmployeeDocuments from "@/components/admin/EmployeeDocuments";
import ContactMessages from "@/components/admin/ContactMessages";
import JobApplications from "@/components/admin/JobApplications";
import { DB_UPDATE_APPLIED } from "@/lib/features";
import { isExEmployee, isClosedAccount } from "@/lib/employees";
import PayoutRun, { defaultStoMonth } from "@/components/admin/PayoutRun";
import TodayBox from "@/components/admin/TodayBox";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { getAllTradeRows, invalidateTradeCache } from "@/lib/tradeCache";
import BiometricAttendance from "@/components/admin/BiometricAttendance";
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
import BaselineSeeder from "@/components/admin/BaselineSeeder";
import MonthlyMilestones from "@/components/admin/MonthlyMilestones";


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
  // Ex-employees and closed accounts keep their history but aren't offered for new work.
  const activeUsers = users.filter((u) => !isExEmployee(u as { employee_role?: string }));
  const openAccounts = accounts.filter((a) => !isClosedAccount(a));
  const [tradingData, setTradingData] = useState<TradingData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedTrader, setSelectedTrader] = useState("");
  // Reopen the page the admin was on (for this browser tab's session).
  const [activeTab, setActiveTabRaw] = useState(() => {
    try {
      return sessionStorage.getItem("wolfcrux.admin.tab") || "dashboard";
    } catch {
      return "dashboard";
    }
  });
  const setActiveTab = (tab: string) => {
    setActiveTabRaw(tab);
    try {
      sessionStorage.setItem("wolfcrux.admin.tab", tab);
    } catch {
      /* storage unavailable */
    }
  };
  const [payoutInitial, setPayoutInitial] = useState<{ traderId: string; month: number; year: number } | null>(null);

  const openPayoutFor = (traderId: string, month: number, year: number) => {
    setPayoutInitial({ traderId, month, year });
    setActiveTab("payouts");
  };

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

    // Fetch ALL trading_data rows in pages of 1000 to bypass the Supabase default row limit
    // Trades may have changed: drop the short-lived payout cache.
    invalidateTradeCache();
    const fetchAllTrades = async (): Promise<TradingData[]> => {
      try {
        // Shared with the payout screens, so the history downloads once.
        const rows = (await getAllTradeRows()) as TradingData[];
        return [...rows].sort((a, b) => b.trade_date.localeCompare(a.trade_date) || a.id.localeCompare(b.id));
      } catch (e) {
        toast({
          title: "Trade history didn't fully load",
          description: `${e instanceof Error ? e.message : String(e)}. Refresh the page before working on payouts.`,
          variant: "destructive",
        });
        return [];
      }
    };

    const [usersRes, accountsRes, allTrades] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("trading_accounts").select("*").order("account_name"),
      fetchAllTrades(),
    ]);

    if (usersRes.data) setUsers(usersRes.data);
    if (accountsRes.data) setAccounts(accountsRes.data);
    setTradingData(allTrades);

    setDataLoading(false);
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner-ring" />
      </div>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-background pt-20 sm:pt-24 pb-12 px-3 sm:px-4 animate-fade-in">
        <div className="max-w-[1600px] mx-auto">
          {/* Payday reminder: shown on the 10th of each month */}
          {new Date().getDate() === 10 && activeTab !== "payout-run" && (() => {
            const due = defaultStoMonth();
            return (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                <CalendarCheck className="h-4 w-4 text-primary" />
                <span>
                  {["January","February","March","April","May","June","July","August","September","October","November","December"][due.month - 1]} {due.year} STO is due today (10th).
                </span>
                <button type="button" className="ml-auto font-medium text-primary underline" onClick={() => setActiveTab("payout-run")}>
                  Open Payout Run
                </button>
              </div>
            );
          })()}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <AdminNav activeTab={activeTab} onSelect={setActiveTab} />

            {/* DASHBOARD TAB */}
            <TabsContent value="dashboard">
              <TodayBox users={activeUsers} tradingData={tradingData} onOpen={setActiveTab} />
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
                    users={activeUsers} 
                    accounts={openAccounts} 
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
              <LeavesManagement users={activeUsers} />
            </TabsContent>

            {/* PAYOUT RUN TAB — everyone's STO due this month */}
            <TabsContent value="payout-run">
              <PayoutRun onOpenSheet={openPayoutFor} />
            </TabsContent>

            {/* PAYOUT SHEET TAB */}
            <TabsContent value="payouts">
              <PayoutSheet
                users={users}
                initialTraderId={payoutInitial?.traderId}
                initialMonth={payoutInitial?.month}
                initialYear={payoutInitial?.year}
              />
            </TabsContent>

            {/* PAYOUT TRACKER TAB */}
            <TabsContent value="payout-tracker">
              <PayoutTracker users={users} />
            </TabsContent>

            {/* SALARY BACKUP TAB */}
            <TabsContent value="salary-backup">
              <SalaryBackup users={activeUsers} />
            </TabsContent>

            {/* DESK COST TAB */}
            <TabsContent value="desk-cost">
              <DeskCost users={activeUsers} />
            </TabsContent>

            {/* TRADER CONFIG TAB */}
            <TabsContent value="trader-config">
              <TraderConfig users={activeUsers} />
            </TabsContent>

            {/* POOL TAB */}
            <TabsContent value="pool">
              <PoolView users={activeUsers} />
            </TabsContent>

            {/* LTO TAB */}
            <TabsContent value="lto">
              <LtoView users={users} />
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
                onOpenPayout={openPayoutFor}
              />
            </TabsContent>
            {/* TRADER PROGRESS TAB */}
            <TabsContent value="progress">
              <TraderProgress />
            </TabsContent>

            {/* MONTHLY MILESTONES (MANUAL) TAB */}
            <TabsContent value="milestones">
              <MonthlyMilestones users={activeUsers} />
            </TabsContent>


            {/* BASELINE SEEDER TAB */}
            <TabsContent value="baseline">
              <BaselineSeeder users={activeUsers} />
            </TabsContent>

            {/* DOCUMENTS TAB */}
            <TabsContent value="documents">
              <EmployeeDocuments users={users} />
            </TabsContent>

            <TabsContent value="biometric">
              <BiometricAttendance />
            </TabsContent>

            {DB_UPDATE_APPLIED && (
              <>
                <TabsContent value="messages">
                  <ContactMessages />
                </TabsContent>

                <TabsContent value="applications">
                  <JobApplications />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </div>
      <Footer />
    </>
  );
};


/** Admin tabs grouped into sections: pick a section, then one of its pages. */
const ADMIN_SECTIONS: { name: string; tabs: { value: string; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  { name: "Home", tabs: [{ value: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    name: "People",
    tabs: [
      { value: "users", label: "Users", icon: Users },
      { value: "leaves", label: "Leaves", icon: Calendar },
      { value: "documents", label: "Documents", icon: Folder },
      { value: "biometric", label: "Biometric", icon: Fingerprint },
      ...(DB_UPDATE_APPLIED
        ? [
            { value: "messages", label: "Messages", icon: Inbox },
            { value: "applications", label: "Applications", icon: Briefcase },
          ]
        : []),
    ],
  },
  {
    name: "Trading",
    tabs: [
      { value: "trading", label: "Trading Data", icon: BarChart3 },
      { value: "single-day", label: "Single Day P&L", icon: ClipboardCheck },
      { value: "monthly-pnl", label: "Monthly P&L", icon: CalendarRange },
    ],
  },
  {
    name: "Payouts",
    tabs: [
      { value: "payout-run", label: "Payout Run", icon: CalendarCheck },
      { value: "payouts", label: "Payout Sheet", icon: FileText },
      { value: "payout-tracker", label: "Payout Tracker", icon: DollarSign },
      { value: "salary-backup", label: "Salary Backup", icon: Wallet },
      { value: "desk-cost", label: "Desk Cost", icon: Building2 },
      { value: "pool", label: "Pool", icon: Landmark },
      { value: "lto", label: "LTO", icon: Lock },
    ],
  },
  {
    name: "Levels & setup",
    tabs: [
      { value: "progress", label: "Trader Progress", icon: TrendingUp },
      { value: "milestones", label: "Milestones", icon: TrendingUp },
      { value: "trader-config", label: "Trader Config", icon: Settings },
      { value: "baseline", label: "Baseline Seeder", icon: History },
    ],
  },
];

const AdminNav = ({ activeTab, onSelect }: { activeTab: string; onSelect: (tab: string) => void }) => {
  const section = ADMIN_SECTIONS.find((sec) => sec.tabs.some((t) => t.value === activeTab)) ?? ADMIN_SECTIONS[0];
  return (
    <div className="space-y-2">
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none">
        <div className="flex w-max gap-1 rounded-lg border border-border/50 bg-muted/30 p-1" role="navigation" aria-label="Admin sections">
          {ADMIN_SECTIONS.map((sec) => {
            const active = sec === section;
            return (
              <button
                key={sec.name}
                type="button"
                onClick={() => !active && onSelect(sec.tabs[0].value)}
                aria-current={active ? "true" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {sec.name}
              </button>
            );
          })}
        </div>
      </div>
      {section.tabs.length > 1 && (
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none">
          <TabsList className="w-max bg-transparent p-0 gap-1">
            {section.tabs.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="gap-2 whitespace-nowrap rounded-md border border-transparent data-[state=active]:border-border data-[state=active]:bg-background"
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      )}
    </div>
  );
};

export default Admin;
