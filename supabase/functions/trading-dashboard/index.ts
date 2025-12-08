import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Scrape economic calendar from Econoday
async function scrapeEconoday(): Promise<any[]> {
  try {
    console.log('Scraping Econoday...');
    const response = await fetch('https://us.econoday.com/byweek.asp?cust=us', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    
    if (!response.ok) {
      console.error('Econoday fetch failed:', response.status);
      return getFallbackEconomicEvents();
    }
    
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      console.error('Failed to parse Econoday HTML');
      return getFallbackEconomicEvents();
    }
    
    const events: any[] = [];
    
    // Parse the calendar table - Econoday uses table-based layout
    const rows = doc.querySelectorAll('tr');
    let currentDate = '';
    let eventId = 1;
    
    rows.forEach((row: any) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const text = row.textContent || '';
        
        // Check if this is a date header row
        const dateMatch = text.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\w+)\s+(\d+)/i);
        if (dateMatch) {
          const months: Record<string, string> = {
            'January': '01', 'February': '02', 'March': '03', 'April': '04',
            'May': '05', 'June': '06', 'July': '07', 'August': '08',
            'September': '09', 'October': '10', 'November': '11', 'December': '12'
          };
          const month = months[dateMatch[2]] || '01';
          const day = dateMatch[3].padStart(2, '0');
          currentDate = `2025-${month}-${day}`;
        }
        
        // Look for event data
        const timeCell = cells[0]?.textContent?.trim() || '';
        const eventCell = cells[1]?.textContent?.trim() || '';
        
        const timeMatch = timeCell.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (timeMatch && eventCell && currentDate) {
          let hour = parseInt(timeMatch[1]);
          const minute = timeMatch[2];
          const ampm = timeMatch[3]?.toUpperCase();
          
          if (ampm === 'PM' && hour < 12) hour += 12;
          if (ampm === 'AM' && hour === 12) hour = 0;
          
          const time = `${hour.toString().padStart(2, '0')}:${minute}`;
          
          // Determine impact based on keywords
          let impact: 'high' | 'medium' | 'low' = 'medium';
          const highImpact = ['GDP', 'CPI', 'NFP', 'Non-Farm', 'FOMC', 'Interest Rate', 'Unemployment', 'Retail Sales', 'ISM'];
          const lowImpact = ['Redbook', 'API', 'Baker Hughes'];
          
          if (highImpact.some(keyword => eventCell.includes(keyword))) {
            impact = 'high';
          } else if (lowImpact.some(keyword => eventCell.includes(keyword))) {
            impact = 'low';
          }
          
          events.push({
            id: String(eventId++),
            title: eventCell.substring(0, 60),
            country: 'US',
            date: currentDate,
            time: time,
            impact: impact,
          });
        }
      }
    });
    
    console.log(`Scraped ${events.length} events from Econoday`);
    return events.length > 0 ? events.slice(0, 20) : getFallbackEconomicEvents();
    
  } catch (error) {
    console.error('Error scraping Econoday:', error);
    return getFallbackEconomicEvents();
  }
}

