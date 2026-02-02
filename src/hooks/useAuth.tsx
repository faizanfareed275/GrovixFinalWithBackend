import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  avatarUrl?: string | null;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const defaultApiUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:4000`
      : "http://localhost:4000";

  const apiUrl = (import.meta as any).env?.VITE_GROVIX_API_URL || defaultApiUrl;

  const fetchMe = async (): Promise<User | null> => {
    try {
      const res = await fetch(`${apiUrl}/auth/me`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.user ?? null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      const me = await fetchMe();
      setUser(me);
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    const onProfileUpdated = async () => {
      const me = await fetchMe();
      if (me) setUser(me);
    };
    window.addEventListener("profile-updated", onProfileUpdated);
    return () => window.removeEventListener("profile-updated", onProfileUpdated);
  }, []);

  const login = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        try {
          const data = await res.json();
          if (data?.error === "invalid_email_or_password") return { error: "Invalid email or password" };
          if (data?.error === "server_misconfigured") return { error: "Server misconfigured" };
        } catch {
        }
        return { error: "Login failed" };
      }

      let nextUser: User | null = null;
      try {
        const data = await res.json();
        nextUser = data?.user ?? null;
      } catch {
      }
      if (!nextUser) nextUser = await fetchMe();
      if (!nextUser) return { error: "Login failed" };
      setUser(nextUser);
      return {};
    } catch {
      return { error: "Login failed" };
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<{ error?: string }> => {
    try {
      const res = await fetch(`${apiUrl}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, name }),
      });

      if (res.status === 409) {
        return { error: "User already exists with this email" };
      }
      if (!res.ok) {
        try {
          const data = await res.json();
          if (data?.error === "email_already_exists") return { error: "User already exists with this email" };
          if (data?.error === "invalid_request") return { error: "Please check your details and try again" };
          if (data?.error === "server_misconfigured") return { error: "Server misconfigured" };
        } catch {
        }
        return { error: "Signup failed" };
      }

      let nextUser: User | null = null;
      try {
        const data = await res.json();
        nextUser = data?.user ?? null;
      } catch {
      }
      if (!nextUser) nextUser = await fetchMe();
      if (!nextUser) return { error: "Signup failed" };
      setUser(nextUser);
      return {};
    } catch {
      return { error: "Signup failed" };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
    }

    try {
      localStorage.removeItem("youthxp_user");
    } catch {
    }

    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
