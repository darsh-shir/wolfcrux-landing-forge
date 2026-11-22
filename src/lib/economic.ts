// TipRanks economic-calendar adapter.
//
// The old snapshot (tr-cdn.tipranks.com/calendars/prod/calendars/economic/payload.json)
// stopped updating on 2026-11-15. TipRanks' calendar page now calls
//   https://www.tipranks.com/api/economic-calendar/?country=us&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
// This maps its events to the shape the Economic tab and overview already use.

const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

export interface EconomicEvent {
  id: number;
  event: string;
  description: string;
  category: string;
  country: string; // lower-case, e.g. "us"
  /** 1 = low, 2 = medium, 3 = high */
  impact: number;
  /** ISO time in UTC */
  time: string;
  actual: string | null;
  forecast: string | null;
  prev: string | null;
  unit: string | null;
  currency: string;
  eventSlug: string;
  ticker: string;
}

const IMPORTANCE: Record<string, number> = { low: 1, medium: 2, high: 3 };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

const raw = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

const mapEvent = (e: any): EconomicEvent | null => {
  const m = e?.eventMetadata || {};
  const d = e?.eventData || {};
  if (!m.eventName || !d.eventDate) return null;
  const date = String(d.eventDate);
  return {
    id: Number(d.economicCalendarEventHistoricalId ?? m.economicCalendarEventId) || 0,
    event: m.eventName,
    description: m.eventDescription || "",
    category: m.category && m.category !== "Default" ? m.category : "",
    country: String(m.country || "").toLowerCase(),
    impact: Number(d.importanceId) || IMPORTANCE[String(d.importance || "").toLowerCase()] || 1,
    // TipRanks sends UTC without a zone suffix.
    time: /[zZ]|[+-]\d\d:\d\d$/.test(date) ? date : `${date}Z`,
    actual: raw(d.actualRaw ?? d.actual),
    forecast: raw(d.forecastRaw ?? d.forecast),
    prev: raw(d.previousRaw ?? d.previous),
    unit: d.unit ?? null,
    currency: d.currencyRaw || d.currency || "",
    eventSlug: m.eventSlug || "",
    ticker: m.ticker || "",
  };
};

/** US economic events from `daysBack` days ago to `daysAhead` days ahead. */
export const fetchEconomicEvents = async (daysBack = 7, daysAhead = 21): Promise<EconomicEvent[]> => {
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - daysBack);
  const to = new Date();
  to.setUTCDate(to.getUTCDate() + daysAhead);
  // The API pages results (100 by default, oldest first), so ask for them all.
  const target = `https://www.tipranks.com/api/economic-calendar/?country=us&fromDate=${ymd(from)}&toDate=${ymd(
    to
  )}&pageSize=1000`;
  const resp = await fetch(`${PROXY}${encodeURIComponent(target)}`);
  if (!resp.ok) throw new Error(`Economic calendar request failed (${resp.status})`);
  const json = await resp.json();
  return (Array.isArray(json?.events) ? json.events : [])
    .map(mapEvent)
    .filter((e: EconomicEvent | null): e is EconomicEvent => !!e)
    .sort((a: EconomicEvent, b: EconomicEvent) => a.time.localeCompare(b.time));
};
