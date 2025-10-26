-- Add merchantId column to transactions and wire foreign key to Merchant table
ALTER TABLE "Transaction"
ADD COLUMN "merchantId" TEXT;

CREATE INDEX "Transaction_merchantId_idx" ON "Transaction"("merchantId");

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_merchantId_fkey"
FOREIGN KEY ("merchantId")
REFERENCES "Merchant"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
