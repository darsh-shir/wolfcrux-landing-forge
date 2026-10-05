import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

const FUNCTION_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/adms-attendance`;

const WORKER_CODE = `// Cloudflare Worker for attendance.wolfcrux.com
// Relays the K90 Pro's ADMS calls (/iclock/...) to the Wolfcrux backend.
const TARGET = "${FUNCTION_URL}";
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!url.pathname.toLowerCase().startsWith("/iclock/")) return new Response("Not found", { status: 404 });
    const init = { method: request.method, headers: { "Content-Type": request.headers.get("Content-Type") || "text/plain" } };
    if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.text();
    const res = await fetch(TARGET + url.pathname + url.search, init);
    return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "text/plain" } });
  },
};`;

type Device = { id: string; device_serial_number: string; device_name: string; location: string | null; is_active: boolean; last_seen_at: string | null; last_punch_at: string | null };
type Punch = { id: string; biometric_pin: string; employee_id: string | null; punch_timestamp: string; received_at: string; device_serial_number: string; verify_mode: string | null; in_out_status: string | null };
type Evt = { id: string; device_serial_number: string | null; event_type: string; created_at: string; records_received: number; records_accepted: number; records_duplicate: number; records_unmatched: number; records_malformed: number; payload_excerpt: string | null; error: string | null };
type Shift = { id: string; effective_from: string; shift_start: string; grace_minutes: number; half_day_min_hours: number; notes: string | null };
type Prof = { user_id: string; full_name: string; biometric_pin: string | null };

const BiometricAttendance = () => {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [events, setEvents] = useState<Evt[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [profiles, setProfiles] = useState<Prof[]>([]);
  const [newDev, setNewDev] = useState({ name: "", sn: "", location: "", active: true });
  const [newShift, setNewShift] = useState({ from: todayIST(), start: "13:15", grace: "0", half: "4", notes: "" });
  const [mapSel, setMapSel] = useState<Record<string, string>>({});
  const [testPayload, setTestPayload] = useState("1001\t2026-10-01 09:02:15\t1\t0\t0");
  const [testResult, setTestResult] = useState<string>("");

  const load = async () => {
    const [d, p, e, s, pr] = await Promise.all([
      supabase.from("attendance_devices").select("*").order("created_at"),
      supabase.from("biometric_attendance_logs").select("id,biometric_pin,employee_id,punch_timestamp,received_at,device_serial_number,verify_mode,in_out_status").order("received_at", { ascending: false }).limit(500),
      supabase.from("adms_device_events").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("attendance_shift_settings").select("*").order("effective_from", { ascending: false }),
      supabase.from("profiles").select("user_id,full_name,biometric_pin").order("full_name"),
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
    toast({ title: "Biometric PIN saved" }); load();
  };

  const addShift = async () => {
    const { error } = await supabase.from("attendance_shift_settings").upsert({
      effective_from: newShift.from, shift_start: newShift.start, grace_minutes: Number(newShift.grace) || 0,
      half_day_min_hours: Number(newShift.half) || 4, notes: newShift.notes || null,
    }, { onConflict: "effective_from" });
    if (error) return toast({ title: "Could not save", description: error.message, variant: "destructive" });
    const { data: n } = await supabase.rpc("recompute_biometric_range", { _from: newShift.from, _to: today });
    toast({ title: "Shift timing saved", description: `${n ?? 0} day(s) recalculated` }); load();
  };
  const delShift = async (s: Shift) => { await supabase.from("attendance_shift_settings").delete().eq("id", s.id); load(); };

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
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast({ title: "Copied" }); };

  return (
    <div className="space-y-6">
      {/* Debug / status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-['Space_Grotesk']"><Activity className="h-5 w-5" />Biometric Device Status</CardTitle>
            <CardDescription>Live view of the fingerprint machine connection (Mumbai time)</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[
            ["Last heartbeat", fmt(lastHeartbeat?.created_at)],
            ["Last device serial", lastHeartbeat?.device_serial_number || events[0]?.device_serial_number || "—"],
            ["Last upload", lastUpload ? `${fmt(lastUpload.created_at)} · ${lastUpload.records_accepted} new / ${lastUpload.records_duplicate} dup` : "—"],
            ["Punches today", String(todayCount)],
            ["Last matched punch", lastGoodPunch ? `${nameOf.get(lastGoodPunch.employee_id!) ?? "?"} · ${fmt(lastGoodPunch.punch_timestamp)}` : "—"],
            ["Unknown PINs", String(unknown.length)],
            ["Last error", lastError ? `${lastError.error} (${fmt(lastError.created_at)})` : "None"],
            ["Endpoint", events.length ? "Receiving" : "Waiting for device"],
          ].map(([k, v]) => (
            <div key={k} className="p-3 rounded-lg border bg-muted/30"><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium break-words">{v}</p></div>
          ))}
          {lastUpload?.payload_excerpt && (
            <div className="col-span-2 md:col-span-4"><p className="text-xs text-muted-foreground mb-1">Last received payload</p>
              <pre className="text-xs p-2 rounded bg-muted overflow-x-auto max-h-32">{lastUpload.payload_excerpt}</pre></div>
          )}
        </CardContent>
      </Card>

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

      {/* Unknown PINs */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 font-['Space_Grotesk']"><UserX className="h-5 w-5" />Unknown biometric PIN</CardTitle>
          <CardDescription>Punches are kept. Assign the PIN to an employee and their past punches are attached automatically.</CardDescription></CardHeader>
        <CardContent>
          {unknown.length === 0 ? <p className="text-sm text-muted-foreground">All punches are matched.</p> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>PIN</TableHead><TableHead>Device</TableHead><TableHead>Last punch</TableHead><TableHead>Received</TableHead><TableHead>Punches</TableHead><TableHead>Map to employee</TableHead></TableRow></TableHeader>
              <TableBody>{unknown.map((u) => (
                <TableRow key={u.pin}>
                  <TableCell className="font-mono">{u.pin}</TableCell>
                  <TableCell className="font-mono text-xs">{u.last.device_serial_number}</TableCell>
                  <TableCell className="text-xs">{fmt(u.last.punch_timestamp)}</TableCell>
                  <TableCell className="text-xs">{fmt(u.last.received_at)}</TableCell>
                  <TableCell>{u.count}</TableCell>
                  <TableCell className="flex gap-2">
                    <Select value={mapSel[u.pin] ?? ""} onValueChange={(v) => setMapSel({ ...mapSel, [u.pin]: v })}>
                      <SelectTrigger className="w-48"><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>{profiles.filter((p) => !p.biometric_pin).map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" disabled={!mapSel[u.pin]} onClick={() => setPin(mapSel[u.pin], u.pin)}>Map</Button>
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>

      {/* Employee PINs */}
      <Card>
        <CardHeader><CardTitle className="font-['Space_Grotesk']">Employee Biometric PINs</CardTitle>
          <CardDescription>Enter the same User ID that the employee was enrolled with on the machine.</CardDescription></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-2">
          {profiles.map((p) => (
            <form key={p.user_id} className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setPin(p.user_id, (new FormData(e.currentTarget).get("pin") as string) ?? ""); }}>
              <span className="flex-1 truncate text-sm">{p.full_name}</span>
              <Input name="pin" defaultValue={p.biometric_pin ?? ""} placeholder="PIN" className="w-28 font-mono" />
              <Button size="sm" variant="outline" type="submit">Save</Button>
            </form>
          ))}
        </CardContent>
      </Card>

      {/* Shift timing */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 font-['Space_Grotesk']"><Clock className="h-5 w-5" />Shift Timing (IST)</CardTitle>
          <CardDescription>Add a new row whenever the start time changes (e.g. daylight saving). Each rule applies from its date until the next one. Late = first punch after start + grace. Half day = worked less than the minimum hours (needs IN and OUT punch). Manual entries are never overwritten.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-6 gap-2 items-end">
            <div><Label>Effective from</Label><Input type="date" value={newShift.from} onChange={(e) => setNewShift({ ...newShift, from: e.target.value })} /></div>
            <div><Label>Shift start</Label><Input type="time" value={newShift.start} onChange={(e) => setNewShift({ ...newShift, start: e.target.value })} /></div>
            <div><Label>Grace (min)</Label><Input type="number" value={newShift.grace} onChange={(e) => setNewShift({ ...newShift, grace: e.target.value })} /></div>
            <div><Label>Half-day below (hrs)</Label><Input type="number" step="0.5" value={newShift.half} onChange={(e) => setNewShift({ ...newShift, half: e.target.value })} /></div>
            <div><Label>Note</Label><Input value={newShift.notes} onChange={(e) => setNewShift({ ...newShift, notes: e.target.value })} placeholder="DST" /></div>
            <Button onClick={addShift}>Save rule</Button>
          </div>
          {shifts.length === 0 && <p className="text-sm text-destructive">No shift rule yet — punches are stored but Late/Half Day won't be auto-marked until you add one.</p>}
          <div className="flex flex-wrap gap-2">{shifts.map((s) => (
            <Badge key={s.id} variant="outline" className="gap-2 py-1">
              From {s.effective_from}: {s.shift_start.slice(0, 5)} +{s.grace_minutes}m, half &lt;{s.half_day_min_hours}h {s.notes ? `(${s.notes})` : ""}
              <button onClick={() => delShift(s)} aria-label="Delete rule"><Trash2 className="h-3 w-3" /></button>
            </Badge>
          ))}</div>
        </CardContent>
      </Card>

      {/* Device configuration */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 font-['Space_Grotesk']"><Server className="h-5 w-5" />Device Configuration</CardTitle>
          <CardDescription>Settings to enter on the K90 Pro once the attendance.wolfcrux.com relay is live.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid md:grid-cols-2 gap-2">
            {[
              ["Server Mode", "ADMS"], ["Enable Domain Name", "ON"], ["Server Address", "attendance.wolfcrux.com"],
              ["Server Port", "80 (HTTP) — or 443 if the firmware offers HTTPS"], ["Server Path (fixed by device)", "/iclock/cdata"],
              ["Enable Proxy Server", "OFF"], ["Device Serial Number", devices.map((d) => d.device_serial_number).join(", ") || "Register it above"],
              ["Backend endpoint (relay target)", FUNCTION_URL],
            ].map(([k, v]) => (
              <div key={k} className="p-2 rounded border flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="font-mono text-xs text-right break-all">{v}</span></div>
            ))}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1"><p className="text-xs text-muted-foreground">Cloudflare Worker code for attendance.wolfcrux.com</p>
              <Button size="sm" variant="ghost" onClick={() => copy(WORKER_CODE)}><Copy className="h-4 w-4 mr-1" />Copy</Button></div>
            <pre className="text-xs p-3 rounded bg-muted overflow-x-auto max-h-64">{WORKER_CODE}</pre>
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

      {/* Event log */}
      <Card>
        <CardHeader><CardTitle className="font-['Space_Grotesk']">Device Event Log</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto"><Table>
          <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Serial</TableHead><TableHead>Event</TableHead><TableHead>Recv/New/Dup/Unk/Bad</TableHead><TableHead>Error</TableHead></TableRow></TableHeader>
          <TableBody>{events.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="text-xs whitespace-nowrap">{fmt(e.created_at)}</TableCell>
              <TableCell className="font-mono text-xs">{e.device_serial_number || "—"}</TableCell>
              <TableCell><Badge variant={e.error ? "destructive" : "outline"}>{e.event_type}</Badge></TableCell>
              <TableCell className="text-xs">{e.event_type === "attlog" ? `${e.records_received}/${e.records_accepted}/${e.records_duplicate}/${e.records_unmatched}/${e.records_malformed}` : "—"}</TableCell>
              <TableCell className="text-xs text-destructive">{e.error || ""}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></CardContent>
      </Card>
    </div>
  );
};

export default BiometricAttendance;
