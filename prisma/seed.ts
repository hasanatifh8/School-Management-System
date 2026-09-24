import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { loadDemoData } from "../src/lib/demo-data";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  if (await db.school.count()) {
    console.log("Database already has a school — skipping seed.");
    return;
  }
  const school = await db.school.create({ data: { name: "Demo Public School", code: "DPS", board: "CBSE" } });
  await db.$transaction((tx) => loadDemoData(tx, school.id), { timeout: 60_000 });
  console.log(`Seeded "${school.name}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
