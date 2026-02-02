import { Router } from "express";
import { prisma } from "./db";
import { requireAuth } from "./middleware/auth";

const router = Router();

async function getUserStreak(userId: string) {
  try {
    const client = (prisma as any).userStreak;
    if (!client) throw new Error("missing_user_streak_client");
    const s = await client.findUnique({ where: { userId } });
    return {
      count: Number(s?.count || 0) || 0,
      longestStreak: Number(s?.longestStreak || 0) || 0,
      totalActiveDays: Number(s?.totalActiveDays || 0) || 0,
      lastActivityDate: s?.lastActivityDate ? String(s.lastActivityDate) : null,
    };
  } catch {
    return {
      count: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      lastActivityDate: null as string | null,
    };
  }
}

function computeBadges(params: {
  challengesCompleted: number;
  streakCount: number;
  aiChallenges: number;
  webChallenges: number;
  totalLikesReceived: number;
}) {
  const earned: any[] = [];
  if (params.challengesCompleted >= 1) {
    earned.push({ id: "first_challenge", name: "First Challenge", icon: "🏆", description: "Completed your first challenge!" });
  }
  if (params.streakCount >= 7) {
    earned.push({ id: "streak_7", name: "7-Day Streak", icon: "🔥", description: "Maintained a 7-day streak!" });
  }
  if (params.aiChallenges >= 5) {
    earned.push({ id: "ai_master", name: "AI Master", icon: "🤖", description: "Completed 5 AI challenges!" });
  }
  if (params.webChallenges >= 5) {
    earned.push({ id: "web_wizard", name: "Web Wizard", icon: "🌐", description: "Completed 5 Web Dev challenges!" });
  }
  if (params.totalLikesReceived >= 50) {
    earned.push({ id: "community_star", name: "Community Star", icon: "⭐", description: "Received 50 likes on your posts!" });
  }
  return earned;
}

function initialsFromName(name: string) {
  return String(name || "U")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function computeLevel(xp: number) {
  const safe = Number(xp || 0) || 0;
  return Math.max(1, Math.floor(safe / 1000) + 1);
}

function toPublicProfile(user: any, extra?: any) {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
    avatar: initialsFromName(user.name),
    xp: user.xp || 0,
    level: computeLevel(user.xp || 0),
    bio: user.bio || null,
    location: user.location || null,
    experience: user.experience || null,
    portfolio: user.portfolio || null,
    skills: Array.isArray(user.skills) ? user.skills : [],
    available: typeof user.available === "boolean" ? user.available : true,
    socialLinks: {
      github: user.githubUrl || null,
      linkedin: user.linkedinUrl || null,
      twitter: user.twitterUrl || null,
      website: user.websiteUrl || null,
    },
    ...(extra || {}),
  };
}

router.get("/", async (req, res) => {
  const q = String(req.query?.q || req.query?.search || "").trim();
  const takeRaw = Number(req.query?.limit || 50);
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 100) : 50;

  const users = await (prisma as any).user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { bio: { contains: q, mode: "insensitive" } },
            { location: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ xp: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      xp: true,
      bio: true,
      location: true,
      experience: true,
      portfolio: true,
      skills: true,
      githubUrl: true,
      linkedinUrl: true,
      twitterUrl: true,
      websiteUrl: true,
      available: true,
    },
  });

  return res.json({ users: users.map((u: any) => toPublicProfile(u)) });
});

router.get("/me", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;
  const user = await (prisma as any).user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      xp: true,
      bio: true,
      location: true,
      experience: true,
      portfolio: true,
      skills: true,
      githubUrl: true,
      linkedinUrl: true,
      twitterUrl: true,
      websiteUrl: true,
      available: true,
    },
  });
  if (!user) return res.status(404).json({ error: "not_found" });

  const followersCount = await (prisma as any).follow.count({ where: { followingId: userId } });
  const followingCount = await (prisma as any).follow.count({ where: { followerId: userId } });
  const challengesCompleted = await prisma.challengeCompletion.count({ where: { userId } });

  const aiChallenges = await prisma.challengeCompletion.count({ where: { userId, category: "AI & ML" } });
  const webChallenges = await prisma.challengeCompletion.count({ where: { userId, category: "Web Dev" } });

  const posts = await prisma.communityPost.findMany({ where: { userId }, select: { likesBy: true } });
  const totalLikesReceived = posts.reduce((sum, p: any) => sum + (Array.isArray(p?.likesBy) ? p.likesBy.length : 0), 0);

  const streak = await getUserStreak(userId);
  const badges = computeBadges({
    challengesCompleted,
    streakCount: streak.count,
    aiChallenges,
    webChallenges,
    totalLikesReceived,
  });

  const enrollments = await prisma.internshipEnrollment.findMany({ where: { userId } });
  const enrollmentIds = enrollments.map((e) => e.id);
  const certRows = enrollmentIds.length
    ? await prisma.internshipCertificate.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        orderBy: { issuedAt: "desc" },
        include: {
          internship: { select: { id: true, title: true, company: true, type: true } },
        },
      })
    : [];

  const certificates = certRows.map((c: any) => ({
    internshipId: c.internshipId,
    title: String(c.internship?.title || ""),
    company: String(c.internship?.company || ""),
    type: String(c.internship?.type || "free"),
    completedAt: c.issuedAt ? new Date(c.issuedAt).toISOString().slice(0, 10) : null,
    certificateCode: c.certificateCode,
    status: c.status,
  }));

  return res.json({
    user: toPublicProfile(user, { followersCount, followingCount, challengesCompleted, streak, badges, certificates }),
  });
});

