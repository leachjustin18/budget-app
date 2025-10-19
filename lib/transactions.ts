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
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
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

const UNITED_STATES_STATE_CODES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

const LOCATION_PLACEHOLDER_TOKENS = new Set([
  "USA",
  "US",
  "UNITED",
  "STATES",
  "UNITEDSTATES",
  "CANADA",
  "CA",
]);

const MERCHANT_OVERRIDES: Array<{ matcher: RegExp; name: string }> = [
  { matcher: /^(?:AMAZON|AMZN|AMAZN)/, name: "Amazon" },
  { matcher: /^MCDONALD/, name: "McDonalds" },
  { matcher: /^(?:WM|WAL[-\s]?MART|WALMART|WMT)/, name: "WalMart" },
  { matcher: /^TARGET/, name: "Target" },
  {
    matcher: /^(?:GOOGLE\s+)?YOUTUBEPREMIUM\b/,
    name: "YouTube Premium",
  },
  {
    matcher: /OPENAI\s+CHATGPT\s+SUBSCR?\b/,
    name: "ChatGPT Subscription",
  },
  { matcher: /^FAZOLIS\b/, name: "Fazolis" },
  { matcher: /^CASEY'?S\b/, name: "Caseys" },
  { matcher: /HOME\s+DEPOT/, name: "The Home Depot" },
  { matcher: /^PAPA\s+JOHN'?S\b/, name: "Papa Johns" },
];

const titleCaseWord = (word: string) => {
  if (!word) return word;
  if (/^[A-Z0-9&]+$/.test(word) && word.length <= 3) {
    return word;
  }
  const lower = word.toLowerCase();
  return lower.replace(/(^[a-z])|([-'][a-z])/g, (segment) =>
    segment.toUpperCase()
  );
};

export const sanitizeMerchantName = (input?: string | null): string => {
  if (!input) return "";

  const collapsed = input.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return "";
  }

  const collapsedUpper = collapsed.toUpperCase();
  for (const override of MERCHANT_OVERRIDES) {
    if (override.matcher.test(collapsedUpper)) {
      return override.name;
    }
  }

  const tokens = collapsed.split(/\s+/);
  let end = tokens.length;
  let removedLocation = false;

  while (end > 0) {
    const token = tokens[end - 1];
    const alphanumeric = token.replace(/[^A-Za-z0-9]/g, "");
    if (!alphanumeric) {
      end -= 1;
      removedLocation = true;
      continue;
    }

    const upperToken = alphanumeric.toUpperCase();
    if (
      UNITED_STATES_STATE_CODES.has(upperToken) ||
      LOCATION_PLACEHOLDER_TOKENS.has(upperToken) ||
      /\d/.test(alphanumeric)
    ) {
      end -= 1;
      removedLocation = true;
      continue;
    }

    if (
      removedLocation &&
      upperToken === token.toUpperCase() &&
      upperToken.length > 3 &&
      end > 2
    ) {
      end -= 1;
      continue;
    }

    break;
  }

  let candidate = tokens.slice(0, end).join(" ").trim();
  if (!candidate) {
    candidate = collapsed;
  }

  candidate = candidate.replace(/[,\-#]+$/g, "").trim();
  if (!candidate) {
    candidate = collapsed;
  }

  if (
    candidate === candidate.toUpperCase() &&
    /[A-Z]/.test(candidate)
  ) {
    candidate = candidate
      .split(/\s+/)
      .map(titleCaseWord)
      .join(" ");
  }

  const candidateUpper = candidate.toUpperCase();
  for (const override of MERCHANT_OVERRIDES) {
    if (override.matcher.test(candidateUpper)) {
      return override.name;
    }
  }

  return candidate;
};

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

export const ruleFieldValue = (
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

export const matchesRule = (rule: Rule, value: string): boolean => {
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
