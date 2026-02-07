import { Router } from "express";
import { prisma } from "./db";
import { requireAdmin, requireAuth } from "./middleware/auth";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";

const router = Router();

type SseClient = {
  res: any;
  userId: string;
};

const sseClients = new Set<SseClient>();

function sseWrite(client: SseClient, event: string, data: any) {
  try {
    client.res.write(`event: ${event}\n`);
    client.res.write(`data: ${JSON.stringify(data ?? {})}\n\n`);
  } catch {
  }
}

function broadcastCommunityEvent(event: string, data: any) {
  for (const client of sseClients) {
    sseWrite(client, event, data);
  }
}

type CommentNode = {
  id: number;
  userId: string;
  user: string;
  avatar: string;
  avatarUrl?: string | null;
  content: string;
  timeAgo: string;
  likesBy?: string[];
  replies?: CommentNode[];
};

function asStringArray(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}

function isDbJsonNull(v: any): boolean {
  if (v === null || v === undefined) return true;
  try {
    if (typeof v === "object" && v !== null && "toJSON" in v) return false;
  } catch {
  }
  return false;
}

function normalizePollForViewer(poll: any, viewerId: string | null) {
  if (!poll || typeof poll !== "object") return null;
  const votesBy = (poll as any).votesBy && typeof (poll as any).votesBy === "object" ? (poll as any).votesBy : {};
  const userVoteRaw = viewerId ? (votesBy as any)[viewerId] : undefined;
  const userVote = userVoteRaw === undefined || userVoteRaw === null ? null : Number(userVoteRaw);
  const out: any = { ...(poll as any), userVote };
  delete out.votesBy;
  return out;
}

function collectCommentUserIds(nodes: any, out: Set<string>) {
  const list = Array.isArray(nodes) ? nodes : [];
  for (const n of list) {
    if (n && typeof n === "object") {
      if (n.userId) out.add(String(n.userId));
      if (Array.isArray((n as any).replies)) collectCommentUserIds((n as any).replies, out);
    }
  }
}

function collectDiscussionReplyUserIds(nodes: any, out: Set<string>) {
  const list = Array.isArray(nodes) ? nodes : [];
  for (const n of list) {
    if (n && typeof n === "object") {
      if (n.userId) out.add(String(n.userId));
      if (Array.isArray((n as any).replies)) collectDiscussionReplyUserIds((n as any).replies, out);
    }
  }
}

async function getUserMap(userIds: Set<string>) {
  const ids = Array.from(userIds).filter(Boolean);
  if (ids.length === 0) return new Map<string, { name: string; avatarUrl: string | null }>();

  const rows = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, avatarUrl: true },
  });

  const map = new Map<string, { name: string; avatarUrl: string | null }>();
  for (const u of rows) {
    map.set(String(u.id), { name: String(u.name || ""), avatarUrl: u.avatarUrl ? String(u.avatarUrl) : null });
  }
  return map;
}

function mapCommentNodeForViewer(node: CommentNode, viewerId: string | null, users?: Map<string, { name: string; avatarUrl: string | null }>): any {
  const likesBy = asStringArray((node as any).likesBy);
  const liked = !!viewerId && likesBy.includes(viewerId);
  const repliesRaw = Array.isArray((node as any).replies) ? ((node as any).replies as any[]) : [];

  const profile = users?.get(String(node.userId));
  const name = profile?.name || node.user;
  const avatar = initialsFromName(name);
  const avatarUrl = profile?.avatarUrl ?? null;
  return {
    ...node,
    user: name,
    avatar,
    avatarUrl,
    likes: likesBy.length,
    liked,
    likesBy: undefined,
    replies: repliesRaw.map((r) => mapCommentNodeForViewer(r as any, viewerId, users)),
  };
}

function mapCommentsForViewer(comments: any, viewerId: string | null, users?: Map<string, { name: string; avatarUrl: string | null }>): any[] {
  const list = Array.isArray(comments) ? comments : [];
  return list.map((c) => mapCommentNodeForViewer(c as any, viewerId, users));
}

async function mapCommentsForViewerWithUserHydration(comments: any, viewerId: string | null) {
  const ids = new Set<string>();
  collectCommentUserIds(comments, ids);
  const users = await getUserMap(ids);
  return mapCommentsForViewer(comments, viewerId, users);
}

function addReplyToTree(nodes: CommentNode[], parentId: number, reply: CommentNode): { next: CommentNode[]; added: boolean } {
  let added = false;
  const next = nodes.map((n) => {
    if (n.id === parentId) {
      added = true;
      const replies = Array.isArray(n.replies) ? n.replies : [];
      return { ...n, replies: [...replies, reply] };
    }
    if (Array.isArray(n.replies) && n.replies.length > 0) {
      const child = addReplyToTree(n.replies, parentId, reply);
      if (child.added) {
        added = true;
        return { ...n, replies: child.next };
      }
    }
    return n;
  });
  return { next, added };
}

function updateNodeInTree(
  nodes: CommentNode[],
  nodeId: number,
  updater: (n: CommentNode) => CommentNode
): { next: CommentNode[]; updated: boolean } {
  let updated = false;
  const next = nodes.map((n) => {
    if (n.id === nodeId) {
      updated = true;
      return updater(n);
    }
    if (Array.isArray(n.replies) && n.replies.length > 0) {
      const child = updateNodeInTree(n.replies, nodeId, updater);
      if (child.updated) {
        updated = true;
        return { ...n, replies: child.next };
      }
    }
    return n;
  });
  return { next, updated };
}

function deleteNodeFromTree(nodes: CommentNode[], nodeId: number): { next: CommentNode[]; deleted: CommentNode | null } {
  let deleted: CommentNode | null = null;

  const next = nodes
    .filter((n) => {
      if (n.id === nodeId) {
        deleted = n;
        return false;
      }
      return true;
    })
    .map((n) => {
      if (Array.isArray(n.replies) && n.replies.length > 0) {
        const child = deleteNodeFromTree(n.replies, nodeId);
        if (child.deleted) {
          deleted = child.deleted;
          return { ...n, replies: child.next };
        }
      }
      return n;
    });

  return { next, deleted };
}

function isAdmin(req: any) {
  return String(req.auth?.role || "") === "ADMIN";
}

function canEditOwnerContent(req: any, ownerUserId: string) {
  return req.auth?.userId === ownerUserId || isAdmin(req);
}

function getOptionalAuth(req: any): { userId: string; role: string } | null {
  const token = req.cookies?.grovix_token;
  if (!token) return null;

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const decoded = jwt.verify(token, secret) as any;
    if (!decoded?.userId) return null;
    return { userId: String(decoded.userId), role: String(decoded.role || "") };
  } catch {
    return null;
  }
}

