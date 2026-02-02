import { Router } from "express";
import nodemailer from "nodemailer";
import { prisma } from "./db";
import { requireAuth } from "./middleware/auth";
import { requireAdmin } from "./middleware/auth";

const router = Router();

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function getSmtpConfig(): SmtpConfig | null {
  const host = String(process.env.SMTP_HOST || "").trim();
  const portRaw = Number(process.env.SMTP_PORT || "");
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "");
  const from = String(process.env.SMTP_FROM || "").trim();

  if (!host || !user || !pass || !from) return null;

  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 587;
  const secureEnv = String(process.env.SMTP_SECURE || "").toLowerCase();
  const secure = secureEnv === "1" || secureEnv === "true" || port === 465;

  return { host, port, secure, user, pass, from };
}

function internshipCodeFromId(id: number, now: Date = new Date()) {
  const year = now.getFullYear();
  const seq = String(id).padStart(4, "0");
  return `INT-${year}-${seq}`;
}

function batchMonthCode(now: Date = new Date()) {
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  return `${mm}${yy}`;
}

async function ensureInternshipCode(internshipId: number): Promise<string> {
  const existing = await prisma.internship.findUnique({ where: { id: internshipId }, select: { internshipCode: true } });
  const current = existing?.internshipCode ? String(existing.internshipCode) : "";
  if (current) return current;
  const code = internshipCodeFromId(internshipId);
  await prisma.internship.update({ where: { id: internshipId }, data: { internshipCode: code } });
  return code;
}

function pdfPlaceholderBytes() {
  const raw = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n";
  return Buffer.from(raw, "utf8");
}

async function ensureDefaultBatch(internshipId: number) {
  const existing = await prisma.internshipBatch.findFirst({
    where: { internshipId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const internshipCode = await ensureInternshipCode(internshipId);

  const now = new Date();
  const startDate = now;
  const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const month = batchMonthCode(now);
  const seq = "01";
  const batchCode = `BAT-${internshipCode}-${month}-${seq}`;

  return await prisma.internshipBatch.create({
    data: {
      internshipId,
      batchCode,
      name: "Default Batch",
      startDate,
      endDate,
      status: "OPEN",
    } as any,
  });
}

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

router.get("/:id/batches", async (req, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });
  const batches = await prisma.internshipBatch.findMany({
    where: { internshipId },
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
  });
  return res.json({ batches });
});

router.get("/:id/admin/batches", requireAdmin, async (req, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });
  const batches = await prisma.internshipBatch.findMany({
    where: { internshipId },
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
  });
  return res.json({ batches });
});

router.post("/:id/admin/batches", requireAdmin, async (req, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });

  const internship = await prisma.internship.findUnique({ where: { id: internshipId }, select: { id: true, internshipCode: true } });
  if (!internship) return res.status(404).json({ error: "not_found" });

  const internshipCode = internship.internshipCode ? String(internship.internshipCode) : await ensureInternshipCode(internshipId);

  const name = String(req.body?.name || "").trim();
  const startDate = req.body?.startDate ? new Date(req.body.startDate) : null;
  const endDate = req.body?.endDate ? new Date(req.body.endDate) : null;

  if (!name || !startDate || !endDate || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return res.status(400).json({ error: "invalid_request" });
  }

  const month = batchMonthCode(startDate);
  const existingMonthCount = await prisma.internshipBatch.count({
    where: {
      internshipId,
      startDate: {
        gte: new Date(startDate.getFullYear(), startDate.getMonth(), 1),
        lt: new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1),
      },
    },
  });
  const seq = String(existingMonthCount + 1).padStart(2, "0");
  const batchCode = `BAT-${internshipCode}-${month}-${seq}`;

  const status = String(req.body?.status || "DRAFT").toUpperCase();
  const capacityRaw = req.body?.capacity;
  const capacity = capacityRaw === undefined || capacityRaw === null ? null : Number(capacityRaw);

  const applicationOpenAt = req.body?.applicationOpenAt ? new Date(req.body.applicationOpenAt) : null;
  const applicationCloseAt = req.body?.applicationCloseAt ? new Date(req.body.applicationCloseAt) : null;

  const batch = await prisma.internshipBatch.create({
    data: {
      internshipId,
      batchCode,
      name,
      startDate,
      endDate,
      applicationOpenAt,
      applicationCloseAt,
      capacity: Number.isFinite(capacity as any) ? (capacity as any) : null,
      status: ["DRAFT", "OPEN", "CLOSED", "RUNNING", "ENDED"].includes(status) ? (status as any) : "DRAFT",
    } as any,
  });

  return res.json({ ok: true, batch });
});

