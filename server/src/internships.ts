import { Router } from "express";
import nodemailer from "nodemailer";
import { randomBytes } from "crypto";
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

function pdfPlaceholderBytes(label: string = "PLACEHOLDER PDF") {
  const safeLabel = label.replace(/[()\\]/g, "");
  const content = `BT /F1 28 Tf 120 420 Td (${safeLabel}) Tj ET\n`;
  const contentLength = Buffer.byteLength(content, "utf8");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${contentLength} >>\nstream\n${content}endstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let offset = Buffer.byteLength("%PDF-1.4\n", "utf8");
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(offset);
    offset += Buffer.byteLength(obj, "utf8");
  }

  const xrefOffset = offset;
  const xrefLines = ["xref\n", `0 ${offsets.length}\n`, "0000000000 65535 f \n"];
  for (let i = 1; i < offsets.length; i += 1) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }

  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const raw = `%PDF-1.4\n${objects.join("")}${xrefLines.join("")}${trailer}`;
  return Buffer.from(raw, "utf8");
}

async function generateCertificateCode(now: Date = new Date()) {
  const year = now.getFullYear();
  for (let i = 0; i < 10; i++) {
    const rand = randomBytes(3).toString("hex").toUpperCase();
    const code = `CERT-${year}-${rand}`;
    const exists = await prisma.internshipCertificate.findUnique({ where: { certificateCode: code } });
    if (!exists) return code;
  }
  return `CERT-${now.getFullYear()}-${randomBytes(8).toString("hex").toUpperCase()}`;
}

async function maybeIssueLegacyCertificate(internshipId: number, userId: string) {
  const enrollment = await prisma.internshipEnrollment.findUnique({ where: { internshipId_userId: { internshipId, userId } } });
  if (!enrollment) return null;

  const now = new Date();

  const existing = await prisma.internshipCertificate.findUnique({ where: { enrollmentId: enrollment.id } });
  if (existing) return existing;

  const tasksCount = await prisma.internshipTask.count({ where: { internshipId } });
  if (tasksCount <= 0) return null;

  const completedCount = await prisma.internshipSubmission.count({ where: { userId, task: { internshipId } } });
  const completionPercent = Math.round((completedCount / tasksCount) * 100);
  if (completionPercent < 80) return null;

  const lastSubmission = await prisma.internshipSubmission.findFirst({
    where: { userId, task: { internshipId } },
    orderBy: { submittedAt: "desc" },
    select: { submittedAt: true },
  });

  seedAssignmentsForEnrollment(enrollment.id).catch(() => {});

  const lastAt = lastSubmission?.submittedAt instanceof Date ? lastSubmission.submittedAt : lastSubmission?.submittedAt ? new Date(lastSubmission.submittedAt as any) : null;
  if (!lastAt) return null;
  if (lastAt.getTime() < enrollment.startDate.getTime()) return null;
  if (lastAt.getTime() > enrollment.endDate.getTime()) return null;

  const certificateCode = await generateCertificateCode(now);
  const pdf = pdfPlaceholderBytes();
  const file = await prisma.storedFile.create({
    data: {
      purpose: "CERTIFICATE" as any,
      fileName: `certificate-${certificateCode}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: pdf.length,
      bytes: pdf,
    } as any,
  });

  const qrPayload = `CERT:${certificateCode}`;

  const cert = await prisma.internshipCertificate.create({
    data: {
      internshipId,
      enrollmentId: enrollment.id,
      certificateCode,
      status: "VALID" as any,
      fileId: file.id,
      qrPayload,
    } as any,
  });

  prisma.internshipEnrollment
    .update({
      where: { id: enrollment.id },
      data: {
        status: "COMPLETED" as any,
        accessMode: "READ_ONLY" as any,
        readOnlyAt: new Date(),
      } as any,
    })
    .catch(() => {});

  const cfg = getSmtpConfig();
  if (cfg) {
    try {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      const to = String(u?.email || "").trim();
      if (to) {
        const transporter = nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          auth: { user: cfg.user, pass: cfg.pass },
        });

        await transporter.sendMail({
          from: cfg.from,
          to,
          subject: `Internship Completion Certificate (${certificateCode})`,
          html: `<p>Hi ${String(u?.name || "there")},</p><p>Congratulations! Your internship completion certificate is attached.</p><p>Certificate ID: <strong>${certificateCode}</strong></p><p>Thanks,<br/>Grovix</p>`,
          attachments: [
            {
              filename: `certificate-${certificateCode}.pdf`,
              content: pdf,
              contentType: "application/pdf",
            },
          ],
        });
      }
    } catch {
    }
  }

  return cert;
}

export async function lockExpiredAssignments(enrollmentId: string, now: Date = new Date()) {
  await prisma.internshipTaskAssignment.updateMany({
    where: {
      enrollmentId,
      lockedAt: null,
      passedAt: null,
      deadlineAt: { not: null, lte: now } as any,
      status: { in: ["ASSIGNED", "IN_PROGRESS", "GRADED"] as any } as any,
    } as any,
    data: {
      lockedAt: now,
      status: "LOCKED" as any,
    } as any,
  });

  await prisma.internshipTaskAssignment.updateMany({
    where: {
      enrollmentId,
      lockedAt: null,
      passedAt: null,
      deadlineAt: { not: null, lte: now } as any,
      status: "SUBMITTED" as any,
    } as any,
    data: {
      lockedAt: now,
    } as any,
  });
}

export async function maybeIssueV2CertificateByEnrollment(enrollmentId: string) {
  const enrollment = await prisma.internshipEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) return null;
  if ((enrollment as any).status === "TERMINATED") return null;

  const existing = await prisma.internshipCertificate.findUnique({ where: { enrollmentId: enrollment.id } });
  if (existing) return existing;

  const assignments = await prisma.internshipTaskAssignment.findMany({
    where: {
      enrollmentId: enrollment.id,
      status: { not: "SKIPPED" as any } as any,
    } as any,
    include: { template: { select: { xpReward: true } } },
  });

  if (!assignments.length) return null;

  const passedCount = assignments.reduce((n: number, a: any) => n + (a.passedAt ? 1 : 0), 0);
  const completionPercent = Math.round((passedCount / assignments.length) * 100);
  if (completionPercent < 80) return null;

  const lastPassedAtMs = assignments.reduce((max: number, a: any) => {
    const t = a.passedAt ? new Date(a.passedAt as any).getTime() : 0;
    return t > max ? t : max;
  }, 0);
  if (!lastPassedAtMs) return null;

  const startMs = new Date(enrollment.startDate as any).getTime();
  const endMs = new Date(enrollment.endDate as any).getTime();
  if (lastPassedAtMs < startMs) return null;
  if (lastPassedAtMs > endMs) return null;

  const certificateCode = await generateCertificateCode(new Date());
  const pdf = pdfPlaceholderBytes();
  const file = await prisma.storedFile.create({
    data: {
      purpose: "CERTIFICATE" as any,
      fileName: `certificate-${certificateCode}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: pdf.length,
      bytes: pdf,
    } as any,
  });

  const qrPayload = `CERT:${certificateCode}`;

  const cert = await prisma.internshipCertificate.create({
    data: {
      internshipId: enrollment.internshipId,
      enrollmentId: enrollment.id,
      certificateCode,
      status: "VALID" as any,
      fileId: file.id,
      qrPayload,
    } as any,
  });

  prisma.internshipEnrollment
    .update({
      where: { id: enrollment.id },
      data: {
        status: "COMPLETED" as any,
        accessMode: "READ_ONLY" as any,
        readOnlyAt: new Date(),
      } as any,
    })
    .catch(() => {});

  const cfg = getSmtpConfig();
  if (cfg) {
    try {
      const u = await prisma.user.findUnique({ where: { id: enrollment.userId }, select: { email: true, name: true } });
      const to = String(u?.email || "").trim();
      if (to) {
        const transporter = nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          auth: { user: cfg.user, pass: cfg.pass },
        });

        await transporter.sendMail({
          from: cfg.from,
          to,
          subject: `Internship Completion Certificate (${certificateCode})`,
          html: `<p>Hi ${String(u?.name || "there")},</p><p>Congratulations! Your internship completion certificate is attached.</p><p>Certificate ID: <strong>${certificateCode}</strong></p><p>Thanks,<br/>Grovix</p>`,
          attachments: [
            {
              filename: `certificate-${certificateCode}.pdf`,
              content: pdf,
              contentType: "application/pdf",
            },
          ],
        });
      }
    } catch {
    }
  }

  return cert;
}

