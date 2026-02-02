import { useMemo, useState } from "react";
import { Download, Upload, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function collectYouthxpKeys() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith("youthxp_")) keys.push(k);
  }
  keys.sort();
  return keys;
}

export default function AdminStorage() {
  const [importText, setImportText] = useState("");

  const snapshot = useMemo(() => {
    const keys = collectYouthxpKeys();
    const data: Record<string, string> = {};
    keys.forEach(k => {
      const v = localStorage.getItem(k);
      if (v !== null) data[k] = v;
    });
    return { keys, data };
  }, []);

  const exportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      data: snapshot.data,
    };
    const text = JSON.stringify(payload, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Export copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy export to clipboard");
    });
  };

  const downloadJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      data: snapshot.data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grovix-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = () => {
    try {
      const parsed = JSON.parse(importText);
      const data = parsed?.data;
      if (!data || typeof data !== "object") {
        toast.error("Invalid backup format");
        return;
      }
      Object.entries(data as Record<string, string>).forEach(([k, v]) => {
        if (k.startsWith("youthxp_")) {
          localStorage.setItem(k, v);
        }
      });
      toast.success("Backup imported. Reload the page to apply everywhere.");
    } catch {
      toast.error("Invalid JSON");
    }
  };

  const clearAllYouthxp = () => {
    const keys = collectYouthxpKeys();
    keys.forEach(k => localStorage.removeItem(k));
    toast.success("All youthxp_* keys cleared. Reload the page.");
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <h1 className="text-2xl font-display font-bold">Storage Tools</h1>
        <p className="text-muted-foreground mt-1">
          Backup/restore demo data stored in localStorage.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 space-y-4">
          <div className="font-display font-bold">Export</div>
          <div className="text-sm text-muted-foreground">
            Export all <span className="font-mono">youthxp_*</span> keys.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportJson}>
              <Copy className="w-4 h-4" />
              Copy JSON
            </Button>
            <Button variant="outline" onClick={downloadJson}>
              <Download className="w-4 h-4" />
              Download JSON
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">Keys found: {snapshot.keys.length}</div>
        </div>

        <div className="glass-card p-6 space-y-4">
          <div className="font-display font-bold">Import</div>
          <div className="text-sm text-muted-foreground">
            Paste a backup JSON (same format as export), then import.
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className="w-full h-40 p-3 rounded-lg bg-muted/20 border border-border font-mono text-xs focus:outline-none"
            placeholder='{ "exportedAt": "...", "data": { "youthxp_users": "[...]" } }'
          />
          <div className="flex gap-2">
            <Button variant="neon" onClick={importJson}>
              <Upload className="w-4 h-4" />
              Import
            </Button>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 flex items-center justify-between">
        <div>
          <div className="font-display font-bold">Danger Zone</div>
          <div className="text-sm text-muted-foreground">Remove all demo data from localStorage.</div>
        </div>
        <Button variant="destructive" onClick={clearAllYouthxp}>
          <Trash2 className="w-4 h-4" />
          Clear All
        </Button>
      </div>
    </div>
  );
}