router.get("/", async (_req, res) => {
  const items = await prisma.internship.findMany({
    orderBy: { id: "asc" },
  });
  return res.json({ internships: items });
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });

  const internship = await prisma.internship.findUnique({ where: { id } });
  if (!internship) return res.status(404).json({ error: "not_found" });

  return res.json({ internship });
});

router.put("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });

  const existing = await prisma.internship.findUnique({ where: { id }, select: { internshipCode: true } });

  const title = String(req.body?.title ?? "").trim();
  const company = String(req.body?.company ?? "").trim();
  const type = req.body?.type === "paid" ? "paid" : "free";
  const xpRequired = Number(req.body?.xpRequired ?? 0) || 0;
  const salaryRaw = req.body?.salary;
  const salary = salaryRaw && String(salaryRaw).trim() ? String(salaryRaw).trim() : null;
  const duration = String(req.body?.duration ?? "").trim();
  const location = String(req.body?.location ?? "").trim();
  const skills = Array.isArray(req.body?.skills) ? req.body.skills.map((s: any) => String(s)) : [];
  const description = String(req.body?.description ?? "");
  const applicants = Number(req.body?.applicants ?? 0) || 0;

  const internshipCodeRaw = req.body?.internshipCode;
  const internshipCodeProvided = internshipCodeRaw && String(internshipCodeRaw).trim() ? String(internshipCodeRaw).trim() : null;
  const internshipCode = internshipCodeProvided || (existing?.internshipCode ? null : internshipCodeFromId(id));

  if (!title || !company) return res.status(400).json({ error: "invalid_request" });

  const internship = await prisma.internship.upsert({
    where: { id },
    update: {
      ...(internshipCode ? { internshipCode } : {}),
      title,
      company,
      type,
      xpRequired,
      salary,
      duration,
      location,
      skills,
      description,
      applicants,
    },
    create: {
      id,
      internshipCode: internshipCodeProvided || internshipCodeFromId(id),
      title,
      company,
      type,
      xpRequired,
      salary,
      duration,
      location,
      skills,
      description,
      applicants,
    },
  });

  return res.json({ ok: true, internship });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });

  try {
    await prisma.internship.delete({ where: { id } });
  } catch {
    // ignore
  }

  return res.json({ ok: true });
});

