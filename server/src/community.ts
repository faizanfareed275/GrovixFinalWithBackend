import { Router } from "express";
import { prisma } from "./db";
import { requireAuth } from "./middleware/auth";
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
  const onlySaved = String(req.query?.saved || "") === "1" || String(req.query?.saved || "") === "true";

  const filterUserId = String(req.query?.userId || "").trim();

  const items = await prisma.communityPost.findMany({
    where: filterUserId ? { userId: filterUserId } : undefined,
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

  const actorUserId = req.auth.userId as string;
  const optionId = Number(req.body?.optionId);
  if (!Number.isFinite(optionId)) return res.status(400).json({ error: "invalid_option" });

  const post = await prisma.communityPost.findUnique({ where: { legacyId } });
  if (!post) return res.status(404).json({ error: "not_found" });

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

  const current = (Array.isArray(post.comments) ? post.comments : []) as any as CommentNode[];
  const del = deleteNodeFromTree(current, commentId);
  if (!del.deleted) return res.status(404).json({ error: "comment_not_found" });
  if (!canEditOwnerContent(req, del.deleted.userId)) return res.status(403).json({ error: "forbidden" });

  const updated = await prisma.communityPost.update({ where: { legacyId }, data: ({ comments: del.next } as any) });
  broadcastCommunityEvent("posts_changed", { postId: Number(legacyId), action: "comment_deleted" });
  return res.json({ comments: await mapCommentsForViewerWithUserHydration(updated.comments, actorUserId) });
});

router.put("/posts", requireAuth, async (req: any, res) => {
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

router.get("/users/bulk", async (req, res) => {
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

router.get("/users/suggested", async (req, res) => {
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

  const posts = await prisma.communityPost.findMany({ select: { content: true } });
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
  const members = await prisma.user.count();
  const posts = await prisma.communityPost.count();
  const discussions = await prisma.communityDiscussion.count();

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
  const items = await prisma.communityDiscussion.findMany({
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
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  });

  return res.json({ discussions });
});

router.post("/discussions/:id/view", async (req, res) => {
  let legacyId: bigint;
  try {
    legacyId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  await prisma.communityDiscussion.updateMany({ where: { legacyId }, data: { views: { increment: 1 } } });
  return res.json({ ok: true });
});

router.put("/discussions", requireAuth, async (req: any, res) => {
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

  if (!canEditOwnerContent(req, existing.userId)) return res.status(403).json({ error: "forbidden" });

  await prisma.communityDiscussion.delete({ where: { legacyId } });
  return res.json({ ok: true });
});

export default router;
