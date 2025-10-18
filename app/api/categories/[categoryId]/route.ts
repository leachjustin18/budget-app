import { NextResponse } from "next/server";
import { z } from "zod";
import { CategorySection, Prisma, RepeatCadence } from "@prisma/client";
import { prisma } from "@budget/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  emoji: z.string().optional(),
  section: z.nativeEnum(CategorySection).optional(),
  carryForwardDefault: z.boolean().optional(),
  repeatCadenceDefault: z.nativeEnum(RepeatCadence).optional(),
});

const deleteSchema = z
  .object({
    transactionsTargetId: z.string().min(1).optional(),
    budgetTargetId: z.string().min(1).optional(),
  })
  .optional();

const serializeCategory = (category: {
  id: string;
  name: string;
  emoji: string | null;
  section: CategorySection;
  carryForwardDefault: boolean;
  repeatCadenceDefault: RepeatCadence;
  _count: {
    allocations: number;
    transactions: number;
    transactionSplits: number;
    rules: number;
  };
}) => ({
  id: category.id,
  name: category.name,
  emoji: category.emoji ?? "✨",
  section: category.section,
  carryForwardDefault: category.carryForwardDefault,
  repeatCadenceDefault: category.repeatCadenceDefault,
  usage: {
    budgets: category._count.allocations,
    transactions: category._count.transactions,
    transactionSplits: category._count.transactionSplits,
    rules: category._count.rules,
  },
});

const usageSelect = {
  allocations: true,
  transactions: true,
  transactionSplits: true,
  rules: true,
} as const;

export async function PATCH(
  request: Request,
  { params }: { params: { categoryId: string } }
) {
  const awaitedParams = await params;
  const categoryId = awaitedParams.categoryId;
  if (!categoryId) {
    return NextResponse.json({ error: "Category id missing" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates = parsed.data;

  if (!updates || Object.keys(updates).length === 0) {
    const existing = await prisma.category.findUnique({
      where: { id: categoryId, archivedAt: null },
      include: { _count: { select: usageSelect } },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ category: serializeCategory(existing) });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id: categoryId, archivedAt: null },
      });

      if (!category) {
        throw new Error("NOT_FOUND");
      }

      const payload: Prisma.CategoryUpdateInput = {};

      if (updates.name !== undefined) {
        payload.name = updates.name.trim();
      }

      if (updates.emoji !== undefined) {
        const trimmed = updates.emoji.trim();
        payload.emoji = trimmed.length > 0 ? trimmed : "✨";
      }

      if (updates.section && updates.section !== category.section) {
        payload.section = updates.section;
        const nextSortOrder = await tx.category.aggregate({
          where: { section: updates.section, archivedAt: null },
          _max: { sortOrder: true },
        });
        payload.sortOrder = (nextSortOrder._max.sortOrder ?? 0) + 10;
      }

      if (updates.carryForwardDefault !== undefined) {
        payload.carryForwardDefault = updates.carryForwardDefault;
      }

      if (updates.repeatCadenceDefault !== undefined) {
        payload.repeatCadenceDefault = updates.repeatCadenceDefault;
      }

      const result = await tx.category.update({
        where: { id: categoryId },
        data: payload,
        include: { _count: { select: usageSelect } },
      });

      return result;
    });

    return NextResponse.json({ category: serializeCategory(updated) });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }
    console.error("Failed to update category", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { categoryId: string } }
) {
  const awaitedParams = await params;
  const categoryId = awaitedParams.categoryId;
  if (!categoryId) {
    return NextResponse.json({ error: "Category id missing" }, { status: 400 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { transactionsTargetId, budgetTargetId } = parsed.data ?? {};

  if (
    (transactionsTargetId && transactionsTargetId === categoryId) ||
    (budgetTargetId && budgetTargetId === categoryId)
  ) {
    return NextResponse.json(
      { error: "Cannot target the same category" },
      { status: 400 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id: categoryId, archivedAt: null },
        include: { _count: { select: usageSelect } },
      });

      if (!category) {
        throw new Error("NOT_FOUND");
      }

      let transactionsTarget = null;
      if (transactionsTargetId) {
        transactionsTarget = await tx.category.findFirst({
          where: { id: transactionsTargetId, archivedAt: null },
          select: { id: true },
        });
        if (!transactionsTarget) {
          throw new Error("TRANSACTION_TARGET_NOT_FOUND");
        }
      }

      let budgetTarget: { id: string; section: CategorySection } | null = null;
      if (budgetTargetId) {
        budgetTarget = await tx.category.findFirst({
          where: { id: budgetTargetId, archivedAt: null },
          select: { id: true, section: true },
        });
        if (!budgetTarget) {
          throw new Error("BUDGET_TARGET_NOT_FOUND");
        }
      }

      if (
        category._count.transactions > 0 ||
        category._count.transactionSplits > 0
      ) {
        await tx.transaction.updateMany({
          where: { categoryId },
          data: { categoryId: transactionsTargetId ?? null },
        });
        await tx.transactionSplit.updateMany({
          where: { categoryId },
          data: { categoryId: transactionsTargetId ?? null },
        });
      }

      if (category._count.rules > 0) {
        await tx.rule.updateMany({
          where: { categoryId },
          data: { categoryId: transactionsTargetId ?? null },
        });
      }

      if (category._count.allocations > 0) {
        if (budgetTarget) {
          const allocations = await tx.budgetAllocation.findMany({
            where: { categoryId },
            select: {
              id: true,
              budgetId: true,
              plannedAmount: true,
              spentAmount: true,
              carryForward: true,
              repeatCadence: true,
            },
          });

          if (allocations.length > 0) {
            const targetAllocations = await tx.budgetAllocation.findMany({
              where: {
                categoryId: budgetTarget.id,
                budgetId: { in: allocations.map((item) => item.budgetId) },
              },
            });

            const targetMap = new Map(
              targetAllocations.map((item) => [item.budgetId, item])
            );

            for (const allocation of allocations) {
              const existing = targetMap.get(allocation.budgetId);
              if (existing) {
                await tx.budgetAllocation.update({
                  where: { id: existing.id },
                  data: {
                    plannedAmount: new Prisma.Decimal(
                      Number(existing.plannedAmount) +
                        Number(allocation.plannedAmount)
                    ),
                    spentAmount: new Prisma.Decimal(
                      Number(existing.spentAmount) +
                        Number(allocation.spentAmount)
                    ),
                  },
                });
                await tx.budgetAllocation.delete({
                  where: { id: allocation.id },
                });
              } else {
                await tx.budgetAllocation.update({
                  where: { id: allocation.id },
                  data: {
                    categoryId: budgetTarget.id,
                    section: budgetTarget.section,
                  },
                });
              }
            }
          }
        } else {
          await tx.budgetAllocation.deleteMany({
            where: { categoryId },
          });
        }
      }

      await tx.category.update({
        where: { id: categoryId },
        data: { archivedAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        );
      }
      if (error.message === "TRANSACTION_TARGET_NOT_FOUND") {
        return NextResponse.json(
          { error: "Transactions target category not found" },
          { status: 400 }
        );
      }
      if (error.message === "BUDGET_TARGET_NOT_FOUND") {
        return NextResponse.json(
          { error: "Budget target category not found" },
          { status: 400 }
        );
      }
    }
    console.error("Failed to delete category", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
