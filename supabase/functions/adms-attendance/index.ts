/** ADMS endpoint for eSSL / ZKTeco attendance devices. Punches are stored for review only. */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const text = (body: string, status = 200) => new Response(body, {
  status,
  headers: { ...corsHeaders, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Content-Type": "text/plain" },
});

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceKey) throw new Error("ADMS server configuration is incomplete");
const admin = createClient(supabaseUrl, serviceKey);

type Parsed = {
  pin: string; local: string; iso: string; date: string;
  verify: string | null; inout: string | null; work: string | null; raw: string;
};

/** Parse tab-delimited or whitespace-separated ATTLOG data without writing attendance decisions. */
export function parseAttlog(body: string): { rows: Parsed[]; malformed: string[] } {
  const rows: Parsed[] = [];
  const malformed: string[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let parts = line.split("\t").map((part) => part.trim());
    if (parts.length < 2) {
      const tokens = line.split(/\s+/);
      parts = tokens.length >= 3 ? [tokens[0], `${tokens[1]} ${tokens[2]}`, ...tokens.slice(3)] : tokens;
    }
    const pin = (parts[0] || "").replace(/^PIN=/i, "");
    const dt = (parts[1] || "").replace(/\s+/g, " ");
    const match = dt.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!pin || !/^[A-Za-z0-9_-]{1,32}$/.test(pin) || !match) {
      malformed.push("[REDACTED ATTLOG ROW]");
      continue;
    }
    const local = `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6] ?? "00"}`;
    rows.push({
      pin, local, iso: `${local.replace(" ", "T")}+05:30`, date: `${match[1]}-${match[2]}-${match[3]}`,
      verify: parts[2] || null, inout: parts[3] || null, work: parts[4] || null, raw: line.slice(0, 1000),
    });
  }
  return { rows, malformed };
}

type RequestClass = "device registration / handshake" | "heartbeat" | "attendance upload" | "command polling" | "other ADMS request";
const classify = (path: string, method: string, table: string) => {
  if (path.endsWith("/iclock/cdata") && method === "GET") return "device registration / handshake" as const;
  if (path.endsWith("/iclock/cdata") && method === "POST" && table === "ATTLOG") return "attendance upload" as const;
  if (path.endsWith("/iclock/getrequest")) return "heartbeat" as const;
  if (path.endsWith("/iclock/devicecmd")) return "command polling" as const;
  return "other ADMS request" as const;
};

const masked = (value: string) => value.length <= 4 ? "••••" : `${"•".repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;

function requestInfo(req: Request, url: URL, serial: string | null, serialSource: string | null, kind: RequestClass, table: string, body: string) {
  const safeHeaders: Record<string, string> = {};
  for (const key of ["user-agent", "content-type", "content-length", "accept", "x-forwarded-proto", "x-device-sn", "x-device-serial-number", "sn"]) {
    const value = req.headers.get(key);
    if (value) safeHeaders[key] = key.includes("serial") || key === "sn" ? masked(value.trim()) : value.slice(0, 200);
  }
  const params: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (/^(sn)$/i.test(key)) params[key] = masked(value.trim());
    else if (/^(table|options|pushver|language|stamp|opstamp)$/i.test(key)) params[key] = value.slice(0, 120);
    else params[key] = "[REDACTED]";
  }
  const bodyInfo = body
    ? {
      byteLength: new TextEncoder().encode(body).length,
      lineCount: body.split(/\r?\n/).filter(Boolean).length,
      format: table === "ATTLOG" ? "ATTLOG rows; PINs and timestamps redacted" : "Body present; contents redacted",
      preview: table === "ATTLOG" ? body.split(/\r?\n/).filter(Boolean).slice(0, 3).map((line) => {
        const fields = line.split("\t");
        return `[REDACTED PIN]\t[REDACTED DEVICE TIME]${fields.length > 2 ? `\t${fields.slice(2).join("\t").slice(0, 100)}` : ""}`;
      }) : undefined,
    }
    : { byteLength: 0, lineCount: 0, format: "No request body" };
  return {
    method: req.method,
    pathname: url.pathname,
    queryString: params,
    headers: safeHeaders,
    contentType: req.headers.get("content-type"),
    serialNumber: serial ? masked(serial) : null,
    serialSource,
    requestClass: kind,
    table: table || null,
    body: bodyInfo,
  };
}

function findSerial(req: Request, url: URL) {
  const querySerials = [...url.searchParams.entries()]
    .filter(([key, value]) => /^(sn)$/i.test(key) && value.trim())
    .map(([, value]) => value.trim());
  if (querySerials.length) {
    const distinct = [...new Set(querySerials)];
    return { serial: distinct.length === 1 ? distinct[0] : null, source: "query", conflict: distinct.length > 1 };
  }
  for (const key of ["SN", "X-Device-SN", "X-Device-Serial-Number"]) {
    const value = req.headers.get(key)?.trim();
    if (value) return { serial: value, source: `header:${key.toLowerCase()}`, conflict: false };
  }
  return { serial: null, source: null, conflict: false };
}

async function logEvent(event: Record<string, unknown>) {
  try { await admin.from("adms_device_events").insert(event); } catch { /* logging cannot change the device response */ }
}

async function requireAdmin(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return false;
  const { data: { user } } = await admin.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
  if (!user) return false;
  const { data: role } = await admin.from("user_roles").select("role")
    .eq("user_id", user.id).eq("role", "admin").maybeSingle();
  return Boolean(role);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return text("ok");
  const url = new URL(req.url);
  const path = url.pathname.toLowerCase();

  // Browser-only admin tools; no device records are created by either action.
  if (req.method === "POST" && (req.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    if (!await requireAdmin(req)) return text("Unauthorized", 401);
    const body = await req.text();
    let input: { action?: string; payload?: unknown } = {};
    try { input = JSON.parse(body); } catch { return text("Bad request", 400); }
    if (input.action === "parse_test") {
      if (typeof input.payload !== "string" || input.payload.length > 20000) return text("Bad request", 400);
      const parsed = parseAttlog(input.payload);
      const pins = [...new Set(parsed.rows.map((row) => row.pin))];
      const { data: profiles } = pins.length
        ? await admin.from("profiles").select("full_name, biometric_pin").in("biometric_pin", pins)
        : { data: [] };
      return new Response(JSON.stringify({ ...parsed, matches: profiles ?? [] }), {
        headers: { ...corsHeaders, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Content-Type": "application/json" },
      });
    }
    if (input.action === "connectivity_test") {
      const info = requestInfo(req, url, null, null, "other ADMS request", "", body);
      await logEvent({ event_type: "connectivity_test", method: req.method, path, request_diagnostic: info });
      return new Response(JSON.stringify({ ok: true, reached: "adms-attendance", method: req.method, path: url.pathname, queryReceived: Object.fromEntries(url.searchParams.keys().map((key) => [key, true])), bodyReceived: input.action === "connectivity_test" }), {
        headers: { ...corsHeaders, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Content-Type": "application/json" },
      });
    }
    return text("Bad request", 400);
  }

  const table = (url.searchParams.get("table") || "").toUpperCase();
  const kind = classify(path, req.method, table);
  const requestBody = req.method === "POST" ? await req.text() : "";
  const serialInfo = findSerial(req, url);
  const serial = serialInfo.serial && serialInfo.serial.length <= 64 ? serialInfo.serial : null;
  const diagnostic = requestInfo(req, url, serial, serialInfo.source, kind, table, requestBody);
  const serialRequired = kind !== "other ADMS request";

  if (serialInfo.conflict || (serialRequired && !serial)) {
    await logEvent({ event_type: "rejected", method: req.method, path, error: serialInfo.conflict ? "Conflicting serial number values" : "Missing or invalid serial number", request_diagnostic: diagnostic });
    return text("ERROR: serial number required", 400);
  }

  // Unknown devices may complete the read-only registration handshake so the admin can see
  // and register the actual serial. All other operations remain behind the active-device list.
  if (kind === "device registration / handshake" && serial) {
    const { data: device } = await admin.from("attendance_devices")
      .select("id, is_active").eq("device_serial_number", serial).maybeSingle();
    const knownActive = Boolean(device?.is_active);
    await logEvent({ device_serial_number: serial, event_type: knownActive ? "registration" : "registration_pending", method: req.method, path, request_diagnostic: diagnostic });
    return text([
      `GET OPTION FROM: ${serial}`, "Stamp=0", "OpStamp=0", "PhotoStamp=0", "ATTLOGStamp=0",
      "OPERLOGStamp=0", "ATTPHOTOStamp=0", "ErrorDelay=30", "Delay=10", "TransTimes=00:00;14:05",
      "TransInterval=1", "TransFlag=TransData AttLog", "TimeZone=5.5", "Realtime=1", "Encrypt=None", "ServerVer=2.4.1",
    ].join("\n") + "\n");
  }

  if (!serial) {
    await logEvent({ event_type: "other_request", method: req.method, path, request_diagnostic: diagnostic });
    return text("Not found", 404);
  }

  const { data: device } = await admin.from("attendance_devices")
    .select("id, is_active").eq("device_serial_number", serial).maybeSingle();
  if (!device || !device.is_active) {
    await logEvent({ device_serial_number: serial, event_type: "unregistered", method: req.method, path, error: device ? "Device inactive" : "Serial number not registered", request_diagnostic: diagnostic });
    return text("ERROR: device not registered", 403);
  }
  await admin.from("attendance_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);

  if (kind === "attendance upload") {
    if (table && table !== "ATTLOG") {
      await logEvent({ device_serial_number: serial, event_type: "upload_other", method: req.method, path, table_name: table, request_diagnostic: diagnostic });
      return text("OK");
    }
    const { rows: parsedRows, malformed } = parseAttlog(requestBody);
    const uniqueRows = [...new Map(parsedRows.map((row) => [`${row.pin}\u0000${row.iso}`, row])).values()];
    const pins = [...new Set(uniqueRows.map((row) => row.pin))];
    const pinMap = new Map<string, string>();
    if (pins.length) {
      const { data: profiles, error } = await admin.from("profiles").select("user_id, biometric_pin").in("biometric_pin", pins);
      if (error) throw error;
      (profiles ?? []).forEach((profile) => profile.biometric_pin && pinMap.set(profile.biometric_pin, profile.user_id));
    }
    let accepted = 0;
    let unmatched = 0;
    if (uniqueRows.length) {
      const records = uniqueRows.map((row) => ({
        device_id: device.id, device_serial_number: serial, biometric_pin: row.pin,
        employee_id: pinMap.get(row.pin) ?? null, punch_timestamp: row.iso, device_local_time: row.local,
        punch_date: row.date, verify_mode: row.verify, in_out_status: row.inout, work_code: row.work, raw_payload: row.raw,
      }));
      const { data: inserted, error } = await admin.from("biometric_attendance_logs")
        .upsert(records, { onConflict: "device_serial_number,biometric_pin,punch_timestamp", ignoreDuplicates: true })
        .select("employee_id");
      if (error) throw error;
      accepted = inserted?.length ?? 0;
      unmatched = (inserted ?? []).filter((row) => !row.employee_id).length;
      if (accepted) await admin.from("attendance_devices").update({ last_punch_at: new Date().toISOString() }).eq("id", device.id);
    }
    await logEvent({
      device_serial_number: serial, event_type: "attlog", method: req.method, path, table_name: table,
      records_received: parsedRows.length + malformed.length, records_accepted: accepted,
      records_duplicate: parsedRows.length - accepted, records_unmatched: unmatched, records_malformed: malformed.length,
      request_diagnostic: diagnostic,
      error: malformed.length ? `Malformed rows: ${malformed.length}` : null,
    });
    return text(`OK: ${uniqueRows.length}`);
  }

  if (kind === "heartbeat") {
    await logEvent({ device_serial_number: serial, event_type: "heartbeat", method: req.method, path, request_diagnostic: diagnostic });
    return text("OK");
  }
  if (kind === "command polling") {
    await logEvent({ device_serial_number: serial, event_type: "devicecmd", method: req.method, path, request_diagnostic: diagnostic });
    return text("OK");
  }

  await logEvent({ device_serial_number: serial, event_type: "other_request", method: req.method, path, request_diagnostic: diagnostic });
  return text("Not found", 404);
});