import test from "node:test";
import assert from "node:assert/strict";
import { getMonthStatus } from "@budget/lib/monthStatus";
import type { BudgetSnapshot, BudgetSectionKey } from "@budget/lib/cache/types";

const createSnapshot = (
  income: number[],
  sections: Partial<
    Record<BudgetSectionKey, Array<{ planned: number; spent: number }>>
  > = {}
): BudgetSnapshot => {
  const allSections: Record<
    BudgetSectionKey,
    Array<{ planned: number; spent: number }>
  > = {
    expenses: [],
    recurring: [],
    savings: [],
    debt: [],
  };

  (Object.keys(sections) as BudgetSectionKey[]).forEach((key) => {
    allSections[key] = sections[key] ?? [];
  });

  return {
    monthKey: "2024-06",
    exists: true,
    income: income.map((amount, index) => ({
      id: `income-${index}`,
      budgetId: "2024-06",
      source: `Source ${index + 1}`,
      amount,
    })),
    sections: (Object.keys(allSections) as BudgetSectionKey[]).reduce(
      (acc, key) => {
        acc[key] = allSections[key].map((entry, index) => ({
          id: `${key}-${index}`,
          budgetId: "2024-06",
          categoryId: `${key}-${index}`,
          section: key,
          name: `${key} ${index + 1}`,
          emoji: "✨",
          planned: entry.planned,
          spent: entry.spent,
          carryForward: false,
          repeat: "monthly",
          notes: null,
        }));
        return acc;
      },
      {
        expenses: [] as BudgetSnapshot["sections"]["expenses"],
        recurring: [] as BudgetSnapshot["sections"]["recurring"],
        savings: [] as BudgetSnapshot["sections"]["savings"],
        debt: [] as BudgetSnapshot["sections"]["debt"],
      }
    ),
  };
};

void test("getMonthStatus returns budgeting when income is not fully allocated", () => {
  const snapshot = createSnapshot([2000], {
    expenses: [{ planned: 1200, spent: 600 }],
  });

  assert.strictEqual(getMonthStatus("2024-06", snapshot), "budgeting");
});

void test("getMonthStatus returns on_track when allocations match income and no overspending", () => {
  const snapshot = createSnapshot([1500], {
    expenses: [{ planned: 500, spent: 400 }],
    recurring: [{ planned: 500, spent: 500 }],
    savings: [{ planned: 500, spent: 250 }],
  });

  assert.strictEqual(getMonthStatus("2024-06", snapshot), "on_track");
});

void test("getMonthStatus returns over when any category exceeds plan", () => {
  const snapshot = createSnapshot([1000], {
    expenses: [{ planned: 400, spent: 450 }],
    recurring: [{ planned: 600, spent: 500 }],
  });

  assert.strictEqual(getMonthStatus("2024-06", snapshot), "over");
});

void test("getMonthStatus returns budgeting when snapshot is null", () => {
  assert.strictEqual(getMonthStatus("2024-06", null), "budgeting");
});
