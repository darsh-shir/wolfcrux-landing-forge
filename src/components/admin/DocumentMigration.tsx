import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

/**
 * One-time tool for the move from Lovable Cloud: copies the uploaded employee
 * documents from the old storage into this project's storage, and compares
 * record counts between the old and new databases. Runs entirely in the
 * admin's browser; the files never pass through anyone else.
 */
const OLD_URL = "https://gcdkemngjeaxenjtgoeo.supabase.co";
// Public (anon) key of the old project, as it was shipped in the website.
const OLD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZGtlbW5namVheGVuanRnb2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MTc1OTUsImV4cCI6MjA3OTA5MzU5NX0.cAXzENDowxzJH9jgDfF2lor3B9kXvDuWkbSWqSIKvUM";
const BUCKET = "employee-documents";
const TABLES = [
  "profiles", "trading_data", "attendance_records", "sto_ledger", "lto_ledger", "payout_records",
  "salary_backups", "desk_costs", "trader_config", "trader_milestones", "employee_documents", "holidays",
];

type Count = { table: string; old: number | null; now: number | null };

/** When the Lovable backup was taken; the new database starts from this point. */
const BACKUP_AT = Date.parse("2026-11-22T16:21:00Z");
/** Every table that existed on the old site (the big Followers table never changes). */
const SYNC_TABLES = [
  "profiles", "user_roles", "trading_accounts", "trader_account_assignments", "trader_baselines", "trader_config",
  "trader_milestones", "trader_monthly_manual", "trading_data", "attendance_devices", "attendance_shift_settings",
  "attendance_records", "biometric_attendance_logs", "adms_device_events", "holidays", "leave_carry_forward",
  "monthly_leave_summary", "monthly_exchange_rates", "sto_ledger", "lto_ledger", "payout_records", "salary_backups",
  "desk_costs", "trainee_pool_ledger", "employee_documents",
];
type Row = Record<string, unknown> & { id: string | number };
type TablePlan = { table: string; insert: Row[]; update: Row[]; review: string[] };

async function fetchAll(client: { from: (t: string) => any }, table: string): Promise<Row[]> {
  const all: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select("*").order("id").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) return all;
  }
}
const time = (v: unknown) => (typeof v === "string" ? Date.parse(v) : NaN);

