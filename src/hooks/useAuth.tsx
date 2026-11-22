import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "user";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);

  // `loading` stays true until BOTH the session and the user's role are known,
  // so admin-only pages never redirect a real admin while the role is loading.
  const [sessionReady, setSessionReady] = useState(false);
  const [roleFor, setRoleFor] = useState<string | null>(null); // user id the role was loaded for

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    setRole((data?.role as AppRole) ?? null);
    setRoleFor(userId);
  };

  useEffect(() => {
    const apply = (session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer role fetch with setTimeout to avoid an auth-callback deadlock
        setTimeout(() => void fetchRole(session.user.id), 0);
      } else {
        setRole(null);
        setRoleFor(null);
      }
      setSessionReady(true);
    };

    // Set up auth state listener FIRST, THEN check for an existing session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    supabase.auth.getSession().then(({ data: { session } }) => apply(session));

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setLoading(!sessionReady || (!!user && roleFor !== user.id));
  }, [sessionReady, user, roleFor]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setRoleFor(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        isAdmin: role === "admin",
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
