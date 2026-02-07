import { Router } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { requireAdmin, requireAuth } from "./middleware/auth";

const router = Router();

function dateOnlyString(date: Date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysDiff(a: string, b: string) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
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

router.get("/completions", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const completions = await prisma.challengeCompletion.findMany({
    where: { userId },
    orderBy: { completedAt: "desc" },
  });
  return res.json({ completions });
});

router.get("/admin/completions", requireAdmin, async (req: any, res) => {
  const userId = String(req.query?.userId || "");
  if (!userId) return res.status(400).json({ error: "userId_required" });

  const completions = await prisma.challengeCompletion.findMany({
    where: { userId },
    orderBy: { completedAt: "desc" },
    take: 500,
  });

  return res.json({
    completions: completions.map((c) => ({
      id: c.id,
      challengeId: c.challengeId,
      title: c.title,
      category: c.category,
      xpEarned: c.xpEarned,
      completedAt: c.completedAt.toISOString(),
    })),
  });
});

router.delete("/admin/completions/:id", requireAdmin, async (req: any, res) => {
  const id = String(req.params.id || "");
  if (!id) return res.status(400).json({ error: "invalid_id" });

  const existing = await prisma.challengeCompletion.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "not_found" });

  await prisma.$transaction([
    prisma.challengeCompletion.delete({ where: { id } }),
    prisma.user.update({ where: { id: existing.userId }, data: { xp: { decrement: existing.xpEarned } } }),
  ]);

  return res.json({ ok: true });
});

router.post("/admin/completions/clear", requireAdmin, async (req: any, res) => {
  const schema = z.object({ userId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const userId = parsed.data.userId;
  const rows = await prisma.challengeCompletion.findMany({ where: { userId }, select: { xpEarned: true } });
  const totalXp = rows.reduce((sum, r) => sum + (Number(r.xpEarned || 0) || 0), 0);

  await prisma.$transaction([
    prisma.challengeCompletion.deleteMany({ where: { userId } }),
    ...(totalXp ? [prisma.user.update({ where: { id: userId }, data: { xp: { decrement: totalXp } } })] : []),
  ]);

  return res.json({ ok: true, removed: rows.length });
});

router.post("/:id/complete", requireAuth, async (req: any, res) => {
  const challengeId = Number(req.params.id);
  if (!Number.isFinite(challengeId)) return res.status(400).json({ error: "invalid_id" });

  const schema = z.object({
    title: z.string().min(1),
    category: z.string().min(1),
    xpEarned: z.number().int().min(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const userId = req.auth.userId as string;

  recordUserActivity(userId).catch(() => {});

  const existing = await prisma.challengeCompletion.findUnique({
    where: { userId_challengeId: { userId, challengeId } },
  });

  if (existing) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return res.json({ ok: true, completion: existing, xp: user?.xp ?? 0 });
  }

  const completion = await prisma.challengeCompletion.create({
    data: {
      userId,
      challengeId,
      title: parsed.data.title,
      category: parsed.data.category,
      xpEarned: parsed.data.xpEarned,
    },
  });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: parsed.data.xpEarned } },
  });

  return res.json({ ok: true, completion, xp: user.xp });
});

export default router;
