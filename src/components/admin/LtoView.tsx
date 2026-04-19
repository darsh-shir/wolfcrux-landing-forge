import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Landmark, ChevronDown, ChevronRight, Lock, Unlock, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface LtoEntry {
  id: string;
  user_id: string;
  month: number;
  year: number;
  net_profit: number;
  lto_amount: number;
  lto_percentage: number;
  unlock_date: string;
  is_released: boolean;
  released_at: string | null;
}

interface LtoViewProps {
  users: Profile[];
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);

const LtoView = ({ users }: LtoViewProps) => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<LtoEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [openTraders, setOpenTraders] = useState<Record<string, boolean>>({});

  useEffect(() => { fetchEntries(); }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const all: LtoEntry[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("lto_ledger")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      all.push(...(data as LtoEntry[]));
      if (data.length < 1000) break;
      from += 1000;
    }
    setEntries(all);
    setLoading(false);
  };

  const traderSummaries = useMemo(() => {
    const map: Record<string, {
      user_id: string;
      total: number;
      released: number;
      locked: number;
      nextUnlock: string | null;
      entries: LtoEntry[];
    }> = {};

    entries.forEach(e => {
      if (!map[e.user_id]) {
        map[e.user_id] = { user_id: e.user_id, total: 0, released: 0, locked: 0, nextUnlock: null, entries: [] };
      }
      const s = map[e.user_id];
      s.total += Number(e.lto_amount) || 0;
      if (e.is_released) {
        s.released += Number(e.lto_amount) || 0;
      } else {
        s.locked += Number(e.lto_amount) || 0;
        if (!s.nextUnlock || e.unlock_date < s.nextUnlock) {
          s.nextUnlock = e.unlock_date;
        }
      }
      s.entries.push(e);
    });

    Object.values(map).forEach(s => {
      s.entries.sort((a, b) => (b.year - a.year) || (b.month - a.month));
    });

    return users
      .map(u => ({
        user: u,
        summary: map[u.user_id] || { user_id: u.user_id, total: 0, released: 0, locked: 0, nextUnlock: null, entries: [] },
      }))
      .filter(x => x.summary.entries.length > 0)
      .sort((a, b) => b.summary.locked - a.summary.locked);
  }, [entries, users]);

  const toggle = (uid: string) => setOpenTraders(p => ({ ...p, [uid]: !p[uid] }));

  const handleRelease = async (entry: LtoEntry) => {
    const { error } = await supabase
      .from("lto_ledger")
      .update({ is_released: true, released_at: new Date().toISOString() })
      .eq("id", entry.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Released", description: `LTO of ${formatCurrency(entry.lto_amount)} released` });
    fetchEntries();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          LTO Pool — Per Trader
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Long-Term Obligation amounts pooled per month. Click a trader to see the month-by-month breakdown.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : traderSummaries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No LTO entries yet.</div>
        ) : (
          <div className="space-y-2">
            {traderSummaries.map(({ user, summary }) => (
              <Collapsible
                key={user.user_id}
                open={openTraders[user.user_id]}
                onOpenChange={() => toggle(user.user_id)}
              >
                <div className="border rounded-md overflow-hidden">
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3">
                        {openTraders[user.user_id] ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{user.full_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {summary.entries.length} {summary.entries.length === 1 ? "entry" : "entries"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Total Pooled</div>
                          <div className="font-bold">{formatCurrency(summary.total)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Released</div>
                          <div className="font-semibold text-success">{formatCurrency(summary.released)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Locked</div>
                          <div className="font-semibold text-warning">{formatCurrency(summary.locked)}</div>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <div className="text-xs text-muted-foreground">Next Unlock</div>
                          <div className="font-semibold text-xs">
                            {summary.nextUnlock ? format(new Date(summary.nextUnlock), "dd MMM yyyy") : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t bg-muted/20 p-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead>Net Profit</TableHead>
                            <TableHead>LTO %</TableHead>
                            <TableHead>LTO Amount</TableHead>
                            <TableHead>Unlock Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.entries.map(e => (
                            <TableRow key={e.id}>
                              <TableCell className="font-medium">
                                {MONTH_NAMES[e.month - 1]} {e.year}
                              </TableCell>
                              <TableCell>{formatCurrency(e.net_profit)}</TableCell>
                              <TableCell>{Number(e.lto_percentage).toFixed(1)}%</TableCell>
                              <TableCell className="font-semibold">{formatCurrency(e.lto_amount)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  {format(new Date(e.unlock_date), "dd MMM yyyy")}
                                </div>
                              </TableCell>
                              <TableCell>
                                {e.is_released ? (
                                  <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 gap-1">
                                    <Unlock className="h-3 w-3" /> Released
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="gap-1">
                                    <Lock className="h-3 w-3" /> Locked
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {!e.is_released && (
                                  <Button size="sm" variant="outline" onClick={() => handleRelease(e)}>
                                    Release
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LtoView;
