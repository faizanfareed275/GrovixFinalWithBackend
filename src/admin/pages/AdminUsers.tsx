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
import { readJson, writeJson } from "@/admin/lib/storage";

type StoredUser = {
  id: string;
  email: string;
  password?: string;
  name: string;
  role?: string;
  isAdmin?: boolean;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" });

  useEffect(() => {
    setUsers(readJson<StoredUser[]>("youthxp_users", []));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q));
  }, [users, query]);

  const persist = (next: StoredUser[]) => {
    setUsers(next);
    writeJson("youthxp_users", next);
  };

  const handleDelete = (id: string) => {
    persist(users.filter(u => u.id !== id));
  };

  const handleCreate = () => {
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim() || !email || !form.password.trim()) return;

    if (users.some(u => (u.email || "").trim().toLowerCase() === email)) return;

    const newUser: StoredUser = {
      id: (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `user_${Date.now()}`),
      name: form.name.trim(),
      email,
      password: form.password,
      role: form.role,
      isAdmin: form.role === "admin",
    };

    persist([newUser, ...users]);
    setOpen(false);
    setForm({ name: "", email: "", password: "", role: "user" });
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">Manage signups stored in localStorage.</p>
        </div>
        <div className="flex gap-2">
          <div className="w-64 max-w-full">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users..." />
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
                <span className={`px-2 py-0.5 rounded-full text-xs ${((u.role || "user") === "admin") ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {u.role || "user"}
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
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="user" className="bg-card">user</option>
                <option value="admin" className="bg-card">admin</option>
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
