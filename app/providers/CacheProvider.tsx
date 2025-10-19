"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createCacheClient } from "@budget/app/lib/api/cacheClient";
import type {
  CacheActions,
  CacheState,
} from "@budget/app/providers/cacheTypes";
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
} from "@budget/app/providers/cacheTypes";

export type CacheContextValue = {
  stateRef: RefObject<CacheState>;
  version: number;
  actions: CacheActions;
};

const initialState: CacheState = {
  categories: new Map(),
  budgets: new Map(),
  budgetLines: new Map(),
  incomePlans: new Map(),
};

export const CacheContext = createContext<CacheContextValue | null>(null);

const createStateRef = (): RefObject<CacheState> => {
  const state = {
    categories: new Map(initialState.categories),
    budgets: new Map(initialState.budgets),
    budgetLines: new Map(initialState.budgetLines),
    incomePlans: new Map(initialState.incomePlans),
  };
  return { current: state };
};

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

export function CacheProvider({ children }: { children: React.ReactNode }) {
  const stateRef = useRef<CacheState>();
  if (!stateRef.current) {
    stateRef.current = createStateRef().current;
  }

  const [{ version }, bumpVersion] = useState(() => ({ version: 0 }));

  const incrementVersion = useCallback(() => {
    bumpVersion((previous) => ({
      version: (previous.version + 1) % Number.MAX_SAFE_INTEGER,
    }));
  }, []);

  const actions = useMemo(
    () =>
      createCacheClient({
        stateRef: stateRef as RefObject<CacheState>,
        bumpVersion: incrementVersion,
        createTempId,
      }),
    [incrementVersion]
  );

  const value = useMemo<CacheContextValue>(
    () => ({
      stateRef: stateRef as RefObject<CacheState>,
      version,
      actions,
    }),
    [actions, version]
  );

  return (
    <CacheContext.Provider value={value}>{children}</CacheContext.Provider>
  );
}
