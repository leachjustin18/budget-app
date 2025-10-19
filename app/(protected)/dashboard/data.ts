"use server";

import { CategorySection, TransactionType, type Prisma } from "@prisma/client";
import { prisma } from "@budget/lib/prisma";
import { getMonthKey } from "@budget/lib/transactions";

/**
 * Tunables
 */
const CATEGORY_VARIANCE_THRESHOLD = 0.12;
const TREND_STD_THRESHOLD = 2;
const TREND_PERCENT_THRESHOLD = 0.25;
const TREND_MONTH_WINDOW = 6;
const FORECAST_LOOKAHEAD = 3;
const TOP_VENDOR_LIMIT = 8;
const TOP_TRANSACTION_LIMIT = 8;
const MAX_MONTH_GUARD = 48;
const UNCATEGORIZED_KEY = "__uncategorized__";

/**
 * Formatters (local-time aware where relevant)
 */
const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
});

const monthLongFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Domain types
 */
type SectionKey = "expenses" | "recurring" | "savings" | "debt";

const SECTION_LABELS: Record<SectionKey, string> = {
  expenses: "Living & Flexible",
  recurring: "Recurring Bills",
  savings: "Savings Goals",
  debt: "Debt Payments",
};

const sectionKeyFromDb: Record<CategorySection, SectionKey> = {
  [CategorySection.EXPENSES]: "expenses",
  [CategorySection.RECURRING]: "recurring",
  [CategorySection.SAVINGS]: "savings",
  [CategorySection.DEBT]: "debt",
};

type CategoryMeta = {
  name: string;
  emoji: string;
  section: SectionKey;
};

type CategoryMonthSnapshot = {
  planned: number | null;
  budgetActual: number | null;
  transactionActual: number;
};

type CategoryRollup = {
  meta: CategoryMeta;
  months: Map<string, CategoryMonthSnapshot>;
};

type MonthDescriptor = {
  monthKey: string;
  label: string;
  longLabel: string;
  monthStart: string;
  monthEnd: string;
  isCurrent: boolean;
  isFuture: boolean;
  hasPlan: boolean;
  hasActuals: boolean;
};

type MonthSeries = {
  monthKey: string;
  monthStart: string;
  monthEnd: string;
  label: string;
  plannedIncome: number | null;
  plannedExpense: number | null;
  plannedNet: number | null;
  actualIncome: number;
  actualExpense: number;
  actualNet: number;
  varianceExpense: number | null;
  varianceIncome: number | null;
  isFuture: boolean;
  sections: Array<{
    section: SectionKey;
    label: string;
    planned: number | null;
    actual: number;
  }>;
};

type CategoryPlanActualEntry = {
  categoryId: string;
  name: string;
  emoji: string;
  section: SectionKey;
  planned: number | null;
  actual: number;
  variance: number | null;
  variancePercent: number | null;
  share: number;
  overThreshold: boolean;
  underThreshold: boolean;
  fill?: string;
};

type CategoryTrendPoint = {
  monthKey: string;
  label: string;
  actual: number;
  change: number | null;
  percentChange: number | null;
  zScore: number | null;
};

type CategoryTrendEntry = {
  categoryId: string;
  name: string;
  emoji: string;
  section: SectionKey;
  points: CategoryTrendPoint[];
  flagged: boolean;
};

type ForecastPoint = {
  monthKey: string;
  label: string;
  actualIncome: number;
  actualExpense: number;
  plannedIncome: number | null;
  plannedExpense: number | null;
  netActual: number;
  netPlanned: number | null;
  baselineNet: number;
  isFuture: boolean;
  atRisk: boolean;
};

type BurnDownPoint = {
  day: number;
  date: string;
  dailyActual: number;
  cumulativeActual: number;
  cumulativeTarget: number | null;
  variance: number | null;
  variancePercent: number | null;
  isToday: boolean;
  isOverTarget: boolean;
};

type BurnDown = {
  monthKey: string;
  label: string;
  plannedTotal: number | null;
  actualTotal: number;
  remainingBudget: number | null;
  dailyAllowance: number | null;
  daysRemaining: number;
  hasOverrun: boolean;
  points: BurnDownPoint[];
};

type VendorInsight = {
  key: string;
  label: string;
  total: number;
  count: number;
  average: number;
  href: string;
};

type TransactionInsight = {
  id: string;
  occurredOn: string;
  label: string;
  vendor: string;
  amount: number;
  href: string;
};

type GoalProgressEntry = {
  categoryId: string;
  name: string;
  emoji: string;
  section: SectionKey;
  target: number | null;
  actual: number;
  variance: number | null;
  progress: number | null;
  direction: "ahead" | "behind" | "on_track";
};

type AnomalyInsightType =
  | "spending"
  | "income"
  | "plan"
  | "category"
  | "forecast";

type AnomalyInsightSeverity = "info" | "warning" | "critical";

type AnomalyInsight = {
  id: string;
  type: AnomalyInsightType;
  severity: AnomalyInsightSeverity;
  monthKey: string;
  label: string;
  delta: number;
  percent: number | null;
  message: string;
  detail?: string;
  categoryId?: string;
  vendorKey?: string;
};

