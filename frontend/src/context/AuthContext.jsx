import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);
const TOKEN_KEY = "orbit_access_token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const oauthParams = new URLSearchParams(window.location.hash.slice(1));
    const oauthToken = oauthParams.get("access_token");
    if (oauthParams.has("access_token") || oauthParams.has("oauth_error")) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    const savedToken = oauthToken || localStorage.getItem(TOKEN_KEY);

    if (!savedToken) {
      setLoading(false);
      return () => { active = false; };
    }
    if (oauthToken) localStorage.setItem(TOKEN_KEY, oauthToken);
    setToken(savedToken);

    authService.me()
      .then((profile) => {
        if (active) setUser(profile);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        if (active) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const login = useCallback(async (credentials) => {
    const result = await authService.login(credentials);
    localStorage.setItem(TOKEN_KEY, result.access_token);
    setToken(result.access_token);
    try {
      const profile = await authService.me();
      setUser(profile);
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      throw error;
    }
  }, []);

  const register = useCallback((details) => authService.register(details), []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ token, user, loading, login, register, logout }), [
    token, user, loading, login, register, logout
  ]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
