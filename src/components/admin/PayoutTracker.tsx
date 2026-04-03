import { formatIndian } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { DollarSign } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface PayoutRecord {
  id: string;
  user_id: string;
  month: number;
  year: number;
  salary: number;
  cash_component: number;
  bank_transfer: number;
  advance_cash: number;
  advance_bank: number;
  notes: string | null;
  paid_cash: boolean;
  paid_online: boolean;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface PayoutTrackerProps {
  users: Profile[];
}

const PayoutTracker = ({ users }: PayoutTrackerProps) => {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [viewMode, setViewMode] = useState<"month" | "year" | "all">("month");
  const [records, setRecords] = useState<PayoutRecord[]>([]);
  const [allRecords, setAllRecords] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [selectedMonth, selectedYear, viewMode]);

  const fetchRecords = async () => {
    setLoading(true);
    // Always fetch all for totals
    const allRes = await supabase.from("payout_records").select("*")
      .order("year", { ascending: false }).order("month", { ascending: false });
    if (allRes.data) setAllRecords(allRes.data as PayoutRecord[]);

    let query = supabase.from("payout_records").select("*");
    if (viewMode === "month") {
      query = query.eq("month", selectedMonth).eq("year", selectedYear);
    } else if (viewMode === "year") {
      query = query.eq("year", selectedYear);
    }
    const { data, error } = await query.order("year", { ascending: false }).order("month", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRecords((data || []) as PayoutRecord[]);
    }
    setLoading(false);
  };

  const togglePaid = async (recordId: string, field: "paid_cash" | "paid_online", value: boolean) => {
    const { error } = await supabase.from("payout_records").update({ [field]: value }).eq("id", recordId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, [field]: value } : r));
      setAllRecords(prev => prev.map(r => r.id === recordId ? { ...r, [field]: value } : r));
    }
  };

  const getTotal = (row: PayoutRecord) =>
    Number(row.salary) + Number(row.cash_component) + Number(row.bank_transfer) + Number(row.advance_cash) + Number(row.advance_bank);

  const getUserName = (userId: string) => users.find(u => u.user_id === userId)?.full_name || "Unknown";

  // Compute total paid & owed per employee (all time)
  const employeeSummary = users.map(user => {
    const userRecords = allRecords.filter(r => r.user_id === user.user_id);
    const totalOwed = userRecords.reduce((sum, r) => sum + getTotal(r), 0);
    const totalPaid = userRecords
      .filter(r => r.paid_cash || r.paid_online)
      .reduce((sum, r) => sum + getTotal(r), 0);
    const unpaid = userRecords
      .filter(r => !r.paid_cash && !r.paid_online)
      .reduce((sum, r) => sum + getTotal(r), 0);
    return { userId: user.user_id, name: user.full_name, totalOwed, totalPaid, unpaid };
  });

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      {/* Summary: Total owed per employee */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Employee Payout Summary (All Time)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trader</TableHead>
                  <TableHead>Total Owed</TableHead>
                  <TableHead>Total Paid</TableHead>
                  <TableHead>Left to Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeSummary.map(emp => (
                  <TableRow key={emp.userId}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>₹{formatIndian(emp.totalOwed)}</TableCell>
                    <TableCell className="text-green-600">₹{formatIndian(emp.totalPaid)}</TableCell>
                    <TableCell className={emp.unpaid > 0 ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                      ₹{formatIndian(emp.unpaid)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Records */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <CardTitle>Payout Records</CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant={viewMode === "month" ? "default" : "outline"} size="sm" onClick={() => setViewMode("month")}>Monthly</Button>
              <Button variant={viewMode === "year" ? "default" : "outline"} size="sm" onClick={() => setViewMode("year")}>Yearly</Button>
              <Button variant={viewMode === "all" ? "default" : "outline"} size="sm" onClick={() => setViewMode("all")}>All</Button>
              {(viewMode === "month" || viewMode === "year") && (
                <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                  <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {viewMode === "month" && (
                <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trader</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Cash</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Adv Cash</TableHead>
                  <TableHead>Adv Bank</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-center">Paid Cash</TableHead>
                  <TableHead className="text-center">Paid Online</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">No records found</TableCell></TableRow>
                ) : (
                  records.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{getUserName(r.user_id)}</TableCell>
                      <TableCell>{MONTHS[r.month - 1]} {r.year}</TableCell>
                      <TableCell>₹{formatIndian(Number(r.salary))}</TableCell>
                      <TableCell>₹{formatIndian(Number(r.cash_component))}</TableCell>
                      <TableCell>₹{formatIndian(Number(r.bank_transfer))}</TableCell>
                      <TableCell>₹{formatIndian(Number(r.advance_cash))}</TableCell>
                      <TableCell>₹{formatIndian(Number(r.advance_bank))}</TableCell>
                      <TableCell className="font-semibold text-primary">₹{formatIndian(getTotal(r))}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={r.paid_cash} onCheckedChange={(v) => togglePaid(r.id, "paid_cash", !!v)} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={r.paid_online} onCheckedChange={(v) => togglePaid(r.id, "paid_online", !!v)} />
                      </TableCell>
                      <TableCell>
                        {r.paid_cash || r.paid_online ? (
                          <span className="text-green-600 font-medium text-xs">Paid</span>
                        ) : (
                          <span className="text-red-600 font-medium text-xs">Unpaid</span>
                        )}
                      </TableCell>
                      <TableCell>{r.notes || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PayoutTracker;
