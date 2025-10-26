import "server-only";

import { cacheKeys } from "@budget/lib/cache/keys";
import type { CacheEntry } from "@budget/lib/cache/store";
import { getDashboardData } from "@budget/app/(protected)/dashboard/data";

export type BuildInitialCacheOptions = {
  includeDashboard?: boolean;
};

export const buildInitialCache = async (
  options?: BuildInitialCacheOptions
): Promise<CacheEntry[]> => {
  const entries: CacheEntry[] = [];

  if (options?.includeDashboard ?? true) {
    const dashboard = await getDashboardData();
    entries.push([cacheKeys.dashboard(), dashboard]);
  }

  return entries;
};
