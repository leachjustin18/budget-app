import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveMerchant } from "@budget/lib/merchantService";
import { prisma } from "@budget/lib/prisma";
import { sanitizeMerchantName } from "@budget/lib/transactions";
import { normalizeMerchantKey } from "@budget/lib/merchantNormalization";

const schema = z.object({
  normalizedKey: z.string().min(1, "normalizedKey is required"),
  canonicalName: z.string().min(1, "canonicalName is required"),
  rawName: z.string().optional(),
  yelpId: z.string().optional(),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { normalizedKey, canonicalName, rawName, yelpId } = parsed.data;
  const sanitizedCanonical = sanitizeMerchantName(canonicalName);
  const sanitizedRaw = rawName ? sanitizeMerchantName(rawName) : null;

  if (!sanitizedCanonical) {
    return NextResponse.json(
      { error: "Unable to determine canonical name" },
      { status: 400 }
    );
  }

  try {
    const resolution = await resolveMerchant(
      rawName?.trim() || sanitizedCanonical,
      {
        canonicalName: sanitizedCanonical,
        yelpId: yelpId?.trim() || null,
      }
    );

    if (!resolution) {
      return NextResponse.json(
        { error: "Unable to resolve merchant" },
        { status: 500 }
      );
    }

    const possibleMatches = new Set<string>();
    possibleMatches.add(sanitizedCanonical);
    if (sanitizedRaw) {
      possibleMatches.add(sanitizedRaw);
    }

    await prisma.transaction.updateMany({
      where: {
        merchantId: null,
        merchant: { in: Array.from(possibleMatches).filter(Boolean) },
      },
      data: {
        merchantId: resolution.merchantId,
        merchant: resolution.canonicalName,
      },
    });

    const normalizedTarget = normalizeMerchantKey(
      resolution.normalizedKey || normalizedKey || sanitizedCanonical
    );

    if (normalizedTarget) {
      const pendingTransactions = await prisma.transaction.findMany({
        where: {
          merchantId: null,
          merchant: { not: null },
        },
        select: { id: true, merchant: true },
      });

      const matchingIds = pendingTransactions
        .filter((transaction) =>
          transaction.merchant
            ? normalizeMerchantKey(transaction.merchant) === normalizedTarget
            : false
        )
        .map((transaction) => transaction.id);

      if (matchingIds.length > 0) {
        await prisma.transaction.updateMany({
          where: { id: { in: matchingIds } },
          data: {
            merchantId: resolution.merchantId,
            merchant: resolution.canonicalName,
          },
        });
      }
    }

    return NextResponse.json({
      merchant: {
        id: resolution.merchantId,
        canonicalName: resolution.canonicalName,
        normalizedKey: resolution.normalizedKey || normalizedKey,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to resolve merchant",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
