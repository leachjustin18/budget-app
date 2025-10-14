-- DropForeignKey
ALTER TABLE "public"."Category" DROP CONSTRAINT "Category_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ImportBatch" DROP CONSTRAINT "ImportBatch_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Rule" DROP CONSTRAINT "Rule_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Transaction" DROP CONSTRAINT "Transaction_userId_fkey";