const DocumentMigration = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Count[] | null>(null);
  const [plan, setPlan] = useState<TablePlan[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; copied: number; skipped: number; failed: string[] } | null>(null);

  const oldClient = () =>
    createClient(OLD_URL, OLD_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: "wolfcrux-old-lovable" },
    });

  const run = async () => {
    setBusy(true);
    setError(null);
    setCounts(null);
    setProgress(null);
    setPlan(null);
    setApplied(null);
    const old = oldClient();
    try {
      const { error: signInError } = await old.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw new Error(`Couldn't sign in to the old database: ${signInError.message}`);

      // 1. Compare record counts
      const rows: Count[] = [];
      for (const table of TABLES) {
        const [a, b] = await Promise.all([
          old.from(table).select("*", { count: "exact", head: true }),
          supabase.from(table as never).select("*", { count: "exact", head: true }),
        ]);
        rows.push({ table, old: a.error ? null : a.count ?? 0, now: b.error ? null : b.count ?? 0 });
      }
      setCounts(rows);

      // 2. List every file in the old bucket (folders are listed recursively)
      const paths: string[] = [];
      const walk = async (prefix: string) => {
        for (let offset = 0; ; offset += 1000) {
          const { data, error: listError } = await old.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
          if (listError) throw new Error(`Couldn't list old files: ${listError.message}`);
          for (const item of data ?? []) {
            const path = prefix ? `${prefix}/${item.name}` : item.name;
            if (item.id === null) await walk(path);
            else paths.push(path);
          }
          if (!data || data.length < 1000) break;
        }
      };
      await walk("");

      // 3. Copy each file that isn't already in the new storage
      const existing = new Set<string>();
      const walkNew = async (prefix: string) => {
        for (let offset = 0; ; offset += 1000) {
          const { data } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
          for (const item of data ?? []) {
            const path = prefix ? `${prefix}/${item.name}` : item.name;
            if (item.id === null) await walkNew(path);
            else existing.add(path);
          }
          if (!data || data.length < 1000) break;
        }
      };
      await walkNew("");
      const state = { done: 0, total: paths.length, copied: 0, skipped: 0, failed: [] as string[] };
      setProgress({ ...state });
      const queue = [...paths];
      const worker = async () => {
        while (queue.length) {
          const path = queue.shift()!;
          if (existing.has(path)) {
            state.skipped++;
            state.done++;
            setProgress({ ...state, failed: [...state.failed] });
            continue;
          }
          try {
            const { data: blob, error: dlError } = await old.storage.from(BUCKET).download(path);
            if (dlError || !blob) throw new Error(dlError?.message || "download failed");
            const { error: upError } = await supabase.storage
              .from(BUCKET)
              .upload(path, blob, { contentType: blob.type || undefined, upsert: false });
            if (upError) {
              if (/exists|duplicate/i.test(upError.message)) state.skipped++;
              else throw new Error(upError.message);
            } else state.copied++;
          } catch (e) {
            state.failed.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
          }
          state.done++;
          setProgress({ ...state, failed: [...state.failed] });
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));

      // 4. Records added or edited on the old site after the backup
      const plans: TablePlan[] = [];
      for (const table of SYNC_TABLES) {
        const [oldRows, newRows] = await Promise.all([fetchAll(old, table), fetchAll(supabase as never, table)]);
        const byId = new Map(newRows.map((r) => [String(r.id), r]));
        const oldIds = new Set(oldRows.map((r) => String(r.id)));
        const p: TablePlan = { table, insert: [], update: [], review: [] };
        for (const o of oldRows) {
          const n = byId.get(String(o.id));
          if (!n) {
            p.insert.push(o);
            continue;
          }
          if (JSON.stringify(o) === JSON.stringify(n)) continue;
          if ("updated_at" in o) {
            // Whichever side changed it last wins.
            if (time(o.updated_at) > time(n.updated_at)) p.update.push(o);
          } else {
            p.review.push(`${table} ${o.id}: different on the old and new site`);
          }
        }
        for (const n of newRows) {
          if (!oldIds.has(String(n.id)) && time(n.created_at) < BACKUP_AT) {
            p.review.push(`${table} ${n.id}: deleted on the old site after the backup (kept here)`);
          }
        }
        if (p.insert.length || p.update.length || p.review.length) plans.push(p);
      }
      setPlan(plans);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      await old.auth.signOut().catch(() => {});
      setBusy(false);
    }
  };

  const applyPlan = async () => {
    if (!plan) return;
    setApplying(true);
    setError(null);
    let done = 0;
    try {
      for (const p of plan) {
        const rows = [...p.insert, ...p.update];
        for (let i = 0; i < rows.length; i += 500) {
          const { error: upError } = await supabase.from(p.table as never).upsert(rows.slice(i, i + 500) as never, { onConflict: "id" });
          if (upError) throw new Error(`${p.table}: ${upError.message}`);
          done += Math.min(500, rows.length - i);
        }
      }
      setApplied(`${done} record(s) brought over from the old site.`);
      setPlan(null);
    } catch (e) {
      setError(`Stopped after ${done} record(s): ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setApplying(false);
    }
  };

  const different = counts?.filter((c) => c.old !== null && c.old !== c.now) ?? [];

  return (
    <Card className="mb-6 border-amber-500/40">
      <CardHeader>
        <CardTitle className="text-base">Copy documents from Lovable Cloud (one time)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in with your admin email and password. Your browser copies every uploaded document from the old storage
          into the new one, and compares record counts between the old and new databases. Safe to run again: files
          already copied are skipped.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="mig-email" className="text-xs">Admin email</Label>
            <Input id="mig-email" type="email" className="w-64" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mig-password" className="text-xs">Password</Label>
            <Input id="mig-password" type="password" className="w-48" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button onClick={() => void run()} disabled={busy || applying || !email || !password}>
            {busy ? "Checking…" : "Check and copy"}
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {progress && (
          <div className="space-y-1 text-sm">
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : 100} className="h-2" />
            <p>
              {progress.done} of {progress.total} files · copied {progress.copied} · already there {progress.skipped}
              {progress.failed.length > 0 && <span className="text-destructive"> · failed {progress.failed.length}</span>}
              {!busy && progress.done === progress.total && progress.failed.length === 0 && (
                <span className="text-green-600"> · all documents are in the new storage</span>
              )}
            </p>
            {progress.failed.length > 0 && (
              <ul className="max-h-32 overflow-auto text-xs text-destructive">
                {progress.failed.slice(0, 20).map((f) => <li key={f}>{f}</li>)}
              </ul>
            )}
          </div>
        )}

        {applied && <p className="text-sm font-medium text-green-600">{applied} Run the check again to confirm the counts match.</p>}
        {plan && (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            {plan.every((p) => !p.insert.length && !p.update.length) ? (
              <p className="font-medium text-green-600">No newer records on the old site — nothing to bring over.</p>
            ) : (
              <>
                <p className="font-medium">Changes made on the old site after the backup:</p>
                <ul className="text-xs">
                  {plan
                    .filter((p) => p.insert.length || p.update.length)
                    .map((p) => (
                      <li key={p.table}>
                        {p.table}: {p.insert.length} new, {p.update.length} edited
                      </li>
                    ))}
                </ul>
                <Button size="sm" onClick={() => void applyPlan()} disabled={applying}>
                  {applying ? "Bringing over…" : "Bring these over to the new site"}
                </Button>
              </>
            )}
            {plan.some((p) => p.review.length) && (
              <div className="text-xs text-amber-700">
                <p className="font-medium">Left as they are (check by hand if needed):</p>
                <ul className="max-h-32 overflow-auto">
                  {plan.flatMap((p) => p.review).slice(0, 30).map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {counts && (
          <div className="text-sm">
            <p className={different.length ? "font-medium text-amber-600" : "font-medium text-green-600"}>
              {different.length
                ? `${different.length} table(s) have a different number of records — see the changes listed above.`
                : "Record counts match between the old and new databases."}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-x-4 text-xs sm:max-w-md">
              <span className="text-muted-foreground">Table</span>
              <span className="text-right text-muted-foreground">Old</span>
              <span className="text-right text-muted-foreground">New</span>
              {counts.map((c) => (
                <span key={c.table} className="contents">
                  <span>{c.table}</span>
                  <span className="text-right tabular-nums">{c.old ?? "—"}</span>
                  <span className={`text-right tabular-nums ${c.old !== null && c.old !== c.now ? "text-amber-600 font-medium" : ""}`}>{c.now ?? "—"}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentMigration;
