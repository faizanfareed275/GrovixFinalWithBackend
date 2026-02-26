import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  decryptMessage,
  decryptRoomKeyForMe,
  deleteRoomKey,
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
        const textStr = String((parsed as any).text || "");
        return { kind: "text", text: textStr };
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

  const activeMessagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    activeMessagesRef.current = activeMessages;
  }, [activeMessages]);

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
  const lastKeyRequestAtRef = useRef<Record<string, number>>({});
  const keyRetryTimerRef = useRef<Record<string, number>>({});
  const keyRetryCountRef = useRef<Record<string, number>>({});
  const openConversationRef = useRef<((conversationId: string) => Promise<void>) | null>(null);
  const scheduleKeyRetryRef = useRef<((conversationId: string) => void) | null>(null);
  const ensureRoomKeyRef = useRef<((conversationId: string) => Promise<string>) | null>(null);

  const apiBaseUrl = useMemo(() => {
    const defaultApiUrl =
      typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.hostname}:4000`
        : "http://localhost:4000";
    return (import.meta as any).env?.VITE_GROVIX_API_URL || defaultApiUrl;
  }, []);

  const socketRef = useRef<Socket | null>(null);
  const lastKeysSharedAtRef = useRef<Record<string, number>>({});

  const shareRoomKeyToParticipants = useCallback(
    async (conversationId: string, targetUserId?: string) => {
      try {
        const roomKeyRawB64 = await loadRoomKey(conversationId);
        if (!roomKeyRawB64) {
          console.debug("[chat] no local room key to share", { conversationId });
          return;
        }

        console.debug("[chat] sharing room key", { conversationId, targetUserId });

        let userIds: string[];
        if (targetUserId) {
          userIds = [targetUserId];
        } else {
          const d = await apiFetch<{ participants: { userId: string }[] }>(
            `/chat/conversations/${encodeURIComponent(conversationId)}/participants`
          );
          userIds = Array.isArray(d?.participants) ? d.participants.map((p) => String((p as any).userId)) : [];
        }

        if (!userIds.length) {
          console.debug("[chat] no participants found", { conversationId });
          return;
        }

        const items: { deviceKeyId: string; userId: string; encryptedKeyB64: string }[] = [];
        for (const uid of userIds) {
          const dkResp = await apiFetch<{ deviceKeys: DeviceKey[] }>(`/chat/keys/user/${encodeURIComponent(uid)}`);
          const deviceKeys = Array.isArray(dkResp?.deviceKeys) ? dkResp.deviceKeys : [];
          if (!deviceKeys.length) {
            console.debug("[chat] no device keys for user", { uid });
            continue;
          }
          for (const dk of deviceKeys) {
            try {
              const wrap = await encryptRoomKeyForDevice(roomKeyRawB64, dk.publicKey);
              items.push({ deviceKeyId: dk.id, userId: uid, encryptedKeyB64: wrap.encryptedKeyB64 });
            } catch (e) {
              console.debug("[chat] encrypt failed for device", { uid, deviceKeyId: dk.id, error: String(e) });
            }
          }
        }

        if (items.length) {
          console.debug("[chat] posting conversation keys", { conversationId, items: items.length });
          const resp = await apiFetch<{ ok: boolean; created?: number }>(`/chat/conversations/${encodeURIComponent(conversationId)}/keys`, {
            method: "POST",
            body: JSON.stringify({ items: items.map((it) => ({ ...it, ivB64: undefined })) }),
          });
          console.debug("[chat] posted keys response", { conversationId, resp, itemCount: items.length });
        } else {
          console.debug("[chat] no device keys found to share", { conversationId });
        }
      } catch (e) {
        console.error("[chat] failed to share room key", { conversationId, error: String(e) });
      }
    },
    []
  );

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

      let roomKey = await loadRoomKey(conversationId);
      let plaintext: string | undefined = undefined;
      const tryDecrypt = async () => {
        if (!roomKey || !msg?.ivB64 || !msg?.ciphertextB64) return;
        try {
          plaintext = await decryptMessage(roomKey, String(msg.ivB64), String(msg.ciphertextB64));
        } catch {
          plaintext = undefined;
        }
      };

      const recoverFromStaleKey = async () => {
        // If we have a cached key but it fails to decrypt, it may be stale/wrong.
        // Invalidate it and force a fresh fetch after key reshare.
        if (!roomKey) return;
        try {
          console.debug("[chat] decrypt failed with cached key; invalidating", { conversationId });
          await deleteRoomKey(conversationId);
        } catch {
        }
        roomKey = null;
        socketRef.current?.emit("chat:key_request", { conversationId });
        try {
          const rk = await ensureRoomKeyRef.current?.(conversationId);
          if (rk) {
            roomKey = rk;
            await tryDecrypt();
          }
        } catch (e) {
          console.debug("[chat] recoverFromStaleKey ensureRoomKey failed", { conversationId, error: String(e) });
        }
      };

      await tryDecrypt();

      // If decrypt failed with a cached key, attempt recovery by dropping the cached key and re-fetching.
      if (!plaintext && roomKey) {
        await recoverFromStaleKey();
      }

      // If decrypt failed and this message is from someone else, request key and retry
      if (!plaintext && String(msg?.senderId || "") !== String(userId || "")) {
        console.debug("[chat] decrypt failed; requesting key", { conversationId });
        const now = Date.now();
        const last = Number(lastKeyRequestAtRef.current[conversationId] || 0);
        if (now - last > 4000) {
          lastKeyRequestAtRef.current[conversationId] = now;
          socketRef.current?.emit("chat:key_request", { conversationId });
        }

        // Schedule retry to re-decrypt after key may have arrived
        if (activeConversationIdRef.current === conversationId) {
          scheduleKeyRetryRef.current?.(conversationId);
        }

        // Try immediately with ensureRoomKey (fetches from server)
        try {
          const rk = await ensureRoomKeyRef.current?.(conversationId);
          if (rk) {
            roomKey = rk;
            await tryDecrypt();
            console.debug("[chat] decrypt succeeded after ensureRoomKey", { conversationId, plaintext: !!plaintext });
          }
        } catch (e) {
          console.debug("[chat] ensureRoomKey failed in message handler", { conversationId, error: String(e) });
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

    s.on("chat:key_request", async (payload: any) => {
      const conversationId = String(payload?.conversationId || "");
      const fromUserId = String(payload?.fromUserId || "");
      if (!conversationId) return;
      // Someone in the conversation is missing the key. Try to re-share to that specific user.
      console.debug("[chat] received key request", { conversationId, fromUserId });
      if (fromUserId) {
        await shareRoomKeyToParticipants(conversationId, fromUserId);
      } else {
        await shareRoomKeyToParticipants(conversationId);
      }
    });

    s.on("chat:keys_shared", async (payload: any) => {
      const conversationId = String(payload?.conversationId || "");
      if (!conversationId || activeConversationIdRef.current !== conversationId) return;

      const now = Date.now();
      const last = Number(lastKeysSharedAtRef.current[conversationId] || 0);
      if (now - last < 1500) return;
      lastKeysSharedAtRef.current[conversationId] = now;

      // Keys were shared - fetch the key if needed and re-decrypt in-place.
      console.debug("[chat] keys were shared, attempting in-place decrypt", { conversationId });
      try {
        const rk = await ensureRoomKeyRef.current?.(conversationId);
        if (!rk) return;

        const prev = activeMessagesRef.current;
        const next = await Promise.all(
          prev.map(async (m) => {
            if (m.conversationId !== conversationId) return m;
            if (m.plaintext) return m;
            try {
              const pt = await decryptMessage(rk, String(m.ivB64), String(m.ciphertextB64));
              return { ...m, plaintext: pt };
            } catch {
              return m;
            }
          })
        );
        setActiveMessages(next);
      } catch (e) {
        console.debug("[chat] in-place decrypt after keys_shared failed", { conversationId, error: String(e) });
      }
    });

    s.on("chat:call:incoming", (payload: any) => {
      window.dispatchEvent(new CustomEvent("chat:call:incoming", { detail: payload }));
    });

    s.on("chat:call:response", (payload: any) => {
      window.dispatchEvent(new CustomEvent("chat:call:response", { detail: payload }));
    });
  }, [apiBaseUrl, activeConversationId, shareRoomKeyToParticipants, userId]);

  const scheduleKeyRetry = useCallback(
    (conversationId: string) => {
      if (typeof window === "undefined") return;
      const tries = Number(keyRetryCountRef.current[conversationId] || 0);
      if (tries >= 6) return;
      if (keyRetryTimerRef.current[conversationId]) return;

      keyRetryCountRef.current[conversationId] = tries + 1;
      keyRetryTimerRef.current[conversationId] = window.setTimeout(() => {
        delete keyRetryTimerRef.current[conversationId];
        if (activeConversationIdRef.current !== conversationId) return;
        openConversationRef.current?.(conversationId).catch(() => { });
      }, 1500);
    },
    []
  );

  useEffect(() => {
    scheduleKeyRetryRef.current = scheduleKeyRetry;
  }, [scheduleKeyRetry]);

  useEffect(() => {
    if (!userId) return;
    ensureDeviceKeys().catch(() => { });
    connectSocket().catch(() => { });

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
    refreshConversationPreviews(next).catch(() => { });
  }, [userId, refreshConversationPreviews]);

  const getTotalUnreadCount = useCallback(() => {
    return conversations.reduce((sum, c) => sum + (Number(c.unreadCount || 0) || 0), 0);
  }, [conversations]);

  const ensureRoomKey = useCallback(
    async (conversationId: string) => {
      console.debug("[chat] ensureRoomKey start", { conversationId });
      const existing = await loadRoomKey(conversationId);
      if (existing) {
        console.debug("[chat] ensureRoomKey found existing key", { conversationId });
        return existing;
      }

      let deviceId = deviceIdRef.current;
      let deviceKeyId = deviceKeyIdRef.current;
      let privateJwk = privateJwkRef.current;
      if (!deviceId || !privateJwk) {
        console.debug("[chat] ensureRoomKey ensuring device keys", { conversationId });
        await ensureDeviceKeys().catch(() => { });
        deviceId = deviceIdRef.current;
        deviceKeyId = deviceKeyIdRef.current;
        privateJwk = privateJwkRef.current;
      }
      if (!deviceId || !privateJwk) {
        console.error("[chat] ensureRoomKey missing device key", { conversationId });
        throw new Error("missing_device_key");
      }

      console.debug("[chat] ensureRoomKey fetching keys from server", { conversationId, deviceId, deviceKeyId });
      const keyResp = await apiFetch<{ keys: { deviceKeyId: string; encryptedKeyB64: string; ivB64?: string | null }[] }>(
        `/chat/conversations/${encodeURIComponent(conversationId)}/keys/me`
      );

      const keys = Array.isArray(keyResp?.keys) ? keyResp.keys : [];
      console.debug("[chat] ensureRoomKey got keys from server", { conversationId, keyCount: keys.length, deviceKeyId });

      // A user can have multiple device keys (different browsers/devices). Try all keys we have,
      // prioritizing the current deviceKeyId when known.
      const preferred = deviceKeyId
        ? keys.filter((k) => String(k.deviceKeyId) === String(deviceKeyId))
        : [];
      const others = keys.filter((k) => !deviceKeyId || String(k.deviceKeyId) !== String(deviceKeyId));
      const candidates = [...preferred, ...others];
      console.debug("[chat] ensureRoomKey trying to decrypt", { conversationId, preferred: preferred.length, others: others.length });

      for (const k of candidates) {
        try {
          console.debug("[chat] ensureRoomKey attempting decrypt", { conversationId, deviceKeyId: k.deviceKeyId });
          const raw = await decryptRoomKeyForMe(String(k.encryptedKeyB64), privateJwk);
          await saveRoomKey(conversationId, raw);
          console.debug("[chat] ensureRoomKey decrypted and saved", { conversationId });
          return raw;
        } catch (e) {
          console.debug("[chat] ensureRoomKey decrypt failed for key", { conversationId, deviceKeyId: k.deviceKeyId, error: String(e) });
          // try next
        }
      }

      console.debug("[chat] ensureRoomKey no matching key found", { conversationId });

      // No key for this device: if the conversation already has messages, do NOT rotate keys.
      // Request a reshare from other participants.
      let totalMessages: number | null = null;
      try {
        const stats = await apiFetch<{ totalMessages: number }>(`/chat/conversations/${encodeURIComponent(conversationId)}/stats`);
        const total = Number((stats as any)?.totalMessages);
        totalMessages = Number.isFinite(total) ? total : 0;
      } catch (e) {
        totalMessages = null;
        console.debug("[chat] ensureRoomKey stats fetch failed", { conversationId, error: String(e) });
      }

      console.debug("[chat] ensureRoomKey conversation stats", { conversationId, totalMessages });

      // If we cannot confirm there are zero messages, never rotate keys.
      // Always request a reshare and retry later.
      if (totalMessages === null || totalMessages > 0) {
        console.debug("[chat] ensureRoomKey emitting key_request", { conversationId });
        socketRef.current?.emit("chat:key_request", { conversationId });
        throw new Error("missing_room_key");
      }

      // If no room key is available for this device, ONLY an OWNER/ADMIN should generate and distribute a new one.
      const access = await apiFetch<{ me: { role: string } }>(`/chat/conversations/${encodeURIComponent(conversationId)}/participants`);
      const myRole = String(access?.me?.role || "MEMBER");
      const convo = conversations.find((c) => c.id === conversationId);
      const isDirect = String(convo?.type || "") === "DIRECT";
      const canDistribute = myRole === "OWNER" || myRole === "ADMIN" || isDirect;
      console.debug("[chat] ensureRoomKey can distribute?", { conversationId, myRole, isDirect, canDistribute });
      if (!canDistribute) throw new Error("missing_room_key");

      console.debug("[chat] ensureRoomKey generating new key", { conversationId });
      const roomKeyRawB64 = generateRoomKeyRawB64();
      await saveRoomKey(conversationId, roomKeyRawB64);

      let allUserIds: string[] = [];
      if (convo) {
        allUserIds = convo.members.map((m) => String(m.userId));
      } else {
        try {
          const partsResp = await apiFetch<{ participants: { userId: string }[] }>(
            `/chat/conversations/${encodeURIComponent(conversationId)}/participants`
          );
          allUserIds = Array.isArray(partsResp?.participants) ? partsResp.participants.map((p) => String((p as any).userId)) : [];
        } catch {
          allUserIds = [];
        }
      }

      console.debug("[chat] ensureRoomKey sharing to participants", { conversationId, userCount: allUserIds.length });

      if (!allUserIds.length) return roomKeyRawB64;

      const items: { deviceKeyId: string; userId: string; encryptedKeyB64: string }[] = [];

      for (const uid of allUserIds) {
        const d = await apiFetch<{ deviceKeys: DeviceKey[] }>(`/chat/keys/user/${encodeURIComponent(uid)}`);
        const deviceKeys = Array.isArray(d?.deviceKeys) ? d.deviceKeys : [];
        console.debug("[chat] ensureRoomKey got device keys for user", { conversationId, uid, deviceKeyCount: deviceKeys.length });
        for (const dk of deviceKeys) {
          const wrap = await encryptRoomKeyForDevice(roomKeyRawB64, dk.publicKey);
          items.push({ deviceKeyId: dk.id, userId: uid, encryptedKeyB64: wrap.encryptedKeyB64 });
        }
      }

      if (items.length) {
        console.debug("[chat] ensureRoomKey posting keys", { conversationId, itemCount: items.length });
        await apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}/keys`, {
          method: "POST",
          body: JSON.stringify({ items: items.map((it) => ({ ...it, ivB64: undefined })) }),
        });
      }

      return roomKeyRawB64;
    },
    [conversations, ensureDeviceKeys]
  );

  useEffect(() => {
    ensureRoomKeyRef.current = ensureRoomKey;
  }, [ensureRoomKey]);

  const openConversation = useCallback(
    async (conversationId: string) => {
      if (!userId) return;
      setActiveConversationId(conversationId);

      socketRef.current?.emit("chat:join", { conversationId });

      let hasKey = false;
      try {
        await ensureRoomKey(conversationId);
        hasKey = true;
      } catch (e) {
        const msg = String((e && typeof e === "object" ? (e as any).message : "") || "");
        console.debug("[chat] openConversation: no key available", { conversationId, error: msg });
        if (msg === "missing_room_key") {
          socketRef.current?.emit("chat:key_request", { conversationId });
          scheduleKeyRetry(conversationId);
        }
      }

      // Always try to reshare keys when opening a conversation
      // This helps if the other user just registered their device
      if (hasKey) {
        shareRoomKeyToParticipants(conversationId).catch(() => { });
      }

      const d = await apiFetch<{ messages: any[] }>(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`);
      const msgsRaw = Array.isArray(d?.messages) ? d.messages : [];

      let roomKey = await loadRoomKey(conversationId);
      console.debug("[chat] openConversation: decrypting messages", { conversationId, hasRoomKey: !!roomKey, messageCount: msgsRaw.length });

      const tryDecryptWithRecovery = async (m: any) => {
        if (!roomKey) return undefined;
        try {
          return await decryptMessage(roomKey, String(m.ivB64), String(m.ciphertextB64));
        } catch (e) {
          // If cached key fails, invalidate it once and try to re-fetch.
          try {
            console.debug("[chat] openConversation: decrypt failed with cached key; invalidating", { conversationId });
            await deleteRoomKey(conversationId);
          } catch {
          }
          roomKey = null;
          socketRef.current?.emit("chat:key_request", { conversationId });
          try {
            const rk = await ensureRoomKeyRef.current?.(conversationId);
            if (rk) {
              roomKey = rk;
              return await decryptMessage(roomKey, String(m.ivB64), String(m.ciphertextB64));
            }
          } catch (e2) {
            console.debug("[chat] openConversation: recovery decrypt failed", { conversationId, error: String(e2) });
          }
          return undefined;
        }
      };

      const mapped: ChatMessage[] = await Promise.all(
        msgsRaw.map(async (m) => {
          const plaintext = await tryDecryptWithRecovery(m);
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

      const failedDecrypts = mapped.filter(m => !m.plaintext && m.senderId !== userId).length;
      if (failedDecrypts > 0) {
        console.debug("[chat] openConversation: some messages failed to decrypt", { conversationId, failedCount: failedDecrypts });
      }

      setActiveMessages(mapped);
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)));

      apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST" }).catch(() => { });
    },
    [ensureRoomKey, userId]
  );

  useEffect(() => {
    openConversationRef.current = openConversation;
  }, [openConversation]);

  const createDirectConversation = useCallback(async (otherUserId: string) => {
    const d = await apiFetch<{ conversation: { id: string } }>("/chat/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ otherUserId }),
    });
    await loadConversations();
    if (d?.conversation?.id) {
      const conversationId = String(d.conversation.id);
      socketRef.current?.emit("chat:join", { conversationId });

      // Ensure we have a key, then share it
      // Use retry logic because other user might not have device keys registered yet
      const shareWithRetry = async (attempt = 1) => {
        try {
          await ensureRoomKey(conversationId);
          // Small delay to let other user's device keys propagate
          if (attempt > 1) {
            await new Promise(r => setTimeout(r, 500));
          }
          await shareRoomKeyToParticipants(conversationId);
          console.debug("[chat] shared keys after conversation creation", { conversationId, attempt });
        } catch (e) {
          console.debug("[chat] key share failed, retrying", { conversationId, attempt, error: String(e) });
          if (attempt < 3) {
            setTimeout(() => shareWithRetry(attempt + 1), 1000 * attempt);
          }
        }
      };

      shareWithRetry();
    }
    return d?.conversation?.id as string;
  }, [loadConversations, ensureRoomKey, shareRoomKeyToParticipants]);

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
    await shareRoomKeyToParticipants(conversationId);
  }, [shareRoomKeyToParticipants]);

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

      // Ensure we have the key and share it before sending
      const roomKey = await ensureRoomKey(conversationId);

      // Always try to share keys before sending a message
      // This ensures the recipient has the key even if they just joined
      await shareRoomKeyToParticipants(conversationId).catch(() => { });

      const enc = await encryptMessage(roomKey, text);

      const s = socketRef.current;
      if (s && s.connected) {
        s.emit(
          "chat:send",
          { conversationId, type, ivB64: enc.ivB64, ciphertextB64: enc.ciphertextB64 },
          (resp: any) => {
            if (resp?.ok && resp.message) {
              setActiveMessages((prev) =>
                prev.map((m) => (m.id === optimistic.id ? { ...m, id: String(resp.message.id), createdAt: String(resp.message.createdAt) } : m))
              );
            }
          }
        );
      } else {
        apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: "POST",
          body: JSON.stringify({ type, ivB64: enc.ivB64, ciphertextB64: enc.ciphertextB64 }),
        }).then((resp: any) => {
          if (resp?.message) {
            setActiveMessages((prev) =>
              prev.map((m) => (m.id === optimistic.id ? { ...m, id: String(resp.message.id), createdAt: String(resp.message.createdAt) } : m))
            );
          }
        }).catch(() => { });
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
    [ensureRoomKey, shareRoomKeyToParticipants, userId, activeConversationId]
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
    await loadConversations().catch(() => { });
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
