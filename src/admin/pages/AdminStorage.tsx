import { useEffect, useMemo, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type StoredFileRow = {
  id: string;
  purpose: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string | null;
  externalUrl: string | null;
  createdAt: string;
};

export default function AdminStorage() {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<StoredFileRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async (q?: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      qs.set("limit", "200");
      const d = await apiFetch<{ files: StoredFileRow[] }>(`/files/admin/list?${qs.toString()}`);
      setFiles(Array.isArray(d?.files) ? d.files : []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load("");
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => {
      if (String(f.id).toLowerCase().includes(q)) return true;
      if (String(f.fileName).toLowerCase().includes(q)) return true;
      if (String(f.mimeType).toLowerCase().includes(q)) return true;
      if (String(f.purpose).toLowerCase().includes(q)) return true;
      return false;
    });
  }, [files, query]);

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/files/admin/${encodeURIComponent(id)}`, { method: "DELETE" });
      setFiles((prev) => prev.filter((f) => f.id !== id));
      toast.success("File deleted");
    } catch {
      toast.error("Failed to delete file");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <h1 className="text-2xl font-display font-bold">Storage Tools</h1>
        <p className="text-muted-foreground mt-1">
          Browse files stored in the database.
        </p>
      </div>

      <div className="glass-card p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-display font-bold">Files</div>
          <div className="text-sm text-muted-foreground">Search by id, file name, purpose, or mime type.</div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-80 max-w-full">
            <Input
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                void load(v.trim());
              }}
              placeholder="Search files..."
            />
          </div>
          {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-4">File</div>
          <div className="col-span-2">Purpose</div>
          <div className="col-span-3">Type</div>
          <div className="col-span-2">Created</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((f) => (
            <div key={f.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-4 min-w-0">
                <div className="text-sm font-medium truncate">{f.fileName}</div>
                <div className="text-[11px] text-muted-foreground truncate">{f.id} • {(Number(f.sizeBytes || 0) / 1024).toFixed(1)} KB</div>
              </div>
              <div className="col-span-2 text-xs text-muted-foreground truncate">{f.purpose}</div>
              <div className="col-span-3 text-xs text-muted-foreground truncate">{f.mimeType}</div>
              <div className="col-span-2 text-xs text-muted-foreground truncate">{new Date(f.createdAt).toLocaleDateString()}</div>
              <div className="col-span-1 flex justify-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/files/${encodeURIComponent(f.id)}`, "_blank")}
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void handleDelete(f.id)} title="Delete">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No files found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
