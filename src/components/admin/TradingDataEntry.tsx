import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [tradeDate, setTradeDate] = useState("");
  const [netPnl, setNetPnl] = useState("");
  const [sharesTraded, setSharesTraded] = useState("");
  const [isHoliday, setIsHoliday] = useState(false);
  const [lateRemarks, setLateRemarks] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get accounts for selected trader
  const traderAccounts = useMemo(() => {
    if (!selectedTrader) return [];
    return accounts.filter((a) => a.user_id === selectedTrader);
  }, [selectedTrader, accounts]);

  const handleTraderChange = (userId: string) => {
    setSelectedTrader(userId);
    setSelectedAccounts([]); // Reset account selection when trader changes
  };

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleSelectAllAccounts = () => {
    if (selectedAccounts.length === traderAccounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(traderAccounts.map((a) => a.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTrader || selectedAccounts.length === 0 || !tradeDate) {
      toast({ title: "Error", description: "Please select trader, account(s), and date", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert trading data for each selected account
      const insertPromises = selectedAccounts.map((accountId) =>
        supabase.from("trading_data").insert({
          user_id: selectedTrader,
          account_id: accountId,
          trade_date: tradeDate,
          net_pnl: parseFloat(netPnl) || 0,
          shares_traded: parseInt(sharesTraded) || 0,
          is_holiday: isHoliday,
          late_remarks: lateRemarks || null,
          notes: notes || null,
        })
      );

      const results = await Promise.all(insertPromises);
      const errors = results.filter((r) => r.error);

      if (errors.length > 0) {
        throw new Error(errors[0].error?.message || "Failed to insert data");
      }

      toast({ 
        title: "Success", 
        description: `Trading data added for ${selectedAccounts.length} account(s)` 
      });

      // Reset form
      setSelectedAccounts([]);
      setTradeDate("");
      setNetPnl("");
      setSharesTraded("");
      setIsHoliday(false);
      setLateRemarks("");
      setNotes("");
      onRefresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setIsSubmitting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Trading Data (Multi-Account)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Trader Selection */}
          <div className="space-y-2">
            <Label>Select Trader (Person)</Label>
            <Select value={selectedTrader} onValueChange={handleTraderChange}>
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

          {/* Account Selection (appears after trader is selected) */}
          {selectedTrader && traderAccounts.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Select Account(s)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllAccounts}
                >
                  {selectedAccounts.length === traderAccounts.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                {traderAccounts.map((acc) => (
                  <div key={acc.id} className="flex items-center gap-3">
                    <Checkbox
                      id={acc.id}
                      checked={selectedAccounts.includes(acc.id)}
                      onCheckedChange={() => handleAccountToggle(acc.id)}
                    />
                    <label htmlFor={acc.id} className="cursor-pointer flex-1">
                      <span className="font-medium">{acc.account_name}</span>
                      {acc.account_number && (
                        <span className="text-muted-foreground ml-2">({acc.account_number})</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTrader && traderAccounts.length === 0 && (
            <p className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30">
              No accounts found for this trader. Please add accounts first.
            </p>
          )}

          {/* Trade Date */}
          <div className="space-y-2">
            <Label>Trade Date</Label>
            <Input
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
            />
          </div>

          {/* P&L and Shares */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Net P&L ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={netPnl}
                onChange={(e) => setNetPnl(e.target.value)}
                placeholder="e.g., 1500.50"
              />
            </div>
            <div className="space-y-2">
              <Label>Shares Traded</Label>
              <Input
                type="number"
                value={sharesTraded}
                onChange={(e) => setSharesTraded(e.target.value)}
                placeholder="e.g., 5000"
              />
            </div>
          </div>

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
              rows={3}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || selectedAccounts.length === 0}
          >
            {isSubmitting 
              ? "Adding..." 
              : `Add Entry for ${selectedAccounts.length} Account(s)`
            }
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default TradingDataEntry;
