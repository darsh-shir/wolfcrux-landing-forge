import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WifiOff } from "lucide-react";
import { IST, isWeekend, todayIST } from "@/lib/checkins";

/**
 * Banner across Admin when the fingerprint machine hasn't been in touch for
 * 30+ minutes during office hours (weekdays, 1 pm – 11:30 pm India time).
 */
const MachineAlert = ({ onOpen }: { onOpen: () => void }) => {
  const [stale, setStale] = useState<{ name: string; mins: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const [h, m] = new Date().toLocaleTimeString("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
      const now = h * 60 + m;
      if (isWeekend(todayIST()) || now < 13 * 60 || now > 23 * 60 + 30) {
        if (!cancelled) setStale(null);
        return;
      }
      const { data } = await supabase.from("attendance_devices").select("device_name, last_seen_at").eq("is_active", true);
      const worst = (data ?? [])
        .map((d) => ({ name: d.device_name, mins: d.last_seen_at ? Math.round((Date.now() - new Date(d.last_seen_at).getTime()) / 60000) : Infinity }))
        .sort((a, b) => b.mins - a.mins)[0];
      if (!cancelled) setStale(worst && worst.mins >= 30 ? worst : null);
    };
    void check();
    const t = setInterval(check, 2 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!stale) return null;
  const since = stale.mins === Infinity ? "has never connected" : stale.mins >= 120 ? `offline for ${Math.round(stale.mins / 60)} hours` : `offline for ${stale.mins} minutes`;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm">
      <WifiOff className="h-4 w-4 text-red-600" />
      <span>
        <span className="font-medium">Fingerprint machine {stale.name} is {since}.</span>{" "}
        Check its power and internet. Punches are kept on the machine and arrive once it reconnects.
      </span>
      <button type="button" className="ml-auto font-medium text-red-700 underline dark:text-red-400" onClick={onOpen}>
        Open Check-ins
      </button>
    </div>
  );
};

export default MachineAlert;
