import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";
import authRouter from "./auth";
import internshipsRouter from "./internships";
import xpRouter from "./xp";
import challengesRouter from "./challenges";
import communityRouter from "./community";
import usersRouter from "./users";
import eventsRouter from "./events";
import chatRouter from "./chat";
import jobsRouter from "./jobs";
import certificatesRouter from "./certificates";
import filesRouter from "./files";
import { startEventEmailScheduler } from "./eventEmailScheduler";
import { startInternshipScheduler } from "./internshipScheduler";
import { prisma } from "./db";

dotenv.config({ path: "../.env" });

const app = express();
const db = prisma as any;

const port = Number(process.env.GROVIX_API_PORT || 4000);
const webOrigin = process.env.GROVIX_WEB_ORIGIN || "http://localhost:8080";
const isProd = process.env.NODE_ENV === "production";

app.use(
  cors({
    origin: isProd ? webOrigin : true,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.use((err: any, _req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "invalid_json" });
  }
  return next(err);
});

app.use("/auth", authRouter);
app.use("/internships", internshipsRouter);
app.use("/xp", xpRouter);
app.use("/challenges", challengesRouter);
app.use("/community", communityRouter);
app.use("/users", usersRouter);
app.use("/events", eventsRouter);
app.use("/chat", chatRouter);
app.use("/jobs", jobsRouter);
app.use("/certificates", certificatesRouter);
app.use("/files", filesRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "Grovix API", ts: Date.now() });
});

startEventEmailScheduler();
startInternshipScheduler();

function parseCookies(header: string | undefined) {
  const out: Record<string, string> = {};
  const raw = String(header || "");
  if (!raw) return out;
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(v);
  }
  return out;
}

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: isProd ? webOrigin : true,
    credentials: true,
  },
});

io.use((socket, next) => {
  try {
    const cookies = parseCookies(socket.request.headers.cookie as any);
    const token = cookies?.grovix_token;
    if (!token) return next(new Error("unauthorized"));
    const secret = process.env.JWT_SECRET;
    if (!secret) return next(new Error("server_misconfigured"));
    const decoded = jwt.verify(token, secret) as any;
    (socket as any).auth = { userId: decoded.userId, role: decoded.role };
    return next();
  } catch {
    return next(new Error("unauthorized"));
  }
});

