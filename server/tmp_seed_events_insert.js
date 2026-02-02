require("dotenv").config({ path: "../.env" });

const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function formatShortDate(d) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}

async function upsertEvent(e) {
  const updatedAt = new Date();
  await prisma["$executeRaw"]`
    INSERT INTO "Event" ("id", "title", "type", "description", "venue", "link", "prize", "date", "startAt", "endAt", "updatedAt")
    VALUES (${e.id}, ${e.title}, ${e.type}, ${e.description}, ${e.venue}, ${e.link}, ${e.prize}, ${e.date}, ${e.startAt}, ${e.endAt}, ${updatedAt})
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

async function main() {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const e2Start = new Date(now.getTime() + 14 * day);
  e2Start.setHours(10, 0, 0, 0);
  const e2End = new Date(e2Start.getTime() + 2 * 60 * 60 * 1000);

  const e3Start = new Date(now.getTime() + 21 * day);
  e3Start.setHours(15, 0, 0, 0);
  const e3End = new Date(e3Start.getTime() + 60 * 60 * 1000);

  await upsertEvent({
    id: 2,
    title: "Speed Coding Challenge",
    type: "challenge",
    description: "Test your coding speed and accuracy in this exciting competition.",
    venue: "Online Platform",
    link: null,
    prize: "5,000 XP",
    date: formatShortDate(e2Start),
    startAt: e2Start,
    endAt: e2End,
  });

  await upsertEvent({
    id: 3,
    title: "Tech Talk: Career Growth",
    type: "workshop",
    description: "Learn from industry experts about career growth strategies.",
    venue: "Online Webinar",
    link: null,
    prize: null,
    date: formatShortDate(e3Start),
    startAt: e3Start,
    endAt: e3End,
  });

  const countRows = await prisma["$queryRaw"]`SELECT COUNT(*)::int AS count FROM "Event"`;
  console.log(JSON.stringify({ countRows }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma["$disconnect"]());
