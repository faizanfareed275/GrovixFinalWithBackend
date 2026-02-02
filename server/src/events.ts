import { Router } from "express";
import { prisma } from "./db";
import { requireAuth, requireAdmin } from "./middleware/auth";
import jwt from "jsonwebtoken";

const router = Router();

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

function toEventClient(e: any, viewerId: string | null) {
  const enrollments = Array.isArray(e?.enrollments) ? e.enrollments : [];
  const enrolled = !!viewerId && enrollments.some((x: any) => String(x?.userId || "") === viewerId);

  return {
    id: e.id,
    title: e.title,
    type: e.type,
    description: e.description ?? null,
    venue: e.venue ?? null,
    link: e.link ?? null,
    prize: e.prize ?? null,
    date: e.date ?? null,
    startAt: e.startAt ? new Date(e.startAt).toISOString() : null,
    endAt: e.endAt ? new Date(e.endAt).toISOString() : null,
    participants: enrollments.length,
    enrolled,
  };
}

router.get("/", async (req, res) => {
  const viewerId = getOptionalAuth(req)?.userId || null;

  const items = await (prisma as any).event.findMany({
    orderBy: { startAt: "asc" },
    include: { enrollments: { select: { userId: true } } },
  });

  return res.json({ events: items.map((e: any) => toEventClient(e, viewerId)) });
});

router.get("/me", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;

  const enrollments = await (prisma as any).eventEnrollment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      eventId: true,
      status: true,
      createdAt: true,
      event: {
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          type: true,
        },
      },
    },
  });

  return res.json({ enrollments });
});

router.get("/admin/enrollments", requireAdmin, async (_req, res) => {
  const enrollments = await (prisma as any).eventEnrollment.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      status: true,
      createdAt: true,
      name: true,
      email: true,
      phone: true,
      reason: true,
      event: { select: { id: true, title: true, startAt: true, type: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  return res.json({ enrollments });
});

router.post("/:id/enroll", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;

  const eventId = Number(req.params.id);
  if (!Number.isFinite(eventId)) return res.status(400).json({ error: "invalid_event_id" });

  const event = await (prisma as any).event.findUnique({ where: { id: eventId } });
  if (!event) return res.status(404).json({ error: "not_found" });

  const body = req.body || {};

  try {
    const enrollment = await (prisma as any).eventEnrollment.create({
      data: {
        eventId,
        userId,
        name: typeof body.name === "string" ? body.name : null,
        email: typeof body.email === "string" ? body.email : null,
        phone: typeof body.phone === "string" ? body.phone : null,
        reason: typeof body.reason === "string" ? body.reason : null,
        status: "enrolled",
      },
    });

    const withCounts = await (prisma as any).event.findUnique({
      where: { id: eventId },
      include: { enrollments: { select: { userId: true } } },
    });

    return res.json({ enrolled: true, enrollmentId: enrollment.id, event: toEventClient(withCounts, userId) });
  } catch (e: any) {
    // unique constraint: already enrolled
    const withCounts = await (prisma as any).event.findUnique({
      where: { id: eventId },
      include: { enrollments: { select: { userId: true } } },
    });

    return res.json({ enrolled: true, event: toEventClient(withCounts, userId) });
  }
});

router.post("/seed", requireAdmin, async (_req, res) => {
  const items = [
    {
      id: 1,
      title: "AI Hackathon 2024",
      type: "hackathon",
      description: "Build innovative AI solutions in 48 hours. Teams of up to 4 members.",
      venue: "Virtual Event",
      prize: "$10,000",
      date: "Dec 15, 2024",
      startAt: new Date("2024-12-15T10:00:00.000Z"),
      endAt: new Date("2024-12-17T10:00:00.000Z"),
    },
    {
      id: 2,
      title: "Speed Coding Challenge",
      type: "challenge",
      description: "Test your coding speed and accuracy in this exciting competition.",
      venue: "Online Platform",
      prize: "5,000 XP",
      date: "Dec 20, 2024",
      startAt: new Date("2024-12-20T10:00:00.000Z"),
      endAt: new Date("2024-12-20T12:00:00.000Z"),
    },
    {
      id: 3,
      title: "Tech Talk: Career Growth",
      type: "workshop",
      description: "Learn from industry experts about career growth strategies.",
      venue: "Online Webinar",
      prize: null,
      date: "Dec 28, 2024",
      startAt: new Date("2024-12-28T15:00:00.000Z"),
      endAt: new Date("2024-12-28T16:00:00.000Z"),
    },
  ];

  for (const e of items) {
    await (prisma as any).event.upsert({
      where: { id: e.id },
      update: {
        title: e.title,
        type: e.type,
        description: e.description,
        venue: e.venue,
        prize: e.prize,
        date: e.date,
        startAt: e.startAt,
        endAt: e.endAt,
      },
      create: {
        id: e.id,
        title: e.title,
        type: e.type,
        description: e.description,
        venue: e.venue,
        prize: e.prize,
        date: e.date,
        startAt: e.startAt,
        endAt: e.endAt,
      },
    });
  }

  return res.json({ ok: true, seeded: items.length });
});

export default router;
