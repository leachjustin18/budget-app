import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, RuleMatchField, RuleMatchType } from "@prisma/client";
import { prisma } from "@budget/lib/prisma";
import { applyRuleToExistingTransactions } from "@budget/lib/rules";
import { serializeRule } from "../serializer";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  matchField: z.nativeEnum(RuleMatchField).optional(),
  matchType: z.nativeEnum(RuleMatchType).optional(),
  matchValue: z.string().min(1).optional(),
  categoryId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  applyToExisting: z.boolean().optional(),
  reassignMode: z.enum(["assign", "clear"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { ruleId: string } }
) {
  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.rule.findUnique({
        where: { id: params.ruleId },
        include: { category: true },
      });

      if (!existing) {
        return null;
      }

      const updateData: {
        name?: string;
        matchField?: RuleMatchField;
        matchType?: RuleMatchType;
        matchValue?: string;
        categoryId?: string | null;
        isActive?: boolean;
      } = {};

      if (data.name !== undefined) {
        updateData.name = data.name.trim();
      }
      if (data.matchField !== undefined) {
        updateData.matchField = data.matchField;
      }
      if (data.matchType !== undefined) {
        updateData.matchType = data.matchType;
      }
      if (data.matchValue !== undefined) {
        updateData.matchValue = data.matchValue.trim();
      }
      if (data.categoryId !== undefined) {
        updateData.categoryId = data.categoryId;
      }
      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }

      const rule = await tx.rule.update({
        where: { id: params.ruleId },
        data: updateData,
        include: { category: true },
      });

      if (data.applyToExisting) {
        const mode =
          data.reassignMode ?? (rule.isActive ? "assign" : "clear");
        await applyRuleToExistingTransactions(
          rule,
          mode,
          tx
        );
      }

      return rule;
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Rule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ rule: serializeRule(updated) });
  } catch (error) {
    console.error("Failed to update rule", error);
    return NextResponse.json(
      { error: "Unable to update rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { ruleId: string } }
) {
  try {
    await prisma.rule.delete({
      where: { id: params.ruleId },
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Rule not found" },
        { status: 404 }
      );
    }
    console.error("Failed to delete rule", error);
    return NextResponse.json(
      { error: "Unable to delete rule" },
      { status: 500 }
    );
  }
}