export async function seedAssignmentsForEnrollment(enrollmentId: string) {
  const enrollment = await prisma.internshipEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) return;

  const templates = await prisma.internshipTaskTemplate.findMany({
    where: { internshipId: enrollment.internshipId, badgeLevel: enrollment.currentBadge as any },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (!templates.length) return;

  const start = enrollment.startDate instanceof Date ? enrollment.startDate : new Date(enrollment.startDate as any);

  const templateIds = (templates as any[]).map((t) => String(t.id));
  const existing = await prisma.internshipTaskAssignment.findMany({
    where: {
      enrollmentId,
      templateId: { in: templateIds } as any,
    } as any,
    select: { templateId: true },
  });
  const existingSet = new Set(existing.map((e: any) => String(e.templateId)));

  const toCreate: any[] = [];
  for (const t of templates as any[]) {
    if (existingSet.has(String(t.id))) continue;
    const offsetDays = t.unlockOffsetDays === null || t.unlockOffsetDays === undefined ? null : Number(t.unlockOffsetDays);
    const periodDays = t.timePeriodDays === null || t.timePeriodDays === undefined ? null : Number(t.timePeriodDays);

    const unlockAt = offsetDays !== null && Number.isFinite(offsetDays)
      ? new Date(start.getTime() + offsetDays * 24 * 60 * 60 * 1000)
      : null;

    const deadlineAt = unlockAt && periodDays !== null && Number.isFinite(periodDays)
      ? new Date(unlockAt.getTime() + periodDays * 24 * 60 * 60 * 1000)
      : null;

    const maxAttempts = Math.max(1, Number(t.maxAttempts || 1) || 1);

    toCreate.push({
      enrollmentId,
      templateId: t.id,
      unlockAt,
      deadlineAt,
      maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts),
      status: "ASSIGNED" as any,
    });
  }

  if (!toCreate.length) return;

  await prisma.internshipTaskAssignment.createMany({
    data: toCreate as any,
    skipDuplicates: true,
  } as any);
}

export async function recomputeAssignmentScheduleForEnrollment(enrollmentId: string) {
  const enrollment = await prisma.internshipEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) return;

  const start = enrollment.startDate instanceof Date ? enrollment.startDate : new Date(enrollment.startDate as any);

  const assignments = await prisma.internshipTaskAssignment.findMany({
    where: {
      enrollmentId,
      status: "ASSIGNED" as any,
      passedAt: null,
      lockedAt: null,
    } as any,
    include: {
      template: { select: { unlockOffsetDays: true, timePeriodDays: true, maxAttempts: true } },
      attempts: { select: { id: true }, take: 1 },
    },
    take: 500,
  });

  for (const a of assignments as any[]) {
    if (a.attempts && a.attempts.length > 0) continue;

    const offsetDays = a.template?.unlockOffsetDays === null || a.template?.unlockOffsetDays === undefined ? null : Number(a.template.unlockOffsetDays);
    const periodDays = a.template?.timePeriodDays === null || a.template?.timePeriodDays === undefined ? null : Number(a.template.timePeriodDays);

    const unlockAt = offsetDays !== null && Number.isFinite(offsetDays)
      ? new Date(start.getTime() + offsetDays * 24 * 60 * 60 * 1000)
      : null;

    const deadlineAt = unlockAt && periodDays !== null && Number.isFinite(periodDays)
      ? new Date(unlockAt.getTime() + periodDays * 24 * 60 * 60 * 1000)
      : null;

    const nextUnlockMs = unlockAt ? unlockAt.getTime() : null;
    const nextDeadlineMs = deadlineAt ? deadlineAt.getTime() : null;
    const curUnlockMs = a.unlockAt ? new Date(a.unlockAt as any).getTime() : null;
    const curDeadlineMs = a.deadlineAt ? new Date(a.deadlineAt as any).getTime() : null;

    if (nextUnlockMs === curUnlockMs && nextDeadlineMs === curDeadlineMs) continue;

    await prisma.internshipTaskAssignment.update({
      where: { id: a.id },
      data: {
        unlockAt,
        deadlineAt,
      } as any,
    });
  }
}

const badgeOrder: Record<string, number> = {
  BEGINNER: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
  EXPERT: 3,
};

