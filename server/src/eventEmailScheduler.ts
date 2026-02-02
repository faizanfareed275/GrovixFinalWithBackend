import nodemailer from "nodemailer";
import { prisma } from "./db";

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

function buildEmailSubject(event: any) {
  return `Event Started: ${String(event?.title || "Event")}`;
}

function buildEmailHtml(event: any, recipientName: string) {
  const title = String(event?.title || "Event");
  const date = event?.date ? String(event.date) : "";
  const venue = event?.venue ? String(event.venue) : "";
  const link = event?.link ? String(event.link) : "";

  const lines: string[] = [];
  lines.push(`<p>Hi ${recipientName || "there"},</p>`);
  lines.push(`<p>Your event has started:</p>`);
  lines.push(`<p><strong>${title}</strong>${date ? ` — ${date}` : ""}</p>`);
  if (venue) lines.push(`<p><strong>Venue:</strong> ${venue}</p>`);
  if (link) lines.push(`<p><strong>Join link:</strong> <a href="${link}">${link}</a></p>`);
  lines.push(`<p>Thanks,<br/>Grovix</p>`);

  return lines.join("\n");
}

async function sendEventStartEmailsOnce(now: Date) {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const pending = await (prisma as any).eventEnrollment.findMany({
    where: {
      status: "enrolled",
      event: {
        startAt: {
          lte: now,
          gte: since,
        },
      },
    },
    take: 500,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      user: { select: { email: true, name: true } },
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          venue: true,
          link: true,
          startAt: true,
        },
      },
    },
  });

  if (!pending.length) return;

  const cfg = getSmtpConfig();
  if (!cfg) {
    console.log("[events-email] SMTP not configured; skipping email sending");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  for (const r of pending) {
    const to = String(r.email || r.user?.email || "").trim();
    if (!to) continue;

    const recipientName = String(r.name || r.user?.name || "").trim();

    try {
      await transporter.sendMail({
        from: cfg.from,
        to,
        subject: buildEmailSubject(r.event),
        html: buildEmailHtml(r.event, recipientName),
      });

      await (prisma as any).eventEnrollment.update({
        where: { id: r.id },
        data: { status: "notified" },
      });
    } catch {
    }
  }
}

let started = false;

export function startEventEmailScheduler() {
  if (started) return;
  started = true;

  const tick = async () => {
    try {
      await sendEventStartEmailsOnce(new Date());
    } catch {
    }
  };

  tick();
  setInterval(tick, 60_000);
}
