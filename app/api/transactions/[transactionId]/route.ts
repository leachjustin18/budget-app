import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "@budget/lib/prisma";
import {
  computeTransactionFingerprint,
  ensureDefaultCategory,
  linkTransactionToBudget,
  syncBudgetSpentForMonth,
  toISODate,
} from "@budget/lib/transactions";

const transactionInclude = {
  category: true,
  splits: {
    include: { category: true },
    orderBy: { createdAt: "asc" as const },
  },
  importBatch: true,
} satisfies Prisma.TransactionInclude;

const splitSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  amount: z.number().nonnegative(),
  memo: z.string().optional().nullable(),
});

const updateSchema = z
  .object({
    amount: z.number().positive().optional(),
    type: z.enum(TransactionType).optional(),
    occurredOn: z.string().optional(),
    postedOn: z.string().nullable().optional(),
    merchant: z.string().optional(),
    description: z.string().optional(),
    memo: z.string().optional().nullable(),
    isPending: z.boolean().optional(),
    splits: z.array(splitSchema).optional(),
    applyRules: z.boolean().optional(),
  })
  .strict();

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

export async function GET(
  _request: Request,
  { params }: { params: { transactionId: string } }
) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: params.transactionId },
    include: transactionInclude,
  });

  if (!transaction) {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ transaction: mapTransaction(transaction) });
}

export async function PATCH(
  request: Request,
  { params }: { params: { transactionId: string } }
) {
  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({
        where: { id: params.transactionId },
        include: {
          splits: true,
        },
      });

      if (!existing) {
        return null;
      }

      const updates: Prisma.TransactionUpdateInput = {};

      const priorOccurredOn = existing.occurredOn;

      const nextAmountDecimal =
        data.amount !== undefined
          ? new Prisma.Decimal(data.amount.toFixed(2))
          : existing.amount;
      const nextAmountNumber =
        data.amount !== undefined
          ? data.amount
          : Number(existing.amount.toFixed(2));
      updates.amount = nextAmountDecimal;

      const nextType = data.type ?? existing.type;
      updates.type = nextType;

      const nextMerchant =
        data.merchant !== undefined
          ? data.merchant?.trim() || null
          : existing.merchant;
      updates.merchant = nextMerchant;

      const nextDescription =
        data.description !== undefined
          ? data.description?.trim() || null
          : existing.description;
      updates.description = nextDescription;

      const nextMemo =
        data.memo !== undefined ? data.memo?.trim() || null : existing.memo;
      updates.memo = nextMemo;

      const nextIsPending =
        data.isPending !== undefined ? data.isPending : existing.isPending;
      updates.isPending = nextIsPending;

      let nextOccurredOn = existing.occurredOn;
      if (data.occurredOn) {
        const parsedDate = new Date(`${data.occurredOn}T00:00:00.000Z`);
        if (Number.isNaN(parsedDate.getTime())) {
          throw new Error("Invalid occurredOn date");
        }
        nextOccurredOn = parsedDate;
        updates.occurredOn = parsedDate;
      }

      let nextPostedOn = existing.postedOn ?? null;
      if (data.postedOn !== undefined) {
        if (data.postedOn === null) {
          nextPostedOn = null;
          updates.postedOn = null;
        } else {
          const parsedDate = new Date(`${data.postedOn}T00:00:00.000Z`);
          if (Number.isNaN(parsedDate.getTime())) {
            throw new Error("Invalid postedOn date");
          }
          nextPostedOn = parsedDate;
          updates.postedOn = parsedDate;
        }
      }

      if (data.splits) {
        const defaultCategory = await ensureDefaultCategory(tx);
        const resolvedSplits = data.splits.map((split) => ({
          categoryId: split.categoryId ?? defaultCategory.id,
          amount: split.amount,
          memo: split.memo ?? null,
        }));

        const sum = resolvedSplits.reduce(
          (total, split) => total + split.amount,
          0
        );
        const epsilon = 0.01;
        if (Math.abs(sum - nextAmountNumber) > epsilon) {
          throw new Error("Split totals must equal transaction amount");
        }

        await tx.transactionSplit.deleteMany({
          where: { transactionId: existing.id },
        });

        for (const split of resolvedSplits) {
          await tx.transactionSplit.create({
            data: {
              transactionId: existing.id,
              categoryId: split.categoryId,
              amount: new Prisma.Decimal(split.amount.toFixed(2)),
              memo: split.memo,
            },
          });
        }
      }

      const fingerprint = computeTransactionFingerprint({
        occurredOn: nextOccurredOn,
        postedOn: nextPostedOn,
        amount: nextAmountDecimal,
        merchant: nextMerchant ?? undefined,
        description: nextDescription ?? undefined,
      });

      const duplicate = await tx.transaction.findFirst({
        where: {
          fingerprint,
          NOT: { id: existing.id },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new Error("Another transaction already matches these details");
      }

      updates.fingerprint = fingerprint;

      await tx.transaction.update({
        where: { id: existing.id },
        data: updates,
      });

      await linkTransactionToBudget(nextOccurredOn, existing.id, tx);

      await syncBudgetSpentForMonth(priorOccurredOn, tx);
      await syncBudgetSpentForMonth(nextOccurredOn, tx);

      return existing.id;
    });

    if (!result) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.transaction.findUnique({
      where: { id: result },
      include: transactionInclude,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ transaction: mapTransaction(updated) });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Unable to update transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { transactionId: string } }
) {
  try {
    const transaction = await prisma.transaction.delete({
      where: { id: params.transactionId },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Transaction deleted" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Unable to delete transaction" },
      { status: 500 }
    );
  }
}
