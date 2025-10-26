import type { CacheKey } from "./keys";

export type CacheEntry = readonly [CacheKey, unknown];

export type CacheStore = Map<CacheKey, unknown>;

export const createCacheStore = (
  entries?: Iterable<CacheEntry> | null | undefined
): CacheStore => {
  if (!entries) {
    return new Map();
  }

  return new Map(entries);
};

export const serializeCacheStore = (store: CacheStore): CacheEntry[] =>
  Array.from(store.entries());
