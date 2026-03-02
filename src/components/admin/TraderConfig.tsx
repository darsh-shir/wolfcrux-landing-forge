import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Save, Settings } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface TraderConfigData {
  id?: string;
  user_id: string;
  payout_percentage: number;
  seat_type: string;
  partner_id: string | null;
  partner_percentage: number;
  software_cost: number;
}

interface TraderConfigProps {
  users: Profile[];
}

const SEAT_TYPES = ["Alone", "With Trader", "With Trainee"];

const TraderConfig = ({ users }: TraderConfigProps) => {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<TraderConfigData[]>([]);
  const [editing, setEditing] = useState<Record<string, TraderConfigData>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchConfigs(); }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("trader_config").select("*");
    if (!error && data) setConfigs(data);
    setLoading(false);
  };

  const getConfig = (userId: string): TraderConfigData => {
    return editing[userId] || configs.find(c => c.user_id === userId) || {
      user_id: userId, payout_percentage: 0, seat_type: "Alone",
      partner_id: null, partner_percentage: 0, software_cost: 0,
    };
  };

  const handleChange = (userId: string, field: keyof TraderConfigData, value: any) => {
    setEditing(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || getConfig(userId)), [field]: value },
    }));
  };

  const saveConfig = async (userId: string) => {
    const cfg = getConfig(userId);
    const existing = configs.find(c => c.user_id === userId);

    const payload = {
      user_id: userId,
      payout_percentage: cfg.payout_percentage,
      seat_type: cfg.seat_type,
      partner_id: cfg.partner_id || null,
      partner_percentage: cfg.partner_percentage,
      software_cost: cfg.software_cost,
    };

    if (existing?.id) {
      const { error } = await supabase.from("trader_config").update(payload).eq("id", existing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("trader_config").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }

    toast({ title: "Saved", description: "Trader config saved" });
    setEditing(prev => { const n = { ...prev }; delete n[userId]; return n; });
    fetchConfigs();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Trader Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trader</TableHead>
                <TableHead>Payout %</TableHead>
                <TableHead>Seat Type</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Partner %</TableHead>
                <TableHead>Software Cost ($)</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => {
                const cfg = getConfig(user.user_id);
                return (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>
                      <Input type="number" className="w-20" step="1" value={cfg.payout_percentage || ""}
                        onChange={e => handleChange(user.user_id, "payout_percentage", Number(e.target.value))}
                        placeholder="0" />
                    </TableCell>
                    <TableCell>
                      <Select value={cfg.seat_type} onValueChange={v => handleChange(user.user_id, "seat_type", v)}>
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SEAT_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={cfg.partner_id || "none"} onValueChange={v => handleChange(user.user_id, "partner_id", v === "none" ? null : v)}>
                        <SelectTrigger className="w-[150px]"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {users.filter(u => u.user_id !== user.user_id).map(u => (
                            <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input type="number" className="w-20" step="1" value={cfg.partner_percentage || ""}
                        onChange={e => handleChange(user.user_id, "partner_percentage", Number(e.target.value))}
                        placeholder="0" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" className="w-24" step="0.01" value={cfg.software_cost || ""}
                        onChange={e => handleChange(user.user_id, "software_cost", Number(e.target.value))}
                        placeholder="0" />
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => saveConfig(user.user_id)}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default TraderConfig;
