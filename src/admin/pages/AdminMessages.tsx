import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  recipientId: string;
  content: string;
  timestamp: number;
  type: "text" | "image";
  imageUrl?: string;
  read: boolean;
};

type Conversation = {
  recipientId: string;
  recipientName: string;
  recipientAvatar: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
};

function isYouthxpKey(key: string) {
  return key.startsWith("youthxp_");
}

export default function AdminMessages() {
  const [query, setQuery] = useState("");
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    const next: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("youthxp_messages_") || k.startsWith("youthxp_conversations_")) {
        next.push(k);
      }
    }
    next.sort();
    setKeys(next);
  }, []);

  const filteredKeys = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return keys;
    return keys.filter(k => k.toLowerCase().includes(q));
  }, [keys, query]);

  const getPreview = (key: string): string => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      if (key.startsWith("youthxp_conversations_")) {
        const list = Array.isArray(parsed) ? (parsed as Conversation[]) : [];
        return `${list.length} conversations`;
      }
      if (key.startsWith("youthxp_messages_")) {
        const list = Array.isArray(parsed) ? (parsed as Message[]) : [];
        const last = list[list.length - 1];
        if (!last) return "0 messages";
        return `${list.length} messages • last: ${String(last.content || "").slice(0, 60)}`;
      }
      return Array.isArray(parsed) ? `${parsed.length} items` : "object";
    } catch {
      return "(invalid json)";
    }
  };

  const handleDeleteKey = (key: string) => {
    localStorage.removeItem(key);
    setKeys(prev => prev.filter(k => k !== key));
  };

  const handleClearAll = () => {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("youthxp_messages_") || k.startsWith("youthxp_conversations_")) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    setKeys(prev => prev.filter(k => !toRemove.includes(k)));
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Messages</h1>
          <p className="text-muted-foreground mt-1">Manage conversations and message threads (localStorage).</p>
        </div>
        <div className="flex gap-2">
          <div className="w-72 max-w-full">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search storage keys..." />
          </div>
          <Button variant="destructive" onClick={handleClearAll}>Clear All</Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-7">Storage Key</div>
          <div className="col-span-4">Preview</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filteredKeys.map((k) => (
            <div key={k} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-7 font-mono text-xs truncate">{k}</div>
              <div className="col-span-4 text-xs text-muted-foreground truncate">{getPreview(k)}</div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => handleDeleteKey(k)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {filteredKeys.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No message data found.</div>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Only keys starting with <span className="font-mono">youthxp_messages_</span> and <span className="font-mono">youthxp_conversations_</span> are shown.
      </div>
    </div>
  );
}
