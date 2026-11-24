import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatIndian } from "@/lib/utils";
import { useLiveRows } from "@/hooks/useLiveRows";
import AnimatedNumber from "@/components/AnimatedNumber";

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
  // Hide/show preference, kept on the person's account so it follows them to every login and device.
  const saved = (user?.user_metadata as { hide_earnings?: boolean } | undefined)?.hide_earnings;
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof saved === "boolean") return saved;
    try {
      return localStorage.getItem("wolfcrux.hideEarnings") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof saved === "boolean") setHidden(saved);
  }, [saved]);
  const toggleHidden = async () => {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem("wolfcrux.hideEarnings", next ? "1" : "0");
    } catch {
      /* ignore */
    }
    await supabase.auth.updateUser({ data: { hide_earnings: next } });
  };

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

  if (!s) return <div className="skeleton-shimmer mb-6 h-40 rounded-lg" />;

  const ltoInr = s.rate ? s.ltoUsd * s.rate : null;
  const total = s.received + Math.max(0, ltoInr ?? 0);
  const masked = <span className="tracking-widest">₹ ******</span>;
  const money = (v: number) => (hidden ? masked : <AnimatedNumber value={v} format={inr} resetKey={v} />);

  return (
    <Card className="mb-6 border-primary/30 bg-primary/5 animate-fade-in-up">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Earned with Wolfcrux</p>
              <p className="text-xs text-muted-foreground">
                Earned till now + LTO waiting for you{s.joining ? ` · with us since ${format(parseISO(s.joining), "MMM yyyy")}` : ""}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:bg-primary/10 hover:text-foreground focus-visible:bg-primary/10"
            onClick={() => void toggleHidden()}
            aria-pressed={hidden}
            title={hidden ? "Show amounts" : "Hide amounts"}
          >
            {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{hidden ? "Show" : "Hide"}</span>
          </Button>
        </div>

        <p className="mt-4 text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">{money(total)}</p>

        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-primary/20 pt-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Earned till now</p>
            <p className="text-xl font-bold tabular-nums">{money(s.received)}</p>
            <p className="text-xs text-muted-foreground">
              {s.monthsPaid > 0
                ? `Paid to you over ${s.monthsPaid} month${s.monthsPaid === 1 ? "" : "s"}`
                : "Your payment history is being added by the admin."}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">LTO waiting for you</p>
            <p className="text-xl font-bold tabular-nums">{ltoInr === null ? (hidden ? masked : usd(s.ltoUsd)) : money(ltoInr)}</p>
            <p className="text-xs text-muted-foreground">
              {hidden ? "" : `${usd(s.ltoUsd)}${s.rate ? ` at ₹${s.rate}/$` : ""} · `}after 12 months, once your level's minimum is met
              {s.nextUnlock ? ` · first unlock ${format(parseISO(s.nextUnlock), "d MMM yyyy")}` : ""}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EarningsSummary;
