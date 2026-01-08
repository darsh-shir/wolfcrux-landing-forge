import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, CheckCircle } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

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

const LeaveApplication = () => {
  const { user } = useAuth();
  
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [attendanceRes, holidaysRes] = await Promise.all([
      supabase.from("attendance_records").select("*").eq("user_id", user.id).order("record_date", { ascending: false }),
      supabase.from("holidays").select("*").order("holiday_date"),
    ]);

    if (attendanceRes.data) setAttendanceRecords(attendanceRes.data as AttendanceRecord[]);
    if (holidaysRes.data) setHolidays(holidaysRes.data);
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

  // Calculate stats for selected month
  const monthlyStats = useMemo(() => {
    const fullDays = filteredRecords.filter((r) => r.status === "absent").length;
    const halfDays = filteredRecords.filter((r) => r.status === "half_day").length;
    const lateCount = filteredRecords.filter((r) => r.status === "late").length;

    // Remaining from monthly allowance (1 full + 1 half = 1.5)
    const usedInLimit = Math.min(fullDays, 1) + Math.min(halfDays, 1) * 0.5;
    const pending = 1.5 - usedInLimit;

    return {
      fullDays,
      halfDays,
      lateCount,
      pending: Math.max(0, pending),
    };
  }, [filteredRecords]);

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
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
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
            Attendance is managed by admin. You can view your leave status and history below.
          </p>
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
              <p className="text-2xl font-bold">{monthlyStats.fullDays}</p>
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
              <p className="text-2xl font-bold">{monthlyStats.halfDays}</p>
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
              <p className="text-2xl font-bold text-primary">{monthlyStats.pending.toFixed(1)}</p>
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
              <p className="text-2xl font-bold">{monthlyStats.lateCount}</p>
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