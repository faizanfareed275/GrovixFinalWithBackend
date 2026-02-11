import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  decryptMessage,
  decryptRoomKeyForMe,
  encryptMessage,
  encryptRoomKeyForDevice,
  generateRoomKeyRawB64,
  getOrCreateDeviceId,
  getOrCreateDeviceKeyPair,
  loadRoomKey,
  saveRoomKey,
} from "@/lib/chatCrypto";

export type ChatConversation = {
  id: string;
  type: "DIRECT" | "GROUP";
  name: string;
  avatarUrl?: string | null;
  unreadCount: number;
  members: { userId: string }[];
  lastMessageAt?: string | null;
  lastMessagePreview?: string;
  totalReceivedCount?: number;
  lastMessage?: {
    id: string;
    senderId: string;
    type: "TEXT" | "IMAGE";
    ivB64: string;
    ciphertextB64: string;
    createdAt: string;
  } | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  type: "TEXT" | "IMAGE";
  ivB64: string;
  ciphertextB64: string;
  createdAt: string;
  plaintext?: string;
};

type ChatPayload =
  | { t: "text"; text: string }
  | { t: "file"; name: string; mime: string; dataUrl: string; size?: number }
  | { t: "album"; items: { dataUrl: string; name?: string; mime?: string }[]; caption?: string };

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
      const parsed = JSON.parse(raw.slice(PAYLOAD_PREFIX.length)) as ChatPayload;
      if (parsed && (parsed as any).t === "file") {
        const f = parsed as any;
        return {
          kind: "file",
          name: String(f.name || "file"),
          mime: String(f.mime || "application/octet-stream"),
          dataUrl: String(f.dataUrl || ""),
          size: f.size === undefined ? undefined : Number(f.size),
        };
      }
      if (parsed && (parsed as any).t === "album") {
        const a = parsed as any;
        const itemsRaw = Array.isArray(a.items) ? a.items : [];
        return {
          kind: "album",
          items: itemsRaw
            .map((it: any) => ({ dataUrl: String(it?.dataUrl || ""), name: it?.name ? String(it.name) : undefined, mime: it?.mime ? String(it.mime) : undefined }))
            .filter((it: any) => !!it.dataUrl),
          caption: a.caption ? String(a.caption) : undefined,
        };
      }
      if (parsed && (parsed as any).t === "text") {
        return { kind: "text", text: String((parsed as any).text || "") };
      }
    } catch {
    }
  }
  return { kind: "text", text: raw };
}

function previewFromPlaintext(plaintext: string | undefined, msgType: "TEXT" | "IMAGE"): string {
  if (msgType === "IMAGE") return "📷 Image";
  const parsed = parsePayload(plaintext);
  if (parsed.kind === "file") return `📎 ${parsed.name}`;
  if (parsed.kind === "album") {
    const n = Array.isArray(parsed.items) ? parsed.items.length : 0;
    return n > 0 ? `📷 Photos (${n})` : "📷 Photos";
  }
  const t = parsed.text.trim();
  if (!t) return "Encrypted message";
  return t.length > 60 ? `${t.slice(0, 60)}…` : t;
}

export type ChatParticipant = {
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  name: string;
  avatarUrl?: string | null;
  joinedAt?: string | null;
};

type DeviceKey = { id: string; deviceId: string; publicKey: JsonWebKey; updatedAt: string };

