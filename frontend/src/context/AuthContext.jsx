import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch role + profile info from our own tables and merge into one session object
  const buildSession = async (authUser) => {
    if (!authUser) return null;

    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("first_name, last_name, email, phone, nic")
        .eq("user_id", authUser.id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser.id)
        .maybeSingle(),
    ]);

    return {
      id: authUser.id,
      email: authUser.email,
      firstName: profile?.first_name || "",
      lastName: profile?.last_name || "",
      phone: profile?.phone || "",
      nic: profile?.nic || "",
      role: roleRow?.role || "user",
    };
  };

  useEffect(() => {
    // Load existing session on first mount
    supabase.auth.getSession().then(async ({ data: { session: authSession } }) => {
      const merged = await buildSession(authSession?.user ?? null);
      setSession(merged);
      setLoading(false);
    });

    // React to login/logout/token refresh in real time
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, authSession) => {
      const merged = await buildSession(authSession?.user ?? null);
      setSession(merged);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  

  // Single login path for everyone — admin vs citizen is decided by user_roles, not by the form
  const loginWithPassword = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const merged = await buildSession(data.user);
    setSession(merged);
    return merged;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const value = useMemo(
    () => ({ session, loading, loginWithPassword, logout }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}