router.post("/:id/apply", requireAuth, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });

  const internship = await prisma.internship.findUnique({ where: { id: internshipId } });
  if (!internship) return res.status(404).json({ error: "not_found" });

  const userId = req.auth.userId as string;

  const bodyBatchId = req.body?.batchId;
  const bodyBatchCode = req.body?.batchCode;

  let batchId: number | null = null;
  if (bodyBatchId !== undefined && bodyBatchId !== null && String(bodyBatchId).trim()) {
    const parsed = Number(bodyBatchId);
    if (Number.isFinite(parsed)) batchId = parsed;
  }
  if (!batchId && bodyBatchCode && String(bodyBatchCode).trim()) {
    const bc = String(bodyBatchCode).trim();
    const b = await prisma.internshipBatch.findUnique({ where: { batchCode: bc } });
    if (b && b.internshipId === internshipId) batchId = b.id;
  }

  if (!batchId) {
    const def = await ensureDefaultBatch(internshipId);
    batchId = def.id;
  }

  const existing = await prisma.internshipApplication.findUnique({
    where: { batchId_userId: { batchId, userId } },
  });

  if (existing && existing.status !== "rejected") {
    return res.json({ ok: true, application: existing });
  }

  const application = existing
    ? await prisma.internshipApplication.update({
        where: { id: existing.id },
        data: {
          status: "pending",
          portfolio: req.body?.portfolio ?? null,
          linkedin: req.body?.linkedin ?? null,
          github: req.body?.github ?? null,
          location: req.body?.location ?? null,
          phone: req.body?.phone ?? null,
          coverLetter: req.body?.coverLetter ?? null,
          reviewedAt: null,
          reviewedBy: null,
          offerSubject: null,
          offerBody: null,
          offerFileId: null,
        },
      })
    : await prisma.internshipApplication.create({
        data: {
          internshipId,
          batchId,
          userId,
          status: "pending",
          portfolio: req.body?.portfolio ?? null,
          linkedin: req.body?.linkedin ?? null,
          github: req.body?.github ?? null,
          location: req.body?.location ?? null,
          phone: req.body?.phone ?? null,
          coverLetter: req.body?.coverLetter ?? null,
        },
      });

  prisma.internship.update({ where: { id: internshipId }, data: { applicants: { increment: 1 } } }).catch(() => {});

  return res.json({ ok: true, application });
});

router.get("/:id/admin/applications", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });

  const batchIdRaw = req.query?.batchId;
  const batchId = batchIdRaw ? Number(batchIdRaw) : null;

  const rows = await prisma.internshipApplication.findMany({
    where: {
      internshipId,
      ...(Number.isFinite(batchId as any) ? { batchId: batchId as any } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      batch: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true, xp: true } },
    },
  });

  return res.json({ applications: rows });
});

router.post("/:id/admin/applications/:appId/approve", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const appId = String(req.params.appId || "");
  if (!Number.isFinite(internshipId) || !appId) return res.status(400).json({ error: "invalid_request" });

  const actor = req.auth?.userId ? String(req.auth.userId) : null;

  const application = await prisma.internshipApplication.findUnique({
    where: { id: appId },
    include: {
      internship: true,
      batch: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!application || application.internshipId !== internshipId) return res.status(404).json({ error: "not_found" });

  const batchIdBody = req.body?.batchId;
  const batchId = batchIdBody ? Number(batchIdBody) : application.batchId;
  if (!batchId || !Number.isFinite(batchId)) return res.status(400).json({ error: "missing_batch" });

  const batch = await prisma.internshipBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.internshipId !== internshipId) return res.status(400).json({ error: "invalid_batch" });

  const startDate = req.body?.startDate ? new Date(req.body.startDate) : batch.startDate;
  const endDate = req.body?.endDate ? new Date(req.body.endDate) : batch.endDate;
  if (!startDate || !endDate || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return res.status(400).json({ error: "invalid_dates" });
  }

  const offerSubject = req.body?.offerSubject ? String(req.body.offerSubject) : application.offerSubject;
  const offerBody = req.body?.offerBody ? String(req.body.offerBody) : application.offerBody;
  const sendEmail = req.body?.sendEmail === undefined ? true : !!req.body.sendEmail;

  const offerFile = await prisma.storedFile.create({
    data: {
      purpose: "OFFER_LETTER" as any,
      fileName: "offer-letter.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfPlaceholderBytes().length,
      bytes: pdfPlaceholderBytes(),
    } as any,
  });

  const enrollment = await prisma.internshipEnrollment.upsert({
    where: { internshipId_userId: { internshipId, userId: application.userId } },
    update: {
      batchId,
      startDate,
      endDate,
      status: "ACTIVE" as any,
      accessMode: "FULL" as any,
      terminatedAt: null,
      frozenAt: null,
      readOnlyAt: null,
    } as any,
    create: {
      internshipId,
      batchId,
      userId: application.userId,
      startDate,
      endDate,
      status: "ACTIVE" as any,
      accessMode: "FULL" as any,
    } as any,
  });

  const updated = await prisma.internshipApplication.update({
    where: { id: application.id },
    data: {
      status: "approved" as any,
      reviewedAt: new Date(),
      reviewedBy: actor,
      batchId,
      offerSubject: offerSubject ?? null,
      offerBody: offerBody ?? null,
      offerFileId: offerFile.id,
    } as any,
  });

  if (sendEmail) {
    const cfg = getSmtpConfig();
    const to = String(application.user?.email || "").trim();
    if (cfg && to) {
      try {
        const transporter = nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          auth: { user: cfg.user, pass: cfg.pass },
        });
        await transporter.sendMail({
          from: cfg.from,
          to,
          subject: String(offerSubject || `Offer Letter: ${application.internship?.title || "Internship"}`),
          html: String(offerBody || "<p>Congratulations! Please find your offer letter attached.</p>"),
          attachments: [
            {
              filename: offerFile.fileName,
              content: Buffer.from(offerFile.bytes as any),
              contentType: offerFile.mimeType,
            },
          ],
        });
      } catch {
      }
    }
  }

  return res.json({ ok: true, application: updated, enrollment });
});

