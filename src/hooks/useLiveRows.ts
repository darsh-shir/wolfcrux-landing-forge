import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Re-run `reload` whenever an admin changes one of this person's rows in the
 * given tables (Supabase realtime, own rows only), and when the trader comes
 * back to the browser tab — so My Data always shows what admin last saved.
 */
export const useLiveRows = (userId: string | undefined, tables: string[], reload: () => void) => {
  const saved = useRef(reload);
  saved.current = reload;
  const key = tables.join(",");

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Several rows can change at once (e.g. a payout run); reload once.
    const run = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => saved.current(), 400);
    };
    let channel = supabase.channel(`my-money-${key}-${userId}`);
    for (const table of key.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` }, run);
    }
    channel.subscribe();
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [userId, key]);
};