function initialsFromName(name: string) {
  return String(name || "U")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function countTreeNodes(nodes: any): number {
  const list = Array.isArray(nodes) ? nodes : [];
  return list.reduce((sum, n) => sum + 1 + countTreeNodes((n as any)?.replies), 0);
}

async function createAuditLog(actorUserId: string, action: string, entityType: string, entityId: string | null, before: any, after: any) {
  try {
    await (prisma as any).auditLog.create({
      data: {
        actorUserId,
        action,
        entityType,
        entityId: entityId || null,
        before: before === undefined ? Prisma.JsonNull : before,
        after: after === undefined ? Prisma.JsonNull : after,
      },
    });
  } catch {
  }
}

async function createCommunityNotification(userId: string, payload: { type: string; title?: string | null; body: string; link?: string | null; meta?: any }) {
  try {
    await (prisma as any).communityNotification.create({
      data: {
        userId,
        type: String(payload.type || ""),
        title: payload.title ? String(payload.title) : null,
        body: String(payload.body || ""),
        link: payload.link ? String(payload.link) : null,
        meta: payload.meta ?? Prisma.JsonNull,
      },
    });
    broadcastCommunityEvent("notifications_changed", { userId });
  } catch {
  }
}

function requireNonEmptyString(v: any, maxLen: number) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizeSeverity(raw: any) {
  const s = String(raw || "").toUpperCase();
  if (s === "LOW" || s === "MEDIUM" || s === "HIGH" || s === "CRITICAL") return s;
  return "MEDIUM";
}

function normalizeReportTargetType(raw: any) {
  const t = String(raw || "").toUpperCase();
  if (t === "POST" || t === "POST_COMMENT" || t === "DISCUSSION" || t === "DISCUSSION_REPLY" || t === "USER") return t;
  return null;
}

function normalizeModerationActionType(raw: any) {
  const t = String(raw || "").toUpperCase();
  if (t === "REMOVE_CONTENT" || t === "RESTORE_CONTENT" || t === "ISSUE_WARNING" || t === "TEMP_BAN" || t === "PERM_BAN") return t;
  return null;
}

function findNodeInTree(nodes: any, nodeId: number): any | null {
  const list = Array.isArray(nodes) ? nodes : [];
  for (const n of list) {
    if (!n || typeof n !== "object") continue;
    if (Number((n as any).id) === nodeId) return n;
    const child = findNodeInTree((n as any).replies, nodeId);
    if (child) return child;
  }
  return null;
}

function updateNodeInTreeGeneric(nodes: any, nodeId: number, updater: (n: any) => any): { next: any[]; updated: boolean; before?: any; after?: any } {
  let updated = false;
  let before: any = undefined;
  let after: any = undefined;
  const list = Array.isArray(nodes) ? nodes : [];
  const next = list.map((n) => {
    if (!n || typeof n !== "object") return n;
    if (Number((n as any).id) === nodeId) {
      updated = true;
      before = n;
      after = updater(n);
      return after;
    }
    if (Array.isArray((n as any).replies) && (n as any).replies.length) {
      const child = updateNodeInTreeGeneric((n as any).replies, nodeId, updater);
      if (child.updated) {
        updated = true;
        before = child.before;
        after = child.after;
        return { ...n, replies: child.next };
      }
    }
    return n;
  });
  return { next, updated, before, after };
}

function dateOnlyString(date: Date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysDiff(a: string, b: string) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  const diff = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

async function recordUserActivity(userId: string) {
  const today = dateOnlyString();

  try {
    const client = (prisma as any).userStreak;
    if (!client) return;

    const existing = await client.findUnique({ where: { userId } });
    const last = existing?.lastActivityDate ? String(existing.lastActivityDate) : null;
    if (last === today) return;

    let nextCount = 1;
    if (last) {
      const diff = daysDiff(last, today);
      if (diff === 1) nextCount = (Number(existing?.count || 0) || 0) + 1;
      else nextCount = 1;
    }

    const nextLongest = Math.max(Number(existing?.longestStreak || 0) || 0, nextCount);
    const nextTotal = (Number(existing?.totalActiveDays || 0) || 0) + 1;

    await client.upsert({
      where: { userId },
      create: { userId, count: nextCount, longestStreak: nextLongest, totalActiveDays: nextTotal, lastActivityDate: today },
      update: { count: nextCount, longestStreak: nextLongest, totalActiveDays: nextTotal, lastActivityDate: today },
    });
  } catch {
    return;
  }
}

function extractHashtagsFromText(text: string): string[] {
  const raw = String(text || "").match(/#[a-zA-Z0-9_]+/g) || [];
  return raw.map((t) => t.toLowerCase());
}

// -------- Live updates (SSE) --------
router.get("/events", requireAuth, async (req: any, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    res.write("retry: 2000\n\n");
  } catch {
  }

  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  const client: SseClient = { res, userId: String(req.auth?.userId || "") };
  sseClients.add(client);
  sseWrite(client, "connected", { ok: true, ts: Date.now() });

  const heartbeat = setInterval(() => {
    sseWrite(client, "ping", { ts: Date.now() });
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(client);
  });
});

// -------- Posts --------
router.get("/posts", async (req, res) => {
  const auth = getOptionalAuth(req);
  const viewerId = auth?.userId || null;
  const canSeeRemoved = auth?.role === "ADMIN";
  const includeRemoved = canSeeRemoved && (String(req.query?.includeRemoved || "") === "1" || String(req.query?.includeRemoved || "") === "true");
  const onlySaved = String(req.query?.saved || "") === "1" || String(req.query?.saved || "") === "true";

  const filterUserId = String(req.query?.userId || "").trim();

  const items = await prisma.communityPost.findMany({
    where: filterUserId
      ? ({ userId: filterUserId, ...(includeRemoved ? {} : { status: "ACTIVE" }) } as any)
      : ((includeRemoved ? {} : { status: "ACTIVE" }) as any),
    orderBy: { createdAt: "desc" },
  });

  const userIds = new Set<string>();
  for (const p of items) {
    userIds.add(String(p.userId));
    collectCommentUserIds((p as any).comments, userIds);
  }
  const userMap = await getUserMap(userIds);

  const posts = items
    .map((p) => {
      const likesBy = asStringArray((p as any).likesBy);
      const savesBy = asStringArray((p as any).savesBy);
      const liked = !!viewerId && likesBy.includes(viewerId);
      const saved = !!viewerId && savesBy.includes(viewerId);

      const profile = userMap.get(String(p.userId));
      const name = profile?.name || p.user;
      const avatar = initialsFromName(name);
      const avatarUrl = profile?.avatarUrl ?? null;

      const reactionsBy = (p as any).reactionsBy && typeof (p as any).reactionsBy === "object" ? (p as any).reactionsBy : {};
      const reactionsMap: Record<string, number> = {};
      for (const v of Object.values(reactionsBy || {})) {
        const t = String(v || "");
        if (!t) continue;
        reactionsMap[t] = (reactionsMap[t] || 0) + 1;
      }
      const userReaction = viewerId ? String((reactionsBy || {})[viewerId] || "") || null : null;

      return {
        id: Number(p.legacyId),
        status: (p as any).status,
        userId: p.userId,
        user: name,
        avatar,
        avatarUrl,
        title: p.title,
        company: p.company,
        timeAgo: p.timeAgo,
        content: p.content,
        images: p.images,
        xp: p.xp,
        likes: likesBy.length,
        comments: mapCommentsForViewer(p.comments, viewerId, userMap),
        shares: p.shares,
        liked,
        saved,
        reactions: Object.keys(reactionsMap).length ? reactionsMap : p.reactions,
        userReaction,
        poll: normalizePollForViewer((p as any).poll, viewerId),
        aiScore: p.aiScore,
        aiReason: p.aiReason,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    })
    .filter((p) => (onlySaved ? p.saved : true));

  return res.json({ posts });
});

router.post("/posts", requireAuth, async (req: any, res) => {
  const actorUserId = req.auth.userId as string;
  const me = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!me) return res.status(401).json({ error: "unauthorized" });

  recordUserActivity(actorUserId).catch(() => {});

  const content = String(req.body?.content || "").trim();
  const images = Array.isArray(req.body?.images) ? req.body.images.map((s: any) => String(s)) : [];
  if (!content) return res.status(400).json({ error: "invalid_request" });

  const pollIncoming = req.body?.poll;
  let poll: any = null;
  if (pollIncoming && typeof pollIncoming === "object") {
    const q = typeof pollIncoming.question === "string" ? pollIncoming.question.trim() : "";
    const opts = Array.isArray(pollIncoming.options) ? pollIncoming.options : [];
    const cleaned = opts
      .map((o: any) => ({
        id: Number(o?.id),
        text: typeof o?.text === "string" ? String(o.text).trim() : "",
        votes: Number(o?.votes || 0) || 0,
      }))
      .filter((o: any) => Number.isFinite(o.id) && o.id > 0 && o.text);

    if (q && cleaned.length >= 2) {
      poll = {
        question: q,
        options: cleaned,
        totalVotes: Number(pollIncoming.totalVotes || 0) || 0,
        votesBy: {},
      };
    }
  }

  const legacyId = BigInt(Date.now());

  const created = await prisma.communityPost.create({
    data: {
      legacyId,
      user: String(me.name || ""),
      avatar: initialsFromName(me.name || ""),
      title: String(req.body?.title || "Grovix Member"),
      company: String(req.body?.company || "Learning"),
      timeAgo: "Just now",
      content,
      images,
      xp: Number(req.body?.xp || 50) || 50,
      shares: 0,
      comments: [],
      likesBy: [],
      savesBy: [],
      reactionsBy: {},
      poll: poll ? poll : Prisma.JsonNull,
      userRef: { connect: { id: actorUserId } },
    } as any,
  });

  broadcastCommunityEvent("posts_changed", { postId: Number(created.legacyId), action: "created" });

  return res.json({
    post: {
      id: Number(created.legacyId),
      userId: created.userId,
      user: created.user,
      avatar: created.avatar,
      avatarUrl: me.avatarUrl || null,
      title: created.title,
      company: created.company,
      timeAgo: created.timeAgo,
      content: created.content,
      images: created.images,
      xp: created.xp,
      likes: 0,
      comments: [],
      shares: created.shares,
      liked: false,
      saved: false,
      reactions: {},
      userReaction: null,
      poll: normalizePollForViewer((created as any).poll, actorUserId),
      aiScore: created.aiScore,
      aiReason: created.aiReason,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
});

router.patch("/posts/:id", requireAuth, async (req: any, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const existing = await prisma.communityPost.findUnique({ where: { legacyId } });
  if (!existing) return res.status(404).json({ error: "not_found" });
  if ((existing as any).status === "REMOVED") return res.status(404).json({ error: "not_found" });
  if (!canEditOwnerContent(req, existing.userId)) return res.status(403).json({ error: "forbidden" });

  const content = typeof req.body?.content === "string" ? String(req.body.content) : undefined;
  const images = Array.isArray(req.body?.images) ? req.body.images.map((s: any) => String(s)) : undefined;

  const updated = await prisma.communityPost.update({
    where: { legacyId },
    data: {
      content: typeof content === "string" ? content : existing.content,
      images: images ?? existing.images,
      timeAgo: "Edited just now",
    },
  });

  broadcastCommunityEvent("posts_changed", { postId: Number(updated.legacyId), action: "updated" });

  const auth = getOptionalAuth(req);
  const viewerId = auth?.userId || null;
  const likesBy = asStringArray((updated as any).likesBy);
  const savesBy = asStringArray((updated as any).savesBy);
  const liked = !!viewerId && likesBy.includes(viewerId);
  const saved = !!viewerId && savesBy.includes(viewerId);

  const ids = new Set<string>([String(updated.userId)]);
  collectCommentUserIds(updated.comments, ids);
  const users = await getUserMap(ids);
  const profile = users.get(String(updated.userId));
  const name = profile?.name || updated.user;
  const avatar = initialsFromName(name);
  const avatarUrl = profile?.avatarUrl ?? null;

  return res.json({
    post: {
      id: Number(updated.legacyId),
      userId: updated.userId,
      user: name,
      avatar,
      avatarUrl,
      title: updated.title,
      company: updated.company,
      timeAgo: updated.timeAgo,
      content: updated.content,
      images: updated.images,
      xp: updated.xp,
      likes: likesBy.length,
      comments: mapCommentsForViewer(updated.comments, viewerId, users),
      shares: updated.shares,
      liked,
      saved,
      reactions: updated.reactions,
      userReaction: updated.userReaction,
      poll: updated.poll,
      aiScore: updated.aiScore,
      aiReason: updated.aiReason,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

router.post("/posts/:id/like", requireAuth, async (req: any, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const actorUserId = req.auth.userId as string;
  const post = await prisma.communityPost.findUnique({ where: { legacyId } });
  if (!post) return res.status(404).json({ error: "not_found" });
  if ((post as any).status === "REMOVED") return res.status(404).json({ error: "not_found" });

  const likesBy = asStringArray((post as any).likesBy);
  const next = likesBy.includes(actorUserId) ? likesBy.filter((id) => id !== actorUserId) : [...likesBy, actorUserId];

  await prisma.communityPost.update({ where: { legacyId }, data: ({ likesBy: next } as any) });
  broadcastCommunityEvent("posts_changed", { postId: Number(legacyId), action: "liked" });
  return res.json({ liked: next.includes(actorUserId), likes: next.length });
});

router.post("/posts/:id/save", requireAuth, async (req: any, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const actorUserId = req.auth.userId as string;
  const post = await prisma.communityPost.findUnique({ where: { legacyId } });
  if (!post) return res.status(404).json({ error: "not_found" });
  if ((post as any).status === "REMOVED") return res.status(404).json({ error: "not_found" });

  const savesBy = asStringArray((post as any).savesBy);
  const next = savesBy.includes(actorUserId)
    ? savesBy.filter((id) => id !== actorUserId)
    : [...savesBy, actorUserId];

  await prisma.communityPost.update({ where: { legacyId }, data: ({ savesBy: next } as any) });
  broadcastCommunityEvent("posts_changed", { postId: Number(legacyId), action: "saved" });
  return res.json({ saved: next.includes(actorUserId) });
});

router.post("/posts/:id/reaction", requireAuth, async (req: any, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const actorUserId = req.auth.userId as string;
  const reaction = req.body?.reaction === null ? null : String(req.body?.reaction || "");

  const post = await prisma.communityPost.findUnique({ where: { legacyId } });
  if (!post) return res.status(404).json({ error: "not_found" });
  if ((post as any).status === "REMOVED") return res.status(404).json({ error: "not_found" });

  const reactionsBy = (post as any).reactionsBy && typeof (post as any).reactionsBy === "object" ? { ...(post as any).reactionsBy } : {};
  const current = reactionsBy[actorUserId] ? String(reactionsBy[actorUserId]) : null;

  if (!reaction || reaction === current) {
    delete reactionsBy[actorUserId];
  } else {
    reactionsBy[actorUserId] = reaction;
  }

  await prisma.communityPost.update({ where: { legacyId }, data: ({ reactionsBy } as any) });
  broadcastCommunityEvent("posts_changed", { postId: Number(legacyId), action: "reacted" });
  const nextUserReaction = reactionsBy[actorUserId] ? String(reactionsBy[actorUserId]) : null;

  const counts: Record<string, number> = {};
  for (const v of Object.values(reactionsBy || {})) {
    const t = String(v || "");
    if (!t) continue;
    counts[t] = (counts[t] || 0) + 1;
  }

  return res.json({ userReaction: nextUserReaction, reactions: counts });
});

router.post("/posts/:id/poll/vote", requireAuth, async (req: any, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const optionId = Number(req.body?.optionId);
  if (!Number.isFinite(optionId)) return res.status(400).json({ error: "invalid_option" });

  const actorUserId = req.auth.userId as string;
  const post = await prisma.communityPost.findUnique({ where: { legacyId } });
  if (!post) return res.status(404).json({ error: "not_found" });
  if ((post as any).status === "REMOVED") return res.status(404).json({ error: "not_found" });

  const currentPoll = (post as any).poll;
  if (!currentPoll || typeof currentPoll !== "object") return res.status(400).json({ error: "no_poll" });

  const votesByRaw = (currentPoll as any).votesBy && typeof (currentPoll as any).votesBy === "object" ? (currentPoll as any).votesBy : {};
  const votesBy: Record<string, number> = { ...(votesByRaw as any) };
  const existingVote = votesBy[actorUserId];
  if (existingVote !== undefined && existingVote !== null) {
    return res.status(409).json({ error: "already_voted", poll: normalizePollForViewer(currentPoll, actorUserId) });
  }

  const options = Array.isArray((currentPoll as any).options) ? ((currentPoll as any).options as any[]) : [];
  const hasOption = options.some((o) => Number(o?.id) === optionId);
  if (!hasOption) return res.status(400).json({ error: "invalid_option" });

  const nextOptions = options.map((o) => {
    if (Number(o?.id) !== optionId) return o;
    return { ...o, votes: (Number(o?.votes || 0) || 0) + 1 };
  });

  votesBy[actorUserId] = optionId;

  const nextPoll = {
    ...(currentPoll as any),
    options: nextOptions,
    totalVotes: (Number((currentPoll as any).totalVotes || 0) || 0) + 1,
    votesBy,
  };

  const updated = await prisma.communityPost.update({ where: { legacyId }, data: ({ poll: nextPoll } as any) });
  broadcastCommunityEvent("posts_changed", { postId: Number(legacyId), action: "poll_voted" });
  return res.json({ poll: normalizePollForViewer((updated as any).poll, actorUserId) });
});

router.post("/posts/:id/comments", requireAuth, async (req: any, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const actorUserId = req.auth.userId as string;
  const me = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!me) return res.status(401).json({ error: "unauthorized" });

  const content = String(req.body?.content || "").trim();
  if (!content) return res.status(400).json({ error: "invalid_request" });

  const parentIdRaw = req.body?.parentId;
  const parentId = typeof parentIdRaw === "number" ? parentIdRaw : parentIdRaw ? Number(parentIdRaw) : null;

  const post = await prisma.communityPost.findUnique({ where: { legacyId } });
  if (!post) return res.status(404).json({ error: "not_found" });
  if ((post as any).status === "REMOVED") return res.status(404).json({ error: "not_found" });

  const node: CommentNode = {
    id: Date.now(),
    userId: actorUserId,
    user: String(me.name || ""),
    avatar: initialsFromName(me.name || ""),
    content,
    timeAgo: "Just now",
    likesBy: [],
    replies: [],
  };

  const current = (Array.isArray(post.comments) ? post.comments : []) as any as CommentNode[];
  const next = parentId ? addReplyToTree(current, parentId, node) : { next: [...current, node], added: true };
  if (parentId && !next.added) return res.status(404).json({ error: "parent_not_found" });

  const updated = await prisma.communityPost.update({ where: { legacyId }, data: ({ comments: next.next } as any) });
  broadcastCommunityEvent("posts_changed", { postId: Number(legacyId), action: "commented" });
  return res.json({ comments: await mapCommentsForViewerWithUserHydration(updated.comments, actorUserId) });
});

router.post("/posts/:id/comments/:commentId/like", requireAuth, async (req: any, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const commentId = Number(req.params.commentId);
  if (!Number.isFinite(commentId)) return res.status(400).json({ error: "invalid_comment_id" });

  const actorUserId = req.auth.userId as string;
  const post = await prisma.communityPost.findUnique({ where: { legacyId } });
  if (!post) return res.status(404).json({ error: "not_found" });
  if ((post as any).status === "REMOVED") return res.status(404).json({ error: "not_found" });

  const current = (Array.isArray(post.comments) ? post.comments : []) as any as CommentNode[];
  const upd = updateNodeInTree(current, commentId, (n) => {
    const likesBy = asStringArray((n as any).likesBy);
    const next = likesBy.includes(actorUserId) ? likesBy.filter((id) => id !== actorUserId) : [...likesBy, actorUserId];
    return { ...n, likesBy: next };
  });

  if (!upd.updated) return res.status(404).json({ error: "comment_not_found" });
  const updated = await prisma.communityPost.update({ where: { legacyId }, data: ({ comments: upd.next } as any) });
  broadcastCommunityEvent("posts_changed", { postId: Number(legacyId), action: "comment_liked" });
  return res.json({ comments: await mapCommentsForViewerWithUserHydration(updated.comments, actorUserId) });
});

router.delete("/posts/:id/comments/:commentId", requireAuth, async (req: any, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const commentId = Number(req.params.commentId);
  if (!Number.isFinite(commentId)) return res.status(400).json({ error: "invalid_comment_id" });

  const actorUserId = req.auth.userId as string;
  const post = await prisma.communityPost.findUnique({ where: { legacyId } });
  if (!post) return res.status(404).json({ error: "not_found" });
  if ((post as any).status === "REMOVED") return res.status(404).json({ error: "not_found" });

  const current = (Array.isArray(post.comments) ? post.comments : []) as any as CommentNode[];
  const del = deleteNodeFromTree(current, commentId);
  if (!del.deleted) return res.status(404).json({ error: "comment_not_found" });
  if (!canEditOwnerContent(req, del.deleted.userId)) return res.status(403).json({ error: "forbidden" });

  const updated = await prisma.communityPost.update({ where: { legacyId }, data: ({ comments: del.next } as any) });
  broadcastCommunityEvent("posts_changed", { postId: Number(legacyId), action: "comment_deleted" });
  return res.json({ comments: await mapCommentsForViewerWithUserHydration(updated.comments, actorUserId) });
});

router.put("/posts", requireAdmin, async (req: any, res) => {
  const incoming = Array.isArray(req.body?.posts) ? req.body.posts : [];
  const actorUserId = req.auth.userId as string;

  // Upsert each post by legacyId
  for (const p of incoming) {
    let legacyId: bigint;
    try {
      legacyId = BigInt(p.id);
    } catch {
      continue;
    }

    const existing = await prisma.communityPost.findUnique({ where: { legacyId } });

    if (!existing) {
      await prisma.communityPost.create({
        data: ({
          legacyId,
          user: String(p.user || ""),
          avatar: String(p.avatar || ""),
          title: String(p.title || ""),
          company: String(p.company || ""),
          timeAgo: String(p.timeAgo || ""),
          content: String(p.content || ""),
          images: Array.isArray(p.images) ? p.images : [],
          xp: Number(p.xp || 0) || 0,
          likes: 0,
          shares: Number(p.shares || 0) || 0,
          liked: false,
          saved: false,
          likesBy: [],
          savesBy: [],
          comments: [],
          reactions: Prisma.JsonNull,
          userReaction: null,
          reactionsBy: {},
          poll: p.poll || null,
          aiScore: p.aiScore ?? null,
          aiReason: p.aiReason ?? null,
          userRef: { connect: { id: actorUserId } },
        } as any),
      });
      continue;
    }

    const canEdit = canEditOwnerContent(req, existing.userId);

    const updateData: any = {
      poll: p.poll || null,
    };

    if (canEdit) {
      updateData.user = String(p.user || existing.user);
      updateData.avatar = String(p.avatar || existing.avatar);
      updateData.title = String(p.title || existing.title);
      updateData.company = String(p.company || existing.company);
      updateData.timeAgo = String(p.timeAgo || existing.timeAgo);
      updateData.content = String(p.content || existing.content);
      updateData.images = Array.isArray(p.images) ? p.images : existing.images;
      updateData.xp = Number(p.xp || 0) || 0;
      updateData.aiScore = p.aiScore ?? null;
      updateData.aiReason = p.aiReason ?? null;
    }

    await prisma.communityPost.update({ where: { legacyId }, data: updateData });
  }

  return res.json({ ok: true });
});

router.delete("/posts/:id", requireAuth, async (req, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const existing = await prisma.communityPost.findUnique({ where: { legacyId } });
  if (!existing) return res.json({ ok: true });

  if ((existing as any).status === "REMOVED") return res.json({ ok: true });

  if (!canEditOwnerContent(req, existing.userId)) return res.status(403).json({ error: "forbidden" });

  await prisma.communityPost.delete({ where: { legacyId } });
  broadcastCommunityEvent("posts_changed", { postId: Number(legacyId), action: "deleted" });
  return res.json({ ok: true });
});

router.post("/posts/:id/share", async (req, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const post = await prisma.communityPost.findUnique({ where: { legacyId } });
  if (!post) return res.status(404).json({ error: "not_found" });
  if ((post as any).status === "REMOVED") return res.status(404).json({ error: "not_found" });

  await prisma.communityPost.updateMany({ where: { legacyId }, data: { shares: { increment: 1 } } });
  broadcastCommunityEvent("posts_changed", { postId: Number(legacyId), action: "shared" });
  return res.json({ ok: true });
});

// -------- Social / Discovery (follows, trending, stats) --------
router.get("/follow", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;

  try {
    const followClient = (prisma as any).follow;
    const followingRows = await followClient.findMany({ where: { followerId: userId }, select: { followingId: true } });
    const followerRows = await followClient.findMany({ where: { followingId: userId }, select: { followerId: true } });

    return res.json({
      followers: followerRows.map((r: any) => String(r.followerId)),
      following: followingRows.map((r: any) => String(r.followingId)),
    });
  } catch {
    return res.json({ followers: [], following: [] });
  }
});

router.post("/follow/:targetUserId", requireAuth, async (req: any, res) => {
  const followerId = req.auth.userId as string;
  const followingId = String(req.params.targetUserId || "");

  if (!followingId) return res.status(400).json({ error: "invalid_target" });
  if (followingId === followerId) return res.status(400).json({ error: "cannot_follow_self" });

  try {
    await (prisma as any).follow.create({ data: { followerId, followingId } });
  } catch {
  }

  return res.json({ ok: true });
});

router.delete("/follow/:targetUserId", requireAuth, async (req: any, res) => {
  const followerId = req.auth.userId as string;
  const followingId = String(req.params.targetUserId || "");
  if (!followingId) return res.status(400).json({ error: "invalid_target" });

  try {
    await (prisma as any).follow.deleteMany({ where: { followerId, followingId } });
  } catch {
  }
  return res.json({ ok: true });
});

router.get("/users/bulk", requireAuth, async (req, res) => {
  const idsParam = String(req.query?.ids || "").trim();
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) return res.json({ users: [] });

  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  const out = users.map((u) => ({
    id: u.id,
    name: u.name,
    avatar: initialsFromName(u.name),
    avatarUrl: u.avatarUrl || null,
    xp: u.xp,
  }));

  return res.json({ users: out });
});

router.get("/users/suggested", requireAuth, async (req, res) => {
  const limitRaw = Number(req.query?.limit || 4);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, limitRaw)) : 4;

  const auth = getOptionalAuth(req);
  const viewerId = auth?.userId || null;

  let excludeIds: string[] = [];
  if (viewerId) {
    excludeIds.push(viewerId);
    try {
      const rows = await (prisma as any).follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } });
      excludeIds.push(...rows.map((r: any) => String(r.followingId)));
    } catch {
    }
  }

  const where: any = excludeIds.length ? { id: { notIn: excludeIds } } : {};
  const users = await prisma.user.findMany({ where, orderBy: { xp: "desc" }, take: limit });
  const out = users.map((u) => ({
    id: u.id,
    name: u.name,
    avatar: initialsFromName(u.name),
    avatarUrl: u.avatarUrl || null,
    xp: u.xp,
    skills: [],
  }));

  return res.json({ users: out });
});

router.get("/trending-topics", async (req, res) => {
  const limitRaw = Number(req.query?.limit || 5);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, limitRaw)) : 5;

  const auth = getOptionalAuth(req as any);
  const canSeeRemoved = auth?.role === "ADMIN";
  const includeRemoved = canSeeRemoved && (String((req as any).query?.includeRemoved || "") === "1" || String((req as any).query?.includeRemoved || "") === "true");

  const posts = await prisma.communityPost.findMany({
    where: (includeRemoved ? {} : { status: "ACTIVE" }) as any,
    select: { content: true },
  });
  const counts = new Map<string, number>();
  for (const p of posts) {
    for (const tag of extractHashtagsFromText(p.content)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  const topics = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, postsCount]) => ({ tag, posts: postsCount }));

  return res.json({ topics });
});