router.patch("/me", requireAuth, async (req: any, res) => {
  const userId = req.auth.userId as string;

  const body = req.body || {};

  const data: any = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.avatarUrl === "string") data.avatarUrl = body.avatarUrl;
  if (typeof body.bio === "string") data.bio = body.bio;
  if (typeof body.location === "string") data.location = body.location;
  if (typeof body.experience === "string") data.experience = body.experience;
  if (typeof body.portfolio === "string") data.portfolio = body.portfolio;
  if (Array.isArray(body.skills)) data.skills = body.skills.map((s: any) => String(s || "").trim()).filter(Boolean);
  if (typeof body.available === "boolean") data.available = body.available;

  if (body.socialLinks && typeof body.socialLinks === "object") {
    if (typeof body.socialLinks.github === "string") data.githubUrl = body.socialLinks.github;
    if (typeof body.socialLinks.linkedin === "string") data.linkedinUrl = body.socialLinks.linkedin;
    if (typeof body.socialLinks.twitter === "string") data.twitterUrl = body.socialLinks.twitter;
    if (typeof body.socialLinks.website === "string") data.websiteUrl = body.socialLinks.website;
  }

  const updated = await (prisma as any).user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      xp: true,
      bio: true,
      location: true,
      experience: true,
      portfolio: true,
      skills: true,
      githubUrl: true,
      linkedinUrl: true,
      twitterUrl: true,
      websiteUrl: true,
      available: true,
    },
  });

  const followersCount = await (prisma as any).follow.count({ where: { followingId: userId } });
  const followingCount = await (prisma as any).follow.count({ where: { followerId: userId } });
  const challengesCompleted = await prisma.challengeCompletion.count({ where: { userId } });

  return res.json({
    user: toPublicProfile(updated, { followersCount, followingCount, challengesCompleted }),
  });
});

router.get("/:id", async (req, res) => {
  const id = String(req.params.id || "");
  if (!id) return res.status(400).json({ error: "invalid_id" });

  const user = await (prisma as any).user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      xp: true,
      bio: true,
      location: true,
      experience: true,
      portfolio: true,
      skills: true,
      githubUrl: true,
      linkedinUrl: true,
      twitterUrl: true,
      websiteUrl: true,
      available: true,
    },
  });
  if (!user) return res.status(404).json({ error: "not_found" });

  const followersCount = await (prisma as any).follow.count({ where: { followingId: id } });
  const followingCount = await (prisma as any).follow.count({ where: { followerId: id } });

  const recentChallenges = await prisma.challengeCompletion.findMany({
    where: { userId: id },
    orderBy: { completedAt: "desc" },
    take: 10,
    select: { title: true, xpEarned: true, completedAt: true },
  });

  const challengesCompleted = await prisma.challengeCompletion.count({ where: { userId: id } });

  const aiChallenges = await prisma.challengeCompletion.count({ where: { userId: id, category: "AI & ML" } });
  const webChallenges = await prisma.challengeCompletion.count({ where: { userId: id, category: "Web Dev" } });

  const posts = await prisma.communityPost.findMany({
    where: { userId: id },
    select: { likesBy: true },
  });
  const totalLikesReceived = posts.reduce((sum, p: any) => sum + (Array.isArray(p?.likesBy) ? p.likesBy.length : 0), 0);

  const streak = await getUserStreak(id);

  const badges = computeBadges({
    challengesCompleted,
    streakCount: streak.count,
    aiChallenges,
    webChallenges,
    totalLikesReceived,
  });

  const enrollments = await prisma.internshipEnrollment.findMany({ where: { userId: id } });
  const enrollmentIds = enrollments.map((e) => e.id);
  const certRows = enrollmentIds.length
    ? await prisma.internshipCertificate.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        orderBy: { issuedAt: "desc" },
        include: {
          internship: { select: { id: true, title: true, company: true, type: true } },
        },
      })
    : [];

  const certificates = certRows.map((c: any) => ({
    internshipId: c.internshipId,
    title: String(c.internship?.title || ""),
    company: String(c.internship?.company || ""),
    type: String(c.internship?.type || "free"),
    completedAt: c.issuedAt ? new Date(c.issuedAt).toISOString().slice(0, 10) : null,
    certificateCode: c.certificateCode,
    status: c.status,
  }));

  return res.json({
    user: toPublicProfile(user, {
      followersCount,
      followingCount,
      challengesCompleted,
      streak,
      badges,
      certificates,
      recentChallenges: recentChallenges.map((c) => ({
        title: c.title,
        xp: c.xpEarned,
        date: c.completedAt.toISOString().slice(0, 10),
      })),
    }),
  });
});

export default router;
