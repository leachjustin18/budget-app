/*
  Warnings:

  - You are about to drop the column `postedOn` on the `Transaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Merchant" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MerchantAlias" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "postedOn";