export async function evaluateAndPromoteBadge(enrollmentId: string, actorUserId?: string | null) {
  const enrollment = await prisma.internshipEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) return null;

  const rules = await prisma.internshipBadgeRule.findMany({
    where: { internshipId: enrollment.internshipId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (!rules.length) return null;

  const assignments = await prisma.internshipTaskAssignment.findMany({
    where: { enrollmentId },
    include: { template: { select: { xpReward: true } } },
  });

  const total = assignments.length;
  const passed = assignments.reduce((n: number, a: any) => n + (a.passedAt ? 1 : 0), 0);
  const completionPercent = total > 0 ? Math.round((passed / total) * 100) : 0;
  const earnedXp = assignments.reduce((sum: number, a: any) => sum + (a.passedAt ? Number(a.template?.xpReward || 0) || 0 : 0), 0);

  let bestLevel: string | null = null;
  for (const r of rules as any[]) {
    const minPct = Number(r.minCompletionPercent || 0) || 0;
    const minXp = Number(r.minXp || 0) || 0;
    if (completionPercent >= minPct && earnedXp >= minXp) {
      bestLevel = String(r.level);
    }
  }

  if (!bestLevel) return null;

  const current = String((enrollment as any).currentBadge || "BEGINNER");
  const currentRank = badgeOrder[current] ?? 0;
  const bestRank = badgeOrder[bestLevel] ?? currentRank;
  if (bestRank <= currentRank) return null;

  const before = enrollment as any;

  const updated = await prisma.internshipEnrollment.update({
    where: { id: enrollmentId },
    data: { currentBadge: bestLevel as any } as any,
  });

  if (actorUserId) {
    prisma.auditLog
      .create({
        data: {
          actorUserId,
          action: "INTERNSHIP_BADGE_PROMOTE",
          entityType: "InternshipEnrollment",
          entityId: enrollmentId,
          before,
          after: updated as any,
        },
      })
      .catch(() => {});
  }

  await seedAssignmentsForEnrollment(enrollmentId);
  return updated;
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

router.get("/admin/v2/stats", requireAdmin, async (_req: any, res) => {
  const [pendingAttempts, lockedAssignments, activeEnrollments, pendingApplications] = await Promise.all([
    prisma.internshipTaskAttempt.count({ where: { gradeStatus: "PENDING" as any } as any }),
    prisma.internshipTaskAssignment.count({ where: { status: "LOCKED" as any } as any }),
    prisma.internshipEnrollment.count({ where: { status: "ACTIVE" as any } as any }),
    prisma.internshipApplication.count({ where: { status: "pending" as any } as any }),
  ]);

  return res.json({
    ok: true,
    stats: {
      pendingAttempts,
      lockedAssignments,
      activeEnrollments,
      pendingApplications,
    },
  });
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

router.post("/:id/admin/enrollments/:enrollmentId/certificate/revoke", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const enrollmentId = String(req.params.enrollmentId || "");
  if (!Number.isFinite(internshipId) || !enrollmentId) return res.status(400).json({ error: "invalid_request" });

  const actor = req.auth?.userId ? String(req.auth.userId) : null;

  const enrollment = await prisma.internshipEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment || enrollment.internshipId !== internshipId) return res.status(404).json({ error: "not_found" });

  const cert = await prisma.internshipCertificate.findUnique({ where: { enrollmentId } });
  if (!cert) return res.status(404).json({ error: "no_certificate" });

  const before = cert as any;
  const updated = await prisma.internshipCertificate.update({
    where: { id: cert.id },
    data: { status: "REVOKED" as any } as any,
  });

  if (actor) {
    prisma.auditLog
      .create({
        data: {
          actorUserId: actor,
          action: "INTERNSHIP_CERTIFICATE_REVOKE",
          entityType: "InternshipCertificate",
          entityId: cert.id,
          before,
          after: updated as any,
        },
      })
      .catch(() => {});
  }

  return res.json({ ok: true, certificate: updated });
});

router.post("/:id/admin/enrollments/:enrollmentId/certificate/restore", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const enrollmentId = String(req.params.enrollmentId || "");
  if (!Number.isFinite(internshipId) || !enrollmentId) return res.status(400).json({ error: "invalid_request" });

  const actor = req.auth?.userId ? String(req.auth.userId) : null;

  const enrollment = await prisma.internshipEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment || enrollment.internshipId !== internshipId) return res.status(404).json({ error: "not_found" });

  const cert = await prisma.internshipCertificate.findUnique({ where: { enrollmentId } });
  if (!cert) return res.status(404).json({ error: "no_certificate" });

  const before = cert as any;
  const updated = await prisma.internshipCertificate.update({
    where: { id: cert.id },
    data: { status: "VALID" as any } as any,
  });

  if (actor) {
    prisma.auditLog
      .create({
        data: {
          actorUserId: actor,
          action: "INTERNSHIP_CERTIFICATE_RESTORE",
          entityType: "InternshipCertificate",
          entityId: cert.id,
          before,
          after: updated as any,
        },
      })
      .catch(() => {});
  }

  return res.json({ ok: true, certificate: updated });
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

  const batch = await prisma.internshipBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.internshipId !== internshipId) return res.status(400).json({ error: "invalid_batch" });

  const now = Date.now();
  const status = String((batch as any).status || "").toUpperCase();
  if (status && status !== "OPEN") return res.status(403).json({ error: "batch_not_open" });

  const openAt = batch.applicationOpenAt ? new Date(batch.applicationOpenAt).getTime() : null;
  const closeAt = batch.applicationCloseAt ? new Date(batch.applicationCloseAt).getTime() : null;
  if (openAt !== null && openAt > now) return res.status(403).json({ error: "applications_not_open" });
  if (closeAt !== null && closeAt < now) return res.status(403).json({ error: "applications_closed" });

  const capacity = batch.capacity === null || batch.capacity === undefined ? null : Number(batch.capacity);
  if (capacity !== null && Number.isFinite(capacity) && capacity > 0) {
    const activeEnrollments = await prisma.internshipEnrollment.count({
      where: {
        internshipId,
        batchId,
        NOT: [{ status: "TERMINATED" as any }],
      } as any,
    });
    if (activeEnrollments >= capacity) return res.status(403).json({ error: "batch_full" });
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

  seedAssignmentsForEnrollment(enrollment.id).catch(() => {});

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

router.get("/:id/v2/dashboard", requireAuth, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });
  const userId = req.auth.userId as string;

  const enrollment = await prisma.internshipEnrollment.findUnique({
    where: { internshipId_userId: { internshipId, userId } },
    include: {
      batch: true,
    },
  });

  if (!enrollment) return res.status(403).json({ error: "not_enrolled" });
  if ((enrollment as any).status === "TERMINATED") return res.status(403).json({ error: "terminated" });

  lockExpiredAssignments(enrollment.id).catch(() => {});
  maybeIssueV2CertificateByEnrollment(enrollment.id).catch(() => {});

  const certificate = await prisma.internshipCertificate.findUnique({
    where: { enrollmentId: enrollment.id },
    select: { id: true, certificateCode: true, status: true, issuedAt: true, fileId: true, qrPayload: true },
  });

  const now = Date.now();

  const startAtMs = enrollment.startDate ? new Date(enrollment.startDate as any).getTime() : null;
  const endAtMs = enrollment.endDate ? new Date(enrollment.endDate as any).getTime() : null;
  const enrollmentActive =
    (enrollment as any).status === "ACTIVE" &&
    (enrollment as any).accessMode !== "READ_ONLY" &&
    (startAtMs === null || startAtMs <= now) &&
    (endAtMs === null || endAtMs >= now);

  const assignments = await prisma.internshipTaskAssignment.findMany({
    where: { enrollmentId: enrollment.id },
    orderBy: [{ unlockAt: "asc" }, { createdAt: "asc" }],
    include: {
      template: true,
      attempts: { orderBy: { attemptNo: "desc" }, take: 1 },
    },
  });

  return res.json({
    ok: true,
    enrollment: {
      id: enrollment.id,
      internshipId: enrollment.internshipId,
      batchId: enrollment.batchId,
      status: (enrollment as any).status,
      accessMode: (enrollment as any).accessMode,
      startDate: enrollment.startDate.toISOString(),
      endDate: enrollment.endDate.toISOString(),
      currentBadge: (enrollment as any).currentBadge,
    },
    certificate: certificate
      ? {
          ...certificate,
          issuedAt: certificate.issuedAt.toISOString(),
          pdfUrl: certificate.status === "VALID" ? `/certificates/${encodeURIComponent(certificate.certificateCode)}/pdf` : null,
        }
      : null,
    assignments: (assignments as any[]).map((a) => {
      const unlockAt = a.unlockAt ? new Date(a.unlockAt).getTime() : null;
      const deadlineAt = a.deadlineAt ? new Date(a.deadlineAt).getTime() : null;
      const statusStr = String(a.status || "");
      const locked =
        statusStr === "LOCKED" ||
        (a.lockedAt && new Date(a.lockedAt).getTime() <= now) ||
        (deadlineAt !== null && deadlineAt <= now);

      const latestAttempt = a.attempts?.[0] || null;
      const pendingReview = !!latestAttempt && String(latestAttempt.gradeStatus || "") === "PENDING";
      const skipped = statusStr === "SKIPPED";
      const passed = !!a.passedAt || String(a.latestGradeStatus || "") === "PASSED";
      const unlockNotReached = unlockAt !== null && unlockAt > now;

      const canStart =
        enrollmentActive &&
        !skipped &&
        !passed &&
        !locked &&
        !unlockNotReached &&
        statusStr === "ASSIGNED";

      const canSubmit =
        enrollmentActive &&
        !skipped &&
        !passed &&
        !locked &&
        !unlockNotReached &&
        !pendingReview &&
        statusStr !== "SUBMITTED" &&
        (Number(a.remainingAttempts || 0) || 0) > 0;

      return {
        id: a.id,
        status: a.status,
        unlockAt: a.unlockAt ? new Date(a.unlockAt).toISOString() : null,
        deadlineAt: a.deadlineAt ? new Date(a.deadlineAt).toISOString() : null,
        locked,
        canStart,
        canSubmit,
        maxAttempts: a.maxAttempts,
        remainingAttempts: a.remainingAttempts,
        latestGradeStatus: a.latestGradeStatus,
        passedAt: a.passedAt ? new Date(a.passedAt).toISOString() : null,
        template: {
          id: a.template.id,
          title: a.template.title,
          description: a.template.description,
          xpReward: a.template.xpReward,
          badgeLevel: a.template.badgeLevel,
          rubricJson: a.template.rubricJson,
          autoPass: a.template.autoPass,
        },
        latestAttempt: latestAttempt
          ? {
              id: latestAttempt.id,
              attemptNo: latestAttempt.attemptNo,
              submittedAt: latestAttempt.submittedAt.toISOString(),
              gradeStatus: latestAttempt.gradeStatus,
              feedback: latestAttempt.feedback,
            }
          : null,
      };
    }),
  });
});