function useChatInternal(userId: string | null) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    if (userId) return;
    setConversations([]);
    setActiveConversationId(null);
    setActiveMessages([]);
  }, [userId]);

  const deviceIdRef = useRef<string | null>(null);
  const deviceKeyIdRef = useRef<string | null>(null);
  const privateJwkRef = useRef<JsonWebKey | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);

  const apiBaseUrl = useMemo(() => {
    const defaultApiUrl =
      typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.hostname}:4000`
        : "http://localhost:4000";
    return (import.meta as any).env?.VITE_GROVIX_API_URL || defaultApiUrl;
  }, []);

  const socketRef = useRef<Socket | null>(null);

  const refreshConversationPreviews = useCallback(async (items: ChatConversation[]) => {
    const updates = await Promise.all(
      items.map(async (c) => {
        const lm = c.lastMessage;
        if (!lm || !lm.ivB64 || !lm.ciphertextB64) return { id: c.id, preview: c.lastMessagePreview, at: c.lastMessageAt };
        const roomKey = await loadRoomKey(c.id);
        if (!roomKey) return { id: c.id, preview: c.lastMessagePreview, at: c.lastMessageAt };
        try {
          const pt = await decryptMessage(roomKey, lm.ivB64, lm.ciphertextB64);
          return { id: c.id, preview: previewFromPlaintext(pt, lm.type), at: lm.createdAt };
        } catch {
          return { id: c.id, preview: c.lastMessagePreview, at: c.lastMessageAt };
        }
      })
    );

    setConversations((prev) =>
      prev.map((c) => {
        const u = updates.find((x) => x.id === c.id);
        if (!u) return c;
        return { ...c, lastMessagePreview: u.preview || c.lastMessagePreview, lastMessageAt: u.at || c.lastMessageAt };
      })
    );
  }, []);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const ensureDeviceKeys = useCallback(async () => {
    const deviceId = getOrCreateDeviceId();
    deviceIdRef.current = deviceId;

    const { privateJwk, publicJwk } = await getOrCreateDeviceKeyPair(deviceId);
    privateJwkRef.current = privateJwk;

    const posted = await apiFetch<{ deviceKey?: { id: string } }>("/chat/keys/me", {
      method: "POST",
      body: JSON.stringify({ deviceId, publicKey: publicJwk }),
    });

    if (posted?.deviceKey?.id) deviceKeyIdRef.current = String(posted.deviceKey.id);

    return { deviceId, privateJwk, publicJwk };
  }, []);

  const connectSocket = useCallback(async () => {
    if (!userId) return;
    if (socketRef.current) {
      if (socketRef.current.connected) return;
      try {
        socketRef.current.disconnect();
      } catch {
      }
      socketRef.current = null;
    }

    const s = io(apiBaseUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = s;

    s.on("connect", () => setSocketConnected(true));
    s.on("disconnect", () => setSocketConnected(false));

    s.on("chat:message", async (msg: any) => {
      const conversationId = String(msg?.conversationId || "");
      if (!conversationId) return;

      const activeId = activeConversationIdRef.current;

      const roomKey = await loadRoomKey(conversationId);
      let plaintext: string | undefined = undefined;
      if (roomKey && msg?.ivB64 && msg?.ciphertextB64) {
        try {
          plaintext = await decryptMessage(roomKey, String(msg.ivB64), String(msg.ciphertextB64));
        } catch {
        }
      }

      const next: ChatMessage = {
        id: String(msg.id),
        conversationId,
        senderId: String(msg.senderId),
        type: msg.type === "IMAGE" ? "IMAGE" : "TEXT",
        ivB64: String(msg.ivB64),
        ciphertextB64: String(msg.ciphertextB64),
        createdAt: String(msg.createdAt),
        plaintext,
      };

      const nextPreview = previewFromPlaintext(next.plaintext, next.type);

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const bumpUnread = activeId !== conversationId && next.senderId !== userId;
          return {
            ...c,
            unreadCount: bumpUnread ? (Number(c.unreadCount || 0) || 0) + 1 : c.unreadCount,
            lastMessageAt: next.createdAt,
            lastMessagePreview: nextPreview,
          };
        })
      );

      setActiveMessages((prev) => {
        if (activeId !== conversationId) return prev;
        if (prev.some((m) => m.id === next.id)) return prev;
        return [...prev, next];
      });

      window.dispatchEvent(new CustomEvent("new-message", { detail: next }));
    });

    s.on("chat:message_updated", async (msg: any) => {
      const conversationId = String(msg?.conversationId || "");
      const messageId = String(msg?.id || "");
      if (!conversationId || !messageId) return;

      const roomKey = await loadRoomKey(conversationId);
      let plaintext: string | undefined = undefined;
      if (roomKey && msg?.ivB64 && msg?.ciphertextB64) {
        try {
          plaintext = await decryptMessage(roomKey, String(msg.ivB64), String(msg.ciphertextB64));
        } catch {
        }
      }

      setActiveMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          ivB64: String(msg.ivB64 || next[idx].ivB64),
          ciphertextB64: String(msg.ciphertextB64 || next[idx].ciphertextB64),
          plaintext: plaintext ?? next[idx].plaintext,
        };
        return next;
      });

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const preview = previewFromPlaintext(plaintext, msg.type === "IMAGE" ? "IMAGE" : "TEXT");
          return { ...c, lastMessageAt: String(msg.createdAt || c.lastMessageAt), lastMessagePreview: preview };
        })
      );
    });

    s.on("chat:message_deleted", (payload: any) => {
      const conversationId = String(payload?.conversationId || "");
      const messageId = String(payload?.messageId || "");
      if (!conversationId || !messageId) return;

      setActiveMessages((prev) => prev.filter((m) => m.id !== messageId));
      // Conversation preview will be corrected after a conversations reload.
      window.dispatchEvent(new CustomEvent("new-message", { detail: { deleted: true, conversationId, messageId } }));
    });

    s.on("chat:typing", (payload: any) => {
      window.dispatchEvent(new CustomEvent("chat:typing", { detail: payload }));
    });

    s.on("chat:call:incoming", (payload: any) => {
      window.dispatchEvent(new CustomEvent("chat:call:incoming", { detail: payload }));
    });

    s.on("chat:call:response", (payload: any) => {
      window.dispatchEvent(new CustomEvent("chat:call:response", { detail: payload }));
    });
  }, [apiBaseUrl, activeConversationId, userId]);

  useEffect(() => {
    if (!userId) return;
    ensureDeviceKeys().catch(() => {});
    connectSocket().catch(() => {});

    return () => {
      try {
        socketRef.current?.disconnect();
      } catch {
      }
      socketRef.current = null;
    };
  }, [userId, ensureDeviceKeys, connectSocket]);

  const loadConversations = useCallback(async () => {
    if (!userId) return;
    const d = await apiFetch<{ conversations: ChatConversation[] }>("/chat/conversations");
    const next = Array.isArray(d?.conversations) ? d.conversations : [];
    setConversations(next);
    refreshConversationPreviews(next).catch(() => {});
  }, [userId, refreshConversationPreviews]);

  const getTotalUnreadCount = useCallback(() => {
    return conversations.reduce((sum, c) => sum + (Number(c.unreadCount || 0) || 0), 0);
  }, [conversations]);

  const ensureRoomKey = useCallback(
    async (conversationId: string) => {
      const existing = await loadRoomKey(conversationId);
      if (existing) return existing;

      const deviceId = deviceIdRef.current;
      const deviceKeyId = deviceKeyIdRef.current;
      const privateJwk = privateJwkRef.current;
      if (!deviceId || !privateJwk) throw new Error("missing_device_key");

      const keyResp = await apiFetch<{ keys: { deviceKeyId: string; encryptedKeyB64: string; ivB64?: string | null }[] }>(
        `/chat/conversations/${encodeURIComponent(conversationId)}/keys/me`
      );

      const keys = Array.isArray(keyResp?.keys) ? keyResp.keys : [];
      const myKey = deviceKeyId
        ? keys.find((k) => String(k.deviceKeyId) === String(deviceKeyId))
        : keys.find((k) => k.deviceKeyId && k.encryptedKeyB64);
      if (myKey) {
        const raw = await decryptRoomKeyForMe(String(myKey.encryptedKeyB64), privateJwk);
        await saveRoomKey(conversationId, raw);
        return raw;
      }

      // If no room key is available for this device, ONLY an OWNER/ADMIN should generate and distribute a new one.
      const access = await apiFetch<{ me: { role: string } }>(`/chat/conversations/${encodeURIComponent(conversationId)}/participants`);
      const myRole = String(access?.me?.role || "MEMBER");
      const convo = conversations.find((c) => c.id === conversationId);
      const isDirect = String(convo?.type || "") === "DIRECT";
      const canDistribute = myRole === "OWNER" || myRole === "ADMIN" || isDirect;
      if (!canDistribute) throw new Error("missing_room_key");

      const roomKeyRawB64 = generateRoomKeyRawB64();
      await saveRoomKey(conversationId, roomKeyRawB64);

      if (!convo) return roomKeyRawB64;

      const allUserIds = convo.members.map((m) => m.userId);
      const items: { deviceKeyId: string; userId: string; encryptedKeyB64: string }[] = [];

      for (const uid of allUserIds) {
        const d = await apiFetch<{ deviceKeys: DeviceKey[] }>(`/chat/keys/user/${encodeURIComponent(uid)}`);
        const deviceKeys = Array.isArray(d?.deviceKeys) ? d.deviceKeys : [];
        for (const dk of deviceKeys) {
          const wrap = await encryptRoomKeyForDevice(roomKeyRawB64, dk.publicKey);
          items.push({ deviceKeyId: dk.id, userId: uid, encryptedKeyB64: wrap.encryptedKeyB64 });
        }
      }

      if (items.length) {
        await apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}/keys`, {
          method: "POST",
          body: JSON.stringify({ items: items.map((it) => ({ ...it, ivB64: undefined })) }),
        });
      }

      return roomKeyRawB64;
    },
    [conversations]
  );

  const openConversation = useCallback(
    async (conversationId: string) => {
      if (!userId) return;
      setActiveConversationId(conversationId);

      socketRef.current?.emit("chat:join", { conversationId });

      await ensureRoomKey(conversationId).catch(() => {});

      const d = await apiFetch<{ messages: any[] }>(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`);
      const msgsRaw = Array.isArray(d?.messages) ? d.messages : [];

      const roomKey = await loadRoomKey(conversationId);

      const mapped: ChatMessage[] = await Promise.all(
        msgsRaw.map(async (m) => {
          let plaintext: string | undefined = undefined;
          if (roomKey) {
            try {
              plaintext = await decryptMessage(roomKey, String(m.ivB64), String(m.ciphertextB64));
            } catch {
            }
          }
          return {
            id: String(m.id),
            conversationId,
            senderId: String(m.senderId),
            type: m.type === "IMAGE" ? "IMAGE" : "TEXT",
            ivB64: String(m.ivB64),
            ciphertextB64: String(m.ciphertextB64),
            createdAt: String(m.createdAt),
            plaintext,
          };
        })
      );

      setActiveMessages(mapped);
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)));
      apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST" }).catch(() => {});
    },
    [ensureRoomKey, userId]
  );

  const createDirectConversation = useCallback(async (otherUserId: string) => {
    const d = await apiFetch<{ conversation: { id: string } }>("/chat/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ otherUserId }),
    });
    await loadConversations();
    if (d?.conversation?.id) {
      socketRef.current?.emit("chat:join", { conversationId: d.conversation.id });
    }
    return d?.conversation?.id as string;
  }, [loadConversations]);

  const fetchParticipants = useCallback(async (conversationId: string) => {
    const d = await apiFetch<{ me: { role: string }; participants: ChatParticipant[] }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/participants`
    );
    return {
      myRole: (d?.me?.role as any) || "MEMBER",
      participants: Array.isArray(d?.participants) ? d.participants : [],
    };
  }, []);

  const addMembers = useCallback(async (conversationId: string, addUserIds: string[]) => {
    await apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}/members`, {
      method: "POST",
      body: JSON.stringify({ addUserIds }),
    });
    socketRef.current?.emit("chat:join", { conversationId });

    const roomKeyRawB64 = await ensureRoomKey(conversationId);
    const items: { deviceKeyId: string; userId: string; encryptedKeyB64: string }[] = [];
    for (const uid of addUserIds) {
      const d = await apiFetch<{ deviceKeys: DeviceKey[] }>(`/chat/keys/user/${encodeURIComponent(uid)}`);
      const deviceKeys = Array.isArray(d?.deviceKeys) ? d.deviceKeys : [];
      for (const dk of deviceKeys) {
        const wrap = await encryptRoomKeyForDevice(roomKeyRawB64, dk.publicKey);
        items.push({ deviceKeyId: dk.id, userId: uid, encryptedKeyB64: wrap.encryptedKeyB64 });
      }
    }
    if (items.length) {
      await apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}/keys`, {
        method: "POST",
        body: JSON.stringify({ items: items.map((it) => ({ ...it, ivB64: undefined })) }),
      });
    }

    await loadConversations();
  }, [loadConversations, ensureRoomKey]);

  const promoteMember = useCallback(async (conversationId: string, targetUserId: string, role: "ADMIN" | "MEMBER") => {
    await apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}/promote`, {
      method: "POST",
      body: JSON.stringify({ targetUserId, role }),
    });
  }, []);

  const reshareRoomKey = useCallback(async (conversationId: string) => {
    const roomKeyRawB64 = await ensureRoomKey(conversationId);

    const d = await apiFetch<{ participants: { userId: string }[] }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/participants`
    );
    const userIds = Array.isArray(d?.participants) ? d.participants.map((p) => String((p as any).userId)) : [];

    const items: { deviceKeyId: string; userId: string; encryptedKeyB64: string }[] = [];
    for (const uid of userIds) {
      const dkResp = await apiFetch<{ deviceKeys: DeviceKey[] }>(`/chat/keys/user/${encodeURIComponent(uid)}`);
      const deviceKeys = Array.isArray(dkResp?.deviceKeys) ? dkResp.deviceKeys : [];
      for (const dk of deviceKeys) {
        const wrap = await encryptRoomKeyForDevice(roomKeyRawB64, dk.publicKey);
        items.push({ deviceKeyId: dk.id, userId: uid, encryptedKeyB64: wrap.encryptedKeyB64 });
      }
    }

    if (items.length) {
      await apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}/keys`, {
        method: "POST",
        body: JSON.stringify({ items: items.map((it) => ({ ...it, ivB64: undefined })) }),
      });
    }
  }, [ensureRoomKey]);

  const createGroupConversation = useCallback(async (name: string, memberIds: string[]) => {
    const d = await apiFetch<{ conversation: { id: string } }>("/chat/conversations/group", {
      method: "POST",
      body: JSON.stringify({ name, memberIds }),
    });
    await loadConversations();
    if (d?.conversation?.id) {
      socketRef.current?.emit("chat:join", { conversationId: d.conversation.id });
    }
    return d?.conversation?.id as string;
  }, [loadConversations]);

  const sendMessage = useCallback(
    async (conversationId: string, text: string, type: "TEXT" | "IMAGE" = "TEXT") => {
      if (!userId) return;
      const roomKey = await ensureRoomKey(conversationId);
      const enc = await encryptMessage(roomKey, text);

      const s = socketRef.current;
      if (s && s.connected) {
        s.emit(
          "chat:send",
          { conversationId, type, ivB64: enc.ivB64, ciphertextB64: enc.ciphertextB64 },
          (resp: any) => {
            if (!resp?.ok) return;
          }
        );
      } else {
        await apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: "POST",
          body: JSON.stringify({ type, ivB64: enc.ivB64, ciphertextB64: enc.ciphertextB64 }),
        });
      }

      const optimistic: ChatMessage = {
        id: crypto.randomUUID(),
        conversationId,
        senderId: userId,
        type,
        ivB64: enc.ivB64,
        ciphertextB64: enc.ciphertextB64,
        createdAt: new Date().toISOString(),
        plaintext: text,
      };

      setActiveMessages((prev) => (activeConversationId === conversationId ? [...prev, optimistic] : prev));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessageAt: optimistic.createdAt,
                lastMessagePreview: previewFromPlaintext(optimistic.plaintext, optimistic.type),
              }
            : c
        )
      );
    },
    [ensureRoomKey, userId, activeConversationId]
  );

  const editMessage = useCallback(
    async (conversationId: string, messageId: string, newPlaintext: string) => {
      if (!userId) return;
      const roomKey = await ensureRoomKey(conversationId);
      const enc = await encryptMessage(roomKey, newPlaintext);

      const s = socketRef.current;
      if (s && s.connected) {
        await new Promise<void>((resolve, reject) => {
          s.emit("chat:edit", { messageId, ivB64: enc.ivB64, ciphertextB64: enc.ciphertextB64 }, (resp: any) => {
            if (!resp?.ok) return reject(new Error(String(resp?.error || "server_error")));
            return resolve();
          });
        });
      } else {
        await apiFetch(`/chat/messages/${encodeURIComponent(messageId)}`, {
          method: "PATCH",
          body: JSON.stringify({ ivB64: enc.ivB64, ciphertextB64: enc.ciphertextB64 }),
        });
      }

      setActiveMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, ivB64: enc.ivB64, ciphertextB64: enc.ciphertextB64, plaintext: newPlaintext }
            : m
        )
      );
    },
    [ensureRoomKey, userId]
  );

  const deleteMessage = useCallback(async (conversationId: string, messageId: string) => {
    if (!userId) return;
    const s = socketRef.current;
    if (s && s.connected) {
      await new Promise<void>((resolve, reject) => {
        s.emit("chat:delete", { messageId }, (resp: any) => {
          if (!resp?.ok) return reject(new Error(String(resp?.error || "server_error")));
          return resolve();
        });
      });
    } else {
      await apiFetch(`/chat/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
    }
    setActiveMessages((prev) => prev.filter((m) => m.id !== messageId));
    await loadConversations().catch(() => {});
  }, [userId, loadConversations]);

  const sendTyping = useCallback(
    (conversationId: string, isTyping: boolean) => {
      const s = socketRef.current;
      if (!s || !s.connected) return;
      s.emit("chat:typing", { conversationId, isTyping });
    },
    []
  );

  const startCall = useCallback(async (conversationId: string, callType: "audio" | "video") => {
    const s = socketRef.current;
    if (!s || !s.connected) throw new Error("socket_not_connected");
    return await new Promise<string>((resolve, reject) => {
      s.emit("chat:call:start", { conversationId, callType }, (resp: any) => {
        if (!resp?.ok || !resp?.callId) return reject(new Error(String(resp?.error || "server_error")));
        return resolve(String(resp.callId));
      });
    });
  }, []);

  const respondToCall = useCallback(async (callId: string, conversationId: string, fromUserId: string, accepted: boolean) => {
    const s = socketRef.current;
    if (!s || !s.connected) throw new Error("socket_not_connected");
    await new Promise<void>((resolve, reject) => {
      s.emit("chat:call:response", { callId, conversationId, fromUserId, accepted }, (resp: any) => {
        if (!resp?.ok) return reject(new Error(String(resp?.error || "server_error")));
        return resolve();
      });
    });
  }, []);

  return {
    conversations,
    activeConversationId,
    activeMessages,
    socketConnected,
    loadConversations,
    openConversation,
    createDirectConversation,
    createGroupConversation,
    fetchParticipants,
    addMembers,
    promoteMember,
    reshareRoomKey,
    sendMessage,
    editMessage,
    deleteMessage,
    sendTyping,
    startCall,
    respondToCall,
    getTotalUnreadCount,
  };
}

type ChatContextValue = ReturnType<typeof useChatInternal>;

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const chat = useChatInternal(user?.id || null);
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChat(userId: string | null) {
  const ctx = useContext(ChatContext);
  if (ctx) return ctx;
  return useChatInternal(userId);
}
