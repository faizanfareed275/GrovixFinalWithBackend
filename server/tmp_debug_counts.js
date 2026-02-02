require("dotenv").config({ path: "../.env" });

const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const counts = await prisma["$queryRaw"]`
    SELECT
      (SELECT COUNT(*)::int FROM "User") AS users,
      (SELECT COUNT(*)::int FROM "Internship") AS internships,
      (SELECT COUNT(*)::int FROM "Event") AS events,
      (SELECT COUNT(*)::int FROM "EventEnrollment") AS enrollments
  `;

  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma["$disconnect"]());
