import { Router } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { requireAdmin, requireAuth } from "./middleware/auth";

const router = Router();
const db = prisma as any;

function toB64Preview(messageType: string) {
  if (messageType === "IMAGE") return "📷 Image";
  return "Encrypted message";
}

function hasPinnedMessagesModel(db: any) {
  return !!(db && (db as any).chatPinnedMessage && typeof (db as any).chatPinnedMessage.findMany === "function");
}

async function getUserMap(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return new Map<string, any>();
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, avatarUrl: true } });
  return new Map(users.map((u) => [u.id, u]));
}

router.get("/admin/conversations", requireAdmin, async (req: any, res) => {
  const q = String(req.query?.q || "").trim().toLowerCase();
  const takeRaw = Number(req.query?.limit || 200);
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 500) : 200;

  const convos = await db.chatConversation.findMany({
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      name: true,
      updatedAt: true,
      createdAt: true,
      createdBy: true,
      participants: { select: { userId: true, role: true, joinedAt: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, senderId: true, type: true, createdAt: true },
      },
    },
  });

  const userIds: string[] = [];
  for (const c of convos as any[]) {
    userIds.push(String(c.createdBy || ""));
    for (const p of c.participants || []) userIds.push(String(p.userId || ""));
    const last = c.messages?.[0];
    if (last?.senderId) userIds.push(String(last.senderId));
  }
  const userMap = await getUserMap(userIds);

  const mapped = (convos as any[]).map((c: any) => {
    const last = c.messages?.[0] || null;
    const lastSender = last?.senderId ? userMap.get(String(last.senderId)) : null;
    return {
      id: String(c.id),
      type: String(c.type),
      name: c.type === "GROUP" ? (c.name || "Group") : null,
      updatedAt: c.updatedAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
      createdBy: String(c.createdBy),
      participants: (c.participants || []).map((p: any) => {
        const u = userMap.get(String(p.userId));
        return {
          userId: String(p.userId),
          name: u?.name || "Unknown",
          avatarUrl: u?.avatarUrl || null,
          role: String(p.role || "MEMBER"),
          joinedAt: p.joinedAt ? new Date(p.joinedAt).toISOString() : null,
        };
      }),
      lastMessage: last
        ? {
            id: String(last.id),
            type: String(last.type),
            createdAt: last.createdAt.toISOString(),
            sender: lastSender ? { id: lastSender.id, name: lastSender.name, avatarUrl: lastSender.avatarUrl || null } : { id: String(last.senderId), name: "Unknown", avatarUrl: null },
            preview: toB64Preview(String(last.type || "TEXT")),
          }
        : null,
    };
  });

  const filtered = q
    ? mapped.filter((c: any) => {
        if ((c.name || "").toLowerCase().includes(q)) return true;
        if (String(c.id).toLowerCase().includes(q)) return true;
        if ((c.participants || []).some((p: any) => String(p.name || "").toLowerCase().includes(q))) return true;
        return false;
      })
    : mapped;

  return res.json({ conversations: filtered });
});

router.get("/admin/conversations/:id/messages", requireAdmin, async (req: any, res) => {
  const conversationId = String(req.params.id || "");
  if (!conversationId) return res.status(400).json({ error: "invalid_id" });

  const takeRaw = Number(req.query?.limit || 100);
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 200) : 100;
  const before = String(req.query?.before || "").trim();

  const messages = await db.chatMessage.findMany({
    where: {
      conversationId,
      createdAt: before ? { lt: new Date(before) } : undefined,
    },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, senderId: true, type: true, ivB64: true, ciphertextB64: true, createdAt: true },
  });

  const senderIds = (messages as any[]).map((m: any) => String(m.senderId));
  const senderMap = await getUserMap(senderIds);

  const out = (messages as any[])
    .map((m: any) => {
      const s = senderMap.get(String(m.senderId));
      return {
        id: String(m.id),
        senderId: String(m.senderId),
        sender: s ? { id: s.id, name: s.name, avatarUrl: s.avatarUrl || null } : { id: String(m.senderId), name: "Unknown", avatarUrl: null },
        type: String(m.type),
        ivB64: String(m.ivB64),
        ciphertextB64: String(m.ciphertextB64),
        createdAt: m.createdAt.toISOString(),
      };
    })
    .reverse();

  return res.json({ messages: out, nextBefore: messages.length ? messages[messages.length - 1].createdAt.toISOString() : null });
});

