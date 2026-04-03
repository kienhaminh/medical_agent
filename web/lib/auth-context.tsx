"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { login as apiLogin, getMe, type AuthUser } from "@/lib/api";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

const TOKEN_KEY = "medinexus_token";
const USER_KEY = "medinexus_user";

/** Public routes that don't require authentication. */
const PUBLIC_ROUTES = ["/", "/intake", "/login", "/track"];

/** Routes that are restricted to specific roles only. Checked before general role routes. */
const ADMIN_ONLY_ROUTES = ["/agent/usage", "/agent/settings"];

/** Role-based route access. Each role lists the route prefixes it can access. */
const ROLE_ROUTES: Record<string, string[]> = {
  doctor: ["/doctor", "/patient", "/agent"],
  admin: ["/admin", "/patient", "/agent", "/operations", "/design-system"],
};

export function canAccessRoute(role: string | undefined, pathname: string): boolean {
  if (!role) return false;
  if (ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r))) return role === "admin";
  const allowed = ROLE_ROUTES[role];
  if (!allowed) return false;
  return allowed.some((prefix) => pathname.startsWith(prefix));
}

/** Get the default redirect path for a role after login. */
export function getDefaultRoute(role: string): string {
  switch (role) {
    case "doctor":
      return "/doctor";
    case "admin":
      return "/agent";
    default:
      return "/login";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as AuthUser;
        setToken(savedToken);
        setUser(parsedUser);

        // Validate token is still valid
        getMe(savedToken)
          .then((freshUser) => {
            setUser(freshUser);
            localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
          })
          .catch(() => {
            // Token expired
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            setToken(null);
            setUser(null);
          })
          .finally(() => setLoading(false));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  // Route protection
  useEffect(() => {
    if (loading) return;

    const isPublic = PUBLIC_ROUTES.some(
      (route) => pathname === route || (route !== "/" && pathname.startsWith(route))
    );

    if (isPublic) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!canAccessRoute(user.role, pathname)) {
      router.replace(getDefaultRoute(user.role));
    }
  }, [user, loading, pathname, router]);

  const handleLogin = useCallback(
    async (username: string, password: string) => {
      const response = await apiLogin(username, password);
      setToken(response.token);
      setUser(response.user);
      localStorage.setItem(TOKEN_KEY, response.token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      router.push(getDefaultRoute(response.user.role));
    },
    [router]
  );

  const handleLogout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    router.push("/login");
  }, [router]);

  // Block rendering protected routes while unauthenticated
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || (route !== "/" && pathname.startsWith(route))
  );
  const shouldBlock = !loading && !isPublic && !user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login: handleLogin,
        logout: handleLogout,
      }}
    >
      {loading ? (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : shouldBlock ? null : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
