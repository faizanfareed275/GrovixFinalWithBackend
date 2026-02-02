import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function countReplies(replies: DiscussionReply[]): number {
  return replies.reduce((sum, r) => sum + 1 + countReplies(r.replies || []), 0);
}

export default function AdminDiscussions() {
  const [items, setItems] = useState<Discussion[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiFetch<{ discussions: Discussion[] }>("/community/discussions")
      .then((d) => {
        if (Array.isArray(d.discussions)) setItems(d.discussions);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(d =>
      (d.title || "").toLowerCase().includes(q) ||
      (d.author || "").toLowerCase().includes(q) ||
      (d.category || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const handleDelete = (id: number) => {
    setItems(items.filter(d => d.id !== id));
    apiFetch(`/community/discussions/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const handleClearReplies = (id: number) => {
    const next = items.map(d => (d.id === id ? { ...d, replies: [] } : d));
    setItems(next);
    apiFetch("/community/discussions", {
      method: "PUT",
      body: JSON.stringify({ discussions: next }),
    }).catch(() => {});
  };

  const handleClearAll = () => {
    const ids = items.map(d => d.id);
    setItems([]);
    Promise.all(ids.map(id => apiFetch(`/community/discussions/${id}`, { method: "DELETE" }).catch(() => {}))).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Discussions</h1>
          <p className="text-muted-foreground mt-1">Moderate discussions stored in the database.</p>
        </div>
        <div className="flex gap-2">
          <div className="w-72 max-w-full">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search discussions..." />
          </div>
          <Button variant="destructive" onClick={handleClearAll}>Clear All</Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-5">Title</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">Author</div>
          <div className="col-span-1">Views</div>
          <div className="col-span-1">Replies</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map(d => (
            <div key={d.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-5 min-w-0">
                <div className="font-medium truncate">{d.title}</div>
                <div className="text-xs text-muted-foreground truncate">{d.createdAt}</div>
              </div>
              <div className="col-span-2 text-sm text-muted-foreground truncate">{d.category}</div>
              <div className="col-span-2 text-sm text-muted-foreground truncate">{d.author}</div>
              <div className="col-span-1 text-sm text-muted-foreground">{d.views}</div>
              <div className="col-span-1 text-sm text-muted-foreground">{countReplies(d.replies || [])}</div>
              <div className="col-span-1 flex justify-end gap-1">
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
    </div>
  );
}
