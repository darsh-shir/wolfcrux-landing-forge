import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatIndian } from "@/lib/utils";
import { useLiveRows } from "@/hooks/useLiveRows";

/** Fixed rate for showing the LTO pool in ₹ (set by management). */
const LTO_INR_PER_USD = 87;

const inr = (n: number) => `${n < 0 ? "-" : ""}₹${formatIndian(Math.abs(Math.round(n)), 0)}`;
const usd = (n: number) => `${n < 0 ? "-" : ""}$${formatIndian(Math.abs(n), 2)}`;

interface State {
  received: number;
  monthsPaid: number;
  joining: string | null;
  ltoUsd: number;
  rate: number | null;
  nextUnlock: string | null;
}

/**
 * Top of My Data: everything this person has been paid by Wolfcrux (₹, from the
 * admin's paid payout records) plus their LTO pool waiting to be released
 * (kept in $, shown in ₹ at a fixed ₹87 per $).
 */
const EarningsSummary = () => {
  const { user } = useAuth();
  const [s, setS] = useState<State | null>(null);

  const load = useCallback(() => {
    if (!user) return () => {};
    let active = true;
    void Promise.all([
      supabase
        .from("payout_records")
        .select("salary, bank_transfer, advance_cash, advance_bank, paid_cash, paid_online")
        .eq("user_id", user.id),
      supabase.from("lto_ledger").select("lto_amount, unlock_date, is_released").eq("user_id", user.id),
      supabase.from("profiles").select("joining_date").eq("user_id", user.id).maybeSingle(),
    ]).then(([pay, lto, prof]) => {
      if (!active) return;
      const paid = (pay.data ?? []).filter((r) => r.paid_cash || r.paid_online);
      const received = paid.reduce(
        (t, r) =>
          t + Number(r.salary || 0) + Number(r.bank_transfer || 0) + Number(r.advance_cash || 0) + Number(r.advance_bank || 0),
        0,
      );
      const waiting = (lto.data ?? []).filter((l) => !l.is_released);
      const unlocks = waiting
        .filter((l) => Number(l.lto_amount) > 0 && l.unlock_date)
        .map((l) => String(l.unlock_date))
        .sort();
      setS({
        received,
        monthsPaid: paid.length,
        joining: prof.data?.joining_date ?? null,
        ltoUsd: waiting.reduce((t, l) => t + Number(l.lto_amount || 0), 0),
        rate: LTO_INR_PER_USD,
        nextUnlock: unlocks[0] ?? null,
      });
    });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => load(), [load]);
  useLiveRows(user?.id, ["payout_records", "lto_ledger"], () => void load());

  if (!s) return <div className="skeleton-shimmer mb-6 h-28 rounded-lg" />;

  const ltoInr = s.rate ? s.ltoUsd * s.rate : null;
  const total = s.received + Math.max(0, ltoInr ?? 0);

  return (
    <Card className="mb-6 overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent animate-fade-in-up">
      <CardContent className="p-0">
        {/* The headline: everything paid to this person so far */}
        <div className="px-4 pb-5 pt-6 text-center sm:pb-6 sm:pt-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Earned with Wolfcrux</p>
          <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-primary sm:text-6xl">{inr(s.received)}</p>
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
            {s.monthsPaid > 0
              ? `Paid to you over ${s.monthsPaid} month${s.monthsPaid === 1 ? "" : "s"}${s.joining ? ` · with us since ${format(parseISO(s.joining), "MMM yyyy")}` : ""}`
              : "Your payment history is being added by the admin."}
          </p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60 bg-background/40">
          <div className="p-3 text-center sm:p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">LTO waiting for you</p>
            <p className="mt-1 text-lg font-bold tabular-nums sm:text-2xl">{ltoInr === null ? usd(s.ltoUsd) : inr(ltoInr)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {usd(s.ltoUsd)}
              {s.rate ? ` at ₹${s.rate}/$` : ""} · after 12 months, once your level's minimum is met
              {s.nextUnlock ? ` · first unlock ${format(parseISO(s.nextUnlock), "d MMM yyyy")}` : ""}
            </p>
          </div>
          <div className="p-3 text-center sm:p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total so far</p>
            <p className="mt-1 text-lg font-bold tabular-nums sm:text-2xl">{inr(total)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Earned + LTO waiting</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EarningsSummary;
