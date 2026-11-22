import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyINR } from "@/lib/utils";
import type { HistoryResult } from "@/lib/payoutEngine";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * The trader's month so far: net profit, trading days and the STO it would
 * earn at their level. An estimate — leave deductions and month-end
 * adjustments are applied when the month is finalised.
 */
const ThisMonthCard = ({ history }: { history: HistoryResult | null }) => {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const m = history?.byMonth.get(key);
  // STO earned in month M is paid around the 10th of month M+3.
  const pay = new Date(now.getFullYear(), now.getMonth() + 3, 10);
  const tone = (v: number) => (v >= 0 ? "text-green-600" : "text-red-600");
  if (!history) return null;

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{MONTHS[now.getMonth()]} so far · net profit</p>
          <p className={`text-2xl font-bold tabular-nums ${tone(m?.netProfit ?? 0)}`}>{formatCurrencyINR(m?.netProfit ?? 0, "$")}</p>
          <p className="text-xs text-muted-foreground">{m?.tradingDays ?? 0} trading days · after share and software costs</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimated STO ({m?.stoPercent ?? history.currentLevel.stoPercent}%)</p>
          <p className="text-2xl font-bold tabular-nums">{formatCurrencyINR(Math.max(0, m?.finalSto ?? 0), "$")}</p>
          <p className="text-xs text-muted-foreground">
            {m && m.priorDeficit > 0
              ? `Earlier losses of ${formatCurrencyINR(m.priorDeficit, "$")} are recovered first.`
              : "Before any leave deduction."}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid around</p>
          <p className="text-2xl font-bold">{pay.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
          <p className="text-xs text-muted-foreground">Final figures are confirmed when the month is closed.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ThisMonthCard;
