import type {
  BudgetLine,
  BudgetSnapshot,
  BudgetSectionKey,
} from "@budget/lib/cache/types";

export type MonthStatus = "budgeting" | "on_track" | "over";

const EPSILON = 0.01;

const numeric = (value?: number | null) => Number(value ?? 0);

const flattenLines = (sections: BudgetSnapshot["sections"]): BudgetLine[] => {
  const result: BudgetLine[] = [];
  (Object.keys(sections) as BudgetSectionKey[]).forEach((key) => {
    result.push(...sections[key]);
  });
  return result;
};

export const getMonthStatus = (
  monthKey: string,
  snapshot: BudgetSnapshot | null
): MonthStatus => {
  void monthKey;
  console.log("snowap", snapshot);
  if (!snapshot) {
    return "budgeting";
  }

  const incomeTotal = snapshot.income.reduce(
    (sum, plan) => sum + numeric(plan.amount),
    0
  );

  const lines = flattenLines(snapshot.sections);
  const totalPlanned = lines.reduce(
    (sum, line) => sum + numeric(line.planned),
    0
  );
  const totalSpent = lines.reduce((sum, line) => sum + numeric(line.spent), 0);

  const hasCategoryOverage = lines.some(
    (line) => numeric(line.spent) - numeric(line.planned) > EPSILON
  );
  const hasTotalOverage = totalSpent - totalPlanned > EPSILON;

  if (hasCategoryOverage || hasTotalOverage) {
    return "over";
  }

  if (incomeTotal - totalPlanned > EPSILON) {
    return "budgeting";
  }

  return "on_track";
};
