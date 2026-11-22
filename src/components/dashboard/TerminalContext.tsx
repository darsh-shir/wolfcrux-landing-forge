import { createContext, useContext } from "react";
import type { PriceAlert } from "@/hooks/usePriceAlerts";

/**
 * Shared Terminal state so any panel can open the ticker detail panel, read or
 * change the trader's watchlist, and manage price alerts.
 */
export interface TerminalContextValue {
  openTicker: (symbol: string) => void;
  openSearch: () => void;
  watchlist: string[];
  addToWatchlist: (symbol: string) => Promise<{ ok: boolean; error?: string }>;
  removeFromWatchlist: (symbol: string) => void;
  alerts: PriceAlert[];
  addAlert: (symbol: string, direction: PriceAlert["direction"], price: number) => void;
  removeAlert: (id: string) => void;
}

const noop = () => {};
export const TerminalContext = createContext<TerminalContextValue>({
  openTicker: noop,
  openSearch: noop,
  watchlist: [],
  addToWatchlist: async () => ({ ok: false }),
  removeFromWatchlist: noop,
  alerts: [],
  addAlert: noop,
  removeAlert: noop,
});

export const useTerminal = () => useContext(TerminalContext);
