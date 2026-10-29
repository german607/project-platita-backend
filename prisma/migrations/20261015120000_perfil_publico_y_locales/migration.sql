-- CreateEnum
CREATE TYPE "MerchantCategory" AS ENUM ('CAFETERIA', 'BARBERIA_PELUQUERIA', 'PILATES_YOGA', 'PANADERIA', 'LAVADERO', 'OTRO');

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "category" "MerchantCategory",
ADD COLUMN     "categoryChangedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "openingHours" JSONB,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "visible" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "label" TEXT,
    "address" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Location_merchantId_active_idx" ON "Location"("merchantId", "active");

-- CreateIndex
CREATE INDEX "Merchant_visible_category_idx" ON "Merchant"("visible", "category");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
