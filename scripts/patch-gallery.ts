// One-off: patch existing products with gallery image paths (no wipe of orders)
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const products = await db.product.findMany({ select: { id: true, image: true } });
  for (const p of products) {
    const short = p.image.replace('/images/product-', '').replace('.jpg', '');
    if (!short || short === p.image) continue; // not a product-* image
    const gallery = `/images/gallery-${short}-lifestyle.jpg,/images/gallery-${short}-detail.jpg`;
    await db.product.update({ where: { id: p.id }, data: { gallery } });
    console.log(`patched ${short}`);
  }
  console.log('GALLERY PATCH COMPLETE');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
