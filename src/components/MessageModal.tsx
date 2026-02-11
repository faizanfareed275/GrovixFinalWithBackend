import { useState, useRef, useEffect, useMemo, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Image,
  Paperclip,
  Smile,
  Phone,
  Video,
  MoreVertical,
  Pencil,
  Trash2,
  Pin,
  Plus,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { CallModal } from "@/components/CallModal";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { toast } from "sonner";

const PAYLOAD_PREFIX = "grovix_payload:";

type ImageDraft = { id: string; dataUrl: string; name?: string };

function parsePayload(
  plaintext: string | undefined
):
  | { kind: "text"; text: string }
  | { kind: "file"; name: string; mime: string; dataUrl: string; size?: number }
  | { kind: "album"; items: { dataUrl: string; name?: string; mime?: string }[]; caption?: string } {
  const raw = String(plaintext || "");
  if (raw.startsWith(PAYLOAD_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(PAYLOAD_PREFIX.length)) as unknown;
      const p = (parsed && typeof parsed === "object") ? (parsed as { t?: unknown; name?: unknown; mime?: unknown; dataUrl?: unknown; size?: unknown; items?: unknown; caption?: unknown; text?: unknown }) : null;
      if (p && p.t === "file") {
        return {
          kind: "file",
          name: String(p.name || "file"),
          mime: String(p.mime || "application/octet-stream"),
          dataUrl: String(p.dataUrl || ""),
          size: p.size === undefined ? undefined : Number(p.size),
        };
      }
      if (p && p.t === "album") {
        const itemsRaw = Array.isArray(p.items) ? p.items : [];
        return {
          kind: "album",
          items: itemsRaw
            .map((it) => {
              const o = (it && typeof it === "object") ? (it as { dataUrl?: unknown; name?: unknown; mime?: unknown }) : null;
              return {
                dataUrl: String(o?.dataUrl || ""),
                name: o?.name ? String(o.name) : undefined,
                mime: o?.mime ? String(o.mime) : undefined,
              };
            })
            .filter((it) => !!it.dataUrl),
          caption: p.caption ? String(p.caption) : undefined,
        };
      }
      if (p && p.t === "text") {
        return { kind: "text", text: String(p.text || "") };
      }
    } catch {
      void 0;
    }
  }
  return { kind: "text", text: raw };
}

function triggerDownload(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function isImageUrl(s: string | undefined): boolean {
  const v = String(s || "");
  return v.startsWith("data:image/") || v.startsWith("http");
}

function readFilesAsImageDrafts(files: File[] | FileList): Promise<ImageDraft[]> {
  const list = Array.isArray(files) ? files : Array.from(files);
  return Promise.all(
    list
      .filter((f) => String(f?.type || "").startsWith("image/"))
      .map(
        (file) =>
          new Promise<ImageDraft>((resolve, reject) => {
            const r = new FileReader();
            r.onerror = () => reject(new Error("read_failed"));
            r.onload = () => {
              const dataUrl = String(r.result || "");
              resolve({ id: crypto.randomUUID(), dataUrl, name: file.name });
            };
            r.readAsDataURL(file);
          })
      )
  );
}

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string;
}