router.get("/conversations/:id/stats", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const conversationId = String(req.params.id || "");
  if (!conversationId) return res.status(400).json({ error: "invalid_id" });

  const participant = await db.chatParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) return res.status(403).json({ error: "forbidden" });

  const totalMessages = await db.chatMessage.count({ where: { conversationId } });
  const totalReceived = await db.chatMessage.count({ where: { conversationId, senderId: { not: userId } } });

  return res.json({ totalMessages, totalReceived });
});

router.get("/conversations", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;

  const parts = await db.chatParticipant.findMany({
    where: { userId },
    select: {
      conversation: {
        select: {
          id: true,
          type: true,
          name: true,
          updatedAt: true,
          participants: { select: { userId: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, senderId: true, type: true, ivB64: true, ciphertextB64: true, createdAt: true },
          },
        },
      },
      lastReadAt: true,
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  });

  const otherUserIds: string[] = [];
  for (const p of parts as any[]) {
    const c = (p as any).conversation;
    if (c.type === "DIRECT") {
      const other = (c.participants as any[]).find((x: any) => x.userId !== userId);
      if (other) otherUserIds.push(other.userId);
    }
  }
  const userMap = await getUserMap(otherUserIds);

  const convos = await Promise.all(
    (parts as any[]).map(async (p: any) => {
      const c = p.conversation;
      const lastMsg = c.messages[0];
      const lastReadAt = p.lastReadAt;

      const totalReceivedCount = await db.chatMessage.count({
        where: {
          conversationId: c.id,
          senderId: { not: userId },
        },
      });

      const unreadCount = await db.chatMessage.count({
        where: {
          conversationId: c.id,
          createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
          senderId: { not: userId },
        },
      });

      if (c.type === "DIRECT") {
        const other = (c.participants as any[]).find((x: any) => x.userId !== userId);
        const otherUser = other ? userMap.get(other.userId) : null;

        return {
          id: c.id,
          type: c.type,
          name: otherUser?.name || "Unknown",
          avatarUrl: otherUser?.avatarUrl || null,
          updatedAt: c.updatedAt.toISOString(),
          lastMessagePreview: toB64Preview(String(lastMsg?.type || "TEXT")),
          lastMessageAt: lastMsg?.createdAt ? lastMsg.createdAt.toISOString() : null,
          lastMessage: lastMsg
            ? {
                id: String(lastMsg.id),
                senderId: String(lastMsg.senderId),
                type: String(lastMsg.type),
                ivB64: String(lastMsg.ivB64),
                ciphertextB64: String(lastMsg.ciphertextB64),
                createdAt: lastMsg.createdAt.toISOString(),
              }
            : null,
          unreadCount,
          totalReceivedCount,
          members: c.participants.map((m: any) => ({ userId: m.userId })),
        };
      }

      return {
        id: c.id,
        type: c.type,
        name: c.name || "Group",
        avatarUrl: null,
        updatedAt: c.updatedAt.toISOString(),
        lastMessagePreview: toB64Preview(String(lastMsg?.type || "TEXT")),
        lastMessageAt: lastMsg?.createdAt ? lastMsg.createdAt.toISOString() : null,
        lastMessage: lastMsg
          ? {
              id: String(lastMsg.id),
              senderId: String(lastMsg.senderId),
              type: String(lastMsg.type),
              ivB64: String(lastMsg.ivB64),
              ciphertextB64: String(lastMsg.ciphertextB64),
              createdAt: lastMsg.createdAt.toISOString(),
            }
          : null,
        unreadCount,
        totalReceivedCount,
        members: c.participants.map((m: any) => ({ userId: m.userId })),
      };
    })
  );

  return res.json({ conversations: convos });
});

