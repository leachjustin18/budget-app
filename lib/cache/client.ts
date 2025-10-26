"use client";

import {
  type Budget,
  type BudgetLine,
  type BudgetSectionKey,
  type BudgetSnapshot,
  type CacheActions,
  type CacheClientConfig,
  type CacheState,
  type Category,
  type CategorySection,
  type IncomePlan,
  type RepeatCadence,
} from "@budget/lib/cache/types";

class ApiError<T = unknown> extends Error {
  status: number;
  data: T | null;

  constructor(message: string, status: number, data: T | null = null) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type CategoryApiPayload = {
  id: string;
  name: string;
  emoji: string;
  section: CategorySection;
  carryForwardDefault: boolean;
  repeatCadenceDefault: RepeatCadence;
  usage: Category["usage"];
  sortOrder?: number | null;
  updatedAt?: string | null;
};

type BudgetIncomePayload = {
  uuid: string;
  source: string;
  amount: number | null;
};

type BudgetCategoryPayload = {
  uuid: string;
  name: string;
  emoji: string;
  planned: number | null;
  spent: number | null;
  carryForward: boolean;
  repeat: "monthly" | "once";
};

type BudgetResponsePayload = {
  budget: {
    income: BudgetIncomePayload[];
    sections: Record<BudgetSectionKey, BudgetCategoryPayload[]>;
  };
  exists: boolean;
};

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

const requestJson = async <TResponse>(
  input: RequestInfo,
  init: RequestInit = {}
): Promise<TResponse> => {
  const response = await fetch(input, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });

  const contentType = response.headers.get("content-type");
  const canParseJson = contentType?.includes("application/json");

  if (!response.ok) {
    const data = canParseJson ? await response.json().catch(() => null) : null;
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as Record<string, unknown>).error)
        : null) ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  if (!canParseJson) {
    throw new ApiError("Expected JSON response", response.status);
  }

  return response.json() as Promise<TResponse>;
};

const cloneCategory = (category: Category): Category => ({ ...category });
const cloneIncomePlan = (plan: IncomePlan): IncomePlan => ({ ...plan });
const cloneBudgetLine = (line: BudgetLine): BudgetLine => ({ ...line });

