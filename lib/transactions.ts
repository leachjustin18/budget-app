import { createHash } from "crypto";
import {
  Category,
  CategorySection,
  Prisma,
  RepeatCadence,
  Rule,
  RuleMatchField,
  RuleMatchType,
  TransactionOrigin,
  TransactionType,
} from "@prisma/client";
import { prisma } from "@budget/lib/prisma";

type DecimalLike = Prisma.Decimal | number | string;

const monthBoundary = (date: Date) => {
  const monthStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
  );
  const monthEnd = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
  );
  return { monthStart, monthEnd };
};

const normalizeAmount = (amount: DecimalLike): string => {
  const value =
    amount instanceof Prisma.Decimal
      ? Number(amount)
      : Number.parseFloat(`${amount}`);
  if (!Number.isFinite(value)) {
    return "0.00";
  }
  return value.toFixed(2);
};

const normalizeText = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

export const computeTransactionFingerprint = (input: {
  occurredOn: Date;
  amount: DecimalLike;
  merchant?: string | null;
  description?: string | null;
  postedOn?: Date | null;
}): string => {
  const dateKey = input.occurredOn.toISOString().slice(0, 10);
  const postedKey = input.postedOn?.toISOString().slice(0, 10) ?? "";
  const amountKey = normalizeAmount(input.amount);
  const merchantKey = normalizeText(input.merchant);
  const descriptionKey = normalizeText(input.description);

  const hash = createHash("sha1");
  hash.update(
    `${dateKey}|${postedKey}|${amountKey}|${merchantKey}|${descriptionKey}`
  );
  return hash.digest("hex");
};

export const ensureDefaultCategory = async (
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Category> => {
  const existing = await tx.category.findFirst({
    where: {
      name: { equals: "Uncategorized", mode: "insensitive" },
      archivedAt: null,
    },
  });

  if (existing) {
    return existing;
  }

  return tx.category.create({
    data: {
      name: "Uncategorized",
      emoji: "📂",
      section: CategorySection.EXPENSES,
      carryForwardDefault: false,
      repeatCadenceDefault: RepeatCadence.MONTHLY,
    },
  });
};

const ruleFieldValue = (
  rule: Rule,
  transaction: {
    description?: string | null;
    merchant?: string | null;
    raw?: string | null;
  }
) => {
  switch (rule.matchField) {
    case RuleMatchField.MERCHANT:
      return transaction.merchant ?? "";
    case RuleMatchField.RAW:
      return transaction.raw ?? "";
    case RuleMatchField.DESCRIPTION:
    default:
      return transaction.description ?? "";
  }
};

const matchesRule = (rule: Rule, value: string): boolean => {
  const normalizedTarget = value.trim();
  const normalizedValue = normalizedTarget.toLowerCase();
  const normalizedMatchValue = rule.matchValue.trim();
  const normalizedMatchLower = normalizedMatchValue.toLowerCase();

  switch (rule.matchType) {
    case RuleMatchType.EXACT:
      return normalizedTarget === rule.matchValue.trim();
    case RuleMatchType.STARTS_WITH:
      return normalizedValue.startsWith(normalizedMatchLower);
    case RuleMatchType.ENDS_WITH:
      return normalizedValue.endsWith(normalizedMatchLower);
    case RuleMatchType.REGEX:
      try {
        const exp = new RegExp(rule.matchValue, "i");
        return exp.test(value);
      } catch (error) {
        console.error("Invalid rule regex", { ruleId: rule.id, error });
        return false;
      }
    case RuleMatchType.CONTAINS:
    default:
      return normalizedValue.includes(normalizedMatchLower);
  }
};

export const resolveRuleCategory = (
  rules: Rule[],
  transaction: {
    description?: string | null;
    merchant?: string | null;
    raw?: string | null;
  }
): string | null => {
  for (const rule of rules) {
    if (!rule.isActive || !rule.categoryId) continue;
    const candidate = ruleFieldValue(rule, transaction);
    if (!candidate) continue;
    if (matchesRule(rule, candidate)) {
      return rule.categoryId;
    }
  }
  return null;
};

export const linkTransactionToBudget = async (
  date: Date,
  transactionId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) => {
  const { monthStart } = monthBoundary(date);
  const budget = await tx.budget.findFirst({
    where: { month: monthStart },
  });

  if (!budget) {
    return null;
  }

  await tx.transaction.update({
    where: { id: transactionId },
    data: { budgetId: budget.id },
  });

  return budget.id;
};

export const syncBudgetSpentForMonth = async (
  date: Date,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) => {
  const { monthStart, monthEnd } = monthBoundary(date);

  const budget = await tx.budget.findFirst({
    where: { month: monthStart },
    select: { id: true },
  });

  if (!budget) {
    return;
  }

  const categoryTotals = await tx.transactionSplit.groupBy({
    by: ["categoryId"],
    where: {
      categoryId: { not: null },
      transaction: {
        occurredOn: {
          gte: monthStart,
          lt: monthEnd,
        },
        type: TransactionType.EXPENSE,
      },
    },
    _sum: { amount: true },
  });

  const totalsByCategory = new Map<string, Prisma.Decimal>();
  for (const entry of categoryTotals) {
    if (!entry.categoryId || !entry._sum.amount) continue;
    totalsByCategory.set(entry.categoryId, entry._sum.amount);
  }

  const allocations = await tx.budgetAllocation.findMany({
    where: { budgetId: budget.id },
    select: { id: true, categoryId: true },
  });

  for (const allocation of allocations) {
    const total =
      totalsByCategory.get(allocation.categoryId) ?? new Prisma.Decimal(0);
    await tx.budgetAllocation.update({
      where: { id: allocation.id },
      data: { spentAmount: total },
    });
  }
};

export const transactionOriginFromType = (origin?: string | null) => {
  switch (origin) {
    case "import":
      return TransactionOrigin.IMPORT;
    case "adjustment":
      return TransactionOrigin.ADJUSTMENT;
    case "manual":
    default:
      return TransactionOrigin.MANUAL;
  }
};

export const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;

export const toISODate = (date: Date) => date.toISOString().slice(0, 10);

export const parseMonthKey = (monthKey: string): Date | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return null;
  }
  return new Date(year, month - 1, 1);
};
