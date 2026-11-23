/**
 * Daily market snapshot for the Terminal screener.
 *
 * Called every minute by pg_cron during the after-close window (or by an admin
 * to run it now). Each call fetches a batch of result pages (20 stocks each,
 * sorted by ticker so pages are stable), stores the rows, and once every page
 * is in, publishes one compact JSON file to the private "screener" bucket.
 * If the source refuses requests, the job pauses and does not retry other routes.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const SOURCE = "https://finviz.com/screener.ashx";
const COLUMNS = Array.from({ length: 160 }, (_, i) => i).join(",");
const PAGE = 20;
// Gentle: one page at a time with a pause, a few pages per call. The job is
// called every 2 minutes, so a full market (~280 pages) takes about an hour.
const PAGES_PER_CALL = 8;
const PAUSE_MS = 3_000;
const COOLDOWN_MIN = 20; // after the source pushes back
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
class Blocked extends Error {}

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cronSecret = Deno.env.get("SCREENER_CRON_SECRET") ?? "";
// Used by the GitHub job that fetches from its own (fresh) address and sends rows here.
const ingestSecret = Deno.env.get("SCREENER_INGEST_SECRET") ?? "";
const admin = createClient(url, serviceKey);

// One route: the Cloudflare proxy. If the source turns requests away, the job
// pauses (cooldown) instead of trying other ways in.
const ROUTES: { name: string; wrap: (u: string) => string }[] = [
  { name: "cloudflare", wrap: (u) => `https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=${encodeURIComponent(u)}` },
];


// Fields kept in the snapshot (numbers and text), in a fixed order.
const NUMBER_FIELDS = [
  "price", "change", "changeopen", "gap", "prevClose", "open", "high", "low", "volume", "averageVolume", "averageUsdVolume",
  "relativeVolume", "marketCap", "enterpriseValue", "PE", "forwardPE", "PEG", "PS", "PB", "PC", "PFCF", "evEbitda", "evSales",
  "eps", "estQ1", "epsYoY", "epsYoY1", "epsYoYTTM", "epsQoQ", "eps3Years", "eps5Years", "estLTGrowth", "epsSurprise",
  "sales", "salesQoQ", "salesYoYTTM", "sales3Years", "sales5Years", "revenueSurprise", "income", "grossMargin", "operMargin",
  "netMargin", "roa", "roe", "roi", "curRatio", "quickRatio", "debtEq", "ltdebtEq", "dividend", "dividendTTM", "dividendYield",
  "payoutRatio", "dividend1y", "dividend3y", "dividend5y", "book", "cashPerShare", "employees", "sharesOutstanding2",
  "sharesFloat", "floatoutstandingpct", "insiderOwn", "insiderTrans", "instOwn", "instTrans", "shortInterest",
  "shortInterestShare", "shortInterestRatio", "perf1w", "perf4w", "perf13w", "perf26w", "perf52w", "perfYtd", "perfMtd",
  "perf3y", "perf5y", "perf10y", "volatility1w", "volatility4w", "beta", "averageTrueRange", "rsi", "sma20", "sma50", "sma200",
  "high50d", "low50d", "high52w", "low52w", "highAt", "recom", "targetPrice",
];
const TEXT_FIELDS = [
  "ticker", "company", "sector", "industry", "country", "exchange", "index", "optionable", "shortable", "earningsDate", "ipoDate", "dividendExDate",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The page embeds its result rows as JSON: {"data":{"rows":[...],"totalCount":N,...}} */
function extractData(html: string): { rows: Array<{ text: Record<string, string>; numbers: Record<string, number> }>; totalCount: number } {
  const i = html.indexOf('"data":{"rows":');
  if (i < 0) throw new Error("no data block");
  const start = html.indexOf("{", i + 7);
  let depth = 0, inStr = false, esc = false;
  for (let j = start; j < html.length; j++) {
    const c = html.charCodeAt(j);
    if (inStr) {
      if (esc) esc = false;
      else if (c === 92) esc = true;
      else if (c === 34) inStr = false;
    } else if (c === 34) inStr = true;
    else if (c === 123) depth++;
    else if (c === 125 && --depth === 0) return JSON.parse(html.slice(start, j + 1));
  }
  throw new Error("unterminated data block");
}

let routeTurn = 0;
let routeStats: Record<string, { ok: number; fail: number }> = {};

