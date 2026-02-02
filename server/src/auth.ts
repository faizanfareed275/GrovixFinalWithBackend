import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "./db";

const router = Router();

const cookieName = "grovix_token";

function toClientUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
    avatar: (user.name || "U")
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase(),
    role: user.role,
  };
}

function signToken(payload: { userId: string; role: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

function setAuthCookie(res: any, token: string) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.get("/me", async (req, res) => {
  const token = req.cookies?.[cookieName];
  if (!token) return res.status(401).json({ error: "unauthorized" });

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "server_misconfigured" });

    const decoded = jwt.verify(token, secret) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: "unauthorized" });

    prisma.user
      .update({ where: { id: user.id }, data: ({ lastSeenAt: new Date() } as any) })
      .catch(() => {});

    return res.json({ user: toClientUser(user) });
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
});

router.post("/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "invalid_email_or_password" });

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_email_or_password" });

  let token: string;
  try {
    token = signToken({ userId: user.id, role: user.role });
  } catch {
    return res.status(500).json({ error: "server_misconfigured" });
  }
  setAuthCookie(res, token);

  return res.json({ ok: true, user: toClientUser(user) });
});

router.post("/signup", async (req, res) => {
  const schema = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "email_already_exists" });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      passwordHash,
    },
  });

  let token: string;
  try {
    token = signToken({ userId: user.id, role: user.role });
  } catch {
    return res.status(500).json({ error: "server_misconfigured" });
  }
  setAuthCookie(res, token);

  return res.json({ ok: true, user: toClientUser(user) });
});

router.post("/logout", async (_req, res) => {
  res.clearCookie(cookieName, { httpOnly: true, sameSite: "lax", secure: false, path: "/" });
  return res.json({ ok: true });
});

router.get("/google", async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(501).json({ error: "google_oauth_not_configured" });
  }

  let Issuer: any;
  let generators: any;
  try {
    ({ Issuer, generators } = (await import("openid-client")) as any);
  } catch {
    return res.status(501).json({ error: "google_oauth_not_configured" });
  }

  if (!Issuer || !generators) {
    return res.status(501).json({ error: "google_oauth_not_configured" });
  }

  const issuer = await Issuer.discover("https://accounts.google.com");
  const client = new issuer.Client({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: [redirectUri],
    response_types: ["code"],
  });

  const state = generators.state();
  const nonce = generators.nonce();

  res.cookie("grovix_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 10 * 60 * 1000 });
  res.cookie("grovix_oauth_nonce", nonce, { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 10 * 60 * 1000 });

  const url = client.authorizationUrl({
    scope: "openid email profile",
    state,
    nonce,
    prompt: "select_account",
  });

  return res.redirect(url);
});

router.get("/google/callback", async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const webOrigin = process.env.GROVIX_WEB_ORIGIN || "http://localhost:8080";

  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(501).send("Google OAuth not configured");
  }

  let Issuer: any;
  let generators: any;
  try {
    ({ Issuer, generators } = (await import("openid-client")) as any);
  } catch {
    return res.redirect(`${webOrigin}/auth`);
  }

  if (!Issuer || !generators) {
    return res.redirect(`${webOrigin}/auth`);
  }

  const issuer = await Issuer.discover("https://accounts.google.com");
  const client = new issuer.Client({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: [redirectUri],
    response_types: ["code"],
  });

  const state = req.cookies?.grovix_oauth_state;
  const nonce = req.cookies?.grovix_oauth_nonce;

  try {
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(redirectUri, params, { state, nonce });
    const claims: any = tokenSet.claims();

    const googleId = String(claims.sub || "");
    const email = String(claims.email || "").trim().toLowerCase();
    const name = String(claims.name || "User");
    const picture = claims.picture ? String(claims.picture) : null;

    if (!googleId || !email) {
      return res.redirect(`${webOrigin}/auth`);
    }

    const existingByGoogle = await prisma.user.findUnique({ where: { googleId } });
    const existingByEmail = await prisma.user.findUnique({ where: { email } });

    const user = existingByGoogle
      ? await prisma.user.update({ where: { id: existingByGoogle.id }, data: { email, name, avatarUrl: picture } })
      : existingByEmail
        ? await prisma.user.update({ where: { id: existingByEmail.id }, data: { googleId, name: existingByEmail.name || name, avatarUrl: picture } })
        : await prisma.user.create({
            data: {
              email,
              name,
              googleId,
              avatarUrl: picture,
              passwordHash: await bcrypt.hash(generators.random(), 10),
            },
          });

    let token: string;
    try {
      token = signToken({ userId: user.id, role: user.role });
    } catch {
      return res.redirect(`${webOrigin}/auth`);
    }
    setAuthCookie(res, token);

    res.clearCookie("grovix_oauth_state", { path: "/" });
    res.clearCookie("grovix_oauth_nonce", { path: "/" });

    return res.redirect(`${webOrigin}/profile`);
  } catch {
    return res.redirect(`${webOrigin}/auth`);
  }
});

export default router;