type SummaryData = {
  currentMonth: {
    label: string;
    plannedExpense: number | null;
    actualExpense: number;
    plannedIncome: number | null;
    actualIncome: number;
    varianceExpense: number | null;
    varianceIncome: number | null;
  };
  previousComparison?: {
    label: string;
    actualExpense: number;
    change: number;
    percentChange: number | null;
    direction: "up" | "down" | "flat";
  };
  highlightedCategories: Array<{
    categoryId: string;
    name: string;
    variance: number;
    variancePercent: number | null;
    direction: "over" | "under";
  }>;
  atRiskMonths: Array<{
    monthKey: string;
    label: string;
    net: number;
  }>;
};

export type DashboardData = {
  months: MonthDescriptor[];
  monthlySeries: MonthSeries[];
  categoryPlanActual: {
    monthKey: string;
    categories: CategoryPlanActualEntry[];
    totalPlanned: number | null;
    totalActual: number;
    varianceThreshold: number;
  };
  categoryShare: {
    monthKey: string;
    total: number;
    items: CategoryPlanActualEntry[];
  };
  categoryHistory: Array<{
    monthKey: string;
    label: string;
    totalActual: number;
    totalPlanned: number | null;
    categories: CategoryPlanActualEntry[];
  }>;
  categoryTrends: {
    monthKeys: string[];
    categories: CategoryTrendEntry[];
    stdDevThreshold: number;
    percentThreshold: number;
  };
  forecast: {
    months: ForecastPoint[];
    baselineNet: number;
  };
  burnDown: BurnDown;
  topVendors: {
    monthKey: string;
    vendors: VendorInsight[];
    transactions: TransactionInsight[];
  };
  savingsProgress: {
    savings: GoalProgressEntry[];
    debt: GoalProgressEntry[];
  };
  anomalies: AnomalyInsight[];
  summary: SummaryData;
  thresholds: {
    categoryVariance: number;
    trendStd: number;
    trendPercent: number;
  };
};

type StoredBudget = {
  plannedExpense: number;
  actualExpense: number;
  plannedIncome: number;
  allocations: Array<{
    categoryId: string;
    section: SectionKey;
    planned: number;
    spent: number;
  }>;
  sectionTotals: Record<
    SectionKey,
    {
      planned: number;
      spent: number;
    }
  >;
};

/**
 * Helpers
 */
const round = (value: number, fractionDigits = 2) =>
  Number.isFinite(value) ? Number(value.toFixed(fractionDigits)) : 0;

const toNumber = (
  value: Prisma.Decimal | number | null | undefined
): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
};

const safePercent = (num: number, den: number) =>
  Math.abs(den) > 0.000001 ? round(num / den, 4) : null;

// local time date helpers
const startOfLocalMonth = (date: Date) =>
  new Date(date.getUTCFullYear(), date.getUTCMonth(), 1);

const addMonthsLocal = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

const endOfLocalMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

const daysInLocalMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

