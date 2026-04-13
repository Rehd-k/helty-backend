import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** PrismaClient with `PrismaPg` — same wiring as `prisma/seed.ts` and `src/prisma/prisma.service.ts`. */
export function createScriptPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Load .env or export DATABASE_URL before running backup/restore.');
  }
  return new PrismaClient({
    log: ['error', 'warn'],
    adapter: new PrismaPg({ connectionString }),
  });
}
