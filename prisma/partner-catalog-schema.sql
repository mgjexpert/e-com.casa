-- Additive catalogue-only provisioning. Never alters order/payment tables.
-- CreateTable
CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "comparePrice" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "categorySlug" TEXT NOT NULL,
    "subcategorySlugs" TEXT NOT NULL DEFAULT '',
    "spaceSlugs" TEXT NOT NULL DEFAULT '',
    "styleSlugs" TEXT NOT NULL DEFAULT '',
    "collectionSlugs" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL,
    "hoverImage" TEXT,
    "gallery" TEXT NOT NULL DEFAULT '',
    "imageStatus" TEXT NOT NULL DEFAULT 'PLACEHOLDER',
    "badge" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stockKnown" BOOLEAN NOT NULL DEFAULT false,
    "stockUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "brand" TEXT,
    "manufacturer" TEXT,
    "supplierKey" TEXT,
    "supplierProductId" TEXT,
    "mediaRights" TEXT,
    "availability" TEXT NOT NULL DEFAULT 'inStock',
    "isBestSeller" BOOLEAN NOT NULL DEFAULT false,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "materials" TEXT,
    "dimensions" TEXT,
    "weight" TEXT,
    "care" TEXT,
    "color" TEXT,
    "shippingClass" TEXT NOT NULL DEFAULT 'STANDARD',
    "variantsJson" TEXT NOT NULL DEFAULT '[]',
    "electrical" BOOLEAN NOT NULL DEFAULT false,
    "battery" BOOLEAN NOT NULL DEFAULT false,
    "complianceStatus" TEXT NOT NULL DEFAULT 'DEMO',
    "reviewMode" TEXT NOT NULL DEFAULT 'demo',
    "documentationStatus" TEXT NOT NULL DEFAULT 'DEMO',
    "safetyJson" TEXT,
    "requiresComplianceReview" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "sourceResearchId" TEXT,
    "sourceDomain" TEXT,
    "sourceUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "image" TEXT,
    "subtitle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_categorySlug_idx" ON "Product"("categorySlug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_priceCents_idx" ON "Product"("priceCents");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_isDemo_idx" ON "Product"("isDemo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Category_slug_idx" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Category_type_slug_key" ON "Category"("type", "slug");

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockKnown" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockUnlimited" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "brand" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "manufacturer" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierKey" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierProductId" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mediaRights" TEXT;
