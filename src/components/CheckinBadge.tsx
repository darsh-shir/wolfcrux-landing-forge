import { Badge } from "@/components/ui/badge";
import { type DayStatus, istTime, lateText } from "@/lib/checkins";

const late = (m: number | null) => (m && m > 0 ? ` ${lateText(m)}` : "");

/** One badge per check-in day; "set by admin" decisions get a small dot. */
export const StatusBadge = ({ status }: { status: DayStatus }) => {
  const admin = "byAdmin" in status && status.byAdmin ? " ·" : "";
  switch (status.kind) {
    case "ontime":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">On time{admin}</Badge>;
    case "late":
      return <Badge variant="destructive">Late{late(status.minutes)}{admin}</Badge>;
    case "half_day":
      return <Badge className="bg-orange-500 hover:bg-orange-500">Half day{admin}</Badge>;
    case "absent":
      return <Badge className="bg-slate-600 hover:bg-slate-600">Absent{admin}</Badge>;
    case "half_day_review":
      return <Badge variant="outline" className="border-orange-500/70 text-orange-700 dark:text-orange-400">Half day? {lateText(status.minutes)} late</Badge>;
    case "missed":
      return <Badge variant="outline" className="border-amber-500/70 text-amber-700 dark:text-amber-400">Missed check-in · out {istTime(status.at)}</Badge>;
    case "leave":
      return <Badge variant="secondary">{status.label}</Badge>;
    case "holiday":
      return <Badge variant="secondary">Holiday · {status.name}</Badge>;
    case "weekend":
      return <Badge variant="outline">Weekend</Badge>;
    case "future":
      return <Badge variant="outline">—</Badge>;
    default:
      return <Badge variant="outline" className="border-amber-500/70 text-amber-700 dark:text-amber-400">No punch</Badge>;
  }
};
