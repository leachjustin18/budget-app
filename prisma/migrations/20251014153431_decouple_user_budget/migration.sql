/*
  Warnings:

  - You are about to drop the column `userId` on the `Budget` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[month]` on the table `Budget` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Budget" DROP CONSTRAINT "Budget_userId_fkey";

-- DropIndex
DROP INDEX "public"."Budget_userId_month_key";

-- DropIndex
DROP INDEX "public"."Budget_userId_status_idx";

-- DropIndex
DROP INDEX "public"."Category_userId_archivedAt_idx";

-- DropIndex
DROP INDEX "public"."Category_userId_section_sortOrder_idx";

-- DropIndex
DROP INDEX "public"."ImportBatch_userId_importedAt_idx";

-- DropIndex
DROP INDEX "public"."Rule_userId_isActive_priority_idx";

-- DropIndex
DROP INDEX "public"."Transaction_userId_categoryId_idx";

-- DropIndex
DROP INDEX "public"."Transaction_userId_externalId_key";

-- DropIndex
DROP INDEX "public"."Transaction_userId_occurredOn_idx";

-- AlterTable
ALTER TABLE "Budget" DROP COLUMN "userId";

-- CreateIndex
CREATE INDEX "Budget_status_idx" ON "Budget"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_month_key" ON "Budget"("month");

-- CreateIndex
CREATE INDEX "Category_section_sortOrder_idx" ON "Category"("section", "sortOrder");

-- CreateIndex
CREATE INDEX "Category_archivedAt_idx" ON "Category"("archivedAt");

-- CreateIndex
CREATE INDEX "ImportBatch_importedAt_idx" ON "ImportBatch"("importedAt");

-- CreateIndex
CREATE INDEX "Rule_isActive_priority_idx" ON "Rule"("isActive", "priority");

-- CreateIndex
CREATE INDEX "Transaction_occurredOn_idx" ON "Transaction"("occurredOn");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_externalId_key" ON "Transaction"("externalId");
