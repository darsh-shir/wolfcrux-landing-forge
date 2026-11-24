import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Landmark, ChevronDown, ChevronRight, Lock, Unlock, Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { roundLto } from "@/lib/payoutEngine";
import { getLtoReleaseThreshold, isLtoEntryReleasable } from "@/lib/payoutCalculations";

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
  /** Calculated amount, kept when the admin changed lto_amount. */
  lto_amount_original?: number | null;
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
  const [milestones, setMilestones] = useState<Record<string, number>>({});
  const [ltoEdit, setLtoEdit] = useState<Record<string, string>>({});
  const [savingLto, setSavingLto] = useState<string | null>(null);

  /** Save the admin's LTO amount; empty (or the calculated amount) goes back to calculated. */
  const saveLtoAmount = async (e: LtoEntry) => {
    const raw = (ltoEdit[e.id] ?? "").trim();
    const clear = () => setLtoEdit((x) => { const n = { ...x }; delete n[e.id]; return n; });
    const current = Number(e.lto_amount) || 0;
    const original = e.lto_amount_original === null || e.lto_amount_original === undefined ? null : Number(e.lto_amount_original);
    const calculated = original ?? current;
    const wanted = raw === "" ? calculated : roundLto(Number(raw));
    if (!Number.isFinite(wanted)) return clear();
    if (Math.abs(wanted - current) < 0.005) return clear();
    const backToCalc = Math.abs(wanted - calculated) < 0.005;
    setSavingLto(e.id);
    const { error } = await supabase
      .from("lto_ledger")
      .update(backToCalc ? { lto_amount: calculated, lto_amount_original: null } : { lto_amount: wanted, lto_amount_original: calculated })
      .eq("id", e.id);
    setSavingLto(null);
    if (error) {
      toast({ title: "Couldn't save the LTO amount", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: backToCalc ? "LTO back to the calculated amount" : `LTO set to ${formatCurrency(wanted)}`,
      description: backToCalc ? undefined : `Original ${formatCurrency(calculated)}`,
    });
    clear();
    void fetchEntries();
  };

  useEffect(() => { fetchEntries(); fetchMilestones(); }, []);

  const fetchMilestones = async () => {
    const { data } = await supabase.from("trader_milestones").select("user_id,current_level");
    const map: Record<string, number> = {};
    (data || []).forEach((m: any) => { map[m.user_id] = Number(m.current_level) || 0; });
    setMilestones(map);
  };

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

  const handleRelease = async (entry: LtoEntry, totalPool: number, level: number) => {
    const threshold = getLtoReleaseThreshold(level);
    if (totalPool < threshold) {
      toast({
        title: "Minimum LTO not reached",
        description: `Trader is at Level ${level}. Total LTO pool ${formatCurrency(totalPool)} is below the ${formatCurrency(threshold)} minimum required to release.`,
        variant: "destructive",
      });
      return;
    }
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
            {traderSummaries.map(({ user, summary }) => {
              const level = milestones[user.user_id] ?? 0;
              const threshold = getLtoReleaseThreshold(level);
              const meetsThreshold = summary.total >= threshold;
              const remaining = Math.max(0, threshold - summary.total);
              return (
              <Collapsible
                key={user.user_id}
                open={openTraders[user.user_id]}
                onOpenChange={() => toggle(user.user_id)}
              >
                <div className="border rounded-md overflow-hidden">
                  <CollapsibleTrigger className="w-full text-left">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-3 md:px-4 py-3 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {openTraders[user.user_id] ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-medium truncate">{user.full_name}</span>
                        <Badge variant="outline" className="text-xs">
                          Level {level}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {summary.entries.length} {summary.entries.length === 1 ? "entry" : "entries"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:flex md:items-center gap-3 md:gap-4 text-sm">
                        <div className="text-left md:text-right">
                          <div className="text-xs text-muted-foreground">Total Pooled</div>
                          <div className="font-bold">{formatCurrency(summary.total)}</div>
                        </div>
                        <div className="text-left md:text-right">
                          <div className="text-xs text-muted-foreground">Released</div>
                          <div className="font-semibold text-success">{formatCurrency(summary.released)}</div>
                        </div>
                        <div className="text-left md:text-right">
                          <div className="text-xs text-muted-foreground">Locked</div>
                          <div className="font-semibold text-warning">{formatCurrency(summary.locked)}</div>
                        </div>
                        <div className="text-left md:text-right md:min-w-[120px]">
                          <div className="text-xs text-muted-foreground">Min to Release</div>
                          <div className={`font-semibold text-xs ${meetsThreshold ? "text-success" : "text-warning"}`}>
                            {formatCurrency(threshold)}
                          </div>
                        </div>
                        <div className="text-left md:text-right md:min-w-[100px] col-span-2">
                          <div className="text-xs text-muted-foreground">Next Unlock</div>
                          <div className="font-semibold text-xs">
                            {summary.nextUnlock ? format(new Date(summary.nextUnlock), "dd MMM yyyy") : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t bg-muted/20 p-3 space-y-3">
                      {!meetsThreshold && threshold > 0 && (
                        <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-warning/10 border border-warning/30 text-xs">
                          <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Level {level} minimum not reached.</span>{" "}
                            Trader needs <span className="font-semibold">{formatCurrency(remaining)}</span> more in the LTO pool before any entry can be released
                            (minimum {formatCurrency(threshold)} required at Level {level}).
                          </div>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                      <Table className="min-w-[900px]">
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
                          {summary.entries.map(e => {
                            const dateReached = new Date(e.unlock_date) <= new Date();
                            const amt = Number(e.lto_amount) || 0;
                            const releasable = amt > 0 && isLtoEntryReleasable({
                              unlockDate: e.unlock_date,
                              currentLevel: level,
                              totalLtoPool: summary.total,
                            });
                            return (
                            <TableRow key={e.id}>
                              <TableCell className="font-medium">
                                {MONTH_NAMES[e.month - 1]} {e.year}
                              </TableCell>
                              <TableCell>{formatCurrency(e.net_profit)}</TableCell>
                              <TableCell>{Number(e.lto_percentage).toFixed(1)}%</TableCell>
                              <TableCell className={`font-semibold ${amt < 0 ? "text-destructive" : ""}`}>
                                {e.is_released ? (
                                  formatCurrency(amt)
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">$</span>
                                    <AmountInput
                                      allowNegative
                                      allowDecimal={false}
                                      className={`h-8 w-28 text-right font-semibold ${e.lto_amount_original != null ? "border-amber-500/60" : ""}`}
                                      value={ltoEdit[e.id] ?? String(amt)}
                                      onValueChange={(v) => setLtoEdit((x) => ({ ...x, [e.id]: v }))}
                                      onBlur={() => ltoEdit[e.id] !== undefined && void saveLtoAmount(e)}
                                      onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
                                      disabled={savingLto === e.id}
                                      title="Change this month's LTO. Clear it to go back to the calculated amount."
                                      aria-label={`LTO amount ${MONTH_NAMES[e.month - 1]} ${e.year}`}
                                    />
                                  </div>
                                )}
                                {e.lto_amount_original != null && (
                                  <span className="mt-0.5 block text-[11px] font-normal text-amber-700 dark:text-amber-400">
                                    Edited · original {formatCurrency(Number(e.lto_amount_original))}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  {format(new Date(e.unlock_date), "dd MMM yyyy")}
                                </div>
                              </TableCell>
                              <TableCell>
                                {e.is_released ? (
                                  <Badge className="bg-success/10 text-success hover:bg-success/20 gap-1">
                                    <Unlock className="h-3 w-3" /> Released
                                  </Badge>
                                ) : releasable ? (
                                  <Badge variant="outline" className="gap-1 border-success/40 text-success">
                                    <Unlock className="h-3 w-3" /> Ready
                                  </Badge>
                                ) : amt < 0 ? (
                                  <Badge variant="secondary" className="gap-1 text-destructive">
                                    Loss adjustment
                                  </Badge>
                                ) : dateReached ? (
                                  <Badge variant="secondary" className="gap-1">
                                    <Lock className="h-3 w-3" /> Awaiting Min
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="gap-1">
                                    <Lock className="h-3 w-3" /> Locked
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {!e.is_released && amt > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!releasable}
                                    title={
                                      !dateReached
                                        ? "Unlock date not reached yet"
                                        : !meetsThreshold
                                        ? `Min ${formatCurrency(threshold)} pool required at Level ${level}`
                                        : "Release this LTO entry"
                                    }
                                    onClick={() => handleRelease(e, summary.total, level)}
                                  >
                                    Release
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={3} className="font-semibold">Net Total</TableCell>
                            <TableCell className={`font-bold ${summary.total < 0 ? "text-destructive" : ""}`}>
                              {formatCurrency(summary.total)}
                            </TableCell>
                            <TableCell colSpan={3}></TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LtoView;
