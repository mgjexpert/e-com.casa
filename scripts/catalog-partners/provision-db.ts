import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
const db = new PrismaClient();
try {
  const statements = readFileSync('prisma/partner-catalog-schema.sql', 'utf8').split(';').map(s => s.trim()).filter(Boolean);
  await db.$transaction(async tx => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { maxWait: 30000, timeout: 120000 });
  console.log('Partner catalogue schema ready');
} finally { await db.$disconnect(); }
