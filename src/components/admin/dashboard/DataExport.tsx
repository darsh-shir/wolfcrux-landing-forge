import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Download, FileSpreadsheet, Users, BarChart3 } from "lucide-react";
import { EmployeeStats, DailyPnL } from "./types";
import { format } from "date-fns";

interface DataExportProps {
  employees: EmployeeStats[];
  dailyPnLData: DailyPnL[];
  getEmployeeDailyPnL: (userId: string) => DailyPnL[];
}

const DataExport = ({ employees, dailyPnLData, getEmployeeDailyPnL }: DataExportProps) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers.map((header) => {
          const value = row[header];
          // Escape commas and quotes
          if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const exportCompanyPnL = () => {
    setExporting(true);
    const data = dailyPnLData.map((d) => ({
      Date: d.date,
      "Daily PnL": d.pnl.toFixed(2),
      "Cumulative PnL": d.cumulativePnl.toFixed(2),
      Equity: d.equity.toFixed(2),
    }));
    downloadCSV(data, "company_pnl_history");
    setExporting(false);
  };

  const exportEmployeeSummary = () => {
    setExporting(true);
    const data = employees.map((e) => ({
      Name: e.name,
      Email: e.email,
      Status: e.status,
      "Total PnL": e.totalPnl.toFixed(2),
      "Today PnL": e.todayPnl.toFixed(2),
      "Max Profit (Day)": e.maxProfit.toFixed(2),
      "Max Loss (Day)": e.maxLoss.toFixed(2),
      "Win Rate %": e.winRate.toFixed(2),
      "Avg Daily PnL": e.avgDailyPnl.toFixed(2),
      "Trading Days": e.tradingDays,
      "Winning Days": e.winningDays,
      "Losing Days": e.losingDays,
    }));
    downloadCSV(data, "employee_performance_summary");
    setExporting(false);
  };

  const exportEmployeeEquity = () => {
    if (!selectedEmployee) return;
    setExporting(true);
    const employeeData = getEmployeeDailyPnL(selectedEmployee);
    const employee = employees.find((e) => e.userId === selectedEmployee);
    const data = employeeData.map((d) => ({
      Date: d.date,
      "Daily PnL": d.pnl.toFixed(2),
      "Cumulative PnL": d.cumulativePnl.toFixed(2),
      Equity: d.equity.toFixed(2),
    }));
    downloadCSV(data, `${employee?.name.replace(/\s+/g, "_")}_equity_curve`);
    setExporting(false);
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Data Export
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Company PnL Export */}
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              <h3 className="font-medium">Company PnL History</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Export daily company-wide PnL, cumulative PnL, and equity curve data.
            </p>
            <Button 
              onClick={exportCompanyPnL} 
              disabled={exporting || dailyPnLData.length === 0}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Employee Summary Export */}
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-5 w-5 text-blue-600" />
              <h3 className="font-medium">Employee Summary</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Export all employee performance metrics including PnL and win rates.
            </p>
            <Button 
              onClick={exportEmployeeSummary} 
              disabled={exporting || employees.length === 0}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Individual Equity Export */}
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
              <h3 className="font-medium">Employee Equity Curve</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Export detailed equity curve for a specific employee.
            </p>
            <div className="space-y-2">
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.userId} value={e.userId}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={exportEmployeeEquity} 
                disabled={exporting || !selectedEmployee}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataExport;