const toLocalISODate = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(
    2,
    "0"
  )}-${`${date.getDate()}`.padStart(2, "0")}`;

const monthFromKey = (monthKey: string) => {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number.parseInt(yearStr, 10);
  const monthIndex = Number.parseInt(monthStr, 10) - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) {
    return new Date();
  }
  return new Date(year, monthIndex, 1);
};

const ensureCategoryRollup = (
  categoryId: string,
  meta: CategoryMeta,
  target: Map<string, CategoryRollup>
) => {
  if (!target.has(categoryId)) {
    target.set(categoryId, {
      meta,
      months: new Map(),
    });
  }
  return target.get(categoryId)!;
};

const ensureCategoryMonthSnapshot = (
  rollup: CategoryRollup,
  monthKey: string
) => {
  if (!rollup.months.has(monthKey)) {
    rollup.months.set(monthKey, {
      planned: null,
      budgetActual: null,
      transactionActual: 0,
    });
  }
  return rollup.months.get(monthKey)!;
};

const computeStats = (values: number[]) => {
  if (!values.length) {
    return { mean: 0, stdDev: 0 };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
};

/**
 * Main
 */
export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const currentMonthStart = startOfLocalMonth(now);
  const currentMonthKey = getMonthKey(currentMonthStart);

  const [budgets, categories, earliestTransaction, latestTransaction] =
    await Promise.all([
      prisma.budget.findMany({
        orderBy: { month: "asc" },
        include: {
          allocations: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  emoji: true,
                  section: true,
                },
              },
            },
          },
          incomes: true,
        },
      }),
      prisma.category.findMany({
        select: { id: true, name: true, emoji: true, section: true },
      }),
      prisma.transaction.findFirst({
        orderBy: { occurredOn: "asc" },
        select: { occurredOn: true },
      }),
      prisma.transaction.findFirst({
        orderBy: { occurredOn: "desc" },
        select: { occurredOn: true },
      }),
    ]);

  // category metadata
  const categoryMeta = new Map<string, CategoryMeta>();
  for (const category of categories) {
    categoryMeta.set(category.id, {
      name: category.name,
      emoji: category.emoji ?? "✨",
      section: sectionKeyFromDb[category.section] ?? "expenses",
    });
  }
  if (!categoryMeta.has(UNCATEGORIZED_KEY)) {
    categoryMeta.set(UNCATEGORIZED_KEY, {
      name: "Uncategorized",
      emoji: "📂",
      section: "expenses",
    });
  }

  const categoryRollup = new Map<string, CategoryRollup>();

  const budgetMonthStarts = budgets.map((budget) =>
    startOfLocalMonth(budget.month)
  );

  const earliestBudgetMonth = budgetMonthStarts[0] ?? null;
  const latestBudgetMonth =
    budgetMonthStarts[budgetMonthStarts.length - 1] ?? null;

  const earliestTransactionMonth = earliestTransaction
    ? startOfLocalMonth(earliestTransaction.occurredOn)
    : null;
  const latestTransactionMonth = latestTransaction
    ? startOfLocalMonth(latestTransaction.occurredOn)
    : null;

  const initialMonthCandidates = [
    currentMonthStart,
    earliestBudgetMonth,
    earliestTransactionMonth,
  ].filter(Boolean) as Date[];

  const earliestMonth =
    initialMonthCandidates.length > 0
      ? initialMonthCandidates.reduce((min, date) => (date < min ? date : min))
      : currentMonthStart;

  const latestMonthCandidates = [
    currentMonthStart,
    latestBudgetMonth,
    latestTransactionMonth,
  ].filter(Boolean) as Date[];

  const baseLatest =
    latestMonthCandidates.length > 0
      ? latestMonthCandidates.reduce((max, date) => (date > max ? date : max))
      : currentMonthStart;

  const forecastHorizon = addMonthsLocal(currentMonthStart, FORECAST_LOOKAHEAD);
  const latestMonth =
    baseLatest > forecastHorizon ? baseLatest : forecastHorizon;

  const monthSeriesAnchors: Date[] = [];
  let cursor = earliestMonth;
  let guard = 0;
  while (cursor <= latestMonth && guard < MAX_MONTH_GUARD) {
    monthSeriesAnchors.push(cursor);
    cursor = addMonthsLocal(cursor, 1);
    guard += 1;
  }
  if (!monthSeriesAnchors.length) {
    monthSeriesAnchors.push(currentMonthStart);
  }

  const rangeStart = monthSeriesAnchors[0];
  const rangeEnd = addMonthsLocal(
    monthSeriesAnchors[monthSeriesAnchors.length - 1],
    1
  );

  const transactionsInRange = await prisma.transaction.findMany({
    where: {
      occurredOn: {
        gte: rangeStart,
        lt: rangeEnd,
      },
      type: {
        in: [TransactionType.EXPENSE, TransactionType.INCOME],
      },
    },
    select: {
      id: true,
      occurredOn: true,
      amount: true,
      type: true,
      merchant: true,
      description: true,
      categoryId: true,
      splits: {
        select: {
          categoryId: true,
          amount: true,
        },
      },
    },
    orderBy: { occurredOn: "asc" },
  });

  // Budgets by month (planned & section totals)
  const budgetsByMonth = new Map<string, StoredBudget>();

  for (const budget of budgets) {
    const monthStart = startOfLocalMonth(budget.month);
    const monthKey = getMonthKey(monthStart);

    const sectionTotals: StoredBudget["sectionTotals"] = {
      expenses: { planned: 0, spent: 0 },
      recurring: { planned: 0, spent: 0 },
      savings: { planned: 0, spent: 0 },
      debt: { planned: 0, spent: 0 },
    };

    const allocations = budget.allocations.map((allocation) => {
      const section =
        sectionKeyFromDb[allocation.section] ?? ("expenses" as SectionKey);
      const planned = round(toNumber(allocation.plannedAmount));
      const spent = round(toNumber(allocation.spentAmount));

      sectionTotals[section].planned += planned;
      sectionTotals[section].spent += spent;

      const meta =
        categoryMeta.get(allocation.categoryId) ??
        categoryMeta.get(UNCATEGORIZED_KEY)!;

      const rollup = ensureCategoryRollup(
        allocation.categoryId,
        meta,
        categoryRollup
      );
      const snapshot = ensureCategoryMonthSnapshot(rollup, monthKey);
      snapshot.planned = planned;
      snapshot.budgetActual = spent;

      return {
        categoryId: allocation.categoryId,
        section,
        planned,
        spent,
      };
    });

    const plannedExpense = Object.values(sectionTotals).reduce(
      (sum, totals) => sum + totals.planned,
      0
    );

    const actualExpense = Object.values(sectionTotals).reduce(
      (sum, totals) => sum + totals.spent,
      0
    );

    const plannedIncome = round(
      budget.incomes.reduce<number>((sum, income) => {
        return sum + toNumber(income.amount);
      }, 0)
    );

    budgetsByMonth.set(monthKey, {
      plannedExpense: round(plannedExpense),
      actualExpense: round(actualExpense),
      plannedIncome,
      allocations,
      sectionTotals: {
        expenses: {
          planned: round(sectionTotals.expenses.planned),
          spent: round(sectionTotals.expenses.spent),
        },
        recurring: {
          planned: round(sectionTotals.recurring.planned),
          spent: round(sectionTotals.recurring.spent),
        },
        savings: {
          planned: round(sectionTotals.savings.planned),
          spent: round(sectionTotals.savings.spent),
        },
        debt: {
          planned: round(sectionTotals.debt.planned),
          spent: round(sectionTotals.debt.spent),
        },
      },
    });
  }

  // Monthly actuals aggregate
  const monthlyActuals = new Map<
    string,
    {
      income: number;
      expense: number;
    }
  >();

  for (const monthAnchor of monthSeriesAnchors) {
    monthlyActuals.set(getMonthKey(monthAnchor), { income: 0, expense: 0 });
  }

  // Daily totals, vendors, top transactions (for current month)
  const dailyTotals = new Map<number, number>();
  const vendorTotals = new Map<
    string,
    { label: string; total: number; count: number; transactionIds: string[] }
  >();
  const topTransactionBuffer: Array<{
    id: string;
    occurredOn: Date;
    amount: number;
    merchant: string;
    description: string | null;
  }> = [];

  for (const trx of transactionsInRange) {
    const monthKey = getMonthKey(startOfLocalMonth(trx.occurredOn));
    const monthlyBucket = monthlyActuals.get(monthKey);
    if (!monthlyBucket) continue;

    const amount = round(toNumber(trx.amount));

    if (trx.type === TransactionType.INCOME) {
      monthlyBucket.income += amount;
      continue;
    }

    monthlyBucket.expense += amount;

    const assignAmount = (categoryId: string, value: number) => {
      const meta =
        categoryMeta.get(categoryId) ?? categoryMeta.get(UNCATEGORIZED_KEY)!;
      const rollup = ensureCategoryRollup(categoryId, meta, categoryRollup);
      const snapshot = ensureCategoryMonthSnapshot(rollup, monthKey);
      snapshot.transactionActual += round(value);
    };

    if (trx.splits.length > 0) {
      for (const split of trx.splits) {
        assignAmount(
          split.categoryId ?? UNCATEGORIZED_KEY,
          toNumber(split.amount)
        );
      }
    } else {
      assignAmount(trx.categoryId ?? UNCATEGORIZED_KEY, amount);
    }

    if (monthKey === currentMonthKey) {
      const day = trx.occurredOn.getDate();
      dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + amount);

      const vendorLabel =
        trx.merchant?.trim() || trx.description?.trim() || "Unlabeled merchant";
      const vendorKey = vendorLabel.toLowerCase();
      const vendor = vendorTotals.get(vendorKey) ?? {
        label: vendorLabel,
        total: 0,
        count: 0,
        transactionIds: [] as string[],
      };
      vendor.total += amount;
      vendor.count += 1;
      vendor.transactionIds.push(trx.id);
      vendorTotals.set(vendorKey, vendor);

      topTransactionBuffer.push({
        id: trx.id,
        occurredOn: trx.occurredOn,
        amount,
        merchant: vendorLabel,
        description: trx.description?.trim() ?? null,
      });
    }
  }

  // Section actuals by month (derived from category rollups)
  const sectionActualsByMonth = new Map<string, Record<SectionKey, number>>();
  for (const rollup of categoryRollup.values()) {
    const { section } = rollup.meta;
    for (const [monthKey, snapshot] of rollup.months.entries()) {
      const actual = round(
        Math.max(snapshot.budgetActual ?? 0, snapshot.transactionActual)
      );
      if (!sectionActualsByMonth.has(monthKey)) {
        sectionActualsByMonth.set(monthKey, {
          expenses: 0,
          recurring: 0,
          savings: 0,
          debt: 0,
        });
      }
      const sectionTotals = sectionActualsByMonth.get(monthKey)!;
      sectionTotals[section] += actual;
    }
  }

  // Monthly series assembly
  const monthSeriesMap = new Map<string, MonthSeries>();
  const monthlySeries: MonthSeries[] = monthSeriesAnchors.map((month) => {
    const monthKey = getMonthKey(month);
    const budget = budgetsByMonth.get(monthKey);
    const actuals = monthlyActuals.get(monthKey) ?? { income: 0, expense: 0 };
    const isFuture = month > currentMonthStart;

    const actualExpenseCandidate = budget
      ? Math.max(budget.actualExpense, round(actuals.expense))
      : round(actuals.expense);

    const actualExpense = round(actualExpenseCandidate);
    const actualIncome = round(actuals.income);
    const actualNet = round(actualIncome - actualExpense);

    const plannedIncome = budget ? budget.plannedIncome : null;
    const plannedExpense = budget ? budget.plannedExpense : null;
    const plannedNet =
      plannedIncome !== null && plannedExpense !== null
        ? round(plannedIncome - plannedExpense)
        : null;

    const varianceExpense =
      plannedExpense !== null ? round(actualExpense - plannedExpense) : null;
    const varianceIncome =
      plannedIncome !== null ? round(actualIncome - plannedIncome) : null;

    const monthEnd = endOfLocalMonth(month);
    const monthStartIso = toLocalISODate(month);
    const monthEndIso = toLocalISODate(monthEnd);

    const sectionActuals = sectionActualsByMonth.get(monthKey) ?? {
      expenses: 0,
      recurring: 0,
      savings: 0,
      debt: 0,
    };

    const sections = (Object.keys(SECTION_LABELS) as SectionKey[]).map(
      (section) => ({
        section,
        label: SECTION_LABELS[section],
        planned: budget ? budget.sectionTotals[section].planned : null,
        actual: round(sectionActuals[section] ?? 0),
      })
    );

    const series: MonthSeries = {
      monthKey,
      monthStart: monthStartIso,
      monthEnd: monthEndIso,
      label: monthFormatter.format(month),
      plannedIncome,
      plannedExpense,
      plannedNet,
      actualIncome,
      actualExpense,
      actualNet,
      varianceExpense,
      varianceIncome,
      isFuture,
      sections,
    };

    monthSeriesMap.set(monthKey, series);
    return series;
  });

  // Month descriptors
  const months: MonthDescriptor[] = monthlySeries.map((series) => ({
    monthKey: series.monthKey,
    label: series.label,
    longLabel: monthLongFormatter.format(monthFromKey(series.monthKey)),
    monthStart: series.monthStart,
    monthEnd: series.monthEnd,
    isCurrent: series.monthKey === currentMonthKey,
    isFuture: series.isFuture,
    hasPlan: series.plannedExpense !== null || series.plannedIncome !== null,
    hasActuals: series.actualExpense > 0 || series.actualIncome > 0,
  }));

  const currentBudget = budgetsByMonth.get(currentMonthKey) ?? null;

  // Categories for a given month
  const buildCategoryEntriesForMonth = (monthKey: string) => {
    const entries: CategoryPlanActualEntry[] = [];
    for (const [categoryId, rollup] of categoryRollup) {
      const snapshot = rollup.months.get(monthKey);
      if (!snapshot) continue;
      const planned = snapshot.planned;
      const actual = round(
        Math.max(snapshot.budgetActual ?? 0, snapshot.transactionActual)
      );
      if ((planned === null || planned === 0) && actual === 0) {
        continue;
      }
      const variance = planned !== null ? round(actual - planned) : null;
      const variancePercent =
        planned !== null && Math.abs(planned) > 0.01
          ? safePercent(variance ?? 0, planned)
          : null;

      entries.push({
        categoryId,
        name: rollup.meta.name,
        emoji: rollup.meta.emoji,
        section: rollup.meta.section,
        planned,
        actual,
        variance,
        variancePercent,
        share: 0,
        overThreshold:
          variancePercent !== null &&
          Math.abs(variancePercent) >= CATEGORY_VARIANCE_THRESHOLD,
        underThreshold:
          variancePercent !== null &&
          -Math.abs(variancePercent) <= -CATEGORY_VARIANCE_THRESHOLD &&
          variancePercent <= -CATEGORY_VARIANCE_THRESHOLD,
      });
    }

    entries.sort((a, b) => b.actual - a.actual);

    const totalActualValue = entries.reduce<number>(
      (sum, entry) => sum + entry.actual,
      0
    );

    for (const entry of entries) {
      entry.share =
        totalActualValue > 0 ? round(entry.actual / totalActualValue, 4) : 0;
    }

    return {
      entries,
      totalActual: totalActualValue,
      totalPlanned: budgetsByMonth.get(monthKey)?.plannedExpense ?? null,
    };
  };

  const currentCategorySnapshot = buildCategoryEntriesForMonth(currentMonthKey);

  // Keep SectionKey stable for placeholder
  const categoryPlanEntries: CategoryPlanActualEntry[] =
    currentCategorySnapshot.entries.length > 0
      ? currentCategorySnapshot.entries
      : [
          {
            categoryId: "placeholder",
            name: "Ready for your first category",
            emoji: "✨",
            section: "expenses" as SectionKey,
            planned: 0,
            actual: 0,
            variance: 0,
            variancePercent: 0,
            share: 1,
            overThreshold: false,
            underThreshold: false,
          },
        ];

  const totalActual = currentCategorySnapshot.totalActual;

  // Category history across months
  const categoryHistory = monthlySeries
    .map((series) => {
      const snapshot = buildCategoryEntriesForMonth(series.monthKey);
      return {
        monthKey: series.monthKey,
        label: series.label,
        categories: snapshot.entries,
        totalActual: snapshot.totalActual,
        totalPlanned: snapshot.totalPlanned,
      };
    })
    .filter((snapshot) => snapshot.categories.length > 0);

  // Trend month keys (realized months up to current)
  const realizedMonthKeys = monthlySeries
    .filter((series) => !series.isFuture || series.monthKey === currentMonthKey)
    .map((series) => series.monthKey);

  const trendMonthKeys =
    realizedMonthKeys.length > TREND_MONTH_WINDOW
      ? realizedMonthKeys.slice(realizedMonthKeys.length - TREND_MONTH_WINDOW)
      : realizedMonthKeys.slice();

  // Category trends
  const categoryTrendEntries: CategoryTrendEntry[] = [];

  for (const [categoryId, rollup] of categoryRollup) {
    const points: CategoryTrendPoint[] = [];
    let previousActual: number | null = null;
    const deltaValues: number[] = [];

    for (const monthKey of trendMonthKeys) {
      const monthMeta = monthSeriesMap.get(monthKey);
      const snapshot = rollup.months.get(monthKey);
      const actual = snapshot
        ? round(
            Math.max(snapshot.budgetActual ?? 0, snapshot.transactionActual)
          )
        : 0;

      let change: number | null = null;
      let percentChange: number | null = null;
      if (previousActual !== null) {
        change = round(actual - previousActual);
        percentChange =
          Math.abs(previousActual) > 0.01
            ? safePercent(change, previousActual)
            : null;
        deltaValues.push(change);
      }
      previousActual = actual;

      points.push({
        monthKey,
        label:
          monthMeta?.label ?? monthFormatter.format(monthFromKey(monthKey)),
        actual,
        change,
        percentChange,
        zScore: null,
      });
    }

    const hasMeaningfulData = points.some((point) => point.actual > 0);
    if (!hasMeaningfulData) continue;

    const { mean, stdDev } = computeStats(deltaValues);
    let flagged = false;

    const enrichedPoints = points.map((point) => {
      if (point.change === null) return point;
      const zScore =
        stdDev > 0 ? round((point.change - mean) / stdDev, 3) : null;
      const isFlagged =
        (zScore !== null && Math.abs(zScore) >= TREND_STD_THRESHOLD) ||
        (point.percentChange !== null &&
          Math.abs(point.percentChange) >= TREND_PERCENT_THRESHOLD);
      if (isFlagged) flagged = true;
      return { ...point, zScore };
    });

    categoryTrendEntries.push({
      categoryId,
      name: rollup.meta.name,
      emoji: rollup.meta.emoji,
      section: rollup.meta.section,
      points: enrichedPoints,
      flagged,
    });
  }

  categoryTrendEntries.sort((a, b) => {
    const aLatest = a.points.length ? a.points[a.points.length - 1].actual : 0;
    const bLatest = b.points.length ? b.points[b.points.length - 1].actual : 0;
    if (a.flagged !== b.flagged) {
      return a.flagged ? -1 : 1;
    }
    return bLatest - aLatest;
  });

  const limitedCategoryTrends = categoryTrendEntries.slice(0, 12);

  // Baseline net (trailing 4 realized series)
  const historicalSeries = monthlySeries.filter(
    (series) => !series.isFuture || series.monthKey === currentMonthKey
  );
  const trailingActuals =
    historicalSeries.length > 4
      ? historicalSeries.slice(historicalSeries.length - 4)
      : historicalSeries.slice();

  const baselineNet =
    trailingActuals.length > 0
      ? round(
          trailingActuals.reduce((sum, s) => sum + s.actualNet, 0) /
            trailingActuals.length
        )
      : 0;

  // Forecast
  const forecastSeries: ForecastPoint[] = monthlySeries
    .filter((series) => series.monthKey >= currentMonthKey)
    .slice(0, FORECAST_LOOKAHEAD + 1)
    .map((series) => ({
      monthKey: series.monthKey,
      label: series.label,
      actualIncome: series.actualIncome,
      actualExpense: series.actualExpense,
      plannedIncome: series.plannedIncome,
      plannedExpense: series.plannedExpense,
      netActual: series.actualNet,
      netPlanned: series.plannedNet,
      baselineNet,
      isFuture: series.isFuture,
      atRisk: (series.plannedNet ?? series.actualNet) < 0,
    }));

  // Burn-down for current month
  const daysTotal = daysInLocalMonth(currentMonthStart);
  const isCurrentMonthActive =
    now >= currentMonthStart && now < addMonthsLocal(currentMonthStart, 1);
  const todayDay = isCurrentMonthActive ? now.getDate() : daysTotal;

  const plannedTotal = currentBudget?.plannedExpense ?? null;
  const plannedDaily =
    plannedTotal !== null && daysTotal > 0 ? plannedTotal / daysTotal : null;

  let runningActual = 0;
  const burnDownPoints: BurnDownPoint[] = Array.from(
    { length: daysTotal },
    (_, index) => {
      const day = index + 1;
      const dailyActual = round(dailyTotals.get(day) ?? 0);
      runningActual += dailyActual;
      const cumulativeActual = round(runningActual);
      const cumulativeTarget =
        plannedDaily !== null ? round(plannedDaily * day) : null;
      const variance =
        cumulativeTarget !== null
          ? round(cumulativeActual - cumulativeTarget)
          : null;
      const variancePercent =
        cumulativeTarget !== null
          ? safePercent(variance ?? 0, cumulativeTarget)
          : null;

      return {
        day,
        date: toLocalISODate(
          new Date(
            currentMonthStart.getFullYear(),
            currentMonthStart.getMonth(),
            day
          )
        ),
        dailyActual,
        cumulativeActual,
        cumulativeTarget,
        variance,
        variancePercent,
        isToday: isCurrentMonthActive && day === todayDay,
        isOverTarget: variance !== null && variance > 0,
      };
    }
  );

  const lastBurn =
    burnDownPoints.length > 0
      ? burnDownPoints[burnDownPoints.length - 1]
      : null;
  const actualTotal = lastBurn ? lastBurn.cumulativeActual : 0;
  const remainingBudget =
    plannedTotal !== null ? round(plannedTotal - actualTotal) : null;

  const daysRemaining =
    plannedTotal !== null ? Math.max(daysTotal - todayDay, 0) : 0;
  const dailyAllowance =
    plannedTotal !== null && daysRemaining > 0
      ? round((remainingBudget ?? 0) / daysRemaining)
      : null;

  const burnDown: BurnDown = {
    monthKey: currentMonthKey,
    label: monthFormatter.format(currentMonthStart),
    plannedTotal,
    actualTotal,
    remainingBudget,
    dailyAllowance,
    daysRemaining,
    hasOverrun: plannedTotal !== null && actualTotal > plannedTotal,
    points: burnDownPoints,
  };

  // Vendors/transactions (current month)
  const vendors: VendorInsight[] = Array.from(vendorTotals.entries())
    .map(([key, vendor]) => ({
      key,
      label: vendor.label,
      total: round(vendor.total),
      count: vendor.count,
      average: vendor.count > 0 ? round(vendor.total / vendor.count) : 0,
      href: `/transactions?search=${encodeURIComponent(vendor.label)}`,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_VENDOR_LIMIT);

  const transactions: TransactionInsight[] = topTransactionBuffer
    .sort((a, b) => b.amount - a.amount)
    .slice(0, TOP_TRANSACTION_LIMIT)
    .map((entry) => ({
      id: entry.id,
      occurredOn: toLocalISODate(entry.occurredOn),
      label: entry.description?.length ? entry.description : entry.merchant,
      vendor: entry.merchant,
      amount: round(entry.amount),
      href: `/transactions?search=${encodeURIComponent(entry.merchant)}`,
    }));

  // Goals (savings/debt) from category entries
  const mapGoalDirection = (
    variance: number | null
  ): GoalProgressEntry["direction"] => {
    if (variance === null || Math.abs(variance) < 0.01) {
      return "on_track";
    }
    return variance > 0 ? "ahead" : "behind";
  };

  const buildGoalProgress = (section: SectionKey) =>
    categoryPlanEntries
      .filter((entry) => entry.section === section)
      .map<GoalProgressEntry>((entry) => ({
        categoryId: entry.categoryId,
        name: entry.name,
        emoji: entry.emoji,
        section: entry.section,
        target: entry.planned,
        actual: entry.actual,
        variance: entry.variance,
        progress:
          entry.planned !== null && entry.planned > 0
            ? safePercent(entry.actual, entry.planned)
            : null,
        direction: mapGoalDirection(entry.variance ?? 0),
      }));

  const savingsProgress = buildGoalProgress("savings");
  const debtProgress = buildGoalProgress("debt");

  // Anomalies
  const anomalies: AnomalyInsight[] = [];
  const currentSeries = monthSeriesMap.get(currentMonthKey);

  if (
    currentSeries &&
    currentSeries.plannedExpense !== null &&
    currentSeries.varianceExpense !== null &&
    currentSeries.plannedExpense > 0 &&
    Math.abs(currentSeries.varianceExpense) / currentSeries.plannedExpense >=
      CATEGORY_VARIANCE_THRESHOLD
  ) {
    const variance = currentSeries.varianceExpense;
    const percent = safePercent(variance, currentSeries.plannedExpense) ?? 0;
    anomalies.push({
      id: `plan-variance-${currentMonthKey}`,
      type: "plan",
      severity: Math.abs(percent) >= 0.3 ? "critical" : "warning",
      monthKey: currentMonthKey,
      label: currentSeries.label,
      delta: round(variance),
      percent,
      message:
        variance > 0
          ? `${
              currentSeries.label
            } spending is tracking ${percentFormatter.format(
              Math.abs(percent)
            )} over plan.`
          : `${
              currentSeries.label
            } spending is pacing ${percentFormatter.format(
              Math.abs(percent)
            )} under plan.`,
      detail: `Spent ${currencyFormatter.format(
        currentSeries.actualExpense
      )} vs budgeted ${currencyFormatter.format(
        currentSeries.plannedExpense
      )}.`,
    });
  }

  for (let index = 1; index < monthlySeries.length; index += 1) {
    const previous = monthlySeries[index - 1];
    const current = monthlySeries[index];
    if (current.isFuture || previous.isFuture) continue;

    if (previous.actualExpense > 0) {
      const delta = round(current.actualExpense - previous.actualExpense);
      const percent = safePercent(delta, previous.actualExpense);
      if (
        Math.abs(delta) >= 100 &&
        percent !== null &&
        Math.abs(percent) >= 0.2
      ) {
        anomalies.push({
          id: `spending-shift-${current.monthKey}`,
          type: "spending",
          severity: percent >= 0.4 || percent <= -0.4 ? "critical" : "warning",
          monthKey: current.monthKey,
          label: current.label,
          delta,
          percent,
          message:
            delta > 0
              ? `${current.label} spending jumped ${percentFormatter.format(
                  Math.abs(percent)
                )} vs ${previous.label}.`
              : `${current.label} spending fell ${percentFormatter.format(
                  Math.abs(percent)
                )} vs ${previous.label}.`,
          detail: `Moved from ${currencyFormatter.format(
            previous.actualExpense
          )} to ${currencyFormatter.format(current.actualExpense)}.`,
        });
      }
    }

    if (previous.actualIncome > 0) {
      const delta = round(current.actualIncome - previous.actualIncome);
      const percent = safePercent(delta, previous.actualIncome);
      if (
        Math.abs(delta) >= 100 &&
        percent !== null &&
        Math.abs(percent) >= 0.25
      ) {
        anomalies.push({
          id: `income-shift-${current.monthKey}`,
          type: "income",
          severity: Math.abs(percent) >= 0.4 ? "warning" : "info",
          monthKey: current.monthKey,
          label: current.label,
          delta,
          percent,
          message:
            delta > 0
              ? `${current.label} income outpaced ${
                  previous.label
                } by ${percentFormatter.format(Math.abs(percent))}.`
              : `${current.label} income declined ${percentFormatter.format(
                  Math.abs(percent)
                )} from ${previous.label}.`,
          detail: `Shifted from ${currencyFormatter.format(
            previous.actualIncome
          )} to ${currencyFormatter.format(current.actualIncome)}.`,
        });
      }
    }
  }

  for (const entry of categoryPlanEntries) {
    if (entry.variancePercent === null) continue;
    if (Math.abs(entry.variancePercent) >= CATEGORY_VARIANCE_THRESHOLD) {
      anomalies.push({
        id: `category-${entry.categoryId}`,
        type: "category",
        severity:
          Math.abs(entry.variancePercent) >= 0.3 ? "critical" : "warning",
        monthKey: currentMonthKey,
        label: entry.name,
        delta: entry.variance ?? 0,
        percent: entry.variancePercent,
        message:
          entry.variance !== null && entry.variance > 0
            ? `${entry.name} is over plan by ${percentFormatter.format(
                Math.abs(entry.variancePercent)
              )}.`
            : `${entry.name} is under plan by ${percentFormatter.format(
                Math.abs(entry.variancePercent)
              )}.`,
        detail:
          entry.planned !== null
            ? `Planned ${currencyFormatter.format(
                entry.planned
              )} vs actual ${currencyFormatter.format(entry.actual)}`
            : `Actual ${currencyFormatter.format(entry.actual)}.`,
        categoryId: entry.categoryId,
      });
    }
  }

  for (const trend of limitedCategoryTrends) {
    const latest =
      trend.points.length > 0 ? trend.points[trend.points.length - 1] : null;
    if (!latest || latest.change === null) continue;

    const isStdFlagged =
      latest.zScore !== null && Math.abs(latest.zScore) >= TREND_STD_THRESHOLD;
    const isPercentFlagged =
      latest.percentChange !== null &&
      Math.abs(latest.percentChange) >= TREND_PERCENT_THRESHOLD;

    if (!isStdFlagged && !isPercentFlagged) continue;

    anomalies.push({
      id: `trend-${trend.categoryId}-${latest.monthKey}`,
      type: "category",
      severity: isStdFlagged ? "warning" : "info",
      monthKey: latest.monthKey,
      label: trend.name,
      delta: latest.change ?? 0,
      percent: latest.percentChange,
      message:
        latest.change && latest.change > 0
          ? `${trend.name} jumped ${currencyFormatter.format(
              latest.change
            )} vs prior month.`
          : `${trend.name} dropped ${currencyFormatter.format(
              Math.abs(latest.change ?? 0)
            )} vs prior month.`,
      detail:
        latest.percentChange !== null
          ? `Shift of ${percentFormatter.format(
              Math.abs(latest.percentChange)
            )} month over month.`
          : undefined,
      categoryId: trend.categoryId,
    });
  }

  for (const forecastPoint of forecastSeries) {
    if (!forecastPoint.atRisk) continue;
    const net = forecastPoint.netPlanned ?? forecastPoint.netActual;
    anomalies.push({
      id: `forecast-${forecastPoint.monthKey}`,
      type: "forecast",
      severity: "warning",
      monthKey: forecastPoint.monthKey,
      label: forecastPoint.label,
      delta: net,
      percent: null,
      message: `${forecastPoint.label} is projected to run negative cash flow.`,
      detail: `Planned net ${currencyFormatter.format(
        net
      )} vs baseline ${currencyFormatter.format(forecastPoint.baselineNet)}.`,
    });
  }

  // Summary
  const previousActualMonths = monthlySeries.filter(
    (series) => !series.isFuture && series.monthKey < currentMonthKey
  );
  const previousMonth =
    previousActualMonths.length > 0
      ? previousActualMonths[previousActualMonths.length - 1]
      : undefined;

  const summary: SummaryData = {
    currentMonth: {
      label: currentSeries?.label ?? monthFormatter.format(currentMonthStart),
      plannedExpense: currentSeries?.plannedExpense ?? null,
      actualExpense: currentSeries?.actualExpense ?? 0,
      plannedIncome: currentSeries?.plannedIncome ?? null,
      actualIncome: currentSeries?.actualIncome ?? 0,
      varianceExpense: currentSeries?.varianceExpense ?? null,
      varianceIncome: currentSeries?.varianceIncome ?? null,
    },
    highlightedCategories: categoryPlanEntries
      .filter((entry) => entry.overThreshold || entry.underThreshold)
      .slice(0, 3)
      .map((entry) => ({
        categoryId: entry.categoryId,
        name: entry.name,
        variance: entry.variance ?? 0,
        variancePercent: entry.variancePercent,
        direction:
          entry.variance !== null && entry.variance > 0 ? "over" : "under",
      })),
    atRiskMonths: forecastSeries
      .filter((point) => point.atRisk)
      .map((point) => ({
        monthKey: point.monthKey,
        label: point.label,
        net: round(point.netPlanned ?? point.netActual),
      })),
  };

  if (currentSeries && previousMonth) {
    const change = round(
      currentSeries.actualExpense - previousMonth.actualExpense
    );
    const percentChange =
      previousMonth.actualExpense > 0
        ? safePercent(change, previousMonth.actualExpense)
        : null;
    summary.previousComparison = {
      label: previousMonth.label,
      actualExpense: previousMonth.actualExpense,
      change,
      percentChange,
      direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
    };
  }

  // Final payload
  return {
    months,
    monthlySeries,
    categoryPlanActual: {
      monthKey: currentMonthKey,
      categories: categoryPlanEntries,
      totalPlanned: currentCategorySnapshot.totalPlanned,
      totalActual,
      varianceThreshold: CATEGORY_VARIANCE_THRESHOLD,
    },
    categoryShare: {
      monthKey: currentMonthKey,
      total: totalActual,
      items: categoryPlanEntries,
    },
    categoryHistory,
    categoryTrends: {
      monthKeys: trendMonthKeys,
      categories: limitedCategoryTrends,
      stdDevThreshold: TREND_STD_THRESHOLD,
      percentThreshold: TREND_PERCENT_THRESHOLD,
    },
    forecast: {
      months: forecastSeries,
      baselineNet,
    },
    burnDown,
    topVendors: {
      monthKey: currentMonthKey,
      vendors,
      transactions,
    },
    savingsProgress: {
      savings: savingsProgress,
      debt: debtProgress,
    },
    anomalies,
    summary,
    thresholds: {
      categoryVariance: CATEGORY_VARIANCE_THRESHOLD,
      trendStd: TREND_STD_THRESHOLD,
      trendPercent: TREND_PERCENT_THRESHOLD,
    },
  };
}