router.post("/:id/admin/applications/:appId/reject", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const appId = String(req.params.appId || "");
  if (!Number.isFinite(internshipId) || !appId) return res.status(400).json({ error: "invalid_request" });

  const actor = req.auth?.userId ? String(req.auth.userId) : null;

  const application = await prisma.internshipApplication.findUnique({ where: { id: appId } });
  if (!application || application.internshipId !== internshipId) return res.status(404).json({ error: "not_found" });

  const updated = await prisma.internshipApplication.update({
    where: { id: appId },
    data: {
      status: "rejected" as any,
      reviewedAt: new Date(),
      reviewedBy: actor,
      offerSubject: null,
      offerBody: null,
      offerFileId: null,
    } as any,
  });

  return res.json({ ok: true, application: updated });
});

router.get("/:id/admin/enrollments", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });

  const batchIdRaw = req.query?.batchId;
  const batchId = batchIdRaw ? Number(batchIdRaw) : null;

  const rows = await prisma.internshipEnrollment.findMany({
    where: {
      internshipId,
      ...(Number.isFinite(batchId as any) ? { batchId: batchId as any } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      batch: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true, xp: true } },
      certificate: { select: { id: true, certificateCode: true, status: true, issuedAt: true } },
    },
  });

  return res.json({ enrollments: rows });
});

router.post("/:id/admin/enrollments/:enrollmentId/freeze", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const enrollmentId = String(req.params.enrollmentId || "");
  if (!Number.isFinite(internshipId) || !enrollmentId) return res.status(400).json({ error: "invalid_request" });

  const actor = req.auth?.userId ? String(req.auth.userId) : null;
  const enrollment = await prisma.internshipEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment || enrollment.internshipId !== internshipId) return res.status(404).json({ error: "not_found" });

  const before = enrollment as any;
  const updated = await prisma.internshipEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "FROZEN" as any,
      accessMode: "READ_ONLY" as any,
      frozenAt: new Date(),
    } as any,
  });

  if (actor) {
    prisma.auditLog
      .create({
        data: {
          actorUserId: actor,
          action: "INTERNSHIP_ENROLLMENT_FREEZE",
          entityType: "InternshipEnrollment",
          entityId: enrollmentId,
          before,
          after: updated as any,
        },
      })
      .catch(() => {});
  }

  return res.json({ ok: true, enrollment: updated });
});

