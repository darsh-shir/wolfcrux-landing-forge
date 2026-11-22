import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Clock, Search, Star } from "lucide-react";

const RECENT_KEY = "wolfcrux:ticker-search-recent";
const sanitize = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);

const loadRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.slice(0, 8) : [];
  } catch {
    return [];
  }
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (symbol: string) => void;
  watchlist: string[];
}

/** True when the keyboard focus is in a text field, so shortcuts don't steal typing. */
const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
};

/** Registers "/" and Ctrl/Cmd+K to open the search. */
export const useTickerSearchHotkeys = (open: () => void) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        open();
      } else if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
};

const TickerSearch = ({ open, onOpenChange, onPick, watchlist }: Props) => {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(loadRecent);

  useEffect(() => {
    if (open) {
      setQuery("");
      setRecent(loadRecent());
    }
  }, [open]);

  const pick = (raw: string) => {
    const sym = sanitize(raw);
    if (!sym) return;
    const next = [sym, ...recent.filter((s) => s !== sym)].slice(0, 8);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
    onOpenChange(false);
    onPick(sym);
  };

  const typed = sanitize(query);
  const recentOnly = recent.filter((s) => !watchlist.includes(s));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a ticker, e.g. NVDA — press Enter"
        value={query}
        onValueChange={setQuery}
        aria-label="Ticker search"
      />
      <CommandList>
        <CommandEmpty>Type a ticker symbol.</CommandEmpty>
        {typed && (
          <CommandGroup heading="Open">
            <CommandItem value={`open-${typed}`} forceMount onSelect={() => pick(typed)}>
              <Search className="mr-2 h-4 w-4" />
              <span className="font-mono font-semibold">{typed}</span>
            </CommandItem>
          </CommandGroup>
        )}
        {watchlist.length > 0 && (
          <CommandGroup heading="My watchlist">
            {watchlist.map((s) => (
              <CommandItem key={`w-${s}`} value={s} onSelect={() => pick(s)}>
                <Star className="mr-2 h-4 w-4" />
                <span className="font-mono">{s}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {recentOnly.length > 0 && (
          <CommandGroup heading="Recent">
            {recentOnly.map((s) => (
              <CommandItem key={`r-${s}`} value={s} onSelect={() => pick(s)}>
                <Clock className="mr-2 h-4 w-4" />
                <span className="font-mono">{s}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default TickerSearch;
