import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaModels?: string
}

function createPrismaClient(ClientClass: typeof PrismaClient) {
  return new ClientClass({
    log: ['query'],
  })
}

/**
 * Read the model names from the *generated* Prisma client on disk
 * (node_modules/.prisma/client/schema.prisma) without loading the module.
 */
function generatedSchemaModels(): string | null {
  try {
    const file = path.join(process.cwd(), 'node_modules', '.prisma', 'client', 'schema.prisma');
    const source = fs.readFileSync(file, 'utf8');
    const names = [...source.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]).sort().join(',');
    return names || null;
  } catch {
    return null;
  }
}

/**
 * Dev resilience: `prisma generate` after the dev server has started leaves
 * Node's require cache holding the previous client (externals are resolved
 * through require, so a restart would normally be needed). When the cached
 * instance was created for an older schema, bust the require cache once and
 * reload the freshly generated client class.
 */
function loadFreshClientClass(): typeof PrismaClient | null {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    const nodeRequire = createRequire(path.join(process.cwd(), 'index.js'));
    for (const key of Object.keys(nodeRequire.cache)) {
      if (key.includes(`${path.sep}.prisma${path.sep}client`) || key.includes(`${path.sep}@prisma${path.sep}client`)) {
        delete nodeRequire.cache[key];
      }
    }
    const fresh = nodeRequire('@prisma/client') as unknown as { PrismaClient: typeof PrismaClient };
    return fresh?.PrismaClient ?? null;
  } catch {
    return null;
  }
}

const cachedClient = globalForPrisma.prisma;
const schemaModels = generatedSchemaModels();
const isStale = Boolean(
  cachedClient && schemaModels && globalForPrisma.prismaSchemaModels !== schemaModels,
);

let db: PrismaClient;
if (cachedClient && !isStale) {
  db = cachedClient;
} else if (isStale) {
  const FreshClient = loadFreshClientClass();
  db = createPrismaClient(FreshClient ?? PrismaClient);
} else {
  db = createPrismaClient(PrismaClient);
}

export { db };

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
  if (schemaModels) globalForPrisma.prismaSchemaModels = schemaModels;
}
