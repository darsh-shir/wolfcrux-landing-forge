import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/ui/save-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, Server, Activity, UserX, Clock, Copy, RefreshCw, Trash2 } from "lucide-react";

const TZ = "Asia/Kolkata";
const fmt = (s?: string | null) =>
  s ? new Date(s).toLocaleString("en-IN", { timeZone: TZ, dateStyle: "medium", timeStyle: "medium" }) : "—";
const ago = (iso?: string | null) => {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return fmt(iso);
};
const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

const FUNCTION_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/adms-attendance`;

/** Address of the Cloudflare Worker relay the device talks to (plain HTTP, port 80). */
const RELAY_HOST = "wolfcrux-adms.pc-shiroiya25.workers.dev";

const WORKER_CODE = `// Cloudflare Worker "wolfcrux-adms": relay for the eSSL K90 Pro (ADMS).
// The device can only speak plain HTTP to /iclock/...; this forwards each
// request unchanged (method, query, body) to the HTTPS backend function.
const TARGET = "${import.meta.env.VITE_SUPABASE_URL}/functions/v1/adms-attendance";
export default {
  async fetch(request) {
    const source = new URL(request.url);
    const path = source.pathname;
    if (path === "/" || path === "") {
      return new Response("Wolfcrux ADMS relay is running", { headers: { "content-type": "text/plain" } });
    }
    if (!path.toLowerCase().startsWith("/iclock/")) return new Response("Not found", { status: 404 });
    const target = new URL(TARGET);
    target.pathname = target.pathname.replace(/\\/$/, "") + path;
    target.search = source.search;
    const init = {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    };
    const reply = await fetch(target.toString(), init);
    // Devices expect a plain-text reply; pass it through as-is.
    return new Response(await reply.arrayBuffer(), { status: reply.status, headers: { "content-type": "text/plain" } });
  },
};`;

type Device = { id: string; device_serial_number: string; device_name: string; location: string | null; is_active: boolean; last_seen_at: string | null; last_punch_at: string | null };
type Punch = { id: string; biometric_pin: string; employee_id: string | null; punch_timestamp: string; received_at: string; device_serial_number: string; verify_mode: string | null; in_out_status: string | null };
type Evt = { id: string; device_serial_number: string | null; event_type: string; created_at: string; method: string | null; path: string | null; table_name: string | null; records_received: number; records_accepted: number; records_duplicate: number; records_unmatched: number; records_malformed: number; payload_excerpt: string | null; error: string | null; request_diagnostic: unknown };
type Shift = { id: string; effective_from: string; shift_start: string; notes: string | null };
type Prof = { user_id: string; full_name: string; biometric_pin: string | null; employee_role?: string | null; uses_biometric?: boolean | null };

const BiometricAttendance = () => {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [events, setEvents] = useState<Evt[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [profiles, setProfiles] = useState<Prof[]>([]);
  const [newDev, setNewDev] = useState({ name: "", sn: "", location: "", active: true });
  const [newShift, setNewShift] = useState({ from: todayIST(), start: "", notes: "" });
  const [mapSel, setMapSel] = useState<Record<string, string>>({});
  const [testPayload, setTestPayload] = useState("1001\t2026-10-01 09:02:15\t1\t0\t0");
  const [testResult, setTestResult] = useState<string>("");
  const [connectivityResult, setConnectivityResult] = useState<string>("");

  const load = async () => {
    const [d, p, e, s, pr] = await Promise.all([
      supabase.from("attendance_devices").select("*").order("created_at"),
      supabase.from("biometric_attendance_logs").select("id,biometric_pin,employee_id,punch_timestamp,received_at,device_serial_number,verify_mode,in_out_status").order("received_at", { ascending: false }).limit(500),
      supabase.from("adms_device_events").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("attendance_shift_settings").select("*").order("effective_from", { ascending: false }),
      supabase.from("profiles").select("user_id,full_name,biometric_pin,employee_role,uses_biometric").order("full_name"),
    ]);
    setDevices((d.data as Device[]) ?? []);
    setPunches((p.data as Punch[]) ?? []);
    setEvents((e.data as Evt[]) ?? []);
    setShifts((s.data as Shift[]) ?? []);
    setProfiles((pr.data as Prof[]) ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("biometric-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "biometric_attendance_logs" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_devices" }, load)
      .subscribe();
    const t = setInterval(load, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, []);

  const nameOf = useMemo(() => new Map(profiles.map((p) => [p.user_id, p.full_name])), [profiles]);
  const unknown = useMemo(() => {
    const m = new Map<string, { pin: string; count: number; last: Punch }>();
    punches.filter((p) => !p.employee_id).forEach((p) => {
      const cur = m.get(p.biometric_pin);
      if (cur) cur.count++; else m.set(p.biometric_pin, { pin: p.biometric_pin, count: 1, last: p });
    });
    return [...m.values()];
  }, [punches]);
  const today = todayIST();
  const todayCount = punches.filter((p) => new Date(p.punch_timestamp).toLocaleDateString("en-CA", { timeZone: TZ }) === today).length;
  const lastHeartbeat = events.find((e) => ["heartbeat", "registration"].includes(e.event_type));
  const lastUpload = events.find((e) => e.event_type === "attlog");
  const lastError = events.find((e) => e.error);
  const lastGoodPunch = punches.find((p) => p.employee_id);

  const status = (d: Device) => {
    if (!d.is_active) return <Badge variant="secondary">Inactive</Badge>;
    if (!d.last_seen_at) return <Badge variant="outline">Never connected</Badge>;
    const mins = (Date.now() - new Date(d.last_seen_at).getTime()) / 60000;
    return mins < 5 ? <Badge>Online</Badge> : <Badge variant="destructive">Offline {Math.round(mins)}m</Badge>;
  };

  const addDevice = async () => {
    if (!newDev.name.trim() || !newDev.sn.trim()) return toast({ title: "Name and serial number required", variant: "destructive" });
    const { error } = await supabase.from("attendance_devices").insert({
      device_name: newDev.name.trim(), device_serial_number: newDev.sn.trim(), location: newDev.location.trim() || null, is_active: newDev.active,
    });
    if (error) return toast({ title: "Could not add device", description: error.message, variant: "destructive" });
    setNewDev({ name: "", sn: "", location: "", active: true });
    toast({ title: "Device added" }); load();
  };
  const toggleDevice = async (d: Device) => { await supabase.from("attendance_devices").update({ is_active: !d.is_active }).eq("id", d.id); load(); };
  const removeDevice = async (d: Device) => {
    if (!confirm(`Remove ${d.device_name}? Punches already received are kept.`)) return;
    await supabase.from("attendance_devices").delete().eq("id", d.id); load();
  };

  const setPin = async (userId: string, pin: string | null) => {
    const { error } = await supabase.from("profiles").update({ biometric_pin: pin && pin.trim() ? pin.trim() : null }).eq("user_id", userId);
    if (error) return toast({ title: "Could not save PIN", description: error.message.includes("unique") || error.message.includes("duplicate") ? "That PIN is already assigned to someone else." : error.message, variant: "destructive" });
    // Link punches already received for this PIN (and unlink this person's punches
    // under any other PIN). Punches stay review-only; attendance is not changed.
    const newPin = pin && pin.trim() ? pin.trim() : null;
    const unlink = newPin
      ? await supabase.from("biometric_attendance_logs").update({ employee_id: null }).eq("employee_id", userId).neq("biometric_pin", newPin)
      : await supabase.from("biometric_attendance_logs").update({ employee_id: null }).eq("employee_id", userId);
    const link = newPin
      ? await supabase.from("biometric_attendance_logs").update({ employee_id: userId }).eq("biometric_pin", newPin).select("id")
      : { data: [], error: null };
    const linkError = unlink.error || link.error;
    toast({
      title: "Biometric PIN saved",
      description: linkError
        ? `Saved, but earlier punches couldn't be linked: ${linkError.message}`
        : newPin
          ? `${link.data?.length ?? 0} punch(es) already received for PIN ${newPin} are now linked.`
          : "Earlier punches were unlinked.",
      variant: linkError ? "destructive" : undefined,
    });
    load();
  };

  const addShift = async () => {
    if (!newShift.from || !newShift.start) return toast({ title: "Choose an effective date and start time", variant: "destructive" });
    const { error } = await supabase.from("attendance_shift_settings").upsert({
      effective_from: newShift.from, shift_start: newShift.start, notes: newShift.notes.trim() || null,
    }, { onConflict: "effective_from" });
    if (error) return toast({ title: "Could not save", description: error.message, variant: "destructive" });
    toast({ title: "Shift timing saved", description: "Punches remain review-only; attendance was not changed." }); load();
  };
  const delShift = async (s: Shift) => {
    const { error } = await supabase.from("attendance_shift_settings").delete().eq("id", s.id);
    if (error) return toast({ title: "Could not delete shift rule", description: error.message, variant: "destructive" });
    load();
  };

  const runTest = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: "parse_test", payload: testPayload }),
    }).catch(() => null);
    if (!res) return setTestResult("Endpoint unreachable");
    setTestResult(`HTTP ${res.status}\n` + JSON.stringify(await res.json().catch(() => ({})), null, 2));
  };
  const runConnectivityTest = async () => {
    setConnectivityResult("Checking the public GET handshake and an authenticated POST probe…");
    try {
      const getUrl = new URL(`https://${RELAY_HOST}/iclock/cdata`);
      getUrl.searchParams.set("options", "all");
      getUrl.searchParams.set("pushver", "diagnostic");
      getUrl.searchParams.set("SN", "WOLFCRUX-CONNECTIVITY-TEST");
      const getResponse = await fetch(getUrl.toString(), { method: "GET", headers: { "Accept": "text/plain" } });
      const getBody = await getResponse.text();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setConnectivityResult(`GET handshake: HTTP ${getResponse.status}\n${getBody.slice(0, 500)}\nPOST forwarding test requires an admin session.`);
        return;
      }
      const postUrl = new URL(`https://${RELAY_HOST}/iclock/cdata`);
      postUrl.searchParams.set("__wolfcrux_probe", "connectivity");
      postUrl.searchParams.set("table", "ATTLOG");
      const probeBody = "ADMS connectivity test; no punch data";
      const postResponse = await fetch(postUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "X-ADMS-Diagnostic": "connectivity-test",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: probeBody,
      });
      const postBody = await postResponse.text();
      setConnectivityResult(`GET handshake: HTTP ${getResponse.status}\n${getBody.slice(0, 500)}\n\nPOST through public relay: HTTP ${postResponse.status}\n${postBody.slice(0, 1000)}`);
      await load();
    } catch (error) {
      setConnectivityResult(`Could not complete the test: ${error instanceof Error ? error.message : "Network error"}`);
    }
  };
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast({ title: "Copied" }); };

  return (
    <div className="space-y-6">
      {/* Machine: plain-language status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-['Space_Grotesk']"><Fingerprint className="h-5 w-5" />Fingerprint machine</CardTitle>
            <CardDescription>Is the machine connected, and when did it last send punches?</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {devices.length === 0 && <p className="text-sm text-muted-foreground">No machine added yet — see Advanced below.</p>}
          {devices.map((d) => (
            <div key={d.id} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Machine</p>
                <p className="font-medium">{d.device_name}</p>
                <p className="text-xs text-muted-foreground">{d.location || "Office"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Connection</p>
                <div className="mt-0.5">{status(d)}</div>
                <p className="mt-1 text-xs text-muted-foreground">Last contact {ago(d.last_seen_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last fingerprint</p>
                <p className="font-medium">{ago(d.last_punch_at)}</p>
                {lastGoodPunch && <p className="text-xs text-muted-foreground">{nameOf.get(lastGoodPunch.employee_id!) ?? "—"}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Punches today</p>
                <p className="text-2xl font-bold tabular-nums">{todayCount}</p>
              </div>
            </div>
          ))}
          {devices.some((d) => d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() > 30 * 60000) && (
            <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              The machine hasn't been in touch for a while. Check that it's switched on and connected to the internet (network cable or Wi-Fi). Punches are stored on the machine and arrive once it reconnects.
            </p>
          )}
        </CardContent>
      </Card>

      {/* People ↔ machine numbers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-['Space_Grotesk']"><UserX className="h-5 w-5" />Fingerprint numbers</CardTitle>
          <CardDescription>
            Each person has a number on the machine (Menu → User Management → User ID). Enter it here so their fingerprints are matched to them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {unknown.length > 0 && (
            <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="text-sm font-medium">{unknown.length} number{unknown.length === 1 ? "" : "s"} on the machine not linked to anyone yet</p>
              {unknown.map((u) => (
                <div key={u.pin} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-16 font-mono font-semibold">No. {u.pin}</span>
                  <span className="w-48 text-xs text-muted-foreground">{u.count} punch{u.count === 1 ? "" : "es"} · last {fmt(u.last.punch_timestamp)}</span>
                  <Select value={mapSel[u.pin] ?? ""} onValueChange={(v) => setMapSel({ ...mapSel, [u.pin]: v })}>
                    <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Who is this?" /></SelectTrigger>
                    <SelectContent>{profiles.filter((p) => !p.biometric_pin).map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" className="h-8" disabled={!mapSel[u.pin]} onClick={() => setPin(mapSel[u.pin], u.pin)}>Link</Button>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
            {profiles
              // Only people who use the machine (others are switched off in "Who uses fingerprint").
              .filter((p) => p.biometric_pin || (p.uses_biometric !== false && ["trader", "trainee"].includes((p.employee_role || "").toLowerCase())))
              .map((p) => (
              <form key={p.user_id} className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setPin(p.user_id, (new FormData(e.currentTarget).get("pin") as string) ?? ""); }}>
                <span className="flex-1 truncate text-sm">{p.full_name}</span>
                <Input name="pin" defaultValue={p.biometric_pin ?? ""} placeholder="No." className="h-8 w-20 text-center font-mono" aria-label={`Machine number for ${p.full_name}`} />
                <SaveButton type="submit" />
              </form>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Everything technical, folded away */}
      <details className="rounded-lg border">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
          Advanced — machine registration, all raw punches, setup and troubleshooting
        </summary>
        <div className="space-y-6 border-t p-4">
      {/* Devices */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 font-['Space_Grotesk']"><Fingerprint className="h-5 w-5" />Devices</CardTitle>
          <CardDescription>Only registered, active serial numbers are accepted.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-5 gap-2 items-end">
            <div><Label>Device name</Label><Input value={newDev.name} onChange={(e) => setNewDev({ ...newDev, name: e.target.value })} placeholder="Main door K90" /></div>
            <div><Label>Serial number</Label><Input value={newDev.sn} onChange={(e) => setNewDev({ ...newDev, sn: e.target.value })} placeholder="From device: System Info" /></div>
            <div><Label>Location</Label><Input value={newDev.location} onChange={(e) => setNewDev({ ...newDev, location: e.target.value })} placeholder="Mumbai office" /></div>
            <div className="flex items-center gap-2 pb-2"><Switch checked={newDev.active} onCheckedChange={(v) => setNewDev({ ...newDev, active: v })} /><Label>Active</Label></div>
            <Button onClick={addDevice}>Add Device</Button>
          </div>
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Serial</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead>Last seen</TableHead><TableHead>Last punch</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {devices.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No devices yet</TableCell></TableRow>}
              {devices.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.device_name}</TableCell>
                  <TableCell className="font-mono text-xs">{d.device_serial_number}</TableCell>
                  <TableCell>{d.location || "—"}</TableCell>
                  <TableCell>{status(d)}</TableCell>
                  <TableCell className="text-xs">{fmt(d.last_seen_at)}</TableCell>
                  <TableCell className="text-xs">{fmt(d.last_punch_at)}</TableCell>
                  <TableCell className="flex gap-2 justify-end">
                    <Switch checked={d.is_active} onCheckedChange={() => toggleDevice(d)} />
                    <Button size="icon" variant="ghost" onClick={() => removeDevice(d)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-['Space_Grotesk']">Recent punches</CardTitle>
          <CardDescription>Device punches are saved for review only. They never create or change attendance records.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Punch time (IST)</TableHead><TableHead>Employee</TableHead><TableHead>PIN</TableHead><TableHead>In / Out</TableHead><TableHead>Verification</TableHead><TableHead>Device</TableHead></TableRow></TableHeader>
            <TableBody>
              {punches.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No punches received yet</TableCell></TableRow> : punches.slice(0, 50).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs whitespace-nowrap">{fmt(p.punch_timestamp)}</TableCell>
                  <TableCell>{p.employee_id ? nameOf.get(p.employee_id) ?? "Mapped employee" : <Badge variant="outline">Unknown PIN</Badge>}</TableCell>
                  <TableCell className="font-mono text-xs">{p.biometric_pin}</TableCell>
                  <TableCell>{p.in_out_status ?? "—"}</TableCell>
                  <TableCell>{p.verify_mode ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.device_serial_number}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Shift timing */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 font-['Space_Grotesk']"><Clock className="h-5 w-5" />Shift Timing (IST)</CardTitle>
          <CardDescription>Set a start time for each date when the schedule changes. It remains in effect until the next date you enter. These settings are for reference; punches do not mark attendance.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-2 items-end">
            <div><Label>Effective from</Label><Input type="date" value={newShift.from} onChange={(e) => setNewShift({ ...newShift, from: e.target.value })} /></div>
            <div><Label>Start time (IST)</Label><Input type="time" required value={newShift.start} onChange={(e) => setNewShift({ ...newShift, start: e.target.value })} /></div>
            <div><Label>Note</Label><Input value={newShift.notes} onChange={(e) => setNewShift({ ...newShift, notes: e.target.value })} placeholder="Seasonal schedule" /></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Common starts:</span>
            {[{ value: "13:15", label: "1:15 PM" }, { value: "14:15", label: "2:15 PM" }, { value: "15:15", label: "3:15 PM" }].map((time) => (
              <Button key={time.value} type="button" size="sm" variant="outline" onClick={() => setNewShift({ ...newShift, start: time.value })}>{time.label}</Button>
            ))}
            <SaveButton className="h-9" onClick={addShift} />
          </div>
          <div className="flex flex-wrap gap-2">{shifts.map((s) => (
            <Badge key={s.id} variant="outline" className="gap-2 py-1">
              From {s.effective_from}: {s.shift_start.slice(0, 5)} IST {s.notes ? `(${s.notes})` : ""}
              <button onClick={() => delShift(s)} aria-label="Delete rule"><Trash2 className="h-3 w-3" /></button>
            </Badge>
          ))}</div>
        </CardContent>
      </Card>

      {/* Device configuration */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 font-['Space_Grotesk']"><Server className="h-5 w-5" />Device Configuration</CardTitle>
          <CardDescription>Create the relay Worker first (code below), open its address in a browser to check it says "Wolfcrux ADMS relay is running", then enter these settings on the device.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid md:grid-cols-2 gap-2">
            {[
              ["Server Mode", "ADMS"], ["Enable Domain Name", "ON"], ["Server Address", RELAY_HOST],
              ["Server Port", "80"], ["HTTPS / SSL (if the menu has it)", "OFF"],
              ["Enable Proxy Server", "OFF"], ["Device Serial Number", devices.map((d) => d.device_serial_number).join(", ") || "Register it above"],
              ["Network (Comm. → Ethernet)", "DHCP ON, or set Gateway and DNS (e.g. 8.8.8.8)"],
            ].map(([k, v]) => (
              <div key={k} className="p-2 rounded border flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="font-mono text-xs text-right break-all">{v}</span></div>
            ))}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1"><p className="text-xs text-muted-foreground">Cloudflare Worker code (name it wolfcrux-adms)</p>
              <Button size="sm" variant="ghost" onClick={() => copy(WORKER_CODE)}><Copy className="h-4 w-4 mr-1" />Copy</Button></div>
            <pre className="text-xs p-3 rounded bg-muted overflow-x-auto max-h-64">{WORKER_CODE}</pre>
            <p className="mt-2 text-xs text-muted-foreground">In Cloudflare: Workers &amp; Pages → Create → Worker → name it <span className="font-mono">wolfcrux-adms</span> → Deploy → Edit code → paste this → Deploy. Its workers.dev address accepts plain HTTP on port 80, which the device needs.</p>
          </div>
        </CardContent>
      </Card>

      {/* Safe test */}
      <Card>
        <CardHeader><CardTitle className="font-['Space_Grotesk']">Safe Parser Test</CardTitle>
          <CardDescription>Checks the endpoint is up and how a sample line is read. Nothing is saved to attendance.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={3} className="font-mono text-xs" value={testPayload} onChange={(e) => setTestPayload(e.target.value)} />
          <Button onClick={runTest}>Test Connection</Button>
          {testResult && <pre className="text-xs p-2 rounded bg-muted overflow-x-auto max-h-64">{testResult}</pre>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-['Space_Grotesk']">ADMS Connectivity Test</CardTitle>
          <CardDescription>Checks a read-only GET handshake and sends an admin-authenticated POST through the public address. No punches or attendance are created.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={runConnectivityTest}><Activity className="h-4 w-4 mr-2" />Test connection</Button>
          {connectivityResult && <pre className="text-xs p-2 rounded bg-muted overflow-x-auto max-h-64 whitespace-pre-wrap">{connectivityResult}</pre>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-['Space_Grotesk']">ADMS Connectivity Test</CardTitle>
          <CardDescription>Checks a read-only handshake and an authenticated probe through the public address. No punches or attendance are created.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={runConnectivityTest}><Activity className="h-4 w-4 mr-2" />Test connection</Button>
          {connectivityResult && <pre className="text-xs p-2 rounded bg-muted overflow-x-auto max-h-64 whitespace-pre-wrap">{connectivityResult}</pre>}
        </CardContent>
      </Card>

      {/* Event log */}
      <Card>
        <CardHeader><CardTitle className="font-['Space_Grotesk']">Device Event Log</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto"><Table>
          <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Serial</TableHead><TableHead>Event</TableHead><TableHead>Recv/New/Dup/Unk/Bad</TableHead><TableHead>Error</TableHead><TableHead>Request details</TableHead></TableRow></TableHeader>
          <TableBody>{events.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="text-xs whitespace-nowrap">{fmt(e.created_at)}</TableCell>
              <TableCell className="font-mono text-xs">{e.device_serial_number || "—"}</TableCell>
              <TableCell><Badge variant={e.error ? "destructive" : "outline"}>{e.event_type}</Badge></TableCell>
              <TableCell className="text-xs">{e.event_type === "attlog" ? `${e.records_received}/${e.records_accepted}/${e.records_duplicate}/${e.records_unmatched}/${e.records_malformed}` : "—"}</TableCell>
              <TableCell className="text-xs text-destructive">{e.error || ""}</TableCell>
              <TableCell className="min-w-64 max-w-md"><pre className="text-xs whitespace-pre-wrap break-all">{e.request_diagnostic ? JSON.stringify(e.request_diagnostic, null, 2) : "Not captured"}</pre></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></CardContent>
      </Card>
        </div>
      </details>
    </div>
  );
};

export default BiometricAttendance;
