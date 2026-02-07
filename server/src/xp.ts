import { Router } from "express";
import { prisma } from "./db";
import { z } from "zod";
import { requireAdmin, requireAuth } from "./middleware/auth";

const router = Router();

router.get("/me", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "not_found" });
  return res.json({ xp: user.xp });
});

router.post("/admin/adjust", requireAdmin, async (req: any, res) => {
  const schema = z.object({ userId: z.string().min(1), delta: z.number().int() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const delta = parsed.data.delta;
  const updated = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { xp: { increment: delta } },
    select: { id: true, xp: true },
  });

  return res.json({ ok: true, user: updated });
});

export default router;
