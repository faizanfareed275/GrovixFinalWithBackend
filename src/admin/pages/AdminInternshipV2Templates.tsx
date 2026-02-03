import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type TemplateRow = {
  id: string;
  internshipId: number;
  badgeLevel: string;
  title: string;
  description: string;
  xpReward: number;
  sortOrder: number;
  unlockOffsetDays: number | null;
  timePeriodDays: number | null;
  maxAttempts: number;
  autoPass: boolean;
  rubricJson: any;
};

type InternshipItem = {
  id: number;
  title: string;
  company: string;
};

const badgeLevels = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;

export default function AdminInternshipV2Templates() {
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [internshipId, setInternshipId] = useState<number>(1);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    badgeLevel: "BEGINNER",
    title: "",
    description: "",
    xpReward: 0,
    sortOrder: 0,
    unlockOffsetDays: "0",
    timePeriodDays: "7",
    maxAttempts: 1,
    autoPass: false,
    rubricJson: "{}",
  });

  const [form, setForm] = useState({
    badgeLevel: "BEGINNER",
    title: "",
    description: "",
    xpReward: 0,
    sortOrder: 0,
    unlockOffsetDays: "0",
    timePeriodDays: "7",
    maxAttempts: 1,
    autoPass: false,
    rubricJson: "{}",
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

  const loadTemplates = async (id: number) => {
    setLoading(true);
    try {
      const d = await apiFetch<{ templates: TemplateRow[] }>(`/internships/${encodeURIComponent(String(id))}/admin/v2/templates`);
      setTemplates(Array.isArray(d?.templates) ? d.templates : []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const beginEdit = (t: TemplateRow) => {
    setEditingId(t.id);
    setEditForm({
      badgeLevel: t.badgeLevel,
      title: t.title,
      description: t.description,
      xpReward: t.xpReward,
      sortOrder: t.sortOrder,
      unlockOffsetDays: String(t.unlockOffsetDays ?? ""),
      timePeriodDays: String(t.timePeriodDays ?? ""),
      maxAttempts: t.maxAttempts,
      autoPass: !!t.autoPass,
      rubricJson: JSON.stringify(t.rubricJson ?? {}, null, 2),
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const rubricParsed = (() => {
        try {
          return JSON.parse(editForm.rubricJson || "{}");
        } catch {
          return {};
        }
      })();

      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/v2/templates/${encodeURIComponent(editingId)}`, {
        method: "PUT",
        body: JSON.stringify({
          badgeLevel: editForm.badgeLevel,
          title: editForm.title,
          description: editForm.description,
          xpReward: Number(editForm.xpReward) || 0,
          sortOrder: Number(editForm.sortOrder) || 0,
          unlockOffsetDays: editForm.unlockOffsetDays === "" ? null : Number(editForm.unlockOffsetDays),
          timePeriodDays: editForm.timePeriodDays === "" ? null : Number(editForm.timePeriodDays),
          maxAttempts: Number(editForm.maxAttempts) || 1,
          autoPass: !!editForm.autoPass,
          rubricJson: rubricParsed,
        }),
      });
      toast.success("Template updated");
      setEditingId(null);
      await loadTemplates(internshipId);
    } catch {
      toast.error("Failed to update template");
    }
  };

  const removeTemplate = async (templateId: string) => {
    const ok = window.confirm("Delete this template? This will also remove its assignments.");
    if (!ok) return;
    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/v2/templates/${encodeURIComponent(templateId)}`, {
        method: "DELETE",
      });
      toast.success("Template deleted");
      if (editingId === templateId) setEditingId(null);
      await loadTemplates(internshipId);
    } catch {
      toast.error("Failed to delete template");
    }
  };

  useEffect(() => {
    if (!internshipId) return;
    loadTemplates(internshipId).catch(() => {});
  }, [internshipId]);

  const canCreate = useMemo(() => form.title.trim().length > 0, [form.title]);

  const handleCreate = async () => {
    if (!canCreate) return;
    try {
      const rubricParsed = (() => {
        try {
          return JSON.parse(form.rubricJson || "{}");
        } catch {
          return {};
        }
      })();

      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/v2/templates`, {
        method: "POST",
        body: JSON.stringify({
          badgeLevel: form.badgeLevel,
          title: form.title,
          description: form.description,
          xpReward: Number(form.xpReward) || 0,
          sortOrder: Number(form.sortOrder) || 0,
          unlockOffsetDays: form.unlockOffsetDays === "" ? null : Number(form.unlockOffsetDays),
          timePeriodDays: form.timePeriodDays === "" ? null : Number(form.timePeriodDays),
          maxAttempts: Number(form.maxAttempts) || 1,
          autoPass: !!form.autoPass,
          rubricJson: rubricParsed,
        }),
      });

      toast.success("Template created");
      setForm((p) => ({ ...p, title: "", description: "" }));
      await loadTemplates(internshipId);
    } catch {
      toast.error("Failed to create template");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Internship v2 Templates</h1>
          <p className="text-muted-foreground mt-1">Create badge-based task templates (timeline + rubric + attempt limits).</p>
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
          <div className="font-display font-bold">Create Template</div>
          <Button variant="neon" onClick={() => void handleCreate()} disabled={!canCreate}>
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="text-sm font-medium mb-1">Badge Level</div>
            <select
              value={form.badgeLevel}
              onChange={(e) => setForm((p) => ({ ...p, badgeLevel: e.target.value }))}
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
            <div className="text-sm font-medium mb-1">XP Reward</div>
            <Input value={String(form.xpReward)} onChange={(e) => setForm((p) => ({ ...p, xpReward: Number(e.target.value) }))} />
          </div>
          <div className="sm:col-span-2">
            <div className="text-sm font-medium mb-1">Title</div>
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <div className="text-sm font-medium mb-1">Description</div>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full h-24 p-3 rounded-lg bg-muted/20 border border-border focus:outline-none text-sm"
            />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Unlock Offset (days)</div>
            <Input value={form.unlockOffsetDays} onChange={(e) => setForm((p) => ({ ...p, unlockOffsetDays: e.target.value }))} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Time Period (days)</div>
            <Input value={form.timePeriodDays} onChange={(e) => setForm((p) => ({ ...p, timePeriodDays: e.target.value }))} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Sort Order</div>
            <Input value={String(form.sortOrder)} onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Max Attempts</div>
            <Input value={String(form.maxAttempts)} onChange={(e) => setForm((p) => ({ ...p, maxAttempts: Number(e.target.value) }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.autoPass} onChange={(e) => setForm((p) => ({ ...p, autoPass: e.target.checked }))} />
              Auto-pass (optional/low-risk)
            </label>
          </div>
          <div className="sm:col-span-2">
            <div className="text-sm font-medium mb-1">Rubric JSON</div>
            <textarea
              value={form.rubricJson}
              onChange={(e) => setForm((p) => ({ ...p, rubricJson: e.target.value }))}
              className="w-full h-28 p-3 rounded-lg bg-muted/20 border border-border focus:outline-none text-sm font-mono"
            />
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-3">Title</div>
          <div className="col-span-2">Badge</div>
          <div className="col-span-1">XP</div>
          <div className="col-span-2">Unlock</div>
          <div className="col-span-2">Period</div>
          <div className="col-span-1">Attempts</div>
          <div className="col-span-1 text-right">Action</div>
        </div>
        <div className="divide-y divide-border">
          {templates.map((t) => (
            <div key={t.id} className="px-4 py-3">
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3 min-w-0">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.id}</div>
                </div>
                <div className="col-span-2 text-sm text-muted-foreground">{t.badgeLevel}</div>
                <div className="col-span-1 text-sm text-primary font-medium">{t.xpReward}</div>
                <div className="col-span-2 text-sm text-muted-foreground">{t.unlockOffsetDays ?? "—"}d</div>
                <div className="col-span-2 text-sm text-muted-foreground">{t.timePeriodDays ?? "—"}d</div>
                <div className="col-span-1 text-sm text-muted-foreground">{t.maxAttempts}</div>
                <div className="col-span-1 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => beginEdit(t)}>
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => void removeTemplate(t.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {editingId === t.id && (
                <div className="mt-3 rounded-lg border border-border p-3 grid sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Badge Level</div>
                    <select
                      value={editForm.badgeLevel}
                      onChange={(e) => setEditForm((p) => ({ ...p, badgeLevel: e.target.value }))}
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
                    <div className="text-xs text-muted-foreground mb-1">XP Reward</div>
                    <Input value={String(editForm.xpReward)} onChange={(e) => setEditForm((p) => ({ ...p, xpReward: Number(e.target.value) }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground mb-1">Title</div>
                    <Input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground mb-1">Description</div>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full h-24 p-3 rounded-lg bg-muted/20 border border-border focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Unlock Offset (days)</div>
                    <Input value={editForm.unlockOffsetDays} onChange={(e) => setEditForm((p) => ({ ...p, unlockOffsetDays: e.target.value }))} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Time Period (days)</div>
                    <Input value={editForm.timePeriodDays} onChange={(e) => setEditForm((p) => ({ ...p, timePeriodDays: e.target.value }))} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Sort Order</div>
                    <Input value={String(editForm.sortOrder)} onChange={(e) => setEditForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Max Attempts</div>
                    <Input value={String(editForm.maxAttempts)} onChange={(e) => setEditForm((p) => ({ ...p, maxAttempts: Number(e.target.value) }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={editForm.autoPass} onChange={(e) => setEditForm((p) => ({ ...p, autoPass: e.target.checked }))} />
                      Auto-pass (optional/low-risk)
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground mb-1">Rubric JSON</div>
                    <textarea
                      value={editForm.rubricJson}
                      onChange={(e) => setEditForm((p) => ({ ...p, rubricJson: e.target.value }))}
                      className="w-full h-28 p-3 rounded-lg bg-muted/20 border border-border focus:outline-none text-sm font-mono"
                    />
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
          {templates.length === 0 && <div className="p-8 text-center text-muted-foreground">No templates yet.</div>}
        </div>
      </div>
    </div>
  );
}
