import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readJson, writeJson, safeNumber } from "@/admin/lib/storage";

type CompletedChallenge = {
  id: number;
  title: string;
  category: string;
  xp: number;
  completedAt: string;
  rating?: number;
};

export default function AdminChallenges() {
  const [completed, setCompleted] = useState<CompletedChallenge[]>([]);
  const [userXP, setUserXP] = useState<number>(0);

  useEffect(() => {
    setCompleted(readJson<CompletedChallenge[]>("youthxp_completed_challenges_details", []));
    setUserXP(safeNumber(localStorage.getItem("youthxp_user_xp"), 0));
  }, []);

  const persist = (next: CompletedChallenge[]) => {
    setCompleted(next);
    writeJson("youthxp_completed_challenges_details", next);
    writeJson("youthxp_completed_challenges", next.map(c => c.id));
  };

  const handleDelete = (id: number) => {
    persist(completed.filter(c => c.id !== id));
  };

  const handleClear = () => {
    persist([]);
  };

  const handleSetXP = (delta: number) => {
    const next = Math.max(0, userXP + delta);
    setUserXP(next);
    localStorage.setItem("youthxp_user_xp", String(next));
    window.dispatchEvent(new StorageEvent('storage', { key: 'youthxp_user_xp', newValue: String(next) }));
    window.dispatchEvent(new CustomEvent('xp-update', { detail: { newXP: next, earned: delta } }));
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Challenges & XP</h1>
          <p className="text-muted-foreground mt-1">Manage challenge completions and user XP.</p>
        </div>
        <div className="flex items-center gap-2">
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
            <div key={c.completedAt + c.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-4 font-medium truncate">{c.title}</div>
              <div className="col-span-3 text-sm text-muted-foreground truncate">{c.category}</div>
              <div className="col-span-2 text-sm text-primary font-medium">{c.xp}</div>
              <div className="col-span-2 text-xs text-muted-foreground truncate">{c.completedAt}</div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
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
