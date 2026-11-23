import { Badge } from "@/components/ui/badge";
import { type DayStatus, lateText } from "@/lib/checkins";

/** On time / Late / No punch / Holiday / Weekend badge for a check-in day. */
export const StatusBadge = ({ status }: { status: DayStatus }) => {
  switch (status.kind) {
    case "ontime":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">On time</Badge>;
    case "late":
      return <Badge variant="destructive">Late {lateText(status.minutes)}</Badge>;
    case "holiday":
      return <Badge variant="secondary">Holiday · {status.name}</Badge>;
    case "weekend":
      return <Badge variant="outline">Weekend</Badge>;
    case "future":
      return <Badge variant="outline">—</Badge>;
    default:
      return <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-400">No punch</Badge>;
  }
};
