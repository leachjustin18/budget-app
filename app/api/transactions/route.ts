import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, TransactionOrigin, TransactionType } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@budget/lib/prisma";
import {
  computeTransactionFingerprint,
  ensureDefaultCategory,
  getMonthKey,
  linkTransactionToBudget,
  parseMonthKey,
  syncBudgetSpentForMonth,
  toISODate,
} from "@budget/lib/transactions";

const querySchema = z.object({
  month: z.string().optional(),
  search: z.string().optional(),
  limit: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .optional()
    .pipe(z.number().positive().int().max(500).optional()),
});

const DEFAULT_LIMIT = 200;

const transactionInclude = {
  category: true,
  splits: {
    include: {
      category: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  importBatch: true,
} satisfies Prisma.TransactionInclude;

const serializeAmount = (amount: Prisma.Decimal) => Number(amount.toFixed(2));

const mapTransaction = (
  transaction: Prisma.TransactionGetPayload<{
    include: typeof transactionInclude;
  }>
) => ({
  id: transaction.id,
  occurredOn: toISODate(transaction.occurredOn),
  postedOn: transaction.postedOn ? toISODate(transaction.postedOn) : null,
  amount: serializeAmount(transaction.amount),
  type: transaction.type,
  origin: transaction.origin,
  description: transaction.description ?? "",
  merchant: transaction.merchant ?? "",
  memo: transaction.memo ?? "",
  categoryId: transaction.categoryId,
  importBatchId: transaction.importBatchId,
  isPending: transaction.isPending,
  budgetId: transaction.budgetId,
  splits: transaction.splits.map((split) => ({
    id: split.id,
    amount: serializeAmount(split.amount),
    memo: split.memo ?? "",
    category: split.category
      ? {
          id: split.category.id,
          name: split.category.name,
          emoji: split.category.emoji ?? "✨",
          section: split.category.section,
        }
      : null,
  })),
});

const buildSearchFilter = (search: string): Prisma.TransactionWhereInput => {
  const trimmed = search.trim();
  if (!trimmed) return {};

  const filters: Prisma.TransactionWhereInput[] = [];

  filters.push({
    merchant: { contains: trimmed, mode: "insensitive" },
  });
  filters.push({
    description: { contains: trimmed, mode: "insensitive" },
  });
  filters.push({
    memo: { contains: trimmed, mode: "insensitive" },
  });

  const numericCandidate = Number.parseFloat(trimmed.replace(/[^0-9.-]/g, ""));
  if (Number.isFinite(numericCandidate)) {
    filters.push({
      amount: {
        equals: new Prisma.Decimal(Math.abs(numericCandidate)),
      },
    });
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const targetDate = new Date(`${trimmed}T00:00:00.000Z`);
    if (!Number.isNaN(targetDate.getTime())) {
      filters.push({
        occurredOn: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  return { OR: filters };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { month, search, limit } = parsed.data;

  const where: Prisma.TransactionWhereInput = {};
  let budgetMonth: Date | null = null;

  if (month) {
    const resolvedMonth = parseMonthKey(month);
    if (!resolvedMonth) {
      return NextResponse.json(
        { error: "Invalid month parameter" },
        { status: 400 }
      );
    }
    const monthStart = resolvedMonth;
    const monthEnd = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
    );
    budgetMonth = monthStart;
    where.occurredOn = {
      gte: monthStart,
      lt: monthEnd,
    };
  }

  if (search) {
    const searchFilter = buildSearchFilter(search);
    if (Object.keys(searchFilter).length > 0) {
      where.AND = [searchFilter];
    }
  }

  const resolvedLimit = limit ?? DEFAULT_LIMIT;

  const transactions = await prisma.transaction.findMany({
    where,
    include: transactionInclude,
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    take: resolvedLimit + 1,
  });

  const hasMore = transactions.length > resolvedLimit;
  const sliced = hasMore ? transactions.slice(0, resolvedLimit) : transactions;

  const categories = await prisma.category.findMany({
    where: { archivedAt: null },
    orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  const budgetAllocations = budgetMonth
    ? await prisma.budget.findFirst({
        where: { month: budgetMonth },
        include: {
          allocations: {
            include: {
              category: true,
            },
          },
        },
      })
    : null;

  // Ensure default category exists to surface on the client.
  await ensureDefaultCategory(prisma);

  return NextResponse.json({
    transactions: sliced.map(mapTransaction),
    hasMore,
    cursor: hasMore ? sliced[sliced.length - 1]?.id : null,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      emoji: category.emoji ?? "✨",
      section: category.section,
    })),
    budget: budgetAllocations
      ? {
          id: budgetAllocations.id,
          month: getMonthKey(budgetAllocations.month),
          allocations: budgetAllocations.allocations.map((allocation) => ({
            id: allocation.id,
            categoryId: allocation.categoryId,
            planned: Number(allocation.plannedAmount.toFixed(2)),
            spent: Number(allocation.spentAmount.toFixed(2)),
            category: {
              id: allocation.category.id,
              name: allocation.category.name,
              emoji: allocation.category.emoji ?? "✨",
              section: allocation.category.section,
            },
          })),
        }
      : null,
  });
}

const splitSchema = z.object({
  categoryId: z.string().optional().nullable(),
  amount: z.number().nonnegative(),
  memo: z.string().optional(),
});

const transactionPayloadSchema = z.object({
  occurredOn: z.string().min(1),
  postedOn: z.string().optional(),
  amount: z.number().positive(),
  type: z.nativeEnum(TransactionType).default(TransactionType.EXPENSE),
  merchant: z.string().optional(),
  description: z.string().optional(),
  memo: z.string().optional(),
  splits: z.array(splitSchema).min(1),
  isPending: z.boolean().optional(),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = transactionPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const occurredOn = new Date(`${data.occurredOn}T00:00:00.000Z`);
  if (Number.isNaN(occurredOn.getTime())) {
    return NextResponse.json(
      { error: "Invalid occurredOn date" },
      { status: 400 }
    );
  }

  const postedOn = data.postedOn
    ? new Date(`${data.postedOn}T00:00:00.000Z`)
    : null;
  if (postedOn && Number.isNaN(postedOn.getTime())) {
    return NextResponse.json(
      { error: "Invalid postedOn date" },
      { status: 400 }
    );
  }

  const sumOfSplits = data.splits.reduce((sum, split) => sum + split.amount, 0);
  const epsilon = 0.01;
  if (Math.abs(sumOfSplits - data.amount) > epsilon) {
    return NextResponse.json(
      {
        error: "Split amounts must equal transaction amount",
        expected: data.amount,
        received: sumOfSplits,
      },
      { status: 400 }
    );
  }

  const fingerprint = computeTransactionFingerprint({
    occurredOn,
    postedOn,
    amount: data.amount,
    merchant: data.merchant,
    description: data.description,
  });

  const existing = await prisma.transaction.findFirst({
    where: { fingerprint },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      {
        error: "Transaction already exists",
        transactionId: existing.id,
      },
      { status: 409 }
    );
  }

  const defaultCategory = await ensureDefaultCategory(prisma);

  const resolvedSplits = data.splits.map((split) => ({
    categoryId: split.categoryId ?? defaultCategory.id,
    amount: new Prisma.Decimal(split.amount.toFixed(2)),
    memo: split.memo ?? null,
  }));

  const transactionId = randomUUID();
  const externalId = `manual:${transactionId}`;

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        id: transactionId,
        occurredOn,
        postedOn,
        amount: new Prisma.Decimal(data.amount.toFixed(2)),
        type: data.type,
        origin: TransactionOrigin.MANUAL,
        description: data.description?.trim() || null,
        merchant: data.merchant?.trim() || null,
        memo: data.memo?.trim() || null,
        isPending: data.isPending ?? false,
        externalId,
        fingerprint,
        categoryId:
          resolvedSplits.length === 1 ? resolvedSplits[0].categoryId : null,
      },
    });

    for (const split of resolvedSplits) {
      await tx.transactionSplit.create({
        data: {
          transactionId: created.id,
          categoryId: split.categoryId,
          amount: split.amount,
          memo: split.memo,
        },
      });
    }

    await linkTransactionToBudget(occurredOn, created.id, tx);

    await syncBudgetSpentForMonth(occurredOn, tx);

    return created.id;
  });

  const createdTransaction = await prisma.transaction.findUnique({
    where: { id: result },
    include: transactionInclude,
  });

  if (!createdTransaction) {
    return NextResponse.json(
      { error: "Created transaction not found" },
      { status: 500 }
    );
  }

  return NextResponse.json({ transaction: mapTransaction(createdTransaction) });
}
