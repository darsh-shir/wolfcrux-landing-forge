import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Save, DollarSign } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface PayoutRecord {
  id?: string;
  user_id: string;
  month: number;
  year: number;
  salary: number;
  cash_component: number;
  bank_transfer: number;
  advance_cash: number;
  advance_bank: number;
  notes: string | null;
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
  const [viewMode, setViewMode] = useState<"month" | "all">("month");
  const [records, setRecords] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, PayoutRecord>>({});

  useEffect(() => {
    fetchRecords();
  }, [selectedMonth, selectedYear, viewMode]);

  const fetchRecords = async () => {
    setLoading(true);
    let query = supabase.from("payout_records").select("*");
    if (viewMode === "month") {
      query = query.eq("month", selectedMonth).eq("year", selectedYear);
    }
    const { data, error } = await query.order("year", { ascending: false }).order("month", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  };

  const initEditRow = (userId: string) => {
    const existing = records.find(r => r.user_id === userId && r.month === selectedMonth && r.year === selectedYear);
    return existing || {
      user_id: userId,
      month: selectedMonth,
      year: selectedYear,
      salary: 0,
      cash_component: 0,
      bank_transfer: 0,
      advance_cash: 0,
      advance_bank: 0,
      notes: null,
    };
  };

  const handleFieldChange = (userId: string, field: keyof PayoutRecord, value: number | string) => {
    setEditingRow(prev => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || initEditRow(userId)),
        [field]: value,
      }
    }));
  };

  const getRowData = (userId: string): PayoutRecord => {
    return editingRow[userId] || initEditRow(userId);
  };

  const saveRecord = async (userId: string) => {
    const row = getRowData(userId);
    const existing = records.find(r => r.user_id === userId && r.month === selectedMonth && r.year === selectedYear);

    if (existing?.id) {
      const { error } = await supabase.from("payout_records").update({
        salary: row.salary,
        cash_component: row.cash_component,
        bank_transfer: row.bank_transfer,
        advance_cash: row.advance_cash,
        advance_bank: row.advance_bank,
        notes: row.notes,
      }).eq("id", existing.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase.from("payout_records").insert({
        user_id: userId,
        month: selectedMonth,
        year: selectedYear,
        salary: row.salary,
        cash_component: row.cash_component,
        bank_transfer: row.bank_transfer,
        advance_cash: row.advance_cash,
        advance_bank: row.advance_bank,
        notes: row.notes,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: "Saved", description: `Payout record saved for ${MONTHS[selectedMonth - 1]} ${selectedYear}` });
    setEditingRow(prev => { const n = { ...prev }; delete n[userId]; return n; });
    fetchRecords();
  };

  const getTotal = (row: PayoutRecord) =>
    Number(row.salary) + Number(row.cash_component) + Number(row.bank_transfer) + Number(row.advance_cash) + Number(row.advance_bank);

  const getUserName = (userId: string) => users.find(u => u.user_id === userId)?.full_name || "Unknown";

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Payout Tracker
            </CardTitle>
            <div className="flex items-center gap-3">
              <Button
                variant={viewMode === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("month")}
              >
                Monthly View
              </Button>
              <Button
                variant={viewMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("all")}
              >
                All Months
              </Button>
              {viewMode === "month" && (
                <>
                  <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {years.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "month" ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trader</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Cash Component</TableHead>
                    <TableHead>Bank Transfer</TableHead>
                    <TableHead>Advance (Cash)</TableHead>
                    <TableHead>Advance (Bank)</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => {
                    const row = getRowData(user.user_id);
                    return (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell>
                          <Input type="number" className="w-24" value={row.salary || ""}
                            onChange={e => handleFieldChange(user.user_id, "salary", Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="w-24" value={row.cash_component || ""}
                            onChange={e => handleFieldChange(user.user_id, "cash_component", Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="w-24" value={row.bank_transfer || ""}
                            onChange={e => handleFieldChange(user.user_id, "bank_transfer", Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="w-24" value={row.advance_cash || ""}
                            onChange={e => handleFieldChange(user.user_id, "advance_cash", Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="w-24" value={row.advance_bank || ""}
                            onChange={e => handleFieldChange(user.user_id, "advance_bank", Number(e.target.value))} />
                        </TableCell>
                        <TableCell className="font-semibold text-primary">
                          ₹{getTotal(row).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Input className="w-28" value={row.notes || ""}
                            onChange={e => handleFieldChange(user.user_id, "notes", e.target.value)} placeholder="Notes" />
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => saveRecord(user.user_id)}>
                            <Save className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
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
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No records found</TableCell></TableRow>
                  ) : (
                    records.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{getUserName(r.user_id)}</TableCell>
                        <TableCell>{MONTHS[r.month - 1]} {r.year}</TableCell>
                        <TableCell>₹{Number(r.salary).toLocaleString()}</TableCell>
                        <TableCell>₹{Number(r.cash_component).toLocaleString()}</TableCell>
                        <TableCell>₹{Number(r.bank_transfer).toLocaleString()}</TableCell>
                        <TableCell>₹{Number(r.advance_cash).toLocaleString()}</TableCell>
                        <TableCell>₹{Number(r.advance_bank).toLocaleString()}</TableCell>
                        <TableCell className="font-semibold text-primary">₹{getTotal(r).toLocaleString()}</TableCell>
                        <TableCell>{r.notes || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PayoutTracker;
