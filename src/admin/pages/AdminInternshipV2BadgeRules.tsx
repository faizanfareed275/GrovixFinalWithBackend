import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type InternshipItem = {
  id: number;
  title: string;
  company: string;
};

type BadgeRule = {
  id: string;
  internshipId: number;
  level: string;
  minCompletionPercent: number;
  minXp: number;
  sortOrder: number;
  createdAt: string;
};

const badgeLevels = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;

export default function AdminInternshipV2BadgeRules() {
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [internshipId, setInternshipId] = useState<number>(1);
  const [rules, setRules] = useState<BadgeRule[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    level: "BEGINNER",
    minCompletionPercent: 0,
    minXp: 0,
    sortOrder: 0,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    level: "BEGINNER",
    minCompletionPercent: 0,
    minXp: 0,
    sortOrder: 0,
  });

  useEffect(() => {
    apiFetch<{ internships: InternshipItem[] }>("/internships")
      .then((d) => {
        const list = Array.isArray(d?.internships) ? d.internships : [];
        setInternships(list);
        if (list[0]?.id) setInternshipId(list[0].id);
      })
      .catch(() => setInternships([]));
  }, []);

  const loadRules = async (id: number) => {
    setLoading(true);
    try {
      const d = await apiFetch<{ rules: BadgeRule[] }>(`/internships/${encodeURIComponent(String(id))}/admin/v2/badge-rules`);
      setRules(Array.isArray(d?.rules) ? d.rules : []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!internshipId) return;
    loadRules(internshipId).catch(() => {});
  }, [internshipId]);

  const canCreate = useMemo(() => !!form.level, [form.level]);

  const handleCreate = async () => {
    if (!canCreate) return;
    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/v2/badge-rules`, {
        method: "POST",
        body: JSON.stringify({
          level: form.level,
          minCompletionPercent: Number(form.minCompletionPercent) || 0,
          minXp: Number(form.minXp) || 0,
          sortOrder: Number(form.sortOrder) || 0,
        }),
      });
      toast.success("Badge rule created");
      await loadRules(internshipId);
    } catch {
      toast.error("Failed to create rule");
    }
  };

  const beginEdit = (rule: BadgeRule) => {
    setEditingId(rule.id);
    setEditForm({
      level: rule.level,
      minCompletionPercent: rule.minCompletionPercent,
      minXp: rule.minXp,
      sortOrder: rule.sortOrder,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/v2/badge-rules/${encodeURIComponent(editingId)}`, {
        method: "PUT",
        body: JSON.stringify({
          level: editForm.level,
          minCompletionPercent: Number(editForm.minCompletionPercent) || 0,
          minXp: Number(editForm.minXp) || 0,
          sortOrder: Number(editForm.sortOrder) || 0,
        }),
      });
      toast.success("Rule updated");
      setEditingId(null);
      await loadRules(internshipId);
    } catch {
      toast.error("Failed to update rule");
    }
  };

  const removeRule = async (ruleId: string) => {
    const ok = window.confirm("Delete this badge rule?");
    if (!ok) return;
    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/v2/badge-rules/${encodeURIComponent(ruleId)}`, {
        method: "DELETE",
      });
      toast.success("Rule deleted");
      if (editingId === ruleId) setEditingId(null);
      await loadRules(internshipId);
    } catch {
      toast.error("Failed to delete rule");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Internship v2 Badge Rules</h1>
          <p className="text-muted-foreground mt-1">Define badge progression thresholds (completion % + XP).</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={internshipId}
            onChange={(e) => setInternshipId(parseInt(e.target.value))}
            className="px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {internships.map((i) => (
              <option key={i.id} value={i.id} className="bg-card">
                {i.title}
              </option>
            ))}
          </select>
          {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-display font-bold">Create Rule</div>
          <Button variant="neon" onClick={() => void handleCreate()} disabled={!canCreate}>
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="text-sm font-medium mb-1">Badge Level</div>
            <select
              value={form.level}
              onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}
              className="w-full px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {badgeLevels.map((b) => (
                <option key={b} value={b} className="bg-card">
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Min Completion %</div>
            <Input
              value={String(form.minCompletionPercent)}
              onChange={(e) => setForm((p) => ({ ...p, minCompletionPercent: Number(e.target.value) }))}
            />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Min XP</div>
            <Input value={String(form.minXp)} onChange={(e) => setForm((p) => ({ ...p, minXp: Number(e.target.value) }))} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Sort Order</div>
            <Input value={String(form.sortOrder)} onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} />
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-3">Level</div>
          <div className="col-span-3">Completion</div>
          <div className="col-span-2">XP</div>
          <div className="col-span-2">Order</div>
          <div className="col-span-2 text-right">Action</div>
        </div>
        <div className="divide-y divide-border">
          {rules.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3 text-sm font-medium">{r.level}</div>
                <div className="col-span-3 text-xs text-muted-foreground">{r.minCompletionPercent}%</div>
                <div className="col-span-2 text-xs text-muted-foreground">{r.minXp}</div>
                <div className="col-span-2 text-xs text-muted-foreground">{r.sortOrder}</div>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => beginEdit(r)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => void removeRule(r.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {editingId === r.id && (
                <div className="mt-3 rounded-lg border border-border p-3 grid sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Badge Level</div>
                    <select
                      value={editForm.level}
                      onChange={(e) => setEditForm((p) => ({ ...p, level: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none"
                    >
                      {badgeLevels.map((b) => (
                        <option key={b} value={b} className="bg-card">
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Min Completion %</div>
                    <Input
                      value={String(editForm.minCompletionPercent)}
                      onChange={(e) => setEditForm((p) => ({ ...p, minCompletionPercent: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Min XP</div>
                    <Input value={String(editForm.minXp)} onChange={(e) => setEditForm((p) => ({ ...p, minXp: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Sort Order</div>
                    <Input value={String(editForm.sortOrder)} onChange={(e) => setEditForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} />
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={cancelEdit}>
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                    <Button variant="neon" size="sm" onClick={() => void saveEdit()}>
                      <Save className="w-4 h-4" />
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {rules.length === 0 && <div className="p-8 text-center text-muted-foreground">No badge rules yet.</div>}
        </div>
      </div>
    </div>
  );
}
