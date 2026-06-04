import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Download, FileText, Loader2, Calendar, FileType } from "lucide-react";

const CATEGORY_LABEL: Record<string, string> = {
  salary_slip: "Salary Slip",
  offer_letter: "Offer Letter",
  confirmation_letter: "Confirmation Letter",
  appraisal_letter: "Appraisal Letter",
  experience_letter: "Experience Letter",
  id_proof: "ID Proof",
  contract: "Contract",
  other: "Other",
};

interface Doc {
  id: string;
  category: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  document_date: string | null;
  created_at: string;
}

const formatSize = (b?: number | null) => {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};

const MyDocuments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });
      if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
      else setDocs((data as Doc[]) || []);
      setLoading(false);
    })();
  }, [user]);

  const grouped = useMemo(() => {
    const g: Record<string, Doc[]> = {};
    docs.forEach((d) => {
      (g[d.category] ||= []).push(d);
    });
    return g;
  }, [docs]);

  const handleDownload = async (d: Doc) => {
    setDownloadingId(d.id);
    const { data, error } = await supabase.storage
      .from("employee-documents")
      .createSignedUrl(d.file_path, 60);
    setDownloadingId(null);
    if (error || !data) {
      toast({ title: "Download failed", description: error?.message, variant: "destructive" });
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = d.file_name;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileText className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">No documents yet</p>
          <p className="text-xs mt-1">Your HR / Admin will upload salary slips, offer letters and other documents here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> My Documents
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Personal documents uploaded by your admin. Click any card to download.
        </p>
      </div>

      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat} className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              {CATEGORY_LABEL[cat] || cat}
            </h3>
            <Badge variant="secondary" className="font-mono text-[10px]">{list.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((d) => (
              <Card
                key={d.id}
                className="group border-border/50 bg-gradient-to-br from-card to-muted/10 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                onClick={() => handleDownload(d)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8">
                      {downloadingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div>
                    <div className="font-semibold text-sm leading-tight line-clamp-2">{d.title}</div>
                    {d.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.description}</div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {d.document_date || new Date(d.created_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <FileType className="h-3 w-3" />
                      {formatSize(d.file_size)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MyDocuments;
