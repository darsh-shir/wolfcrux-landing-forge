/**
 * Calendar dates for a US-market terminal.
 *
 * "Today" means today in New York, not the viewer's local date or UTC. Our
 * traders are in India (UTC+5:30): local midnight is still the previous day in
 * UTC, and from 5:30 AM IST the UTC date has already moved ahead of New York,
 * so neither gives the right US trading day.
 */
const NY_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD in New York for the given instant (default: now). */
export const nyDateKey = (d: Date = new Date()) => NY_DATE.format(d);

/** Add whole days to a YYYY-MM-DD key. */
export const addDaysKey = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD key. */
export const weekdayOfKey = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();

/** Next Mon–Fri on or after `key` (ignores market holidays). */
export const nextWeekdayKey = (key: string) => {
  let k = key;
  while ([0, 6].includes(weekdayOfKey(k))) k = addDaysKey(k, 1);
  return k;
};