router.post("/conversations/direct", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;

  const schema = z.object({ otherUserId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const otherUserId = parsed.data.otherUserId;
  if (otherUserId === userId) return res.status(400).json({ error: "invalid_request" });

  const directKey = [userId, otherUserId].sort().join(":");

  const convo = await db.chatConversation.upsert({
    where: { directKey },
    update: {},
    create: {
      type: "DIRECT",
      directKey,
      createdBy: userId,
      participants: {
        create: [
          { userId, role: "OWNER" },
          { userId: otherUserId, role: "ADMIN" },
        ],
      },
    },
    include: { participants: true },
  });

  return res.json({ conversation: { id: convo.id, type: convo.type, name: null } });
});

router.post("/conversations/group", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;

  const schema = z.object({ name: z.string().min(1), memberIds: z.array(z.string().min(1)).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const memberIds = Array.from(new Set(parsed.data.memberIds)).filter((id) => id !== userId);

  const convo = await db.chatConversation.create({
    data: {
      type: "GROUP",
      name: parsed.data.name,
      createdBy: userId,
      participants: {
        create: [{ userId, role: "OWNER" }, ...memberIds.map((id) => ({ userId: id, role: "MEMBER" }))],
      },
    },
  });

  return res.json({ conversation: { id: convo.id, type: convo.type, name: convo.name } });
});

router.get("/conversations/:id/messages", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const conversationId = String(req.params.id || "");
  if (!conversationId) return res.status(400).json({ error: "invalid_id" });

  const participant = await db.chatParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) return res.status(403).json({ error: "forbidden" });

  const takeRaw = Number(req.query?.limit || 50);
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 100) : 50;
  const before = String(req.query?.before || "").trim();

  const messages = await db.chatMessage.findMany({
    where: {
      conversationId,
      createdAt: before ? { lt: new Date(before) } : undefined,
    },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, senderId: true, type: true, ivB64: true, ciphertextB64: true, createdAt: true },
  });

  return res.json({
    messages: messages
      .map((m: any) => ({
        id: m.id,
        senderId: m.senderId,
        type: m.type,
        ivB64: m.ivB64,
        ciphertextB64: m.ciphertextB64,
        createdAt: m.createdAt.toISOString(),
      }))
      .reverse(),
    nextBefore: messages.length ? messages[messages.length - 1].createdAt.toISOString() : null,
  });
});

router.post("/conversations/:id/read", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const conversationId = String(req.params.id || "");
  if (!conversationId) return res.status(400).json({ error: "invalid_id" });

  const participant = await db.chatParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) return res.status(403).json({ error: "forbidden" });

  await db.chatParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });

  return res.json({ ok: true });
});

router.post("/conversations/:id/messages", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const conversationId = String(req.params.id || "");
  if (!conversationId) return res.status(400).json({ error: "invalid_id" });

  const schema = z.object({ type: z.enum(["TEXT", "IMAGE"]).default("TEXT"), ivB64: z.string().min(1), ciphertextB64: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const participant = await db.chatParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) return res.status(403).json({ error: "forbidden" });

  const msg = await db.chatMessage.create({
    data: {
      conversationId,
      senderId: userId,
      type: parsed.data.type,
      ivB64: parsed.data.ivB64,
      ciphertextB64: parsed.data.ciphertextB64,
    },
    select: { id: true, senderId: true, type: true, ivB64: true, ciphertextB64: true, createdAt: true },
  });

  await db.chatConversation.update({ where: { id: conversationId }, data: {} });

  return res.json({
    message: {
      id: msg.id,
      senderId: msg.senderId,
      type: msg.type,
      ivB64: msg.ivB64,
      ciphertextB64: msg.ciphertextB64,
      createdAt: msg.createdAt.toISOString(),
    },
  });
});

router.get("/keys/me", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const items = await db.userDeviceKey.findMany({ where: { userId }, select: { id: true, deviceId: true, publicKey: true, updatedAt: true } });
  return res.json({ deviceKeys: items });
});

