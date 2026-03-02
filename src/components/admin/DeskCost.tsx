import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Save, Building2 } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface DeskCostRecord {
  id?: string;
  user_id: string;
  total_desk_cost: number;
  total_paid: number;
  notes: string | null;
}

interface DeskCostProps {
  users: Profile[];
}

const DeskCost = ({ users }: DeskCostProps) => {
  const { toast } = useToast();
  const [records, setRecords] = useState<DeskCostRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, DeskCostRecord>>({});

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("desk_costs").select("*");
    if (data) setRecords(data);
    setLoading(false);
  };

  const initEditRow = (userId: string): DeskCostRecord => {
    const existing = records.find(r => r.user_id === userId);
    return existing || { user_id: userId, total_desk_cost: 0, total_paid: 0, notes: null };
  };

  const handleFieldChange = (userId: string, field: keyof DeskCostRecord, value: number | string) => {
    setEditingRow(prev => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || initEditRow(userId)),
        [field]: value,
      }
    }));
  };

  const getRowData = (userId: string): DeskCostRecord => {
    return editingRow[userId] || initEditRow(userId);
  };

  const saveRecord = async (userId: string) => {
    const row = getRowData(userId);
    const existing = records.find(r => r.user_id === userId);

    if (existing?.id) {
      const { error } = await supabase.from("desk_costs").update({
        total_desk_cost: row.total_desk_cost,
        total_paid: row.total_paid,
        notes: row.notes,
      }).eq("id", existing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("desk_costs").insert({
        user_id: userId,
        total_desk_cost: row.total_desk_cost,
        total_paid: row.total_paid,
        notes: row.notes,
      });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "Saved", description: "Desk cost updated" });
    setEditingRow(prev => { const n = { ...prev }; delete n[userId]; return n; });
    fetchRecords();
  };

  const getPending = (row: DeskCostRecord) => Number(row.total_desk_cost) - Number(row.total_paid);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Desk Cost Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trader</TableHead>
                  <TableHead>Total Desk Cost</TableHead>
                  <TableHead>Total Paid</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => {
                  const row = getRowData(user.user_id);
                  const pending = getPending(row);
                  return (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>
                        <Input type="number" className="w-28" value={row.total_desk_cost || ""}
                          onChange={e => handleFieldChange(user.user_id, "total_desk_cost", Number(e.target.value))} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" className="w-28" value={row.total_paid || ""}
                          onChange={e => handleFieldChange(user.user_id, "total_paid", Number(e.target.value))} />
                      </TableCell>
                      <TableCell className={`font-semibold ${pending > 0 ? "text-destructive" : "text-primary"}`}>
                        ₹{pending.toLocaleString()}
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

export default DeskCost;
