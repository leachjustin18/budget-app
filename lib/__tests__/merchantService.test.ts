import test from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { resolveMerchant } from "@budget/lib/merchantService";

void test("resolveMerchant returns existing alias and refreshes raw name", async () => {
  const updateCalls: unknown[] = [];
  const findFirstCalls: unknown[] = [];

  const tx = {
    merchantAlias: {
      findFirst: async (query: unknown) => {
        findFirstCalls.push(query);
        return {
          merchantId: "merchant-1",
          rawName: "Old Merchant",
          merchant: {
            canonicalName: "Old Merchant",
            yelpId: null,
          },
        };
      },
      update: async (payload: unknown) => {
        updateCalls.push(payload);
      },
      upsert: async () => {},
    },
    merchant: {
      upsert: async () => ({}),
    },
  } as unknown as Prisma.TransactionClient;

  const result = await resolveMerchant("Newest Merchant LLC", {
    tx,
  });

  assert.deepStrictEqual(result, {
    merchantId: "merchant-1",
    canonicalName: "Old Merchant",
    normalizedKey: "newestmerchant",
  });
  assert.strictEqual(findFirstCalls.length, 1);
  assert.deepStrictEqual(updateCalls, [
    {
      where: {
        merchantId_normalized: {
          merchantId: "merchant-1",
                normalized: "newestmerchant",
        },
      },
      data: {
        rawName: "Newest Merchant LLC",
      },
    },
  ]);
});

void test("resolveMerchant creates a new merchant and alias when none exists", async () => {
  const merchantUpsertCalls: unknown[] = [];
  const aliasUpsertCalls: unknown[] = [];

  const tx = {
    merchantAlias: {
      findFirst: async () => null,
      update: async () => {},
      upsert: async (payload: unknown) => {
        aliasUpsertCalls.push(payload);
        return {};
      },
    },
    merchant: {
      upsert: async (payload: unknown) => {
        merchantUpsertCalls.push(payload);
        return {
          id: "merchant-2",
          canonicalName: "Newest Merchant Llc",
          yelpId: "yelp-123",
        };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const result = await resolveMerchant("Newest Merchant LLC", {
    tx,
    yelpId: "yelp-123",
  });

  assert.deepStrictEqual(result, {
    merchantId: "merchant-2",
    canonicalName: "Newest Merchant Llc",
    normalizedKey: "newestmerchant",
  });
  assert.strictEqual(merchantUpsertCalls.length, 1);
  assert.strictEqual(aliasUpsertCalls.length, 1);
  assert.deepStrictEqual(aliasUpsertCalls[0], {
    where: {
      merchantId_normalized: {
        merchantId: "merchant-2",
        normalized: "newestmerchant",
      },
    },
    update: {
      rawName: "Newest Merchant LLC",
      yelpId: "yelp-123",
    },
    create: {
        merchantId: "merchant-2",
        rawName: "Newest Merchant LLC",
        normalized: "newestmerchant",
        yelpId: "yelp-123",
    },
  });
});
