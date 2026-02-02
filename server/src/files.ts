import { Router } from "express";
import { prisma } from "./db";
import { requireAuth } from "./middleware/auth";

const router = Router();

router.get("/:id", requireAuth, async (req: any, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "invalid_id" });

  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) return res.status(404).json({ error: "not_found" });

  res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename=\"${String(file.fileName || "file").replace(/\"/g, "") }\"`);

  return res.status(200).send(Buffer.from(file.bytes as any));
});

export default router;
