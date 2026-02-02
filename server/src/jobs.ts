import { Router } from "express";
import { prisma } from "./db";
import { requireAuth } from "./middleware/auth";

const router = Router();

function initialsFromName(name: string) {
  return String(name || "U")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function toPublicJobPost(job: any) {
  const user = job?.userRef;
  return {
    id: job.id,
    userId: job.userId,
    title: job.title,
    company: job.company,
    minLevel: job.minLevel,
    minXP: job.minXP,
    salary: job.salary,
    type: job.type,
    location: job.location,
    skills: Array.isArray(job.skills) ? job.skills : [],
    description: job.description,
    applicants: job.applicants || 0,
    createdAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : String(job.createdAt || ""),
    updatedAt: job.updatedAt instanceof Date ? job.updatedAt.toISOString() : String(job.updatedAt || ""),
    user: user
      ? {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl || null,
          avatar: initialsFromName(user.name),
        }
      : null,
  };
}

router.get("/", async (req, res) => {
  const q = String(req.query?.q || req.query?.search || "").trim();
  const takeRaw = Number(req.query?.limit || 50);
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 100) : 50;
  const skipRaw = Number(req.query?.offset || 0);
  const skip = Number.isFinite(skipRaw) ? Math.max(skipRaw, 0) : 0;

  const terms = q
    ? q
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];

  const where: any = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          ...(terms.length
            ? terms.map((t) => ({ skills: { has: t } }))
            : []),
        ],
      }
    : undefined;

  const jobClient = (prisma as any).jobPost;
  if (!jobClient) return res.json({ jobs: [], total: 0 });

  const [rows, total] = await Promise.all([
    jobClient.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: {
        userRef: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    }),
    jobClient.count({ where }),
  ]);

  return res.json({ jobs: rows.map((r: any) => toPublicJobPost(r)), total });
});

router.get("/mine", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;

  const jobClient = (prisma as any).jobPost;
  if (!jobClient) return res.json({ jobs: [] });

  const jobs = await jobClient.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      userRef: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  return res.json({ jobs: jobs.map((r: any) => toPublicJobPost(r)) });
});

router.post("/", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;

  const title = String(req.body?.title ?? "").trim();
  const company = String(req.body?.company ?? "").trim();
  const minLevel = Math.max(1, Number(req.body?.minLevel ?? 1) || 1);
  const minXP = Math.max(0, Number(req.body?.minXP ?? 0) || 0);
  const salary = String(req.body?.salary ?? "").trim() || "Competitive";
  const type = String(req.body?.type ?? "").trim() || "Full-time";
  const location = String(req.body?.location ?? "").trim() || "Remote";
  const description = String(req.body?.description ?? "").trim();
  const skills = Array.isArray(req.body?.skills)
    ? req.body.skills
        .map((s: any) => String(s || "").trim())
        .filter(Boolean)
        .slice(0, 50)
    : [];

  if (!title || !company || !description) return res.status(400).json({ error: "invalid_request" });

  const jobClient = (prisma as any).jobPost;
  if (!jobClient) return res.status(500).json({ error: "server_misconfigured" });

  const job = await jobClient.create({
    data: {
      userId,
      title,
      company,
      minLevel,
      minXP,
      salary,
      type,
      location,
      description,
      skills,
      applicants: 0,
    },
    include: {
      userRef: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  return res.json({ ok: true, job: toPublicJobPost(job) });
});

router.delete("/:id", requireAuth, async (req: any, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });

  const auth = req.auth as { userId: string; role: string };

  const jobClient = (prisma as any).jobPost;
  if (!jobClient) return res.status(500).json({ error: "server_misconfigured" });

  const job = await jobClient.findUnique({ where: { id } });
  if (!job) return res.status(404).json({ error: "not_found" });

  if (auth.role !== "ADMIN" && job.userId !== auth.userId) {
    return res.status(403).json({ error: "forbidden" });
  }

  await jobClient.delete({ where: { id } });
  return res.json({ ok: true });
});

export default router;
