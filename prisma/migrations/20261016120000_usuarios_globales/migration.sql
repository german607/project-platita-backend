-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- AlterTable (nullable mientras se completan las fichas que ya existen)
ALTER TABLE "Customer" ADD COLUMN     "userId" TEXT;

-- Datos existentes: un usuario por cada teléfono distinto, con el primer
-- nombre que algún comercio le haya anotado, y cada ficha lo referencia.
INSERT INTO "User" ("id", "phone", "name", "createdAt")
SELECT gen_random_uuid()::text,
       c."phone",
       (array_agg(c."name" ORDER BY c."createdAt") FILTER (WHERE c."name" IS NOT NULL))[1],
       MIN(c."createdAt")
FROM "Customer" c
GROUP BY c."phone";

UPDATE "Customer" c SET "userId" = u."id" FROM "User" u WHERE u."phone" = c."phone";

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Customer_userId_idx" ON "Customer"("userId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