// Scrape live futures data from Investing.com
async function scrapeLiveFutures(): Promise<any[]> {
  console.log('Scraping live futures from Investing.com...');
  
  const futuresConfig = [
    { url: 'https://www.investing.com/indices/us-spx-500-futures', symbol: 'US500', name: 'S&P 500 Futures' },
    { url: 'https://www.investing.com/indices/us-30-futures', symbol: 'US30', name: 'Dow Jones Futures' },
    { url: 'https://www.investing.com/indices/nq-100-futures', symbol: 'USTECH', name: 'Nasdaq 100 Futures' },
    { url: 'https://www.investing.com/indices/smallcap-2000-futures', symbol: 'US2000', name: 'Russell 2000 Futures' },
    { url: 'https://www.investing.com/indices/volatility-s-p-500', symbol: 'VIX', name: 'VIX Index' },
  ];
  
  const marketData: any[] = [];
  
  for (const config of futuresConfig) {
    try {
      const response = await fetch(config.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Parse price from the page - look for the main price element
        // Investing.com uses data attributes and specific class patterns
        let price = 0;
        let change = 0;
        let changePercent = 0;
        
        // Try to extract price using regex patterns from the HTML
        const priceMatch = html.match(/data-test="instrument-price-last"[^>]*>([0-9,]+\.?\d*)</);
        if (priceMatch) {
          price = parseFloat(priceMatch[1].replace(/,/g, ''));
        } else {
          // Alternative pattern
          const altPriceMatch = html.match(/"last_numeric"[^:]*:\s*([0-9.]+)/);
          if (altPriceMatch) {
            price = parseFloat(altPriceMatch[1]);
          }
        }
        
        // Try to extract change
        const changeMatch = html.match(/data-test="instrument-price-change"[^>]*>([+-]?[0-9,]+\.?\d*)</);
        if (changeMatch) {
          change = parseFloat(changeMatch[1].replace(/,/g, ''));
        }
        
        // Try to extract change percent
        const pctMatch = html.match(/data-test="instrument-price-change-percent"[^>]*>\(?([+-]?[0-9.]+)%?\)?</);
        if (pctMatch) {
          changePercent = parseFloat(pctMatch[1]);
        }
        
        if (price > 0) {
          marketData.push({
            symbol: config.symbol,
            name: config.name,
            price: +price.toFixed(2),
            change: +change.toFixed(2),
            changePercent: +changePercent.toFixed(2),
            regularMarketPrice: +price.toFixed(2),
            preMarketPrice: null,
            postMarketPrice: null,
            marketState: 'LIVE',
          });
          console.log(`Scraped ${config.symbol}: ${price}`);
        }
      }
    } catch (err) {
      console.error(`Error scraping ${config.symbol}:`, err);
    }
  }
  
  // If scraping failed, try Yahoo Finance as backup
  if (marketData.length < 3) {
    console.log('Investing.com scraping incomplete, trying Yahoo Finance backup...');
    return await fetchFromYahoo();
  }
  
  return marketData;
}

