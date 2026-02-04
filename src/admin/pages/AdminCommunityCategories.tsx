import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Edit3, Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

function csvEscape(value: any) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  const needs = s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"');
  const escaped = s.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

function buildCategoriesCsv(rows: Category[]) {
  const header = ["id", "name", "slug", "sortOrder", "isActive"];
  const lines = [header.join(",")];
  for (const c of rows) {
    const values = [c.id, c.name, c.slug, c.sortOrder, c.isActive ? "true" : "false"].map(csvEscape);
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

function safeFilenamePart(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_.]+/g, "")
    .slice(0, 40);
}

export default function AdminCommunityCategories() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState<string>("0");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<{ categories: Category[] }>("/community/admin/categories");
      setItems(Array.isArray(d?.categories) ? d.categories : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => {
      return (
        String(c.name || "").toLowerCase().includes(q) ||
        String(c.slug || "").toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  const exportCsv = () => {
    try {
      const csv = buildCategoriesCsv(filtered);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const fileName = `categories_${safeFilenamePart(query || "all")}_${y}${m}${d}.csv`;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export CSV");
    }
  };

  const resetForm = () => {
    setName("");
    setSlug("");
    setSortOrder("0");
    setIsActive(true);
    setSaving(false);
  };

  const startCreate = () => {
    setEditing(null);
    resetForm();
    setEditOpen(true);
  };

  const startEdit = (c: Category) => {
    setEditing(c);
    setName(c.name || "");
    setSlug(c.slug || "");
    setSortOrder(String(c.sortOrder ?? 0));
    setIsActive(!!c.isActive);
    setEditOpen(true);
  };

  const save = async () => {
    if (!name.trim() || !slug.trim()) return;
    const n = Number(sortOrder);

    setSaving(true);
    try {
      if (!editing) {
        await apiFetch("/community/admin/categories", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), slug: slug.trim(), sortOrder: Number.isFinite(n) ? n : 0 }),
        });
        toast.success("Category created");
      } else {
        await apiFetch(`/community/admin/categories/${encodeURIComponent(editing.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ name: name.trim(), slug: slug.trim(), sortOrder: Number.isFinite(n) ? n : 0, isActive }),
        });
        toast.success("Category updated");
      }
      setEditOpen(false);
      await load();
    } catch {
      toast.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const canSave = name.trim().length > 0 && slug.trim().length > 0 && !saving;

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Discussion Categories</h1>
          <p className="text-muted-foreground mt-1">Manage categories used when creating discussions.</p>
        </div>
        <div className="flex gap-2">
          <div className="w-72 max-w-full">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search categories..." />
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => load().catch(() => {})} disabled={loading}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={startCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New
          </Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-4">Name</div>
          <div className="col-span-4">Slug</div>
          <div className="col-span-2">Sort</div>
          <div className="col-span-1">Active</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((c) => (
            <div key={c.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-4 min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.id}</div>
              </div>
              <div className="col-span-4 text-sm text-muted-foreground truncate">{c.slug}</div>
              <div className="col-span-2 text-sm text-muted-foreground">{c.sortOrder}</div>
              <div className="col-span-1 text-sm text-muted-foreground">{c.isActive ? "Yes" : "No"}</div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>
                  <Edit3 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">{loading ? "Loading..." : "No categories found."}</div>
          )}
        </div>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "Create category"}</DialogTitle>
            <DialogDescription>Categories can be enabled/disabled without deleting them.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Slug</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={80} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort order</label>
                <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="0" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Active</label>
                <Select value={isActive ? "true" : "false"} onValueChange={(v) => setIsActive(v === "true")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Active" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!canSave}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
