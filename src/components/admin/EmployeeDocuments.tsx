import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Upload, Download, Trash2, Eye, EyeOff, FileText, Search, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

const CATEGORIES = [
  { value: "salary_slip", label: "Salary Slip" },
  { value: "offer_letter", label: "Offer Letter" },
  { value: "confirmation_letter", label: "Confirmation Letter" },
  { value: "appraisal_letter", label: "Appraisal Letter" },
  { value: "experience_letter", label: "Experience Letter" },
  { value: "id_proof", label: "ID Proof" },
  { value: "contract", label: "Contract" },
  { value: "other", label: "Other" },
] as const;

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
);

interface Doc {
  id: string;
  user_id: string;
  category: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  document_date: string | null;
  is_hidden: boolean;
  created_at: string;
}

const formatSize = (b?: number | null) => {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};

const EmployeeDocuments = ({ users }: { users: Profile[] }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // form
  const [fUser, setFUser] = useState("");
  const [fCategory, setFCategory] = useState("salary_slip");
  const [fTitle, setFTitle] = useState("");
  const [fDate, setFDate] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fFile, setFFile] = useState<File | null>(null);

  const userMap = useMemo(
    () => Object.fromEntries(users.map((u) => [u.user_id, u.full_name])),
    [users]
  );

  const fetchDocs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employee_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    else setDocs((data as Doc[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (filterUser !== "all" && d.user_id !== filterUser) return false;
      if (filterCategory !== "all" && d.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (userMap[d.user_id] || "").toLowerCase();
        if (!d.title.toLowerCase().includes(q) && !name.includes(q)) return false;
      }
      return true;
    });
  }, [docs, filterUser, filterCategory, search, userMap]);

  const handleUpload = async () => {
    if (!fUser || !fTitle || !fFile) {
      toast({ title: "Missing fields", description: "User, title and file are required", variant: "destructive" });
      return;
    }
    if (fFile.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 20MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = fFile.name.split(".").pop() || "bin";
      const safeTitle = fTitle.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);
      const path = `${fUser}/${Date.now()}_${safeTitle}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("employee-documents")
        .upload(path, fFile, { contentType: fFile.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("employee_documents").insert({
        user_id: fUser,
        category: fCategory as any,
        title: fTitle,
        description: fDesc || null,
        file_path: path,
        file_name: fFile.name,
        file_size: fFile.size,
        mime_type: fFile.type || null,
        document_date: fDate || null,
        uploaded_by: user?.id,
      });
      if (insErr) throw insErr;

      toast({ title: "Uploaded", description: `${fTitle} added` });
      setFTitle(""); setFDesc(""); setFDate(""); setFFile(null);
      const input = document.getElementById("doc-file") as HTMLInputElement | null;
      if (input) input.value = "";
      fetchDocs();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (d: Doc) => {
    const { data, error } = await supabase.storage
      .from("employee-documents")
      .createSignedUrl(d.file_path, 60);
    if (error || !data) {
      toast({ title: "Download failed", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleToggleHidden = async (d: Doc) => {
    const { error } = await supabase
      .from("employee_documents")
      .update({ is_hidden: !d.is_hidden })
      .eq("id", d.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else fetchDocs();
  };

  const handleDelete = async (d: Doc) => {
    if (!confirm(`Delete "${d.title}"? This cannot be undone.`)) return;
    await supabase.storage.from("employee-documents").remove([d.file_path]);
    const { error } = await supabase.from("employee_documents").delete().eq("id", d.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Deleted" });
      fetchDocs();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Upload form */}
      <Card className="lg:col-span-1 border-border/50 bg-gradient-to-br from-card to-muted/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-primary" /> Upload Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Employee</Label>
            <Select value={fUser} onValueChange={setFUser}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={fCategory} onValueChange={setFCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="e.g. Salary Slip - Jan 2026" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Document Date (optional)</Label>
            <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={2} placeholder="Internal notes…" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">File (max 20MB)</Label>
            <Input id="doc-file" type="file" onChange={(e) => setFFile(e.target.files?.[0] || null)} />
          </div>

          <Button onClick={handleUpload} disabled={uploading} className="w-full">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="lg:col-span-2 border-border/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" /> All Documents
              <Badge variant="secondary" className="ml-1 font-mono">{filtered.length}</Badge>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="pl-7 h-9 w-40"
                />
              </div>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">No documents found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <TableRow key={d.id} className="group">
                      <TableCell className="font-medium">{userMap[d.user_id] || "—"}</TableCell>
                      <TableCell>
                        <div className="font-medium">{d.title}</div>
                        {d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">{CATEGORY_LABEL[d.category] || d.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {d.document_date || new Date(d.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{formatSize(d.file_size)}</TableCell>
                      <TableCell>
                        {d.is_hidden ? (
                          <Badge variant="secondary" className="gap-1"><EyeOff className="h-3 w-3" />Hidden</Badge>
                        ) : (
                          <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/20 border-0"><Eye className="h-3 w-3" />Visible</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" onClick={() => handleDownload(d)} title="Download">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleToggleHidden(d)} title={d.is_hidden ? "Show" : "Hide"}>
                            {d.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(d)} title="Delete" className="hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDocuments;
