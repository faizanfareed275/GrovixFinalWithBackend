type StoredUser = {
  id: string;
  email: string;
  name: string;
  role?: string;
  isAdmin?: boolean;
};

type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatar: string;
};

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem("youthxp_user");
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isAdminUser(): boolean {
  const current = getCurrentUser();
  if (!current?.email) return false;

  const normalizedEmail = current.email.trim().toLowerCase();
  if (normalizedEmail === "admin@grovix.com") return true;

  try {
    const usersRaw = localStorage.getItem("youthxp_users");
    const users = usersRaw ? (JSON.parse(usersRaw) as StoredUser[]) : [];
    const found = users.find(u => (u.email || "").trim().toLowerCase() === normalizedEmail);
    if (!found) return false;
    if (found.isAdmin) return true;
    if ((found.role || "").toLowerCase() === "admin") return true;
    return false;
  } catch {
    return false;
  }
}