router.post("/:id/v2/assignments/:assignmentId/attempts", requireAuth, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const assignmentId = String(req.params.assignmentId || "");
  if (!Number.isFinite(internshipId) || !assignmentId) return res.status(400).json({ error: "invalid_request" });

  const userId = req.auth.userId as string;
  const now = Date.now();

  const assignment = await prisma.internshipTaskAssignment.findUnique({
    where: { id: assignmentId },
    include: { enrollment: true, template: true },
  });
  if (!assignment) return res.status(404).json({ error: "not_found" });
  if (assignment.enrollment.internshipId !== internshipId) return res.status(400).json({ error: "invalid_internship" });
  if (assignment.enrollment.userId !== userId) return res.status(403).json({ error: "forbidden" });

  const enrollmentStatus = String((assignment.enrollment as any).status || "");
  if (enrollmentStatus === "TERMINATED") return res.status(403).json({ error: "terminated" });
  if (enrollmentStatus === "FROZEN") return res.status(403).json({ error: "frozen" });
  if (enrollmentStatus === "COMPLETED") return res.status(403).json({ error: "completed" });
  if ((assignment.enrollment as any).accessMode === "READ_ONLY") return res.status(403).json({ error: "read_only" });

  if (String((assignment as any).status) === "SKIPPED") return res.status(403).json({ error: "skipped" });
  if (String((assignment as any).status) === "LOCKED") return res.status(403).json({ error: "locked" });

  const startAt = assignment.enrollment.startDate ? new Date(assignment.enrollment.startDate as any).getTime() : null;
  const endAt = assignment.enrollment.endDate ? new Date(assignment.enrollment.endDate as any).getTime() : null;
  if (startAt !== null && startAt > now) return res.status(403).json({ error: "enrollment_not_started" });
  if (endAt !== null && endAt < now) return res.status(403).json({ error: "enrollment_ended" });

  const unlockAt = assignment.unlockAt ? new Date(assignment.unlockAt).getTime() : null;
  if (unlockAt !== null && unlockAt > now) return res.status(403).json({ error: "locked" });

  const deadlineAt = assignment.deadlineAt ? new Date(assignment.deadlineAt).getTime() : null;
  if (deadlineAt !== null && deadlineAt <= now) {
    lockExpiredAssignments(assignment.enrollmentId).catch(() => {});
    return res.status(403).json({ error: "deadline_passed" });
  }

  if (assignment.remainingAttempts <= 0) return res.status(403).json({ error: "no_attempts_left" });

  if (assignment.passedAt || String((assignment as any).latestGradeStatus || "") === "PASSED") {
    return res.status(403).json({ error: "already_passed" });
  }

  const latestAttempt = await prisma.internshipTaskAttempt.findFirst({
    where: { assignmentId },
    orderBy: { attemptNo: "desc" },
    select: { id: true, gradeStatus: true },
  });
  if (latestAttempt && String((latestAttempt as any).gradeStatus || "") === "PENDING") {
    return res.status(403).json({ error: "pending_review" });
  }

  const type = String(req.body?.type || "TEXT");
  const content = String(req.body?.content || "");
  const notes = req.body?.notes ? String(req.body.notes) : null;

  if (!content.trim()) return res.status(400).json({ error: "invalid_content" });

  let fileId: string | null = null;
  let fileName: string | null = null;

  const file = req.body?.file;
  if (file && file.bytesB64 && file.mimeType) {
    const bytes = Buffer.from(String(file.bytesB64), "base64");
    const name = String(file.fileName || "submission");
    const mimeType = String(file.mimeType || "application/octet-stream");
    const stored = await prisma.storedFile.create({
      data: {
        purpose: "TASK_SUBMISSION" as any,
        fileName: name,
        mimeType,
        sizeBytes: bytes.length,
        bytes,
      } as any,
    });
    fileId = stored.id;
    fileName = name;
  }

  const prevAttempts = await prisma.internshipTaskAttempt.count({ where: { assignmentId } });
  const attemptNo = prevAttempts + 1;

  const isAutoPass = !!(assignment.template as any)?.autoPass;
  const actor = userId;
  const autoGradeAt = isAutoPass ? new Date() : null;
  const autoGradeStatus = isAutoPass ? ("PASSED" as any) : ("PENDING" as any);

  const attempt = await prisma.internshipTaskAttempt.create({
    data: {
      assignmentId,
      attemptNo,
      status: attemptNo > 1 ? ("RESUBMITTED" as any) : ("SUBMITTED" as any),
      type,
      content,
      fileId,
      fileName,
      notes,
      gradeStatus: autoGradeStatus,
      ...(isAutoPass
        ? {
            gradedAt: autoGradeAt,
            gradedBy: actor,
          }
        : {}),
    } as any,
  });

  const updatedAssignment = await prisma.internshipTaskAssignment.update({
    where: { id: assignmentId },
    data: {
      remainingAttempts: Math.max(0, assignment.remainingAttempts - 1),
      status: isAutoPass ? ("GRADED" as any) : ("SUBMITTED" as any),
      ...(isAutoPass
        ? {
            latestGradeStatus: "PASSED" as any,
            passedAt: autoGradeAt,
          }
        : {}),
    } as any,
  });

  if (isAutoPass) {
    const xp = Number((assignment.template as any)?.xpReward || 0) || 0;
    if (xp > 0) {
      prisma.user.update({ where: { id: userId }, data: { xp: { increment: xp } } }).catch(() => {});
    }

    evaluateAndPromoteBadge(String(assignment.enrollmentId), actor).catch(() => {});
    maybeIssueV2CertificateByEnrollment(String(assignment.enrollmentId)).catch(() => {});
  }

  return res.json({ ok: true, attempt, assignment: updatedAssignment });
});

