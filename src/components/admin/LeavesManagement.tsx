import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Trash2, Edit, UserCheck, Clock } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, getDaysInMonth } from "date-fns";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface Holiday {
  id: string;
  holiday_date: string;
  name: string;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  record_date: string;
  status: "present" | "absent" | "half_day" | "late";
  is_deductible: boolean;
  notes: string | null;
}

interface MonthlySummary {
  id: string;
  user_id: string;
  year: number;
  month: number;
  allowed_full_days: number;
  allowed_half_days: number;
  used_full_days: number;
  used_half_days: number;
  late_count: number;
  deductible_count: number;
}

interface LeavesManagementProps {
  users: Profile[];
}

const LeavesManagement = ({ users }: LeavesManagementProps) => {
  const { toast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedTrader, setSelectedTrader] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));

  // Holiday form
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");

  // Attendance form
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [attendanceTrader, setAttendanceTrader] = useState("");
  const [attendanceDate, setAttendanceDate] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState<"present" | "absent" | "half_day" | "late">("present");
  const [attendanceNotes, setAttendanceNotes] = useState("");
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: "holiday" | "attendance"; id: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [holidaysRes, attendanceRes, summariesRes] = await Promise.all([
      supabase.from("holidays").select("*").order("holiday_date"),
      supabase.from("attendance_records").select("*").order("record_date", { ascending: false }),
      supabase.from("monthly_leave_summary").select("*"),
    ]);

    if (holidaysRes.data) setHolidays(holidaysRes.data);
    if (attendanceRes.data) setAttendanceRecords(attendanceRes.data as AttendanceRecord[]);
    if (summariesRes.data) setMonthlySummaries(summariesRes.data as MonthlySummary[]);
    setLoading(false);
  };

  const getUserName = (userId: string) => {
    const u = users.find((p) => p.user_id === userId);
    return u?.full_name || "Unknown";
  };

  // Filter records by selected month and trader
  const filteredRecords = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));

    return attendanceRecords.filter((r) => {
      const recordDate = parseISO(r.record_date);
      const inRange = recordDate >= start && recordDate <= end;
      const matchesTrader = selectedTrader === "all" || r.user_id === selectedTrader;
      return inRange && matchesTrader;
    });
  }, [attendanceRecords, selectedMonth, selectedTrader]);

  // Calculate monthly stats per trader
  const traderMonthlyStats = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const currentYear = new Date().getFullYear();
    
    const stats: Record<string, {
      fullDays: number;
      halfDays: number;
      lateCount: number;
      pending: number;
      totalThisYear: number;
    }> = {};

    users.forEach((u) => {
      // Monthly records
      const userRecords = attendanceRecords.filter((r) => {
        const recordDate = parseISO(r.record_date);
        return r.user_id === u.user_id &&
          recordDate.getFullYear() === year &&
          recordDate.getMonth() + 1 === month;
      });

      // Yearly records
      const yearlyRecords = attendanceRecords.filter((r) => {
        const recordDate = parseISO(r.record_date);
        return r.user_id === u.user_id &&
          recordDate.getFullYear() === currentYear &&
          (r.status === "absent" || r.status === "half_day");
      });

      const fullDays = userRecords.filter((r) => r.status === "absent").length;
      const halfDays = userRecords.filter((r) => r.status === "half_day").length;
      const lateCount = userRecords.filter((r) => r.status === "late").length;
      
      // Pending = 1.5 - used (max 1 full + 0.5 half)
      const usedInLimit = Math.min(fullDays, 1) + Math.min(halfDays, 1) * 0.5;
      const pending = Math.max(0, 1.5 - usedInLimit);

      // Total leaves this year (full days + half days as 0.5)
      const totalThisYear = yearlyRecords.reduce((sum, r) => {
        if (r.status === "absent") return sum + 1;
        if (r.status === "half_day") return sum + 0.5;
        return sum;
      }, 0);

      stats[u.user_id] = {
        fullDays,
        halfDays,
        lateCount,
        pending,
        totalThisYear,
      };
    });

    return stats;
  }, [users, attendanceRecords, selectedMonth]);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayName) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("holidays").insert({
      holiday_date: holidayDate,
      name: holidayName,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Holiday added" });
      setShowHolidayDialog(false);
      setHolidayDate("");
      setHolidayName("");
      fetchData();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "holiday") {
      const { error } = await supabase.from("holidays").delete().eq("id", deleteTarget.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Deleted", description: "Holiday removed" });
        fetchData();
      }
    } else if (deleteTarget.type === "attendance") {
      const { error } = await supabase.from("attendance_records").delete().eq("id", deleteTarget.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Deleted", description: "Attendance record removed" });
        fetchData();
      }
    }

    setDeleteTarget(null);
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendanceTrader || !attendanceDate) {
      toast({ title: "Error", description: "Please select trader and date", variant: "destructive" });
      return;
    }

    // Check if exceeds monthly limit
    const [year, month] = attendanceDate.split("-").map(Number);
    const existingRecords = attendanceRecords.filter((r) => {
      const recordDate = parseISO(r.record_date);
      return r.user_id === attendanceTrader &&
        recordDate.getFullYear() === year &&
        recordDate.getMonth() + 1 === month &&
        r.id !== editingAttendance?.id;
    });

    const usedFullDays = existingRecords.filter((r) => r.status === "absent").length;
    const usedHalfDays = existingRecords.filter((r) => r.status === "half_day").length;

    let isDeductible = false;
    if (attendanceStatus === "absent" && usedFullDays >= 1) {
      isDeductible = true;
    } else if (attendanceStatus === "half_day" && usedHalfDays >= 1) {
      isDeductible = true;
    }

    if (editingAttendance) {
      const { error } = await supabase.from("attendance_records")
        .update({
          user_id: attendanceTrader,
          record_date: attendanceDate,
          status: attendanceStatus,
          is_deductible: isDeductible,
          notes: attendanceNotes || null,
        })
        .eq("id", editingAttendance.id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Attendance updated" });
        resetAttendanceForm();
        fetchData();
      }
    } else {
      const { error } = await supabase.from("attendance_records").insert({
        user_id: attendanceTrader,
        record_date: attendanceDate,
        status: attendanceStatus,
        is_deductible: isDeductible,
        notes: attendanceNotes || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Error", description: "Record already exists for this date", variant: "destructive" });
        } else {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      } else {
        toast({ title: "Success", description: `Marked as ${attendanceStatus}${isDeductible ? " (Deductible)" : ""}` });
        resetAttendanceForm();
        fetchData();
      }
    }
  };

  const resetAttendanceForm = () => {
    setShowAttendanceDialog(false);
    setAttendanceTrader("");
    setAttendanceDate("");
    setAttendanceStatus("present");
    setAttendanceNotes("");
    setEditingAttendance(null);
  };

  const openEditAttendance = (record: AttendanceRecord) => {
    setEditingAttendance(record);
    setAttendanceTrader(record.user_id);
    setAttendanceDate(record.record_date);
    setAttendanceStatus(record.status);
    setAttendanceNotes(record.notes || "");
    setShowAttendanceDialog(true);
  };

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

  return (
    <div className="space-y-6">
      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="attendance">
            <UserCheck className="h-4 w-4 mr-2" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="summary">
            <Clock className="h-4 w-4 mr-2" />
            Monthly Summary
          </TabsTrigger>
          <TabsTrigger value="holidays">
            <Calendar className="h-4 w-4 mr-2" />
            Holidays
          </TabsTrigger>
        </TabsList>

        {/* ATTENDANCE TAB */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Attendance Management</CardTitle>
              <Dialog open={showAttendanceDialog} onOpenChange={(open) => {
                if (!open) resetAttendanceForm();
                else setShowAttendanceDialog(true);
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" />
                    Mark Attendance
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingAttendance ? "Edit Attendance" : "Mark Attendance"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSaveAttendance} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Trader</Label>
                      <Select value={attendanceTrader} onValueChange={setAttendanceTrader}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select trader" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>
                              {u.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={attendanceStatus} onValueChange={(v) => setAttendanceStatus(v as typeof attendanceStatus)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent (Full Day)</SelectItem>
                          <SelectItem value="half_day">Half Day</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes (optional)</Label>
                      <Input
                        value={attendanceNotes}
                        onChange={(e) => setAttendanceNotes(e.target.value)}
                        placeholder="Any remarks..."
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" className="w-full">
                        {editingAttendance ? "Update" : "Save"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Select value={selectedTrader} onValueChange={setSelectedTrader}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Traders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Traders</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              </div>

              {filteredRecords.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No attendance records for selected period</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Trader</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {format(parseISO(record.record_date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{getUserName(record.user_id)}</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell className="text-muted-foreground">{record.notes || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditAttendance(record)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget({ type: "attendance", id: record.id })}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MONTHLY SUMMARY TAB */}
        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Summary - {format(parseISO(`${selectedMonth}-01`), "MMMM yyyy")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
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
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trader</TableHead>
                    <TableHead className="text-center">Allowed</TableHead>
                    <TableHead className="text-center">Full Days Used</TableHead>
                    <TableHead className="text-center">Half Days Used</TableHead>
                    <TableHead className="text-center">Late Count</TableHead>
                    <TableHead className="text-center">Pending</TableHead>
                    <TableHead className="text-center">Total (This Year)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const stats = traderMonthlyStats[user.user_id] || {
                      fullDays: 0,
                      halfDays: 0,
                      lateCount: 0,
                      pending: 1.5,
                      totalThisYear: 0,
                    };

                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm text-muted-foreground">
                            1 Full + 1 Half
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={stats.fullDays > 1 ? "destructive" : "secondary"}>
                            {stats.fullDays}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={stats.halfDays > 1 ? "destructive" : "secondary"}>
                            {stats.halfDays}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={stats.lateCount > 0 ? "outline" : "secondary"}>
                            {stats.lateCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="default" className="bg-primary">
                            {stats.pending.toFixed(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">
                            {stats.totalThisYear}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HOLIDAYS TAB */}
        <TabsContent value="holidays">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Holidays</CardTitle>
              <Dialog open={showHolidayDialog} onOpenChange={setShowHolidayDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" />
                    Add Holiday
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Holiday</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddHoliday} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={holidayDate}
                        onChange={(e) => setHolidayDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Holiday Name</Label>
                      <Input
                        value={holidayName}
                        onChange={(e) => setHolidayName(e.target.value)}
                        placeholder="e.g., Christmas Day"
                      />
                    </div>
                    <Button type="submit" className="w-full">Add Holiday</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {holidays.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No holidays defined</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holidays.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{format(parseISO(h.holiday_date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="font-medium">{h.name}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget({ type: "holiday", id: h.id })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this {deleteTarget?.type} record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeavesManagement;