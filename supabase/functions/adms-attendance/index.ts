/**
 * ADMS push endpoint for eSSL / ZKTeco biometric devices (e.g. eSSL Identix K90 Pro).
 *
 * Protocol summary (the DEVICE always initiates):
 *  GET  /iclock/cdata?SN=XXX&options=all&pushver=..  -> registration / handshake. We reply with
 *       the "GET OPTION FROM" config block (stamps, delay, TimeZone=5.5 etc.).
 *  POST /iclock/cdata?SN=XXX&table=ATTLOG&Stamp=..    -> attendance lines, one per row:
 *       PIN \t YYYY-MM-DD HH:MM:SS \t Verify \t InOut \t WorkCode [\t more fields...]
 *       We reply "OK: <n>" ONLY after rows are stored. Any non-OK makes the device retry later.
 *       Other tables (OPERLOG, USERINFO, ATTPHOTO...) are acknowledged with "OK" and ignored.
 *  GET  /iclock/getrequest?SN=XXX                     -> heartbeat / command poll. We have no
 *       queued commands, so reply "OK".
 *  POST /iclock/devicecmd?SN=XXX                      -> command results. Reply "OK".
 *
 * The K90 Pro cannot send custom auth headers, so devices are authenticated by serial number
 * against the attendance_devices allowlist (is_active = true).
 * Device time is local wall-clock time; Wolfcrux devices are in Mumbai, so it is interpreted as
 * Asia/Kolkata (+05:30). The original text is kept in device_local_time / raw_payload.
 *
 * Admin test mode: POST JSON {"action":"parse_test","payload":"..."} with an admin JWT. It only
 * parses and returns rows; nothing is written to attendance.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...cors, "Content-Type": "text/plain" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

type Parsed = {
  pin: string; local: string; iso: string; date: string;
  verify: string | null; inout: string | null; work: string | null; raw: string;
};

/** Tolerant ATTLOG parser: tabs or runs of spaces, CRLF, variable field counts. */
export function parseAttlog(body: string): { rows: Parsed[]; malformed: string[] } {
  const rows: Parsed[] = []; const malformed: string[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let parts = line.split("\t").map((p) => p.trim());
    if (parts.length < 2) {
      // Whitespace-separated: date and time are two tokens
      const t = line.split(/\s+/);
      parts = t.length >= 3 ? [t[0], `${t[1]} ${t[2]}`, ...t.slice(3)] : t;
    }
    const pin = (parts[0] || "").replace(/^PIN=/i, "");
    const dt = (parts[1] || "").replace(/\s+/g, " ");
    const m = dt.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!pin || !/^[A-Za-z0-9_-]{1,32}$/.test(pin) || !m) { malformed.push(line.slice(0, 200)); continue; }
    const local = `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6] ?? "00"}`;
    rows.push({
      pin, local, iso: `${local.replace(" ", "T")}+05:30`, date: `${m[1]}-${m[2]}-${m[3]}`,
      verify: parts[2] || null, inout: parts[3] || null, work: parts[4] || null, raw: line.slice(0, 1000),
    });
  }
  return { rows, malformed };
}

async function logEvent(e: Record<string, unknown>) {
  try { await admin.from("adms_device_events").insert(e); } catch (_) { /* never fail the device */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return text("ok");
  const url = new URL(req.url);
  const path = url.pathname.toLowerCase();
  const sn = (url.searchParams.get("SN") || url.searchParams.get("sn") || "").trim();

  try {
    // ---- Admin-only parse test (no writes to attendance) ----
    if (req.method === "POST" && (req.headers.get("content-type") || "").includes("application/json")) {
      const auth = req.headers.get("Authorization");
      if (!auth) return text("Unauthorized", 401);
      const { data: { user } } = await admin.auth.getUser(auth.replace("Bearer ", ""));
      if (!user) return text("Unauthorized", 401);
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return text("Forbidden", 403);
      const body = await req.json().catch(() => ({}));
      if (body.action !== "parse_test" || typeof body.payload !== "string" || body.payload.length > 20000) {
        return text("Bad request", 400);
      }
      const res = parseAttlog(body.payload);
      const pins = [...new Set(res.rows.map((r) => r.pin))];
      const { data: profs } = pins.length
        ? await admin.from("profiles").select("full_name, biometric_pin").in("biometric_pin", pins)
        : { data: [] };
      return new Response(JSON.stringify({ ...res, matches: profs ?? [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!sn || sn.length > 64) {
      await logEvent({ event_type: "rejected", method: req.method, path, error: "Missing SN" });
      return text("ERROR", 400);
    }

    const { data: device } = await admin.from("attendance_devices")
      .select("id, is_active").eq("device_serial_number", sn).maybeSingle();
    if (!device || !device.is_active) {
      await logEvent({ device_serial_number: sn, event_type: "unregistered", method: req.method, path,
        error: device ? "Device inactive" : "Serial number not registered" });
      // Non-OK keeps the punches on the device so nothing is lost once it is registered.
      return text("ERROR: device not registered", 403);
    }
    await admin.from("attendance_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);

    // ---- Registration / handshake ----
    if (path.endsWith("/iclock/cdata") && req.method === "GET") {
      await logEvent({ device_serial_number: sn, event_type: "registration", method: "GET", path,
        payload_excerpt: url.search.slice(0, 500) });
      return text([
        `GET OPTION FROM: ${sn}`, "ATTLOGStamp=None", "OPERLOGStamp=9999", "ATTPHOTOStamp=None",
        "ErrorDelay=30", "Delay=10", "TransTimes=00:00;14:05", "TransInterval=1",
        "TransFlag=TransData AttLog", "TimeZone=5.5", "Realtime=1", "Encrypt=None", "ServerVer=2.4.1",
      ].join("\n") + "\n");
    }

    // ---- Data upload ----
    if (path.endsWith("/iclock/cdata") && req.method === "POST") {
      const table = (url.searchParams.get("table") || "").toUpperCase();
      const body = await req.text();
      if (table !== "ATTLOG") {
        await logEvent({ device_serial_number: sn, event_type: "upload_other", method: "POST", path,
          table_name: table || null, payload_excerpt: body.slice(0, 300) });
        return text("OK");
      }
      const { rows, malformed } = parseAttlog(body);
      const pins = [...new Set(rows.map((r) => r.pin))];
      const pinMap = new Map<string, string>();
      if (pins.length) {
        const { data: profs, error } = await admin.from("profiles")
          .select("user_id, biometric_pin").in("biometric_pin", pins);
        if (error) throw error;
        (profs ?? []).forEach((p) => p.biometric_pin && pinMap.set(p.biometric_pin, p.user_id));
      }
      let accepted = 0, unmatched = 0;
      if (rows.length) {
        const records = rows.map((r) => ({
          device_id: device.id, device_serial_number: sn, biometric_pin: r.pin,
          employee_id: pinMap.get(r.pin) ?? null, punch_timestamp: r.iso, device_local_time: r.local,
          punch_date: r.date, verify_mode: r.verify, in_out_status: r.inout, work_code: r.work, raw_payload: r.raw,
        }));
        // Idempotent: retries of the same punch are silently ignored by the unique constraint.
        const { data: ins, error } = await admin.from("biometric_attendance_logs")
          .upsert(records, { onConflict: "device_serial_number,biometric_pin,punch_timestamp", ignoreDuplicates: true })
          .select("employee_id");
        if (error) throw error;
        accepted = ins?.length ?? 0;
        unmatched = (ins ?? []).filter((r) => !r.employee_id).length;
        if (accepted) {
          await admin.from("attendance_devices").update({ last_punch_at: new Date().toISOString() }).eq("id", device.id);
        }
      }
      await logEvent({ device_serial_number: sn, event_type: "attlog", method: "POST", path, table_name: table,
        records_received: rows.length + malformed.length, records_accepted: accepted,
        records_duplicate: rows.length - accepted, records_unmatched: unmatched, records_malformed: malformed.length,
        payload_excerpt: body.slice(0, 1000), error: malformed.length ? `Malformed: ${malformed.slice(0, 3).join(" | ")}` : null });
      console.log(`ATTLOG ${sn}: rows=${rows.length} accepted=${accepted} unmatched=${unmatched} malformed=${malformed.length}`);
      return text(`OK: ${rows.length}`);
    }

    // ---- Heartbeat / command poll ----
    if (path.endsWith("/iclock/getrequest")) {
      await logEvent({ device_serial_number: sn, event_type: "heartbeat", method: req.method, path });
      return text("OK");
    }
    if (path.endsWith("/iclock/devicecmd")) {
      const body = req.method === "POST" ? await req.text() : "";
      await logEvent({ device_serial_number: sn, event_type: "devicecmd", method: req.method, path, payload_excerpt: body.slice(0, 300) });
      return text("OK");
    }

    return text("Not found", 404);
  } catch (err) {
    console.error("ADMS error", sn, err instanceof Error ? err.message : err);
    await logEvent({ device_serial_number: sn || null, event_type: "error", method: req.method, path,
      error: "Processing failed" });
    return text("ERROR", 500); // generic; device will retry
  }
});
