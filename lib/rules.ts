import {
  Prisma,
  Rule,
  RuleMatchField,
  RuleMatchType,
  TransactionType,
} from "@prisma/client";
import { prisma } from "@budget/lib/prisma";
import {
    ensureDefaultCategory,
    matchesRule,
    ruleFieldValue,
    syncBudgetSpentForMonth,
} from "@budget/lib/transactions";

type ApplyMode = "assign" | "clear";

type ApplyResult = {
  updated: number;
  affectedTransactionIds: string[];
};

const matchFieldToColumn: Record<RuleMatchField, keyof Prisma.TransactionWhereInput> = {
  [RuleMatchField.DESCRIPTION]: "description",
  [RuleMatchField.MERCHANT]: "merchant",
  [RuleMatchField.RAW]: "memo",
};

const buildFilter = (
  rule: Rule
): Prisma.StringFilter | Prisma.StringNullableFilter | undefined => {
  const value = rule.matchValue.trim();
  if (!value) return undefined;

  const baseFilter = {
    mode: "insensitive" as const,
  };

  switch (rule.matchType) {
    case RuleMatchType.EXACT:
      return { ...baseFilter, equals: value };
    case RuleMatchType.STARTS_WITH:
      return { ...baseFilter, startsWith: value };
    case RuleMatchType.ENDS_WITH:
      return { ...baseFilter, endsWith: value };
    case RuleMatchType.CONTAINS:
      return { ...baseFilter, contains: value };
    case RuleMatchType.REGEX:
    default:
      return undefined;
  }
};

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthKeyToDate = (key: string) => {
  const [year, month] = key.split("-").map((value) => Number.parseInt(value, 10));
  return new Date(year, month - 1, 1);
};

export const applyRuleToExistingTransactions = async (
  rule: Rule,
  mode: ApplyMode,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<ApplyResult> => {
  if (mode === "assign" && !rule.categoryId) {
    return { updated: 0, affectedTransactionIds: [] };
  }

  const column = matchFieldToColumn[rule.matchField] ?? "description";
  const filter = buildFilter(rule);

  const transactions = await tx.transaction.findMany({
    where: {
      type: TransactionType.EXPENSE,
      [column]: filter ?? { not: null },
    },
    select: {
      id: true,
      occurredOn: true,
      amount: true,
      categoryId: true,
      description: true,
      merchant: true,
      memo: true,
      splits: {
        select: { id: true, amount: true, memo: true, categoryId: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const defaultCategory =
    mode === "clear" ? await ensureDefaultCategory(tx) : null;

  const monthKeys = new Set<string>();
  const affectedTransactions: string[] = [];
  let updatedCount = 0;

  for (const transaction of transactions) {
    const candidate = ruleFieldValue(rule, {
      description: transaction.description,
      merchant: transaction.merchant,
      raw: transaction.memo ?? undefined,
    });

    if (!candidate || !matchesRule(rule, candidate)) {
      continue;
    }

    if (transaction.splits.length > 1) {
      // Skip complex transactions to avoid unexpected overrides.
      continue;
    }

    if (mode === "assign") {
      if (!rule.categoryId) continue;
      const targetCategoryId = rule.categoryId;
      const alreadyAssigned =
        transaction.categoryId === targetCategoryId &&
        transaction.splits.length === 1 &&
        transaction.splits[0]?.categoryId === targetCategoryId;

      if (alreadyAssigned) {
        continue;
      }

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { categoryId: targetCategoryId },
      });

      if (transaction.splits.length === 1) {
        await tx.transactionSplit.update({
          where: { id: transaction.splits[0].id },
          data: {
            categoryId: targetCategoryId,
            amount: new Prisma.Decimal(transaction.amount.toFixed(2)),
          },
        });
      } else {
        await tx.transactionSplit.deleteMany({
          where: { transactionId: transaction.id },
        });
        await tx.transactionSplit.create({
          data: {
            transactionId: transaction.id,
            categoryId: targetCategoryId,
            amount: new Prisma.Decimal(transaction.amount.toFixed(2)),
            memo: null,
          },
        });
      }

      monthKeys.add(monthKey(transaction.occurredOn));
      affectedTransactions.push(transaction.id);
      updatedCount += 1;
    } else if (mode === "clear") {
      if (!defaultCategory) continue;
      if (transaction.categoryId !== rule.categoryId) {
        continue;
      }

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { categoryId: defaultCategory.id },
      });

      if (transaction.splits.length === 1) {
        await tx.transactionSplit.update({
          where: { id: transaction.splits[0].id },
          data: {
            categoryId: defaultCategory.id,
            amount: new Prisma.Decimal(transaction.amount.toFixed(2)),
          },
        });
      } else {
        await tx.transactionSplit.deleteMany({
          where: { transactionId: transaction.id },
        });
        await tx.transactionSplit.create({
          data: {
            transactionId: transaction.id,
            categoryId: defaultCategory.id,
            amount: new Prisma.Decimal(transaction.amount.toFixed(2)),
            memo: null,
          },
        });
      }

      monthKeys.add(monthKey(transaction.occurredOn));
      affectedTransactions.push(transaction.id);
      updatedCount += 1;
    }
  }

  for (const key of monthKeys) {
    const date = monthKeyToDate(key);
    await syncBudgetSpentForMonth(date, tx);
  }

  return {
    updated: updatedCount,
    affectedTransactionIds: affectedTransactions,
  };
};
