import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Save, Wallet } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface SalaryBackupRecord {
  id?: string;
  user_id: string;
  base_salary: number;
  month: number;
  year: number;
  backup_amount: number;
  notes: string | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface SalaryBackupProps {
  users: Profile[];
}

const SalaryBackup = ({ users }: SalaryBackupProps) => {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [records, setRecords] = useState<SalaryBackupRecord[]>([]);
  const [allRecords, setAllRecords] = useState<SalaryBackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, SalaryBackupRecord>>({});

  useEffect(() => {
    fetchRecords();
  }, [selectedMonth, selectedYear]);

  const fetchRecords = async () => {
    setLoading(true);
    const [currentRes, allRes] = await Promise.all([
      supabase.from("salary_backups").select("*").eq("month", selectedMonth).eq("year", selectedYear),
      supabase.from("salary_backups").select("*").order("year", { ascending: false }).order("month", { ascending: false }),
    ]);
    if (currentRes.data) setRecords(currentRes.data);
    if (allRes.data) setAllRecords(allRes.data);
    setLoading(false);
  };

  const initEditRow = (userId: string): SalaryBackupRecord => {
    const existing = records.find(r => r.user_id === userId);
    if (existing) return existing;
    // Get latest base salary for this user
    const latestRecord = allRecords.find(r => r.user_id === userId);
    return {
      user_id: userId,
      base_salary: latestRecord?.base_salary || 0,
      month: selectedMonth,
      year: selectedYear,
      backup_amount: 0,
      notes: null,
    };
  };

  const handleFieldChange = (userId: string, field: keyof SalaryBackupRecord, value: number | string) => {
    setEditingRow(prev => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || initEditRow(userId)),
        [field]: value,
      }
    }));
  };

  const getRowData = (userId: string): SalaryBackupRecord => {
    return editingRow[userId] || initEditRow(userId);
  };

  const saveRecord = async (userId: string) => {
    const row = getRowData(userId);
    const existing = records.find(r => r.user_id === userId);

    if (existing?.id) {
      const { error } = await supabase.from("salary_backups").update({
        base_salary: row.base_salary,
        backup_amount: row.backup_amount,
        notes: row.notes,
      }).eq("id", existing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("salary_backups").insert({
        user_id: userId,
        month: selectedMonth,
        year: selectedYear,
        base_salary: row.base_salary,
        backup_amount: row.backup_amount,
        notes: row.notes,
      });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "Saved", description: `Salary backup saved for ${MONTHS[selectedMonth - 1]} ${selectedYear}` });
    setEditingRow(prev => { const n = { ...prev }; delete n[userId]; return n; });
    fetchRecords();
  };

  const getTotalBackup = (userId: string) => {
    return allRecords.filter(r => r.user_id === userId).reduce((sum, r) => sum + Number(r.backup_amount), 0);
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Salary Backup
            </CardTitle>
            <div className="flex items-center gap-3">
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trader</TableHead>
                  <TableHead>Base Salary</TableHead>
                  <TableHead>Backup This Month</TableHead>
                  <TableHead>Total Backup (All Time)</TableHead>
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
                        <Input type="number" className="w-28" value={row.base_salary || ""}
                          onChange={e => handleFieldChange(user.user_id, "base_salary", Number(e.target.value))} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" className="w-28" value={row.backup_amount || ""}
                          onChange={e => handleFieldChange(user.user_id, "backup_amount", Number(e.target.value))} />
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        ₹{getTotalBackup(user.user_id).toLocaleString()}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default SalaryBackup;
