import type { ExtendedHoursQuote } from "@/lib/tipranksQuote";
import { cn, fmtAmt } from "@/lib/utils";

interface Props {
  extended: ExtendedHoursQuote | null | undefined;
  /** Also show the extended-hours price, not just the % move. */
  showPrice?: boolean;
  className?: string;
}

/**
 * Small labelled pre-market / after-hours move, shown next to the regular
 * session numbers, e.g. "AH $130.03 +3.58%".
 */
const ExtendedHoursBadge = ({ extended, showPrice = false, className }: Props) => {
  if (!extended) return null;
  const up = extended.changesPercentage >= 0;
  const label = extended.session === "pre" ? "PM" : "AH";
  const title = `${extended.session === "pre" ? "Pre-market" : "After-hours"}: $${extended.price.toFixed(
    2
  )} (${up ? "+" : ""}${extended.changesPercentage.toFixed(2)}% vs close)`;

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded border border-border/70 bg-muted/40 px-1 py-px font-mono text-[10px] leading-none tabular-nums whitespace-nowrap",
        className
      )}
    >
      <span className="font-semibold text-muted-foreground">{label}</span>
      {showPrice && <span className="text-foreground">${fmtAmt(extended.price, 2)}</span>}
      <span className={up ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
        {up ? "+" : ""}
        {extended.changesPercentage.toFixed(2)}%
      </span>
    </span>
  );
};

export default ExtendedHoursBadge;
