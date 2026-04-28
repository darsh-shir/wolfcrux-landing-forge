import { formatIndian } from "@/lib/utils";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, TrendingDown, Loader2, ChevronDown, ChevronUp, ExternalLink, Sparkles, ArrowRight } from "lucide-react";

const PROXY_URL = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

/**
 * Curated peer pairs traders frequently watch together.
 * Grouped by sector/theme for easier scanning.
 */
const PEER_PAIRS: { theme: string; pairs: [string, string][] }[] = [
  {
    theme: "Banks — Canada",
    pairs: [
      ["RY", "BNS"], ["TD", "BNS"], ["RY", "TD"], ["BMO", "BNS"],
      ["RY", "BMO"], ["TD", "CM"], ["RY", "CM"], ["TD", "BMO"],
      ["BMO", "CM"], ["BNS", "CM"],
    ],
  },
  {
    theme: "Banks — US / Capital Markets",
    pairs: [
      ["PNC", "USB"], ["AMP", "RJF"], ["MCO", "SPGI"], ["MA", "V"],
    ],
  },
  {
    theme: "Insurance",
    pairs: [
      ["AJG", "MMC"], ["AON", "MMC"], ["AJG", "BRO"], ["MET", "PRU"],
      ["BRO", "MMC"], ["AJG", "AON"], ["AON", "BRO"], ["HIG", "L"],
      ["CB", "WRB"], ["WRB", "L"], ["L", "AIZ"], ["L", "ORI"],
      ["TRV", "WRB"], ["L", "AFG"], ["GL", "AFL"], ["HIG", "WRB"],
      ["CB", "TRV"], ["WRB", "THG"], ["CB", "L"], ["CB", "HIG"],
      ["L", "CNA"], ["FNF", "FAF"],
    ],
  },
  {
    theme: "Industrials & Machinery",
    pairs: [
      ["ITW", "DOV"], ["GGG", "DCI"], ["GGG", "IEX"], ["DOV", "IEX"],
      ["AME", "DOV"], ["ITW", "IEX"], ["ITW", "GGG"], ["AME", "IEX"],
      ["ITW", "AME"], ["DOV", "GGG"], ["DOV", "DCI"], ["AME", "DCI"],
      ["AME", "GGG"], ["ITW", "DCI"], ["XYL", "DOV"], ["XYL", "GGG"],
      ["DOV", "PNR"], ["XYL", "IEX"], ["OTIS", "IEX"], ["ITW", "OTIS"],
      ["OTIS", "GGG"], ["OTIS", "DOV"], ["IEX", "DCI"], ["PH", "IR"],
    ],
  },
  {
    theme: "Consumer Staples",
    pairs: [
      ["CL", "KMB"], ["CPB", "GIS"], ["K", "CPB"], ["CL", "PG"],
      ["CL", "CHD"], ["SJM", "GIS"], ["K", "GIS"], ["K", "SJM"],
      ["KMB", "CHD"], ["KMB", "PG"], ["SJM", "CPB"], ["MKC", "GIS"],
      ["K", "MKC"], ["CHD", "PG"], ["CHD", "CLX"], ["MO", "PM"],
    ],
  },
  {
    theme: "Healthcare",
    pairs: [
      ["COR", "MCK"], ["BSX", "SYK"], ["SYK", "ZBH"], ["COR", "CAH"],
      ["CAH", "MCK"], ["LH", "DGX"], ["UHS", "HCA"],
    ],
  },
  {
    theme: "Energy & Pipelines",
    pairs: [
      ["TRP", "ENB"], ["CVX", "XOM"],
    ],
  },
  {
    theme: "Defense & Aerospace",
    pairs: [
      ["LMT", "NOC"], ["GD", "LHX"], ["GD", "HII"], ["LMT", "LHX"],
    ],
  },
  {
    theme: "Homebuilders & Materials",
    pairs: [
      ["LEN", "DHI"], ["LEN", "PHM"], ["VMC", "MLM"],
    ],
  },
  {
    theme: "Waste & Transportation",
    pairs: [
      ["RSG", "WM"], ["RSG", "WCN"], ["WCN", "WM"], ["NSC", "UNP"],
      ["CP", "CNI"],
    ],
  },
  {
    theme: "Retail / Other",
    pairs: [
      ["LOW", "HD"], ["YUM", "MCD"], ["ADP", "PAYX"],
    ],
  },
];

interface PeerData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  marketCap: number;
  currency: string;
  exchange: string;
  image?: string;
  imageDark?: string;
}

interface ProfileData {
  symbol: string;
  companyName: string;
  ceo: string;
  sector: string;
  industry: string;
  country: string;
  fullTimeEmployees: string;
  exchange: string;
  exchangeShortName: string;
  ipoDate: string;
  description: string;
  image?: string;
  website?: string;
  mktCap?: number;
}

interface QuoteData {
  symbol: string;
  price: number;
  change: number;
  changesPercentage: number;
  dayLow: number;
  dayHigh: number;
  yearLow: number;
  yearHigh: number;
  open: number;
  previousClose: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  pe: number;
  eps: number;
  priceAvg50: number;
  priceAvg200: number;
  afterHoursPrice?: number;
  afterHoursChange?: number;
  afterHoursPercentChange?: number;
  isMarketOpen?: boolean;
}

