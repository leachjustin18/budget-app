"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCache, useCategoryCache } from "@budget/app/hooks/useCache";
import { monthKey } from "@budget/app/providers/CacheProvider";

type PrefetchOptions = {
  months?: Array<string | Date>;
};

const resolveMonthKey = (input: string | Date): string => {
  if (typeof input === "string") {
    return input;
  }
  return monthKey(input.getFullYear(), input.getMonth() + 1);
};

const currentMonthKey = () => {
  const now = new Date();
  return monthKey(now.getFullYear(), now.getMonth() + 1);
};

export function useAuthPrefetch(options?: PrefetchOptions) {
  const { status } = useSession();
  const { actions } = useCache();
  const { refreshCategories } = useCategoryCache();
  const hasPrefetched = useRef(false);

  const targetMonths = useMemo(() => {
    if (options?.months?.length) {
      return Array.from(
        new Set(options.months.map((value) => resolveMonthKey(value)))
      );
    }
    return [currentMonthKey()];
  }, [options?.months]);

  useEffect(() => {
    if (status !== "authenticated") {
      hasPrefetched.current = false;
      return;
    }
    if (hasPrefetched.current) return;

    const abortController = new AbortController();
    hasPrefetched.current = true;

    const prefetch = async () => {
      try {
        await refreshCategories({ signal: abortController.signal });
        await Promise.all(
          targetMonths.map((month) => actions.budgets.ensure(month))
        );
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error("Initial cache prefetch failed", error);
        hasPrefetched.current = false;
      }
    };

    void prefetch();

    return () => {
      abortController.abort();
    };
  }, [actions, refreshCategories, status, targetMonths]);
}
