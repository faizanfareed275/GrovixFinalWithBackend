require("dotenv").config({ path: "../.env" });

const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const startAt = new Date(Date.now() + 60 * 60 * 1000);
  const endAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const created = await prisma.event.create({
    data: {
      title: "Sample Event (Auto)",
      type: "workshop",
      description: "This is a sample event inserted for UI verification.",
      venue: "Online",
      prize: null,
      date: startAt.toDateString(),
      startAt,
      endAt,
    },
  });

  const countRows = await prisma["$queryRaw"]`SELECT COUNT(*)::int AS count FROM "Event"`;
  console.log(JSON.stringify({ created, countRows }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma["$disconnect"]());
