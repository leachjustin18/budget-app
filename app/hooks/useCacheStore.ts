"use client";

import { useCallback, useContext, useMemo } from "react";
import { CacheContext } from "@budget/app/providers/CacheProvider";
import type { CacheKey } from "@budget/lib/cache/keys";
import type { CacheDispatcher } from "@budget/lib/cache/types";
import type { CacheStore } from "@budget/lib/cache/store";

type CacheStoreHandle = {
  version: number;
  store: CacheStore;
  dispatch: CacheDispatcher;
};

const useCacheContext = (): CacheStoreHandle => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error("Cache hooks must be used within a CacheProvider");
  }

  return {
    version: context.version,
    store: context.storeRef.current,
    dispatch: context.dispatch,
  };
};

export const useCacheStore = () => {
  const { version, dispatch } = useCacheContext();

  const get = useCallback(
    <T,>(key: CacheKey): T | undefined => {
      void version;
      return dispatch.get<T>(key);
    },
    [dispatch, version]
  );

  return {
    version,
    get,
    set: dispatch.set,
    mutate: dispatch.mutate,
    delete: dispatch.delete,
    prefetch: dispatch.prefetch,
  };
};

export const useCacheValue = <T,>(key: CacheKey): T | undefined => {
  const { store, version } = useCacheContext();

  return useMemo(() => {
    void version;
    return store.get(key) as T | undefined;
  }, [key, store, version]);
};
