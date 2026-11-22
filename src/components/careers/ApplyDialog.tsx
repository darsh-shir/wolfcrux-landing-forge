import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Upload } from "lucide-react";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Role being applied for, e.g. "US Equity Trader" or "General application". */
  position: string;
}

/**
 * Job application form. The resume goes to a private storage bucket that only
 * admins can read; the application appears in Admin → Applications.
 */
const ApplyDialog = ({ open, onOpenChange, position }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setTimeout(() => {
        setDone(false);
        setError(null);
        setFile(null);
      }, 200);
    }
  };

  const pickFile = (f: File | null) => {
    setError(null);
    if (!f) return setFile(null);
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!TYPES[ext]) return setError("Please upload a PDF or Word document (.pdf, .doc, .docx).");
    if (f.size > MAX_BYTES) return setError("Your resume must be 5 MB or smaller.");
    setFile(f);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? "").trim();
    if (get("website")) return setDone(true); // spam bot honeypot
    if (!file) return setError("Please attach your resume.");

    setSubmitting(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop()!.toLowerCase();
      const path = `applications/${uuid()}.${ext}`;
      const up = await supabase.storage
        .from("resumes")
        .upload(path, file, { contentType: TYPES[ext], upsert: false });
      if (up.error) throw up.error;

      const ins = await supabase.from("job_applications").insert({
        position,
        full_name: get("fullName"),
        email: get("email"),
        phone: get("phone") || null,
        linkedin_url: get("linkedin") || null,
        message: get("message") || null,
        resume_path: path,
        resume_file_name: file.name.slice(0, 255),
      });
      if (ins.error) throw ins.error;
      setDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Application not submitted:", msg);
      setError(
        msg.includes("Too many submissions")
          ? "You've sent several applications recently. Please try again later."
          : "We couldn't submit your application. Please try again, or email your resume to info@wolfcrux.com."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {done ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <DialogTitle className="mt-4">Application received</DialogTitle>
            <DialogDescription className="mt-2">
              Thank you for applying for {position}. Our team will review your resume and get back to you.
            </DialogDescription>
            <Button className="mt-6" onClick={() => close(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Apply — {position}</DialogTitle>
              <DialogDescription>Fields marked * are required.</DialogDescription>
            </DialogHeader>

            <div className="hidden" aria-hidden="true">
              <label htmlFor="apply-website">Website</label>
              <input id="apply-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="apply-name">Full name *</Label>
                <Input id="apply-name" name="fullName" required maxLength={200} autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-email">Email *</Label>
                <Input id="apply-email" name="email" type="email" required maxLength={254} autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-phone">Phone</Label>
                <Input id="apply-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="apply-linkedin">LinkedIn profile</Label>
                <Input
                  id="apply-linkedin"
                  name="linkedin"
                  type="url"
                  maxLength={500}
                  placeholder="https://www.linkedin.com/in/…"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="apply-message">Why are you a good fit?</Label>
                <Textarea id="apply-message" name="message" maxLength={5000} className="min-h-[90px]" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="apply-resume">Resume * (PDF or Word, max 5 MB)</Label>
                <label
                  htmlFor="apply-resume"
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border p-3 text-sm hover:bg-muted/40"
                >
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{file ? file.name : "Choose a file…"}</span>
                </label>
                <input
                  id="apply-resume"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? "Submitting…" : "Submit application"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ApplyDialog;
