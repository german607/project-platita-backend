-- AlterTable
ALTER TABLE "BonusRule" ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "bonusRuleId" TEXT;

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_customerId_key_key" ON "IdempotencyKey"("customerId", "key");

-- CreateIndex
CREATE INDEX "Transaction_bonusRuleId_idx" ON "Transaction"("bonusRuleId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bonusRuleId_fkey" FOREIGN KEY ("bonusRuleId") REFERENCES "BonusRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
