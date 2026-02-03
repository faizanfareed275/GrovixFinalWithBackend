import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, MessageCircle, MoreVertical, 
  ArrowLeft, Send, Image, Smile, Phone, Video, Paperclip, Pencil, Trash2, Pin, X, Plus, Download, ExternalLink, ChevronLeft, ChevronRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useChat, ChatConversation, ChatMessage } from "@/hooks/useChat";
import { CallModal } from "@/components/CallModal";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
import { exportDeviceKeyBackup, importDeviceKeyBackup } from "@/lib/chatCrypto";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { toast } from "sonner";

const PAYLOAD_PREFIX = "grovix_payload:";

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

function getDirectOtherUserId(conversation: ChatConversation, viewerId: string | undefined | null): string | null {
  if (!viewerId) return null;
  if (conversation.type !== "DIRECT") return null;
  const other = (conversation.members || [])
    .map((m) => String((m as { userId?: string }).userId || ""))
    .find((id) => id && id !== viewerId);
  return other || null;
}

type ImageDraft = { id: string; dataUrl: string; name?: string };
type RenderItem =
  | { kind: "message"; message: ChatMessage }
  | {
      kind: "album";
      senderId: string;
      images: { id: string; dataUrl: string }[];
      caption?: string;
      sourceMessageId?: string;
      createdAt: string;
    };

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

type SearchUser = {
  id: string;
  name: string;
  avatar?: string;
  avatarUrl?: string | null;
};

type GroupParticipant = {
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  name: string;
  avatarUrl?: string | null;
};

