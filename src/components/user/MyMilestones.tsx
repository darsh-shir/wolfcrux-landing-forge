import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy } from "lucide-react";
import { formatIndian } from "@/lib/utils";

interface Entry {
  month: number;
  year: number;
  milestone_amount: number;
  amount_given: number;
  notes: string | null;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Shows the monthly milestone amounts the admin set manually for this trader. */
const MyMilestones = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("trader_monthly_manual" as any)
        .select("month, year, milestone_amount, amount_given, notes")
        .eq("user_id", user.id)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (!active) return;
      setEntries((data || []) as any);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel("my-monthly-manual")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trader_monthly_manual", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const totalMilestone = entries.reduce((s, e) => s + Number(e.milestone_amount || 0), 0);
  const totalGiven = entries.reduce((s, e) => s + Number(e.amount_given || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5 text-primary" />
          Monthly Milestones
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton-shimmer h-10 rounded-md" />)}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No milestone amounts have been set yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Total Milestone (Till Date)</p>
                <p className="text-xl font-bold text-foreground">${formatIndian(totalMilestone)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Total Money Given (Till Date)</p>
                <p className="text-xl font-bold text-emerald-600">${formatIndian(totalGiven)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Milestone</TableHead>
                    <TableHead className="text-right">Money Given</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={`${e.year}-${e.month}`}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {MONTH_NAMES[e.month - 1]} {e.year}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${formatIndian(Number(e.milestone_amount || 0))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        ${formatIndian(Number(e.amount_given || 0))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MyMilestones;