router.post("/:id/v2/assignments/:assignmentId/start", requireAuth, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const assignmentId = String(req.params.assignmentId || "");
  if (!Number.isFinite(internshipId) || !assignmentId) return res.status(400).json({ error: "invalid_request" });

  const userId = req.auth.userId as string;
  const now = Date.now();

  const assignment = await prisma.internshipTaskAssignment.findUnique({
    where: { id: assignmentId },
    include: { enrollment: true },
  });
  if (!assignment) return res.status(404).json({ error: "not_found" });
  if (assignment.enrollment.internshipId !== internshipId) return res.status(400).json({ error: "invalid_internship" });
  if (assignment.enrollment.userId !== userId) return res.status(403).json({ error: "forbidden" });

  const enrollmentStatus = String((assignment.enrollment as any).status || "");
  if (enrollmentStatus === "TERMINATED") return res.status(403).json({ error: "terminated" });
  if (enrollmentStatus === "FROZEN") return res.status(403).json({ error: "frozen" });
  if (enrollmentStatus === "COMPLETED") return res.status(403).json({ error: "completed" });
  if ((assignment.enrollment as any).accessMode === "READ_ONLY") return res.status(403).json({ error: "read_only" });

  if (String((assignment as any).status) === "SKIPPED") return res.status(403).json({ error: "skipped" });
  if (String((assignment as any).status) === "LOCKED") return res.status(403).json({ error: "locked" });

  if (assignment.passedAt || String((assignment as any).latestGradeStatus || "") === "PASSED") {
    return res.status(403).json({ error: "already_passed" });
  }

  const startAt = assignment.enrollment.startDate ? new Date(assignment.enrollment.startDate as any).getTime() : null;
  const endAt = assignment.enrollment.endDate ? new Date(assignment.enrollment.endDate as any).getTime() : null;
  if (startAt !== null && startAt > now) return res.status(403).json({ error: "enrollment_not_started" });
  if (endAt !== null && endAt < now) return res.status(403).json({ error: "enrollment_ended" });

  const unlockAt = assignment.unlockAt ? new Date(assignment.unlockAt).getTime() : null;
  if (unlockAt !== null && unlockAt > now) return res.status(403).json({ error: "locked" });

  const deadlineAt = assignment.deadlineAt ? new Date(assignment.deadlineAt).getTime() : null;
  if (deadlineAt !== null && deadlineAt <= now) {
    lockExpiredAssignments(assignment.enrollmentId).catch(() => {});
    return res.status(403).json({ error: "deadline_passed" });
  }

  if (String((assignment as any).status) !== "ASSIGNED") {
    return res.json({ ok: true, assignment });
  }

  const updated = await prisma.internshipTaskAssignment.update({
    where: { id: assignmentId },
    data: { status: "IN_PROGRESS" as any } as any,
  });

  return res.json({ ok: true, assignment: updated });
});

