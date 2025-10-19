"use client";

import { useContext, useMemo } from "react";
import {
  CacheContext,
  type CacheContextValue,
  type BudgetLine,
  type BudgetSectionKey,
  type BudgetSnapshot,
  type CacheActions,
  type Category,
  type IncomePlan,
  type CategorySection,
} from "@budget/app/providers/CacheProvider";

const categorySectionPriority: Record<CategorySection, number> = {
  EXPENSES: 0,
  RECURRING: 1,
  SAVINGS: 2,
  DEBT: 3,
};

const sectionKeyList: BudgetSectionKey[] = [
  "expenses",
  "recurring",
  "savings",
  "debt",
];

type CacheSelectors = {
  getCategoryById(id: string): Category | null;
  getBudgetSnapshot(monthKey: string): BudgetSnapshot | null;
  getBudgetLines(budgetId: string): BudgetLine[];
  getIncomePlans(budgetId: string): IncomePlan[];
};

type CacheHookValue = {
  actions: CacheActions;
  version: number;
  selectors: CacheSelectors;
};

const cloneCategory = (category: Category): Category => ({ ...category });
const cloneIncomePlan = (plan: IncomePlan): IncomePlan => ({ ...plan });
const cloneBudgetLine = (line: BudgetLine): BudgetLine => ({ ...line });

const toBudgetLineKey = (budgetId: string, categoryId: string) =>
  `${budgetId}:${categoryId}`;

const toIncomePlanKey = (budgetId: string, planId: string) =>
  `${budgetId}:${planId}`;

export const useCache = (): CacheHookValue => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error("useCache must be used within a CacheProvider");
  }

  const { actions, version, stateRef } = context;

  const selectors = useMemo<CacheSelectors>(() => {
    const getCategoryById = (id: string) => {
      const category = stateRef.current.categories.get(id);
      return category ? cloneCategory(category) : null;
    };

    const getBudgetSnapshot = (key: string) =>
      buildBudgetSnapshot(key, stateRef);

    const getBudgetLines = (budgetId: string) => {
      const state = stateRef.current;
      const keys = Array.from(state.budgetLines.keys()).filter((entryKey) =>
        entryKey.startsWith(`${budgetId}:`)
      );
      return keys
        .map((entryKey) => state.budgetLines.get(entryKey))
        .filter(Boolean)
        .map((line) => cloneBudgetLine(line as BudgetLine));
    };

    const getIncomePlans = (budgetId: string) => {
      const state = stateRef.current;
      const keys = Array.from(state.incomePlans.keys()).filter((entryKey) =>
        entryKey.startsWith(`${budgetId}:`)
      );
      return keys
        .map((entryKey) => state.incomePlans.get(entryKey))
        .filter(Boolean)
        .map((plan) => cloneIncomePlan(plan as IncomePlan));
    };

    return {
      getCategoryById,
      getBudgetSnapshot,
      getBudgetLines,
      getIncomePlans,
    };
  }, [stateRef]);

  return { actions, version, selectors };
};

export const useCategories = (): Category[] => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error("useCategories must be used within a CacheProvider");
  }

  const { stateRef, version } = context;

  return useMemo(() => {
    void version;
    const values = Array.from(stateRef.current.categories.values()).map(
      cloneCategory
    );

    return values.sort((a, b) => {
      if (a.section !== b.section) {
        return (
          categorySectionPriority[a.section] -
          categorySectionPriority[b.section]
        );
      }
      if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [stateRef, version]);
};

const buildBudgetSnapshot = (
  budgetId: string,
  state: CacheContextValue["stateRef"]
): BudgetSnapshot | null => {
  const snapshotState = state.current;
  const budget = snapshotState.budgets.get(budgetId);
  if (!budget) return null;

  const income = budget.incomePlanIds
    .map((key) => snapshotState.incomePlans.get(key))
    .filter(Boolean)
    .map((plan) => cloneIncomePlan(plan as IncomePlan));

  const sections: Record<BudgetSectionKey, BudgetLine[]> = {
    expenses: [],
    recurring: [],
    savings: [],
    debt: [],
  };

  const lineKeys =
    budget.budgetLineIds.length > 0
      ? budget.budgetLineIds
      : Array.from(snapshotState.budgetLines.keys()).filter((key) =>
          key.startsWith(`${budgetId}:`)
        );

  for (const key of lineKeys) {
    const line = snapshotState.budgetLines.get(key);
    if (!line) continue;
    sections[line.section].push(cloneBudgetLine(line));
  }

  for (const section of sectionKeyList) {
    sections[section].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }

  return {
    monthKey: budgetId,
    exists: budget.exists,
    income,
    sections,
  };
};

export const useBudgetByMonth = (monthKey: string): BudgetSnapshot | null => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error("useBudgetByMonth must be used within a CacheProvider");
  }
  const { stateRef, version } = context;

  return useMemo(() => {
    void version;
    return buildBudgetSnapshot(monthKey, stateRef);
  }, [monthKey, stateRef, version]);
};

export const useBudgetLines = (budgetId: string): BudgetLine[] => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error("useBudgetLines must be used within a CacheProvider");
  }
  const { stateRef, version } = context;

  return useMemo(() => {
    void version;
    const state = stateRef.current;
    const budget = state.budgets.get(budgetId);
    if (!budget) return [];

    const keys =
      budget.budgetLineIds.length > 0
        ? budget.budgetLineIds
        : Array.from(state.budgetLines.keys()).filter((key) =>
            key.startsWith(`${budgetId}:`)
          );

    return keys
      .map((key) => state.budgetLines.get(key))
      .filter(Boolean)
      .map((line) => cloneBudgetLine(line as BudgetLine));
  }, [budgetId, stateRef, version]);
};

export const useIncomePlans = (budgetId: string): IncomePlan[] => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error("useIncomePlans must be used within a CacheProvider");
  }
  const { stateRef, version } = context;

  return useMemo(() => {
    void version;
    const state = stateRef.current;
    const budget = state.budgets.get(budgetId);
    if (!budget) return [];

    const keys =
      budget.incomePlanIds.length > 0
        ? budget.incomePlanIds
        : Array.from(state.incomePlans.keys()).filter((key) =>
            key.startsWith(`${budgetId}:`)
          );

    return keys
      .map((key) => state.incomePlans.get(key))
      .filter(Boolean)
      .map((plan) => cloneIncomePlan(plan as IncomePlan));
  }, [budgetId, stateRef, version]);
};

export const cacheKeyForBudgetLine = (budgetId: string, categoryId: string) =>
  toBudgetLineKey(budgetId, categoryId);

export const cacheKeyForIncomePlan = (budgetId: string, planId: string) =>
  toIncomePlanKey(budgetId, planId);