router.post("/:id/admin/enrollments/:enrollmentId/read-only", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const enrollmentId = String(req.params.enrollmentId || "");
  if (!Number.isFinite(internshipId) || !enrollmentId) return res.status(400).json({ error: "invalid_request" });

  const actor = req.auth?.userId ? String(req.auth.userId) : null;
  const enrollment = await prisma.internshipEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment || enrollment.internshipId !== internshipId) return res.status(404).json({ error: "not_found" });

  const before = enrollment as any;
  const updated = await prisma.internshipEnrollment.update({
    where: { id: enrollmentId },
    data: {
      accessMode: "READ_ONLY" as any,
      readOnlyAt: new Date(),
    } as any,
  });

  if (actor) {
    prisma.auditLog
      .create({
        data: {
          actorUserId: actor,
          action: "INTERNSHIP_ENROLLMENT_SET_READ_ONLY",
          entityType: "InternshipEnrollment",
          entityId: enrollmentId,
          before,
          after: updated as any,
        },
      })
      .catch(() => {});
  }

  return res.json({ ok: true, enrollment: updated });
});

router.post("/:id/admin/enrollments/:enrollmentId/terminate", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const enrollmentId = String(req.params.enrollmentId || "");
  if (!Number.isFinite(internshipId) || !enrollmentId) return res.status(400).json({ error: "invalid_request" });

  const actor = req.auth?.userId ? String(req.auth.userId) : null;
  const enrollment = await prisma.internshipEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment || enrollment.internshipId !== internshipId) return res.status(404).json({ error: "not_found" });

  const before = enrollment as any;
  const updated = await prisma.internshipEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "TERMINATED" as any,
      accessMode: "READ_ONLY" as any,
      terminatedAt: new Date(),
    } as any,
  });

  if (actor) {
    prisma.auditLog
      .create({
        data: {
          actorUserId: actor,
          action: "INTERNSHIP_ENROLLMENT_TERMINATE",
          entityType: "InternshipEnrollment",
          entityId: enrollmentId,
          before,
          after: updated as any,
        },
      })
      .catch(() => {});
  }

  return res.json({ ok: true, enrollment: updated });
});

router.post("/:id/admin/enrollments/:enrollmentId/dates", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const enrollmentId = String(req.params.enrollmentId || "");
  if (!Number.isFinite(internshipId) || !enrollmentId) return res.status(400).json({ error: "invalid_request" });

  const actor = req.auth?.userId ? String(req.auth.userId) : null;

  const enrollment = await prisma.internshipEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment || enrollment.internshipId !== internshipId) return res.status(404).json({ error: "not_found" });

  const startDate = req.body?.startDate ? new Date(req.body.startDate) : null;
  const endDate = req.body?.endDate ? new Date(req.body.endDate) : null;
  if (!startDate || !endDate || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return res.status(400).json({ error: "invalid_dates" });
  }

  const before = enrollment as any;
  const updated = await prisma.internshipEnrollment.update({
    where: { id: enrollmentId },
    data: { startDate, endDate } as any,
  });

  if (actor) {
    prisma.auditLog
      .create({
        data: {
          actorUserId: actor,
          action: "INTERNSHIP_ENROLLMENT_UPDATE_DATES",
          entityType: "InternshipEnrollment",
          entityId: enrollmentId,
          before,
          after: updated as any,
        },
      })
      .catch(() => {});
  }

  return res.json({ ok: true, enrollment: updated });
});

router.get("/:id/me", requireAuth, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });

  const userId = req.auth.userId as string;

  const internship = await prisma.internship.findUnique({ where: { id: internshipId } });
  if (!internship) return res.status(404).json({ error: "not_found" });

  const enrollment = await prisma.internshipEnrollment.findUnique({
    where: { internshipId_userId: { internshipId, userId } },
  });

  const application = await prisma.internshipApplication.findFirst({
    where: { internshipId, userId },
    orderBy: { createdAt: "desc" },
  });

  if (!enrollment) {
    return res.json({
      internship,
      enrolled: false,
      application,
    });
  }

  const tasks = await prisma.internshipTask.findMany({
    where: { internshipId },
    orderBy: [{ week: "asc" }, { createdAt: "asc" }],
  });

  const submissions = await prisma.internshipSubmission.findMany({
    where: { userId, task: { internshipId } },
  });

  const submissionByTask = new Map(submissions.map((s) => [s.taskId, s]));
  const totalXP = tasks.reduce((sum, t) => sum + t.xpReward, 0);
  const earnedXP = tasks.reduce((sum, t) => sum + (submissionByTask.has(t.id) ? t.xpReward : 0), 0);
  const completedCount = tasks.reduce((sum, t) => sum + (submissionByTask.has(t.id) ? 1 : 0), 0);
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return res.json({
    internship,
    enrolled: true,
    enrollment: {
      ...enrollment,
      progress,
      totalXP,
      earnedXP,
    },
    tasks: tasks.map((t) => {
      const s = submissionByTask.get(t.id);
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        xpReward: t.xpReward,
        week: t.week,
        attachment: t.attachmentType && t.attachmentUrl ? { type: t.attachmentType, url: t.attachmentUrl, name: t.attachmentName } : null,
        submission: s
          ? {
              type: s.type,
              content: s.content,
              fileName: s.fileName,
              notes: s.notes || "",
              submittedAt: s.submittedAt.toISOString(),
            }
          : null,
      };
    }),
  });
});

