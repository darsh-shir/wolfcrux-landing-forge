import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Save } from "lucide-react";
import { formatIndian } from "@/lib/utils";

interface Profile {
  user_id: string;
  full_name: string;
}

interface Row {
  month: number;
  milestone_amount: string;
  amount_given: string;
  notes: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Admin-only manual entry of monthly milestone amounts and money actually given.
 * Nothing here is auto-calculated — admin types every value.
 */
const MonthlyMilestones = ({ users }: { users: Profile[] }) => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string>("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current + 1, current, current - 1, current - 2, current - 3];
  }, []);

  useEffect(() => {
    if (!userId && users.length > 0) setUserId(users[0].user_id);
  }, [users, userId]);

  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, year]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("trader_monthly_manual" as any)
      .select("month, milestone_amount, amount_given, notes")
      .eq("user_id", userId)
      .eq("year", year);

    const map = new Map<number, any>();
    (data || []).forEach((r: any) => map.set(Number(r.month), r));

    setRows(
      Array.from({ length: 12 }, (_, i) => {
        const existing = map.get(i + 1);
        return {
          month: i + 1,
          milestone_amount: existing ? String(Number(existing.milestone_amount)) : "",
          amount_given: existing ? String(Number(existing.amount_given)) : "",
          notes: existing?.notes || "",
        };
      })
    );
    setLoading(false);
  };

  const update = (month: number, field: keyof Row, value: string) => {
    setRows((prev) => prev.map((r) => (r.month === month ? { ...r, [field]: value } : r)));
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);

    const payload = rows
      .filter((r) => r.milestone_amount !== "" || r.amount_given !== "" || r.notes !== "")
      .map((r) => ({
        user_id: userId,
        year,
        month: r.month,
        milestone_amount: Number(r.milestone_amount) || 0,
        amount_given: Number(r.amount_given) || 0,
        notes: r.notes || null,
      }));

    if (payload.length === 0) {
      setSaving(false);
      toast({ title: "Nothing to save", description: "Enter at least one amount." });
      return;
    }

    const { error } = await supabase
      .from("trader_monthly_manual" as any)
      .upsert(payload as any, { onConflict: "user_id,month,year" });

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved", description: "Monthly milestone & payments updated." });
    load();
  };

  const totalMilestone = rows.reduce((s, r) => s + (Number(r.milestone_amount) || 0), 0);
  const totalGiven = rows.reduce((s, r) => s + (Number(r.amount_given) || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Monthly Milestones &amp; Money Given (Manual)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Trader</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select trader" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={save} disabled={saving || loading} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton-shimmer h-10 rounded-md" />)}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-12 gap-2 px-1 text-xs text-muted-foreground">
              <div className="col-span-2">Month</div>
              <div className="col-span-3">Milestone Amount ($)</div>
              <div className="col-span-3">Money Given ($)</div>
              <div className="col-span-4">Notes</div>
            </div>
            {rows.map((r) => (
              <div key={r.month} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-md border border-border/60 p-2 md:border-0 md:p-0">
                <div className="md:col-span-2 text-sm font-medium">{MONTH_NAMES[r.month - 1]}</div>
                <div className="md:col-span-3">
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Milestone"
                    value={r.milestone_amount}
                    onChange={(e) => update(r.month, "milestone_amount", e.target.value)}
                  />
                </div>
                <div className="md:col-span-3">
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Given"
                    value={r.amount_given}
                    onChange={(e) => update(r.month, "amount_given", e.target.value)}
                  />
                </div>
                <div className="md:col-span-4">
                  <Input
                    placeholder="Notes (optional)"
                    value={r.notes}
                    onChange={(e) => update(r.month, "notes", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-6 border-t border-border pt-3 text-sm">
          <p className="text-muted-foreground">
            Year milestone total: <span className="font-semibold text-foreground">${formatIndian(totalMilestone)}</span>
          </p>
          <p className="text-muted-foreground">
            Year money given: <span className="font-semibold text-foreground">${formatIndian(totalGiven)}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MonthlyMilestones;
