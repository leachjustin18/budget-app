import { NextResponse } from "next/server";
import { z } from "zod";
import { CategorySection, RepeatCadence } from "@prisma/client";
import { prisma } from "@budget/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  emoji: z.string().optional(),
  section: z.enum(CategorySection).default(CategorySection.EXPENSES),
  carryForward: z.boolean().optional(),
  repeatCadence: z.enum(RepeatCadence).optional(),
});

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { archivedAt: null },
    orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      emoji: category.emoji ?? "✨",
      section: category.section,
      carryForwardDefault: category.carryForwardDefault,
      repeatCadenceDefault: category.repeatCadenceDefault,
    })),
  });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const nextSortOrder = await prisma.category.aggregate({
    where: { section: data.section },
    _max: { sortOrder: true },
  });

  const sortOrder = (nextSortOrder._max.sortOrder ?? 0) + 10;

  const created = await prisma.category.create({
    data: {
      name: data.name.trim(),
      emoji: data.emoji?.trim() || "✨",
      section: data.section,
      carryForwardDefault: data.carryForward ?? false,
      repeatCadenceDefault: data.repeatCadence ?? RepeatCadence.MONTHLY,
      sortOrder,
    },
  });

  return NextResponse.json({
    category: {
      id: created.id,
      name: created.name,
      emoji: created.emoji ?? "✨",
      section: created.section,
      carryForwardDefault: created.carryForwardDefault,
      repeatCadenceDefault: created.repeatCadenceDefault,
    },
  });
}
