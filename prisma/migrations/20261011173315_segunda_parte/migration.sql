-- CreateIndex
CREATE INDEX "BonusRule_merchantId_active_idx" ON "BonusRule"("merchantId", "active");

-- CreateIndex
CREATE INDEX "Customer_merchantId_lastVisitAt_idx" ON "Customer"("merchantId", "lastVisitAt");

-- CreateIndex
CREATE INDEX "Transaction_customerId_createdAt_idx" ON "Transaction"("customerId", "createdAt");