router.get("/:id/admin/v2/badge-rules", requireAdmin, async (req, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });

  const rows = await prisma.internshipBadgeRule.findMany({
    where: { internshipId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return res.json({ rules: rows });
});

router.post("/:id/admin/v2/badge-rules", requireAdmin, async (req, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });

  const level = String(req.body?.level || "BEGINNER").toUpperCase();
  const minCompletionPercent = Math.max(0, Math.min(100, Number(req.body?.minCompletionPercent || 0) || 0));
  const minXp = Math.max(0, Number(req.body?.minXp || 0) || 0);
  const sortOrder = Number(req.body?.sortOrder || 0) || 0;

  const allowed = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
  if (!allowed.includes(level)) return res.status(400).json({ error: "invalid_level" });

  const existing = await prisma.internshipBadgeRule.findUnique({
    where: { internshipId_level: { internshipId, level: level as any } },
  });
  if (existing) return res.status(409).json({ error: "rule_exists" });

  const rule = await prisma.internshipBadgeRule.create({
    data: {
      internshipId,
      level: level as any,
      minCompletionPercent,
      minXp,
      sortOrder,
    } as any,
  });

  return res.json({ ok: true, rule });
});

router.put("/:id/admin/v2/badge-rules/:ruleId", requireAdmin, async (req, res) => {
  const internshipId = Number(req.params.id);
  const ruleId = String(req.params.ruleId || "");
  if (!Number.isFinite(internshipId) || !ruleId) return res.status(400).json({ error: "invalid_request" });

  const rule = await prisma.internshipBadgeRule.findUnique({ where: { id: ruleId } });
  if (!rule || rule.internshipId !== internshipId) return res.status(404).json({ error: "not_found" });

  const patch: any = {};
  if (req.body?.level !== undefined) {
    const level = String(req.body.level || "").toUpperCase();
    const allowed = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
    if (!allowed.includes(level)) return res.status(400).json({ error: "invalid_level" });
    patch.level = level as any;
  }
  if (req.body?.minCompletionPercent !== undefined) {
    patch.minCompletionPercent = Math.max(0, Math.min(100, Number(req.body.minCompletionPercent || 0) || 0));
  }
  if (req.body?.minXp !== undefined) {
    patch.minXp = Math.max(0, Number(req.body.minXp || 0) || 0);
  }
  if (req.body?.sortOrder !== undefined) {
    patch.sortOrder = Number(req.body.sortOrder || 0) || 0;
  }

  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "no_changes" });

  if (patch.level && patch.level !== rule.level) {
    const existing = await prisma.internshipBadgeRule.findUnique({
      where: { internshipId_level: { internshipId, level: patch.level } },
    });
    if (existing) return res.status(409).json({ error: "rule_exists" });
  }

  const updated = await prisma.internshipBadgeRule.update({
    where: { id: ruleId },
    data: patch,
  });

  return res.json({ ok: true, rule: updated });
});

router.delete("/:id/admin/v2/badge-rules/:ruleId", requireAdmin, async (req, res) => {
  const internshipId = Number(req.params.id);
  const ruleId = String(req.params.ruleId || "");
  if (!Number.isFinite(internshipId) || !ruleId) return res.status(400).json({ error: "invalid_request" });

  const rule = await prisma.internshipBadgeRule.findUnique({ where: { id: ruleId } });
  if (!rule || rule.internshipId !== internshipId) return res.status(404).json({ error: "not_found" });

  await prisma.internshipBadgeRule.delete({ where: { id: ruleId } });
  return res.json({ ok: true });
});

router.post("/:id/admin/v2/assignments/:assignmentId/reopen", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const assignmentId = String(req.params.assignmentId || "");
  if (!Number.isFinite(internshipId) || !assignmentId) return res.status(400).json({ error: "invalid_request" });

  const actor = req.auth?.userId ? String(req.auth.userId) : null;

  const assignment = await prisma.internshipTaskAssignment.findUnique({
    where: { id: assignmentId },
    include: { enrollment: true },
  });
  if (!assignment) return res.status(404).json({ error: "not_found" });
  if (assignment.enrollment.internshipId !== internshipId) return res.status(400).json({ error: "invalid_internship" });

  if (String((assignment as any).status) !== "LOCKED") return res.status(400).json({ error: "not_locked" });

  const resetAttempts = !!req.body?.resetAttempts;
  const before = assignment as any;

  const updated = await prisma.internshipTaskAssignment.update({
    where: { id: assignmentId },
    data: {
      status: "ASSIGNED" as any,
      lockedAt: null,
      ...(resetAttempts
        ? {
            remainingAttempts: assignment.maxAttempts,
            latestGradeStatus: "PENDING" as any,
          }
        : {}),
    } as any,
  });

  if (actor) {
    prisma.auditLog
      .create({
        data: {
          actorUserId: actor,
          action: "INTERNSHIP_ASSIGNMENT_REOPEN",
          entityType: "InternshipTaskAssignment",
          entityId: assignmentId,
          before,
          after: updated as any,
        },
      })
      .catch(() => {});
  }

  return res.json({ ok: true, assignment: updated });
});

router.get("/:id/admin/v2/templates", requireAdmin, async (req, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });
  const rows = await prisma.internshipTaskTemplate.findMany({
    where: { internshipId },
    orderBy: [{ badgeLevel: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return res.json({ templates: rows });
});

router.get("/:id/admin/v2/assignments", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });

  const batchIdRaw = req.query?.batchId;
  const enrollmentIdRaw = req.query?.enrollmentId;
  const statusRaw = req.query?.status;

  const batchId = batchIdRaw ? Number(batchIdRaw) : null;
  const enrollmentId = enrollmentIdRaw ? String(enrollmentIdRaw) : null;
  const status = statusRaw ? String(statusRaw).toUpperCase() : "";

  const allowedStatus = ["", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "GRADED", "LOCKED", "SKIPPED"];
  if (!allowedStatus.includes(status)) return res.status(400).json({ error: "invalid_status" });

  const rows = await prisma.internshipTaskAssignment.findMany({
    where: {
      enrollment: {
        internshipId,
        ...(Number.isFinite(batchId as any) ? { batchId: batchId as any } : {}),
        ...(enrollmentId ? { id: enrollmentId } : {}),
      } as any,
      ...(status ? { status: status as any } : {}),
    } as any,
    orderBy: [{ updatedAt: "desc" }],
    take: 400,
    include: {
      template: { select: { id: true, title: true, badgeLevel: true, xpReward: true } },
      enrollment: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          batch: { select: { id: true, name: true, batchCode: true } },
        },
      },
    },
  });

  return res.json({ assignments: rows });
});

