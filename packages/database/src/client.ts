import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

const adpter = new PrismaPg({
  connectionString: databaseUrl,
});

export const db = new PrismaClient({
  adapter: adpter,
});
