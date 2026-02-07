import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type NotificationRow = {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function AdminNotifications() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ notifications: NotificationRow[] }>(`/community/admin/notifications?limit=200`)
      .then((d) => setRows(Array.isArray(d?.notifications) ? d.notifications : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((n) => {
      if (String(n.title || "").toLowerCase().includes(q)) return true;
      if (String(n.body || "").toLowerCase().includes(q)) return true;
      if (String(n.type || "").toLowerCase().includes(q)) return true;
      if (String(n.user?.email || "").toLowerCase().includes(q)) return true;
      if (String(n.user?.name || "").toLowerCase().includes(q)) return true;
      if (String(n.userId || "").toLowerCase().includes(q)) return true;
      return false;
    });
  }, [rows, query]);

  const reload = async (q?: string) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    qs.set("limit", "200");
    const d = await apiFetch<{ notifications: NotificationRow[] }>(`/community/admin/notifications?${qs.toString()}`);
    setRows(Array.isArray(d?.notifications) ? d.notifications : []);
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/community/admin/notifications/${encodeURIComponent(id)}`, { method: "DELETE" });
      setRows((prev) => prev.filter((n) => n.id !== id));
      toast.success("Notification deleted");
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-1">Manage user notifications (database).</p>
        </div>
        <div className="flex gap-2">
          <div className="w-72 max-w-full">
            <Input
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                void reload(v.trim());
              }}
              placeholder="Search type/title/user/email..."
            />
          </div>
          {loading && <div className="text-xs text-muted-foreground self-center">Loading…</div>}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-3">User</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-5">Title / Body</div>
          <div className="col-span-1">Read</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((n) => (
            <div key={n.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-3 min-w-0">
                <div className="text-sm font-medium truncate">{n.user?.name || "Unknown"}</div>
                <div className="text-xs text-muted-foreground truncate">{n.user?.email || n.userId}</div>
              </div>
              <div className="col-span-2 text-xs text-muted-foreground truncate">{n.type}</div>
              <div className="col-span-5 min-w-0">
                <div className="text-sm font-medium truncate">{n.title}</div>
                <div className="text-xs text-muted-foreground truncate">{n.body}</div>
              </div>
              <div className="col-span-1 text-xs text-muted-foreground">{n.readAt ? "Yes" : "No"}</div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => void handleDelete(n.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No notifications found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
