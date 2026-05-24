const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

const adapter = new PrismaBetterSqlite3({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Querying database capabilities...");
  const count = await prisma.capability.count();
  console.log("Success! Capability count:", count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
