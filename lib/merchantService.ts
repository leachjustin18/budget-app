import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@budget/lib/prisma";
import {
  merchantAliasComponents,
  normalizeMerchantKey,
  canonicalizeMerchantName,
} from "@budget/lib/merchantNormalization";

export type MerchantAliasInput = {
  normalizedKey: string;
  rawName: string;
  canonicalName: string;
  yelpId?: string | null;
};

export type MerchantAliasResult = {
  merchantId: string;
  canonicalName: string;
  yelpId: string | null;
};

export const upsertMerchantAlias = async (
  input: MerchantAliasInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<MerchantAliasResult> => {
  const { normalizedKey, rawName, canonicalName, yelpId } = input;

  const merchant = await tx.merchant.upsert({
    where: { canonicalName },
    update: yelpId ? { yelpId } : {},
    create: {
      canonicalName,
      yelpId: yelpId ?? null,
    },
  });

  await tx.merchantAlias.upsert({
    where: {
      merchantId_normalized: {
        merchantId: merchant.id,
        normalized: normalizedKey,
      },
    },
    update: {
      rawName,
      ...(yelpId ? { yelpId } : {}),
    },
    create: {
      merchantId: merchant.id,
      rawName,
      normalized: normalizedKey,
      yelpId: yelpId ?? null,
    },
  });

  return {
    merchantId: merchant.id,
    canonicalName: merchant.canonicalName,
    yelpId: yelpId ?? merchant.yelpId ?? null,
  };
};

export type MerchantResolution = {
  merchantId: string;
  canonicalName: string;
  normalizedKey: string;
};

type ResolveMerchantOptions = {
  tx?: Prisma.TransactionClient | typeof prisma;
  canonicalName?: string;
  yelpId?: string | null;
  createIfMissing?: boolean;
};

export const resolveMerchant = async (
  rawName?: string | null,
  options?: ResolveMerchantOptions
): Promise<MerchantResolution | null> => {
  const trimmed = rawName?.trim();
  if (!trimmed) {
    return null;
  }

  const tx = options?.tx ?? prisma;
  const { normalizedKey, canonicalName: canonicalFromComponents } =
    merchantAliasComponents(trimmed);

  const normalized =
    normalizeMerchantKey(trimmed) || normalizedKey || canonicalFromComponents;

  if (!normalized) {
    return null;
  }

  const existing = await tx.merchantAlias.findFirst({
    where: { normalized },
    include: { merchant: true },
  });

  if (existing) {
    if (existing.rawName !== trimmed) {
      // keep latest raw variant for analytics/search
      await tx.merchantAlias.update({
        where: {
          merchantId_normalized: {
            merchantId: existing.merchantId,
            normalized,
          },
        },
        data: { rawName: trimmed },
      });
    }

    return {
      merchantId: existing.merchantId,
      canonicalName: existing.merchant.canonicalName,
      normalizedKey: normalized,
    };
  }

  if (options?.createIfMissing === false) {
    return null;
  }

  const canonical =
    options?.canonicalName?.trim() ||
    canonicalFromComponents ||
    canonicalizeMerchantName(trimmed);

  if (!canonical) {
    return null;
  }

  const result = await upsertMerchantAlias(
    {
      normalizedKey: normalized,
      rawName: trimmed,
      canonicalName: canonical,
      yelpId: options?.yelpId ?? null,
    },
    tx
  );

  return {
    merchantId: result.merchantId,
    canonicalName: result.canonicalName,
    normalizedKey: normalized,
  };
};