router.post("/:id/admin/v2/assignments/:assignmentId/skip", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const assignmentId = String(req.params.assignmentId || "");
  if (!Number.isFinite(internshipId) || !assignmentId) return res.status(400).json({ error: "invalid_request" });

  const actor = req.auth?.userId ? String(req.auth.userId) : null;

  const assignment = await prisma.internshipTaskAssignment.findUnique({
    where: { id: assignmentId },
    include: { enrollment: true },
  });
  if (!assignment) return res.status(404).json({ error: "not_found" });
  if (assignment.enrollment.internshipId !== internshipId) return res.status(400).json({ error: "invalid_internship" });

  const before = assignment as any;
  const updated = await prisma.internshipTaskAssignment.update({
    where: { id: assignmentId },
    data: { status: "SKIPPED" as any } as any,
  });

  if (actor) {
    prisma.auditLog
      .create({
        data: {
          actorUserId: actor,
          action: "INTERNSHIP_ASSIGNMENT_SKIP",
          entityType: "InternshipTaskAssignment",
          entityId: assignmentId,
          before,
          after: updated as any,
        },
      })
      .catch(() => {});
  }

  return res.json({ ok: true, assignment: updated });
});

router.post("/:id/admin/v2/assignments/:assignmentId/unskip", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const assignmentId = String(req.params.assignmentId || "");
  if (!Number.isFinite(internshipId) || !assignmentId) return res.status(400).json({ error: "invalid_request" });

  const actor = req.auth?.userId ? String(req.auth.userId) : null;
  const now = new Date();

  const assignment = await prisma.internshipTaskAssignment.findUnique({
    where: { id: assignmentId },
    include: { enrollment: true },
  });
  if (!assignment) return res.status(404).json({ error: "not_found" });
  if (assignment.enrollment.internshipId !== internshipId) return res.status(400).json({ error: "invalid_internship" });

  const deadlinePassed = assignment.deadlineAt && new Date(assignment.deadlineAt as any).getTime() <= now.getTime();

  const before = assignment as any;
  const updated = await prisma.internshipTaskAssignment.update({
    where: { id: assignmentId },
    data: {
      status: deadlinePassed ? ("LOCKED" as any) : ("ASSIGNED" as any),
      lockedAt: deadlinePassed ? now : null,
    } as any,
  });

  if (actor) {
    prisma.auditLog
      .create({
        data: {
          actorUserId: actor,
          action: "INTERNSHIP_ASSIGNMENT_UNSKIP",
          entityType: "InternshipTaskAssignment",
          entityId: assignmentId,
          before,
          after: updated as any,
        },
      })
      .catch(() => {});
  }

  return res.json({ ok: true, assignment: updated });
});

router.post("/:id/admin/v2/templates", requireAdmin, async (req, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });

  const badgeLevel = String(req.body?.badgeLevel || "BEGINNER").toUpperCase();
  const title = String(req.body?.title || "").trim();
  const description = String(req.body?.description || "");
  const xpReward = Number(req.body?.xpReward || 0) || 0;
  const sortOrder = Number(req.body?.sortOrder || 0) || 0;
  const unlockOffsetDays = req.body?.unlockOffsetDays === undefined || req.body?.unlockOffsetDays === null ? null : Number(req.body.unlockOffsetDays);
  const timePeriodDays = req.body?.timePeriodDays === undefined || req.body?.timePeriodDays === null ? null : Number(req.body.timePeriodDays);
  const maxAttempts = Math.max(1, Number(req.body?.maxAttempts || 1) || 1);
  const autoPass = !!req.body?.autoPass;
  const rubricJson = req.body?.rubricJson ?? null;

  const allowed = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
  if (!allowed.includes(badgeLevel)) return res.status(400).json({ error: "invalid_badge" });
  if (!title) return res.status(400).json({ error: "invalid_request" });

  const t = await prisma.internshipTaskTemplate.create({
    data: {
      internshipId,
      badgeLevel: badgeLevel as any,
      title,
      description,
      xpReward,
      sortOrder,
      unlockOffsetDays: unlockOffsetDays !== null && Number.isFinite(unlockOffsetDays) ? unlockOffsetDays : null,
      timePeriodDays: timePeriodDays !== null && Number.isFinite(timePeriodDays) ? timePeriodDays : null,
      maxAttempts,
      autoPass,
      rubricJson,
    } as any,
  });

  return res.json({ ok: true, template: t });
});

router.put("/:id/admin/v2/templates/:templateId", requireAdmin, async (req, res) => {
  const internshipId = Number(req.params.id);
  const templateId = String(req.params.templateId || "");
  if (!Number.isFinite(internshipId) || !templateId) return res.status(400).json({ error: "invalid_request" });

  const template = await prisma.internshipTaskTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.internshipId !== internshipId) return res.status(404).json({ error: "not_found" });

  const patch: any = {};
  if (req.body?.badgeLevel !== undefined) {
    const badgeLevel = String(req.body.badgeLevel || "").toUpperCase();
    const allowed = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
    if (!allowed.includes(badgeLevel)) return res.status(400).json({ error: "invalid_badge" });
    patch.badgeLevel = badgeLevel as any;
  }
  if (req.body?.title !== undefined) {
    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ error: "invalid_request" });
    patch.title = title;
  }
  if (req.body?.description !== undefined) patch.description = String(req.body.description || "");
  if (req.body?.xpReward !== undefined) patch.xpReward = Number(req.body.xpReward || 0) || 0;
  if (req.body?.sortOrder !== undefined) patch.sortOrder = Number(req.body.sortOrder || 0) || 0;
  if (req.body?.unlockOffsetDays !== undefined) {
    const val = req.body.unlockOffsetDays;
    patch.unlockOffsetDays = val === "" || val === null ? null : Number(val);
  }
  if (req.body?.timePeriodDays !== undefined) {
    const val = req.body.timePeriodDays;
    patch.timePeriodDays = val === "" || val === null ? null : Number(val);
  }
  if (req.body?.maxAttempts !== undefined) patch.maxAttempts = Math.max(1, Number(req.body.maxAttempts || 1) || 1);
  if (req.body?.autoPass !== undefined) patch.autoPass = !!req.body.autoPass;
  if (req.body?.rubricJson !== undefined) patch.rubricJson = req.body.rubricJson;

  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "no_changes" });

  const updated = await prisma.internshipTaskTemplate.update({
    where: { id: templateId },
    data: patch,
  });

  return res.json({ ok: true, template: updated });
});

router.delete("/:id/admin/v2/templates/:templateId", requireAdmin, async (req, res) => {
  const internshipId = Number(req.params.id);
  const templateId = String(req.params.templateId || "");
  if (!Number.isFinite(internshipId) || !templateId) return res.status(400).json({ error: "invalid_request" });

  const template = await prisma.internshipTaskTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.internshipId !== internshipId) return res.status(404).json({ error: "not_found" });

  await prisma.internshipTaskTemplate.delete({ where: { id: templateId } });
  return res.json({ ok: true });
});

