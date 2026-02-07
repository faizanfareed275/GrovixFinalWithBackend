import { useEffect, useMemo, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type DbUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  xp: number;
  isBanned: boolean;
  bannedUntil: string | null;
  createdAt: string;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<DbUserRow[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "USER" });

  useEffect(() => {
    apiFetch<{ users: DbUserRow[] }>("/users/admin/list")
      .then((d) => setUsers(Array.isArray(d?.users) ? d.users : []))
      .catch(() => setUsers([]));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q));
  }, [users, query]);

  const reload = async (q?: string) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    const d = await apiFetch<{ users: DbUserRow[] }>(`/users/admin/list?${qs.toString()}`);
    setUsers(Array.isArray(d?.users) ? d.users : []);
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/users/admin/${encodeURIComponent(id)}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("User deleted");
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const handleCreate = async () => {
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim() || !email || !form.password.trim()) return;

    try {
      const d = await apiFetch<{ user: DbUserRow }>("/users/admin/create", {
        method: "POST",
        body: JSON.stringify({ name: form.name.trim(), email, password: form.password, role: form.role }),
      });
      if (d?.user) {
        setUsers((prev) => [d.user, ...prev]);
        setOpen(false);
        setForm({ name: "", email: "", password: "", role: "USER" });
        toast.success("User created");
      }
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("email")) toast.error("Email already exists");
      else toast.error("Failed to create user");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">Manage users stored in the database.</p>
        </div>
        <div className="flex gap-2">
          <div className="w-64 max-w-full">
            <Input
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                void reload(v.trim());
              }}
              placeholder="Search users..."
            />
          </div>
          <Button variant="neon" onClick={() => setOpen(true)}>
            <UserPlus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-4">Name</div>
          <div className="col-span-5">Email</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map(u => (
            <div key={u.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-4 font-medium truncate">{u.name}</div>
              <div className="col-span-5 text-sm text-muted-foreground truncate">{u.email}</div>
              <div className="col-span-2 text-sm">
                <span className={`px-2 py-0.5 rounded-full text-xs ${((u.role || "USER") === "ADMIN") ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {String(u.role || "USER").toLowerCase()}
                </span>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No users found.</div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium mb-1">Name</div>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Email</div>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Password</div>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Role</div>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value === "ADMIN" ? "ADMIN" : "USER" })}
                className="w-full px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="USER" className="bg-card">user</option>
                <option value="ADMIN" className="bg-card">admin</option>
              </select>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="neon" onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