router.get("/me/enrollments", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;

  const rows = await prisma.internshipEnrollment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { internshipId: true, createdAt: true },
  });

  const internshipIds = rows.map((r) => r.internshipId);
  if (!internshipIds.length) return res.json({ enrollments: [] });

  const internships = await prisma.internship.findMany({
    where: { id: { in: internshipIds } },
    select: { id: true, title: true, company: true, type: true },
  });
  const internshipById = new Map<number, any>(internships.map((i) => [i.id, i]));

  const tasksCounts = await prisma.internshipTask.groupBy({
    by: ["internshipId"],
    where: { internshipId: { in: internshipIds } },
    _count: { _all: true },
  });
  const totalTasksByInternship = new Map<number, number>(tasksCounts.map((r) => [r.internshipId, r._count._all]));

  const submissions = await prisma.internshipSubmission.findMany({
    where: { userId, task: { internshipId: { in: internshipIds } } },
    select: { task: { select: { internshipId: true } } },
  });
  const submittedByInternship = new Map<number, number>();
  for (const s of submissions as any[]) {
    const iid = Number(s?.task?.internshipId);
    if (!Number.isFinite(iid)) continue;
    submittedByInternship.set(iid, (submittedByInternship.get(iid) || 0) + 1);
  }

  const enrollments = rows
    .map((r) => {
      const internship = internshipById.get(r.internshipId);
      if (!internship) return null;
      const totalTasks = totalTasksByInternship.get(r.internshipId) || 0;
      const tasksCompleted = submittedByInternship.get(r.internshipId) || 0;
      const progress = totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0;
      return {
        id: internship.id,
        title: internship.title,
        company: internship.company,
        type: internship.type,
        enrolledDate: r.createdAt.toISOString().slice(0, 10),
        progress,
        tasksCompleted,
        totalTasks,
      };
    })
    .filter(Boolean);

  return res.json({ enrollments });
});

router.post("/:id/tasks/:taskId/submit", requireAuth, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const taskId = String(req.params.taskId);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });

  const userId = req.auth.userId as string;

  recordUserActivity(userId).catch(() => {});

  const enrollment = await prisma.internshipEnrollment.findUnique({
    where: { internshipId_userId: { internshipId, userId } },
  });
  if (!enrollment) return res.status(403).json({ error: "not_enrolled" });

  const task = await prisma.internshipTask.findUnique({ where: { id: taskId } });
  if (!task || task.internshipId !== internshipId) return res.status(404).json({ error: "task_not_found" });

  const existing = await prisma.internshipSubmission.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });

  if (existing) {
    return res.json({ ok: true, alreadySubmitted: true });
  }

  const submission = await prisma.internshipSubmission.create({
    data: {
      taskId,
      userId,
      type: req.body?.type,
      content: req.body?.content,
      fileName: req.body?.fileName ?? null,
      notes: req.body?.notes ?? null,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: task.xpReward } },
  });

  return res.json({ ok: true, submissionId: submission.id });
});

export default router;
