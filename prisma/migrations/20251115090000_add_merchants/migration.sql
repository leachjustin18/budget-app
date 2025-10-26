-- Create Merchant table
CREATE TABLE "Merchant" (
  "id" TEXT NOT NULL,
  "canonicalName" TEXT NOT NULL,
  "yelpId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Merchant_canonicalName_key" ON "Merchant"("canonicalName");
CREATE UNIQUE INDEX "Merchant_yelpId_key" ON "Merchant"("yelpId");

-- Create MerchantAlias table
CREATE TABLE "MerchantAlias" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "rawName" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "yelpId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantAlias_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantAlias_merchantId_fkey" FOREIGN KEY ("merchantId")
    REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MerchantAlias_normalized_idx" ON "MerchantAlias"("normalized");
CREATE UNIQUE INDEX "MerchantAlias_merchantId_normalized_key" ON "MerchantAlias"("merchantId", "normalized");
