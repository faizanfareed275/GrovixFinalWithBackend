import { Router } from "express";
import { prisma } from "./db";
import { requireAuth } from "./middleware/auth";

const router = Router();

router.get("/me", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "not_found" });
  return res.json({ xp: user.xp });
});

export default router;
