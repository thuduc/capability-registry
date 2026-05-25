const { PrismaClient } = require("../src/generated/prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const Database = require("better-sqlite3");

try {
  // Let's test both ways to instantiate
  console.log("Method 1: passing path to PrismaBetterSqlite3...");
  const db = new Database("prisma/dev.db");
  const adapter1 = new PrismaBetterSqlite3(db);
  const prisma1 = new PrismaClient({ adapter: adapter1 });
  console.log("Method 1 success!");
} catch (e) {
  console.error("Method 1 failed:", e);
}

try {
  console.log("Method 2: passing option object...");
  const adapter2 = new PrismaBetterSqlite3({ url: "file:prisma/dev.db" });
  const prisma2 = new PrismaClient({ adapter: adapter2 });
  console.log("Method 2 success!");
} catch (e) {
  console.error("Method 2 failed:", e);
}
