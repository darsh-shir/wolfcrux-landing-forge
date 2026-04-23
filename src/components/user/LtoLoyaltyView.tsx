import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Lock, Unlock, Heart, Sparkles, Award, Shield, Gift, X } from "lucide-react";
import { formatCurrencyINR } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const STORAGE_KEY = "wolfcrux_lto_loyalty_seen";

const LtoLoyaltyView = () => {
  const { user } = useAuth();
  const [ltoHistory, setLtoHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    // Show popup once per session per user
    const key = `${STORAGE_KEY}_${user?.id || "anon"}`;
    if (user && !sessionStorage.getItem(key)) {
      setShowWelcome(true);
      sessionStorage.setItem(key, "1");
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("lto_ledger")
      .select("*")
      .eq("user_id", user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    setLtoHistory(data || []);
    setLoading(false);
  };

  const totalLocked = ltoHistory
    .filter(l => !l.is_released)
    .reduce((s, l) => s + Number(l.lto_amount), 0);
  const totalReleased = ltoHistory
    .filter(l => l.is_released)
    .reduce((s, l) => s + Number(l.lto_amount), 0);
  const readyToRelease = ltoHistory
    .filter(l => !l.is_released && new Date(l.unlock_date) <= new Date())
    .reduce((s, l) => s + Number(l.lto_amount), 0);

  return (
    <>
      {/* Animated Loyalty Welcome Popup */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="max-w-lg p-0 overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-background to-primary/10">
          {/* Floating sparkles background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <Sparkles
                key={i}
                className="absolute h-4 w-4 text-primary/30 animate-pulse"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              />
            ))}
          </div>

          <button
            onClick={() => setShowWelcome(false)}
            className="absolute top-3 right-3 z-20 p-1.5 rounded-full hover:bg-muted/80 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="relative z-10 p-8 text-center space-y-5">
            {/* Animated heart icon */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center animate-scale-in">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <div className="absolute inset-2 bg-primary/30 rounded-full animate-pulse" />
              <div className="relative bg-gradient-to-br from-primary to-primary/70 rounded-full w-16 h-16 flex items-center justify-center shadow-lg shadow-primary/40">
                <Heart className="h-8 w-8 text-primary-foreground fill-current" />
              </div>
            </div>

            <div className="space-y-2 animate-fade-in" style={{ animationDelay: "0.15s", animationFillMode: "both" }}>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] bg-gradient-to-r from-primary via-foreground to-primary bg-clip-text text-transparent">
                A Token of Our Gratitude
              </h2>
              <p className="text-sm text-muted-foreground">
                The Long-Term Obligation (LTO)
              </p>
            </div>

            <p
              className="text-base text-foreground/90 leading-relaxed animate-fade-in px-2"
              style={{ animationDelay: "0.3s", animationFillMode: "both" }}
            >
              Your loyalty isn't just appreciated — it's <span className="font-semibold text-primary">rewarded</span>.
              Every month, a portion of your earnings is set aside in your LTO pool, growing quietly with you.
              It's our way of saying <span className="italic">thank you</span> for choosing to grow with Wolfcrux.
            </p>

            <div className="grid grid-cols-3 gap-3 pt-2 animate-fade-in" style={{ animationDelay: "0.45s", animationFillMode: "both" }}>
              {[
                { icon: Shield, label: "Secured", desc: "For you" },
                { icon: Award, label: "Earned", desc: "Monthly" },
                { icon: Gift, label: "Released", desc: "On time" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-card/60 backdrop-blur border border-border/50 hover-scale"
                >
                  <item.icon className="h-5 w-5 text-primary mx-auto mb-1" />
                  <div className="text-xs font-semibold text-foreground">{item.label}</div>
                  <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                </div>
              ))}
            </div>

            <Button
              onClick={() => setShowWelcome(false)}
              className="w-full mt-2 animate-fade-in bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/30"
              style={{ animationDelay: "0.6s", animationFillMode: "both" }}
              size="lg"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              View My LTO Pool
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* Hero Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Locked in LTO</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrencyINR(totalLocked)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Unlock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Released to You</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrencyINR(totalReleased)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Gift className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ready to Release</p>
                  <p className="text-2xl font-bold text-amber-600">{formatCurrencyINR(readyToRelease)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LTO Lock Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary fill-current" /> Your LTO Lock Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : ltoHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Lock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                No LTO entries yet. Keep going — your loyalty pool will grow with each profitable month.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3">Period</th>
                      <th className="text-right p-3">LTO %</th>
                      <th className="text-right p-3">LTO Amount</th>
                      <th className="text-right p-3">Unlock Date</th>
                      <th className="text-center p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ltoHistory.map((l: any) => {
                      const isUnlocked = new Date(l.unlock_date) <= new Date();
                      return (
                        <tr key={l.id} className="border-t hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-medium">{MONTHS[(l.month || 1) - 1]} {l.year}</td>
                          <td className="p-3 text-right">{l.lto_percentage}%</td>
                          <td className="p-3 text-right font-medium">{formatCurrencyINR(Number(l.lto_amount))}</td>
                          <td className="p-3 text-right text-muted-foreground">{l.unlock_date}</td>
                          <td className="p-3 text-center">
                            <Badge
                              variant={l.is_released ? "default" : isUnlocked ? "outline" : "secondary"}
                              className="text-xs gap-1"
                            >
                              {l.is_released ? <><Unlock className="h-3 w-3" /> Released</> :
                                isUnlocked ? <><Unlock className="h-3 w-3" /> Unlocked</> :
                                  <><Lock className="h-3 w-3" /> Locked</>}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default LtoLoyaltyView;
