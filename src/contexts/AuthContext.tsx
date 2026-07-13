import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  googleProfile: { name: string; email: string; picture?: string } | null;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [googleProfile, setGoogleProfile] = useState<{ name: string; email: string; picture?: string } | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer role fetch to avoid blocking the auth callback
        setTimeout(() => {
          checkAdmin(newSession.user.id);
        }, 0);
      } else {
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        checkAdmin(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const checkAdmin = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) {
      setIsAdmin(false);
      return;
    }
    setIsAdmin(!!data);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setGoogleProfile(null);
  };

  const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return {
        success: false,
        error: "Google OAuth no configurado. Contacta al administrador o sigue los pasos en GOOGLE_OAUTH_SETUP.md.",
      };
    }
    // Full implementation activates once VITE_GOOGLE_CLIENT_ID is set
    // and Supabase Google provider is enabled in the dashboard.
    return { success: false, error: "Google OAuth pendiente de activación." };
  };

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, loading, signOut, googleProfile, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
