import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mock data generator for demonstration
// In production, replace with actual API calls to Econoday, Alpha Vantage, Finnhub, etc.
function generateEconomicEvents() {
  const events = [
    { id: "1", title: "Non-Farm Payrolls", country: "US", date: "2025-01-10", time: "08:30", impact: "high", forecast: "175K", previous: "227K" },
    { id: "2", title: "Consumer Price Index (CPI) m/m", country: "US", date: "2025-01-15", time: "08:30", impact: "high", forecast: "0.3%", previous: "0.3%" },
    { id: "3", title: "FOMC Meeting Minutes", country: "US", date: "2025-01-08", time: "14:00", impact: "high" },
    { id: "4", title: "Unemployment Rate", country: "US", date: "2025-01-10", time: "08:30", impact: "medium", forecast: "4.2%", previous: "4.2%" },
    { id: "5", title: "Retail Sales m/m", country: "US", date: "2025-01-16", time: "08:30", impact: "medium", forecast: "0.5%", previous: "0.7%" },
    { id: "6", title: "Initial Jobless Claims", country: "US", date: "2025-01-09", time: "08:30", impact: "medium", forecast: "210K", previous: "211K" },
    { id: "7", title: "Producer Price Index (PPI) m/m", country: "US", date: "2025-01-14", time: "08:30", impact: "medium", forecast: "0.2%", previous: "0.4%" },
    { id: "8", title: "ISM Manufacturing PMI", country: "US", date: "2025-01-03", time: "10:00", impact: "high", forecast: "48.5", previous: "48.4" },
    { id: "9", title: "Durable Goods Orders m/m", country: "US", date: "2025-01-28", time: "08:30", impact: "medium", forecast: "0.8%", previous: "-1.1%" },
    { id: "10", title: "GDP q/q", country: "US", date: "2025-01-30", time: "08:30", impact: "high", forecast: "2.8%", previous: "2.8%" },
  ];
  return events;
}

function generateMarketData() {
  // Simulated market data with slight random variations
  const baseData = [
    { symbol: "SPY", name: "S&P 500 ETF", basePrice: 594.28 },
    { symbol: "QQQ", name: "Nasdaq 100 ETF", basePrice: 518.42 },
    { symbol: "DIA", name: "Dow Jones ETF", basePrice: 428.75 },
    { symbol: "IWM", name: "Russell 2000 ETF", basePrice: 224.36 },
    { symbol: "VIX", name: "Volatility Index", basePrice: 16.42 },
    { symbol: "DXY", name: "US Dollar Index", basePrice: 108.24 },
    { symbol: "GLD", name: "Gold ETF", basePrice: 242.18 },
    { symbol: "TLT", name: "Treasury Bond ETF", basePrice: 87.54 },
  ];

  return baseData.map(item => {
    const changePercent = (Math.random() - 0.5) * 2; // -1% to +1%
    const change = item.basePrice * (changePercent / 100);
    return {
      symbol: item.symbol,
      name: item.name,
      price: +(item.basePrice + change).toFixed(2),
      change: +change.toFixed(2),
      changePercent: +changePercent.toFixed(2),
    };
  });
}

function generateNews() {
  const news = [
    { id: "1", headline: "Federal Reserve signals cautious approach to rate cuts in 2025", source: "Reuters", datetime: new Date().toISOString(), url: "https://reuters.com", category: "Fed" },
    { id: "2", headline: "Tech stocks rally on strong earnings expectations", source: "Bloomberg", datetime: new Date(Date.now() - 3600000).toISOString(), url: "https://bloomberg.com", category: "Markets" },
    { id: "3", headline: "Oil prices surge amid Middle East tensions", source: "CNBC", datetime: new Date(Date.now() - 7200000).toISOString(), url: "https://cnbc.com", category: "Commodities" },
    { id: "4", headline: "Treasury yields climb as inflation concerns persist", source: "WSJ", datetime: new Date(Date.now() - 10800000).toISOString(), url: "https://wsj.com", category: "Bonds" },
    { id: "5", headline: "Jobs report preview: What economists expect for December", source: "MarketWatch", datetime: new Date(Date.now() - 14400000).toISOString(), url: "https://marketwatch.com", category: "Economy" },
    { id: "6", headline: "China's manufacturing sector shows signs of recovery", source: "Financial Times", datetime: new Date(Date.now() - 18000000).toISOString(), url: "https://ft.com", category: "Global" },
    { id: "7", headline: "Cryptocurrency markets stabilize after volatile week", source: "CoinDesk", datetime: new Date(Date.now() - 21600000).toISOString(), url: "https://coindesk.com", category: "Crypto" },
    { id: "8", headline: "European Central Bank expected to hold rates steady", source: "Reuters", datetime: new Date(Date.now() - 25200000).toISOString(), url: "https://reuters.com", category: "Central Banks" },
  ];
  return news;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();

    if (action === 'fetchAll') {
      const economicEvents = generateEconomicEvents();
      const marketData = generateMarketData();
      const news = generateNews();

      return new Response(
        JSON.stringify({
          economicEvents,
          marketData,
          news,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in trading-dashboard function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
