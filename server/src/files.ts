import { Router } from "express";
import { prisma } from "./db";
import { requireAdmin, requireAuth } from "./middleware/auth";

const router = Router();

router.get("/admin/list", requireAdmin, async (req: any, res) => {
  const q = String(req.query?.q || "").trim().toLowerCase();
  const purpose = req.query?.purpose ? String(req.query.purpose).trim() : "";
  const takeRaw = Number(req.query?.limit || 200);
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 500) : 200;

  const rows = await prisma.storedFile.findMany({
    where: {
      ...(purpose ? { purpose: purpose as any } : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q, mode: "insensitive" } },
              { fileName: { contains: q, mode: "insensitive" } },
              { mimeType: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      purpose: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      storageProvider: true,
      externalUrl: true,
      createdAt: true,
    },
  });

  return res.json({
    files: rows.map((f) => ({
      id: f.id,
      purpose: f.purpose,
      fileName: f.fileName,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      storageProvider: f.storageProvider || null,
      externalUrl: f.externalUrl || null,
      createdAt: f.createdAt.toISOString(),
    })),
  });
});

router.delete("/admin/:id", requireAdmin, async (req: any, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "invalid_id" });
  await prisma.storedFile.delete({ where: { id } });
  return res.json({ ok: true });
});

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
