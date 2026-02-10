// Use Prisma client from backend (shared in monorepo)
// Import from the root node_modules where Prisma client is generated
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

// Use the same database URL as backend
const databaseUrl = process.env.DATABASE_URL || 'file:../backend/data/daylaunch.db';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

export default prisma;
