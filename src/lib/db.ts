import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Reuse one client across hot reloads in development.
// Typed loosely: after a regenerate it may hold a client of an older class.
const globalForPrisma = globalThis as unknown as { prisma?: unknown };

// After `prisma generate` the dev server reloads the generated module, so a
// client cached before a schema change is an instance of the *old* class and
// lacks new models (e.g. `db.photo` would be undefined). Replace it.
const cached = globalForPrisma.prisma;
const isCurrent = cached instanceof PrismaClient;
if (cached && !isCurrent) void (cached as { $disconnect(): Promise<void> }).$disconnect();

export const db = isCurrent ? cached : createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
