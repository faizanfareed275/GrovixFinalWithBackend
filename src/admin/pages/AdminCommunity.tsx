import { useEffect, useMemo, useState } from "react";
import { Copy, Download, ExternalLink, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type Post = {
  id: number;
  status?: string;
  userId: string;
  user: string;
  content: string;
  timeAgo?: string;
  likes?: number;
};

function csvEscape(value: any) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  const needs = s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"');
  const escaped = s.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

function buildPostsCsv(rows: Post[]) {
  const header = ["id", "status", "user", "userId", "content"];
  const lines = [header.join(",")];
  for (const p of rows) {
    const values = [p.id, p.status || "", p.user, p.userId, p.content].map(csvEscape);
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

export default function AdminCommunity() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "REMOVED">("ALL");

  useEffect(() => {
    apiFetch<{ posts: Post[] }>("/community/posts?includeRemoved=1")
      .then((d) => {
        if (Array.isArray(d.posts)) setPosts(d.posts);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = posts;
    if (status !== "ALL") list = list.filter((p) => String(p.status || "ACTIVE") === status);
    if (!q) return list;
    return list.filter((p) => (p.user || "").toLowerCase().includes(q) || (p.content || "").toLowerCase().includes(q));
  }, [posts, query, status]);

  const openPost = (id: number) => {
    navigate(`/community?postId=${encodeURIComponent(String(id))}`);
  };

  const copyLink = async (id: number) => {
    try {
      const path = `/community?postId=${encodeURIComponent(String(id))}`;
      const abs = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(abs);
    } catch {
    }
  };

  const exportCsv = () => {
    try {
      const csv = buildPostsCsv(filtered);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const fileName = `posts_${status.toLowerCase()}_${y}${m}${d}.csv`;
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
    setPosts(posts.filter(p => p.id !== id));
    apiFetch(`/community/posts/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const handleClear = () => {
    const ids = posts.map(p => p.id);
    setPosts([]);
    Promise.all(ids.map(id => apiFetch(`/community/posts/${id}`, { method: "DELETE" }).catch(() => {}))).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Community Posts</h1>
          <p className="text-muted-foreground mt-1">Moderate posts stored in the database.</p>
        </div>
        <div className="flex gap-2">
          <div className="w-72 max-w-full">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search posts..." />
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
          <Button variant="destructive" onClick={handleClear}>
            Clear
          </Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Author</div>
          <div className="col-span-6">Content</div>
          <div className="col-span-1 text-right">Open</div>
          <div className="col-span-1 text-right">Copy</div>
          <div className="col-span-1 text-right">Delete</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map(p => (
            <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-start">
              <div className="col-span-2 text-xs text-muted-foreground truncate">{String(p.status || "ACTIVE")}</div>
              <div className="col-span-3">
                <div className="font-medium truncate">{p.user}</div>
                <div className="text-xs text-muted-foreground truncate">{p.userId}</div>
              </div>
              <div className="col-span-6 text-sm text-foreground whitespace-pre-line break-words">
                {p.content}
              </div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => openPost(p.id)}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => copyLink(p.id)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No posts found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
