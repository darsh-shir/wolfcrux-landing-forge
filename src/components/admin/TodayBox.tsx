import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyINR } from "@/lib/utils";
import { nyDateKey } from "@/lib/marketDate";
import { defaultStoMonth } from "@/components/admin/PayoutRun";
import { loadCheckins, loadHolidays, loadLeaves, loadShifts, needsReview, statusFor, todayIST } from "@/lib/checkins";
import { isExEmployee } from "@/lib/employees";

interface Person {
  user_id: string;
  full_name: string;
  employee_role?: string | null;
  uses_biometric?: boolean | null;
}
interface Trade {
  user_id: string;
  trade_date: string;
  net_pnl: number;
  trader2_id?: string | null;
  trader2_role?: string | null;
  is_holiday?: boolean | null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Most recent weekday on or before `key` (YYYY-MM-DD, New York trading date). */
const lastWeekday = (key: string) => {
  const d = new Date(`${key}T12:00:00Z`);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
const prettyDate = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/**
 * At-a-glance box for the Admin dashboard: the latest trading day's result,
 * who has no entry for today, and how many of this month's payouts are unpaid.
 */
const TodayBox = ({
  users,
  tradingData,
  onOpen,
  onOpenDay,
}: {
  users: Person[];
  tradingData: Trade[];
  onOpen: (tab: string) => void;
  /** Open Single Day P&L on this date. */
  onOpenDay: (date: string) => void;
}) => {
  const today = lastWeekday(nyDateKey());
  const traders = users.filter((u) => ["trader", "trainee"].includes((u.employee_role || "").toLowerCase()));
  const name = (id: string) => users.find((u) => u.user_id === id)?.full_name || "Unknown";

  const { latestDate, total, best, worst, entered } = useMemo(() => {
    const dates = tradingData.filter((t) => !t.is_holiday).map((t) => t.trade_date);
    const latestDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
    const byPerson = new Map<string, number>();
    let total = 0;
    for (const t of tradingData) {
      if (t.trade_date !== latestDate || t.is_holiday) continue;
      const pnl = Number(t.net_pnl) || 0;
      total += pnl;
      byPerson.set(t.user_id, (byPerson.get(t.user_id) ?? 0) + pnl);
    }
    const ranked = [...byPerson.entries()].sort((a, b) => b[1] - a[1]);
    const entered = new Set<string>();
    for (const t of tradingData) {
      if (t.trade_date !== today) continue;
      entered.add(t.user_id);
      if (t.trader2_id) entered.add(t.trader2_id);
    }
    return { latestDate, total, best: ranked[0] ?? null, worst: ranked.length > 1 ? ranked[ranked.length - 1] : null, entered };
  }, [tradingData, today]);

  const missing = traders.filter((u) => !entered.has(u.user_id));

  const due = defaultStoMonth();
  const [unpaid, setUnpaid] = useState<{ unpaid: number; total: number } | null>(null);
  useEffect(() => {
    void supabase
      .from("sto_ledger")
      .select("is_paid")
      .eq("month", due.month)
      .eq("year", due.year)
      .then(({ data, error }) => {
        if (!error && data) setUnpaid({ unpaid: data.filter((r) => !r.is_paid).length, total: data.length });
      });
  }, [due.month, due.year]);

  // Today's fingerprint check-ins
  const [checkins, setCheckins] = useState<{ ontime: number; late: number; review: number; total: number } | null>(null);
  useEffect(() => {
    const d = todayIST();
    Promise.all([loadCheckins(d, d), loadShifts(), loadHolidays(d, d), loadLeaves(d, d)])
      .then(([days, shifts, hols, leaves]) => {
        const byUser = new Map(days.map((x) => [x.user_id, x]));
        const people = users.filter(
          (u) => ["trader", "trainee"].includes((u.employee_role || "").toLowerCase()) && !isExEmployee(u) && u.uses_biometric !== false
        );
        const c = { ontime: 0, late: 0, review: 0, total: people.length };
        people.forEach((u) => {
          const st = statusFor(d, byUser.get(u.user_id), shifts, hols, leaves.get(`${u.user_id}|${d}`));
          if (st.kind === "ontime") c.ontime++;
          else if (st.kind === "late" || st.kind === "half_day") c.late++;
          else if (needsReview(st)) c.review++;
        });
        setCheckins(c);
      })
      .catch(() => setCheckins(null));
  }, [users]);

  const tone = (v: number) => (v >= 0 ? "text-green-600" : "text-red-600");

  return (
    <Card className="mb-6">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          disabled={!latestDate}
          onClick={() => latestDate && onOpenDay(latestDate)}
          title={latestDate ? "Open this day in Single Day P&L" : undefined}
          className="space-y-1 rounded-md text-left transition-colors enabled:hover:bg-muted/50 enabled:cursor-pointer -m-2 p-2"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {latestDate ? `Latest day · ${prettyDate(latestDate)} →` : "Latest day"}
          </p>
          {latestDate ? (
            <>
              <p className={`text-2xl font-bold tabular-nums ${tone(total)}`}>{formatCurrencyINR(total, "$")}</p>
              <p className="text-xs text-muted-foreground">
                {best && (
                  <>
                    Top: <span className="font-medium text-foreground">{name(best[0])}</span>{" "}
                    <span className={tone(best[1])}>{formatCurrencyINR(best[1], "$")}</span>
                  </>
                )}
                {worst && (
                  <>
                    {" · "}Worst: <span className="font-medium text-foreground">{name(worst[0])}</span>{" "}
                    <span className={tone(worst[1])}>{formatCurrencyINR(worst[1], "$")}</span>
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No trades yet.</p>
          )}
        </button>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Entries for {prettyDate(today)}</p>
          <p className="text-2xl font-bold tabular-nums">
            {traders.length - missing.length}
            <span className="text-base font-normal text-muted-foreground"> / {traders.length}</span>
          </p>
          {missing.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Missing: {missing.slice(0, 6).map((u) => u.full_name).join(", ")}
              {missing.length > 6 && ` +${missing.length - 6} more`}
              {" · "}
              <button type="button" className="text-primary underline" onClick={() => onOpen("trading")}>
                Enter trades
              </button>
            </p>
          ) : (
            <p className="text-xs text-green-600">Everyone's entry is in.</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpen("biometric")}
          className="-m-2 space-y-1 rounded-md p-2 text-left transition-colors hover:bg-muted/50"
          title="Open Check-ins"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Check-ins today →</p>
          {checkins ? (
            <>
              <p className="text-2xl font-bold tabular-nums">
                <span className="text-green-600">{checkins.ontime}</span>
                <span className="text-base font-normal text-muted-foreground"> on time</span>
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-red-600">{checkins.late} late</span>
                {" · "}
                <span className="font-medium text-amber-600">{checkins.review} need review</span>
                {" · "}
                {checkins.total} on fingerprint
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </button>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {MONTHS[due.month - 1]} {due.year} STO (paid on the 10th)
          </p>
          {unpaid ? (
            <>
              <p className="text-2xl font-bold tabular-nums">
                {unpaid.unpaid}
                <span className="text-base font-normal text-muted-foreground"> unpaid of {unpaid.total} saved</span>
              </p>
              <button type="button" className="text-xs text-primary underline" onClick={() => onOpen("payout-run")}>
                Open Payout Run
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TodayBox;
