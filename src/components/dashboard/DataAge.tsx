import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** When the data was produced (preferred) or fetched. */
  at: Date | string | null | undefined;
  /** Show a warning once the data is older than this many minutes. */
  staleAfterMinutes?: number;
  className?: string;
}

const ago = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

/**
 * Small "Updated 2:59 PM" stamp for a panel. Turns amber with a warning when
 * the data is older than `staleAfterMinutes`, so a frozen feed is obvious.
 */
const DataAge = ({ at, staleAfterMinutes = 60, className }: Props) => {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!at) return null;
  const date = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(date.getTime())) return null;

  const age = Date.now() - date.getTime();
  const stale = age > staleAfterMinutes * 60_000;
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <span
      title={date.toLocaleString()}
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10px] tabular-nums whitespace-nowrap",
        stale ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
        className
      )}
    >
      {stale && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
      {stale ? `Stale · ${ago(age)}` : `Updated ${time}`}
    </span>
  );
};

export default DataAge;
