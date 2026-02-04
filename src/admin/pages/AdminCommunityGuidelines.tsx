import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Edit3, Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

type GuidelineStatus = "DRAFT" | "PUBLISHED";

type Guideline = {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: GuidelineStatus;
  publishedAt: string | null;
  updatedAt: string;
};

function csvEscape(value: any) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  const needs = s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"');
  const escaped = s.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

function buildGuidelinesCsv(rows: Guideline[]) {
  const header = ["id", "slug", "title", "status", "publishedAt", "updatedAt", "content"];
  const lines = [header.join(",")];
  for (const g of rows) {
    const values = [
      g.id,
      g.slug,
      g.title,
      g.status,
      g.publishedAt ?? "",
      g.updatedAt,
      g.content,
    ].map(csvEscape);
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

export default function AdminCommunityGuidelines() {
  const [items, setItems] = useState<Guideline[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Guideline | null>(null);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<GuidelineStatus>("DRAFT");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<{ guidelines: Guideline[] }>("/community/admin/guidelines");
      setItems(Array.isArray(d?.guidelines) ? d.guidelines : []);
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
    return items.filter((g) => {
      return (
        String(g.slug || "").toLowerCase().includes(q) ||
        String(g.title || "").toLowerCase().includes(q) ||
        String(g.status || "").toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  const exportCsv = () => {
    try {
      const csv = buildGuidelinesCsv(filtered);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const fileName = `guidelines_${safeFilenamePart(query || "all")}_${y}${m}${d}.csv`;

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
    setSlug("");
    setTitle("");
    setContent("");
    setStatus("DRAFT");
    setSaving(false);
  };

  const startCreate = () => {
    setEditing(null);
    resetForm();
    setEditOpen(true);
  };

  const startEdit = (g: Guideline) => {
    setEditing(g);
    setSlug(g.slug || "");
    setTitle(g.title || "");
    setContent(g.content || "");
    setStatus(g.status || "DRAFT");
    setEditOpen(true);
  };

  const save = async () => {
    if (!slug.trim() || !title.trim() || !content.trim()) return;
    setSaving(true);

    try {
      if (!editing) {
        await apiFetch("/community/admin/guidelines", {
          method: "POST",
          body: JSON.stringify({ slug: slug.trim(), title: title.trim(), content: content.trim() }),
        });
        toast.success("Guideline created");
      } else {
        await apiFetch(`/community/admin/guidelines/${encodeURIComponent(editing.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ slug: slug.trim(), title: title.trim(), content: content.trim(), status }),
        });
        toast.success("Guideline updated");
      }
      setEditOpen(false);
      await load();
    } catch (e: any) {
      if (Number(e?.status) === 409) toast.error("Slug already exists");
      else toast.error("Failed to save guideline");
    } finally {
      setSaving(false);
    }
  };

  const canSave = slug.trim().length > 0 && title.trim().length > 0 && content.trim().length > 0 && !saving;

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Community Guidelines</h1>
          <p className="text-muted-foreground mt-1">Create and publish guidelines referenced by moderation actions.</p>
        </div>
        <div className="flex gap-2">
          <div className="w-72 max-w-full">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guidelines..." />
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
          <div className="col-span-3">Slug</div>
          <div className="col-span-5">Title</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((g) => (
            <div key={g.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-3 min-w-0">
                <div className="font-medium truncate">{g.slug}</div>
                <div className="text-xs text-muted-foreground truncate">{g.id}</div>
              </div>
              <div className="col-span-5 min-w-0">
                <div className="text-sm text-foreground truncate">{g.title}</div>
                <div className="text-xs text-muted-foreground truncate">Updated {new Date(g.updatedAt).toLocaleString()}</div>
              </div>
              <div className="col-span-2 text-sm text-muted-foreground">
                {g.status}
                {g.publishedAt ? ` (${new Date(g.publishedAt).toLocaleDateString()})` : ""}
              </div>
              <div className="col-span-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => startEdit(g)}>
                  <Edit3 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">{loading ? "Loading..." : "No guidelines found."}</div>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit guideline" : "Create guideline"}</DialogTitle>
            <DialogDescription>Guidelines can be linked when moderating reports.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={80} placeholder="e.g. no-harassment" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. No harassment" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as GuidelineStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={20000} className="min-h-48" />
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
