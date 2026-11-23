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

const DocumentMigration = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Count[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; copied: number; skipped: number; failed: string[] } | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setCounts(null);
    setProgress(null);
    const old = createClient(OLD_URL, OLD_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: "wolfcrux-old-lovable" },
    });
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
      const state = { done: 0, total: paths.length, copied: 0, skipped: 0, failed: [] as string[] };
      setProgress({ ...state });
      const queue = [...paths];
      const worker = async () => {
        while (queue.length) {
          const path = queue.shift()!;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      await old.auth.signOut().catch(() => {});
      setBusy(false);
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
          <Button onClick={() => void run()} disabled={busy || !email || !password}>
            {busy ? "Copying…" : "Start copy"}
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

        {counts && (
          <div className="text-sm">
            <p className={different.length ? "font-medium text-amber-600" : "font-medium text-green-600"}>
              {different.length
                ? `${different.length} table(s) differ — the old database has newer entries than the backup. Tell Claude to reload from a fresh export.`
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