async function fetchPage(r: number) {
  const target = `${SOURCE}?v=152&o=ticker&c=${COLUMNS}&r=${r}`;
  const first = routeTurn++ % ROUTES.length;
  const order = [...ROUTES.slice(first), ...ROUTES.slice(0, first)];
  let lastError = "";
  let blocked = 0;
  for (const route of order) {
    routeStats[route.name] ??= { ok: 0, fail: 0 };
    try {
      const res = await fetch(route.wrap(target), {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" },
        signal: AbortSignal.timeout(25_000),
      });
      const html = await res.text();
      if (res.status === 403 || res.status === 429 || html.includes("Just a moment")) {
        blocked++;
        throw new Error(`blocked (HTTP ${res.status})`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = extractData(html);
      routeStats[route.name].ok++;
      return data;
    } catch (e) {
      routeStats[route.name].fail++;
      lastError = `${route.name}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  // Every route was turned away: back off instead of pushing harder.
  if (blocked === order.length) throw new Blocked(lastError);
  throw new Error(lastError);
}

const compact = (row: { text: Record<string, string>; numbers: Record<string, number> }) => ({
  n: NUMBER_FIELDS.map((f) => {
    const v = row.numbers?.[f];
    return typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null;
  }),
  t: TEXT_FIELDS.map((f) => row.text?.[f] ?? null),
});

async function isAdmin(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) return false;
  const { data: { user } } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!user) return false;
  const { data } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  return !!data;
}

/** Build and upload the snapshot from rows refreshed since `since`. */
async function publish(run: { id: number; started_at: string; total_rows: number | null }, runDate: string, minShare = 0.98) {
  const all: Array<{ ticker: string; data: { n: unknown[]; t: unknown[] }; fetched_at: string }> = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await admin.from("screener_rows").select("ticker, data, fetched_at")
      .gte("fetched_at", run.started_at).order("ticker").range(off, off + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  // Never publish a partial market.
  if (run.total_rows && all.length < run.total_rows * minShare) {
    throw new Error(`Only ${all.length} of ${run.total_rows} stocks arrived; not publishing.`);
  }
  const snapshot = {
    asOf: new Date().toISOString(),
    tradingDate: runDate,
    numberFields: NUMBER_FIELDS,
    textFields: TEXT_FIELDS,
    rows: all.map((r) => [...r.data.t, ...r.data.n]),
  };
  const file = new Blob([JSON.stringify(snapshot)], { type: "application/json" });
  const { error: upErr } = await admin.storage.from("screener").upload("snapshot.json", file, {
    upsert: true, contentType: "application/json", cacheControl: "300",
  });
  if (upErr) throw new Error(upErr.message);
  await admin.from("screener_rows").delete().lt("fetched_at", run.started_at);
  const { data: done } = await admin.from("screener_runs")
    .update({ status: "done", finished_at: new Date().toISOString(), total_rows: all.length, error: null, cooldown_until: null })
    .eq("id", run.id).select().single();
  return done;
}

/** GitHub job: {action:"ingest", total, rows:[raw rows]} then {action:"publish"}. */
async function handleIngest(body: { action: string; total?: number; pages?: number; rows?: Array<{ text: Record<string, string>; numbers: Record<string, number> }> }) {
  const runDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  let { data: run } = await admin.from("screener_runs").select("*").eq("run_date", runDate).maybeSingle();
  if (run?.status === "done") return json({ status: "done", run });
  if (!run || run.status === "failed") {
    if (run) await admin.from("screener_runs").delete().eq("id", run.id);
    const { data, error } = await admin.from("screener_runs").insert({ run_date: runDate }).select().single();
    if (error) return json({ error: error.message }, 500);
    run = data;
  }
  if (body.action === "ingest") {
    const rows = (body.rows ?? []).filter((r) => r?.text?.ticker);
    if (rows.length > 2000) return json({ error: "too many rows" }, 400);
    if (rows.length) {
      const { error } = await admin.from("screener_rows").upsert(
        rows.map((r) => ({ ticker: r.text.ticker, data: compact(r), fetched_at: new Date().toISOString() })),
      );
      if (error) return json({ error: error.message }, 500);
    }
    const patch: Record<string, unknown> = { routes: { ...(run.routes ?? {}), github: { ok: ((run.routes?.github?.ok as number) ?? 0) + rows.length, fail: 0 } } };
    if (body.total) patch.total_rows = body.total;
    if (body.pages) patch.pages_total = body.pages;
    await admin.from("screener_runs").update(patch).eq("id", run.id);
    return json({ status: "ingested", count: rows.length });
  }
  if (body.action === "publish") {
    try {
      const { data: fresh } = await admin.from("screener_runs").select("*").eq("id", run.id).single();
      const done = await publish(fresh, runDate);
      return json({ status: "done", run: done });
    } catch (e) {
      return json({ status: "error", error: e instanceof Error ? e.message : String(e) }, 409);
    }
  }
  return json({ error: "unknown action" }, 400);
}

Deno.serve(async (req) => {
  // GitHub job (own secret, only ingest/publish).
  if (ingestSecret && req.headers.get("x-ingest-secret") === ingestSecret) {
    const body = await req.json().catch(() => ({}));
    return handleIngest(body);
  }
  routeStats = {};
  const fromCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (!fromCron && !(await isAdmin(req))) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const restart = body?.restart === true;
  if (body?.discard === true) {
    // Remove a published snapshot (e.g. an incomplete one).
    const { error } = await admin.storage.from("screener").remove(["snapshot.json"]);
    return json({ discarded: !error, error: error?.message });
  }

  // US trading date (New York) identifies the run.
  const runDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  let { data: run } = await admin.from("screener_runs").select("*").eq("run_date", runDate).maybeSingle();
  if (run && restart) {
    await admin.from("screener_runs").delete().eq("id", run.id);
    run = null;
  }
  if (run?.status === "done") return json({ status: "done", run });
  if (run?.status === "failed" && !restart) return json({ status: "failed", run });
  if (run?.cooldown_until && new Date(run.cooldown_until) > new Date()) return json({ status: "cooling down", run });
  if (!run) {
    const { data, error } = await admin.from("screener_runs").insert({ run_date: runDate }).select().single();
    if (error) return json({ error: error.message }, 500);
    run = data;
  }

  try {
    // First page tells us how many pages there are.
    if (!run.pages_total) {
      const first = await fetchPage(1);
      const pages = Math.ceil(first.totalCount / PAGE);
      await admin.from("screener_rows").upsert(
        first.rows.map((r) => ({ ticker: r.text.ticker, data: compact(r), fetched_at: new Date().toISOString() })),
      );
      const { data } = await admin.from("screener_runs")
        .update({ total_rows: first.totalCount, pages_total: pages, pages_done: 1 })
        .eq("id", run.id).select().single();
      run = data;
    }

    // Next pages, one at a time. The cursor only moves past pages that arrived,
    // so a failed page is retried on the next call.
    let cursor = run.pages_done;
    const stopAt = Math.min(run.pages_total, cursor + PAGES_PER_CALL);
    let failed = 0;
    let cooldown: string | null = null;
    while (cursor < stopAt) {
      try {
        const page = await fetchPage(cursor * PAGE + 1);
        const rows = page.rows.filter((r) => r.text?.ticker);
        if (rows.length) {
          const { error } = await admin.from("screener_rows").upsert(
            rows.map((r) => ({ ticker: r.text.ticker, data: compact(r), fetched_at: new Date().toISOString() })),
          );
          if (error) throw new Error(error.message);
        }
        cursor++;
      } catch (e) {
        failed++;
        if (e instanceof Blocked) cooldown = new Date(Date.now() + COOLDOWN_MIN * 60_000).toISOString();
        break; // stop this call; resume later (after the cooldown if blocked)
      }
      if (cursor < stopAt) await sleep(PAUSE_MS);
    }
    const to = cursor;
    const routes = { ...(run.routes ?? {}) };
    for (const [k, v] of Object.entries(routeStats)) {
      routes[k] = { ok: (routes[k]?.ok ?? 0) + v.ok, fail: (routes[k]?.fail ?? 0) + v.fail };
    }
    const { data: updated } = await admin.from("screener_runs")
      .update({ pages_done: to, failed_pages: run.failed_pages + failed, routes, cooldown_until: cooldown, error: cooldown ? "Source asked us to slow down; pausing" : null })
      .eq("id", run.id).select().single();
    run = updated;

    // All pages in: publish the snapshot file.
    if (run.pages_done >= run.pages_total) {
      const done = await publish(run, runDate);
      return json({ status: "done", run: done });
    }
    return json({ status: "running", run });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from("screener_runs").update({ error: message.slice(0, 500) }).eq("id", run.id);
    return json({ status: "error", error: message, run }, 500);
  }
});
