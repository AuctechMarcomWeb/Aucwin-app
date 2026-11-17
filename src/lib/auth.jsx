import { createContext, useContext, useEffect, useState } from "react";
import { loadToken, onTokenChange, setToken } from "./http";
import { getMe, login } from "./api";
import { registerForPushNotifications, unregisterPush } from "./notifications";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile() {
    try {
      setProfile(await getMe());
    } catch (e) {
      if (e.status === 403 && e.code === "inactive") setProfile((p) => ({ ...(p || {}), is_active: false }));
      else if (e.status === 401) await setToken(null);
      // offline: keep whatever we had; cached screens still work
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const t = await loadToken();
      if (t) {
        setSession({ token: t });
        await loadProfile();
        registerForPushNotifications().catch(() => {});
      }
      if (mounted) setLoading(false);
    })();
    const off = onTokenChange((t) => {
      setSession(t ? { token: t } : null);
      if (!t) setProfile(null);
    });
    return () => { mounted = false; off(); };
  }, []);

  return (
    <Ctx.Provider value={{
      session, profile, loading,
      isAdmin: profile?.role === "admin" || profile?.role === "super_admin",
      async signIn(email, password) {
        try {
          const res = await login(email, password);
          setProfile(res.user);
          await setToken(res.token);
          registerForPushNotifications().catch(() => {});
          return null;
        } catch (e) {
          return e.message || "Sign-in failed";
        }
      },
      async signOut() {
        await unregisterPush().catch(() => {});
        await setToken(null);
        setProfile(null);
      },
      async refreshProfile() { if (session) await loadProfile(); },
    }}>{children}</Ctx.Provider>
  );
}
export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
