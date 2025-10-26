"use client";

import { useCacheValue } from "@budget/app/hooks/useCacheStore";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";
import { cacheKeys } from "@budget/lib/cache/keys";

export const useDashboardData = (): DashboardData => {
  const data = useCacheValue<DashboardData>(cacheKeys.dashboard());

  if (!data) {
    throw new Error("Dashboard data is not available in cache");
  }

  return data;
};
