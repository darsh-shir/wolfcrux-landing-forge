import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

/** Opened from the password-reset email: lets the person choose a new password. */
const ResetPassword = () => {
  usePageMeta({ title: "Set a new password | Wolfcrux Global Markets", path: "/reset-password", noindex: true });
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // The link signs the person in for this purpose; wait for that session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const t = setTimeout(() => setReady((r) => (r === null ? false : r)), 4000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) return setError(err.message);
    toast({ title: "Password changed", description: "You're signed in with your new password." });
    navigate("/my-data", { replace: true });
  };

  return (
    <>
      <Navigation />
      <div id="main-content" className="min-h-screen flex items-center justify-center px-4 pt-24 pb-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl sm:text-2xl font-['Space_Grotesk']">Set a new password</CardTitle>
            <CardDescription className="font-['Inter'] text-sm">
              {ready === false
                ? "This link has expired or was already used. Request a new one from the login page."
                : "Choose a new password for your account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ready === false ? (
              <Button className="w-full" onClick={() => navigate("/auth")}>Back to login</Button>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={saving || !ready}>
                  {saving ? "Saving…" : ready ? "Save new password" : "Checking link…"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </>
  );
};

export default ResetPassword;