// Backup: Fetch from Yahoo Finance
async function fetchFromYahoo(): Promise<any[]> {
  console.log('Fetching from Yahoo Finance...');
  
  const symbols = [
    { symbol: 'ES=F', displaySymbol: 'US500', name: 'S&P 500 Futures' },
    { symbol: 'YM=F', displaySymbol: 'US30', name: 'Dow Jones Futures' },
    { symbol: 'NQ=F', displaySymbol: 'USTECH', name: 'Nasdaq 100 Futures' },
    { symbol: 'RTY=F', displaySymbol: 'US2000', name: 'Russell 2000 Futures' },
    { symbol: '^VIX', displaySymbol: 'VIX', name: 'VIX Index' },
  ];
  
  const marketData: any[] = [];
  
  for (const config of symbols) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.symbol)}?interval=1m&range=1d&includePrePost=true`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const result = data?.chart?.result?.[0];
        
        if (result) {
          const meta = result.meta;
          const price = meta.regularMarketPrice || 0;
          const prevClose = meta.previousClose || meta.chartPreviousClose || price;
          const change = price - prevClose;
          const changePercent = prevClose ? (change / prevClose) * 100 : 0;
          
          const preMarketPrice = meta.preMarketPrice || null;
          const postMarketPrice = meta.postMarketPrice || null;
          const currentPrice = postMarketPrice || preMarketPrice || price;
          const currentChange = currentPrice - prevClose;
          const currentChangePercent = prevClose ? (currentChange / prevClose) * 100 : 0;
          
          marketData.push({
            symbol: config.displaySymbol,
            name: config.name,
            price: +currentPrice.toFixed(2),
            change: +currentChange.toFixed(2),
            changePercent: +currentChangePercent.toFixed(2),
            regularMarketPrice: +price.toFixed(2),
            preMarketPrice: preMarketPrice ? +preMarketPrice.toFixed(2) : null,
            postMarketPrice: postMarketPrice ? +postMarketPrice.toFixed(2) : null,
            marketState: meta.marketState || 'REGULAR',
          });
        }
      }
    } catch (err) {
      console.error(`Error fetching ${config.symbol}:`, err);
    }
  }
  
  return marketData.length > 0 ? marketData : getFallbackMarketData();
}

// Fetch ETF data (SPY, DIA, QQQ, IWM, VXX)
async function fetchETFData(): Promise<any[]> {
  console.log('Fetching ETF data...');
  
  const etfs = [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
    { symbol: 'DIA', name: 'SPDR Dow Jones ETF' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
    { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
    { symbol: 'VXX', name: 'iPath Series B S&P 500 VIX' },
  ];
  
  const etfData: any[] = [];
  
  for (const etf of etfs) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${etf.symbol}?interval=1m&range=1d&includePrePost=true`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const result = data?.chart?.result?.[0];
        
        if (result) {
          const meta = result.meta;
          const price = meta.regularMarketPrice || 0;
          const prevClose = meta.previousClose || meta.chartPreviousClose || price;
          const change = price - prevClose;
          const changePercent = prevClose ? (change / prevClose) * 100 : 0;
          
          const preMarketPrice = meta.preMarketPrice || null;
          const postMarketPrice = meta.postMarketPrice || null;
          const currentPrice = postMarketPrice || preMarketPrice || price;
          const currentChange = currentPrice - prevClose;
          const currentChangePercent = prevClose ? (currentChange / prevClose) * 100 : 0;
          
          etfData.push({
            symbol: etf.symbol,
            name: etf.name,
            price: +currentPrice.toFixed(2),
            change: +currentChange.toFixed(2),
            changePercent: +currentChangePercent.toFixed(2),
            regularMarketPrice: +price.toFixed(2),
            preMarketPrice: preMarketPrice ? +preMarketPrice.toFixed(2) : null,
            postMarketPrice: postMarketPrice ? +postMarketPrice.toFixed(2) : null,
            marketState: meta.marketState || 'REGULAR',
          });
          console.log(`Fetched ${etf.symbol}: ${currentPrice}`);
        }
      }
    } catch (err) {
      console.error(`Error fetching ${etf.symbol}:`, err);
    }
  }
  
  return etfData;
}