router.post("/keys/me", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;

  const schema = z.object({ deviceId: z.string().min(3), publicKey: z.any() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const key = await db.userDeviceKey.upsert({
    where: { userId_deviceId: { userId, deviceId: parsed.data.deviceId } },
    update: { publicKey: parsed.data.publicKey },
    create: { userId, deviceId: parsed.data.deviceId, publicKey: parsed.data.publicKey },
    select: { id: true, deviceId: true, publicKey: true, updatedAt: true },
  });

  return res.json({ deviceKey: key });
});

router.get("/keys/user/:userId", requireAuth, async (req: any, res) => {
  const targetUserId = String(req.params.userId || "");
  if (!targetUserId) return res.status(400).json({ error: "invalid_id" });

  const items = await db.userDeviceKey.findMany({
    where: { userId: targetUserId },
    select: { id: true, deviceId: true, publicKey: true, updatedAt: true },
  });
  return res.json({ deviceKeys: items });
});

router.post("/conversations/:id/keys", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const conversationId = String(req.params.id || "");
  if (!conversationId) return res.status(400).json({ error: "invalid_id" });

  const schema = z.object({
    items: z
      .array(
        z.object({
          deviceKeyId: z.string().min(1),
          userId: z.string().min(1),
          ivB64: z.string().min(1).optional(),
          encryptedKeyB64: z.string().min(1),
        })
      )
      .min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const participant = await db.chatParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) return res.status(403).json({ error: "forbidden" });

  const role = String(participant.role || "MEMBER");
  const isAdmin = role === "OWNER" || role === "ADMIN";
  if (!isAdmin) return res.status(403).json({ error: "forbidden" });

  const created = await db.$transaction(
    parsed.data.items.map((it) =>
      db.chatConversationKey.upsert({
        where: { conversationId_deviceKeyId: { conversationId, deviceKeyId: it.deviceKeyId } },
        update: { encryptedKeyB64: it.encryptedKeyB64, ivB64: it.ivB64 ?? null, userId: it.userId },
        create: { conversationId, deviceKeyId: it.deviceKeyId, userId: it.userId, ivB64: it.ivB64 ?? null, encryptedKeyB64: it.encryptedKeyB64 },
        select: { id: true },
      })
    )
  );

  return res.json({ ok: true, created: created.length });
});

router.get("/conversations/:id/keys/me", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const conversationId = String(req.params.id || "");
  if (!conversationId) return res.status(400).json({ error: "invalid_id" });

  const participant = await db.chatParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) return res.status(403).json({ error: "forbidden" });

  const keys = await db.chatConversationKey.findMany({
    where: { conversationId, userId },
    select: { id: true, deviceKeyId: true, ivB64: true, encryptedKeyB64: true, createdAt: true },
  });

  return res.json({
    keys: (keys as any[]).map((k: any) => ({
      id: k.id,
      deviceKeyId: k.deviceKeyId,
      ivB64: k.ivB64,
      encryptedKeyB64: k.encryptedKeyB64,
      createdAt: k.createdAt.toISOString(),
    })),
  });
});

