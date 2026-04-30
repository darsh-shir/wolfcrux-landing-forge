import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { History, Save, Trash2, Info } from "lucide-react";
import { MILESTONES } from "@/lib/payoutCalculations";
import { formatIndian } from "@/lib/utils";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  trader_number?: string | null;
}

interface Baseline {
  id?: string;
  user_id: string;
  baseline_days: number;
  baseline_net_profit: number;
  baseline_level: number;
  as_of_date: string;
  notes?: string | null;
}

interface Props {
  users: Profile[];
}

interface RowDraft {
  baseline_days: string;
  baseline_net_profit: string;
  baseline_level: string;
  as_of_date: string;
  notes: string;
  existingId?: string;
}

const BaselineSeeder = ({ users }: Props) => {
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const fetchBaselines = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("trader_baselines" as any).select("*");
    if (error) {
      toast.error("Failed to load baselines");
      setLoading(false);
      return;
    }
    const list = (data ?? []) as unknown as Baseline[];
    setBaselines(list);
    const next: Record<string, RowDraft> = {};
    list.forEach((b) => {
      next[b.user_id] = {
        baseline_days: String(b.baseline_days ?? 0),
        baseline_net_profit: String(b.baseline_net_profit ?? 0),
        baseline_level: String(b.baseline_level ?? 0),
        as_of_date: b.as_of_date,
        notes: b.notes ?? "",
        existingId: b.id,
      };
    });
    setDrafts(next);
    setLoading(false);
  };

  useEffect(() => {
    fetchBaselines();
  }, []);

  const getDraft = (userId: string): RowDraft =>
    drafts[userId] ?? {
      baseline_days: "0",
      baseline_net_profit: "0",
      baseline_level: "0",
      as_of_date: "2025-04-01",
      notes: "",
    };

  const updateDraft = (userId: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [userId]: { ...getDraft(userId), ...patch },
    }));
  };

  const handleSave = async (user: Profile) => {
    const d = getDraft(user.user_id);
    const days = parseInt(d.baseline_days || "0", 10);
    const profit = parseFloat(d.baseline_net_profit || "0");
    const level = parseInt(d.baseline_level || "0", 10);
    if (Number.isNaN(days) || Number.isNaN(profit) || Number.isNaN(level)) {
      toast.error("Invalid numeric values");
      return;
    }
    if (!d.as_of_date) {
      toast.error("Please pick an as-of date");
      return;
    }

    setSaving(user.user_id);
    try {
      // Only upsert the baseline row. Trader Progress reads this directly
      // and adds it on top of actual trades. We do NOT touch trader_milestones
      // or trader_config — future progress is driven purely by performance.
      const { error: upErr } = await supabase
        .from("trader_baselines" as any)
        .upsert(
          {
            user_id: user.user_id,
            baseline_days: days,
            baseline_net_profit: profit,
            baseline_level: level,
            as_of_date: d.as_of_date,
            notes: d.notes || null,
          },
          { onConflict: "user_id" }
        );
      if (upErr) throw upErr;

      toast.success(`Baseline saved for ${user.full_name}`);
      await fetchBaselines();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to save baseline");
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (user: Profile) => {
    const d = getDraft(user.user_id);
    if (!d.existingId) return;
    if (!confirm(`Remove baseline for ${user.full_name}?`)) return;
    setSaving(user.user_id);
    try {
      await supabase.from("trader_baselines" as any).delete().eq("id", d.existingId);
      toast.success("Baseline removed");
      await fetchBaselines();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    } finally {
      setSaving(null);
    }
  };

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f
      ? users.filter(
          (u) =>
            u.full_name.toLowerCase().includes(f) ||
            u.email.toLowerCase().includes(f) ||
            (u.trader_number ?? "").toLowerCase().includes(f)
        )
      : users;
    // Sort: those with existing baseline first
    return [...list].sort((a, b) => {
      const ah = drafts[a.user_id]?.existingId ? 1 : 0;
      const bh = drafts[b.user_id]?.existingId ? 1 : 0;
      if (ah !== bh) return bh - ah;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [users, filter, drafts]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Baseline Seeder (One-Time Migration)
              </CardTitle>
              <CardDescription className="mt-1">
                Seed historical days &amp; net profit for traders whose entries weren't recorded
                from Jan 2025. This <strong>only affects the Trader Progress tab</strong> —
                the baseline is added on top of their actual trades for level eligibility. Their
                future progress is driven entirely by their real performance going forward.
                Milestone records and monthly configs are <strong>not</strong> changed.
              </CardDescription>
            </div>
            <Input
              placeholder="Search trader…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full sm:w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-muted/20 p-3 mb-4 flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              Example — Prit started Jan&nbsp;25 but has no entries. Set days=125,
              net profit=$50,000, level=1, as-of=2025-04-01. Trades from Apr&nbsp;1 onward
              stack on top of these numbers.
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Trader</TableHead>
                    <TableHead className="w-[110px]">Days</TableHead>
                    <TableHead className="w-[140px]">Net Profit ($)</TableHead>
                    <TableHead className="w-[160px]">Starting Level</TableHead>
                    <TableHead className="w-[160px]">As-of Date</TableHead>
                    <TableHead className="min-w-[160px]">Notes</TableHead>
                    <TableHead className="w-[170px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const d = getDraft(u.user_id);
                    const hasExisting = !!d.existingId;
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium">{u.full_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {u.trader_number ? `#${u.trader_number} · ` : ""}
                                {u.email}
                              </div>
                            </div>
                            {hasExisting && (
                              <Badge variant="secondary" className="ml-1">
                                Seeded
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={d.baseline_days}
                            onChange={(e) =>
                              updateDraft(u.user_id, { baseline_days: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={d.baseline_net_profit}
                            onChange={(e) =>
                              updateDraft(u.user_id, { baseline_net_profit: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={d.baseline_level}
                            onValueChange={(v) => updateDraft(u.user_id, { baseline_level: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MILESTONES.map((m) => (
                                <SelectItem key={m.level} value={String(m.level)}>
                                  L{m.level} · {m.label} ({m.stoPercent}/{m.ltoPercent})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={d.as_of_date}
                            onChange={(e) =>
                              updateDraft(u.user_id, { as_of_date: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Optional"
                            value={d.notes}
                            onChange={(e) => updateDraft(u.user_id, { notes: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSave(u)}
                              disabled={saving === u.user_id}
                            >
                              <Save className="h-3.5 w-3.5 mr-1" />
                              {hasExisting ? "Update" : "Save"}
                            </Button>
                            {hasExisting && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(u)}
                                disabled={saving === u.user_id}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                        No traders match the filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {baselines.length > 0 && (
            <div className="mt-6 text-xs text-muted-foreground">
              {baselines.length} trader{baselines.length === 1 ? "" : "s"} seeded ·
              Total seeded profit: $
              {formatIndian(baselines.reduce((s, b) => s + Number(b.baseline_net_profit || 0), 0))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BaselineSeeder;
