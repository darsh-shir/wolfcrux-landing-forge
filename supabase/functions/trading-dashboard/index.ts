import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch top indices from Perplexity API
async function fetchIndices(): Promise<any[]> {
  try {
    console.log('Fetching indices from Perplexity...');
    const response = await fetch(
      "https://www.perplexity.ai/rest/finance/top-indices/market?with_history=true&history_period=1d&country=US",
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      console.error('Perplexity indices fetch failed:', response.status);
      return getFallbackIndices();
    }
    
    const data = await response.json();
    console.log('Perplexity indices response:', JSON.stringify(data).substring(0, 200));
    
    if (Array.isArray(data) && data.length > 0) {
      return data.map((item: any) => ({
        symbol: item.symbol || item.ticker || "",
        name: item.name || "",
        price: item.price || item.last || 0,
        change: item.change || 0,
        changePercent: item.changePercent || item.change_percent || 0,
        history: item.history || []
      }));
    }
    
    return getFallbackIndices();
  } catch (error) {
    console.error('Error fetching indices:', error);
    return getFallbackIndices();
  }
}

// Fetch equity sectors from Perplexity API
async function fetchSectors(): Promise<any[]> {
  try {
    console.log('Fetching sectors from Perplexity...');
    const response = await fetch(
      "https://www.perplexity.ai/rest/finance/equity-sectors",
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      console.error('Perplexity sectors fetch failed:', response.status);
      return getFallbackSectors();
    }
    
    const data = await response.json();
    console.log('Perplexity sectors response:', JSON.stringify(data).substring(0, 200));
    
    if (Array.isArray(data) && data.length > 0) {
      return data.map((item: any) => ({
        name: item.name || item.sector || "Unknown",
        lastPrice: item.price || item.last || item.lastPrice || 0,
        changePercent: item.changePercent || item.change_percent || item.pctChange || 0
      })).sort((a: any, b: any) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    }
    
    return getFallbackSectors();
  } catch (error) {
    console.error('Error fetching sectors:', error);
    return getFallbackSectors();
  }
}

// Fetch market movers from Perplexity API
async function fetchMovers(): Promise<{ gainers: any[]; losers: any[] }> {
  try {
    console.log('Fetching movers from Perplexity...');
    const response = await fetch(
      "https://www.perplexity.ai/rest/finance/top-movers/market?country=US",
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      console.error('Perplexity movers fetch failed:', response.status);
      return getFallbackMovers();
    }
    
    const data = await response.json();
    console.log('Perplexity movers response:', JSON.stringify(data).substring(0, 200));
    
    if (data) {
      const gainers = (data.gainers || data.winners || []).slice(0, 5).map((item: any) => ({
        ticker: item.ticker || item.symbol || "",
        name: item.name || item.company || "",
        price: item.price || item.last || 0,
        changePercent: item.changePercent || item.change_percent || item.pctChange || 0
      }));
      
      const losers = (data.losers || data.decliners || []).slice(0, 5).map((item: any) => ({
        ticker: item.ticker || item.symbol || "",
        name: item.name || item.company || "",
        price: item.price || item.last || 0,
        changePercent: item.changePercent || item.change_percent || item.pctChange || 0
      }));
      
      if (gainers.length > 0 || losers.length > 0) {
        return { 
          gainers: gainers.length > 0 ? gainers : getFallbackMovers().gainers,
          losers: losers.length > 0 ? losers : getFallbackMovers().losers
        };
      }
    }
    
    return getFallbackMovers();
  } catch (error) {
    console.error('Error fetching movers:', error);
    return getFallbackMovers();
  }
}

// Fetch market news from Perplexity API
async function fetchPerplexityNews(): Promise<any[]> {
  try {
    console.log('Fetching news from Perplexity...');
    const response = await fetch(
      "https://www.perplexity.ai/rest/finance/general-news/market?country=US",
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      console.error('Perplexity news fetch failed:', response.status);
      return [];
    }
    
    const data = await response.json();
    console.log('Perplexity news response:', JSON.stringify(data).substring(0, 200));
    
    if (Array.isArray(data) && data.length > 0) {
      return data.slice(0, 10).map((item: any, index: number) => ({
        id: `perp-${index}`,
        headline: item.headline || item.title || "",
        source: item.source || item.publisher || "",
        datetime: item.publishedAt || item.datetime || item.date || new Date().toISOString(),
        url: item.url || item.link || "#",
        category: item.category || "Markets"
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching Perplexity news:', error);
    return [];
  }
}

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
    const rows = doc.querySelectorAll('tr');
    let currentDate = '';
    let eventId = 1;
    
    rows.forEach((row: any) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const text = row.textContent || '';
        
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
        
        let price = 0;
        let change = 0;
        let changePercent = 0;
        
        const priceMatch = html.match(/data-test="instrument-price-last"[^>]*>([0-9,]+\.?\d*)</);
        if (priceMatch) {
          price = parseFloat(priceMatch[1].replace(/,/g, ''));
        } else {
          const altPriceMatch = html.match(/"last_numeric"[^:]*:\s*([0-9.]+)/);
          if (altPriceMatch) {
            price = parseFloat(altPriceMatch[1]);
          }
        }
        
        const changeMatch = html.match(/data-test="instrument-price-change"[^>]*>([+-]?[0-9,]+\.?\d*)</);
        if (changeMatch) {
          change = parseFloat(changeMatch[1].replace(/,/g, ''));
        }
        
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
          
          marketData.push({
            symbol: config.displaySymbol,
            name: config.name,
            price: +price.toFixed(2),
            change: +change.toFixed(2),
            changePercent: +changePercent.toFixed(2),
            regularMarketPrice: +price.toFixed(2),
            preMarketPrice: null,
            postMarketPrice: null,
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

// Scrape news from RSS feeds + Perplexity
async function scrapeNews(): Promise<any[]> {
  try {
    console.log('Scraping news...');
    
    // Try Perplexity first
    const perplexityNews = await fetchPerplexityNews();
    if (perplexityNews.length > 0) {
      console.log(`Got ${perplexityNews.length} news from Perplexity`);
      return perplexityNews;
    }
    
    // Fallback to RSS scraping
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
    
    console.log(`Scraped ${news.length} news items`);
    
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

function getFallbackIndices() {
  return [
    { symbol: "SPX", name: "S&P 500", price: 5948.71, change: 22.10, changePercent: 0.37, history: [] },
    { symbol: "IXIC", name: "NASDAQ", price: 19480.91, change: 130.25, changePercent: 0.67, history: [] },
    { symbol: "DJI", name: "Dow Jones", price: 42706.56, change: -83.44, changePercent: -0.19, history: [] },
    { symbol: "VIX", name: "VIX", price: 17.42, change: -0.88, changePercent: -4.80, history: [] }
  ];
}

function getFallbackSectors() {
  return [
    { name: "Technology", lastPrice: 3245.67, changePercent: 1.24 },
    { name: "Healthcare", lastPrice: 1523.89, changePercent: 0.87 },
    { name: "Financials", lastPrice: 892.45, changePercent: 0.52 },
    { name: "Consumer Discretionary", lastPrice: 1687.23, changePercent: -0.34 },
    { name: "Communication Services", lastPrice: 278.56, changePercent: 0.91 },
    { name: "Industrials", lastPrice: 1089.34, changePercent: -0.18 },
    { name: "Consumer Staples", lastPrice: 845.12, changePercent: 0.23 },
    { name: "Energy", lastPrice: 678.90, changePercent: -1.45 },
    { name: "Utilities", lastPrice: 389.67, changePercent: 0.15 },
    { name: "Real Estate", lastPrice: 256.78, changePercent: -0.67 },
    { name: "Materials", lastPrice: 534.21, changePercent: -0.28 }
  ].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

function getFallbackMovers() {
  return {
    gainers: [
      { ticker: "NVDA", name: "NVIDIA Corporation", price: 142.87, changePercent: 4.52 },
      { ticker: "SMCI", name: "Super Micro Computer", price: 34.56, changePercent: 3.87 },
      { ticker: "AMD", name: "Advanced Micro Devices", price: 128.45, changePercent: 3.21 },
      { ticker: "TSLA", name: "Tesla Inc", price: 398.23, changePercent: 2.89 },
      { ticker: "MSTR", name: "MicroStrategy Inc", price: 378.90, changePercent: 2.45 }
    ],
    losers: [
      { ticker: "INTC", name: "Intel Corporation", price: 19.87, changePercent: -3.45 },
      { ticker: "BA", name: "Boeing Company", price: 167.23, changePercent: -2.89 },
      { ticker: "DIS", name: "Walt Disney Co", price: 112.45, changePercent: -2.12 },
      { ticker: "NKE", name: "Nike Inc", price: 74.56, changePercent: -1.87 },
      { ticker: "PFE", name: "Pfizer Inc", price: 26.78, changePercent: -1.54 }
    ]
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
    console.log('Trading dashboard action:', action);

    if (action === 'fetchAll') {
      // Run all scrapers in parallel
      const [economicEvents, futuresData, etfData, news, indices, sectors, movers] = await Promise.all([
        scrapeEconoday(),
        scrapeLiveFutures(),
        fetchETFData(),
        scrapeNews(),
        fetchIndices(),
        fetchSectors(),
        fetchMovers(),
      ]);
      
      const marketData = [...futuresData, ...etfData];

      console.log('Returning data:', {
        eventsCount: economicEvents.length,
        futuresCount: futuresData.length,
        etfCount: etfData.length,
        newsCount: news.length,
        indicesCount: indices.length,
        sectorsCount: sectors.length,
        gainersCount: movers.gainers.length,
        losersCount: movers.losers.length
      });

      return new Response(
        JSON.stringify({
          economicEvents,
          marketData,
          news,
          indices,
          sectors,
          movers,
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
        news: getFallbackNews(),
        indices: getFallbackIndices(),
        sectors: getFallbackSectors(),
        movers: getFallbackMovers(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
