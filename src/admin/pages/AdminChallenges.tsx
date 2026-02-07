import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type CompletionRow = {
  id: string;
  title: string;
  category: string;
  xpEarned: number;
  completedAt: string;
};

export default function AdminChallenges() {
  const [userId, setUserId] = useState<string>("");
  const [completed, setCompleted] = useState<CompletionRow[]>([]);
  const [userXP, setUserXP] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // no-op until userId is provided
  }, []);

  const load = async (uid: string) => {
    if (!uid) return;
    setLoading(true);
    try {
      const [c, xp] = await Promise.all([
        apiFetch<{ completions: CompletionRow[] }>(`/challenges/admin/completions?userId=${encodeURIComponent(uid)}`),
        apiFetch<{ user: { id: string; xp: number } }>(`/users/admin/${encodeURIComponent(uid)}`).catch(() => null),
      ]);
      setCompleted(Array.isArray(c?.completions) ? c.completions : []);

      // Prefer exact user lookup if present; fallback to 0
      const maybe = (xp as any)?.user;
      setUserXP(Number(maybe?.xp || 0) || 0);
    } catch {
      toast.error("Failed to load completions");
      setCompleted([]);
      setUserXP(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/challenges/admin/completions/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast.success("Completion removed");
      await load(userId);
    } catch {
      toast.error("Failed to remove completion");
    }
  };

  const handleClear = async () => {
    if (!userId) return;
    try {
      await apiFetch(`/challenges/admin/completions/clear`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      toast.success("Completions cleared");
      await load(userId);
    } catch {
      toast.error("Failed to clear completions");
    }
  };

  const handleSetXP = async (delta: number) => {
    if (!userId) return;
    try {
      const d = await apiFetch<{ user: { id: string; xp: number } }>("/xp/admin/adjust", {
        method: "POST",
        body: JSON.stringify({ userId, delta }),
      });
      setUserXP(Number(d?.user?.xp || 0) || 0);
      toast.success("XP updated");
    } catch {
      toast.error("Failed to update XP");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Challenges & XP</h1>
          <p className="text-muted-foreground mt-1">Manage challenge completions and user XP (database).</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-64 max-w-full">
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User ID"
            />
          </div>
          <Button variant="outline" onClick={() => void load(userId)} disabled={!userId || loading}>
            Load
          </Button>
          <div className="glass-card px-4 py-2">
            <div className="text-xs text-muted-foreground">Current user XP</div>
            <div className="font-display font-bold text-lg text-primary">{userXP}</div>
          </div>
          <Button variant="outline" onClick={() => handleSetXP(100)}>+100</Button>
          <Button variant="outline" onClick={() => handleSetXP(-100)}>-100</Button>
          <Button variant="destructive" onClick={handleClear}>Clear</Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-4">Title</div>
          <div className="col-span-3">Category</div>
          <div className="col-span-2">XP</div>
          <div className="col-span-2">Completed</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {completed.map(c => (
            <div key={c.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-4 font-medium truncate">{c.title}</div>
              <div className="col-span-3 text-sm text-muted-foreground truncate">{c.category}</div>
              <div className="col-span-2 text-sm text-primary font-medium">{c.xpEarned}</div>
              <div className="col-span-2 text-xs text-muted-foreground truncate">{c.completedAt}</div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => void handleDelete(c.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {completed.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No completed challenges found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