const sortCategories = (categories: Category[]) =>
  [...categories].sort((a, b) => {
    if (a.section !== b.section) {
      return (
        categorySectionPriority[a.section] - categorySectionPriority[b.section]
      );
    }
    if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

const toBudgetLineKey = (budgetId: string, categoryId: string) =>
  `${budgetId}:${categoryId}`;

const toIncomePlanKey = (budgetId: string, planId: string) =>
  `${budgetId}:${planId}`;

const mapCategoryPayload = (payload: CategoryApiPayload): Category => ({
  id: payload.id,
  name: payload.name,
  emoji: payload.emoji ?? "✨",
  section: payload.section,
  carryForwardDefault: payload.carryForwardDefault,
  repeatCadenceDefault: payload.repeatCadenceDefault,
  usage: payload.usage,
  sortOrder: payload.sortOrder ?? undefined,
  updatedAt: payload.updatedAt ?? undefined,
});

const emptySections = (): Record<BudgetSectionKey, BudgetLine[]> => ({
  expenses: [],
  recurring: [],
  savings: [],
  debt: [],
});

const snapshotFromState = (
  state: CacheState,
  monthKey: string
): BudgetSnapshot => {
  const budget = state.budgets.get(monthKey);
  const income = Array.from(state.incomePlans.values())
    .filter((plan) => plan.budgetId === monthKey)
    .map(cloneIncomePlan);

  const sections = emptySections();

  for (const line of state.budgetLines.values()) {
    if (line.budgetId !== monthKey) continue;
    sections[line.section].push(cloneBudgetLine(line));
  }

  for (const section of sectionKeyList) {
    sections[section].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }

  return {
    monthKey,
    exists: budget?.exists ?? false,
    income,
    sections,
  };
};

const normalizeBudgetResponse = (
  monthKey: string,
  payload: BudgetResponsePayload
): BudgetSnapshot => {
  const income: IncomePlan[] = payload.budget.income.map((plan) => ({
    id: plan.uuid,
    budgetId: monthKey,
    source: plan.source,
    amount: plan.amount,
  }));

  const sections = emptySections();

  for (const sectionKey of sectionKeyList) {
    const sectionPayload = payload.budget.sections[sectionKey] ?? [];
    sections[sectionKey] = sectionPayload.map((item) => ({
      id: toBudgetLineKey(monthKey, item.uuid),
      budgetId: monthKey,
      categoryId: item.uuid,
      section: sectionKey,
      name: item.name,
      emoji: item.emoji ?? "✨",
      planned: item.planned ?? null,
      spent: item.spent ?? null,
      carryForward: item.carryForward,
      repeat: item.repeat,
      notes: null,
    }));
  }

  return {
    monthKey,
    exists: payload.exists,
    income,
    sections,
  };
};

const applyBudgetSnapshot = (
  state: CacheState,
  snapshot: BudgetSnapshot
): Budget => {
  const budgetId = snapshot.monthKey;

  for (const key of Array.from(state.budgetLines.keys())) {
    if (key.startsWith(`${budgetId}:`)) {
      state.budgetLines.delete(key);
    }
  }

  for (const key of Array.from(state.incomePlans.keys())) {
    if (key.startsWith(`${budgetId}:`)) {
      state.incomePlans.delete(key);
    }
  }

  const incomePlanIds: string[] = [];
  const budgetLineIds: string[] = [];

  for (const plan of snapshot.income) {
    const key = toIncomePlanKey(budgetId, plan.id);
    state.incomePlans.set(key, { ...plan, budgetId });
    incomePlanIds.push(key);
  }

  for (const section of sectionKeyList) {
    const entries = snapshot.sections[section] ?? [];
    for (const line of entries) {
      const key = toBudgetLineKey(budgetId, line.categoryId);
      state.budgetLines.set(key, {
        ...line,
        id: key,
        section,
        budgetId,
        categoryId: line.categoryId,
      });
      budgetLineIds.push(key);
    }
  }

  const previous = state.budgets.get(budgetId);
  const budget: Budget = {
    id: previous?.id ?? budgetId,
    monthKey: budgetId,
    status: previous?.status ?? "DRAFT",
    exists: snapshot.exists,
    notes: previous?.notes ?? null,
    updatedAt: new Date().toISOString(),
    incomePlanIds,
    budgetLineIds,
  };

  state.budgets.set(budgetId, budget);

  return budget;
};

const serializeSnapshot = (snapshot: BudgetSnapshot) => {
  const income = snapshot.income.map((plan) => ({
    uuid: plan.id,
    source: plan.source,
    amount: plan.amount,
  }));

  const sections: Record<BudgetSectionKey, BudgetCategoryPayload[]> = {
    expenses: [],
    recurring: [],
    savings: [],
    debt: [],
  };

  for (const section of sectionKeyList) {
    sections[section] = (snapshot.sections[section] ?? []).map((line) => ({
      uuid: line.categoryId,
      name: line.name,
      emoji: line.emoji,
      planned: line.planned ?? null,
      spent: line.spent ?? null,
      carryForward: line.carryForward,
      repeat: line.repeat,
    }));
  }

  return { income, sections };
};

export const createCacheClient = (config: CacheClientConfig): CacheActions => {
  const { stateRef, bumpVersion, createTempId } = config;

  const getState = () => stateRef.current;

  const categories = {
    refresh: async (signal?: AbortSignal) => {
      const payload = await requestJson<{ categories: CategoryApiPayload[] }>(
        "/api/categories",
        { signal }
      );

      const state = getState();
      state.categories.clear();

      for (const categoryPayload of payload.categories ?? []) {
        const mapped = mapCategoryPayload(categoryPayload);
        state.categories.set(mapped.id, mapped);
      }

      bumpVersion();

      return sortCategories(
        Array.from(state.categories.values()).map(cloneCategory)
      );
    },
    create: async (input: {
      name: string;
      emoji?: string;
      section: CategorySection;
      carryForward?: boolean;
      repeatCadence?: RepeatCadence;
    }) => {
      const state = getState();
      const tempId = createTempId();
      const optimistic: Category = {
        id: tempId,
        name: input.name,
        emoji: input.emoji ?? "✨",
        section: input.section,
        carryForwardDefault: input.carryForward ?? false,
        repeatCadenceDefault: input.repeatCadence ?? "MONTHLY",
        usage: {
          budgets: 0,
          transactions: 0,
          transactionSplits: 0,
          rules: 0,
        },
        sortOrder: state.categories.size * 10,
      };

      state.categories.set(tempId, optimistic);
      bumpVersion();

      try {
        const payload = await requestJson<{ category: CategoryApiPayload }>(
          "/api/categories",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: input.name,
              emoji: input.emoji,
              section: input.section,
              carryForward: input.carryForward,
              repeatCadence: input.repeatCadence,
            }),
          }
        );

        const category = mapCategoryPayload(payload.category);
        state.categories.delete(tempId);
        state.categories.set(category.id, category);
        bumpVersion();
        return cloneCategory(category);
      } catch (error) {
        state.categories.delete(tempId);
        bumpVersion();
        throw error;
      }
    },
    update: async (
      categoryId: string,
      input: Partial<Pick<Category, "name" | "emoji" | "section">> & {
        carryForwardDefault?: boolean;
        repeatCadenceDefault?: RepeatCadence;
      }
    ) => {
      const state = getState();
      const existing = state.categories.get(categoryId);
      if (!existing) {
        throw new Error("Category not found in cache");
      }

      const optimistic: Category = {
        ...existing,
        ...input,
        carryForwardDefault:
          input.carryForwardDefault ?? existing.carryForwardDefault,
        repeatCadenceDefault:
          input.repeatCadenceDefault ?? existing.repeatCadenceDefault,
        updatedAt: new Date().toISOString(),
      };

      state.categories.set(categoryId, optimistic);
      bumpVersion();

      try {
        const payload = await requestJson<{ category: CategoryApiPayload }>(
          `/api/categories/${categoryId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: input.name,
              emoji: input.emoji,
              section: input.section,
              carryForward: input.carryForwardDefault,
              repeatCadence: input.repeatCadenceDefault,
            }),
          }
        );

        const category = mapCategoryPayload(payload.category);
        state.categories.set(category.id, category);
        bumpVersion();
        return cloneCategory(category);
      } catch (error) {
        state.categories.set(categoryId, existing);
        bumpVersion();
        throw error;
      }
    },
    remove: async (
      categoryId: string,
      options?: {
        transactionsTargetId?: string | null;
        budgetTargetId?: string | null;
      }
    ) => {
      const state = getState();
      const existing = state.categories.get(categoryId);
      if (!existing) {
        throw new Error("Category not found in cache");
      }
      state.categories.delete(categoryId);
      bumpVersion();

      try {
        const hasOptions = Boolean(
          options &&
            ((options.transactionsTargetId ?? null) ||
              (options.budgetTargetId ?? null))
        );

        await requestJson(`/api/categories/${categoryId}`, {
          method: "DELETE",
          headers: hasOptions
            ? { "Content-Type": "application/json" }
            : undefined,
          body: hasOptions
            ? JSON.stringify({
                transactionsTargetId:
                  options?.transactionsTargetId ?? undefined,
                budgetTargetId: options?.budgetTargetId ?? undefined,
              })
            : undefined,
        });
      } catch (error) {
        state.categories.set(categoryId, existing);
        bumpVersion();
        throw error;
      }
    },
  };

  const budgetLines = {
    upsert: (line: BudgetLine) => {
      const state = getState();
      const key = toBudgetLineKey(line.budgetId, line.categoryId);
      state.budgetLines.set(key, { ...line, id: key });
      const budget = state.budgets.get(line.budgetId);
      if (budget && !budget.budgetLineIds.includes(key)) {
        budget.budgetLineIds = [...budget.budgetLineIds, key];
      }
      bumpVersion();
    },
    remove: (key: string) => {
      const state = getState();
      const line = state.budgetLines.get(key);
      if (!line) return;
      state.budgetLines.delete(key);
      const budget = state.budgets.get(line.budgetId);
      if (budget) {
        budget.budgetLineIds = budget.budgetLineIds.filter((id) => id !== key);
      }
      bumpVersion();
    },
    upsertMany: (lines: BudgetLine[]) => {
      const state = getState();
      const budgetsTouched = new Set<string>();
      for (const line of lines) {
        const key = toBudgetLineKey(line.budgetId, line.categoryId);
        state.budgetLines.set(key, { ...line, id: key });
        budgetsTouched.add(line.budgetId);
      }
      for (const budgetId of budgetsTouched) {
        const budget = state.budgets.get(budgetId);
        if (budget) {
          budget.budgetLineIds = Array.from(state.budgetLines.keys()).filter(
            (key) => key.startsWith(`${budgetId}:`)
          );
        }
      }
      bumpVersion();
    },
    removeByBudget: (budgetId: string) => {
      const state = getState();
      for (const key of Array.from(state.budgetLines.keys())) {
        if (key.startsWith(`${budgetId}:`)) {
          state.budgetLines.delete(key);
        }
      }
      const budget = state.budgets.get(budgetId);
      if (budget) {
        budget.budgetLineIds = [];
      }
      bumpVersion();
    },
  };

  const incomePlans = {
    upsert: (plan: IncomePlan) => {
      const state = getState();
      const key = toIncomePlanKey(plan.budgetId, plan.id);
      state.incomePlans.set(key, { ...plan });
      const budget = state.budgets.get(plan.budgetId);
      if (budget && !budget.incomePlanIds.includes(key)) {
        budget.incomePlanIds = [...budget.incomePlanIds, key];
      }
      bumpVersion();
    },
    remove: (key: string) => {
      const state = getState();
      const plan = state.incomePlans.get(key);
      if (!plan) return;
      state.incomePlans.delete(key);
      const budget = state.budgets.get(plan.budgetId);
      if (budget) {
        budget.incomePlanIds = budget.incomePlanIds.filter((id) => id !== key);
      }
      bumpVersion();
    },
    upsertMany: (plans: IncomePlan[]) => {
      const state = getState();
      const budgetsTouched = new Set<string>();
      for (const plan of plans) {
        const key = toIncomePlanKey(plan.budgetId, plan.id);
        state.incomePlans.set(key, { ...plan });
        budgetsTouched.add(plan.budgetId);
      }
      for (const budgetId of budgetsTouched) {
        const budget = state.budgets.get(budgetId);
        if (budget) {
          budget.incomePlanIds = Array.from(state.incomePlans.keys()).filter(
            (key) => key.startsWith(`${budgetId}:`)
          );
        }
      }
      bumpVersion();
    },
    removeByBudget: (budgetId: string) => {
      const state = getState();
      for (const key of Array.from(state.incomePlans.keys())) {
        if (key.startsWith(`${budgetId}:`)) {
          state.incomePlans.delete(key);
        }
      }
      const budget = state.budgets.get(budgetId);
      if (budget) {
        budget.incomePlanIds = [];
      }
      bumpVersion();
    },
  };

  const budgets = {
    ensure: async (monthKey: string, options?: { force?: boolean }) => {
      const state = getState();
      const hasBudget = state.budgets.has(monthKey);
      if (hasBudget && !options?.force) {
        return snapshotFromState(state, monthKey);
      }

      const payload = await requestJson<BudgetResponsePayload>(
        `/api/budgets/${monthKey}`,
        { cache: "no-store" }
      );

      const snapshot = normalizeBudgetResponse(monthKey, payload);
      applyBudgetSnapshot(state, snapshot);
      bumpVersion();
      return snapshot;
    },
    save: async (monthKey: string, snapshot: BudgetSnapshot) => {
      const state = getState();
      const previous = snapshotFromState(state, monthKey);
      applyBudgetSnapshot(state, snapshot);
      bumpVersion();

      try {
        const payload = await requestJson<BudgetResponsePayload>(
          `/api/budgets/${monthKey}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ budget: serializeSnapshot(snapshot) }),
          }
        );

        const normalized = normalizeBudgetResponse(monthKey, payload);
        applyBudgetSnapshot(state, normalized);
        bumpVersion();
        return normalized;
      } catch (error) {
        applyBudgetSnapshot(state, previous);
        bumpVersion();
        throw error;
      }
    },
    clear: (monthKey: string) => {
      const state = getState();
      state.budgets.delete(monthKey);
      for (const key of Array.from(state.budgetLines.keys())) {
        if (key.startsWith(`${monthKey}:`)) {
          state.budgetLines.delete(key);
        }
      }
      for (const key of Array.from(state.incomePlans.keys())) {
        if (key.startsWith(`${monthKey}:`)) {
          state.incomePlans.delete(key);
        }
      }
      bumpVersion();
    },
  };

  return {
    categories,
    budgets,
    budgetLines,
    incomePlans,
  };
};