router.post("/:id/admin/v2/attempts/:attemptId/grade", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const attemptId = String(req.params.attemptId || "");
  if (!Number.isFinite(internshipId) || !attemptId) return res.status(400).json({ error: "invalid_request" });

  const gradeStatus = String(req.body?.gradeStatus || "PENDING").toUpperCase();
  const allowed = ["PENDING", "PASSED", "FAILED"];
  if (!allowed.includes(gradeStatus)) return res.status(400).json({ error: "invalid_grade_status" });

  const attempt = await prisma.internshipTaskAttempt.findUnique({
    where: { id: attemptId },
    include: { assignment: { include: { enrollment: true, template: true } } },
  });
  if (!attempt) return res.status(404).json({ error: "not_found" });
  if (attempt.assignment.enrollment.internshipId !== internshipId) return res.status(400).json({ error: "invalid_internship" });

  const feedback = req.body?.feedback ? String(req.body.feedback) : null;
  const score = req.body?.score === undefined || req.body?.score === null ? null : Number(req.body.score);
  const maxScore = req.body?.maxScore === undefined || req.body?.maxScore === null ? null : Number(req.body.maxScore);
  const rubricScores = req.body?.rubricScores ?? null;

  const actor = req.auth?.userId ? String(req.auth.userId) : null;

  const updatedAttempt = await prisma.internshipTaskAttempt.update({
    where: { id: attemptId },
    data: {
      gradedAt: new Date(),
      gradedBy: actor,
      gradeStatus: gradeStatus as any,
      feedback,
      score: score !== null && Number.isFinite(score) ? score : null,
      maxScore: maxScore !== null && Number.isFinite(maxScore) ? maxScore : null,
      rubricScores,
    } as any,
  });

  const nextAssignment: any = {
    latestGradeStatus: gradeStatus as any,
    status: "GRADED" as any,
    ...(gradeStatus === "PASSED" ? { passedAt: new Date() } : {}),
  };

  if (gradeStatus === "FAILED") {
    const now = Date.now();
    const deadlineAtMs = attempt.assignment.deadlineAt ? new Date(attempt.assignment.deadlineAt as any).getTime() : null;
    const deadlinePassed = deadlineAtMs !== null && deadlineAtMs <= now;
    const noMoreAttempts = (attempt.assignment.remainingAttempts ?? 0) <= 0;

    if (deadlinePassed || noMoreAttempts) {
      nextAssignment.status = "LOCKED" as any;
      nextAssignment.lockedAt = new Date();
    } else {
      nextAssignment.status = "ASSIGNED" as any;
    }
  }

  const updatedAssignment = await prisma.internshipTaskAssignment.update({
    where: { id: attempt.assignmentId },
    data: nextAssignment,
  });

  if (gradeStatus === "PASSED") {
    const xp = Number(attempt.assignment.template?.xpReward || 0) || 0;
    if (xp > 0) {
      prisma.user.update({ where: { id: attempt.assignment.enrollment.userId }, data: { xp: { increment: xp } } }).catch(() => {});
    }

    const enrollmentId = String(attempt.assignment.enrollment.id);
    evaluateAndPromoteBadge(enrollmentId, actor).catch(() => {});
    maybeIssueV2CertificateByEnrollment(enrollmentId).catch(() => {});
  }

  return res.json({ ok: true, attempt: updatedAttempt, assignment: updatedAssignment });
});

router.get("/:id/admin/v2/attempts", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });

  const gradeStatus = String(req.query?.gradeStatus || "").toUpperCase();
  const allowed = ["", "PENDING", "PASSED", "FAILED"];
  if (!allowed.includes(gradeStatus)) return res.status(400).json({ error: "invalid_grade_status" });

  const rows = await prisma.internshipTaskAttempt.findMany({
    where: {
      ...(gradeStatus ? { gradeStatus: gradeStatus as any } : {}),
      assignment: {
        enrollment: { internshipId },
      },
    },
    orderBy: [{ submittedAt: "desc" }],
    take: 200,
    include: {
      file: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } },
      assignment: {
        include: {
          template: { select: { id: true, title: true, badgeLevel: true, xpReward: true } },
          enrollment: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              batch: { select: { id: true, name: true, batchCode: true } },
            },
          },
        },
      },
    },
  });

  return res.json({ attempts: rows });
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

router.post("/:id/admin/enrollments/:enrollmentId/sync", requireAdmin, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  const enrollmentId = String(req.params.enrollmentId || "");
  if (!Number.isFinite(internshipId) || !enrollmentId) return res.status(400).json({ error: "invalid_request" });

  const actor = req.auth?.userId ? String(req.auth.userId) : null;

  const enrollment = await prisma.internshipEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment || enrollment.internshipId !== internshipId) return res.status(404).json({ error: "not_found" });

  await seedAssignmentsForEnrollment(enrollmentId);
  await recomputeAssignmentScheduleForEnrollment(enrollmentId);
  await lockExpiredAssignments(enrollmentId);
  await evaluateAndPromoteBadge(enrollmentId, actor);
  await maybeIssueV2CertificateByEnrollment(enrollmentId);

  if (actor) {
    prisma.auditLog
      .create({
        data: {
          actorUserId: actor,
          action: "INTERNSHIP_ENROLLMENT_SYNC",
          entityType: "InternshipEnrollment",
          entityId: enrollmentId,
          before: enrollment as any,
          after: { ok: true, syncedAt: new Date().toISOString() } as any,
        },
      })
      .catch(() => {});
  }

  return res.json({ ok: true });
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

  recomputeAssignmentScheduleForEnrollment(enrollmentId).catch(() => {});

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

  const certificate = enrollment
    ? await prisma.internshipCertificate.findUnique({
        where: { enrollmentId: enrollment.id },
        select: { id: true, certificateCode: true, status: true, issuedAt: true, fileId: true, qrPayload: true },
      })
    : null;

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
    certificate,
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

router.post("/:id/me/certificate", requireAuth, async (req: any, res) => {
  const internshipId = Number(req.params.id);
  if (!Number.isFinite(internshipId)) return res.status(400).json({ error: "invalid_id" });
  const userId = req.auth.userId as string;

  const internship = await prisma.internship.findUnique({ where: { id: internshipId } });
  if (!internship) return res.status(404).json({ error: "not_found" });

  const cert = await maybeIssueLegacyCertificate(internshipId, userId);
  if (!cert) return res.status(400).json({ error: "not_eligible" });

  return res.json({ ok: true, certificate: cert });
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

  maybeIssueLegacyCertificate(internshipId, userId).catch(() => {});

  return res.json({ ok: true, submissionId: submission.id });
});

export default router;
