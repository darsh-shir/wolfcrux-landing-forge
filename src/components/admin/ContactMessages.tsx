import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { Inbox, Loader2, Mail, MailOpen, Reply, Trash2, RefreshCw } from "lucide-react";

type ContactMessage = Tables<"contact_messages">;

/** Admin inbox for messages sent through the website's Contact form. */
const ContactMessages = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ContactMessage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setMessages(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setRead = async (m: ContactMessage, is_read: boolean) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_read } : x)));
    const { error } = await supabase.from("contact_messages").update({ is_read }).eq("id", m.id);
    if (error) {
      toast({ title: "Couldn't update message", description: error.message, variant: "destructive" });
      void load();
    }
  };

  const open = (m: ContactMessage) => {
    setOpenId((cur) => (cur === m.id ? null : m.id));
    if (!m.is_read) void setRead(m, true);
  };

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("contact_messages").delete().eq("id", toDelete.id);
    if (error) {
      toast({ title: "Couldn't delete message", description: error.message, variant: "destructive" });
      return;
    }
    setMessages((prev) => prev.filter((x) => x.id !== toDelete.id));
    setToDelete(null);
    toast({ title: "Message deleted" });
  };

  const unread = messages.filter((m) => !m.is_read).length;
  const shown = unreadOnly ? messages.filter((m) => !m.is_read) : messages;

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 flex-wrap">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Inbox className="h-5 w-5" />
          Contact Messages
          {unread > 0 && <Badge variant="destructive">{unread} unread</Badge>}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant={unreadOnly ? "default" : "outline"} size="sm" onClick={() => setUnreadOnly((v) => !v)}>
            Unread only
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && messages.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Messages aren't available yet ({loadError}). The database update for this feature may not have been
            applied.
          </p>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {unreadOnly ? "No unread messages." : "No messages yet. Messages from the Contact page will appear here."}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {shown.map((m) => {
              const isOpen = openId === m.id;
              return (
                <li key={m.id} className="py-3">
                  <button type="button" onClick={() => open(m)} className="w-full text-left">
                    <div className="flex items-start gap-3">
                      {m.is_read ? (
                        <MailOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className={`truncate ${m.is_read ? "" : "font-semibold"}`}>
                            {m.first_name} {m.last_name}{" "}
                            <span className="text-sm font-normal text-muted-foreground">&lt;{m.email}&gt;</span>
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(m.created_at).toLocaleString("en-IN", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        <p className={`text-sm truncate ${m.is_read ? "text-muted-foreground" : ""}`}>{m.subject}</p>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-3 ml-7 space-y-3">
                      <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{m.message}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" asChild>
                          <a
                            href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(
                              `Re: ${m.subject}`
                            )}`}
                          >
                            <Reply className="mr-1.5 h-4 w-4" /> Reply by email
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void setRead(m, !m.is_read)}>
                          Mark as {m.is_read ? "unread" : "read"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setToDelete(m)}>
                          <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this message?"
        description={toDelete ? `From ${toDelete.first_name} ${toDelete.last_name} — this can't be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
    </Card>
  );
};

export default ContactMessages;
