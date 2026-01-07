import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

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
}

const TradingDataEntry = ({ users, accounts, onRefresh }: TradingDataEntryProps) => {
  const { toast } = useToast();
  
  const [selectedTrader, setSelectedTrader] = useState("");
  const [tradeDate, setTradeDate] = useState("");
  const [isHoliday, setIsHoliday] = useState(false);
  const [lateRemarks, setLateRemarks] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Account 1 data
  const [account1, setAccount1] = useState("");
  const [netPnl1, setNetPnl1] = useState("");
  const [sharesTraded1, setSharesTraded1] = useState("");

  // Account 2 data
  const [account2, setAccount2] = useState("");
  const [netPnl2, setNetPnl2] = useState("");
  const [sharesTraded2, setSharesTraded2] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTrader || !tradeDate) {
      toast({ title: "Error", description: "Please select trader and date", variant: "destructive" });
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

    setIsSubmitting(true);

    try {
      const entries = [];

      if (account1) {
        entries.push({
          user_id: selectedTrader,
          account_id: account1,
          trade_date: tradeDate,
          net_pnl: parseFloat(netPnl1) || 0,
          shares_traded: parseInt(sharesTraded1) || 0,
          is_holiday: isHoliday,
          late_remarks: lateRemarks || null,
          notes: notes || null,
        });
      }

      if (account2) {
        entries.push({
          user_id: selectedTrader,
          account_id: account2,
          trade_date: tradeDate,
          net_pnl: parseFloat(netPnl2) || 0,
          shares_traded: parseInt(sharesTraded2) || 0,
          is_holiday: isHoliday,
          late_remarks: lateRemarks || null,
          notes: notes || null,
        });
      }

      // Also create trader_account_assignments for tracking
      const assignmentPromises = entries.map((entry) =>
        supabase.from("trader_account_assignments").upsert({
          user_id: entry.user_id,
          account_id: entry.account_id,
          assignment_date: tradeDate,
        }, { onConflict: "user_id,account_id,assignment_date" })
      );

      const { error } = await supabase.from("trading_data").insert(entries);

      if (error) throw error;

      await Promise.all(assignmentPromises);

      toast({ 
        title: "Success", 
        description: `Trading data added for ${entries.length} account(s)` 
      });

      // Reset form
      setAccount1("");
      setNetPnl1("");
      setSharesTraded1("");
      setAccount2("");
      setNetPnl2("");
      setSharesTraded2("");
      setTradeDate("");
      setIsHoliday(false);
      setLateRemarks("");
      setNotes("");
      onRefresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setIsSubmitting(false);
  };

  // Calculate summary
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
          Add Trading Data (Dual Account)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Trader Selection */}
          <div className="space-y-2">
            <Label>Select Trader</Label>
            <Select value={selectedTrader} onValueChange={setSelectedTrader}>
              <SelectTrigger>
                <SelectValue placeholder="Select trader" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trade Date */}
          <div className="space-y-2">
            <Label>Trade Date</Label>
            <Input
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
            />
          </div>

          {/* Account 1 Entry */}
          <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <Label className="text-base font-semibold">Account 1</Label>
            <div className="space-y-2">
              <Label className="text-sm">Account</Label>
              <Select value={account1} onValueChange={setAccount1}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id} disabled={acc.id === account2}>
                      {acc.account_name} {acc.account_number ? `(${acc.account_number})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Net P&L ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={netPnl1}
                  onChange={(e) => setNetPnl1(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Shares Traded</Label>
                <Input
                  type="number"
                  value={sharesTraded1}
                  onChange={(e) => setSharesTraded1(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Account 2 Entry */}
          <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <Label className="text-base font-semibold">Account 2</Label>
            <div className="space-y-2">
              <Label className="text-sm">Account</Label>
              <Select value={account2} onValueChange={setAccount2}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id} disabled={acc.id === account1}>
                      {acc.account_name} {acc.account_number ? `(${acc.account_number})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Net P&L ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={netPnl2}
                  onChange={(e) => setNetPnl2(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Shares Traded</Label>
                <Input
                  type="number"
                  value={sharesTraded2}
                  onChange={(e) => setSharesTraded2(e.target.value)}
                  placeholder="0"
                />
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

          {/* Holiday Toggle */}
          <div className="flex items-center gap-2">
            <Switch checked={isHoliday} onCheckedChange={setIsHoliday} />
            <Label>Holiday (no trading)</Label>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label>Late Remarks</Label>
            <Input
              value={lateRemarks}
              onChange={(e) => setLateRemarks(e.target.value)}
              placeholder="Any late remarks..."
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || (!account1 && !account2)}
          >
            {isSubmitting ? "Adding..." : "Submit Trading Data"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default TradingDataEntry;
