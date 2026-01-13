import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Users, GitCompare, FileDown } from "lucide-react";
import { useDashboardData } from "./hooks/useDashboardData";
import { DateRangeFilter, EmployeeStats } from "./types";
import CompanyKPIs from "./CompanyKPIs";
import CompanyCharts from "./CompanyCharts";
import EmployeeTable from "./EmployeeTable";
import EmployeeComparison from "./EmployeeComparison";
import EmployeeDetailView from "./EmployeeDetailView";
import DataExport from "./DataExport";
import DateRangeFilterComponent from "./DateRangeFilter";

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
}

interface AdminDashboardProps {
  users: Profile[];
  accounts: TradingAccount[];
  tradingData: TradingData[];
}

const AdminDashboard = ({ users, accounts, tradingData }: AdminDashboardProps) => {
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>("lifetime");
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date }>();
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeStats | null>(null);

  const { 
    companyStats, 
    employeeStats, 
    dailyPnLData,
    getEmployeeDailyPnL 
  } = useDashboardData({
    users,
    tradingData,
    accounts,
    dateFilter,
    customDateRange,
  });

  const handleSelectEmployee = (employee: EmployeeStats) => {
    setSelectedEmployee(employee);
  };

  const handleCloseEmployeeView = () => {
    setSelectedEmployee(null);
  };

  return (
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">Complete visibility into company performance</p>
        </div>
        <DateRangeFilterComponent
          value={dateFilter}
          onChange={setDateFilter}
          customDateRange={customDateRange}
          onCustomDateChange={setCustomDateRange}
        />
      </div>

      {/* Company KPIs */}
      <CompanyKPIs stats={companyStats} />

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-2">
            <Users className="h-4 w-4" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2">
            <GitCompare className="h-4 w-4" />
            Comparison
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <FileDown className="h-4 w-4" />
            Export
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <CompanyCharts dailyPnLData={dailyPnLData} />
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-6">
          {selectedEmployee ? (
            <EmployeeDetailView
              employee={selectedEmployee}
              dailyPnL={getEmployeeDailyPnL(selectedEmployee.userId)}
              onClose={handleCloseEmployeeView}
            />
          ) : (
            <EmployeeTable
              employees={employeeStats}
              onSelectEmployee={handleSelectEmployee}
            />
          )}
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison">
          <EmployeeComparison
            employees={employeeStats}
            getEmployeeDailyPnL={getEmployeeDailyPnL}
          />
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export">
          <DataExport
            employees={employeeStats}
            dailyPnLData={dailyPnLData}
            getEmployeeDailyPnL={getEmployeeDailyPnL}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
