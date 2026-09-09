import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const products = await db.product.findMany({ select: { slug: true, gallery: true, image: true, hoverImage: true } });
import { existsSync } from 'fs';
let missing = 0;
for (const p of products) {
  const paths = [p.image, p.hoverImage, ...(p.gallery ? p.gallery.split(',') : [])].filter(Boolean);
  for (const path of paths) {
    const file = 'public' + path;
    if (!existsSync(file)) { console.log('MISSING:', p.slug, path); missing++; }
  }
}
console.log(`Checked ${products.length} products; ${missing} missing files`);
await db.$disconnect();
