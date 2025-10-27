"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createCacheClient } from "@budget/lib/cache/client";
import type {
  CacheActions,
  CacheState,
  Category,
  CategorySection,
} from "@budget/lib/cache/types";
import { createCacheStore } from "@budget/lib/cache/store";
import type { CacheEntry, CacheStore } from "@budget/lib/cache/store";
import type { CacheDispatcher } from "@budget/lib/cache/types";
import type { CacheKey } from "@budget/lib/cache/keys";

export type {
  Budget,
  BudgetLine,
  BudgetSectionKey,
  BudgetSnapshot,
  BudgetStatus,
  CacheActions,
  CacheState,
  Category,
  CategorySection,
  IncomePlan,
  RepeatCadence,
} from "@budget/lib/cache/types";

export type CategoryCacheValue = {
  categoriesById: ReadonlyMap<string, Category>;
  categoriesList: Category[];
  refreshCategories: (options?: {
    signal?: AbortSignal;
    force?: boolean;
  }) => Promise<void>;
  hasHydrated: boolean;
  isRefreshing: boolean;
};

export type CacheContextValue = {
  stateRef: MutableRefObject<CacheState>;
  version: number;
  actions: CacheActions;
  categories: CategoryCacheValue;
  storeRef: MutableRefObject<CacheStore>;
  dispatch: CacheDispatcher;
};

type CacheProviderProps = {
  children: ReactNode;
  initialEntries?: ReadonlyArray<CacheEntry>;
};

const createInitialState = (): CacheState => ({
  categories: new Map(),
  budgets: new Map(),
  budgetLines: new Map(),
  incomePlans: new Map(),
});

export const CacheContext = createContext<CacheContextValue | null>(null);

export const monthKey = (year: number, month: number) => {
  const safeMonth = Math.min(Math.max(month, 1), 12);
  return `${year.toString().padStart(4, "0")}-${safeMonth
    .toString()
    .padStart(2, "0")}`;
};

const createTempId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `tmp_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

const categorySectionPriority: Record<CategorySection, number> = {
  EXPENSES: 0,
  RECURRING: 1,
  SAVINGS: 2,
  DEBT: 3,
};

const cloneCategory = (category: Category): Category => ({ ...category });

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

export function CacheProvider({
  children,
  initialEntries,
}: CacheProviderProps) {
  const stateRef = useRef<CacheState>(createInitialState());
  const storeRef = useRef<CacheStore>(createCacheStore(initialEntries));
  const inflightRef = useRef<Map<CacheKey, Promise<unknown>>>(new Map());

  const [version, setVersion] = useState(0);
  const [categoryStatus, setCategoryStatus] = useState(() => ({
    hasHydratedCategories: false,
    isRefreshingCategories: false,
  }));
  const latestRefreshPromise = useRef<Promise<void> | null>(null);

  const incrementVersion = useCallback(() => {
    setVersion((previous) => (previous + 1) % Number.MAX_SAFE_INTEGER);
  }, []);

  const actions = useMemo(
    () =>
      createCacheClient({
        stateRef,
        bumpVersion: incrementVersion,
        createTempId,
      }),
    [incrementVersion]
  );

  const refreshCategories = useCallback(
    async (options?: { signal?: AbortSignal; force?: boolean }) => {
      if (latestRefreshPromise.current && !options?.force) {
        await latestRefreshPromise.current;
        return;
      }

      const run = (async () => {
        setCategoryStatus((previous) => ({
          ...previous,
          isRefreshingCategories: true,
        }));

        try {
          await actions.categories.refresh(options?.signal);
          setCategoryStatus({
            hasHydratedCategories: true,
            isRefreshingCategories: false,
          });
        } catch (error) {
          if (options?.signal?.aborted) {
            setCategoryStatus((previous) => ({
              ...previous,
              isRefreshingCategories: false,
            }));
            return;
          }

          setCategoryStatus((previous) => ({
            ...previous,
            isRefreshingCategories: false,
          }));
          throw error;
        } finally {
          latestRefreshPromise.current = null;
        }
      })();

      latestRefreshPromise.current = run;
      await run;
    },
    [actions.categories]
  );

  const categoriesById = useMemo<ReadonlyMap<string, Category>>(() => {
    void version;
    return new Map(stateRef.current.categories);
  }, [version]);

  const categoriesList = useMemo<Category[]>(() => {
    void version;
    const snapshot = stateRef.current;
    const values = Array.from(snapshot.categories.values()).map(cloneCategory);
    return sortCategories(values);
  }, [version]);

  const categoriesValue = useMemo<CategoryCacheValue>(
    () => ({
      categoriesById,
      categoriesList,
      refreshCategories,
      hasHydrated: categoryStatus.hasHydratedCategories,
      isRefreshing: categoryStatus.isRefreshingCategories,
    }),
    [
      categoriesById,
      categoriesList,
      categoryStatus.hasHydratedCategories,
      categoryStatus.isRefreshingCategories,
      refreshCategories,
    ]
  );

  const dispatch = useMemo<CacheDispatcher>(() => {
    // get<T>
    const get: CacheDispatcher["get"] = <T,>(key: CacheKey): T | undefined => {
      return storeRef.current.get(key) as T | undefined;
    };

    // set<T>
    const set: CacheDispatcher["set"] = <T,>(key: CacheKey, value: T): T => {
      storeRef.current.set(key, value as unknown);
      incrementVersion();
      return value;
    };

    // delete
    const remove: CacheDispatcher["delete"] = (key: CacheKey) => {
      if (!storeRef.current.has(key)) return;
      storeRef.current.delete(key);
      incrementVersion();
    };

    // mutate<T>
    const mutate: CacheDispatcher["mutate"] = <T,>(
      key: CacheKey,
      updater: (current: T | undefined) => T | undefined
    ): T | undefined => {
      const current = storeRef.current.get(key) as T | undefined;
      const next = updater(current);
      if (typeof next === "undefined") {
        storeRef.current.delete(key);
      } else {
        storeRef.current.set(key, next as unknown);
      }
      incrementVersion();
      return next;
    };

    // prefetch<T>
    const prefetch: CacheDispatcher["prefetch"] = async <T,>(
      key: CacheKey,
      loader: () => Promise<T>
    ): Promise<T> => {
      // If we already have a cached value, return it as a resolved Promise<T>
      if (storeRef.current.has(key)) {
        return Promise.resolve(storeRef.current.get(key) as T);
      }

      // Coalesce concurrent loads for the same key
      const existing = inflightRef.current.get(key);
      if (existing) {
        return existing as Promise<T>;
      }

      const task: Promise<T> = loader()
        .then((value) => {
          storeRef.current.set(key, value as unknown);
          inflightRef.current.delete(key);
          incrementVersion();
          return value;
        })
        .catch((error) => {
          inflightRef.current.delete(key);
          throw error;
        });

      inflightRef.current.set(key, task as Promise<unknown>);
      return task;
    };

    return {
      get,
      set,
      delete: remove,
      mutate,
      prefetch,
    };
  }, [incrementVersion]);

  const value = useMemo<CacheContextValue>(
    () => ({
      stateRef,
      version,
      actions,
      categories: categoriesValue,
      storeRef,
      dispatch,
    }),
    [actions, categoriesValue, dispatch, version]
  );

  return (
    <CacheContext.Provider value={value}>{children}</CacheContext.Provider>
  );
}
