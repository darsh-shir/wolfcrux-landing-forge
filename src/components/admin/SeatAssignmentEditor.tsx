import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Filter } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface TradeRecord {
  id: string;
  user_id: string;
  account_id: string;
  trade_date: string;
  net_pnl: number;
  trader2_id: string | null;
  trader2_role: string | null;
}

interface SeatAssignmentEditorProps {
  users: Profile[];
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const SeatAssignmentEditor = ({ users }: SeatAssignmentEditorProps) => {
  const { toast } = useToast();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { trader2_id?: string | null; trader2_role?: string | null }>>({});

  const fetchRecords = async () => {
    setLoading(true);
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
    const endDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("trading_data")
      .select("id, user_id, account_id, trade_date, net_pnl, trader2_id, trader2_role")
      .gte("trade_date", startDate)
      .lte("trade_date", endDate)
      .order("trade_date", { ascending: true });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRecords(data || []);
      setEdits({});
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedMonth, selectedYear]);

  const getUserName = (userId: string | null) => {
    if (!userId) return "—";
    const u = users.find((u) => u.user_id === userId);
    return u?.full_name || "Unknown";
  };

  // Group records by main trader (user_id)
  const grouped = useMemo(() => {
    const map = new Map<string, TradeRecord[]>();
    records.forEach((r) => {
      const existing = map.get(r.user_id) || [];
      existing.push(r);
      map.set(r.user_id, existing);
    });
    // Sort by trader name
    return Array.from(map.entries()).sort((a, b) => {
      return getUserName(a[0]).localeCompare(getUserName(b[0]));
    });
  }, [records, users]);

  const getEditValue = (recordId: string, field: "trader2_id" | "trader2_role") => {
    if (edits[recordId] && edits[recordId][field] !== undefined) {
      return edits[recordId][field];
    }
    const rec = records.find((r) => r.id === recordId);
    if (!rec) return null;
    return rec[field];
  };

  const setEdit = (recordId: string, field: "trader2_id" | "trader2_role", value: string | null) => {
    setEdits((prev) => ({
      ...prev,
      [recordId]: { ...prev[recordId], [field]: value },
    }));
  };

  const saveRecord = async (recordId: string) => {
    const edit = edits[recordId];
    if (!edit) return;

    setSaving(recordId);
    const updateData: Record<string, unknown> = {};
    if (edit.trader2_id !== undefined) updateData.trader2_id = edit.trader2_id;
    if (edit.trader2_role !== undefined) updateData.trader2_role = edit.trader2_role;

    const { error } = await supabase.from("trading_data").update(updateData).eq("id", recordId);

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Record updated successfully." });
      // Update local state
      setRecords((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, ...updateData } as TradeRecord : r))
      );
      setEdits((prev) => {
        const next = { ...prev };
        delete next[recordId];
        return next;
      });
    }
    setSaving(null);
  };

  const saveAll = async () => {
    const editIds = Object.keys(edits);
    if (editIds.length === 0) return;

    setSaving("all");
    let successCount = 0;
    for (const id of editIds) {
      const edit = edits[id];
      const updateData: Record<string, unknown> = {};
      if (edit.trader2_id !== undefined) updateData.trader2_id = edit.trader2_id;
      if (edit.trader2_role !== undefined) updateData.trader2_role = edit.trader2_role;

      const { error } = await supabase.from("trading_data").update(updateData).eq("id", id);
      if (!error) {
        successCount++;
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...updateData } as TradeRecord : r))
        );
      }
    }
    setEdits({});
    toast({ title: "Bulk Save", description: `${successCount}/${editIds.length} records updated.` });
    setSaving(null);
  };

  const pendingCount = Object.keys(edits).length;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Seat Assignment Editor — Fix Trader Pairings
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          View and edit who sat with whom (Partner / Trainee) for each trading day. Changes are highlighted until saved.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Month:</span>
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Year:</span>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {pendingCount > 0 && (
            <Button onClick={saveAll} disabled={saving === "all"} className="ml-auto gap-2">
              {saving === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save All ({pendingCount} changes)
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No trading records found for this month.</p>
        ) : (
          <div className="space-y-6">
            {grouped.map(([mainTraderId, traderRecords]) => (
              <Card key={mainTraderId} className="border-border/30">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-base text-foreground">
                    {getUserName(mainTraderId)}
                    <span className="text-xs text-muted-foreground ml-2">({traderRecords.length} days)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Date</TableHead>
                          <TableHead className="w-[100px]">Net P&L</TableHead>
                          <TableHead className="w-[200px]">Sitting With (Trader 2)</TableHead>
                          <TableHead className="w-[150px]">Role</TableHead>
                          <TableHead className="w-[80px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {traderRecords.map((rec) => {
                          const hasEdit = !!edits[rec.id];
                          const currentTrader2 = getEditValue(rec.id, "trader2_id") as string | null;
                          const currentRole = getEditValue(rec.id, "trader2_role") as string | null;

                          return (
                            <TableRow
                              key={rec.id}
                              className={hasEdit ? "bg-primary/5 border-l-2 border-l-primary" : ""}
                            >
                              <TableCell className="font-mono text-sm">
                                {format(parseISO(rec.trade_date), "dd MMM")}
                              </TableCell>
                              <TableCell className={rec.net_pnl >= 0 ? "text-green-500" : "text-red-500"}>
                                ${rec.net_pnl.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={currentTrader2 || "none"}
                                  onValueChange={(v) => {
                                    const newVal = v === "none" ? null : v;
                                    setEdit(rec.id, "trader2_id", newVal);
                                    // Auto-set role to trainee when assigning a trader2
                                    if (newVal) {
                                      setEdit(rec.id, "trader2_role", "trainee");
                                    }
                                    if (!newVal) {
                                      setEdit(rec.id, "trader2_role", null);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="None" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None (Alone)</SelectItem>
                                    {users
                                      .filter((u) => u.user_id !== rec.user_id)
                                      .map((u) => (
                                        <SelectItem key={u.user_id} value={u.user_id}>
                                          {u.full_name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={currentRole || "trainee"}
                                  onValueChange={(v) => setEdit(rec.id, "trader2_role", v)}
                                  disabled={!currentTrader2}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="trainee">Trainee</SelectItem>
                                    <SelectItem value="partner">Partner</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {hasEdit && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => saveRecord(rec.id)}
                                    disabled={saving === rec.id}
                                  >
                                    {saving === rec.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SeatAssignmentEditor;
