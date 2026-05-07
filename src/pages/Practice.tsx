import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Check,
  X,
  Zap,
  Target,
  Trophy,
  Play,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────── */
type Side = "BUY" | "SELL";
type Exchange = "ARCA" | "NSDQ" | "EDGX";

interface ActiveBox {
  id: number;
  side: Side;
  exchange: Exchange;
  price: number;
  qty: number;
  hidden: boolean;
}

interface SentOrder extends ActiveBox {
  sentAt: number;
}

interface Challenge {
  id: number;
  side: Side;
  exchange: Exchange;
  price: number;
  qty: number;
  hidden: boolean;
}

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */
const EXCHANGES: Exchange[] = ["ARCA", "NSDQ", "EDGX"];
const exchangeColor: Record<Exchange, string> = {
  ARCA: "hsl(220 90% 55%)",
  NSDQ: "hsl(265 85% 60%)",
  EDGX: "hsl(155 80% 45%)",
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtPrice = (n: number) => n.toFixed(2);

const randPrice = () => round2(50 + Math.random() * 200);
const randQty = () => [100, 200, 300, 400, 500, 600, 700, 800, 1000, 1200, 1500, 2000, 2500, 3000, 5000][Math.floor(Math.random() * 15)];

function makeChallenge(id: number, stockPrice: number): Challenge {
  // Target price is within ±3.00 of the current stock price, on a 0.01 grid
  const offsetTicks = Math.floor((Math.random() - 0.5) * 600); // -300..+300 cents
  const target = round2(stockPrice + offsetTicks / 100);
  return {
    id,
    side: Math.random() > 0.5 ? "BUY" : "SELL",
    exchange: EXCHANGES[Math.floor(Math.random() * 3)],
    price: target,
    qty: randQty(),
    hidden: Math.random() > 0.7,
  };
}

/* ──────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────── */
const Practice = () => {
  const [active, setActive] = useState<ActiveBox | null>(null);
  const [sent, setSent] = useState<SentOrder[]>([]);
  const [qtyBuffer, setQtyBuffer] = useState<string>("");
  const [priceBuffer, setPriceBuffer] = useState<string>("");
  const [stockPrice, setStockPrice] = useState<number>(() => round2(150 + Math.random() * 150));
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [missed, setMissed] = useState(0);
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [lastKey, setLastKey] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "good" | "bad"; msg: string; t: number } | null>(null);

  // Multi-tap tracking for Shift+A/L sequences (no time limit; resets when box closes)
  const tapRef = useRef<{ key: "A" | "L" | null; count: number }>({
    key: null,
    count: 0,
  });
  const activeRef = useRef<ActiveBox | null>(null);
  useEffect(() => {
    activeRef.current = active;
    if (!active) tapRef.current = { key: null, count: 0 };
  }, [active]);

  /* ────────── Game timer ────────── */
  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) {
      setRunning(false);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, timeLeft]);

  /* ────────── Challenge spawner ────────── */
  useEffect(() => {
    if (!running) return;
    if (!challenge) {
      setChallenge(makeChallenge(Date.now(), stockPrice));
    }
  }, [running, challenge, stockPrice]);

  const flash = useCallback((type: "good" | "bad", msg: string) => {
    setFeedback({ type, msg, t: Date.now() });
    window.setTimeout(() => setFeedback(null), 600);
  }, []);

  const startGame = () => {
    const newStock = round2(150 + Math.random() * 150);
    setStockPrice(newStock);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCompleted(0);
    setMissed(0);
    setTimeLeft(60);
    setActive(null);
    setSent([]);
    setQtyBuffer(""); setPriceBuffer("");
    setChallenge(makeChallenge(Date.now(), newStock));
    setRunning(true);
  };

  /* ────────── Order box helpers ────────── */
  const openBox = useCallback(
    (side: Side, exchange: Exchange) => {
      // Box opens at the current stock price — trader uses arrows to reach target
      setActive({
        id: Date.now(),
        side,
        exchange,
        price: stockPrice,
        qty: 1,
        hidden: true,
      });
      setQtyBuffer(""); setPriceBuffer("");
    },
    [stockPrice, challenge]
  );

  const adjustPrice = (delta: number) => {
    setActive((box) => (box ? { ...box, price: round2(box.price + delta) } : box));
  };

  const sendOrder = useCallback(() => {
    if (!active) return;
    const order: SentOrder = { ...active, sentAt: Date.now() };

    // Score against challenge
    if (challenge) {
      const matches =
        challenge.side === order.side &&
        challenge.exchange === order.exchange &&
        Math.abs(challenge.price - order.price) < 0.005 &&
        challenge.qty === order.qty &&
        challenge.hidden === order.hidden;

      if (matches) {
        const points = 100 + combo * 10;
        setScore((s) => s + points);
        setCombo((c) => {
          const nc = c + 1;
          setBestCombo((b) => Math.max(b, nc));
          return nc;
        });
        setCompleted((n) => n + 1);
        flash("good", `+${points}  COMBO ×${combo + 1}`);
        setStockPrice(challenge.price);
        setChallenge(makeChallenge(Date.now(), challenge.price));
      } else {
        setCombo(0);
        setMissed((n) => n + 1);
        flash("bad", "MISS");
      }
    }

    setSent((arr) => [order, ...arr].slice(0, 8));
    setActive(null);
    setQtyBuffer(""); setPriceBuffer("");
  }, [active, challenge, combo, flash, stockPrice]);

  const handleMultiTap = useCallback(
    (key: "A" | "L") => {
      const ref = tapRef.current;
      // Continuation = same key while a box is still active (no time limit)
      const isContinuation = ref.key === key && activeRef.current !== null;

      if (isContinuation) {
        ref.count = Math.min(ref.count + 1, 3);
      } else {
        ref.key = key;
        ref.count = 1;
      }

      const side: Side = key === "A" ? "BUY" : "SELL";
      const exchange: Exchange = ref.count === 1 ? "ARCA" : ref.count === 2 ? "NSDQ" : "EDGX";

      if (isContinuation) {
        // Swap exchange only, keep price/qty/hidden intact
        setActive((box) => (box ? { ...box, side, exchange } : box));
      } else {
        // Fresh box with new price
        openBox(side, exchange);
      }
    },
    [openBox]
  );

  /* ────────── Keyboard handler ────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Avoid hijacking when user is typing in inputs (none on this page, but safe)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const k = e.key;

      // ── Shift + A / L (multi-tap)
      if (e.shiftKey && (k === "A" || k === "a")) {
        e.preventDefault();
        setLastKey("Shift + A");
        handleMultiTap("A");
        return;
      }
      if (e.shiftKey && (k === "L" || k === "l")) {
        e.preventDefault();
        setLastKey("Shift + L");
        handleMultiTap("L");
        return;
      }

      // ── Price arrows
      if (k === "ArrowLeft" || k === "ArrowRight") {
        if (!active) return;
        e.preventDefault();
        const dir = k === "ArrowRight" ? 1 : -1;
        let delta = 0.01;
        let label = "±0.01";
        if (e.altKey) { delta = 5; label = "±5.00"; }
        else if (e.ctrlKey || e.metaKey) { delta = 0.5; label = "±0.50"; }
        else if (e.shiftKey) { delta = 0.05; label = "±0.05"; }
        adjustPrice(dir * delta);
        const mod = e.altKey ? "Alt" : e.ctrlKey || e.metaKey ? "Ctrl" : e.shiftKey ? "Shift" : "";
        setLastKey(`${mod ? mod + " + " : ""}${k === "ArrowRight" ? "→" : "←"}  (${label})`);
        return;
      }

      // ── Space hides box (closes without sending)
      if (k === " " || e.code === "Space") {
        if (!active) return;
        e.preventDefault();
        setLastKey("Space");
        setActive(null);
        setQtyBuffer(""); setPriceBuffer("");
        flash("bad", "HIDDEN");
        return;
      }

      // ── Enter: first confirms qty buffer, second sends order
      if (k === "Enter") {
        if (!active) return;
        e.preventDefault();
        if (qtyBuffer) {
          setLastKey("Enter (qty confirmed)");
          setQtyBuffer(""); setPriceBuffer("");
          flash("good", `QTY ${active.qty}`);
        } else {
          setLastKey("Enter (send)");
          sendOrder();
        }
        return;
      }

      // ── Backslash cancels single (most recent sent)
      if (k === "\\") {
        e.preventDefault();
        setLastKey("\\");
        setSent((arr) => arr.slice(1));
        return;
      }

      // ── Backtick cancels all
      if (k === "`") {
        e.preventDefault();
        setLastKey("`");
        setSent([]);
        return;
      }

      // ── H toggles hidden
      if (k === "h" || k === "H") {
        if (!active) return;
        e.preventDefault();
        setLastKey("H");
        setActive((b) => (b ? { ...b, hidden: !b.hidden } : b));
        return;
      }

      // ── Numpad digits → QUANTITY only
      if (/^Numpad[0-9]$/.test(e.code)) {
        if (!active) return;
        e.preventDefault();
        setLastKey(`Qty ${k}`);
        setQtyBuffer((buf) => {
          const next = (buf + k).slice(0, 6);
          const n = parseInt(next, 10) || 0;
          setActive((box) => (box ? { ...box, qty: n } : box));
          return next;
        });
        return;
      }

      // ── Top-row digits (and ".") → PRICE only
      if (/^Digit[0-9]$/.test(e.code) || k === ".") {
        if (!active) return;
        e.preventDefault();
        setLastKey(`Price ${k}`);
        setPriceBuffer((buf) => {
          // Only one decimal point; max 2 decimals; max 6 chars before dot
          let next = buf + k;
          if (k === ".") {
            if (buf.includes(".")) return buf;
            if (buf.length === 0) next = "0.";
          } else {
            const [intPart, decPart] = next.split(".");
            if (decPart !== undefined && decPart.length > 2) return buf;
            if (decPart === undefined && intPart.length > 6) return buf;
          }
          const n = parseFloat(next);
          if (!Number.isNaN(n)) {
            setActive((box) => (box ? { ...box, price: n } : box));
          }
          return next;
        });
        return;
      }

      // ── Backspace clears price buffer digit
      if (k === "Backspace") {
        if (!active) return;
        e.preventDefault();
        setPriceBuffer((buf) => {
          const next = buf.slice(0, -1);
          const n = parseFloat(next);
          if (!Number.isNaN(n)) {
            setActive((box) => (box ? { ...box, price: n } : box));
          }
          return next;
        });
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, qtyBuffer, handleMultiTap, sendOrder, flash]);

  /* ────────── Derived ────────── */
  const accuracy = useMemo(() => {
    const total = completed + missed;
    return total === 0 ? 0 : Math.round((completed / total) * 100);
  }, [completed, missed]);

  /* ────────── Render ────────── */
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/40 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-accent grid place-items-center shrink-0">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold leading-tight truncate">Hotkey Trainer</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Master your trading shortcuts</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <Stat icon={<Trophy className="h-4 w-4" />} label="Score" value={score.toString()} />
            <Stat icon={<Zap className="h-4 w-4" />} label="Combo" value={`×${combo}`} highlight={combo > 2} />
            <Stat icon={<Target className="h-4 w-4" />} label="Acc" value={`${accuracy}%`} />
            <Stat icon={<RefreshCw className="h-4 w-4" />} label="Time" value={`${timeLeft}s`} />
            {!running ? (
              <Button size="sm" onClick={startGame} className="gap-2">
                <Play className="h-4 w-4" />
                {timeLeft === 0 ? "Play Again" : "Start"}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setRunning(false)}>
                Pause
              </Button>
            )}
          </div>
        </div>
        {running && <Progress value={(timeLeft / 60) * 100} className="h-1 rounded-none" />}
        <div className="md:hidden px-4 py-2 text-[11px] text-muted-foreground bg-muted/40 border-t border-border/60">
          Best experienced on a desktop with a physical keyboard.
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 grid lg:grid-cols-[1fr_320px] gap-6 sm:gap-8">
        {/* LEFT — trading sim */}
        <section className="space-y-6">
          {/* Challenge prompt */}
          <Card className="p-6 relative overflow-hidden border-2">
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            <div className="relative flex items-center justify-between gap-6 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  {running ? `Stock @ $${fmtPrice(stockPrice)} — Hit the target` : timeLeft === 0 ? "Time's Up" : "Press Start"}
                </p>
                {challenge && running ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={cn(
                        "px-3 py-1 rounded-md text-sm font-bold tracking-wider",
                        challenge.side === "BUY"
                          ? "bg-green-500/15 text-green-600 dark:text-green-400"
                          : "bg-red-500/15 text-red-600 dark:text-red-400"
                      )}
                    >
                      {challenge.side}
                    </span>
                    <Badge
                      variant="outline"
                      className="font-mono text-sm"
                      style={{ borderColor: exchangeColor[challenge.exchange], color: exchangeColor[challenge.exchange] }}
                    >
                      {challenge.exchange}
                    </Badge>
                    <span className="text-2xl font-mono font-bold tabular-nums">
                      ${fmtPrice(challenge.price)}
                    </span>
                    <span className="text-muted-foreground font-mono">×</span>
                    <span className="text-2xl font-mono font-bold tabular-nums">{challenge.qty}</span>
                    {challenge.hidden ? (
                      <Badge className="gap-1 bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40">
                        <EyeOff className="h-3 w-3" /> HIDDEN
                      </Badge>
                    ) : (
                      <Badge className="gap-1 bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/40">
                        <Eye className="h-3 w-3" /> OPEN — press H
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-2xl font-semibold">
                    {timeLeft === 0
                      ? `Final Score: ${score} · Best Combo ×${bestCombo}`
                      : "60 seconds. As many orders as you can."}
                  </p>
                )}
              </div>

              {feedback && (
                <div
                  key={feedback.t}
                  className={cn(
                    "px-4 py-2 rounded-md font-bold text-lg animate-scale-in",
                    feedback.type === "good"
                      ? "bg-green-500/20 text-green-600 dark:text-green-400"
                      : "bg-red-500/20 text-red-600 dark:text-red-400"
                  )}
                >
                  {feedback.msg}
                </div>
              )}
            </div>
          </Card>

          {/* Active order box */}
          <div className="min-h-[260px]">
            {active ? (
              <OrderBox box={active} qtyBuffer={qtyBuffer} />
            ) : (
              <Card className="p-12 grid place-items-center text-center border-dashed">
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-widest text-muted-foreground">No active order</p>
                  <p className="text-lg">
                    Press <Kbd>Shift</Kbd>+<Kbd>A</Kbd> to bid · <Kbd>Shift</Kbd>+<Kbd>L</Kbd> to offer
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tap twice for NSDQ, three times for EDGX
                  </p>
                </div>
              </Card>
            )}
          </div>

          {/* Level 2 + Time & Sales */}
          <div className="grid md:grid-cols-2 gap-4">
            <Level2Book centerPrice={active?.price ?? challenge?.price ?? 150} />
            <TimeSales centerPrice={active?.price ?? challenge?.price ?? 150} />
          </div>

          {/* Sent orders log */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Order Book ({sent.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                <Kbd>\</Kbd> cancel last · <Kbd>`</Kbd> cancel all
              </p>
            </div>
            {sent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No orders sent yet.</p>
            ) : (
              <div className="space-y-1.5">
                {sent.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/40 font-mono text-sm animate-fade-in"
                  >
                    <span
                      className={cn(
                        "w-12 text-center font-bold",
                        o.side === "BUY" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {o.side}
                    </span>
                    <span className="w-14 font-semibold" style={{ color: exchangeColor[o.exchange] }}>
                      {o.exchange}
                    </span>
                    <span className="tabular-nums">${fmtPrice(o.price)}</span>
                    <span className="text-muted-foreground">×</span>
                    <span className="tabular-nums">{o.qty}</span>
                    {o.hidden && <EyeOff className="h-3 w-3 text-muted-foreground ml-1" />}
                    <Check className="h-4 w-4 text-green-500 ml-auto" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* RIGHT — cheatsheet + last key */}
        <aside className="space-y-6">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Last Key</p>
            <div
              key={lastKey}
              className="text-2xl font-mono font-bold animate-scale-in min-h-[2rem]"
            >
              {lastKey || "—"}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
              Hotkey Reference
            </h3>
            <div className="space-y-4 text-sm">
              <Group title="Open Bid (Buy)">
                <Row keys={["Shift", "A"]} desc="ARCA" color="hsl(220 90% 55%)" />
                <Row keys={["Shift", "A", "A"]} desc="NSDQ" color="hsl(265 85% 60%)" />
                <Row keys={["Shift", "A", "A", "A"]} desc="EDGX" color="hsl(155 80% 45%)" />
              </Group>
              <Group title="Open Offer (Sell)">
                <Row keys={["Shift", "L"]} desc="ARCA" color="hsl(220 90% 55%)" />
                <Row keys={["Shift", "L", "L"]} desc="NSDQ" color="hsl(265 85% 60%)" />
                <Row keys={["Shift", "L", "L", "L"]} desc="EDGX" color="hsl(155 80% 45%)" />
              </Group>
              <Group title="Price">
                <Row keys={["Shift", "←/→"]} desc="±0.05" />
                <Row keys={["Ctrl", "←/→"]} desc="±0.50" />
                <Row keys={["Alt", "←/→"]} desc="±5.00" />
              </Group>
              <Group title="Order">
                <Row keys={["Top 0–9 / ."]} desc="Type price" />
                <Row keys={["Numpad 0–9"]} desc="Set quantity" />
                <Row keys={["H"]} desc="Toggle hidden" />
                <Row keys={["Enter"]} desc="Send" />
                <Row keys={["Space"]} desc="Hide box" />
                <Row keys={["\\"]} desc="Cancel last" />
                <Row keys={["`"]} desc="Cancel all" />
              </Group>
            </div>
          </Card>
        </aside>
      </main>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────
   Subcomponents
   ────────────────────────────────────────────────────────── */
const Stat = ({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div
    className={cn(
      "px-3 py-1.5 rounded-md border bg-card flex items-center gap-2 transition-all",
      highlight && "border-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.15)]"
    )}
  >
    <span className="text-muted-foreground">{icon}</span>
    <div className="leading-tight">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono font-bold text-sm tabular-nums">{value}</div>
    </div>
  </div>
);

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded border border-border bg-muted font-mono text-xs font-semibold">
    {children}
  </kbd>
);

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{title}</p>
    <div className="space-y-1">{children}</div>
  </div>
);

const Row = ({ keys, desc, color }: { keys: string[]; desc: string; color?: string }) => (
  <div className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-1">
      {keys.map((k, i) => (
        <span key={i} className="contents">
          <Kbd>{k}</Kbd>
          {i < keys.length - 1 && <span className="text-muted-foreground text-xs">+</span>}
        </span>
      ))}
    </div>
    <span className="text-xs font-medium" style={{ color: color ?? undefined }}>
      {desc}
    </span>
  </div>
);

const OrderBox = ({ box, qtyBuffer }: { box: ActiveBox; qtyBuffer: string }) => {
  const isBuy = box.side === "BUY";
  const accent = exchangeColor[box.exchange];
  return (
    <Card
      className="p-6 border-2 animate-scale-in relative overflow-hidden"
      style={{
        borderColor: accent,
        boxShadow: `0 20px 60px -20px ${accent}55, 0 0 0 1px ${accent}33`,
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ background: `radial-gradient(circle at 80% 0%, ${accent}, transparent 60%)` }}
      />
      <div className="relative flex items-start justify-between gap-6 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "px-3 py-1 rounded-md text-xs font-bold tracking-widest",
                isBuy
                  ? "bg-green-500/20 text-green-700 dark:text-green-400"
                  : "bg-red-500/20 text-red-700 dark:text-red-400"
              )}
            >
              {isBuy ? <ArrowDown className="h-3 w-3 inline mr-1" /> : <ArrowUp className="h-3 w-3 inline mr-1" />}
              {box.side}
            </span>
            <span
              className="px-2 py-1 rounded-md text-xs font-bold tracking-widest font-mono"
              style={{ background: `${accent}22`, color: accent }}
            >
              {box.exchange}
            </span>
            {box.hidden ? (
              <Badge variant="secondary" className="gap-1">
                <EyeOff className="h-3 w-3" /> HIDDEN
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Eye className="h-3 w-3" /> VISIBLE
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Order #{box.id.toString().slice(-4)}</p>
        </div>

        <div className="flex items-end gap-8">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Price</p>
            <p className="text-5xl font-mono font-bold tabular-nums">
              ${fmtPrice(box.price)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Quantity</p>
            <p className="text-5xl font-mono font-bold tabular-nums">
              {box.qty.toLocaleString()}
              {qtyBuffer && <span className="text-accent animate-pulse">|</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="relative mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <Kbd>Enter</Kbd> send · <Kbd>Space</Kbd> hide · <Kbd>H</Kbd> hidden
        </span>
        <span>
          <Kbd>Shift</Kbd>/<Kbd>Ctrl</Kbd>/<Kbd>Alt</Kbd> + <Kbd>←/→</Kbd> price
        </span>
      </div>
    </Card>
  );
};

/* ──────────────────────────────────────────────────────────
   Level 2 Book — Bid/Offer ladder, Dragon-Trader style
   ────────────────────────────────────────────────────────── */
const MM_IDS = ["XMAS", "ARCA", "MEMX", "NSDQ", "NYSE", "EDGA", "EDGX", "BATS", "NQPX", "IEX"];
const mmColor = (id: string) => {
  switch (id) {
    case "ARCA": return "hsl(220 90% 60%)";
    case "NSDQ": return "hsl(265 85% 65%)";
    case "EDGX":
    case "EDGA": return "hsl(155 80% 50%)";
    case "NYSE": return "hsl(30 95% 60%)";
    case "BATS": return "hsl(50 95% 55%)";
    case "MEMX": return "hsl(190 85% 55%)";
    case "IEX":  return "hsl(0 85% 65%)";
    default:     return "hsl(280 80% 65%)";
  }
};
interface L2Row { mm: string; size: number; price: number; }
function buildSide(center: number, side: "bid" | "ask", rows: number): L2Row[] {
  const out: L2Row[] = [];
  let p = side === "bid" ? center - 0.01 : center + 0.01;
  for (let i = 0; i < rows; i++) {
    const step = (Math.random() < 0.4 ? 0 : 0.01) + Math.random() * 0.04;
    p = side === "bid" ? p - step * (i === 0 ? 0 : 1) : p + step * (i === 0 ? 0 : 1);
    out.push({
      mm: MM_IDS[Math.floor(Math.random() * MM_IDS.length)],
      size: [1, 2, 3, 5, 10, 13, 17, 24, 100, 121, 200, 300, 410, 604][Math.floor(Math.random() * 14)],
      price: round2(p),
    });
  }
  return out;
}
const Level2Book = ({ centerPrice }: { centerPrice: number }) => {
  const [bids, setBids] = useState<L2Row[]>(() => buildSide(centerPrice, "bid", 18));
  const [asks, setAsks] = useState<L2Row[]>(() => buildSide(centerPrice, "ask", 18));
  const centerRef = useRef(centerPrice);
  useEffect(() => { centerRef.current = centerPrice; }, [centerPrice]);
  useEffect(() => {
    const t = setInterval(() => {
      const c = centerRef.current;
      // mutate a few rows for live feel
      setBids((rows) => {
        const next = [...rows];
        const idx = Math.floor(Math.random() * next.length);
        next[idx] = {
          mm: MM_IDS[Math.floor(Math.random() * MM_IDS.length)],
          size: Math.max(1, Math.floor(Math.random() * 600)),
          price: round2(c - 0.01 - Math.random() * 0.5),
        };
        return [...next].sort((a, b) => b.price - a.price);
      });
      setAsks((rows) => {
        const next = [...rows];
        const idx = Math.floor(Math.random() * next.length);
        next[idx] = {
          mm: MM_IDS[Math.floor(Math.random() * MM_IDS.length)],
          size: Math.max(1, Math.floor(Math.random() * 600)),
          price: round2(c + 0.01 + Math.random() * 0.5),
        };
        return [...next].sort((a, b) => a.price - b.price);
      });
    }, 450);
    return () => clearInterval(t);
  }, []);

  return (
    <Card className="p-0 overflow-hidden border-2">
      <div className="px-3 py-2 border-b bg-muted/40 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider">Level 2</span>
        <span className="font-mono text-xs text-muted-foreground">PRACTICE · NYSE</span>
      </div>
      <div className="grid grid-cols-2 text-[11px] font-mono bg-background">
        <div>
          <div className="grid grid-cols-3 px-2 py-1 text-muted-foreground border-b border-border/60">
            <span>MM ID</span><span className="text-right">Size</span><span className="text-right">Bid</span>
          </div>
          {bids.map((r, i) => (
            <div key={i} className="grid grid-cols-3 px-2 py-[3px] hover:bg-muted/30 transition-colors">
              <span className="font-bold" style={{ color: mmColor(r.mm) }}>{r.mm}</span>
              <span className="text-right tabular-nums">{r.size}</span>
              <span className="text-right tabular-nums text-green-500">{r.price.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-l border-border/60">
          <div className="grid grid-cols-3 px-2 py-1 text-muted-foreground border-b border-border/60">
            <span>MM ID</span><span className="text-right">Size</span><span className="text-right">Ask</span>
          </div>
          {asks.map((r, i) => (
            <div key={i} className="grid grid-cols-3 px-2 py-[3px] hover:bg-muted/30 transition-colors">
              <span className="font-bold" style={{ color: mmColor(r.mm) }}>{r.mm}</span>
              <span className="text-right tabular-nums">{r.size}</span>
              <span className="text-right tabular-nums text-red-500">{r.price.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

/* ──────────────────────────────────────────────────────────
   Time & Sales — streaming print tape
   ────────────────────────────────────────────────────────── */
interface Print { id: number; time: string; price: number; size: number; side: "buy" | "sell" | "mid"; ex: string; }
const TimeSales = ({ centerPrice }: { centerPrice: number }) => {
  const [prints, setPrints] = useState<Print[]>([]);
  const centerRef = useRef(centerPrice);
  useEffect(() => { centerRef.current = centerPrice; }, [centerPrice]);
  useEffect(() => {
    const tick = () => {
      const c = centerRef.current;
      const r = Math.random();
      const side: Print["side"] = r < 0.45 ? "buy" : r < 0.9 ? "sell" : "mid";
      const drift = (Math.random() - 0.5) * 0.08;
      const price = round2(c + drift + (side === "buy" ? 0.01 : side === "sell" ? -0.01 : 0));
      const sizes = [100, 100, 200, 100, 50, 300, 1, 17, 500, 1000, 25, 75];
      const exs = ["NSDQ", "ARCA", "EDGX", "NYSE", "BATS", "EDGA", "MEMX", "IEX"];
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
      setPrints((arr) => [
        { id: Date.now() + Math.random(), time, price, size: sizes[Math.floor(Math.random()*sizes.length)], side, ex: exs[Math.floor(Math.random()*exs.length)] },
        ...arr,
      ].slice(0, 60));
    };
    tick();
    const i = setInterval(tick, 280 + Math.random() * 200);
    return () => clearInterval(i);
  }, []);

  return (
    <Card className="p-0 overflow-hidden border-2">
      <div className="px-3 py-2 border-b bg-muted/40 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider">Time &amp; Sales</span>
        <span className="font-mono text-xs text-muted-foreground">LIVE TAPE</span>
      </div>
      <div className="text-[11px] font-mono bg-background max-h-[480px] overflow-y-auto">
        <div className="grid grid-cols-[64px_1fr_60px_60px] px-2 py-1 text-muted-foreground border-b border-border/60 sticky top-0 bg-background">
          <span>Time</span><span>Price</span><span className="text-right">Size</span><span className="text-right">Ex</span>
        </div>
        {prints.map((p) => {
          const color = p.side === "buy" ? "text-green-500" : p.side === "sell" ? "text-red-500" : "text-yellow-500";
          const bg = p.side === "buy" ? "bg-green-500/[0.04]" : p.side === "sell" ? "bg-red-500/[0.04]" : "bg-yellow-500/[0.04]";
          return (
            <div key={p.id} className={cn("grid grid-cols-[64px_1fr_60px_60px] px-2 py-[3px] animate-fade-in", bg)}>
              <span className="text-muted-foreground tabular-nums">{p.time}</span>
              <span className={cn("tabular-nums font-bold", color)}>{p.price.toFixed(2)}</span>
              <span className="text-right tabular-nums">{p.size}</span>
              <span className="text-right" style={{ color: mmColor(p.ex) }}>{p.ex}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default Practice;
