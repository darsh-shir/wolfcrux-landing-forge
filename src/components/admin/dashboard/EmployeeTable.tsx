import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Search, ArrowUpDown, ChevronUp, ChevronDown, Eye } from "lucide-react";
import { EmployeeStats } from "./types";

interface EmployeeTableProps {
  employees: EmployeeStats[];
  onSelectEmployee: (employee: EmployeeStats) => void;
}

type SortField = keyof EmployeeStats;
type SortDirection = "asc" | "desc";

const EmployeeTable = ({ employees, onSelectEmployee }: EmployeeTableProps) => {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalPnl");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [performanceFilter, setPerformanceFilter] = useState<"all" | "profit" | "loss">("all");

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredAndSortedEmployees = useMemo(() => {
    let result = [...employees];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(searchLower) ||
          e.email.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter);
    }

    // Performance filter
    if (performanceFilter === "profit") {
      result = result.filter((e) => e.totalPnl > 0);
    } else if (performanceFilter === "loss") {
      result = result.filter((e) => e.totalPnl < 0);
    }

    // Sort
    result.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return result;
  }, [employees, search, sortField, sortDirection, statusFilter, performanceFilter]);

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <CardTitle className="text-lg font-semibold">Employee Performance</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={performanceFilter} onValueChange={(v) => setPerformanceFilter(v as typeof performanceFilter)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Performance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Performance</SelectItem>
                <SelectItem value="profit">Profitable</SelectItem>
                <SelectItem value="loss">In Loss</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHeader field="name">Name</SortableHeader>
                <TableHead>Status</TableHead>
                <SortableHeader field="totalPnl">Total PnL</SortableHeader>
                <SortableHeader field="todayPnl">Today</SortableHeader>
                <SortableHeader field="maxProfit">Max Profit</SortableHeader>
                <SortableHeader field="maxLoss">Max Loss</SortableHeader>
                <SortableHeader field="winRate">Win Rate</SortableHeader>
                <SortableHeader field="avgDailyPnl">Avg Daily</SortableHeader>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No employees found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedEmployees.map((employee) => (
                  <TableRow 
                    key={employee.userId}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => onSelectEmployee(employee)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium text-foreground">{employee.name}</div>
                        <div className="text-xs text-muted-foreground">{employee.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={employee.status === "Active" ? "default" : "secondary"}
                        className={employee.status === "Active" 
                          ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" 
                          : "bg-muted text-muted-foreground"
                        }
                      >
                        {employee.status}
                      </Badge>
                    </TableCell>
                    <TableCell className={`font-semibold ${employee.totalPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatCurrency(employee.totalPnl)}
                    </TableCell>
                    <TableCell className={employee.todayPnl >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {formatCurrency(employee.todayPnl)}
                    </TableCell>
                    <TableCell className="text-emerald-600">
                      {formatCurrency(employee.maxProfit)}
                    </TableCell>
                    <TableCell className="text-red-600">
                      {formatCurrency(employee.maxLoss)}
                    </TableCell>
                    <TableCell>
                      <span className={employee.winRate >= 50 ? "text-emerald-600" : "text-orange-600"}>
                        {employee.winRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className={employee.avgDailyPnl >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {formatCurrency(employee.avgDailyPnl)}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEmployee(employee);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredAndSortedEmployees.length} of {employees.length} employees
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeTable;
