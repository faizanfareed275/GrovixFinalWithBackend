import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type Post = {
  id: number;
  userId: string;
  user: string;
  content: string;
  timeAgo?: string;
  likes?: number;
};

export default function AdminCommunity() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiFetch<{ posts: Post[] }>("/community/posts")
      .then((d) => {
        if (Array.isArray(d.posts)) setPosts(d.posts);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(p => (p.user || "").toLowerCase().includes(q) || (p.content || "").toLowerCase().includes(q));
  }, [posts, query]);

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
          <Button variant="destructive" onClick={handleClear}>
            Clear
          </Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-3">Author</div>
          <div className="col-span-8">Content</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map(p => (
            <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-start">
              <div className="col-span-3">
                <div className="font-medium truncate">{p.user}</div>
                <div className="text-xs text-muted-foreground truncate">{p.userId}</div>
              </div>
              <div className="col-span-8 text-sm text-foreground whitespace-pre-line break-words">
                {p.content}
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
