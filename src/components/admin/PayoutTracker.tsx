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

interface StoLedgerRow {
  user_id: string;
  month: number;
  year: number;
  final_sto_amount: number;
}

interface ExchangeRate {
  month: number;
  year: number;
  usd_to_inr: number;
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
  const [stoRows, setStoRows] = useState<StoLedgerRow[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [selectedMonth, selectedYear, viewMode]);

  const fetchRecords = async () => {
    setLoading(true);

    const [allRes, stoRes, ratesRes] = await Promise.all([
      supabase.from("payout_records").select("*")
        .order("year", { ascending: false }).order("month", { ascending: false }),
      supabase.from("sto_ledger").select("user_id,month,year,final_sto_amount"),
      supabase.from("monthly_exchange_rates").select("month,year,usd_to_inr"),
    ]);

    if (allRes.data) setAllRecords(allRes.data as PayoutRecord[]);
    if (stoRes.data) setStoRows(stoRes.data as StoLedgerRow[]);
    if (ratesRes.data) setRates(ratesRes.data as ExchangeRate[]);

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

  // INR rate lookup with fallback
  const getRate = (month: number, year: number) => {
    const r = rates.find(x => x.month === month && x.year === year);
    return r ? Number(r.usd_to_inr) : 84;
  };

  // Outstanding = total STO earned (INR) - total paid (salary+cash+bank+advances)
  const employeeSummary = users.map(user => {
    const userRecords = allRecords.filter(r => r.user_id === user.user_id);
    const userSto = stoRows.filter(s => s.user_id === user.user_id);

    const totalEarnedInr = userSto.reduce(
      (sum, s) => sum + Number(s.final_sto_amount) * getRate(s.month, s.year),
      0
    );
    const totalPaid = userRecords.reduce((sum, r) => sum + getTotal(r), 0);
    const outstanding = totalEarnedInr - totalPaid;

    return {
      userId: user.user_id,
      name: user.full_name,
      totalOwed: totalEarnedInr,
      totalPaid,
      unpaid: outstanding,
    };
  }).filter(e => e.totalOwed > 0 || e.totalPaid > 0)
    .sort((a, b) => b.unpaid - a.unpaid);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const grandTotalOwed = employeeSummary.reduce((s, e) => s + e.totalOwed, 0);
  const grandTotalPaid = employeeSummary.reduce((s, e) => s + e.totalPaid, 0);
  const grandTotalPending = employeeSummary.reduce((s, e) => s + e.unpaid, 0);
  const pendingEmployeesCount = employeeSummary.filter(e => e.unpaid > 0).length;

  return (
    <div className="space-y-6">
      {/* Grand Total Pending Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Total Owed (Till Date)</div>
            <div className="text-2xl font-bold mt-1">₹{formatIndian(grandTotalOwed)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Total Paid</div>
            <div className="text-2xl font-bold mt-1 text-emerald-600">₹{formatIndian(grandTotalPaid)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Pending to Pay (Till Date)</div>
            <div className="text-2xl font-bold mt-1 text-red-600">₹{formatIndian(grandTotalPending)}</div>
            <div className="text-xs text-muted-foreground mt-1">{pendingEmployeesCount} employee{pendingEmployeesCount !== 1 ? "s" : ""} with dues</div>
          </CardContent>
        </Card>
      </div>

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
