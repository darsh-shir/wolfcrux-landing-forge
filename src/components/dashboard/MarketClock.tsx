import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/**
 * NY + IST clocks with US-equity session badge.
 * Sessions (NY time):
 *   Pre-Market : 04:00 – 09:30
 *   Open       : 09:30 – 16:00
 *   Post-Market: 16:00 – 20:00
 *   Closed     : everything else / weekends
 */

interface SessionInfo {
  label: string;
  tone: "open" | "pre" | "post" | "closed";
}

const getSession = (nyDate: Date): SessionInfo => {
  const day = nyDate.getDay(); // 0 sun, 6 sat
  if (day === 0 || day === 6) return { label: "MARKET CLOSED", tone: "closed" };
  const minutes = nyDate.getHours() * 60 + nyDate.getMinutes();
  if (minutes >= 240 && minutes < 570) return { label: "PRE-MARKET", tone: "pre" };
  if (minutes >= 570 && minutes < 960) return { label: "MARKET OPEN", tone: "open" };
  if (minutes >= 960 && minutes < 1200) return { label: "POST-MARKET", tone: "post" };
  return { label: "MARKET CLOSED", tone: "closed" };
};

const formatTimeInZone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);

const getDateInZone = (date: Date, timeZone: string): Date => {
  // Returns a Date object whose local fields equal the wall-clock time in `timeZone`.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const d = new Date(0);
  d.setFullYear(get("year"), get("month") - 1, get("day"));
  d.setHours(get("hour"), get("minute"), get("second"), 0);
  // Day-of-week: rebuild via JS Date — getDay on the synthesized date matches NY local
  return d;
};

const toneClasses: Record<SessionInfo["tone"], string> = {
  open: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  pre: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  post: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const MarketClock = () => {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const ny = formatTimeInZone(now, "America/New_York");
  const ist = formatTimeInZone(now, "Asia/Kolkata");
  const session = getSession(getDateInZone(now, "America/New_York"));
  const dotPulse =
    session.tone === "open" || session.tone === "pre" || session.tone === "post"
      ? "animate-pulse"
      : "";

  return (
    <div className="flex items-center gap-3 sm:gap-4 font-mono text-xs">
      <div
        className={`flex items-center gap-2 px-2.5 py-1 rounded-sm border ${toneClasses[session.tone]}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotPulse}`}
          style={{
            backgroundColor:
              session.tone === "open"
                ? "#10b981"
                : session.tone === "pre"
                ? "#f59e0b"
                : session.tone === "post"
                ? "#3b82f6"
                : "#9ca3af",
          }}
        />
        <span className="font-semibold tracking-wider">{session.label}</span>
      </div>

      <div className="hidden sm:flex items-center gap-3 text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          <span className="font-semibold text-foreground">NY</span>
          <span className="tabular-nums">{ny}</span>
        </span>
        <span className="text-border">·</span>
        <span className="flex items-center gap-1.5">
          <span className="font-semibold text-foreground">IST</span>
          <span className="tabular-nums">{ist}</span>
        </span>
      </div>
    </div>
  );
};

export default MarketClock;
