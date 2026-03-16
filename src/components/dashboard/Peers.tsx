import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, TrendingDown, Loader2 } from "lucide-react";

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

const formatMarketCap = (cap: number): string => {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  return `$${cap.toLocaleString()}`;
};

const Peers = () => {
  const [symbol, setSymbol] = useState("");
  const [peers, setPeers] = useState<PeerData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchPeers = async () => {
    const trimmed = symbol.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setSearched(true);
    try {
      const url = encodeURIComponent(
        `https://www.perplexity.ai/rest/finance/peers/${trimmed}?version=2.18&source=default`
      );
      const response = await fetch(`${PROXY_URL}${url}`);
      const data = await response.json();
      setPeers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Peers fetch failed", e);
      setPeers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchPeers();
  };

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
            <Button onClick={fetchPeers} disabled={loading || !symbol.trim()}>
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

      {/* Results */}
      {!loading && searched && peers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No peers found for <span className="font-mono font-semibold">{symbol}</span>
        </div>
      )}

      {!loading && peers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {peers.map((peer) => {
            const isPositive = peer.changesPercentage >= 0;
            return (
              <Card
                key={peer.symbol}
                className="hover:shadow-md transition-shadow"
              >
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
                  {/* Price & Change */}
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

                  {/* Market Cap */}
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
      )}
    </div>
  );
};

export default Peers;
