import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authService } from "../services/authService";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterDetails {
  username: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (details: RegisterDetails) => Promise<unknown>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TOKEN_KEY = "orbit_access_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
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
      .then((profile: AuthUser) => {
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

  const login = useCallback(async (credentials: LoginCredentials) => {
    const result = await authService.login(credentials);
    localStorage.setItem(TOKEN_KEY, result.access_token);
    setToken(result.access_token);
    try {
      const profile: AuthUser = await authService.me();
      setUser(profile);
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      throw error;
    }
  }, []);

  const register = useCallback((details: RegisterDetails) => authService.register(details), []);

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

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