export default function Messages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    conversations,
    activeMessages,
    loadConversations,
    openConversation,
    createGroupConversation,
    fetchParticipants,
    addMembers,
    promoteMember,
    reshareRoomKey,
    sendMessage,
    sendTyping,
    editMessage,
    deleteMessage,
    startCall,
    respondToCall,
  } = useChat(user?.id || null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callType, setCallType] = useState<"audio" | "video">("audio");
  const [callIncoming, setCallIncoming] = useState<{ callId: string; conversationId: string; fromUserId: string; callType: "audio" | "video" } | null>(null);

  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<SearchUser[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [manageGroupOpen, setManageGroupOpen] = useState(false);
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const [myRole, setMyRole] = useState<"OWNER" | "ADMIN" | "MEMBER">("MEMBER");
  const [manageSearch, setManageSearch] = useState("");
  const [manageResults, setManageResults] = useState<SearchUser[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);

  const [backupOpen, setBackupOpen] = useState(false);
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [backupBlob, setBackupBlob] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [importBlob, setImportBlob] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [reshareBusy, setReshareBusy] = useState(false);

  const [conversationStats, setConversationStats] = useState<{ totalMessages: number; totalReceived: number } | null>(null);
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

  const [typingFromUserIds, setTypingFromUserIds] = useState<Record<string, true>>({});
  const typingStopTimerRef = useRef<number | null>(null);
  const typingSelfTimerRef = useRef<number | null>(null);

  const messageRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerItems, setViewerItems] = useState<{ url: string; name?: string }[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedConversation) {
      openConversation(selectedConversation.id);
    }
  }, [selectedConversation, openConversation]);

  useEffect(() => {
    setTypingFromUserIds({});
  }, [selectedConversation?.id]);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
      if (typingSelfTimerRef.current) window.clearTimeout(typingSelfTimerRef.current);
      typingSelfTimerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onTyping = (e: Event) => {
      const detail = (e as CustomEvent).detail as unknown;
      if (!detail || typeof detail !== "object") return;
      const d = detail as { conversationId?: unknown; userId?: unknown; isTyping?: unknown };
      const conversationId = String(d.conversationId || "");
      const fromUserId = String(d.userId || "");
      const isTyping = !!d.isTyping;

      if (!selectedConversation?.id) return;
      if (conversationId !== String(selectedConversation.id)) return;
      if (!fromUserId || fromUserId === String(user?.id || "")) return;

      setTypingFromUserIds((prev) => {
        const next = { ...prev };
        if (isTyping) next[fromUserId] = true;
        else delete next[fromUserId];
        return next;
      });

      if (typingStopTimerRef.current) window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = window.setTimeout(() => {
        setTypingFromUserIds({});
      }, 2500);
    };

    window.addEventListener("chat:typing", onTyping);
    return () => {
      window.removeEventListener("chat:typing", onTyping);
    };
  }, [selectedConversation?.id, user?.id]);

  useEffect(() => {
    const conversationId = selectedConversation?.id;
    if (!conversationId) {
      setPins([]);
      return;
    }
    apiFetch<{ pins: { messageId: string; pinnedBy: string; createdAt: string }[] }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/pins`
    )
      .then((d) => setPins(Array.isArray(d?.pins) ? d.pins : []))
      .catch((e: unknown) => {
        const status = (e && typeof e === "object") ? (e as { status?: unknown }).status : undefined;
        if (Number(status) === 501) setPins([]);
      });
  }, [selectedConversation?.id]);

  useEffect(() => {
    const conversationId = selectedConversation?.id;
    if (!conversationId) {
      setConversationStats(null);
      return;
    }
    apiFetch<{ totalMessages: number; totalReceived: number }>(`/chat/conversations/${encodeURIComponent(conversationId)}/stats`)
      .then((d) => {
        if (d && typeof d.totalMessages === "number" && typeof d.totalReceived === "number") {
          setConversationStats({ totalMessages: d.totalMessages, totalReceived: d.totalReceived });
        } else {
          setConversationStats(null);
        }
      })
      .catch(() => setConversationStats(null));
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!newGroupOpen) return;
    setMemberSearch("");
    setMemberResults([]);
    setSelectedMemberIds([]);
  }, [newGroupOpen]);

  useEffect(() => {
    if (!newGroupOpen) return;
    const q = memberSearch.trim();
    const t = window.setTimeout(() => {
      if (!q) return setMemberResults([]);
      apiFetch<{ users: SearchUser[] }>(`/users?q=${encodeURIComponent(q)}`)
        .then((d) => {
          const list = Array.isArray(d?.users) ? d.users : [];
          setMemberResults(list.filter((u) => u.id !== user?.id));
        })
        .catch(() => setMemberResults([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [memberSearch, newGroupOpen, user?.id]);

  useEffect(() => {
    if (!manageGroupOpen) return;
    const conversationId = selectedConversation?.id;
    if (!conversationId) return;

    fetchParticipants(conversationId)
      .then((d) => {
        setMyRole(typeof d?.myRole === "string" ? (d.myRole as "OWNER" | "ADMIN" | "MEMBER") : "MEMBER");
        setParticipants(Array.isArray(d?.participants) ? (d.participants as GroupParticipant[]) : []);
      })
      .catch(() => {
        setMyRole("MEMBER");
        setParticipants([]);
      });
  }, [manageGroupOpen, selectedConversation?.id, fetchParticipants]);

  useEffect(() => {
    if (!manageGroupOpen) return;
    const q = manageSearch.trim();
    const t = window.setTimeout(() => {
      if (!q) return setManageResults([]);
      apiFetch<{ users: SearchUser[] }>(`/users?q=${encodeURIComponent(q)}`)
        .then((d) => {
          const list = Array.isArray(d?.users) ? d.users : [];
          const existingIds = new Set(participants.map((p) => p.userId));
          setManageResults(list.filter((u) => u.id !== user?.id && !existingIds.has(u.id)));
        })
        .catch(() => setManageResults([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [manageSearch, manageGroupOpen, participants, user?.id]);

  // Listen for real-time message updates
  useEffect(() => {
    const handleNewMessage = () => {
      loadConversations();
    };
    window.addEventListener("new-message", handleNewMessage);
    return () => window.removeEventListener("new-message", handleNewMessage);
  }, [loadConversations]);

  useEffect(() => {
    const onIncoming = (e: Event) => {
      const detail = (e as CustomEvent).detail as unknown;
      if (!detail || typeof detail !== "object") return;
      const d = detail as { callId?: unknown; conversationId?: unknown; fromUserId?: unknown; callType?: unknown };
      if (!d?.callId || !d?.conversationId || !d?.fromUserId) return;
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
      if (!d?.accepted) {
        setCallModalOpen(false);
      }
    };
    window.addEventListener("chat:call:incoming", onIncoming);
    window.addEventListener("chat:call:response", onResponse);
    return () => {
      window.removeEventListener("chat:call:incoming", onIncoming);
      window.removeEventListener("chat:call:response", onResponse);
    };
  }, []);

  const handleReshareKey = async () => {
    const conversationId = selectedConversation?.id;
    if (!conversationId) return;
    setReshareBusy(true);
    try {
      await reshareRoomKey(conversationId);
      window.alert("Group encryption key shared to members' devices.");
    } catch (e) {
      console.error(e);
    } finally {
      setReshareBusy(false);
    }
  };

  const handleExportBackup = async () => {
    if (!backupPassphrase.trim()) return;
    setBackupBusy(true);
    try {
      const blob = await exportDeviceKeyBackup(backupPassphrase.trim());
      setBackupBlob(blob);
    } catch (e) {
      console.error(e);
      setBackupBlob("");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImportBackup = async () => {
    if (!importPassphrase.trim() || !importBlob.trim()) return;
    setBackupBusy(true);
    try {
      await importDeviceKeyBackup(importPassphrase.trim(), importBlob.trim());
      setBackupOpen(false);
      setBackupPassphrase("");
      setBackupBlob("");
      setImportPassphrase("");
      setImportBlob("");
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setBackupBusy(false);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    String(c.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = () => {
    if (!newMessage.trim() || !user || !selectedConversation) return;

    sendMessage(selectedConversation.id, newMessage, "TEXT").catch((e: unknown) => {
      const msg = String((e && typeof e === "object") ? (e as { message?: unknown }).message : "");
      if (msg === "missing_room_key") {
        window.alert("You can't send messages in this group yet. Ask an OWNER/ADMIN to share the group key (or re-add you).");
      }
    });
    setNewMessage("");
    sendTyping(selectedConversation.id, false);
    setShowEmojiPicker(false);
  };

  const handleSendFile = (file: File, kind: "image" | "file") => {
    if (!user || !selectedConversation) return;
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("File is too large (max 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) return;

      if (kind === "image" && file.type.startsWith("image/")) {
        sendMessage(selectedConversation.id, dataUrl, "IMAGE").catch((e: unknown) => {
          const msg = String((e && typeof e === "object") ? (e as { message?: unknown }).message : "");
          if (msg === "missing_room_key") {
            window.alert("You can't send messages in this group yet. Ask an OWNER/ADMIN to share the group key (or re-add you).");
          }
        });
        return;
      }

      const payload = `${PAYLOAD_PREFIX}${JSON.stringify({ t: "file", name: file.name, mime: file.type || "application/octet-stream", dataUrl, size: file.size })}`;
      sendMessage(selectedConversation.id, payload, "TEXT").catch((e: unknown) => {
        const msg = String((e && typeof e === "object") ? (e as { message?: unknown }).message : "");
        if (msg === "missing_room_key") {
          window.alert("You can't send messages in this group yet. Ask an OWNER/ADMIN to share the group key (or re-add you).");
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendImages = (files: FileList | null | undefined) => {
    if (!files || !files.length) return;
    readFilesAsImageDrafts(files)
      .then((drafts) => {
        if (!drafts.length) return;
        setAlbumDrafts(drafts);
        setAlbumCaption("");
        setAlbumOpen(true);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Failed to read images");
      });
  };

  const addAlbumFiles = async (files: FileList | null | undefined) => {
    if (!files || !files.length) return;
    try {
      const drafts = await readFilesAsImageDrafts(files);
      if (!drafts.length) return;
      setAlbumDrafts((prev) => [...prev, ...drafts]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to read images");
    }
  };

  const removeAlbumDraft = (id: string) => {
    setAlbumDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const sendAlbum = async () => {
    if (!selectedConversation || !albumDrafts.length) return;
    setAlbumBusy(true);
    try {
      const payload = `${PAYLOAD_PREFIX}${JSON.stringify({
        t: "album",
        items: albumDrafts.map((d) => ({ dataUrl: d.dataUrl, name: d.name })),
        caption: albumCaption.trim() ? albumCaption.trim() : undefined,
      })}`;
      await sendMessage(selectedConversation.id, payload, "TEXT");
      setAlbumOpen(false);
      setAlbumDrafts([]);
      setAlbumCaption("");
    } catch (e) {
      console.error(e);
      toast.error("Failed to send album");
    } finally {
      setAlbumBusy(false);
    }
  };

  const toggleSelectedMember = (id: string) => {
    setSelectedMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreateGroup = async () => {
    if (!user) return;
    const name = newGroupName.trim();
    if (!name) return;
    if (!selectedMemberIds.length) return;
    setCreatingGroup(true);
    try {
      const id = await createGroupConversation(name, selectedMemberIds);
      setNewGroupOpen(false);
      setNewGroupName("");
      await loadConversations();
      const convo = conversations.find((c) => c.id === id);
      if (convo) setSelectedConversation(convo);
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleAddMembers = async (addUserIds: string[]) => {
    const conversationId = selectedConversation?.id;
    if (!conversationId) return;
    setAddingMembers(true);
    try {
      await addMembers(conversationId, addUserIds);
      const d = await fetchParticipants(conversationId);
      setMyRole(typeof d?.myRole === "string" ? (d.myRole as "OWNER" | "ADMIN" | "MEMBER") : "MEMBER");
      setParticipants(Array.isArray(d?.participants) ? (d.participants as GroupParticipant[]) : []);
      setManageSearch("");
      setManageResults([]);
    } catch (e) {
      console.error(e);
    } finally {
      setAddingMembers(false);
    }
  };

  const handleSetRole = async (targetUserId: string, role: "ADMIN" | "MEMBER") => {
    const conversationId = selectedConversation?.id;
    if (!conversationId) return;
    try {
      await promoteMember(conversationId, targetUserId, role);
      const d = await fetchParticipants(conversationId);
      setMyRole(typeof d?.myRole === "string" ? (d.myRole as "OWNER" | "ADMIN" | "MEMBER") : "MEMBER");
      setParticipants(Array.isArray(d?.participants) ? (d.participants as GroupParticipant[]) : []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEmojiSelect = (emoji: unknown) => {
    const native = (emoji && typeof emoji === "object") ? (emoji as { native?: unknown }).native : undefined;
    if (typeof native !== "string") return;
    setNewMessage((prev) => prev + native);
  };

  const handleCall = (type: "audio" | "video") => {
    setCallType(type);
    setCallModalOpen(true);
    const conversationId = selectedConversation?.id;
    if (conversationId) {
      startCall(conversationId, type).catch((e) => {
        console.error(e);
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
    if (!user || !selectedConversation || !editingMessageId) return;
    const v = editingValue;
    try {
      await editMessage(selectedConversation.id, editingMessageId, v);
      setEditingMessageId(null);
      setEditingValue("");
    } catch (e) {
      console.error(e);
      toast.error("Failed to edit message");
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !selectedConversation || !deleteTargetId) return;
    try {
      await deleteMessage(selectedConversation.id, deleteTargetId);
      setDeleteTargetId(null);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete message");
    }
  };

  const handlePinMessage = async (messageId: string) => {
    if (!selectedConversation) return;
    try {
      const conversationId = selectedConversation.id;
      const isPinned = pins.some((p) => p.messageId === messageId);
      if (isPinned) {
        await apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}/pins/${encodeURIComponent(messageId)}`, { method: "DELETE" });
        setPins((prev) => prev.filter((p) => p.messageId !== messageId));
        toast.success("Unpinned");
      } else {
        await apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}/pins`, {
          method: "POST",
          body: JSON.stringify({ messageId }),
        });
        setPinsOpen(true);
        await apiFetch<{ pins: { messageId: string; pinnedBy: string; createdAt: string }[] }>(
          `/chat/conversations/${encodeURIComponent(conversationId)}/pins`
        )
          .then((d) => setPins(Array.isArray(d?.pins) ? d.pins : []))
          .catch(() => {
            void 0;
          });
        toast.success("Pinned");
      }
    } catch (e) {
      console.error(e);
      if (Number(e?.status) === 501) toast.error("Pinning is not enabled on the server yet");
    }
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
          const a = new Date(m.createdAt).getTime();
          const b = new Date(n.createdAt).getTime();
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

  const formatTime = (iso: string): string => {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getTimeAgo = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const ts = new Date(iso).getTime();
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const initialsFromName = (name: string) => {
    return String(name || "?")
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const callConversation = callIncoming
    ? conversations.find((c) => c.id === callIncoming.conversationId) || null
    : selectedConversation;

  const callDisplayName = callConversation?.name || (callIncoming ? "Incoming call" : "");
  const callDisplayInitials = String(callDisplayName || "?")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const scrollToMessage = (messageId: string) => {
    const el = messageRefs.current.get(messageId);
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      el.scrollIntoView();
    }
  };

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

  const openViewer = (items: { url: string; name?: string }[], idx: number) => {
    if (!items.length) return;
    const safeIdx = Math.min(Math.max(idx, 0), items.length - 1);
    setViewerItems(items);
    setViewerIndex(safeIdx);
    setViewerOpen(true);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-24 md:pb-8 text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Sign in to view messages</h1>
          <Button variant="neon" onClick={() => navigate("/auth")}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-24 md:pb-8">
        <div className="glass-card overflow-hidden h-[calc(100vh-140px)] md:h-[calc(100vh-120px)]">
          <div className="flex h-full">
            {/* Conversations List */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col ${selectedConversation ? "hidden md:flex" : "flex"}`}>
              {/* Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="font-display text-xl font-bold">Messages</h1>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setBackupOpen(true)}>
                      Backup
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setNewGroupOpen(true)}>
                      New Group
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Conversations */}
              <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No conversations yet</p>
                    <p className="text-sm mt-1">Start chatting with someone!</p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => (
                    <motion.div
                      key={conversation.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`flex items-center gap-3 p-4 border-b border-border cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedConversation?.id === conversation.id ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="relative">
                        <UserAvatar src={conversation.avatarUrl || undefined} initials={initialsFromName(conversation.name)} size="md" className="w-12 h-12" />
                        {conversation.unreadCount > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
                            {conversation.unreadCount}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold truncate">{conversation.name}</h3>
                          <span className="text-xs text-muted-foreground">
                            {getTimeAgo(conversation.lastMessageAt)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.lastMessagePreview || ""}
                        </p>
                        {typeof conversation.totalReceivedCount === "number" && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            Received: {conversation.totalReceivedCount}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col ${selectedConversation ? "flex" : "hidden md:flex"}`}>
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setSelectedConversation(null)}
                        className="md:hidden p-2 hover:bg-muted rounded-lg"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const otherId = getDirectOtherUserId(selectedConversation, user?.id);
                          if (!otherId) return;
                          navigate(otherId === user?.id ? "/profile" : `/candidates/${otherId}`);
                        }}
                        className="flex items-center gap-3 text-left"
                      >
                        <UserAvatar src={selectedConversation.avatarUrl || undefined} initials={initialsFromName(selectedConversation.name)} size="sm" className="w-10 h-10" />
                        <div>
                          <h2 className="font-display font-bold">{selectedConversation.name}</h2>
                          <p className="text-xs text-accent">
                            Online
                            {conversationStats && (
                              <span className="text-muted-foreground"> · Received: {conversationStats.totalReceived}</span>
                            )}
                          </p>
                        </div>
                      </button>
                    </div>
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
                      <button
                        onClick={() => {
                          if (selectedConversation.type === "GROUP") setManageGroupOpen(true);
                        }}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                                  {item.images.length > 9 && (
                                    <div className="relative">
                                      <div className="absolute inset-0 rounded-md bg-black/50 flex items-center justify-center text-white font-semibold">
                                        +{item.images.length - 9}
                                      </div>
                                    </div>
                                  )}
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
                            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              ref={(el) => {
                                messageRefs.current.set(message.id, el);
                              }}
                              className="max-w-[80%]"
                            >
                              <div
                                className={`px-4 py-2 rounded-2xl ${
                                  isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
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
                                ) : parsed && parsed.kind === "file" ? (
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
                                    {editingMessageId === message.id ? (
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
                                  <p className={`text-xs ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                    {formatTime(message.createdAt)}
                                  </p>
                                  {isMine && editingMessageId !== message.id && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button className="p-1 rounded-md hover:bg-black/20">
                                          <MoreVertical className={`w-4 h-4 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`} />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {message.type === "TEXT" && parsed?.kind === "text" && (
                                          <DropdownMenuItem onClick={() => handleStartEdit(message)}>
                                            <Pencil className="w-4 h-4 mr-2" />
                                            Edit
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem onClick={() => handlePinMessage(message.id)}>
                                          <Pin className="w-4 h-4 mr-2" />
                                          {pinnedSet.has(message.id) ? "Unpin" : "Pin"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setDeleteTargetId(message.id)}>
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
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-border relative">
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

                    {Object.keys(typingFromUserIds).length > 0 && (
                      <div className="text-xs text-muted-foreground">Typing...</div>
                    )}

                    <div className="flex items-center gap-2">
                      <label className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-primary cursor-pointer">
                        <Image className="w-5 h-5" />
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            handleSendImages(e.target.files);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <label className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-primary cursor-pointer">
                        <Paperclip className="w-5 h-5" />
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleSendFile(file, "file");
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
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
                          if (!selectedConversation?.id) return;
                          if (!v.trim()) {
                            sendTyping(selectedConversation.id, false);
                            return;
                          }
                          sendTyping(selectedConversation.id, true);
                          if (typingSelfTimerRef.current) window.clearTimeout(typingSelfTimerRef.current);
                          typingSelfTimerRef.current = window.setTimeout(() => {
                            sendTyping(selectedConversation.id, false);
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
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Select a conversation to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Call Modal */}
      {(callIncoming || callConversation) && (
        <CallModal
          isOpen={callModalOpen}
          onClose={() => {
            setCallIncoming(null);
            setCallModalOpen(false);
          }}
          recipientName={callDisplayName}
          recipientAvatar={callDisplayInitials}
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
      )}

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
                    <div className="font-medium truncate">{pinnedPreview(p.messageId)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPinsOpen(false);
                        window.setTimeout(() => scrollToMessage(p.messageId), 150);
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

      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Group name</div>
              <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g. Project Team" />
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-2">Add members</div>
              <Input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search users..." />
            </div>

            <ScrollArea className="h-56 rounded-lg border border-border">
              <div className="p-2 space-y-1">
                {memberResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleSelectedMember(u.id)}
                    className="w-full flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar src={u.avatarUrl || undefined} initials={initialsFromName(u.name)} size="sm" className="w-9 h-9" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.name}</div>
                      </div>
                    </div>
                    <Checkbox checked={selectedMemberIds.includes(u.id)} />
                  </button>
                ))}
                {!memberResults.length && <div className="p-4 text-sm text-muted-foreground">Search users to add.</div>}
              </div>
            </ScrollArea>

            <div className="text-xs text-muted-foreground">Selected: {selectedMemberIds.length}</div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupOpen(false)}>
              Cancel
            </Button>
            <Button variant="neon" disabled={creatingGroup || !newGroupName.trim() || selectedMemberIds.length === 0} onClick={handleCreateGroup}>
              {creatingGroup ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageGroupOpen} onOpenChange={setManageGroupOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Manage Group</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Your role: {myRole}</div>

            {(myRole === "OWNER" || myRole === "ADMIN") && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <div className="font-medium">Encryption</div>
                  <div className="text-xs text-muted-foreground">Re-share the existing group key to all members' devices.</div>
                </div>
                <Button variant="outline" size="sm" disabled={reshareBusy} onClick={handleReshareKey}>
                  {reshareBusy ? "Sharing..." : "Re-share key"}
                </Button>
              </div>
            )}

            <div>
              <div className="text-sm font-medium mb-2">Members</div>
              <ScrollArea className="h-52 rounded-lg border border-border">
                <div className="p-2 space-y-1">
                  {participants.map((p) => (
                    <div key={p.userId} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar src={p.avatarUrl || undefined} initials={initialsFromName(p.name)} size="sm" className="w-9 h-9" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.role}</div>
                        </div>
                      </div>
                      {myRole === "OWNER" && p.userId !== user?.id && (
                        <div className="flex items-center gap-2">
                          {p.role !== "ADMIN" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetRole(p.userId, "ADMIN")}
                            >
                              Make Admin
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetRole(p.userId, "MEMBER")}
                            >
                              Remove Admin
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {(myRole === "OWNER" || myRole === "ADMIN") && (
              <div>
                <div className="text-sm font-medium mb-2">Add members</div>
                <Input value={manageSearch} onChange={(e) => setManageSearch(e.target.value)} placeholder="Search users..." />
                <ScrollArea className="h-36 mt-2 rounded-lg border border-border">
                  <div className="p-2 space-y-1">
                    {manageResults.map((u) => (
                      <div key={u.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted">
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar src={u.avatarUrl || undefined} initials={initialsFromName(u.name)} size="sm" className="w-9 h-9" />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{u.name}</div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" disabled={addingMembers} onClick={() => handleAddMembers([u.id])}>
                          Add
                        </Button>
                      </div>
                    ))}
                    {!manageResults.length && <div className="p-4 text-sm text-muted-foreground">Search users to add.</div>}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageGroupOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Chat Key Backup</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              This exports/imports your end-to-end encryption device key. Keep it private.
            </div>

            <div className="space-y-2">
              <div className="font-medium">Export</div>
              <Input
                type="password"
                value={backupPassphrase}
                onChange={(e) => setBackupPassphrase(e.target.value)}
                placeholder="Passphrase to encrypt backup"
              />
              <Button variant="outline" disabled={backupBusy || !backupPassphrase.trim()} onClick={handleExportBackup}>
                {backupBusy ? "Working..." : "Generate Backup"}
              </Button>
              <textarea
                value={backupBlob}
                onChange={(e) => setBackupBlob(e.target.value)}
                placeholder="Backup blob will appear here (copy & save somewhere safe)"
                className="w-full h-32 bg-muted/40 border border-border rounded-lg p-3 text-xs font-mono"
              />
            </div>

            <div className="space-y-2">
              <div className="font-medium">Import</div>
              <Input
                type="password"
                value={importPassphrase}
                onChange={(e) => setImportPassphrase(e.target.value)}
                placeholder="Passphrase used to encrypt backup"
              />
              <textarea
                value={importBlob}
                onChange={(e) => setImportBlob(e.target.value)}
                placeholder="Paste backup blob here"
                className="w-full h-32 bg-muted/40 border border-border rounded-lg p-3 text-xs font-mono"
              />
              <div className="text-xs text-muted-foreground">
                Import will reload the page to activate the restored device identity.
              </div>
              <Button variant="neon" disabled={backupBusy || !importPassphrase.trim() || !importBlob.trim()} onClick={handleImportBackup}>
                {backupBusy ? "Working..." : "Import Backup"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBackupOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
