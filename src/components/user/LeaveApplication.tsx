import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus } from "lucide-react";
import { format, parseISO } from "date-fns";

interface LeaveRequest {
  id: string;
  leave_date: string;
  leave_type: "full" | "half";
  status: "pending" | "approved" | "rejected";
  reason: string | null;
}

interface LeaveBalance {
  total_leaves: number;
  used_leaves: number;
}

interface Holiday {
  id: string;
  holiday_date: string;
  name: string;
}

const LeaveApplication = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balance, setBalance] = useState<LeaveBalance>({ total_leaves: 18, used_leaves: 0 });
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveType, setLeaveType] = useState<"full" | "half">("full");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [requestsRes, balanceRes, holidaysRes] = await Promise.all([
      supabase.from("leave_requests").select("*").order("leave_date", { ascending: false }),
      supabase.from("leave_balances").select("*").maybeSingle(),
      supabase.from("holidays").select("*").order("holiday_date"),
    ]);

    if (requestsRes.data) setRequests(requestsRes.data as LeaveRequest[]);
    if (balanceRes.data) setBalance(balanceRes.data as LeaveBalance);
    if (holidaysRes.data) setHolidays(holidaysRes.data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !leaveDate) {
      toast({ title: "Error", description: "Please select a date", variant: "destructive" });
      return;
    }

    const remaining = Number(balance.total_leaves) - Number(balance.used_leaves);
    const requestAmount = leaveType === "full" ? 1 : 0.5;
    
    if (requestAmount > remaining) {
      toast({ title: "Error", description: "Insufficient leave balance", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      leave_date: leaveDate,
      leave_type: leaveType,
      reason: reason || null,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Leave request submitted" });
      setLeaveDate("");
      setReason("");
      fetchData();
    }

    setIsSubmitting(false);
  };

  const remaining = Number(balance.total_leaves) - Number(balance.used_leaves);

  return (
    <div className="space-y-6">
      {/* Leave Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Leaves</p>
              <p className="text-3xl font-bold">{balance.total_leaves}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Used</p>
              <p className="text-3xl font-bold text-orange-500">{balance.used_leaves}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className="text-3xl font-bold text-primary">{remaining}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Apply for Leave */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-['Space_Grotesk']">
            <Plus className="h-5 w-5" />
            Apply for Leave
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Leave Date</Label>
                <Input
                  type="date"
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select value={leaveType} onValueChange={(v) => setLeaveType(v as "full" | "half")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Day (1.0)</SelectItem>
                    <SelectItem value="half">Half Day (0.5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for leave..."
                rows={2}
              />
            </div>
            <Button type="submit" disabled={isSubmitting || remaining <= 0}>
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* My Leave Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="font-['Space_Grotesk']">My Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No leave requests</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{format(parseISO(req.leave_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {req.leave_type === "full" ? "Full Day" : "Half Day"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          req.status === "approved"
                            ? "default"
                            : req.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{req.reason || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Holidays */}
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
