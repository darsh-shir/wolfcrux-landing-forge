import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface TradingAccount {
  id: string;
  user_id: string;
  account_name: string;
  account_number: string | null;
}

interface TradingDataEntryProps {
  users: Profile[];
  accounts: TradingAccount[];
  onRefresh: () => void;
  onTraderChange?: (traderId: string) => void;
}

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "half_day", label: "Half Day" },
  { value: "holiday", label: "Holiday" },
  { value: "absent", label: "Absent" },
];

// Searchable trader combobox component
const TraderCombobox = ({
  users,
  value,
  onValueChange,
  disabledUserId,
  placeholder,
}: {
  users: Profile[];
  value: string;
  onValueChange: (val: string) => void;
  disabledUserId?: string;
  placeholder: string;
}) => {
  const [open, setOpen] = useState(false);
  const selectedUser = users.find((u) => u.user_id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedUser ? selectedUser.full_name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search trader..." />
          <CommandList>
            <CommandEmpty>No trader found.</CommandEmpty>
            <CommandGroup>
              {users.map((u) => (
                <CommandItem
                  key={u.user_id}
                  value={u.full_name}
                  disabled={u.user_id === disabledUserId}
                  onSelect={() => {
                    onValueChange(u.user_id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === u.user_id ? "opacity-100" : "opacity-0")}
                  />
                  {u.full_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

interface TraderConfigData {
  seat_type: string;
  partner_id: string | null;
  partner_percentage: number;
  payout_percentage: number;
}

const TradingDataEntry = ({ users, accounts, onRefresh, onTraderChange }: TradingDataEntryProps) => {
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];

  const [trader1, setTrader1Raw] = useState("");
  const setTrader1 = (value: string) => {
    setTrader1Raw(value);
    onTraderChange?.(value);
  };
  const [trader2, setTrader2] = useState("");
  const [tradeDate, setTradeDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [trader1Attendance, setTrader1Attendance] = useState("present");
  const [trader2Attendance, setTrader2Attendance] = useState("present");
  const [trader2Role, setTrader2Role] = useState<"partner" | "trainee">("partner");
  const [existingEntryWarning, setExistingEntryWarning] = useState("");

  const [account1, setAccount1] = useState("");
  const [netPnl1, setNetPnl1] = useState("");
  const [sharesTraded1, setSharesTraded1] = useState("");

  const [account2, setAccount2] = useState("");
  const [netPnl2, setNetPnl2] = useState("");
  const [sharesTraded2, setSharesTraded2] = useState("");

  const [traderConfig, setTraderConfig] = useState<TraderConfigData | null>(null);

  // When trader1 is selected, auto-fill trader2, accounts, and fetch config
  useEffect(() => {
    if (!trader1) {
      setTraderConfig(null);
      return;
    }
    const fetchData = async () => {
      // Fetch last entries and config in parallel
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const [entriesRes, configRes] = await Promise.all([
        supabase
          .from("trading_data")
          .select("account_id, trader2_id, trade_date")
          .eq("user_id", trader1)
          .order("trade_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(2),
        supabase
          .from("trader_config")
          .select("seat_type, partner_id, partner_percentage, payout_percentage")
          .eq("user_id", trader1)
          .eq("month", currentMonth)
          .eq("year", currentYear)
          .maybeSingle(),
      ]);

      // Set config
      if (configRes.data) {
        setTraderConfig(configRes.data);
        if (configRes.data.partner_id) {
          setTrader2(configRes.data.partner_id);
        }
        // Auto-set role from config
        if (configRes.data.seat_type === "With Trainee") {
          setTrader2Role("trainee");
        } else if (configRes.data.seat_type === "With Partner") {
          setTrader2Role("partner");
        }
      } else {
        setTraderConfig(null);
      }

      // Auto-fill accounts from last entry
      if (entriesRes.data && entriesRes.data.length > 0) {
        const data = entriesRes.data;
        // If no config partner, use last entry's trader2
        if (!configRes.data?.partner_id && data[0].trader2_id) {
          setTrader2(data[0].trader2_id);
        }

        const lastDate = data[0].trade_date;
        const lastDateEntries = data.filter((d) => d.trade_date === lastDate);
        
        if (lastDateEntries.length >= 1) {
          setAccount1(lastDateEntries[0].account_id);
        }
        if (lastDateEntries.length >= 2) {
          setAccount2(lastDateEntries[1].account_id);
        }
      }
    };
    fetchData();
  }, [trader1]);

  // Check for duplicate entries when trader1, trader2, or date changes
  useEffect(() => {
    setExistingEntryWarning("");
    if (!trader1 || !tradeDate) return;
    const checkDuplicates = async () => {
      const { data } = await supabase
        .from("trading_data")
        .select("id, user_id, trader2_id")
        .eq("trade_date", tradeDate)
        .eq("user_id", trader1);
      if (data && data.length > 0) {
        setExistingEntryWarning(`Trader 1 already has ${data.length} entry(ies) on this date.`);
        return;
      }
      // Also check if trader2 is already used as trader1 or trader2 on this date
      if (trader2 && trader2 !== "none") {
        const { data: t2Data } = await supabase
          .from("trading_data")
          .select("id")
          .eq("trade_date", tradeDate)
          .or(`user_id.eq.${trader2},trader2_id.eq.${trader2}`);
        if (t2Data && t2Data.length > 0) {
          setExistingEntryWarning(`Trader 2 is already assigned to another entry on this date.`);
        }
      }
    };
    checkDuplicates();
  }, [trader1, trader2, tradeDate]);

  const getSeatLabel = () => {
    if (!traderConfig) return null;
    const { seat_type, payout_percentage, partner_percentage } = traderConfig;
    if (seat_type === "With Trainee") {
      return { label: "With Trainee", color: "text-blue-600 bg-blue-50", detail: `Trader gets ${payout_percentage}% | Trainee gets ${partner_percentage}% (25% of payout)` };
    }
    if (seat_type === "With Partner") {
      return { label: "With Partner", color: "text-purple-600 bg-purple-50", detail: `Trader gets ${payout_percentage}% | Partner gets ${partner_percentage}% (50% split)` };
    }
    return { label: "Alone", color: "text-muted-foreground bg-muted", detail: `Payout: ${payout_percentage}%` };
  };

  const seatInfo = getSeatLabel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!trader1 || !tradeDate) {
      toast({ title: "Error", description: "Please select at least Trader 1 and date", variant: "destructive" });
      return;
    }

    if (!account1 && !account2) {
      toast({ title: "Error", description: "Please select at least one account", variant: "destructive" });
      return;
    }

    if (account1 && account2 && account1 === account2) {
      toast({ title: "Error", description: "Please select two different accounts", variant: "destructive" });
      return;
    }

    if (trader1 && trader2 && trader2 !== "none" && trader1 === trader2) {
      toast({ title: "Error", description: "Please select two different traders", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const entries: any[] = [];

      if (account1) {
        entries.push({
          user_id: trader1,
          trader2_id: trader2 && trader2 !== "none" ? trader2 : null,
          trader2_role: trader2 && trader2 !== "none" ? trader2Role : null,
          account_id: account1,
          trade_date: tradeDate,
          net_pnl: parseFloat(netPnl1) || 0,
          shares_traded: parseInt(sharesTraded1) || 0,
          is_holiday: trader1Attendance === "holiday",
          trader1_attendance: trader1Attendance,
          trader2_attendance: trader2 && trader2 !== "none" ? trader2Attendance : "present",
          notes: notes || null,
        });
      }

      if (account2) {
        entries.push({
          user_id: trader1,
          trader2_id: trader2 && trader2 !== "none" ? trader2 : null,
          trader2_role: trader2 && trader2 !== "none" ? trader2Role : null,
          account_id: account2,
          trade_date: tradeDate,
          net_pnl: parseFloat(netPnl2) || 0,
          shares_traded: parseInt(sharesTraded2) || 0,
          is_holiday: trader1Attendance === "holiday",
          trader1_attendance: trader1Attendance,
          trader2_attendance: trader2 && trader2 !== "none" ? trader2Attendance : "present",
          notes: notes || null,
        });
      }

      const { error } = await supabase.from("trading_data").insert(entries);
      if (error) throw error;

      toast({ title: "Success", description: `Trading data added for ${entries.length} account(s)` });

      setNetPnl1(""); setSharesTraded1("");
      setNetPnl2(""); setSharesTraded2("");
      setNotes("");
      setTrader1Attendance("present"); setTrader2Attendance("present");
      onRefresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setIsSubmitting(false);
  };

  const calculateSummary = () => {
    const pnl1 = parseFloat(netPnl1) || 0;
    const pnl2 = parseFloat(netPnl2) || 0;
    const shares1 = parseInt(sharesTraded1) || 0;
    const shares2 = parseInt(sharesTraded2) || 0;
    const totalPnl = pnl1 + pnl2;
    const totalShares = shares1 + shares2;
    const brokerage = (totalShares / 1000) * 14;
    const netAfterBrokerage = totalPnl - brokerage;
    return { totalPnl, totalShares, brokerage, netAfterBrokerage };
  };

  const summary = calculateSummary();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Trading Data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Trade Date */}
          <div className="space-y-2">
            <Label>Trade Date</Label>
            <Input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
          </div>

          {/* Trader 1 Selection - Searchable */}
          <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
            <Label className="text-base font-semibold">Trader 1 (Primary)</Label>
            <TraderCombobox
              users={users}
              value={trader1}
              onValueChange={setTrader1}
              disabledUserId={trader2 !== "none" ? trader2 : undefined}
              placeholder="Select Trader 1"
            />
            <div className="space-y-1">
              <Label className="text-sm">Attendance</Label>
              <Select value={trader1Attendance} onValueChange={setTrader1Attendance}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Trader 2 Selection - Searchable */}
          <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-base font-semibold">
                Trader 2 {traderConfig?.seat_type === "With Trainee" ? "(Trainee)" : traderConfig?.seat_type === "With Partner" ? "(Partner)" : "(Optional)"}
              </Label>
              {seatInfo && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${seatInfo.color}`}>
                  {seatInfo.label}
                </span>
              )}
            </div>
            {seatInfo && (
              <p className="text-xs text-muted-foreground">{seatInfo.detail}</p>
            )}
            <div className="flex gap-2">
              <div className="flex-1">
                <TraderCombobox
                  users={users}
                  value={trader2 === "none" ? "" : trader2}
                  onValueChange={setTrader2}
                  disabledUserId={trader1}
                  placeholder={traderConfig?.seat_type === "With Trainee" ? "Select Trainee" : traderConfig?.seat_type === "With Partner" ? "Select Partner" : "Select Trader 2"}
                />
              </div>
              {trader2 && trader2 !== "none" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTrader2("none")}
                  className="shrink-0"
                >
                  Clear
                </Button>
              )}
            </div>
            {trader2 && trader2 !== "none" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-sm">Role</Label>
                  <RadioGroup value={trader2Role} onValueChange={(v) => setTrader2Role(v as "partner" | "trainee")} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="partner" id="role-partner" />
                      <Label htmlFor="role-partner" className="text-sm font-normal cursor-pointer">Partner (50% split)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="trainee" id="role-trainee" />
                      <Label htmlFor="role-trainee" className="text-sm font-normal cursor-pointer">Trainee (25% of payout)</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Attendance</Label>
                  <Select value={trader2Attendance} onValueChange={setTrader2Attendance}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Account 1 Entry */}
          <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <Label className="text-base font-semibold">Account 1</Label>
            <Select value={account1} onValueChange={setAccount1}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id} disabled={acc.id === account2}>
                    {acc.account_name} {acc.account_number ? `(${acc.account_number})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Net P&L ($)</Label>
                <Input type="number" step="0.01" value={netPnl1} onChange={(e) => setNetPnl1(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Shares Traded</Label>
                <Input type="number" value={sharesTraded1} onChange={(e) => setSharesTraded1(e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Account 2 Entry */}
          <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <Label className="text-base font-semibold">Account 2 (Optional)</Label>
            <Select value={account2} onValueChange={setAccount2}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id} disabled={acc.id === account1}>
                    {acc.account_name} {acc.account_number ? `(${acc.account_number})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Net P&L ($)</Label>
                <Input type="number" step="0.01" value={netPnl2} onChange={(e) => setNetPnl2(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Shares Traded</Label>
                <Input type="number" value={sharesTraded2} onChange={(e) => setSharesTraded2(e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Summary Box */}
          {(account1 || account2) && (
            <div className="p-4 border rounded-lg bg-primary/5 space-y-2">
              <Label className="text-base font-semibold">Summary</Label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Combined P&L:</span>
                <span className={`font-medium ${summary.totalPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ${summary.totalPnl.toFixed(2)}
                </span>
                <span className="text-muted-foreground">Total Shares:</span>
                <span className="font-medium">{summary.totalShares.toLocaleString()}</span>
                <span className="text-muted-foreground">Brokerage ($14/1000 shares):</span>
                <span className="font-medium text-orange-600">-${summary.brokerage.toFixed(2)}</span>
                <span className="text-muted-foreground font-semibold">Net After Brokerage:</span>
                <span className={`font-bold ${summary.netAfterBrokerage >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ${summary.netAfterBrokerage.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting || (!account1 && !account2)}>
            {isSubmitting ? "Adding..." : "Submit Trading Data"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default TradingDataEntry;
