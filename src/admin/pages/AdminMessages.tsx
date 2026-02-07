import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type ConversationRow = {
  id: string;
  type: string;
  name: string | null;
  updatedAt: string;
  createdAt: string;
  createdBy: string;
  participants: Array<{ userId: string; name: string; avatarUrl: string | null; role: string; joinedAt: string | null }>;
  lastMessage: {
    id: string;
    type: string;
    createdAt: string;
    sender: { id: string; name: string; avatarUrl: string | null };
    preview: string;
  } | null;
};

type MessageRow = {
  id: string;
  senderId: string;
  sender: { id: string; name: string; avatarUrl: string | null };
  type: string;
  ivB64: string;
  ciphertextB64: string;
  createdAt: string;
};

export default function AdminMessages() {
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ conversations: ConversationRow[] }>("/chat/admin/conversations?limit=200")
      .then((d) => setConversations(Array.isArray(d?.conversations) ? d.conversations : []))
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      if (String(c.id).toLowerCase().includes(q)) return true;
      if (String(c.type).toLowerCase().includes(q)) return true;
      if (String(c.name || "").toLowerCase().includes(q)) return true;
      if (String(c.lastMessage?.preview || "").toLowerCase().includes(q)) return true;
      if ((c.participants || []).some((p) => String(p.name || "").toLowerCase().includes(q))) return true;
      return false;
    });
  }, [conversations, query]);

  const loadMessages = async (conversationId: string) => {
    setSelectedId(conversationId);
    const d = await apiFetch<{ messages: MessageRow[] }>(`/chat/admin/conversations/${encodeURIComponent(conversationId)}/messages?limit=100`);
    setMessages(Array.isArray(d?.messages) ? d.messages : []);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Messages</h1>
          <p className="text-muted-foreground mt-1">View chat conversations stored in the database.</p>
        </div>
        <div className="flex gap-2">
          <div className="w-72 max-w-full">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations/users..." />
          </div>
          {loading && <div className="text-xs text-muted-foreground self-center">Loading…</div>}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
            <div className="col-span-5">Conversation</div>
            <div className="col-span-5">Participants</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          <div className="divide-y divide-border">
            {filtered.map((c) => (
              <div key={c.id} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${selectedId === c.id ? "bg-muted/20" : ""}`}>
                <div className="col-span-5 min-w-0">
                  <div className="text-sm font-medium truncate">{c.type === "GROUP" ? (c.name || "Group") : "Direct"}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.lastMessage?.preview || "No messages"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.id}</div>
                </div>
                <div className="col-span-5 text-xs text-muted-foreground truncate">
                  {(c.participants || []).map((p) => p.name).join(", ")}
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => void loadMessages(c.id)}>
                    <Eye className="w-4 h-4" />
                    View
                  </Button>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No conversations found.</div>
            )}
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="font-display font-bold">Messages</div>
            <div className="text-xs text-muted-foreground">{selectedId ? `Conversation: ${selectedId}` : "Select a conversation"}</div>
          </div>

          <div className="divide-y divide-border max-h-[560px] overflow-auto">
            {messages.map((m) => (
              <div key={m.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate">{m.sender?.name || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{m.type}</div>
                <div className="text-xs font-mono text-muted-foreground mt-2 break-all">ciphertext: {String(m.ciphertextB64 || "").slice(0, 180)}{String(m.ciphertextB64 || "").length > 180 ? "…" : ""}</div>
              </div>
            ))}

            {selectedId && messages.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No messages found.</div>
            )}

            {!selectedId && (
              <div className="p-8 text-center text-muted-foreground">Pick a conversation to view messages.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