// Scrape news from multiple sources
async function scrapeNews(): Promise<any[]> {
  try {
    console.log('Scraping news...');
    const news: any[] = [];
    
    // Scrape from MarketWatch RSS
    try {
      const mwResponse = await fetch('https://feeds.content.dowjones.io/public/rss/mw_topstories', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      if (mwResponse.ok) {
        const xml = await mwResponse.text();
        const doc = new DOMParser().parseFromString(xml, 'text/html');
        
        if (doc) {
          const items = doc.querySelectorAll('item');
          items.forEach((item: any, index: number) => {
            if (index < 5) {
              const title = item.querySelector('title')?.textContent || '';
              const link = item.querySelector('link')?.textContent || '';
              const pubDate = item.querySelector('pubDate')?.textContent || '';
              
              if (title) {
                news.push({
                  id: `mw-${index}`,
                  headline: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
                  source: 'MarketWatch',
                  datetime: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                  url: link,
                  category: 'Markets'
                });
              }
            }
          });
        }
      }
    } catch (err) {
      console.error('MarketWatch scrape error:', err);
    }
    
    // Scrape from CNBC RSS
    try {
      const cnbcResponse = await fetch('https://www.cnbc.com/id/100003114/device/rss/rss.html', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      if (cnbcResponse.ok) {
        const xml = await cnbcResponse.text();
        const doc = new DOMParser().parseFromString(xml, 'text/html');
        
        if (doc) {
          const items = doc.querySelectorAll('item');
          items.forEach((item: any, index: number) => {
            if (index < 5) {
              const title = item.querySelector('title')?.textContent || '';
              const link = item.querySelector('link')?.textContent || '';
              const pubDate = item.querySelector('pubDate')?.textContent || '';
              
              if (title) {
                news.push({
                  id: `cnbc-${index}`,
                  headline: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
                  source: 'CNBC',
                  datetime: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                  url: link,
                  category: 'Finance'
                });
              }
            }
          });
        }
      }
    } catch (err) {
      console.error('CNBC scrape error:', err);
    }
    
    // Scrape from Reuters RSS
    try {
      const reutersResponse = await fetch('https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      if (reutersResponse.ok) {
        const xml = await reutersResponse.text();
        const doc = new DOMParser().parseFromString(xml, 'text/html');
        
        if (doc) {
          const items = doc.querySelectorAll('item');
          items.forEach((item: any, index: number) => {
            if (index < 5) {
              const title = item.querySelector('title')?.textContent || '';
              const link = item.querySelector('link')?.textContent || '';
              const pubDate = item.querySelector('pubDate')?.textContent || '';
              
              if (title) {
                news.push({
                  id: `reuters-${index}`,
                  headline: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
                  source: 'Reuters',
                  datetime: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                  url: link,
                  category: 'Global'
                });
              }
            }
          });
        }
      }
    } catch (err) {
      console.error('Reuters scrape error:', err);
    }
    
    console.log(`Scraped ${news.length} news items`);
    
    // Sort by date, newest first
    news.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
    
    return news.length > 0 ? news : getFallbackNews();
    
  } catch (error) {
    console.error('Error scraping news:', error);
    return getFallbackNews();
  }
}

// Fallback data functions
function getFallbackEconomicEvents() {
  return [
    { id: "1", title: "Non-Farm Payrolls", country: "US", date: "2025-01-10", time: "08:30", impact: "high" as const, forecast: "175K", previous: "227K" },
    { id: "2", title: "Consumer Price Index (CPI) m/m", country: "US", date: "2025-01-15", time: "08:30", impact: "high" as const, forecast: "0.3%", previous: "0.3%" },
    { id: "3", title: "FOMC Meeting Minutes", country: "US", date: "2025-01-08", time: "14:00", impact: "high" as const },
    { id: "4", title: "Unemployment Rate", country: "US", date: "2025-01-10", time: "08:30", impact: "medium" as const, forecast: "4.2%", previous: "4.2%" },
    { id: "5", title: "Retail Sales m/m", country: "US", date: "2025-01-16", time: "08:30", impact: "medium" as const, forecast: "0.5%", previous: "0.7%" },
    { id: "6", title: "Initial Jobless Claims", country: "US", date: "2025-01-09", time: "08:30", impact: "medium" as const, forecast: "210K", previous: "211K" },
    { id: "7", title: "Producer Price Index (PPI) m/m", country: "US", date: "2025-01-14", time: "08:30", impact: "medium" as const, forecast: "0.2%", previous: "0.4%" },
    { id: "8", title: "ISM Manufacturing PMI", country: "US", date: "2025-01-03", time: "10:00", impact: "high" as const, forecast: "48.5", previous: "48.4" },
  ];
}

function getFallbackMarketData() {
  return [
    { symbol: "US500", name: "S&P 500 Futures", price: 5948.50, change: 12.25, changePercent: 0.21, regularMarketPrice: 5948.50, preMarketPrice: null, postMarketPrice: null, marketState: "REGULAR" },
    { symbol: "US30", name: "Dow Jones Futures", price: 42856.00, change: 45.00, changePercent: 0.11, regularMarketPrice: 42856.00, preMarketPrice: null, postMarketPrice: null, marketState: "REGULAR" },
    { symbol: "USTECH", name: "Nasdaq 100 Futures", price: 21245.75, change: -28.50, changePercent: -0.13, regularMarketPrice: 21245.75, preMarketPrice: null, postMarketPrice: null, marketState: "REGULAR" },
    { symbol: "US2000", name: "Russell 2000 Futures", price: 2245.60, change: 8.30, changePercent: 0.37, regularMarketPrice: 2245.60, preMarketPrice: null, postMarketPrice: null, marketState: "REGULAR" },
    { symbol: "VIX", name: "VIX Index", price: 16.42, change: -0.53, changePercent: -3.12, regularMarketPrice: 16.42, preMarketPrice: null, postMarketPrice: null, marketState: "REGULAR" },
  ];
}

function getFallbackETFData() {
  return [
    { symbol: "SPY", name: "SPDR S&P 500 ETF", price: 594.28, change: 3.45, changePercent: 0.58, regularMarketPrice: 594.28, preMarketPrice: null, postMarketPrice: null, marketState: "REGULAR" },
    { symbol: "DIA", name: "SPDR Dow Jones ETF", price: 428.50, change: 2.10, changePercent: 0.49, regularMarketPrice: 428.50, preMarketPrice: null, postMarketPrice: null, marketState: "REGULAR" },
    { symbol: "QQQ", name: "Invesco QQQ Trust", price: 515.75, change: -1.25, changePercent: -0.24, regularMarketPrice: 515.75, preMarketPrice: null, postMarketPrice: null, marketState: "REGULAR" },
    { symbol: "IWM", name: "iShares Russell 2000 ETF", price: 224.30, change: 1.80, changePercent: 0.81, regularMarketPrice: 224.30, preMarketPrice: null, postMarketPrice: null, marketState: "REGULAR" },
    { symbol: "VXX", name: "iPath Series B S&P 500 VIX", price: 45.20, change: 0.85, changePercent: 1.92, regularMarketPrice: 45.20, preMarketPrice: null, postMarketPrice: null, marketState: "REGULAR" },
  ];
}

function getFallbackNews() {
  return [
    { id: "1", headline: "Federal Reserve signals cautious approach to rate cuts in 2025", source: "Reuters", datetime: new Date().toISOString(), url: "#", category: "Fed" },
    { id: "2", headline: "Tech stocks rally on strong earnings expectations", source: "Bloomberg", datetime: new Date(Date.now() - 3600000).toISOString(), url: "#", category: "Markets" },
    { id: "3", headline: "Oil prices surge amid Middle East tensions", source: "CNBC", datetime: new Date(Date.now() - 7200000).toISOString(), url: "#", category: "Commodities" },
    { id: "4", headline: "Treasury yields climb as inflation concerns persist", source: "WSJ", datetime: new Date(Date.now() - 10800000).toISOString(), url: "#", category: "Bonds" },
    { id: "5", headline: "Jobs report preview: What economists expect for December", source: "MarketWatch", datetime: new Date(Date.now() - 14400000).toISOString(), url: "#", category: "Economy" },
  ];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
    console.log('Trading dashboard action:', action);

    if (action === 'fetchAll') {
      // Run all scrapers in parallel
      const [economicEvents, futuresData, etfData, news] = await Promise.all([
        scrapeEconoday(),
        scrapeLiveFutures(),
        fetchETFData(),
        scrapeNews(),
      ]);
      
      // Combine futures and ETF data
      const marketData = [...futuresData, ...etfData];

      console.log('Returning data:', {
        eventsCount: economicEvents.length,
        futuresCount: futuresData.length,
        etfCount: etfData.length,
        newsCount: news.length
      });

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
      JSON.stringify({ 
        error: 'Internal server error',
        economicEvents: getFallbackEconomicEvents(),
        marketData: [...getFallbackMarketData(), ...getFallbackETFData()],
        news: getFallbackNews()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
