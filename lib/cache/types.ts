import type { MutableRefObject } from "react";
import type { CacheKey } from "./keys";

export type CacheGetter = <T>(key: CacheKey) => T | undefined;
export type CacheSetter = <T>(key: CacheKey, value: T) => T;
export type CacheDeleter = (key: CacheKey) => void;
export type CacheMutator = <T>(
  key: CacheKey,
  updater: (current: T | undefined) => T | undefined
) => T | undefined;
export type CachePrefetcher = <T>(
  key: CacheKey,
  loader: () => Promise<T>
) => Promise<T>;

export type CacheDispatcher = {
  get: CacheGetter;
  set: CacheSetter;
  delete: CacheDeleter;
  mutate: CacheMutator;
  prefetch: CachePrefetcher;
};

export type CategorySection = "EXPENSES" | "RECURRING" | "SAVINGS" | "DEBT";

export type RepeatCadence = "MONTHLY" | "ONCE";

export type BudgetSectionKey = "expenses" | "recurring" | "savings" | "debt";

export type BudgetStatus = "DRAFT" | "FINALIZED";

export type Category = {
  id: string;
  name: string;
  emoji: string;
  section: CategorySection;
  carryForwardDefault: boolean;
  repeatCadenceDefault: RepeatCadence;
  sortOrder?: number;
  usage: {
    budgets: number;
    transactions: number;
    transactionSplits: number;
    rules: number;
  };
  updatedAt?: string;
};

export type IncomePlan = {
  id: string;
  budgetId: string;
  source: string;
  amount: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type BudgetLine = {
  id: string;
  budgetId: string;
  categoryId: string;
  section: BudgetSectionKey;
  name: string;
  emoji: string;
  planned: number | null;
  spent: number | null;
  carryForward: boolean;
  repeat: "monthly" | "once";
  notes?: string | null;
};

export type Budget = {
  id: string;
  monthKey: string;
  status: BudgetStatus;
  exists: boolean;
  notes?: string | null;
  updatedAt?: string;
  incomePlanIds: string[];
  budgetLineIds: string[];
};

export type BudgetSnapshot = {
  monthKey: string;
  exists: boolean;
  income: IncomePlan[];
  sections: Record<BudgetSectionKey, BudgetLine[]>;
};

export type CacheState = {
  categories: Map<string, Category>;
  budgets: Map<string, Budget>;
  budgetLines: Map<string, BudgetLine>;
  incomePlans: Map<string, IncomePlan>;
};

export type CacheActions = {
  categories: {
    refresh(signal?: AbortSignal): Promise<Category[]>;
    create(input: {
      name: string;
      emoji?: string;
      section: CategorySection;
      carryForward?: boolean;
      repeatCadence?: RepeatCadence;
    }): Promise<Category>;
    update(
      categoryId: string,
      input: Partial<Pick<Category, "name" | "emoji" | "section">> & {
        carryForwardDefault?: boolean;
        repeatCadenceDefault?: RepeatCadence;
      }
    ): Promise<Category>;
    remove(
      categoryId: string,
      options?: {
        transactionsTargetId?: string | null;
        budgetTargetId?: string | null;
      }
    ): Promise<void>;
  };
  budgets: {
    ensure(
      monthKey: string,
      options?: { force?: boolean }
    ): Promise<BudgetSnapshot>;
    save(monthKey: string, snapshot: BudgetSnapshot): Promise<BudgetSnapshot>;
    clear(monthKey: string): void;
  };
  budgetLines: {
    upsert(line: BudgetLine): void;
    remove(key: string): void;
    upsertMany(lines: BudgetLine[]): void;
    removeByBudget(budgetId: string): void;
  };
  incomePlans: {
    upsert(plan: IncomePlan): void;
    remove(key: string): void;
    upsertMany(plans: IncomePlan[]): void;
    removeByBudget(budgetId: string): void;
  };
};

export type CacheClientConfig = {
  stateRef: MutableRefObject<CacheState>;
  bumpVersion: () => void;
  createTempId: () => string;
};
