import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, TrendingDown, Loader2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

const PROXY_URL = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

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
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  return `$${cap.toLocaleString()}`;
};

const formatEmployees = (val: string): string => {
  const num = parseInt(val, 10);
  if (isNaN(num)) return val;
  if (num >= 1000) return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}K`;
  return val;
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
    <div className="space-y-6">
      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter stock symbol (e.g. SAIA, AAPL, TSLA)"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                className="pl-10 font-mono text-sm uppercase"
              />
            </div>
            <Button onClick={() => fetchData()} disabled={loading || !symbol.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Find Peers
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Stock Quote + Profile */}
      {!loading && (profile || quote) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              {profile?.image && (
                <img
                  src={profile.image}
                  alt={profile.symbol}
                  className="h-10 w-10 rounded-lg object-contain bg-muted p-1"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  {profile?.companyName || quote?.symbol}
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
                  <span className="text-2xl font-bold font-mono">${quote.price.toFixed(2)}</span>
                  <div className={`flex items-center gap-1 text-sm font-medium ${quote.changesPercentage >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {quote.changesPercentage >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    <span>{quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)}</span>
                    <span className="text-xs">({quote.changesPercentage >= 0 ? "+" : ""}{quote.changesPercentage.toFixed(2)}%)</span>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Quote Price Section */}
            {quote && (
              <div className="mb-4 pb-4 border-b border-border">
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-3xl font-bold font-mono">${quote.price.toFixed(2)}</span>
                  <div className={`flex items-center gap-1 text-base font-medium ${quote.changesPercentage >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {quote.changesPercentage >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span>{quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)}</span>
                    <span className="text-sm">({quote.changesPercentage >= 0 ? "+" : ""}{quote.changesPercentage.toFixed(2)}%)</span>
                  </div>
                </div>

                {/* After hours */}
                {quote.afterHoursPrice != null && !quote.isMarketOpen && (
                  <div className="text-xs text-muted-foreground mb-3">
                    After Hours: <span className="font-mono font-medium text-foreground">${quote.afterHoursPrice.toFixed(2)}</span>
                    <span className={`ml-1 ${(quote.afterHoursPercentChange ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {(quote.afterHoursChange ?? 0) >= 0 ? "+" : ""}{(quote.afterHoursChange ?? 0).toFixed(2)} ({(quote.afterHoursPercentChange ?? 0) >= 0 ? "+" : ""}{(quote.afterHoursPercentChange ?? 0).toFixed(2)}%)
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">Open</span>
                    <span className="font-medium font-mono">${quote.open.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Prev Close</span>
                    <span className="font-medium font-mono">${quote.previousClose.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Day Range</span>
                    <span className="font-medium font-mono">${quote.dayLow.toFixed(2)} - ${quote.dayHigh.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">52W Range</span>
                    <span className="font-medium font-mono">${quote.yearLow.toFixed(2)} - ${quote.yearHigh.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Volume</span>
                    <span className="font-medium font-mono">{quote.volume.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Avg Volume</span>
                    <span className="font-medium font-mono">{quote.avgVolume.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">P/E</span>
                    <span className="font-medium font-mono">{quote.pe?.toFixed(2) || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">EPS</span>
                    <span className="font-medium font-mono">${quote.eps?.toFixed(2) || "N/A"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Profile Details */}
            {profile && (
              <>
                <div className="divide-y divide-border">
                  {profileRows.map((row) => (
                    <div key={row.label} className="flex justify-between py-2.5 text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium text-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>

                {profile.description && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className={`text-sm text-muted-foreground ${!descExpanded ? "line-clamp-3" : ""}`}>
                      {profile.description}
                    </p>
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1"
                    >
                      {descExpanded ? "View Less" : "View More"}
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
        <div className="text-center py-12 text-muted-foreground">
          No data found for <span className="font-mono font-semibold">{symbol}</span>
        </div>
      )}

      {/* Peers Grid */}
      {!loading && peers.length > 0 && (
        <>
          <h3 className="text-lg font-semibold text-foreground">Peers</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {peers.map((peer) => {
              const isPositive = peer.changesPercentage >= 0;
              return (
                <Card key={peer.symbol} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => fetchData(peer.symbol)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      {peer.image && (
                        <img
                          src={peer.image}
                          alt={peer.symbol}
                          className="h-10 w-10 rounded-lg object-contain bg-muted p-1"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          <span className="font-mono">{peer.symbol}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {peer.exchange}
                          </Badge>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {peer.name}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-bold font-mono">
                        ${peer.price.toFixed(2)}
                      </span>
                      <div
                        className={`flex items-center gap-1 text-sm font-medium ${
                          isPositive ? "text-green-500" : "text-red-500"
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
                    <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                      <span>Market Cap</span>
                      <span className="font-medium text-foreground">
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