export function MessageModal({ 
  isOpen, 
  onClose, 
  recipientId,
  recipientName, 
  recipientAvatar,
}: MessageModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeMessages, createDirectConversation, openConversation, sendMessage, sendTyping, editMessage, deleteMessage, startCall, respondToCall } = useChat(user?.id || null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  const [newMessage, setNewMessage] = useState("");
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callType, setCallType] = useState<"audio" | "video">("audio");
  const [callIncoming, setCallIncoming] = useState<{ callId: string; conversationId: string; fromUserId: string; callType: "audio" | "video" } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingSelfTimerRef = useRef<number | null>(null);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [albumOpen, setAlbumOpen] = useState(false);
  const [albumDrafts, setAlbumDrafts] = useState<ImageDraft[]>([]);
  const [albumCaption, setAlbumCaption] = useState<string>("");
  const [albumBusy, setAlbumBusy] = useState(false);
  const albumAddInputRef = useRef<HTMLInputElement>(null);

  const [pinsOpen, setPinsOpen] = useState(false);
  const [pins, setPins] = useState<{ messageId: string; pinnedBy: string; createdAt: string }[]>([]);
  const messageRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerItems, setViewerItems] = useState<{ url: string; name?: string }[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  const openViewer = (items: { url: string; name?: string }[], idx: number) => {
    if (!items.length) return;
    const safeIdx = Math.min(Math.max(idx, 0), items.length - 1);
    setViewerItems(items);
    setViewerIndex(safeIdx);
    setViewerOpen(true);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && recipientId) {
      createDirectConversation(recipientId)
        .then((id) => {
          setConversationId(id);
          openConversation(id);
        })
        .catch(() => {
          void 0;
        });
    }
  }, [isOpen, recipientId, createDirectConversation, openConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages]);

  useEffect(() => {
    return () => {
      if (typingSelfTimerRef.current) window.clearTimeout(typingSelfTimerRef.current);
      typingSelfTimerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setPins([]);
      return;
    }
    fetch(`${import.meta.env?.VITE_GROVIX_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`}/chat/conversations/${encodeURIComponent(conversationId)}/pins`, {
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) throw r;
        return await r.json();
      })
      .then((d: unknown) => {
        const pinsRaw = (d && typeof d === "object") ? (d as { pins?: unknown }).pins : undefined;
        setPins(Array.isArray(pinsRaw) ? (pinsRaw as { messageId: string; pinnedBy: string; createdAt: string }[]) : []);
      })
      .catch(() => setPins([]));
  }, [conversationId]);

  // Listen for new messages in real-time
  useEffect(() => {
    const onIncoming = (e: Event) => {
      const detail = (e as CustomEvent).detail as unknown;
      if (!detail || typeof detail !== "object") return;
      const d = detail as { callId?: unknown; conversationId?: unknown; fromUserId?: unknown; callType?: unknown };
      if (!conversationId) return;
      if (String(d?.conversationId || "") !== String(conversationId)) return;
      if (!d?.callId || !d?.fromUserId) return;
      setCallIncoming({
        callId: String(d.callId),
        conversationId: String(d.conversationId),
        fromUserId: String(d.fromUserId),
        callType: d.callType === "video" ? "video" : "audio",
      });
      setCallType(d.callType === "video" ? "video" : "audio");
      setCallModalOpen(true);
    };

    const onResponse = (e: Event) => {
      const detail = (e as CustomEvent).detail as unknown;
      if (!detail || typeof detail !== "object") return;
      const d = detail as { callId?: unknown; accepted?: unknown };
      if (!d?.callId) return;
      if (!d?.accepted) setCallModalOpen(false);
    };

    window.addEventListener("chat:call:incoming", onIncoming);
    window.addEventListener("chat:call:response", onResponse);
    return () => {
      window.removeEventListener("chat:call:incoming", onIncoming);
      window.removeEventListener("chat:call:response", onResponse);
    };
  }, [conversationId, recipientId, user?.id]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !user || !conversationId) return;
    sendMessage(conversationId, newMessage, "TEXT").catch((e: unknown) => {
      const msg = String((e && typeof e === "object" ? (e as { message?: unknown }).message : "") || "");
      if (msg === "missing_room_key") {
        window.alert("You can't send messages yet on this device. Import your chat key backup or ask an admin to share the key.");
      }
    });
    setNewMessage("");
    sendTyping(conversationId, false);
    setShowEmojiPicker(false);
  };

  const sendAlbum = async () => {
    if (!conversationId || !albumDrafts.length) return;
    setAlbumBusy(true);
    try {
      const payload = `${PAYLOAD_PREFIX}${JSON.stringify({
        t: "album",
        items: albumDrafts.map((d) => ({ dataUrl: d.dataUrl, name: d.name })),
        caption: albumCaption.trim() ? albumCaption.trim() : undefined,
      })}`;
      await sendMessage(conversationId, payload, "TEXT");
      setAlbumOpen(false);
      setAlbumDrafts([]);
      setAlbumCaption("");
    } catch (e: unknown) {
      const msg = String((e && typeof e === "object" ? (e as { message?: unknown }).message : "") || "");
      if (msg === "missing_room_key") {
        window.alert("You can't send messages yet on this device. Import your chat key backup or ask an admin to share the key.");
      } else {
        toast.error("Failed to send album");
      }
    } finally {
      setAlbumBusy(false);
    }
  };

  const addAlbumFiles = async (files: FileList | null | undefined) => {
    if (!files || !files.length) return;
    try {
      const drafts = await readFilesAsImageDrafts(files);
      if (!drafts.length) return;
      setAlbumDrafts((prev) => [...prev, ...drafts]);
    } catch {
      toast.error("Failed to read images");
    }
  };

  const removeAlbumDraft = (id: string) => {
    setAlbumDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSendImage = (imageData: string) => {
    if (!imageData || !user || !conversationId) return;
    sendMessage(conversationId, imageData, "IMAGE").catch((e: unknown) => {
      const msg = String((e && typeof e === "object" ? (e as { message?: unknown }).message : "") || "");
      if (msg === "missing_room_key") {
        window.alert("You can't send messages yet on this device. Import your chat key backup or ask an admin to share the key.");
      }
    });
    setShowEmojiPicker(false);
  };

  const handleSendFile = (file: File) => {
    if (!user || !conversationId) return;
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("File is too large (max 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) return;
      const payload = `${PAYLOAD_PREFIX}${JSON.stringify({ t: "file", name: file.name, mime: file.type || "application/octet-stream", dataUrl, size: file.size })}`;
      sendMessage(conversationId, payload, "TEXT").catch((e: unknown) => {
        const msg = String((e && typeof e === "object" ? (e as { message?: unknown }).message : "") || "");
        if (msg === "missing_room_key") {
          window.alert("You can't send messages yet on this device. Import your chat key backup or ask an admin to share the key.");
        }
      });
    };
    reader.readAsDataURL(file);
    setShowEmojiPicker(false);
  };

  const handleCall = (type: "audio" | "video") => {
    setCallType(type);
    setCallModalOpen(true);
    if (conversationId) {
      startCall(conversationId, type).catch(() => {
        void 0;
      });
    }
  };

  const handleStartEdit = (m: ChatMessage) => {
    const parsed = parsePayload(m.plaintext);
    if (m.type !== "TEXT" || parsed.kind !== "text") return;
    setEditingMessageId(m.id);
    setEditingValue(parsed.text);
  };

  const handleSaveEdit = async () => {
    if (!user || !conversationId || !editingMessageId) return;
    try {
      await editMessage(conversationId, editingMessageId, editingValue);
      setEditingMessageId(null);
      setEditingValue("");
    } catch {
      toast.error("Failed to edit message");
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !conversationId || !deleteTargetId) return;
    try {
      await deleteMessage(conversationId, deleteTargetId);
      setDeleteTargetId(null);
    } catch {
      toast.error("Failed to delete message");
    }
  };

  const handlePinMessage = async (messageId: string) => {
    if (!conversationId) return;
    try {
      const isPinned = pins.some((p) => p.messageId === messageId);
      if (isPinned) {
        const resp = await fetch(`${import.meta.env?.VITE_GROVIX_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`}/chat/conversations/${encodeURIComponent(conversationId)}/pins/${encodeURIComponent(messageId)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!resp.ok) {
          if (resp.status === 501) return toast.error("Pinning is not enabled on the server yet");
          return toast.error("Failed to unpin message");
        }
        setPins((prev) => prev.filter((p) => p.messageId !== messageId));
        toast.success("Unpinned");
        return;
      }

      const resp = await fetch(`${import.meta.env?.VITE_GROVIX_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`}/chat/conversations/${encodeURIComponent(conversationId)}/pins`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });

      if (!resp.ok) {
        if (resp.status === 501) return toast.error("Pinning is not enabled on the server yet");
        return toast.error("Failed to pin message");
      }

      setPinsOpen(true);
      fetch(`${import.meta.env?.VITE_GROVIX_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`}/chat/conversations/${encodeURIComponent(conversationId)}/pins`, {
        credentials: "include",
      })
        .then(async (r) => (r.ok ? await r.json() : null))
        .then((d: unknown) => {
          const pinsRaw = (d && typeof d === "object") ? (d as { pins?: unknown }).pins : undefined;
          if (Array.isArray(pinsRaw)) setPins(pinsRaw as { messageId: string; pinnedBy: string; createdAt: string }[]);
        })
        .catch(() => {
          void 0;
        });

      toast.success("Pinned");
    } catch {
      toast.error("Failed to pin/unpin message");
    }
  };

  const handleEmojiSelect = (emoji: unknown) => {
    const native = (emoji && typeof emoji === "object") ? (emoji as { native?: unknown }).native : undefined;
    if (typeof native !== "string") return;
    setNewMessage((prev) => prev + native);
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !user || !conversationId) return;
    readFilesAsImageDrafts(files)
      .then((drafts) => {
        if (!drafts.length) return;
        setAlbumDrafts(drafts);
        setAlbumCaption("");
        setAlbumOpen(true);
      })
      .catch(() => toast.error("Failed to read images"));
    e.currentTarget.value = "";
  };

  const pinnedSet = useMemo(() => new Set(pins.map((p) => p.messageId)), [pins]);

  const renderItems = useMemo(() => {
    const list = Array.isArray(activeMessages) ? activeMessages : [];
    const out: Array<
      | { kind: "album"; senderId: string; createdAt: string; caption?: string; sourceMessageId?: string; images: { id: string; dataUrl: string }[] }
      | { kind: "message"; message: ChatMessage }
    > = [];

    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (String(m.type) === "TEXT") {
        const parsed = parsePayload(m.plaintext);
        if (parsed.kind === "album" && parsed.items.length) {
          out.push({
            kind: "album",
            senderId: String(m.senderId),
            createdAt: String(m.createdAt),
            caption: parsed.caption,
            sourceMessageId: String(m.id),
            images: parsed.items.map((it, idx) => ({ id: `${m.id}:${idx}`, dataUrl: it.dataUrl })),
          });
          continue;
        }
      }

      if (String(m.type) === "IMAGE" && isImageUrl(m.plaintext)) {
        const group: ChatMessage[] = [m];
        while (i + 1 < list.length) {
          const n = list[i + 1];
          if (String(n.type) !== "IMAGE" || String(n.senderId) !== String(m.senderId) || !isImageUrl(n.plaintext)) break;
          const a = new Date(String(m.createdAt)).getTime();
          const b = new Date(String(n.createdAt)).getTime();
          if (Math.abs(b - a) > 2 * 60 * 1000) break;
          group.push(n);
          i++;
        }
        if (group.length >= 2) {
          out.push({
            kind: "album",
            senderId: String(m.senderId),
            createdAt: String(group[group.length - 1].createdAt),
            images: group.map((x) => ({ id: String(x.id), dataUrl: String(x.plaintext || "") })),
          });
          continue;
        }
      }

      out.push({ kind: "message", message: m });
    }
    return out;
  }, [activeMessages]);

  const pinnedPreview = (messageId: string): string => {
    const m = activeMessages.find((x) => String(x?.id) === messageId);
    if (!m) return "Message";
    if (String(m.type) === "IMAGE") return "📷 Image";
    const parsed = parsePayload(m.plaintext);
    if (parsed.kind === "file") return `📎 ${parsed.name}`;
    if (parsed.kind === "album") {
      const n = parsed.items.length;
      return n ? `📷 Photos (${n})` : "📷 Photos";
    }
    const t = parsed.text.trim();
    return t ? (t.length > 40 ? `${t.slice(0, 40)}…` : t) : "Encrypted message";
  };

  const formatTime = (iso: string): string => {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Modal - Compact Chat Widget Style */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-0 right-0 md:bottom-4 md:right-4 w-full md:w-[400px] h-[100dvh] md:h-[600px] z-[100] flex flex-col pointer-events-none"
            >
              <div className="glass-card mx-0 md:mx-0 flex flex-col h-full overflow-hidden rounded-none md:rounded-2xl border-none md:border shadow-2xl pointer-events-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border shrink-0 bg-background/50 backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => {
                      if (!recipientId) return;
                      navigate(recipientId === user?.id ? "/profile" : `/candidates/${recipientId}`);
                    }}
                    className="flex items-center gap-3 text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-neon flex items-center justify-center text-sm font-bold text-primary-foreground dark:text-cyber-dark">
                      {recipientAvatar}
                    </div>
                    <div>
                      <h2 className="font-display font-bold">{recipientName}</h2>
                      <p className="text-xs text-accent">Online</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPinsOpen(true)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Pinned"
                    >
                      <Pin className="w-5 h-5 text-muted-foreground" />
                    </button>
                    <button 
                      onClick={() => handleCall("audio")}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Phone className="w-5 h-5 text-muted-foreground" />
                    </button>
                    <button 
                      onClick={() => handleCall("video")}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Video className="w-5 h-5 text-muted-foreground" />
                    </button>
                    <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                      <MoreVertical className="w-5 h-5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 scrollbar-cyber">
                  {activeMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    renderItems.map((item, idx) => {
                      if (item.kind === "album") {
                        const isMine = item.senderId === user?.id;
                        const cols = item.images.length <= 2 ? 2 : item.images.length <= 4 ? 2 : 3;
                        const key = item.sourceMessageId || `album_${idx}`;
                        return (
                          <motion.div
                            key={key}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              ref={(el) => {
                                if (item.sourceMessageId) messageRefs.current.set(item.sourceMessageId, el);
                              }}
                              className={`max-w-[80%] px-3 py-3 rounded-2xl ${
                                isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                              }`}
                            >
                              <div className={`grid gap-1 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                                {item.images.slice(0, 9).map((im) => (
                                  <button
                                    key={im.id}
                                    type="button"
                                    onClick={() =>
                                      openViewer(
                                        item.images.map((x, i) => ({ url: x.dataUrl, name: `photo_${i + 1}.png` })),
                                        item.images.findIndex((x) => x.id === im.id)
                                      )
                                    }
                                    className="block"
                                  >
                                    <img src={im.dataUrl} alt="Shared image" className="w-full h-24 sm:h-28 object-cover rounded-md" />
                                  </button>
                                ))}
                              </div>
                              {item.caption && <div className="mt-2 text-sm whitespace-pre-wrap">{item.caption}</div>}
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <p className={`text-xs ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                  {formatTime(item.createdAt)}
                                </p>
                                {isMine && item.sourceMessageId && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="p-1 rounded-md hover:bg-black/20">
                                        <MoreVertical className={`w-4 h-4 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`} />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handlePinMessage(item.sourceMessageId!)}>
                                        <Pin className="w-4 h-4 mr-2" />
                                        {pinnedSet.has(item.sourceMessageId!) ? "Unpin" : "Pin"}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setDeleteTargetId(item.sourceMessageId!)}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      const message: ChatMessage = item.message;
                      const parsed = String(message.type) === "TEXT" ? parsePayload(message.plaintext) : null;
                      const isMine = message.senderId === user?.id;
                      return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${message.senderId === user?.id ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          ref={(el) => {
                            messageRefs.current.set(String(message.id), el);
                          }}
                          className="max-w-[80%]"
                        >
                          <div
                            className={`px-4 py-2 rounded-2xl ${
                              message.senderId === user?.id
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm"
                            }`}
                          >
                            {message.type === "IMAGE" ? (
                              isImageUrl(message.plaintext) ? (
                                <button
                                  type="button"
                                  onClick={() => openViewer([{ url: String(message.plaintext), name: `image_${String(message.id)}.png` }], 0)}
                                >
                                  <img src={String(message.plaintext)} alt="Shared image" className="max-w-full rounded-lg" />
                                </button>
                              ) : (
                                <p className="text-sm">📷 Image</p>
                              )
                            ) : String(message.type) === "TEXT" && parsed?.kind === "file" ? (
                              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                                <div className="text-sm font-medium truncate">{parsed.name}</div>
                                <div className="text-xs opacity-70 truncate">{parsed.mime}</div>
                                <div className="mt-2 flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(parsed.dataUrl, "_blank", "noopener,noreferrer")}
                                  >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Open
                                  </Button>
                                  <Button size="sm" variant="neon" onClick={() => triggerDownload(parsed.dataUrl, parsed.name)}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {editingMessageId === String(message.id) ? (
                                  <div className="space-y-2">
                                    <Textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="bg-muted/20" />
                                    <div className="flex items-center justify-end gap-2">
                                      <Button size="sm" variant="outline" onClick={() => { setEditingMessageId(null); setEditingValue(""); }}>
                                        Cancel
                                      </Button>
                                      <Button size="sm" variant="neon" onClick={handleSaveEdit}>
                                        Save
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm whitespace-pre-wrap">{parsed && parsed.kind === "text" ? parsed.text : (message.plaintext || "Encrypted message")}</p>
                                )}
                              </>
                            )}

                            <div className="mt-1 flex items-center justify-between gap-2">
                              <p className={`text-xs ${message.senderId === user?.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                {formatTime(message.createdAt)}
                              </p>

                              {message.senderId === user?.id && editingMessageId !== String(message.id) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="p-1 rounded-md hover:bg-black/20">
                                      <MoreVertical className={`w-4 h-4 ${message.senderId === user?.id ? "text-primary-foreground/70" : "text-muted-foreground"}`} />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {String(message.type) === "TEXT" && parsed?.kind === "text" && (
                                      <DropdownMenuItem onClick={() => handleStartEdit(message)}>
                                        <Pencil className="w-4 h-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => handlePinMessage(String(message.id))}>
                                      <Pin className="w-4 h-4 mr-2" />
                                      {pinnedSet.has(String(message.id)) ? "Unpin" : "Pin"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setDeleteTargetId(String(message.id))}>
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 sm:p-4 border-t border-border shrink-0 relative bg-background/50 backdrop-blur-sm">
                  {/* Emoji Picker */}
                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-4 mb-2 z-10"
                      >
                        <Picker 
                          data={data} 
                          onEmojiSelect={handleEmojiSelect}
                          theme="dark"
                          previewPosition="none"
                          skinTonePosition="none"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      ref={imageInputRef}
                      accept="image/*" 
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSendFile(file);
                        e.currentTarget.value = "";
                      }}
                    />
                    <button 
                      onClick={() => imageInputRef.current?.click()}
                      className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-primary"
                    >
                      <Image className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-primary"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`p-2 hover:bg-muted rounded-lg transition-colors ${showEmojiPicker ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                    <Input
                      value={newMessage}
                      onChange={(e) => {
                        const v = e.target.value;
                        setNewMessage(v);
                        if (!conversationId) return;
                        if (!v.trim()) {
                          sendTyping(conversationId, false);
                          return;
                        }
                        sendTyping(conversationId, true);
                        if (typingSelfTimerRef.current) window.clearTimeout(typingSelfTimerRef.current);
                        typingSelfTimerRef.current = window.setTimeout(() => {
                          sendTyping(conversationId, false);
                        }, 1400);
                      }}
                      placeholder="Type a message..."
                      className="flex-1 bg-muted/50"
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      onFocus={() => setShowEmojiPicker(false)}
                    />
                    <Button variant="neon" size="icon" onClick={handleSendMessage}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Call Modal */}
      <CallModal
        isOpen={callModalOpen}
        onClose={() => {
          setCallIncoming(null);
          setCallModalOpen(false);
        }}
        recipientName={recipientName}
        recipientAvatar={recipientAvatar}
        callType={callType}
        isIncoming={!!callIncoming}
        onAccept={() => {
          if (!callIncoming) return;
          respondToCall(callIncoming.callId, callIncoming.conversationId, callIncoming.fromUserId, true).catch(() => {
            void 0;
          });
        }}
        onDecline={() => {
          if (!callIncoming) return;
          respondToCall(callIncoming.callId, callIncoming.conversationId, callIncoming.fromUserId, false).catch(() => {
            void 0;
          });
          setCallModalOpen(false);
        }}
      />

      <AlertDialog open={!!deleteTargetId} onOpenChange={(v) => { if (!v) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTargetId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={albumOpen}
        onOpenChange={(v) => {
          setAlbumOpen(v);
          if (!v) {
            setAlbumDrafts([]);
            setAlbumCaption("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send photos</DialogTitle>
          </DialogHeader>

          <input
            ref={albumAddInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addAlbumFiles(e.target.files).catch(() => {
                void 0;
              });
              e.currentTarget.value = "";
            }}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Selected: {albumDrafts.length}</div>
              <Button variant="outline" size="sm" onClick={() => albumAddInputRef.current?.click()}>
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {albumDrafts.map((d) => (
                <div key={d.id} className="relative rounded-lg overflow-hidden border border-border">
                  <img src={d.dataUrl} alt="Preview" className="w-full h-24 object-cover" />
                  <button
                    type="button"
                    onClick={() => removeAlbumDraft(d.id)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {!albumDrafts.length && (
                <div className="col-span-3 sm:col-span-4 text-sm text-muted-foreground p-6 text-center border border-dashed border-border rounded-lg">
                  Select photos to preview them here.
                </div>
              )}
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-2">Caption (optional)</div>
              <Textarea value={albumCaption} onChange={(e) => setAlbumCaption(e.target.value)} placeholder="Add a caption…" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAlbumOpen(false)} disabled={albumBusy}>
              Cancel
            </Button>
            <Button variant="neon" onClick={sendAlbum} disabled={albumBusy || !albumDrafts.length}>
              {albumBusy ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pinsOpen} onOpenChange={setPinsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Pinned</DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-72 rounded-lg border border-border">
            <div className="p-2 space-y-1">
              {pins.map((p) => (
                <div key={p.messageId} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{pinnedPreview(String(p.messageId))}</div>
                    <div className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPinsOpen(false);
                        const el = messageRefs.current.get(p.messageId);
                        if (el) window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
                      }}
                    >
                      View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePinMessage(p.messageId)}>
                      Unpin
                    </Button>
                  </div>
                </div>
              ))}
              {!pins.length && <div className="p-4 text-sm text-muted-foreground">No pinned messages.</div>}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPinsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Media</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={viewerIndex <= 0}
              onClick={() => setViewerIndex((i) => Math.max(i - 1, 0))}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Prev
            </Button>

            <div className="text-sm text-muted-foreground">
              {viewerItems.length ? viewerIndex + 1 : 0}/{viewerItems.length}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={viewerIndex >= viewerItems.length - 1}
              onClick={() => setViewerIndex((i) => Math.min(i + 1, viewerItems.length - 1))}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="mt-3 rounded-lg border border-border bg-black/10 flex items-center justify-center overflow-hidden">
            {viewerItems[viewerIndex]?.url ? (
              <img src={viewerItems[viewerIndex].url} alt="Preview" className="max-h-[70vh] w-auto object-contain" />
            ) : (
              <div className="p-10 text-sm text-muted-foreground">No media</div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                const u = viewerItems[viewerIndex]?.url;
                if (u) window.open(u, "_blank", "noopener,noreferrer");
              }}
              disabled={!viewerItems[viewerIndex]?.url}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open
            </Button>
            <Button
              variant="neon"
              onClick={() => {
                const u = viewerItems[viewerIndex]?.url;
                if (u) triggerDownload(u, viewerItems[viewerIndex]?.name);
              }}
              disabled={!viewerItems[viewerIndex]?.url}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