router.post("/conversations/:id/members", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const conversationId = String(req.params.id || "");
  if (!conversationId) return res.status(400).json({ error: "invalid_id" });

  const schema = z.object({ addUserIds: z.array(z.string().min(1)).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const convo = await db.chatConversation.findUnique({ where: { id: conversationId }, select: { type: true } });
  if (!convo) return res.status(404).json({ error: "not_found" });
  if (convo.type !== "GROUP") return res.status(400).json({ error: "not_group" });

  const me = await db.chatParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
  if (!me) return res.status(403).json({ error: "forbidden" });

  const role = String(me.role || "MEMBER");
  const isAdmin = role === "OWNER" || role === "ADMIN";
  if (!isAdmin) return res.status(403).json({ error: "forbidden" });

  const toAdd = Array.from(new Set(parsed.data.addUserIds)).filter((id) => id !== userId);

  await db.$transaction(
    toAdd.map((u) =>
      db.chatParticipant.upsert({
        where: { conversationId_userId: { conversationId, userId: u } },
        update: {},
        create: { conversationId, userId: u, role: "MEMBER" },
      })
    )
  );

  return res.json({ ok: true });
});

router.post("/conversations/:id/promote", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const conversationId = String(req.params.id || "");
  if (!conversationId) return res.status(400).json({ error: "invalid_id" });

  const schema = z.object({ targetUserId: z.string().min(1), role: z.enum(["ADMIN", "MEMBER"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const me = await db.chatParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
  if (!me) return res.status(403).json({ error: "forbidden" });

  const myRole = String(me.role || "MEMBER");
  if (myRole !== "OWNER") return res.status(403).json({ error: "forbidden" });

  await db.chatParticipant.update({
    where: { conversationId_userId: { conversationId, userId: parsed.data.targetUserId } },
    data: { role: parsed.data.role },
  });

  return res.json({ ok: true });
});

router.get("/conversations/:id/participants", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const conversationId = String(req.params.id || "");
  if (!conversationId) return res.status(400).json({ error: "invalid_id" });

  const me = await db.chatParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
  if (!me) return res.status(403).json({ error: "forbidden" });

  const parts = await db.chatParticipant.findMany({
    where: { conversationId },
    select: {
      userId: true,
      role: true,
      joinedAt: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return res.json({
    me: { role: String(me.role || "MEMBER") },
    participants: (parts as any[]).map((p: any) => ({
      userId: String(p.userId),
      role: String(p.role || "MEMBER"),
      name: String(p.user?.name || ""),
      avatarUrl: p.user?.avatarUrl ?? null,
      joinedAt: p.joinedAt ? p.joinedAt.toISOString() : null,
    })),
  });
});

router.patch("/messages/:id", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const messageId = String(req.params.id || "");
  if (!messageId) return res.status(400).json({ error: "invalid_id" });

  const schema = z.object({ ivB64: z.string().min(1), ciphertextB64: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const existing = await db.chatMessage.findUnique({
    where: { id: messageId },
    select: { id: true, senderId: true, conversationId: true, type: true },
  });
  if (!existing) return res.status(404).json({ error: "not_found" });

  const participant = await db.chatParticipant.findUnique({
    where: { conversationId_userId: { conversationId: existing.conversationId, userId } },
  });
  if (!participant) return res.status(403).json({ error: "forbidden" });
  if (String(existing.senderId) !== userId) return res.status(403).json({ error: "forbidden" });

  const updated = await db.chatMessage.update({
    where: { id: messageId },
    data: { ivB64: parsed.data.ivB64, ciphertextB64: parsed.data.ciphertextB64 },
    select: { id: true, conversationId: true, senderId: true, type: true, ivB64: true, ciphertextB64: true, createdAt: true },
  });

  await db.chatConversation.update({ where: { id: String(existing.conversationId) }, data: {} });

  return res.json({
    message: {
      id: updated.id,
      conversationId: updated.conversationId,
      senderId: updated.senderId,
      type: updated.type,
      ivB64: updated.ivB64,
      ciphertextB64: updated.ciphertextB64,
      createdAt: updated.createdAt.toISOString(),
    },
  });
});

router.delete("/messages/:id", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const messageId = String(req.params.id || "");
  if (!messageId) return res.status(400).json({ error: "invalid_id" });

  const existing = await db.chatMessage.findUnique({
    where: { id: messageId },
    select: { id: true, senderId: true, conversationId: true },
  });
  if (!existing) return res.status(404).json({ error: "not_found" });

  const participant = await db.chatParticipant.findUnique({
    where: { conversationId_userId: { conversationId: existing.conversationId, userId } },
  });
  if (!participant) return res.status(403).json({ error: "forbidden" });
  if (String(existing.senderId) !== userId) return res.status(403).json({ error: "forbidden" });

  await db.chatMessage.delete({ where: { id: messageId } });
  await db.chatConversation.update({ where: { id: String(existing.conversationId) }, data: {} });

  return res.json({ ok: true, conversationId: String(existing.conversationId), messageId });
});

router.get("/conversations/:id/pins", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const conversationId = String(req.params.id || "");
  if (!conversationId) return res.status(400).json({ error: "invalid_id" });
  const participant = await db.chatParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
  if (!participant) return res.status(403).json({ error: "forbidden" });
  if (!hasPinnedMessagesModel(db)) return res.status(501).json({ error: "pins_not_configured" });

  const pins = await db.chatPinnedMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    select: { messageId: true, pinnedBy: true, createdAt: true },
  });

  return res.json({
    pins: (pins as any[]).map((p: any) => ({
      messageId: String(p.messageId),
      pinnedBy: String(p.pinnedBy),
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

router.post("/conversations/:id/pins", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const conversationId = String(req.params.id || "");
  if (!conversationId) return res.status(400).json({ error: "invalid_id" });
  const participant = await db.chatParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
  if (!participant) return res.status(403).json({ error: "forbidden" });
  if (!hasPinnedMessagesModel(db)) return res.status(501).json({ error: "pins_not_configured" });

  const schema = z.object({ messageId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const msg = await db.chatMessage.findUnique({ where: { id: parsed.data.messageId }, select: { id: true, conversationId: true } });
  if (!msg || String(msg.conversationId) !== conversationId) return res.status(404).json({ error: "not_found" });

  await db.chatPinnedMessage.upsert({
    where: { conversationId_messageId: { conversationId, messageId: parsed.data.messageId } },
    update: { pinnedBy: userId },
    create: { conversationId, messageId: parsed.data.messageId, pinnedBy: userId },
  });

  return res.json({ ok: true });
});

router.delete("/conversations/:id/pins/:messageId", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const conversationId = String(req.params.id || "");
  const messageId = String(req.params.messageId || "");
  if (!conversationId || !messageId) return res.status(400).json({ error: "invalid_id" });
  const participant = await db.chatParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
  if (!participant) return res.status(403).json({ error: "forbidden" });
  if (!hasPinnedMessagesModel(db)) return res.status(501).json({ error: "pins_not_configured" });

  await db.chatPinnedMessage.deleteMany({ where: { conversationId, messageId } });
  return res.json({ ok: true });
});

export default router;
