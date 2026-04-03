import { useState, useEffect } from "react";
import { formatIndian } from "@/lib/utils";
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

interface SalaryBackupProps {
  users: Profile[];
}

const SalaryBackup = ({ users }: SalaryBackupProps) => {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [records, setRecords] = useState<SalaryBackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, SalaryBackupRecord>>({});

  useEffect(() => {
    fetchRecords();
  }, [selectedYear]);

  const fetchRecords = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("salary_backups")
      .select("*")
      .eq("year", selectedYear)
      .eq("month", 0);
    if (data) setRecords(data);
    setLoading(false);
  };

  const initEditRow = (userId: string): SalaryBackupRecord => {
    const existing = records.find(r => r.user_id === userId);
    if (existing) return existing;
    return {
      user_id: userId,
      base_salary: 0,
      month: 0,
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
        month: 0,
        year: selectedYear,
        base_salary: row.base_salary,
        backup_amount: row.backup_amount,
        notes: row.notes,
      });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "Saved", description: `Salary backup saved for ${selectedYear}` });
    setEditingRow(prev => { const n = { ...prev }; delete n[userId]; return n; });
    fetchRecords();
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Salary Backup (Yearly)
            </CardTitle>
            <div className="flex items-center gap-3">
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
                  <TableHead>Total Backup</TableHead>
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
                {(() => {
                  const totals = users.reduce((acc, user) => {
                    const row = getRowData(user.user_id);
                    acc.salary += Number(row.base_salary);
                    acc.backup += Number(row.backup_amount);
                    return acc;
                  }, { salary: 0, backup: 0 });
                  return (
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell>₹{formatIndian(totals.salary)}</TableCell>
                      <TableCell>₹{formatIndian(totals.backup)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  );
                })()}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalaryBackup;
