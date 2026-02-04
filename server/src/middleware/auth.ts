import jwt from "jsonwebtoken";
import { prisma } from "../db";

export type AuthUser = {
  userId: string;
  role: string;
};

const cookieName = "grovix_token";

export function requireAuth(req: any, res: any, next: any) {
  const token = req.cookies?.[cookieName];
  if (!token) return res.status(401).json({ error: "unauthorized" });

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "server_misconfigured" });
    const decoded = jwt.verify(token, secret) as any;

    const userId = String(decoded.userId || "");
    if (!userId) return res.status(401).json({ error: "unauthorized" });

    prisma.user
      .findUnique({
        where: { id: userId },
        select: { id: true, role: true, isBanned: true, bannedUntil: true },
      })
      .then((u) => {
        if (!u) return res.status(401).json({ error: "unauthorized" });

        if (u.isBanned) {
          const until = u.bannedUntil ? new Date(u.bannedUntil) : null;
          const stillBanned = !until || until.getTime() > Date.now();
          if (stillBanned) return res.status(403).json({ error: "banned" });
        }

        req.auth = { userId: u.id, role: String(u.role || decoded.role || "") } satisfies AuthUser;

        prisma.user
          .update({ where: { id: u.id }, data: { lastSeenAt: new Date() } })
          .catch(() => {});

        return next();
      })
      .catch(() => {
        return res.status(401).json({ error: "unauthorized" });
      });
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

export function requireAdmin(req: any, res: any, next: any) {
  return requireAuth(req, res, () => {
    const auth: AuthUser | undefined = req.auth;
    if (!auth || auth.role !== "ADMIN") return res.status(403).json({ error: "forbidden" });
    return next();
  });
}
