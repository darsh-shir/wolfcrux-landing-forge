import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Loader2 } from "lucide-react";

interface Person {
  user_id: string;
  full_name: string;
}
interface LogRow {
  id: number;
  changed_at: string;
  table_name: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  row_id: string | null;
  changed_by: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

const TABLE_LABELS: Record<string, string> = {
  trading_data: "Trade",
  payout_records: "Payment",
  sto_ledger: "STO",
  lto_ledger: "LTO",
  salary_backups: "Salary / backup",
  desk_costs: "Desk cost",
  trader_config: "Trader config",
  trader_baselines: "Baseline",
  profiles: "Employee",
  user_roles: "System role",
  attendance_records: "Attendance",
  trading_accounts: "Trading account",
  pnl_transfers: "P&L adjustment",
  monthly_exchange_rates: "USD→INR rate",
};
const ACTION_LABEL = { INSERT: "Added", UPDATE: "Changed", DELETE: "Deleted" } as const;
const HIDDEN = new Set(["updated_at", "created_at", "id"]);
const PAGE = 100;

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Admin: who changed what, and when, on payouts, trades, salaries and people. */
const ChangeHistory = ({ users }: { users: Person[] }) => {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [table, setTable] = useState("all");
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = useCallback((id: string | null | undefined) => (id ? users.find((u) => u.user_id === id)?.full_name ?? "Unknown" : null), [users]);

  const load = useCallback(
    async (append = false) => {
      setLoading(true);
      setError(null);
      let q = supabase.from("change_log" as never).select("*").order("changed_at", { ascending: false }).order("id", { ascending: false });
      if (table !== "all") q = q.eq("table_name", table);
      const from = append ? rows.length : 0;
      const { data, error: err } = await q.range(from, from + PAGE - 1);
      setLoading(false);
      if (err) {
        setError(err.message);
        return;
      }
      const list = (data ?? []) as unknown as LogRow[];
      setRows((prev) => (append ? [...prev, ...list] : list));
      setMore(list.length === PAGE);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, rows.length]
  );
  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const describe = (r: LogRow) => {
    const o = r.old_data ?? {};
    const n = r.new_data ?? {};
    const rec = r.action === "DELETE" ? o : n;
    const who = name((rec.user_id as string) ?? null);
    const subject = [who, rec.trade_date, rec.record_date, rec.month && rec.year ? `${rec.month}/${rec.year}` : rec.year, rec.full_name, rec.account_name]
      .filter(Boolean)
      .map(String)
      .join(" · ");
    if (r.action !== "UPDATE") return { subject, details: [] as string[] };
    const details = Object.keys({ ...o, ...n })
      .filter((k) => !HIDDEN.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]))
      .map((k) => `${k.replace(/_/g, " ")}: ${show(o[k])} → ${show(n[k])}`);
    return { subject, details };
  };

  const tables = useMemo(() => Object.entries(TABLE_LABELS).sort((a, b) => a[1].localeCompare(b[1])), []);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Change history
        </CardTitle>
        <Select value={table} onValueChange={setTable}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everything</SelectItem>
            {tables.map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Every change to trades, payouts, STO/LTO, salaries, desk costs, configs, attendance and employees since the move to
          the new database. "System" means an automatic calculation.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && rows.length === 0 && !loading && <p className="text-sm text-muted-foreground">No changes recorded yet.</p>}
        <ul className="divide-y">
          {rows.map((r) => {
            const { subject, details } = describe(r);
            return (
              <li key={r.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {new Date(r.changed_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  <Badge variant={r.action === "DELETE" ? "destructive" : r.action === "INSERT" ? "default" : "secondary"} className="text-[10px]">
                    {ACTION_LABEL[r.action]}
                  </Badge>
                  <span className="font-medium">{TABLE_LABELS[r.table_name] ?? r.table_name}</span>
                  {subject && <span className="text-muted-foreground">{subject}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">by {name(r.changed_by) ?? "System"}</span>
                </div>
                {details.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-1 text-xs text-muted-foreground">
                    {details.slice(0, 8).map((d) => <li key={d}>{d}</li>)}
                    {details.length > 8 && <li>+{details.length - 8} more fields</li>}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        {(more || loading) && (
          <div className="mt-3 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChangeHistory;
