import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { PrismaClient, Role } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "fs";
import path from "path";

dotenv.config({ path: "../.env" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function internshipCodeFromId(id: number, now: Date) {
  const year = now.getFullYear();
  const seq = String(id).padStart(4, "0");
  return `INT-${year}-${seq}`;
}

async function main() {
  const adminEmail = "admin@grovix.com";
  const adminPassword = "admin123";

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Grovix Admin",
      passwordHash,
      role: Role.ADMIN,
    },
    create: {
      email: adminEmail,
      name: "Grovix Admin",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  if (process.env.SEED_SAMPLE_DATA === "1") {
    const now = new Date();
    const internshipsPath = path.join(__dirname, "seedData", "internships.json");
    const internshipsRaw = fs.readFileSync(internshipsPath, "utf8");
    const internships: Array<{
      id: number;
      title: string;
      company: string;
      type: "free" | "paid";
      xpRequired: number;
      salary: string | null;
      duration: string;
      location: string;
      skills: string[];
      description: string;
      applicants: number;
    }> = JSON.parse(internshipsRaw);

    for (const i of internships) {
      const internshipCode = internshipCodeFromId(i.id, now);
      await prisma.internship.upsert({
        where: { id: i.id },
        update: {
          internshipCode,
          title: i.title,
          company: i.company,
          type: i.type,
          xpRequired: i.xpRequired,
          salary: i.salary,
          duration: i.duration,
          location: i.location,
          skills: i.skills,
          description: i.description,
          applicants: i.applicants,
        },
        create: {
          id: i.id,
          internshipCode,
          title: i.title,
          company: i.company,
          type: i.type,
          xpRequired: i.xpRequired,
          salary: i.salary,
          duration: i.duration,
          location: i.location,
          skills: i.skills,
          description: i.description,
          applicants: i.applicants,
        },
      });
    }

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatShortDate = (d: Date) => `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;

    
    const day = 24 * 60 * 60 * 1000;

    const e1Start = new Date(now.getTime() + 7 * day);
    e1Start.setHours(10, 0, 0, 0);
    const e1End = new Date(e1Start.getTime() + 48 * 60 * 60 * 1000);

    const e2Start = new Date(now.getTime() + 14 * day);
    e2Start.setHours(10, 0, 0, 0);
    const e2End = new Date(e2Start.getTime() + 2 * 60 * 60 * 1000);

    const e3Start = new Date(now.getTime() + 21 * day);
    e3Start.setHours(15, 0, 0, 0);
    const e3End = new Date(e3Start.getTime() + 60 * 60 * 1000);

    const events = [
      {
        id: 1,
        title: "AI Hackathon",
        type: "hackathon",
        description: "Build innovative AI solutions in 48 hours. Teams of up to 4 members.",
        venue: "Virtual Event",
        prize: "$10,000",
        date: formatShortDate(e1Start),
        startAt: e1Start,
        endAt: e1End,
      },
      {
        id: 2,
        title: "Speed Coding Challenge",
        type: "challenge",
        description: "Test your coding speed and accuracy in this exciting competition.",
        venue: "Online Platform",
        prize: "5,000 XP",
        date: formatShortDate(e2Start),
        startAt: e2Start,
        endAt: e2End,
      },
      {
        id: 3,
        title: "Tech Talk: Career Growth",
        type: "workshop",
        description: "Learn from industry experts about career growth strategies.",
        venue: "Online Webinar",
        prize: null as any,
        date: formatShortDate(e3Start),
        startAt: e3Start,
        endAt: e3End,
      },
    ];

    for (const e of events) {
      const updatedAt = new Date();
      await prisma.$executeRaw`
        INSERT INTO "Event" ("id", "title", "type", "description", "venue", "link", "prize", "date", "startAt", "endAt", "updatedAt")
        VALUES (${e.id}, ${e.title}, ${e.type}, ${e.description}, ${e.venue}, ${null}, ${e.prize}, ${e.date}, ${e.startAt}, ${e.endAt}, ${updatedAt})
        ON CONFLICT ("id") DO UPDATE
        SET
          "title" = EXCLUDED."title",
          "type" = EXCLUDED."type",
          "description" = EXCLUDED."description",
          "venue" = EXCLUDED."venue",
          "link" = EXCLUDED."link",
          "prize" = EXCLUDED."prize",
          "date" = EXCLUDED."date",
          "startAt" = EXCLUDED."startAt",
          "endAt" = EXCLUDED."endAt",
          "updatedAt" = EXCLUDED."updatedAt";
      `;
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
