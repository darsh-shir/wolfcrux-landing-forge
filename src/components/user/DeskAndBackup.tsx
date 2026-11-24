import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Monitor, PiggyBank } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLiveRows } from "@/hooks/useLiveRows";
import { formatIndian } from "@/lib/utils";
import { backupUsedFromNote } from "@/lib/salary";

const inr = (n: number) => `${n < 0 ? "-" : ""}₹${formatIndian(Math.abs(Math.round(n)), 0)}`;
const monthName = (m: number, y: number) => format(new Date(y, m - 1, 1), "MMM yyyy");

interface Desk {
  year: number;
  cost: number;
  paid: number;
}
interface Backup {
  year: number;
  salary: number;
  held: number;
  used: { label: string; amount: number }[];
}

/**
 * Desk cost and salary backup, exactly as the admin has them saved, so each
 * person can check them. Refreshes live when the admin saves.
 */
const DeskAndBackup = () => {
  const { user } = useAuth();
  const [desk, setDesk] = useState<Desk[] | null>(null);
  const [backup, setBackup] = useState<Backup | null>(null);

  const load = useCallback(() => {
    if (!user) return () => {};
    let active = true;
    void Promise.all([
      supabase.from("desk_costs").select("year, total_desk_cost, total_paid").eq("user_id", user.id).order("year", { ascending: false }),
      supabase
        .from("salary_backups")
        .select("year, base_salary, backup_amount")
        .eq("user_id", user.id)
        .eq("month", 0)
        .order("year", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("payout_records").select("month, year, notes").eq("user_id", user.id).ilike("notes", "%Backup used%"),
    ]).then(([d, b, p]) => {
      if (!active) return;
      setDesk(
        (d.data ?? [])
          .map((r) => ({ year: r.year, cost: Number(r.total_desk_cost) || 0, paid: Number(r.total_paid) || 0 }))
          .filter((r) => r.cost > 0 || r.paid > 0),
      );
      const used = (p.data ?? [])
        .map((r) => ({ y: r.year, m: r.month, amount: backupUsedFromNote(r.notes) }))
        .filter((r) => r.amount > 0)
        .sort((a, z) => z.y - a.y || z.m - a.m)
        .map((r) => ({ label: monthName(r.m, r.y), amount: r.amount }));
      setBackup(
        b.data
          ? { year: b.data.year, salary: Number(b.data.base_salary) || 0, held: Number(b.data.backup_amount) || 0, used }
          : used.length
            ? { year: new Date().getFullYear(), salary: 0, held: 0, used }
            : null,
      );
    });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => load(), [load]);
  useLiveRows(user?.id, ["desk_costs", "salary_backups", "payout_records"], () => void load());

  if (desk === null) return <div className="skeleton-shimmer h-32 rounded-lg" />;
  if (desk.length === 0 && !backup) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Desk cost</p>
          </div>
          {desk.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No desk cost recorded for you.</p>
          ) : (
            <div className="mt-3 space-y-4">
              {desk.map((d) => {
                const pending = Math.max(0, d.cost - d.paid);
                const full = d.cost > 0 && pending === 0;
                return (
                  <div key={d.year} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{d.year}</span>
                      {full ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Paid in full
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-destructive">{inr(pending)} pending</span>
                      )}
                    </div>
                    <Progress value={d.cost ? Math.min(100, (d.paid / d.cost) * 100) : 0} className="h-1.5" />
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-semibold tabular-nums">{inr(d.cost)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">You paid</p>
                        <p className="font-semibold tabular-nums text-green-600">{inr(d.paid)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pending</p>
                        <p className={`font-semibold tabular-nums ${pending > 0 ? "text-destructive" : ""}`}>{inr(pending)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <PiggyBank className="h-4 w-4 text-primary" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Salary backup</p>
          </div>
          {!backup ? (
            <p className="mt-3 text-sm text-muted-foreground">No salary backup recorded for you.</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Backup held for you</p>
                  <p className="text-2xl font-bold tabular-nums">{inr(backup.held)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly salary</p>
                  <p className="text-2xl font-bold tabular-nums">{backup.salary ? inr(backup.salary) : "—"}</p>
                </div>
              </div>
              {backup.used.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground">Used from your backup</p>
                  <ul className="mt-1 divide-y divide-border/50 text-sm">
                    {backup.used.map((u) => (
                      <li key={u.label} className="flex justify-between py-1">
                        <span>{u.label}</span>
                        <span className="font-medium tabular-nums text-orange-600">−{inr(u.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nothing has been taken from your backup.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeskAndBackup;