io.on("connection", async (socket) => {
  const auth = (socket as any).auth as { userId: string; role: string } | undefined;
  const userId = auth?.userId;
  if (!userId) return;

  socket.join(`user:${userId}`);

  try {
    const parts = await db.chatParticipant.findMany({ where: { userId }, select: { conversationId: true } });
    for (const p of parts) socket.join(`conv:${p.conversationId}`);
  } catch {
  }

  socket.on("chat:join", async (payload: any, cb?: (resp: any) => void) => {
    const conversationId = String(payload?.conversationId || "");
    if (!conversationId) return cb?.({ ok: false, error: "invalid_id" });
    try {
      const part = await db.chatParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
      if (!part) return cb?.({ ok: false, error: "forbidden" });
      socket.join(`conv:${conversationId}`);
      return cb?.({ ok: true });
    } catch {
      return cb?.({ ok: false, error: "server_error" });
    }
  });

  socket.on("chat:typing", async (payload: any) => {
    const conversationId = String(payload?.conversationId || "");
    if (!conversationId) return;
    const isTyping = !!payload?.isTyping;
    socket.to(`conv:${conversationId}`).emit("chat:typing", { conversationId, userId, isTyping });
  });

  socket.on("chat:send", async (payload: any, cb?: (resp: any) => void) => {
    const conversationId = String(payload?.conversationId || "");
    const type = payload?.type === "IMAGE" ? "IMAGE" : "TEXT";
    const ivB64 = String(payload?.ivB64 || "");
    const ciphertextB64 = String(payload?.ciphertextB64 || "");
    if (!conversationId || !ivB64 || !ciphertextB64) return cb?.({ ok: false, error: "invalid_request" });

    try {
      const part = await db.chatParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
      if (!part) return cb?.({ ok: false, error: "forbidden" });

      const msg = await db.chatMessage.create({
        data: { conversationId, senderId: userId, type, ivB64, ciphertextB64 },
        select: { id: true, conversationId: true, senderId: true, type: true, ivB64: true, ciphertextB64: true, createdAt: true },
      });

      await db.chatConversation.update({ where: { id: conversationId }, data: {} });

      const out = { ...msg, createdAt: msg.createdAt.toISOString() };
      io.to(`conv:${conversationId}`).emit("chat:message", out);
      return cb?.({ ok: true, message: out });
    } catch {
      return cb?.({ ok: false, error: "server_error" });
    }
  });

  socket.on("chat:edit", async (payload: any, cb?: (resp: any) => void) => {
    const messageId = String(payload?.messageId || "");
    const ivB64 = String(payload?.ivB64 || "");
    const ciphertextB64 = String(payload?.ciphertextB64 || "");
    if (!messageId || !ivB64 || !ciphertextB64) return cb?.({ ok: false, error: "invalid_request" });

    try {
      const existing = await db.chatMessage.findUnique({ where: { id: messageId }, select: { id: true, senderId: true, conversationId: true, type: true } });
      if (!existing) return cb?.({ ok: false, error: "not_found" });
      if (String(existing.senderId) !== userId) return cb?.({ ok: false, error: "forbidden" });

      const part = await db.chatParticipant.findUnique({ where: { conversationId_userId: { conversationId: existing.conversationId, userId } } });
      if (!part) return cb?.({ ok: false, error: "forbidden" });

      const updated = await db.chatMessage.update({
        where: { id: messageId },
        data: { ivB64, ciphertextB64 },
        select: { id: true, conversationId: true, senderId: true, type: true, ivB64: true, ciphertextB64: true, createdAt: true },
      });
      await db.chatConversation.update({ where: { id: String(existing.conversationId) }, data: {} });

      const out = { ...updated, createdAt: updated.createdAt.toISOString() };
      io.to(`conv:${String(existing.conversationId)}`).emit("chat:message_updated", out);
      return cb?.({ ok: true, message: out });
    } catch {
      return cb?.({ ok: false, error: "server_error" });
    }
  });

  socket.on("chat:delete", async (payload: any, cb?: (resp: any) => void) => {
    const messageId = String(payload?.messageId || "");
    if (!messageId) return cb?.({ ok: false, error: "invalid_request" });

    try {
      const existing = await db.chatMessage.findUnique({ where: { id: messageId }, select: { id: true, senderId: true, conversationId: true } });
      if (!existing) return cb?.({ ok: false, error: "not_found" });
      if (String(existing.senderId) !== userId) return cb?.({ ok: false, error: "forbidden" });

      const part = await db.chatParticipant.findUnique({ where: { conversationId_userId: { conversationId: existing.conversationId, userId } } });
      if (!part) return cb?.({ ok: false, error: "forbidden" });

      await db.chatMessage.delete({ where: { id: messageId } });
      await db.chatConversation.update({ where: { id: String(existing.conversationId) }, data: {} });

      io.to(`conv:${String(existing.conversationId)}`).emit("chat:message_deleted", { conversationId: String(existing.conversationId), messageId });
      return cb?.({ ok: true });
    } catch {
      return cb?.({ ok: false, error: "server_error" });
    }
  });

  socket.on("chat:call:start", async (payload: any, cb?: (resp: any) => void) => {
    const conversationId = String(payload?.conversationId || "");
    const callType = payload?.callType === "video" ? "video" : "audio";
    if (!conversationId) return cb?.({ ok: false, error: "invalid_request" });

    try {
      const part = await db.chatParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
      if (!part) return cb?.({ ok: false, error: "forbidden" });

      const participants = await db.chatParticipant.findMany({ where: { conversationId }, select: { userId: true } });
      const others = (participants as any[]).map((p: any) => String(p.userId)).filter((id: string) => id !== userId);
      const callId = randomUUID();

      for (const uid of others) {
        io.to(`user:${uid}`).emit("chat:call:incoming", {
          callId,
          conversationId,
          callType,
          fromUserId: userId,
        });
      }

      return cb?.({ ok: true, callId });
    } catch {
      return cb?.({ ok: false, error: "server_error" });
    }
  });

  socket.on("chat:call:response", async (payload: any, cb?: (resp: any) => void) => {
    const callId = String(payload?.callId || "");
    const conversationId = String(payload?.conversationId || "");
    const fromUserId = String(payload?.fromUserId || "");
    const accepted = !!payload?.accepted;
    if (!callId || !conversationId || !fromUserId) return cb?.({ ok: false, error: "invalid_request" });

    try {
      const part = await db.chatParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
      if (!part) return cb?.({ ok: false, error: "forbidden" });

      io.to(`user:${fromUserId}`).emit("chat:call:response", { callId, conversationId, fromUserId, toUserId: userId, accepted });
      return cb?.({ ok: true });
    } catch {
      return cb?.({ ok: false, error: "server_error" });
    }
  });
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Grovix API running on http://localhost:${port}`);
});
