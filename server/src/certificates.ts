import { Router } from "express";
import { prisma } from "./db";

const router = Router();

router.get("/verify", async (req, res) => {
  const code = String(req.query?.code || req.query?.id || "").trim();
  if (!code) return res.status(400).json({ error: "missing_code" });

  const cert = await prisma.internshipCertificate.findFirst({
    where: {
      OR: [{ certificateCode: code }, { id: code }],
    },
    include: {
      internship: { select: { id: true, title: true, company: true, internshipCode: true } },
      enrollment: {
        include: {
          user: { select: { id: true, name: true } },
          batch: { select: { id: true, name: true, batchCode: true, startDate: true, endDate: true } },
        },
      },
    },
  });

  if (!cert) return res.status(404).json({ error: "not_found" });

  const batch = (cert as any).enrollment?.batch;

  const pdfUrl = cert.status === "VALID" && cert.fileId ? `/certificates/${encodeURIComponent(cert.certificateCode)}/pdf` : undefined;

  return res.json({
    ok: true,
    certificate: {
      id: cert.id,
      code: cert.certificateCode,
      status: cert.status,
      issuedAt: cert.issuedAt.toISOString(),
      internship: {
        id: cert.internship.id,
        title: cert.internship.title,
        company: cert.internship.company,
        internshipCode: cert.internship.internshipCode || null,
      },
      intern: {
        id: cert.enrollment.user.id,
        name: cert.enrollment.user.name,
      },
      batch: batch
        ? {
            id: batch.id,
            name: batch.name,
            batchCode: batch.batchCode,
            startDate: batch.startDate.toISOString(),
            endDate: batch.endDate.toISOString(),
          }
        : null,
      duration: {
        startDate: cert.enrollment.startDate.toISOString(),
        endDate: cert.enrollment.endDate.toISOString(),
      },
      pdfUrl,
    },
  });
});

router.get("/:code/pdf", async (req, res) => {
  const code = String(req.params.code || "").trim();
  if (!code) return res.status(400).json({ error: "missing_code" });

  const cert = await prisma.internshipCertificate.findUnique({
    where: { certificateCode: code },
    include: { file: true },
  });

  if (!cert) return res.status(404).json({ error: "not_found" });
  if (cert.status !== "VALID") return res.status(403).json({ error: "revoked" });
  if (!cert.file) return res.status(404).json({ error: "missing_file" });

  res.setHeader("Content-Type", cert.file.mimeType || "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=\"${String(cert.file.fileName || "certificate.pdf").replace(/\"/g, "") }\"`);
  return res.status(200).send(Buffer.from(cert.file.bytes as any));
});

export default router;
