import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  defaultInternships,
  Internship,
} from "@/data/internships";
import { apiFetch } from "@/lib/api";

const emptyForm: Internship = {
  id: 0,
  title: "",
  company: "",
  type: "free",
  xpRequired: 0,
  salary: null,
  duration: "",
  location: "",
  skills: [],
  description: "",
  applicants: 0,
};

export default function AdminInternshipCatalog() {
  const [items, setItems] = useState<Internship[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Internship>(emptyForm);

  useEffect(() => {
    apiFetch<{ internships: Internship[] }>("/internships")
      .then((d) => {
        if (Array.isArray(d.internships)) setItems(d.internships);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      (i.title || "").toLowerCase().includes(q) ||
      (i.company || "").toLowerCase().includes(q) ||
      (i.location || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const nextId = () => {
    const max = items.reduce((m, i) => Math.max(m, i.id || 0), 0);
    return max + 1;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, id: nextId() });
    setOpen(true);
  };

  const openEdit = (it: Internship) => {
    setEditingId(it.id);
    setForm({ ...it, skills: Array.isArray(it.skills) ? it.skills : [] });
    setOpen(true);
  };

  const handleDelete = (id: number) => {
    setItems(items.filter(i => i.id !== id));
    apiFetch(`/internships/${id}`, { method: "DELETE" }).catch(() => {});
    toast.success("Internship removed");
  };

  const handleResetDefault = () => {
    Promise.all(
      defaultInternships.map((it) =>
        apiFetch(`/internships/${it.id}`, {
          method: "PUT",
          body: JSON.stringify(it),
        }).catch(() => {})
      )
    )
      .then(() => apiFetch<{ internships: Internship[] }>("/internships"))
      .then((d) => {
        if (Array.isArray(d.internships)) setItems(d.internships);
        toast.success("Catalog reset to defaults");
      })
      .catch(() => {});
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.company.trim()) {
      toast.error("Title and Company are required");
      return;
    }

    const normalized: Internship = {
      ...form,
      id: Number(form.id) || nextId(),
      xpRequired: Number(form.xpRequired) || 0,
      applicants: Number(form.applicants) || 0,
      salary: form.salary && form.salary.trim() ? form.salary.trim() : null,
      skills: Array.isArray(form.skills) ? form.skills : [],
    };

    const exists = items.some(i => i.id === normalized.id);
    const next = exists
      ? items.map(i => (i.id === normalized.id ? normalized : i))
      : [normalized, ...items];

    apiFetch(`/internships/${normalized.id}`, {
      method: "PUT",
      body: JSON.stringify(normalized),
    })
      .then(() => {
        setItems(next);
        setOpen(false);
        toast.success(exists ? "Internship updated" : "Internship created");
      })
      .catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Internship Catalog</h1>
          <p className="text-muted-foreground mt-1">Manage the internships shown across the website.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="w-72 max-w-full">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search internships..." />
          </div>
          <Button variant="outline" onClick={handleResetDefault}>Reset Defaults</Button>
          <Button variant="neon" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-4">Title</div>
          <div className="col-span-3">Company</div>
          <div className="col-span-2">Track</div>
          <div className="col-span-2">XP Required</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((it) => (
            <div key={it.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-4 min-w-0">
                <div className="font-medium truncate">{it.title}</div>
                <div className="text-xs text-muted-foreground truncate">{it.location} • {it.duration}</div>
              </div>
              <div className="col-span-3 text-sm text-muted-foreground truncate">{it.company}</div>
              <div className="col-span-2">
                <span className={`px-2 py-0.5 rounded-full text-xs ${it.type === "paid" ? "bg-amber-500/20 text-amber-500" : "bg-accent/20 text-accent"}`}>
                  {it.type}
                </span>
              </div>
              <div className="col-span-2 text-sm text-primary font-medium">{it.xpRequired}</div>
              <div className="col-span-1 flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(it)}>
                  <Save className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(it.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No internships found.</div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Internship" : "Add Internship"}</DialogTitle>
          </DialogHeader>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-1">ID</div>
              <Input value={String(form.id)} onChange={(e) => setForm({ ...form, id: parseInt(e.target.value || "0") })} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Track</div>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Internship["type"] })}
                className="w-full px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="free" className="bg-card">free</option>
                <option value="paid" className="bg-card">paid</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <div className="text-sm font-medium mb-1">Title</div>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div>
              <div className="text-sm font-medium mb-1">Company</div>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Location</div>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>

            <div>
              <div className="text-sm font-medium mb-1">Duration</div>
              <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 4 weeks" />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Salary (optional)</div>
              <Input value={form.salary || ""} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="$2,000/month" />
            </div>

            <div>
              <div className="text-sm font-medium mb-1">XP Required</div>
              <Input value={String(form.xpRequired)} onChange={(e) => setForm({ ...form, xpRequired: parseInt(e.target.value || "0") })} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Applicants</div>
              <Input value={String(form.applicants)} onChange={(e) => setForm({ ...form, applicants: parseInt(e.target.value || "0") })} />
            </div>

            <div className="sm:col-span-2">
              <div className="text-sm font-medium mb-1">Skills (comma separated)</div>
              <Input
                value={form.skills.join(", ")}
                onChange={(e) =>
                  setForm({
                    ...form,
                    skills: e.target.value
                      .split(",")
                      .map(s => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>

            <div className="sm:col-span-2">
              <div className="text-sm font-medium mb-1">Description</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full h-32 p-3 rounded-lg bg-muted/20 border border-border focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="neon" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
