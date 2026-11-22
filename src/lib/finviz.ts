// Finviz per-ticker headlines, fetched through the Cloudflare proxy.
const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

export interface FinvizItem {
  date: string;
  headline: string;
  url: string;
  source: string;
}

export const parseFinvizHtml = (html: string): FinvizItem[] => {
  try {
    const doc = new DOMParser().parseFromString(`<table>${html}</table>`, "text/html");
    const rows = Array.from(doc.querySelectorAll("tr"));
    return rows
      .map((tr): FinvizItem | null => {
        const tds = tr.querySelectorAll("td");
        if (tds.length < 2) return null;
        const date = (tds[0].textContent || "").trim().replace(/\s+/g, " ");
        const a = tr.querySelector("a.tab-link-news") as HTMLAnchorElement | null;
        if (!a) return null;
        const headline = (a.textContent || "").trim();
        let url = a.getAttribute("href") || "#";
        if (url.startsWith("/")) url = `https://finviz.com${url}`;
        const sourceEl = tr.querySelector(".news-link-right span");
        const source = (sourceEl?.textContent || "").trim().replace(/^\(|\)$/g, "");
        if (!headline) return null;
        return { date, headline, url, source };
      })
      .filter((x): x is FinvizItem => !!x);
  } catch {
    return [];
  }
};

/** Latest headlines for one ticker. */
export const fetchFinvizNews = async (symbol: string): Promise<FinvizItem[]> => {
  const target = `https://finviz.com/api/news/quote/${encodeURIComponent(symbol)}`;
  const res = await fetch(`${PROXY}${encodeURIComponent(target)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return parseFinvizHtml(json?.html || "");
};
