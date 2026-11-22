import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Download, ExternalLink, Loader2, Mail, RefreshCw, Trash2 } from "lucide-react";

type Application = Tables<"job_applications">;

const STATUSES = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "rejected", label: "Rejected" },
  { value: "hired", label: "Hired" },
] as const;

const statusTone: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  reviewing: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  shortlisted: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  rejected: "bg-muted text-muted-foreground border-border",
  hired: "bg-emerald-600 text-white border-emerald-600",
};

/** Admin list of job applications from the Careers page, with resume downloads. */
const JobApplications = () => {
  const { toast } = useToast();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("active");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Application | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setApps(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (a: Application, status: string) => {
    setApps((prev) => prev.map((x) => (x.id === a.id ? { ...x, status } : x)));
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", a.id);
    if (error) {
      toast({ title: "Couldn't update status", description: error.message, variant: "destructive" });
      void load();
    }
  };

  const download = async (a: Application) => {
    if (!a.resume_path) return;
    setDownloading(a.id);
    const { data, error } = await supabase.storage
      .from("resumes")
      .createSignedUrl(a.resume_path, 60, { download: a.resume_file_name || true });
    setDownloading(null);
    if (error || !data?.signedUrl) {
      toast({ title: "Couldn't open resume", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const remove = async () => {
    const a = toDelete;
    if (!a) return;
    if (a.resume_path) await supabase.storage.from("resumes").remove([a.resume_path]);
    const { error } = await supabase.from("job_applications").delete().eq("id", a.id);
    if (error) {
      toast({ title: "Couldn't delete application", description: error.message, variant: "destructive" });
      return;
    }
    setApps((prev) => prev.filter((x) => x.id !== a.id));
    setToDelete(null);
    toast({ title: "Application deleted" });
  };

  const shown = apps.filter((a) =>
    filter === "all" ? true : filter === "active" ? !["rejected", "hired"].includes(a.status) : a.status === filter
  );
  const newCount = apps.filter((a) => a.status === "new").length;

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 flex-wrap">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Briefcase className="h-5 w-5" />
          Job Applications
          {newCount > 0 && <Badge variant="destructive">{newCount} new</Badge>}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Open (not closed)</SelectItem>
              <SelectItem value="all">All</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && apps.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Applications aren't available yet ({loadError}). The database update for this feature may not have been
            applied.
          </p>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No applications here yet. Applications from the Careers page will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {shown.map((a) => (
              <li key={a.id} className="py-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {a.full_name}{" "}
                      <span className={`ml-1 rounded border px-1.5 py-0.5 text-[10px] uppercase ${statusTone[a.status] ?? ""}`}>
                        {a.status}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {a.position} ·{" "}
                      {new Date(a.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 hover:underline">
                        <Mail className="h-3.5 w-3.5" /> {a.email}
                      </a>
                      {a.phone && <span>{a.phone}</span>}
                      {a.linkedin_url && /^https?:\/\//i.test(a.linkedin_url) && (
                        <a
                          href={a.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          LinkedIn <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={a.status} onValueChange={(v) => void setStatus(a, v)}>
                      <SelectTrigger className="h-8 w-[130px]" aria-label="Application status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {a.resume_path && (
                      <Button size="sm" onClick={() => void download(a)} disabled={downloading === a.id}>
                        {downloading === a.id ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-1.5 h-4 w-4" />
                        )}
                        Resume
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setToDelete(a)} aria-label="Delete application">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {a.message && (
                  <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{a.message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this application?"
        description={toDelete ? `${toDelete.full_name}'s application and resume will be permanently deleted.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
    </Card>
  );
};

export default JobApplications;
