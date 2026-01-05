import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Check, X, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";

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

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_date: string;
  leave_type: "full" | "half";
  status: "pending" | "approved" | "rejected";
  reason: string | null;
}

interface LeaveBalance {
  id: string;
  user_id: string;
  total_leaves: number;
  used_leaves: number;
  year: number;
}

interface LeavesManagementProps {
  users: Profile[];
}

const LeavesManagement = ({ users }: LeavesManagementProps) => {
  const { toast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  // Holiday form
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [holidaysRes, requestsRes, balancesRes] = await Promise.all([
      supabase.from("holidays").select("*").order("holiday_date"),
      supabase.from("leave_requests").select("*").order("leave_date", { ascending: false }),
      supabase.from("leave_balances").select("*"),
    ]);

    if (holidaysRes.data) setHolidays(holidaysRes.data);
    if (requestsRes.data) setLeaveRequests(requestsRes.data as LeaveRequest[]);
    if (balancesRes.data) setLeaveBalances(balancesRes.data as LeaveBalance[]);
    setLoading(false);
  };

  const getUserName = (userId: string) => {
    const u = users.find((p) => p.user_id === userId);
    return u?.full_name || "Unknown";
  };

  const getUserBalance = (userId: string) => {
    const balance = leaveBalances.find((b) => b.user_id === userId);
    if (!balance) return { total: 18, used: 0, remaining: 18 };
    return {
      total: Number(balance.total_leaves),
      used: Number(balance.used_leaves),
      remaining: Number(balance.total_leaves) - Number(balance.used_leaves),
    };
  };

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

  const handleDeleteHoliday = async (id: string) => {
    const { error } = await supabase.from("holidays").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchData();
    }
  };

  const handleApproveLeave = async (request: LeaveRequest) => {
    // Update request status
    const { error: updateError } = await supabase
      .from("leave_requests")
      .update({ status: "approved" })
      .eq("id", request.id);

    if (updateError) {
      toast({ title: "Error", description: updateError.message, variant: "destructive" });
      return;
    }

    // Update leave balance
    const deduction = request.leave_type === "full" ? 1 : 0.5;
    const balance = leaveBalances.find((b) => b.user_id === request.user_id);
    
    if (balance) {
      await supabase
        .from("leave_balances")
        .update({ used_leaves: Number(balance.used_leaves) + deduction })
        .eq("id", balance.id);
    } else {
      // Create balance if doesn't exist
      await supabase.from("leave_balances").insert({
        user_id: request.user_id,
        total_leaves: 18,
        used_leaves: deduction,
      });
    }

    toast({ title: "Success", description: "Leave approved" });
    fetchData();
  };

  const handleRejectLeave = async (id: string) => {
    const { error } = await supabase
      .from("leave_requests")
      .update({ status: "rejected" })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Leave rejected" });
      fetchData();
    }
  };

  const pendingRequests = leaveRequests.filter((r) => r.status === "pending");
  const processedRequests = leaveRequests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">
            Leave Requests
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="balances">Leave Balances</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>

        {/* Leave Requests Tab */}
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Pending Leave Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No pending requests</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{getUserName(req.user_id)}</TableCell>
                        <TableCell>{format(parseISO(req.leave_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {req.leave_type === "full" ? "Full Day" : "Half Day"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{req.reason || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleApproveLeave(req)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleRejectLeave(req.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {processedRequests.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">History</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedRequests.slice(0, 10).map((req) => (
                        <TableRow key={req.id}>
                          <TableCell>{getUserName(req.user_id)}</TableCell>
                          <TableCell>{format(parseISO(req.leave_date), "MMM d, yyyy")}</TableCell>
                          <TableCell>{req.leave_type === "full" ? "Full" : "Half"}</TableCell>
                          <TableCell>
                            <Badge variant={req.status === "approved" ? "default" : "destructive"}>
                              {req.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Balances Tab */}
        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <CardTitle>Leave Balances</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const balance = getUserBalance(user.user_id);
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell className="text-right">{balance.total}</TableCell>
                        <TableCell className="text-right">{balance.used}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {balance.remaining}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holidays Tab */}
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
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteHoliday(h.id)}>
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
    </div>
  );
};

export default LeavesManagement;
