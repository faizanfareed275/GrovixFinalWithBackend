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
    req.auth = { userId: decoded.userId, role: decoded.role } satisfies AuthUser;
    prisma.user
      .update({ where: { id: decoded.userId }, data: ({ lastSeenAt: new Date() } as any) })
      .catch(() => {});
    return next();
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