router.get("/stats", async (_req, res) => {
  const req: any = _req;
  const auth = getOptionalAuth(req);
  const canSeeRemoved = auth?.role === "ADMIN";
  const includeRemoved = canSeeRemoved && (String(req.query?.includeRemoved || "") === "1" || String(req.query?.includeRemoved || "") === "true");

  const members = await prisma.user.count();
  const posts = await prisma.communityPost.count({ where: (includeRemoved ? {} : { status: "ACTIVE" }) as any });
  const discussions = await prisma.communityDiscussion.count({ where: (includeRemoved ? {} : { status: "ACTIVE" }) as any });

  let onlineNow = 0;
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    onlineNow = await prisma.user.count({ where: ({ lastSeenAt: { gte: fiveMinAgo } } as any) });
  } catch {
    onlineNow = 0;
  }

  return res.json({ members, onlineNow, posts, discussions });
});

// -------- Discussions --------
router.get("/discussions", async (_req, res) => {
  const req: any = _req;
  const auth = getOptionalAuth(req);
  const canSeeRemoved = auth?.role === "ADMIN";
  const includeRemoved = canSeeRemoved && (String(req.query?.includeRemoved || "") === "1" || String(req.query?.includeRemoved || "") === "true");

  const items = await prisma.communityDiscussion.findMany({
    where: (includeRemoved ? {} : { status: "ACTIVE" }) as any,
    orderBy: { createdAt: "desc" },
  });

  const ids = new Set<string>();
  for (const d of items) {
    ids.add(String(d.userId));
    collectDiscussionReplyUserIds((d as any).replies, ids);
  }
  const userMap = await getUserMap(ids);

  const mapReplyTree = (nodes: any): any[] => {
    const list = Array.isArray(nodes) ? nodes : [];
    return list.map((n) => {
      const profile = userMap.get(String(n?.userId || ""));
      const name = profile?.name || String(n?.user || "");
      const avatar = initialsFromName(name);
      const avatarUrl = profile?.avatarUrl ?? null;
      return {
        ...n,
        user: name,
        avatar,
        avatarUrl,
        replies: mapReplyTree((n as any)?.replies),
      };
    });
  };

  const discussions = items.map((d) => {
    const profile = userMap.get(String(d.userId));
    const author = profile?.name || d.author;
    const avatar = initialsFromName(author);
    const avatarUrl = profile?.avatarUrl ?? null;

    return {
      id: Number(d.legacyId),
      status: (d as any).status,
      userId: d.userId,
      category: d.category,
      title: d.title,
      content: d.content,
      author,
      avatar,
      avatarUrl,
      replies: mapReplyTree((d as any).replies),
      views: d.views,
      hot: d.hot,
      pinned: (d as any).pinned ?? false,
      locked: (d as any).locked ?? false,
      archived: (d as any).archived ?? false,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  });

  return res.json({ discussions });
});

router.post("/discussions", requireAuth, async (req: any, res) => {
  const actorUserId = String(req.auth?.userId || "");
  const category = String(req.body?.category || "").trim();
  const title = String(req.body?.title || "").trim();
  const content = String(req.body?.content || "").trim();

  if (!category || !title || !content) return res.status(400).json({ error: "invalid_request" });

  const user = await prisma.user.findUnique({ where: { id: actorUserId }, select: { name: true, avatarUrl: true } });
  const author = (user as any)?.name || "Grovix Member";
  const avatar = initialsFromName(author);
  const avatarUrl = (user as any)?.avatarUrl ?? null;

  const baseLegacyId = BigInt(Date.now());
  let created: any = null;
  for (let i = 0; i < 5; i++) {
    const legacyId = baseLegacyId + BigInt(i);
    try {
      created = await prisma.communityDiscussion.create({
        data: {
          legacyId,
          userId: actorUserId,
          category,
          title,
          content,
          author,
          avatar,
          replies: [],
          views: 0,
          hot: false,
        } as any,
      });
      break;
    } catch (e: any) {
      const code = e?.code;
      if (code === "P2002") continue;
      throw e;
    }
  }

  if (!created) return res.status(500).json({ error: "create_failed" });

  return res.json({
    discussion: {
      id: Number(created.legacyId),
      userId: created.userId,
      category: created.category,
      title: created.title,
      content: created.content,
      author,
      avatar,
      avatarUrl,
      replies: [],
      views: created.views,
      hot: created.hot,
      pinned: (created as any).pinned ?? false,
      locked: (created as any).locked ?? false,
      archived: (created as any).archived ?? false,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
});

router.post("/discussions/:id/view", async (req, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const discussion = await prisma.communityDiscussion.findUnique({ where: { legacyId } });
  if (!discussion) return res.status(404).json({ error: "not_found" });
  if ((discussion as any).status === "REMOVED") return res.status(404).json({ error: "not_found" });

  await prisma.communityDiscussion.updateMany({ where: { legacyId }, data: { views: { increment: 1 } } });
  return res.json({ ok: true });
});

router.post("/discussions/:id/replies", requireAuth, async (req: any, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const actorUserId = String(req.auth?.userId || "");
  const content = String(req.body?.content || "").trim();
  const parentReplyIdRaw = req.body?.parentReplyId;

  const parentReplyId = parentReplyIdRaw === undefined || parentReplyIdRaw === null || String(parentReplyIdRaw) === "" ? null : Number(parentReplyIdRaw);
  if (!content) return res.status(400).json({ error: "invalid_request" });
  if (parentReplyId !== null && !Number.isFinite(parentReplyId)) return res.status(400).json({ error: "invalid_request" });

  const discussion = await prisma.communityDiscussion.findUnique({ where: { legacyId } });
  if (!discussion) return res.status(404).json({ error: "not_found" });
  if ((discussion as any).status === "REMOVED") return res.status(404).json({ error: "not_found" });

  const user = await prisma.user.findUnique({ where: { id: actorUserId }, select: { name: true, avatarUrl: true } });
  const name = (user as any)?.name || "Grovix Member";
  const avatar = initialsFromName(name);
  const avatarUrl = (user as any)?.avatarUrl ?? null;

  const repliesRaw = Array.isArray((discussion as any).replies) ? ((discussion as any).replies as any[]) : [];

  const generateReplyId = () => {
    // Keep numeric IDs (frontend assumes number) but reduce collision risk.
    // Date.now() is ms; multiply by 1000 and add a 0-999 random to allow many ids per ms.
    const base = Date.now() * 1000;
    const rand = Math.floor(Math.random() * 1000);
    return base + rand;
  };

  let replyId = generateReplyId();
  for (let i = 0; i < 10; i++) {
    if (!findNodeInTree(repliesRaw, replyId)) break;
    replyId = generateReplyId();
  }

  const replyNode: any = {
    id: replyId,
    userId: actorUserId,
    user: name,
    avatar,
    avatarUrl,
    content,
    timeAgo: "Just now",
    likes: 0,
    liked: false,
    replies: [],
  };

  let nextReplies: any[] = repliesRaw;

  if (parentReplyId !== null) {
    const added = addReplyToTree(repliesRaw as any, parentReplyId, replyNode as any);
    nextReplies = added.added ? added.next : repliesRaw;
    if (!added.added) return res.status(404).json({ error: "parent_not_found" });
  } else {
    nextReplies = [...repliesRaw, replyNode];
  }

  const updated = await prisma.communityDiscussion.update({ where: { legacyId }, data: { replies: nextReplies } });

  const ids = new Set<string>();
  ids.add(String(updated.userId));
  collectDiscussionReplyUserIds((updated as any).replies, ids);
  const userMap = await getUserMap(ids);

  const mapReplyTree = (nodes: any): any[] => {
    const list = Array.isArray(nodes) ? nodes : [];
    return list.map((n) => {
      const profile = userMap.get(String(n?.userId || ""));
      const nn = profile?.name || String(n?.user || "");
      const av = initialsFromName(nn);
      const au = profile?.avatarUrl ?? null;
      return {
        ...n,
        user: nn,
        avatar: av,
        avatarUrl: au,
        replies: mapReplyTree((n as any)?.replies),
      };
    });
  };

  const authorProfile = userMap.get(String(updated.userId));
  const author = authorProfile?.name || (updated as any).author;
  const authorAvatar = initialsFromName(author);
  const authorAvatarUrl = authorProfile?.avatarUrl ?? null;

  return res.json({
    discussion: {
      id: Number(updated.legacyId),
      userId: updated.userId,
      category: updated.category,
      title: updated.title,
      content: updated.content,
      author,
      avatar: authorAvatar,
      avatarUrl: authorAvatarUrl,
      replies: mapReplyTree((updated as any).replies),
      views: updated.views,
      hot: updated.hot,
      pinned: (updated as any).pinned ?? false,
      locked: (updated as any).locked ?? false,
      archived: (updated as any).archived ?? false,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

router.post("/discussions/:id/replies/:replyId/like", requireAuth, async (req: any, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const replyId = Number(req.params.replyId);
  if (!Number.isFinite(replyId)) return res.status(400).json({ error: "invalid_reply_id" });

  const discussion = await prisma.communityDiscussion.findUnique({ where: { legacyId } });
  if (!discussion) return res.status(404).json({ error: "not_found" });
  if ((discussion as any).status === "REMOVED") return res.status(404).json({ error: "not_found" });

  const repliesRaw = Array.isArray((discussion as any).replies) ? ((discussion as any).replies as any[]) : [];
  const updatedTree = updateNodeInTreeGeneric(repliesRaw, replyId, (n: any) => {
    const liked = !!n?.liked;
    const likes = Number(n?.likes || 0) || 0;
    return { ...n, liked: !liked, likes: liked ? Math.max(0, likes - 1) : likes + 1 };
  });
  if (!updatedTree.updated) return res.status(404).json({ error: "not_found" });

  const updated = await prisma.communityDiscussion.update({ where: { legacyId }, data: { replies: updatedTree.next } });

  const ids = new Set<string>();
  ids.add(String(updated.userId));
  collectDiscussionReplyUserIds((updated as any).replies, ids);
  const userMap = await getUserMap(ids);

  const mapReplyTree = (nodes: any): any[] => {
    const list = Array.isArray(nodes) ? nodes : [];
    return list.map((n) => {
      const profile = userMap.get(String(n?.userId || ""));
      const nn = profile?.name || String(n?.user || "");
      const av = initialsFromName(nn);
      const au = profile?.avatarUrl ?? null;
      return {
        ...n,
        user: nn,
        avatar: av,
        avatarUrl: au,
        replies: mapReplyTree((n as any)?.replies),
      };
    });
  };

  const authorProfile = userMap.get(String(updated.userId));
  const author = authorProfile?.name || (updated as any).author;
  const authorAvatar = initialsFromName(author);
  const authorAvatarUrl = authorProfile?.avatarUrl ?? null;

  return res.json({
    discussion: {
      id: Number(updated.legacyId),
      userId: updated.userId,
      category: updated.category,
      title: updated.title,
      content: updated.content,
      author,
      avatar: authorAvatar,
      avatarUrl: authorAvatarUrl,
      replies: mapReplyTree((updated as any).replies),
      views: updated.views,
      hot: updated.hot,
      pinned: (updated as any).pinned ?? false,
      locked: (updated as any).locked ?? false,
      archived: (updated as any).archived ?? false,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

router.delete("/discussions/:id/replies/:replyId", requireAuth, async (req: any, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const replyId = Number(req.params.replyId);
  if (!Number.isFinite(replyId)) return res.status(400).json({ error: "invalid_reply_id" });

  const discussion = await prisma.communityDiscussion.findUnique({ where: { legacyId } });
  if (!discussion) return res.status(404).json({ error: "not_found" });
  if ((discussion as any).status === "REMOVED") return res.status(404).json({ error: "not_found" });

  const repliesRaw = Array.isArray((discussion as any).replies) ? ((discussion as any).replies as any[]) : [];
  const deleted = deleteNodeFromTree(repliesRaw as any, replyId);
  if (!deleted.deleted) return res.status(404).json({ error: "not_found" });

  const ownerUserId = String((deleted.deleted as any)?.userId || "");
  if (!ownerUserId || !canEditOwnerContent(req, ownerUserId)) return res.status(403).json({ error: "forbidden" });

  const updated = await prisma.communityDiscussion.update({ where: { legacyId }, data: { replies: deleted.next } });

  const ids = new Set<string>();
  ids.add(String(updated.userId));
  collectDiscussionReplyUserIds((updated as any).replies, ids);
  const userMap = await getUserMap(ids);

  const mapReplyTree = (nodes: any): any[] => {
    const list = Array.isArray(nodes) ? nodes : [];
    return list.map((n) => {
      const profile = userMap.get(String(n?.userId || ""));
      const nn = profile?.name || String(n?.user || "");
      const av = initialsFromName(nn);
      const au = profile?.avatarUrl ?? null;
      return {
        ...n,
        user: nn,
        avatar: av,
        avatarUrl: au,
        replies: mapReplyTree((n as any)?.replies),
      };
    });
  };

  const authorProfile = userMap.get(String(updated.userId));
  const author = authorProfile?.name || (updated as any).author;
  const authorAvatar = initialsFromName(author);
  const authorAvatarUrl = authorProfile?.avatarUrl ?? null;

  return res.json({
    discussion: {
      id: Number(updated.legacyId),
      userId: updated.userId,
      category: updated.category,
      title: updated.title,
      content: updated.content,
      author,
      avatar: authorAvatar,
      avatarUrl: authorAvatarUrl,
      replies: mapReplyTree((updated as any).replies),
      views: updated.views,
      hot: updated.hot,
      pinned: (updated as any).pinned ?? false,
      locked: (updated as any).locked ?? false,
      archived: (updated as any).archived ?? false,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

router.put("/discussions", requireAdmin, async (req: any, res) => {
  const incoming = Array.isArray(req.body?.discussions) ? req.body.discussions : [];
  const actorUserId = req.auth.userId as string;

  for (const d of incoming) {
    let legacyId: bigint;
    try {
      legacyId = BigInt(d.id);
    } catch {
      continue;
    }

    const existing = await prisma.communityDiscussion.findUnique({ where: { legacyId } });
    if (existing && (existing as any).status === "REMOVED") continue;

    if (!existing) {
      await prisma.communityDiscussion.create({
        data: {
          legacyId,
          category: String(d.category || ""),
          title: String(d.title || ""),
          content: String(d.content || ""),
          author: String(d.author || ""),
          avatar: String(d.avatar || ""),
          replies: d.replies || [],
          views: Number(d.views || 0) || 0,
          hot: !!d.hot,
          userRef: { connect: { id: actorUserId } },
        },
      });
      continue;
    }

    const canEdit = canEditOwnerContent(req, existing.userId);

    const updateData: any = {
      replies: d.replies || [],
      hot: !!d.hot,
      pinned: !!d.pinned,
      locked: !!d.locked,
      archived: !!d.archived,
    };

    if (canEdit) {
      updateData.category = String(d.category || existing.category);
      updateData.title = String(d.title || existing.title);
      updateData.content = String(d.content || existing.content);
      updateData.author = String(d.author || existing.author);
      updateData.avatar = String(d.avatar || existing.avatar);
    }

    await prisma.communityDiscussion.update({ where: { legacyId }, data: updateData });
  }

  return res.json({ ok: true });
});

router.delete("/discussions/:id", requireAuth, async (req, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const existing = await prisma.communityDiscussion.findUnique({ where: { legacyId } });
  if (!existing) return res.json({ ok: true });

  if ((existing as any).status === "REMOVED") return res.json({ ok: true });

  if (!canEditOwnerContent(req, existing.userId)) return res.status(403).json({ error: "forbidden" });

  await prisma.communityDiscussion.delete({ where: { legacyId } });
  return res.json({ ok: true });
});

// -------- Guidelines & Categories --------
router.get("/guidelines", async (_req, res) => {
  const db = prisma as any;
  const items = await db.communityGuideline.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
  });
  return res.json({ guidelines: items.map((g: any) => ({ id: g.id, slug: g.slug, title: g.title, content: g.content, publishedAt: g.publishedAt ? new Date(g.publishedAt).toISOString() : null })) });
});

router.get("/categories", async (_req, res) => {
  const db = prisma as any;
  const items = await db.communityDiscussionCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return res.json({ categories: items.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug, sortOrder: c.sortOrder })) });
});

// -------- Notifications --------
router.get("/notifications", requireAuth, async (req: any, res) => {
  const userId = String(req.auth?.userId || "");
  const unreadOnly = String(req.query?.unread || "") === "1" || String(req.query?.unread || "") === "true";
  const db = prisma as any;
  const items = await db.communityNotification.findMany({
    where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return res.json({ notifications: items.map((n: any) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, meta: n.meta, readAt: n.readAt ? new Date(n.readAt).toISOString() : null, createdAt: new Date(n.createdAt).toISOString() })) });
});

router.post("/notifications/:id/read", requireAuth, async (req: any, res) => {
  const userId = String(req.auth?.userId || "");
  const id = String(req.params.id || "");
  if (!id) return res.status(400).json({ error: "invalid_id" });
  const db = prisma as any;
  await db.communityNotification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  return res.json({ ok: true });
});

router.post("/notifications/read-all", requireAuth, async (req: any, res) => {
  const userId = String(req.auth?.userId || "");
  const db = prisma as any;
  await db.communityNotification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return res.json({ ok: true });
});

router.delete("/notifications/:id", requireAuth, async (req: any, res) => {
  const userId = String(req.auth?.userId || "");
  const id = String(req.params.id || "");
  if (!id) return res.status(400).json({ error: "invalid_id" });
  const db = prisma as any;
  await db.communityNotification.deleteMany({ where: { id, userId } });
  return res.json({ ok: true });
});

router.get("/admin/notifications", requireAdmin, async (req: any, res) => {
  const q = String(req.query?.q || "").trim().toLowerCase();
  const userId = String(req.query?.userId || "").trim();
  const unreadOnly = String(req.query?.unread || "") === "1" || String(req.query?.unread || "") === "true";

  const takeRaw = Number(req.query?.limit || 200);
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 500) : 200;

  const db = prisma as any;

  const rows = await db.communityNotification.findMany({
    where: {
      ...(userId ? { userId } : {}),
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  const userIds = Array.from(new Set((rows as any[]).map((r: any) => String(r.userId)).filter(Boolean)));
  const users: Array<{ id: string; name: string; email: string; avatarUrl: string | null }> = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, avatarUrl: true } })
    : [];
  const userMap = new Map<string, { id: string; name: string; email: string; avatarUrl: string | null }>();
  for (const u of users) userMap.set(String(u.id), u);

  const mapped = (rows as any[]).map((n: any) => {
    const u = userMap.get(String(n.userId));
    return {
      id: String(n.id),
      userId: String(n.userId),
      user: u ? { id: String(u.id), name: String(u.name || ""), email: String(u.email || ""), avatarUrl: u.avatarUrl || null } : null,
      type: String(n.type),
      title: String(n.title || ""),
      body: String(n.body || ""),
      link: n.link ? String(n.link) : null,
      meta: n.meta,
      readAt: n.readAt ? new Date(n.readAt).toISOString() : null,
      createdAt: new Date(n.createdAt).toISOString(),
    };
  });

  const filtered = q
    ? mapped.filter((n: any) => {
        if (String(n.title || "").toLowerCase().includes(q)) return true;
        if (String(n.body || "").toLowerCase().includes(q)) return true;
        if (String(n.type || "").toLowerCase().includes(q)) return true;
        if (String(n.user?.email || "").toLowerCase().includes(q)) return true;
        if (String(n.user?.name || "").toLowerCase().includes(q)) return true;
        if (String(n.userId || "").toLowerCase().includes(q)) return true;
        return false;
      })
    : mapped;

  return res.json({ notifications: filtered });
});

router.delete("/admin/notifications/:id", requireAdmin, async (req: any, res) => {
  const id = String(req.params.id || "");
  if (!id) return res.status(400).json({ error: "invalid_id" });
  const db = prisma as any;
  await db.communityNotification.deleteMany({ where: { id } });
  return res.json({ ok: true });
});

// -------- Reporting --------
router.post("/reports", requireAuth, async (req: any, res) => {
  const reporterUserId = String(req.auth?.userId || "");
  const targetType = normalizeReportTargetType(req.body?.targetType);
  if (!targetType) return res.status(400).json({ error: "invalid_target" });

  const reason = requireNonEmptyString(req.body?.reason, 200);
  if (!reason) return res.status(400).json({ error: "invalid_reason" });

  const details = typeof req.body?.details === "string" ? String(req.body.details).trim().slice(0, 2000) : null;
  const severity = normalizeSeverity(req.body?.severity);

  const db = prisma as any;

  let targetLegacyId: bigint | null = null;
  let targetNodeId: bigint | null = null;
  let targetUserId: string | null = null;

  if (targetType === "USER") {
    targetUserId = requireNonEmptyString(req.body?.targetUserId, 64);
    if (!targetUserId) return res.status(400).json({ error: "invalid_target" });
  } else {
    try {
      targetLegacyId = BigInt(req.body?.targetLegacyId ?? req.body?.targetId ?? "");
    } catch {
      return res.status(400).json({ error: "invalid_target" });
    }

    const nodeIdRaw = req.body?.targetNodeId ?? req.body?.nodeId;
    if (nodeIdRaw !== undefined && nodeIdRaw !== null && String(nodeIdRaw) !== "") {
      try {
        targetNodeId = BigInt(String(nodeIdRaw));
      } catch {
        return res.status(400).json({ error: "invalid_target" });
      }
    }
  }

  let snapshot: any = null;
  try {
    if (targetType === "POST" || targetType === "POST_COMMENT") {
      const post = await db.communityPost.findUnique({ where: { legacyId: targetLegacyId } });
      if (!post) return res.status(404).json({ error: "not_found" });
      targetUserId = String(post.userId);
      if (targetType === "POST_COMMENT") {
        const commentId = targetNodeId ? Number(targetNodeId) : NaN;
        if (!Number.isFinite(commentId)) return res.status(400).json({ error: "invalid_target" });
        const node = findNodeInTree((post as any).comments, commentId);
        if (!node) return res.status(404).json({ error: "not_found" });
        snapshot = { postLegacyId: Number(post.legacyId), comment: node };
      } else {
        snapshot = { postLegacyId: Number(post.legacyId), content: post.content, images: post.images };
      }
    }
    if (targetType === "DISCUSSION" || targetType === "DISCUSSION_REPLY") {
      const discussion = await db.communityDiscussion.findUnique({ where: { legacyId: targetLegacyId } });
      if (!discussion) return res.status(404).json({ error: "not_found" });
      targetUserId = String(discussion.userId);
      if (targetType === "DISCUSSION_REPLY") {
        const replyId = targetNodeId ? Number(targetNodeId) : NaN;
        if (!Number.isFinite(replyId)) return res.status(400).json({ error: "invalid_target" });
        const node = findNodeInTree((discussion as any).replies, replyId);
        if (!node) return res.status(404).json({ error: "not_found" });
        snapshot = { discussionLegacyId: Number(discussion.legacyId), reply: node };
      } else {
        snapshot = { discussionLegacyId: Number(discussion.legacyId), title: discussion.title, content: discussion.content, category: discussion.category };
      }
    }
  } catch {
    snapshot = null;
  }

  const created = await db.communityReport.create({
    data: {
      reporterUserId,
      targetType,
      targetLegacyId: targetLegacyId ?? null,
      targetNodeId: targetNodeId ?? null,
      targetUserId: targetUserId ?? null,
      reason,
      details,
      severity,
      status: "OPEN",
      snapshot: snapshot ?? Prisma.JsonNull,
    },
  });

  broadcastCommunityEvent("reports_changed", { reportId: created.id, action: "created" });
  return res.json({ ok: true, report: { id: created.id, status: created.status } });
});

// -------- Admin: Moderation Dashboard, Reports, Guidelines, Categories --------
router.get("/admin/dashboard", requireAdmin, async (_req, res) => {
  const db = prisma as any;
  const [totalPosts, totalDiscussions, removedPosts, removedDiscussions, openReports] = await Promise.all([
    db.communityPost.count(),
    db.communityDiscussion.count(),
    db.communityPost.count({ where: { status: "REMOVED" } }),
    db.communityDiscussion.count({ where: { status: "REMOVED" } }),
    db.communityReport.count({ where: { status: "OPEN" } }),
  ]);

  const postsRows = await db.communityPost.findMany({ select: { comments: true, poll: true } });
  const discussionsRows = await db.communityDiscussion.findMany({ select: { replies: true } });

  const totalComments = postsRows.reduce((sum: number, p: any) => sum + countTreeNodes(p?.comments), 0);
  const totalReplies = discussionsRows.reduce((sum: number, d: any) => sum + countTreeNodes(d?.replies), 0);
  const totalPolls = postsRows.reduce((sum: number, p: any) => sum + (p?.poll && !isDbJsonNull(p.poll) ? 1 : 0), 0);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const activeUsers7d = await db.user.count({ where: { lastSeenAt: { gte: sevenDaysAgo } } });

  return res.json({
    totals: {
      posts: totalPosts,
      discussions: totalDiscussions,
      comments: totalComments,
      discussionReplies: totalReplies,
      polls: totalPolls,
    },
    moderation: {
      activeUsers7d,
      reportedOpen: openReports,
      removedContent: Number(removedPosts) + Number(removedDiscussions),
    },
  });
});

router.get("/admin/insights", requireAdmin, async (req: any, res) => {
  const db = prisma as any;
  const daysRaw = Number(req.query?.days);
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.floor(daysRaw))) : 7;

  const now = new Date();
  const endUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  const startUtc = new Date(endUtc.getTime() - days * 24 * 60 * 60 * 1000);

  const [reports, actions] = await Promise.all([
    db.communityReport.findMany({
      where: { createdAt: { gte: startUtc, lt: endUtc } },
      select: { createdAt: true },
    }),
    db.communityModerationAction.findMany({
      where: { createdAt: { gte: startUtc, lt: endUtc } },
      select: { createdAt: true, actionType: true },
    }),
  ]);

  const toUtcDayKey = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const dayKeys: string[] = [];
  for (let i = 0; i < days; i++) {
    const t = new Date(startUtc.getTime() + i * 24 * 60 * 60 * 1000);
    dayKeys.push(toUtcDayKey(t));
  }

  const counts: Record<string, { reportsCreated: number; actionsCreated: number; removeContentActions: number }> = {};
  for (const k of dayKeys) counts[k] = { reportsCreated: 0, actionsCreated: 0, removeContentActions: 0 };

  for (const r of reports) {
    const k = toUtcDayKey(new Date(r.createdAt));
    if (counts[k]) counts[k].reportsCreated += 1;
  }
  for (const a of actions) {
    const k = toUtcDayKey(new Date(a.createdAt));
    if (counts[k]) {
      counts[k].actionsCreated += 1;
      if (String(a.actionType) === "REMOVE_CONTENT") counts[k].removeContentActions += 1;
    }
  }

  return res.json({
    range: { start: startUtc.toISOString(), end: endUtc.toISOString(), days },
    series: dayKeys.map((k) => ({ day: k, ...counts[k] })),
  });
});

router.get("/admin/reports", requireAdmin, async (req: any, res) => {
  const db = prisma as any;
  const status = String(req.query?.status || "OPEN").toUpperCase();
  const targetType = req.query?.targetType ? normalizeReportTargetType(req.query.targetType) : null;
  const severity = req.query?.severity ? normalizeSeverity(req.query.severity) : null;
  const qRaw = typeof req.query?.q === "string" ? String(req.query.q) : "";
  const q = qRaw.trim();

  const where: any = {};
  if (status === "OPEN" || status === "RESOLVED" || status === "DISMISSED") where.status = status;
  if (targetType) where.targetType = targetType;
  if (severity) where.severity = severity;

  if (q) {
    const or: any[] = [
      { id: { contains: q } },
      { reporterUserId: { contains: q } },
      { targetUserId: { contains: q } },
      { reason: { contains: q } },
      { details: { contains: q } },
    ];

    const n = Number(q);
    if (Number.isFinite(n) && String(Math.floor(n)) === q) {
      try {
        or.push({ targetLegacyId: BigInt(q) });
      } catch {
      }
      try {
        or.push({ targetNodeId: BigInt(q) });
      } catch {
      }
    }

    where.OR = or;
  }

  const items = await db.communityReport.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  return res.json({
    reports: items.map((r: any) => ({
      id: r.id,
      reporterUserId: r.reporterUserId,
      targetType: r.targetType,
      targetLegacyId: r.targetLegacyId ? Number(r.targetLegacyId) : null,
      targetNodeId: r.targetNodeId ? Number(r.targetNodeId) : null,
      targetUserId: r.targetUserId,
      reason: r.reason,
      details: r.details,
      severity: r.severity,
      status: r.status,
      guidelineId: r.guidelineId,
      createdAt: new Date(r.createdAt).toISOString(),
      resolvedAt: r.resolvedAt ? new Date(r.resolvedAt).toISOString() : null,
      resolvedByUserId: r.resolvedByUserId,
      resolutionActionId: r.resolutionActionId,
    })),
  });
});

router.post("/admin/discussions/:id/clear-replies", requireAdmin, async (req: any, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const existing = await prisma.communityDiscussion.findUnique({ where: { legacyId } });
  if (!existing) return res.json({ ok: true });
  if ((existing as any).status === "REMOVED") return res.json({ ok: true });

  await prisma.communityDiscussion.update({ where: { legacyId }, data: { replies: [] } as any });
  broadcastCommunityEvent("discussions_changed", { discussionId: Number(legacyId), action: "clear_replies" });
  return res.json({ ok: true });
});

router.get("/admin/reports/export.csv", requireAdmin, async (req: any, res) => {
  const db = prisma as any;
  const status = String(req.query?.status || "OPEN").toUpperCase();
  const targetType = req.query?.targetType ? normalizeReportTargetType(req.query.targetType) : null;
  const severity = req.query?.severity ? normalizeSeverity(req.query.severity) : null;
  const qRaw = typeof req.query?.q === "string" ? String(req.query.q) : "";
  const q = qRaw.trim();

  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5000, Math.floor(limitRaw))) : 2000;

  const where: any = {};
  if (status === "OPEN" || status === "RESOLVED" || status === "DISMISSED") where.status = status;
  if (targetType) where.targetType = targetType;
  if (severity) where.severity = severity;

  if (q) {
    const or: any[] = [
      { id: { contains: q } },
      { reporterUserId: { contains: q } },
      { targetUserId: { contains: q } },
      { reason: { contains: q } },
      { details: { contains: q } },
    ];

    const n = Number(q);
    if (Number.isFinite(n) && String(Math.floor(n)) === q) {
      try {
        or.push({ targetLegacyId: BigInt(q) });
      } catch {
      }
      try {
        or.push({ targetNodeId: BigInt(q) });
      } catch {
      }
    }

    where.OR = or;
  }

  const items = await db.communityReport.findMany({ where, orderBy: { createdAt: "desc" }, take: limit });

  const csvEscape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    const needs = s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"');
    const escaped = s.replace(/"/g, '""');
    return needs ? `"${escaped}"` : escaped;
  };

  const header = [
    "id",
    "status",
    "severity",
    "targetType",
    "targetLegacyId",
    "targetNodeId",
    "targetUserId",
    "reporterUserId",
    "reason",
    "details",
    "createdAt",
    "resolvedAt",
    "resolvedByUserId",
    "resolutionActionId",
    "guidelineId",
  ];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=reports_export_${Date.now()}.csv`);
  res.write(`${header.join(",")}\n`);

  for (const r of items) {
    const row = [
      r.id,
      r.status,
      r.severity,
      r.targetType,
      r.targetLegacyId ? Number(r.targetLegacyId) : "",
      r.targetNodeId ? Number(r.targetNodeId) : "",
      r.targetUserId ?? "",
      r.reporterUserId,
      r.reason,
      r.details ?? "",
      r.createdAt ? new Date(r.createdAt).toISOString() : "",
      r.resolvedAt ? new Date(r.resolvedAt).toISOString() : "",
      r.resolvedByUserId ?? "",
      r.resolutionActionId ?? "",
      r.guidelineId ?? "",
    ].map(csvEscape);
    res.write(`${row.join(",")}\n`);
  }

  return res.end();
});

router.post("/admin/reports/:id/dismiss", requireAdmin, async (req: any, res) => {
  const id = String(req.params.id || "");
  if (!id) return res.status(400).json({ error: "invalid_id" });
  const actorUserId = String(req.auth?.userId || "");
  const db = prisma as any;
  const before = await db.communityReport.findUnique({ where: { id } });
  if (!before) return res.status(404).json({ error: "not_found" });
  const updated = await db.communityReport.update({ where: { id }, data: { status: "DISMISSED", resolvedAt: new Date(), resolvedByUserId: actorUserId } });
  await createAuditLog(actorUserId, "COMMUNITY_REPORT_DISMISSED", "CommunityReport", id, before, updated);
  broadcastCommunityEvent("reports_changed", { reportId: id, action: "dismissed" });
  return res.json({ ok: true });
});

router.post("/admin/moderate", requireAdmin, async (req: any, res) => {
  const actorUserId = String(req.auth?.userId || "");
  const actionType = normalizeModerationActionType(req.body?.actionType);
  const targetType = normalizeReportTargetType(req.body?.targetType);
  const reason = requireNonEmptyString(req.body?.reason, 500);
  const guidelineId = typeof req.body?.guidelineId === "string" ? String(req.body.guidelineId) : null;
  const reportId = typeof req.body?.reportId === "string" ? String(req.body.reportId) : null;

  if (!actionType || !targetType || !reason) return res.status(400).json({ error: "invalid_request" });

  const db = prisma as any;
  let targetLegacyId: bigint | null = null;
  let targetNodeId: bigint | null = null;
  let targetUserId: string | null = null;

  if (targetType === "USER") {
    targetUserId = requireNonEmptyString(req.body?.targetUserId, 64);
    if (!targetUserId) return res.status(400).json({ error: "invalid_target" });
  } else {
    try {
      targetLegacyId = BigInt(req.body?.targetLegacyId ?? req.body?.targetId ?? "");
    } catch {
      return res.status(400).json({ error: "invalid_target" });
    }
    const nodeIdRaw = req.body?.targetNodeId ?? req.body?.nodeId;
    if (nodeIdRaw !== undefined && nodeIdRaw !== null && String(nodeIdRaw) !== "") {
      try {
        targetNodeId = BigInt(String(nodeIdRaw));
      } catch {
        return res.status(400).json({ error: "invalid_target" });
      }
    }
  }

  const durationHoursRaw = Number(req.body?.durationHours);
  const durationHours = Number.isFinite(durationHoursRaw) ? Math.max(1, Math.min(24 * 365, Math.floor(durationHoursRaw))) : null;

  const createdAction = await db.communityModerationAction.create({
    data: {
      actorUserId,
      actionType,
      targetType,
      targetLegacyId: targetLegacyId ?? null,
      targetNodeId: targetNodeId ?? null,
      targetUserId: targetUserId ?? null,
      reportId,
      guidelineId,
      reason,
      durationHours,
    },
  });

  if (actionType === "TEMP_BAN" || actionType === "PERM_BAN" || actionType === "ISSUE_WARNING") {
    const userId = targetType === "USER" ? targetUserId : requireNonEmptyString(req.body?.targetUserId, 64);
    if (userId) targetUserId = userId;
  }

  if (actionType === "TEMP_BAN" || actionType === "PERM_BAN") {
    if (!targetUserId) return res.status(400).json({ error: "invalid_target" });
    const until = actionType === "TEMP_BAN" && durationHours ? new Date(Date.now() + durationHours * 60 * 60 * 1000) : null;
    const beforeUser = await db.user.findUnique({ where: { id: targetUserId } });
    await db.user.update({
      where: { id: targetUserId },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedUntil: until,
        banReason: reason,
        bannedBy: actorUserId,
      },
    });
    await createAuditLog(actorUserId, actionType === "TEMP_BAN" ? "COMMUNITY_USER_TEMP_BANNED" : "COMMUNITY_USER_PERM_BANNED", "User", targetUserId, beforeUser, { isBanned: true, bannedUntil: until ? until.toISOString() : null });
    await createCommunityNotification(targetUserId, {
      type: actionType === "TEMP_BAN" ? "ban_temp" : "ban_perm",
      title: "Account restricted",
      body: actionType === "TEMP_BAN" && until ? `You have been temporarily banned until ${until.toISOString()}. Reason: ${reason}` : `You have been permanently banned. Reason: ${reason}`,
      link: "/community",
      meta: { actionId: createdAction.id },
    });
  }

  if (actionType === "ISSUE_WARNING") {
    if (!targetUserId) {
      const userId = requireNonEmptyString(req.body?.targetUserId, 64);
      if (userId) targetUserId = userId;
    }
    if (targetUserId) {
      await createAuditLog(actorUserId, "COMMUNITY_USER_WARNED", "User", targetUserId, null, { reason, guidelineId, actionId: createdAction.id });
      await createCommunityNotification(targetUserId, {
        type: "warning",
        title: "Community warning",
        body: `Warning issued: ${reason}`,
        link: "/community",
        meta: { actionId: createdAction.id, guidelineId },
      });
    }
  }

  if (actionType === "REMOVE_CONTENT" || actionType === "RESTORE_CONTENT") {
    if (targetType === "POST") {
      const legacyId = targetLegacyId as bigint;
      const before = await db.communityPost.findUnique({ where: { legacyId } });
      if (!before) return res.status(404).json({ error: "not_found" });
      const ownerId = String(before.userId);
      const updated = await db.communityPost.update({
        where: { legacyId },
        data:
          actionType === "REMOVE_CONTENT"
            ? {
                status: "REMOVED",
                removedAt: new Date(),
                removedByUserId: actorUserId,
                removalReason: reason,
                removalGuidelineId: guidelineId,
              }
            : {
                status: "ACTIVE",
                removedAt: null,
                removedByUserId: null,
                removalReason: null,
                removalGuidelineId: null,
              },
      });
      await createAuditLog(actorUserId, actionType === "REMOVE_CONTENT" ? "COMMUNITY_POST_REMOVED" : "COMMUNITY_POST_RESTORED", "CommunityPost", String(Number(legacyId)), before, updated);
      if (actionType === "REMOVE_CONTENT") {
        await createCommunityNotification(ownerId, {
          type: "post_removed",
          title: "Post removed",
          body: `Your post was removed. Reason: ${reason}`,
          link: "/community",
          meta: { postId: Number(legacyId), guidelineId, actionId: createdAction.id },
        });
      } else {
        await createCommunityNotification(ownerId, {
          type: "post_restored",
          title: "Post restored",
          body: "Your post was restored by an admin.",
          link: "/community",
          meta: { postId: Number(legacyId), actionId: createdAction.id },
        });
      }
      broadcastCommunityEvent("posts_changed", { postId: Number(legacyId), action: actionType === "REMOVE_CONTENT" ? "removed" : "restored" });
    }

    if (targetType === "DISCUSSION") {
      const legacyId = targetLegacyId as bigint;
      const before = await db.communityDiscussion.findUnique({ where: { legacyId } });
      if (!before) return res.status(404).json({ error: "not_found" });
      const ownerId = String(before.userId);
      const updated = await db.communityDiscussion.update({
        where: { legacyId },
        data:
          actionType === "REMOVE_CONTENT"
            ? {
                status: "REMOVED",
                removedAt: new Date(),
                removedByUserId: actorUserId,
                removalReason: reason,
                removalGuidelineId: guidelineId,
              }
            : {
                status: "ACTIVE",
                removedAt: null,
                removedByUserId: null,
                removalReason: null,
                removalGuidelineId: null,
              },
      });
      await createAuditLog(actorUserId, actionType === "REMOVE_CONTENT" ? "COMMUNITY_DISCUSSION_REMOVED" : "COMMUNITY_DISCUSSION_RESTORED", "CommunityDiscussion", String(Number(legacyId)), before, updated);
      if (actionType === "REMOVE_CONTENT") {
        await createCommunityNotification(ownerId, {
          type: "discussion_removed",
          title: "Discussion removed",
          body: `Your discussion was removed. Reason: ${reason}`,
          link: "/community",
          meta: { discussionId: Number(legacyId), guidelineId, actionId: createdAction.id },
        });
      } else {
        await createCommunityNotification(ownerId, {
          type: "discussion_restored",
          title: "Discussion restored",
          body: "Your discussion was restored by an admin.",
          link: "/community",
          meta: { discussionId: Number(legacyId), actionId: createdAction.id },
        });
      }
      broadcastCommunityEvent("discussions_changed", { discussionId: Number(legacyId), action: actionType === "REMOVE_CONTENT" ? "removed" : "restored" });
    }

    if (targetType === "POST_COMMENT") {
      const legacyId = targetLegacyId as bigint;
      const commentId = targetNodeId ? Number(targetNodeId) : NaN;
      if (!Number.isFinite(commentId)) return res.status(400).json({ error: "invalid_target" });
      const post = await db.communityPost.findUnique({ where: { legacyId } });
      if (!post) return res.status(404).json({ error: "not_found" });
      const current = (Array.isArray(post.comments) ? post.comments : []) as any[];
      const upd = updateNodeInTreeGeneric(current, commentId, (n) => {
        if (actionType === "REMOVE_CONTENT") {
          return {
            ...n,
            originalContent: (n as any).originalContent ?? (n as any).content,
            content: "[removed]",
            removedAt: new Date().toISOString(),
            removedByUserId: actorUserId,
            removalReason: reason,
            removalGuidelineId: guidelineId,
          };
        }
        return {
          ...n,
          content: (n as any).originalContent ?? (n as any).content,
          originalContent: undefined,
          removedAt: undefined,
          removedByUserId: undefined,
          removalReason: undefined,
          removalGuidelineId: undefined,
        };
      });
      if (!upd.updated) return res.status(404).json({ error: "not_found" });
      await db.communityPost.update({ where: { legacyId }, data: ({ comments: upd.next } as any) });
      await createAuditLog(actorUserId, actionType === "REMOVE_CONTENT" ? "COMMUNITY_POST_COMMENT_REMOVED" : "COMMUNITY_POST_COMMENT_RESTORED", "CommunityPostComment", `${Number(legacyId)}:${commentId}`, upd.before, upd.after);
      broadcastCommunityEvent("posts_changed", { postId: Number(legacyId), action: actionType === "REMOVE_CONTENT" ? "comment_removed" : "comment_restored" });
    }

    if (targetType === "DISCUSSION_REPLY") {
      const legacyId = targetLegacyId as bigint;
      const replyId = targetNodeId ? Number(targetNodeId) : NaN;
      if (!Number.isFinite(replyId)) return res.status(400).json({ error: "invalid_target" });
      const discussion = await db.communityDiscussion.findUnique({ where: { legacyId } });
      if (!discussion) return res.status(404).json({ error: "not_found" });
      const current = (Array.isArray(discussion.replies) ? discussion.replies : []) as any[];
      const upd = updateNodeInTreeGeneric(current, replyId, (n) => {
        if (actionType === "REMOVE_CONTENT") {
          return {
            ...n,
            originalContent: (n as any).originalContent ?? (n as any).content,
            content: "[removed]",
            removedAt: new Date().toISOString(),
            removedByUserId: actorUserId,
            removalReason: reason,
            removalGuidelineId: guidelineId,
          };
        }
        return {
          ...n,
          content: (n as any).originalContent ?? (n as any).content,
          originalContent: undefined,
          removedAt: undefined,
          removedByUserId: undefined,
          removalReason: undefined,
          removalGuidelineId: undefined,
        };
      });
      if (!upd.updated) return res.status(404).json({ error: "not_found" });
      await db.communityDiscussion.update({ where: { legacyId }, data: ({ replies: upd.next } as any) });
      await createAuditLog(actorUserId, actionType === "REMOVE_CONTENT" ? "COMMUNITY_DISCUSSION_REPLY_REMOVED" : "COMMUNITY_DISCUSSION_REPLY_RESTORED", "CommunityDiscussionReply", `${Number(legacyId)}:${replyId}`, upd.before, upd.after);
      broadcastCommunityEvent("discussions_changed", { discussionId: Number(legacyId), action: actionType === "REMOVE_CONTENT" ? "reply_removed" : "reply_restored" });
    }
  }

  if (reportId) {
    try {
      await db.communityReport.update({ where: { id: reportId }, data: { status: "RESOLVED", resolvedAt: new Date(), resolvedByUserId: actorUserId, resolutionActionId: createdAction.id, guidelineId } });
      broadcastCommunityEvent("reports_changed", { reportId, action: "resolved" });
    } catch {
    }
  }

  return res.json({ ok: true, actionId: createdAction.id });
});

router.get("/admin/users/:id", requireAdmin, async (req: any, res) => {
  const userId = String(req.params.id || "");
  if (!userId) return res.status(400).json({ error: "invalid_id" });
  const db = prisma as any;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "not_found" });

  const [posts, discussions, followers, following, warnings, bans] = await Promise.all([
    db.communityPost.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.communityDiscussion.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.follow.findMany({ where: { followingId: userId }, select: { followerId: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.follow.findMany({ where: { followerId: userId }, select: { followingId: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.communityModerationAction.findMany({ where: { targetUserId: userId, actionType: "ISSUE_WARNING" }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.communityModerationAction.findMany({ where: { targetUserId: userId, actionType: { in: ["TEMP_BAN", "PERM_BAN"] } }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);

  const savedPostIds: number[] = [];
  try {
    const savedRows = await db.communityPost.findMany({ select: { legacyId: true, savesBy: true } });
    for (const p of savedRows) {
      const savesBy = asStringArray(p?.savesBy);
      if (savesBy.includes(userId)) savedPostIds.push(Number(p.legacyId));
    }
  } catch {
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl || null,
      xp: user.xp,
      isBanned: !!user.isBanned,
      bannedAt: user.bannedAt ? new Date(user.bannedAt).toISOString() : null,
      bannedUntil: user.bannedUntil ? new Date(user.bannedUntil).toISOString() : null,
      banReason: user.banReason || null,
      bannedBy: user.bannedBy || null,
    },
    activity: {
      posts: posts.map((p: any) => ({ id: Number(p.legacyId), content: p.content, status: p.status, createdAt: new Date(p.createdAt).toISOString() })),
      discussions: discussions.map((d: any) => ({ id: Number(d.legacyId), title: d.title, category: d.category, status: d.status, createdAt: new Date(d.createdAt).toISOString() })),
      savedPostIds,
      followers: followers.map((r: any) => String(r.followerId)),
      following: following.map((r: any) => String(r.followingId)),
    },
    enforcement: {
      warnings: warnings.map((a: any) => ({ id: a.id, reason: a.reason, guidelineId: a.guidelineId, createdAt: new Date(a.createdAt).toISOString(), actorUserId: a.actorUserId })),
      bans: bans.map((a: any) => ({ id: a.id, actionType: a.actionType, reason: a.reason, durationHours: a.durationHours, createdAt: new Date(a.createdAt).toISOString(), actorUserId: a.actorUserId })),
    },
  });
});

router.get("/admin/guidelines", requireAdmin, async (_req, res) => {
  const db = prisma as any;
  const items = await db.communityGuideline.findMany({ orderBy: { updatedAt: "desc" } });
  return res.json({ guidelines: items.map((g: any) => ({ id: g.id, slug: g.slug, title: g.title, content: g.content, status: g.status, publishedAt: g.publishedAt ? new Date(g.publishedAt).toISOString() : null, updatedAt: new Date(g.updatedAt).toISOString() })) });
});

router.post("/admin/guidelines", requireAdmin, async (req: any, res) => {
  const actorUserId = String(req.auth?.userId || "");
  const slug = requireNonEmptyString(req.body?.slug, 80);
  const title = requireNonEmptyString(req.body?.title, 160);
  const content = requireNonEmptyString(req.body?.content, 20000);
  if (!slug || !title || !content) return res.status(400).json({ error: "invalid_request" });
  const db = prisma as any;
  const created = await db.communityGuideline.create({ data: { slug, title, content, status: "DRAFT" } });
  await createAuditLog(actorUserId, "COMMUNITY_GUIDELINE_CREATED", "CommunityGuideline", created.id, null, created);
  return res.json({ guideline: { id: created.id } });
});

router.patch("/admin/guidelines/:id", requireAdmin, async (req: any, res) => {
  const actorUserId = String(req.auth?.userId || "");
  const id = String(req.params.id || "");
  if (!id) return res.status(400).json({ error: "invalid_id" });
  const db = prisma as any;
  const before = await db.communityGuideline.findUnique({ where: { id } });
  if (!before) return res.status(404).json({ error: "not_found" });
  const title = typeof req.body?.title === "string" ? String(req.body.title).trim().slice(0, 160) : undefined;
  const content = typeof req.body?.content === "string" ? String(req.body.content).trim().slice(0, 20000) : undefined;
  const slug = typeof req.body?.slug === "string" ? String(req.body.slug).trim().slice(0, 80) : undefined;
  const status = req.body?.status && (String(req.body.status).toUpperCase() === "DRAFT" || String(req.body.status).toUpperCase() === "PUBLISHED") ? String(req.body.status).toUpperCase() : undefined;
  const nextData: any = {};
  if (slug) nextData.slug = slug;
  if (title) nextData.title = title;
  if (content) nextData.content = content;
  if (status) nextData.status = status;
  if (status === "PUBLISHED" && !before.publishedAt) nextData.publishedAt = new Date();
  const updated = await db.communityGuideline.update({ where: { id }, data: nextData });
  await createAuditLog(actorUserId, "COMMUNITY_GUIDELINE_UPDATED", "CommunityGuideline", id, before, updated);
  return res.json({ ok: true });
});

router.get("/admin/categories", requireAdmin, async (_req, res) => {
  const db = prisma as any;
  const items = await db.communityDiscussionCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return res.json({ categories: items.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug, sortOrder: c.sortOrder, isActive: !!c.isActive })) });
});

router.post("/admin/categories", requireAdmin, async (req: any, res) => {
  const actorUserId = String(req.auth?.userId || "");
  const name = requireNonEmptyString(req.body?.name, 80);
  const slug = requireNonEmptyString(req.body?.slug, 80);
  const sortOrderRaw = Number(req.body?.sortOrder);
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.floor(sortOrderRaw) : 0;
  if (!name || !slug) return res.status(400).json({ error: "invalid_request" });
  const db = prisma as any;
  const created = await db.communityDiscussionCategory.create({ data: { name, slug, sortOrder, isActive: true } });
  await createAuditLog(actorUserId, "COMMUNITY_CATEGORY_CREATED", "CommunityDiscussionCategory", created.id, null, created);
  return res.json({ category: { id: created.id } });
});

router.patch("/admin/categories/:id", requireAdmin, async (req: any, res) => {
  const actorUserId = String(req.auth?.userId || "");
  const id = String(req.params.id || "");
  if (!id) return res.status(400).json({ error: "invalid_id" });
  const db = prisma as any;
  const before = await db.communityDiscussionCategory.findUnique({ where: { id } });
  if (!before) return res.status(404).json({ error: "not_found" });
  const name = typeof req.body?.name === "string" ? String(req.body.name).trim().slice(0, 80) : undefined;
  const slug = typeof req.body?.slug === "string" ? String(req.body.slug).trim().slice(0, 80) : undefined;
  const sortOrderRaw = req.body?.sortOrder;
  const sortOrder = sortOrderRaw !== undefined && sortOrderRaw !== null && String(sortOrderRaw) !== "" ? Number(sortOrderRaw) : undefined;
  const isActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined;
  const nextData: any = {};
  if (name) nextData.name = name;
  if (slug) nextData.slug = slug;
  if (Number.isFinite(sortOrder as any)) nextData.sortOrder = Math.floor(sortOrder as any);
  if (typeof isActive === "boolean") nextData.isActive = isActive;
  const updated = await db.communityDiscussionCategory.update({ where: { id }, data: nextData });
  await createAuditLog(actorUserId, "COMMUNITY_CATEGORY_UPDATED", "CommunityDiscussionCategory", id, before, updated);
  return res.json({ ok: true });
});

export default router;