const formatMarketCap = (cap: number): string => {
  if (!cap) return "—";
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  if (cap >= 1e3) return `$${(cap / 1e3).toFixed(2)}K`;
  return `$${cap.toFixed(0)}`;
};

const formatEmployees = (val: string): string => {
  const num = parseInt(val, 10);
  if (isNaN(num)) return val;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const Peers = () => {
  const [symbol, setSymbol] = useState("");
  const [peers, setPeers] = useState<PeerData[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const fetchData = async (searchSymbol?: string) => {
    const trimmed = (searchSymbol || symbol).trim().toUpperCase();
    if (!trimmed) return;

    if (searchSymbol) setSymbol(trimmed);
    setLoading(true);
    setSearched(true);
    setProfile(null);
    setQuote(null);
    setDescExpanded(false);

    try {
      const [peersRes, profileRes, quoteRes] = await Promise.all([
        fetch(`${PROXY_URL}${encodeURIComponent(`https://www.perplexity.ai/rest/finance/peers/${trimmed}?version=2.18&source=default`)}`),
        fetch(`${PROXY_URL}${encodeURIComponent(`https://www.perplexity.ai/rest/finance/profile/${trimmed}`)}`),
        fetch(`${PROXY_URL}${encodeURIComponent(`https://www.perplexity.ai/rest/finance/quote/${trimmed}`)}`),
      ]);

      const peersData = await peersRes.json();
      const items: PeerData[] = Array.isArray(peersData) ? peersData : [];
      items.sort((a, b) => b.marketCap - a.marketCap);
      setPeers(items);

      const profileData = await profileRes.json();
      if (profileData && profileData.symbol) {
        setProfile(profileData);
      }

      const quoteData = await quoteRes.json();
      if (quoteData && quoteData.symbol) {
        setQuote(quoteData);
      }
    } catch (e) {
      console.error("Fetch failed", e);
      setPeers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchData();
  };

  const profileRows = profile
    ? [
        { label: "Symbol", value: profile.symbol },
        { label: "IPO Date", value: formatDate(profile.ipoDate) },
        { label: "CEO", value: profile.ceo },
        { label: "Fulltime Employees", value: formatEmployees(profile.fullTimeEmployees) },
        { label: "Sector", value: profile.sector },
        { label: "Industry", value: profile.industry },
        { label: "Country", value: profile.country === "US" ? "United States" : profile.country },
        { label: "Exchange", value: profile.exchange || profile.exchangeShortName },
        ...(profile.mktCap ? [{ label: "Market Cap", value: formatMarketCap(profile.mktCap) }] : []),
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Search Bar */}
      <Card className="bg-card border border-border/50 shadow-sm">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
              <Search className="w-3.5 h-3.5" /> // Symbol Lookup
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Query symbol (e.g. AAPL, TSLA, JPM)"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                className="pl-10 font-mono text-sm uppercase h-10"
              />
            </div>
            <Button onClick={() => fetchData()} disabled={loading || !symbol.trim()} className="h-10 font-mono text-xs uppercase tracking-wider">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Find
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recommended peer pairs — shown when nothing has been searched yet */}
      {!loading && !searched && (
        <Card className="bg-card border border-border/50 shadow-sm animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              // Recommended Peer Pairs
            </CardTitle>
            <p className="text-[11px] font-mono text-muted-foreground mt-1">
              Click a ticker to load its profile, quote, and full peer list.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {PEER_PAIRS.map((group, gIdx) => (
              <div key={group.theme} className="animate-fade-in" style={{ animationDelay: `${gIdx * 40}ms` }}>
                <h4 className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground mb-2 pb-1 border-b border-border/50">
                  // {group.theme} <span className="text-foreground/60">[{group.pairs.length}]</span>
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {group.pairs.map(([a, b]) => (
                    <div
                      key={`${a}-${b}`}
                      className="group inline-flex items-center rounded-md border border-border/60 bg-muted/20 hover:bg-muted/50 hover:border-foreground/30 transition-colors overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => fetchData(a)}
                        className="px-2 py-1 font-mono text-xs font-semibold text-foreground hover:text-emerald-600 transition-colors"
                        title={`View ${a}`}
                      >
                        {a}
                      </button>
                      <ArrowRight className="w-3 h-3 text-muted-foreground/60 group-hover:text-foreground/80 transition-colors" />
                      <button
                        type="button"
                        onClick={() => fetchData(b)}
                        className="px-2 py-1 font-mono text-xs font-semibold text-foreground hover:text-emerald-600 transition-colors"
                        title={`View ${b}`}
                      >
                        {b}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-12 pl-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          // Querying terminal…
        </div>
      )}

      {/* Stock Quote + Profile */}
      {!loading && (profile || quote) && (
        <Card className="bg-card border border-border/50 shadow-sm relative overflow-hidden animate-fade-in">
          {quote && (
            <span
              className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                quote.changesPercentage >= 0 ? "bg-emerald-500/70" : "bg-red-500/70"
              }`}
            />
          )}
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              {profile?.image && (
                <img
                  src={profile.image}
                  alt={profile.symbol}
                  className="h-10 w-10 rounded-md object-contain bg-muted p-1 border border-border/50"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="font-mono">{profile?.symbol || quote?.symbol}</span>
                  <span className="text-sm text-muted-foreground font-normal truncate">
                    {profile?.companyName}
                  </span>
                  {profile?.website && (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </CardTitle>
              </div>
              {quote && (
                <div className="flex items-baseline gap-2 shrink-0">
                  <span className="text-2xl font-bold font-mono tabular-nums">${quote.price.toFixed(2)}</span>
                  <div className={`flex items-center gap-1 text-sm font-mono font-semibold tabular-nums ${quote.changesPercentage >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {quote.changesPercentage >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    <span>{quote.changesPercentage >= 0 ? "+" : ""}{quote.changesPercentage.toFixed(2)}%</span>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Quote Details Section */}
            {quote && (
              <div className="mb-4 pb-4 border-b border-border/50">
                {/* After hours */}
                {quote.afterHoursPrice != null && !quote.isMarketOpen && (
                  <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
                    // After Hours: <span className="font-medium text-foreground tabular-nums">${quote.afterHoursPrice.toFixed(2)}</span>
                    <span className={`ml-1 ${(quote.afterHoursPercentChange ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {(quote.afterHoursChange ?? 0) >= 0 ? "+" : ""}{(quote.afterHoursChange ?? 0).toFixed(2)} ({(quote.afterHoursPercentChange ?? 0) >= 0 ? "+" : ""}{(quote.afterHoursPercentChange ?? 0).toFixed(2)}%)
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {[
                    { label: "Open", value: `$${quote.open.toFixed(2)}` },
                    { label: "Prev Close", value: `$${quote.previousClose.toFixed(2)}` },
                    { label: "Day Range", value: `$${quote.dayLow.toFixed(2)} – $${quote.dayHigh.toFixed(2)}` },
                    { label: "52W Range", value: `$${quote.yearLow.toFixed(2)} – $${quote.yearHigh.toFixed(2)}` },
                    { label: "Volume", value: formatIndian(quote.volume) },
                    { label: "Avg Volume", value: formatIndian(quote.avgVolume) },
                    { label: "P/E", value: quote.pe?.toFixed(2) || "N/A" },
                    { label: "EPS", value: quote.eps ? `$${quote.eps.toFixed(2)}` : "N/A" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5">
                      <span className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">// {m.label}</span>
                      <span className="font-mono font-medium tabular-nums text-sm">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Profile Details */}
            {profile && (
              <>
                <div className="divide-y divide-border/50">
                  {profileRows.map((row) => (
                    <div key={row.label} className="flex justify-between py-2 text-sm">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{row.label}</span>
                      <span className="font-medium text-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>

                {profile.description && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className={`text-sm text-muted-foreground leading-relaxed ${!descExpanded ? "line-clamp-3" : ""}`}>
                      {profile.description}
                    </p>
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground mt-2"
                    >
                      {descExpanded ? "// Less" : "// More"}
                      {descExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* No results */}
      {!loading && searched && peers.length === 0 && !profile && (
        <div className="text-center py-12 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // No data for <span className="font-semibold text-foreground">{symbol}</span>
        </div>
      )}

      {/* Peers Grid */}
      {!loading && peers.length > 0 && (
        <>
          <h3 className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
            // Peers [{peers.length}]
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {peers.map((peer, idx) => {
              const isPositive = peer.changesPercentage >= 0;
              return (
                <Card
                  key={peer.symbol}
                  onClick={() => fetchData(peer.symbol)}
                  className="relative overflow-hidden border border-border/60 hover:border-foreground/30 hover:shadow-sm transition-all cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <span
                    className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                      isPositive ? "bg-emerald-500/70" : "bg-red-500/70"
                    }`}
                  />
                  <CardHeader className="pb-2 pt-3">
                    <div className="flex items-center gap-3">
                      {peer.image && (
                        <img
                          src={peer.image}
                          alt={peer.symbol}
                          className="h-9 w-9 rounded-md object-contain bg-muted p-1 border border-border/50"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          <span className="font-mono">{peer.symbol}</span>
                          <Badge variant="outline" className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0">
                            {peer.exchange}
                          </Badge>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {peer.name}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2 pb-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-bold font-mono tabular-nums">
                        ${peer.price.toFixed(2)}
                      </span>
                      <div
                        className={`flex items-center gap-1 text-sm font-mono font-semibold tabular-nums ${
                          isPositive ? "text-emerald-600" : "text-red-500"
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {isPositive ? "+" : ""}
                          {peer.change.toFixed(2)}
                        </span>
                        <span className="text-xs">
                          ({isPositive ? "+" : ""}
                          {peer.changesPercentage.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-border/50">
                      <span className="font-mono uppercase tracking-wider text-muted-foreground">// Mkt Cap</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {formatMarketCap(peer.marketCap)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default Peers;
