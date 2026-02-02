require("dotenv").config({ path: "../.env" });

const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const info = await prisma["$queryRaw"]`SELECT current_database() AS db, current_schema() AS schema`;
  const countRows = await prisma["$queryRaw"]`SELECT COUNT(*)::int AS count FROM "Event"`;
  const events = await prisma["$queryRaw"]`SELECT id, title, type, "startAt" FROM "Event" ORDER BY id ASC`;

  console.log(JSON.stringify({ info, countRows, events }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma["$disconnect"]());
