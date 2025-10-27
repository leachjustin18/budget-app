import { NextResponse } from "next/server";
import { prisma } from "@budget/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  const merchants = await prisma.merchant.findMany({
    where: query
      ? {
          canonicalName: {
            contains: query,
            mode: "insensitive",
          },
        }
      : {},
    orderBy: { canonicalName: "asc" },
    take: 20,
  });

  return NextResponse.json({
    merchants: merchants.map((merchant) => ({
      id: merchant.id,
      canonicalName: merchant.canonicalName,
    })),
  });
}
