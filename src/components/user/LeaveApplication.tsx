import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, CheckCircle, TrendingUp, ArrowUpDown } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { getLeaveBalanceSummary } from "@/lib/payoutCalculations";

interface AttendanceRecord {
  id: string;
  record_date: string;
  status: "present" | "absent" | "half_day" | "late";
  is_deductible: boolean;
  notes: string | null;
}

interface Holiday {
  id: string;
  holiday_date: string;
  name: string;
}

interface CarryForward {
  id: string;
  user_id: string;
  year: number;
  carry_forward_days: number;
}

const LeaveApplication = () => {
  const { user } = useAuth();
  
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [carryForwards, setCarryForwards] = useState<CarryForward[]>([]);
  const [joiningDate, setJoiningDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [attendanceRes, holidaysRes, carryRes, profileRes] = await Promise.all([
      supabase.from("attendance_records").select("*").eq("user_id", user.id).order("record_date", { ascending: false }),
      supabase.from("holidays").select("*").order("holiday_date"),
      supabase.from("leave_carry_forward").select("*").eq("user_id", user.id),
      supabase.from("profiles").select("joining_date").eq("user_id", user.id).maybeSingle(),
    ]);

    if (attendanceRes.data) setAttendanceRecords(attendanceRes.data as AttendanceRecord[]);
    if (holidaysRes.data) setHolidays(holidaysRes.data);
    if (carryRes.data) setCarryForwards(carryRes.data as CarryForward[]);
    if (profileRes.data) setJoiningDate(profileRes.data.joining_date ?? null);
    setLoading(false);
  };

  // Filter records by selected month
  const filteredRecords = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));

    return attendanceRecords.filter((r) => {
      const recordDate = parseISO(r.record_date);
      return recordDate >= start && recordDate <= end;
    });
  }, [attendanceRecords, selectedMonth]);

  // Calculate cumulative carry forward starting from Jan 2026
  const carryForwardStats = useMemo(() => {
    const [selYear, selMonth] = selectedMonth.split("-").map(Number);
    const preCarry = carryForwards.find((entry) => entry.year === selYear)?.carry_forward_days ?? 0;
    const summary = getLeaveBalanceSummary(attendanceRecords, selMonth, selYear, preCarry, joiningDate);
    return {
      carry: summary.carryIn,
      pending: summary.monthPending,
      totalAvailable: summary.balance,
      fullDays: summary.fullDaysUsed,
      halfDays: summary.halfDaysUsed,
      lateCount: summary.lateCount,
    };
  }, [attendanceRecords, carryForwards, selectedMonth, joiningDate]);

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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      present: "default",
      absent: "destructive",
      half_day: "secondary",
      late: "outline",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status === "half_day" ? "Half Day" : status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-shimmer h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            Attendance is managed by your admin. View your leave status and history below. For any corrections or queries, please reach out to your manager.
          </p>
        </CardContent>
      </Card>

      {/* Cumulative Carry Forward Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-full bg-primary/10">
              <ArrowUpDown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold font-['Space_Grotesk'] text-foreground">Leave Balance Summary</h3>
              <p className="text-xs text-muted-foreground">
                Cumulative from Jan 2026
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-lg bg-background border">
              <p className="text-xs text-muted-foreground mb-1">Carry Forward</p>
              <p className={`text-xl font-bold ${carryForwardStats.carry >= 0 ? "text-primary" : "text-destructive"}`}>
                {carryForwardStats.carry >= 0 ? "" : ""}{carryForwardStats.carry.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">from prev months</p>
            </div>
            <div className="p-3 rounded-lg bg-background border">
              <p className="text-xs text-muted-foreground mb-1">This Month</p>
              <p className={`text-xl font-bold ${carryForwardStats.pending >= 0 ? "text-primary" : "text-destructive"}`}>
                {carryForwardStats.pending >= 0 ? "" : ""}{carryForwardStats.pending.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">pending</p>
            </div>
            <div className="p-3 rounded-lg bg-background border">
              <p className="text-xs text-muted-foreground mb-1">Total Available</p>
              <p className={`text-xl font-bold ${carryForwardStats.totalAvailable >= 0 ? "text-primary" : "text-destructive"}`}>
                {carryForwardStats.totalAvailable.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">balance</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="p-2 rounded-full bg-destructive/10">
                  <Calendar className="h-5 w-5 text-destructive" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Full Days</p>
              <p className="text-2xl font-bold">{carryForwardStats.fullDays}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="p-2 rounded-full bg-secondary">
                  <Calendar className="h-5 w-5 text-secondary-foreground" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Half Days</p>
              <p className="text-2xl font-bold">{carryForwardStats.halfDays}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="p-2 rounded-full bg-primary/10">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-primary">{carryForwardStats.pending.toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="p-2 rounded-full bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Late Count</p>
              <p className="text-2xl font-bold">{carryForwardStats.lateCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-['Space_Grotesk']">Attendance History</CardTitle>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40">
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
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No attendance records for {format(parseISO(`${selectedMonth}-01`), "MMMM yyyy")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(record.record_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-muted-foreground">{record.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Holidays */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-['Space_Grotesk']">
            <Calendar className="h-5 w-5" />
            Upcoming Holidays
          </CardTitle>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No holidays defined</p>
          ) : (
            <div className="space-y-2">
              {holidays
                .filter((h) => parseISO(h.holiday_date) >= new Date())
                .slice(0, 5)
                .map((h) => (
                  <div key={h.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <span className="font-medium">{h.name}</span>
                    <span className="text-muted-foreground">
                      {format(parseISO(h.holiday_date), "MMM d, yyyy")}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeaveApplication;