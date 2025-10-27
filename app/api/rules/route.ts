import { NextResponse } from "next/server";
import { z } from "zod";
import { RuleMatchField, RuleMatchType } from "@prisma/client";
import { prisma } from "@budget/lib/prisma";
import { applyRuleToExistingTransactions } from "@budget/lib/rules";
import { serializeRule } from "./serializer";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  matchField: z.nativeEnum(RuleMatchField),
  matchType: z.nativeEnum(RuleMatchType),
  matchValue: z.string().min(1, "Match value is required"),
  categoryId: z.string().min(1, "Category is required"),
  isActive: z.boolean().optional(),
  applyToExisting: z.boolean().optional(),
});

export async function GET() {
  const rules = await prisma.rule.findMany({
    include: { category: true },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({
    rules: rules.map(serializeRule),
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

  try {
    const created = await prisma.$transaction(async (tx) => {
      const rule = await tx.rule.create({
        data: {
          name: data.name.trim(),
          matchField: data.matchField,
          matchType: data.matchType,
          matchValue: data.matchValue.trim(),
          categoryId: data.categoryId,
          isActive: data.isActive ?? true,
        },
        include: { category: true },
      });

      if (rule.isActive && data.applyToExisting) {
        await applyRuleToExistingTransactions(rule, "assign", tx);
      }

      return rule;
    });

    return NextResponse.json({ rule: serializeRule(created) }, { status: 201 });
  } catch (error) {
    console.error("Failed to create rule", error);
    return NextResponse.json(
      { error: "Unable to create rule" },
      { status: 500 }
    );
  }
}
