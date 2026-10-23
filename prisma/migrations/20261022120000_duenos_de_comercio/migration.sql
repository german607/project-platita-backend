-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "Merchant_ownerId_idx" ON "Merchant"("ownerId");

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
