import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/ui/save-button";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Building2, CheckCircle2 } from "lucide-react";
import { formatIndian } from "@/lib/utils";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface DeskCostRecord {
  id?: string;
  user_id: string;
  year: number;
  total_desk_cost: number;
  total_paid: number;
  notes: string | null;
}

interface DeskCostProps {
  users: Profile[];
}

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const DeskCost = ({ users }: DeskCostProps) => {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [records, setRecords] = useState<DeskCostRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, DeskCostRecord>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [show, setShow] = useState<"all" | "unpaid">("all");

  useEffect(() => {
    fetchRecords();
  }, [selectedYear]);

  const fetchRecords = async () => {
    setLoading(true);
    setEditingRow({});
    const { data } = await supabase
      .from("desk_costs")
      .select("*")
      .eq("year", selectedYear);
    if (data) setRecords(data);
    setLoading(false);
  };

  const initEditRow = (userId: string): DeskCostRecord => {
    const existing = records.find(r => r.user_id === userId);
    return existing || { user_id: userId, year: selectedYear, total_desk_cost: 0, total_paid: 0, notes: null };
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

  /** True when the row has edits that differ from what is saved. */
  const isChanged = (userId: string) => {
    const edit = editingRow[userId];
    if (!edit) return false;
    const saved = initEditRow(userId);
    return Number(edit.total_desk_cost) !== Number(saved.total_desk_cost) || Number(edit.total_paid) !== Number(saved.total_paid) || (edit.notes || "") !== (saved.notes || "");
  };

  const saveOnEnter = (userId: string) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isChanged(userId)) {
      e.preventDefault();
      void saveRecord(userId);
    }
  };

  const saveRecord = async (userId: string) => {
    if (savingId) return;
    setSavingId(userId);
    try {
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
          year: selectedYear,
          total_desk_cost: row.total_desk_cost,
          total_paid: row.total_paid,
          notes: row.notes,
        });
        if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      }
      toast({ title: "Saved", description: "Desk cost updated" });
      setEditingRow(prev => { const n = { ...prev }; delete n[userId]; return n; });
      await fetchRecords();
    } finally {
      setSavingId(null);
    }
  };

  const getPending = (row: DeskCostRecord) => Number(row.total_desk_cost) - Number(row.total_paid);

  // Paid status uses saved figures, so rows don't jump around while typing.
  const savedPending = (userId: string) => getPending(initEditRow(userId));
  const isFullyPaid = (userId: string) => Number(initEditRow(userId).total_desk_cost) > 0 && savedPending(userId) <= 0;
  const unpaidUsers = users.filter(u => savedPending(u.user_id) > 0);
  const shownUsers = show === "unpaid" ? unpaidUsers : users;
  const unpaidTotal = unpaidUsers.reduce((sum, u) => sum + savedPending(u.user_id), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Desk Cost Management
            </CardTitle>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md border p-1">
              <Button size="sm" variant={show === "all" ? "secondary" : "ghost"} className="h-8" onClick={() => setShow("all")}>
                All ({users.length})
              </Button>
              <Button size="sm" variant={show === "unpaid" ? "secondary" : "ghost"} className="h-8" onClick={() => setShow("unpaid")}>
                Not fully paid ({unpaidUsers.length})
              </Button>
            </div>
            {unpaidUsers.length > 0 ? (
              <span className="text-sm text-muted-foreground">
                ₹{formatIndian(unpaidTotal)} still to collect from {unpaidUsers.length} {unpaidUsers.length === 1 ? "person" : "people"}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Everyone has paid their desk cost for {selectedYear}.</span>
            )}
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Trader</TableHead>
                  <TableHead>Total Desk Cost</TableHead>
                  <TableHead>Total Paid</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownUsers.map(user => {
                  const row = getRowData(user.user_id);
                  const pending = getPending(row);
                  return (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          {user.full_name}
                          {isFullyPaid(user.user_id) && (
                            <span title="Paid in full" aria-label="Paid in full">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <AmountInput className="w-28" value={row.total_desk_cost || ""}
                          onValueChange={(v) => handleFieldChange(user.user_id, "total_desk_cost", Number(v))}
                          onKeyDown={saveOnEnter(user.user_id)} />
                      </TableCell>
                      <TableCell>
                        <AmountInput className="w-28" value={row.total_paid || ""}
                          onValueChange={(v) => handleFieldChange(user.user_id, "total_paid", Number(v))}
                          onKeyDown={saveOnEnter(user.user_id)} />
                      </TableCell>
                      <TableCell className={`font-semibold ${pending > 0 ? "text-destructive" : "text-primary"}`}>
                        ₹{formatIndian(pending)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input className="w-40" value={row.notes || ""}
                            onChange={e => handleFieldChange(user.user_id, "notes", e.target.value)}
                            onKeyDown={saveOnEnter(user.user_id)} placeholder="Notes" />
                          {isChanged(user.user_id) && (
                            <SaveButton onClick={() => void saveRecord(user.user_id)} saving={savingId === user.user_id} />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(() => {
                  const totals = shownUsers.reduce((acc, user) => {
                    const row = getRowData(user.user_id);
                    acc.cost += Number(row.total_desk_cost);
                    acc.paid += Number(row.total_paid);
                    return acc;
                  }, { cost: 0, paid: 0 });
                  const totalPending = totals.cost - totals.paid;
                  return (
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell>₹{formatIndian(totals.cost)}</TableCell>
                      <TableCell>₹{formatIndian(totals.paid)}</TableCell>
                      <TableCell className={totalPending > 0 ? "text-destructive" : "text-primary"}>
                        ₹{formatIndian(totalPending)}
                      </TableCell>
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

export default DeskCost;
