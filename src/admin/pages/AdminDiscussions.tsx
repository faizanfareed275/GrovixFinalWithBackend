import { useEffect, useMemo, useState } from "react";
import { Copy, Download, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type DiscussionReply = {
  id: number;
  userId: string;
  user: string;
  avatar: string;
  content: string;
  timeAgo: string;
  likes: number;
  liked: boolean;
  replies?: DiscussionReply[];
};

type Discussion = {
  id: number;
  status?: string;
  userId: string;
  category: string;
  title: string;
  content: string;
  author: string;
  avatar: string;
  replies: DiscussionReply[];
  views: number;
  hot: boolean;
  createdAt: string;
};

function csvEscape(value: any) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  const needs = s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"');
  const escaped = s.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

function buildDiscussionsCsv(rows: Discussion[]) {
  const header = ["id", "status", "category", "title", "author", "userId", "views", "replies"];
  const lines = [header.join(",")];
  for (const d of rows) {
    const values = [
      d.id,
      d.status || "",
      d.category,
      d.title,
      d.author,
      d.userId,
      d.views,
      countReplies(d.replies || []),
    ].map(csvEscape);
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

function countReplies(replies: DiscussionReply[]): number {
  return replies.reduce((sum, r) => sum + 1 + countReplies(r.replies || []), 0);
}

export default function AdminDiscussions() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Discussion[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "REMOVED">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ category: "", title: "", content: "" });

  useEffect(() => {
    apiFetch<{ discussions: Discussion[] }>("/community/discussions?includeRemoved=1")
      .then((d) => {
        if (Array.isArray(d.discussions)) setItems(d.discussions);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (status !== "ALL") list = list.filter((d) => String(d.status || "ACTIVE") === status);
    if (!q) return list;
    return list.filter((d) =>
      (d.title || "").toLowerCase().includes(q) ||
      (d.author || "").toLowerCase().includes(q) ||
      (d.category || "").toLowerCase().includes(q)
    );
  }, [items, query, status]);

  const openDiscussion = (id: number) => {
    navigate(`/community?discussionId=${encodeURIComponent(String(id))}`);
  };

  const copyLink = async (id: number) => {
    try {
      const path = `/community?discussionId=${encodeURIComponent(String(id))}`;
      const abs = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(abs);
    } catch {
    }
  };

  const exportCsv = () => {
    try {
      const csv = buildDiscussionsCsv(filtered);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const fileName = `discussions_${status.toLowerCase()}_${y}${m}${d}.csv`;
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
    }
  };

  const handleDelete = (id: number) => {
    setItems(items.filter(d => d.id !== id));
    apiFetch(`/community/discussions/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const handleClearReplies = (id: number) => {
    const next = items.map(d => (d.id === id ? { ...d, replies: [] } : d));
    setItems(next);
    apiFetch(`/community/admin/discussions/${encodeURIComponent(String(id))}/clear-replies`, {
      method: "POST",
    }).catch(() => {});
  };

  const handleClearAll = () => {
    const ids = items.map(d => d.id);
    setItems([]);
    Promise.all(ids.map(id => apiFetch(`/community/discussions/${id}`, { method: "DELETE" }).catch(() => {}))).catch(() => {});
  };

  const handleCreateDiscussion = async () => {
    if (!createForm.category.trim() || !createForm.title.trim() || !createForm.content.trim()) {
      toast.error("Please fill all fields");
      return;
    }
    try {
      const payload = {
        category: createForm.category,
        title: createForm.title,
        content: createForm.content,
      };
      const result = await apiFetch<{ discussion: Discussion }>('/community/discussions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (result?.discussion) {
        setItems([result.discussion, ...items]);
        setCreateForm({ category: "", title: "", content: "" });
        setCreateOpen(false);
        toast.success("Discussion created");
      }
    } catch {
      toast.error("Failed to create discussion");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Discussions</h1>
            <p className="text-muted-foreground mt-1">Manage community discussions.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" />Create Discussion</Button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="w-72 max-w-full">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search discussions..." />
        </div>
        <div className="flex gap-2">
          <Button variant={status === "ALL" ? "default" : "outline"} onClick={() => setStatus("ALL")}>All</Button>
          <Button variant={status === "ACTIVE" ? "default" : "outline"} onClick={() => setStatus("ACTIVE")}>Active</Button>
          <Button variant={status === "REMOVED" ? "default" : "outline"} onClick={() => setStatus("REMOVED")}>Removed</Button>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
        <Button variant="destructive" onClick={handleClearAll}>Clear All</Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-1">Status</div>
          <div className="col-span-4">Title</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">Author</div>
          <div className="col-span-1">Views</div>
          <div className="col-span-1">Replies</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map(d => (
            <div key={d.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-1 text-xs text-muted-foreground truncate">{String(d.status || "ACTIVE")}</div>
              <div className="col-span-4 min-w-0">
                <div className="font-medium truncate">{d.title}</div>
                <div className="text-xs text-muted-foreground truncate">{d.createdAt}</div>
              </div>
              <div className="col-span-2 text-sm text-muted-foreground truncate">{d.category}</div>
              <div className="col-span-2 text-sm text-muted-foreground truncate">{d.author}</div>
              <div className="col-span-1 text-sm text-muted-foreground">{d.views}</div>
              <div className="col-span-1 text-sm text-muted-foreground">{countReplies(d.replies || [])}</div>
              <div className="col-span-1 flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => openDiscussion(d.id)} title="Open">
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => copyLink(d.id)} title="Copy link">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleClearReplies(d.id)}>
                  Clear
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No discussions found.</div>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">Data source: database</div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Discussion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={createForm.category} onValueChange={(v) => setCreateForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="Help">Help</SelectItem>
                  <SelectItem value="Ideas">Ideas</SelectItem>
                  <SelectItem value="Announcements">Announcements</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="Discussion title" />
            </div>
            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea id="content" value={createForm.content} onChange={e => setCreateForm(f => ({ ...f, content: e.target.value }))} placeholder="Discussion content" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateDiscussion}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
