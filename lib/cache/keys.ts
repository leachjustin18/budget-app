export const cacheKeys = {
  categories: () => "categories" as const,
  dashboard: () => "dashboard" as const,
  merchants: () => "merchants" as const,
  budget: (monthKey: string) => `budget:${monthKey}` as const,
  transactions: (monthKey: string) => `transactions:${monthKey}` as const,
  rules: () => "rules" as const,
};

export type CacheKey =
  | ReturnType<typeof cacheKeys.categories>
  | ReturnType<typeof cacheKeys.dashboard>
  | ReturnType<typeof cacheKeys.merchants>
  | ReturnType<typeof cacheKeys.budget>
  | ReturnType<typeof cacheKeys.transactions>
  | ReturnType<typeof cacheKeys.rules>;

export const isBudgetKey = (
  key: CacheKey
): key is ReturnType<typeof cacheKeys.budget> => key.startsWith("budget:");

export const isTransactionsKey = (
  key: CacheKey
): key is ReturnType<typeof cacheKeys.transactions> =>
  key.startsWith("transactions:");

export const extractBudgetMonth = (key: CacheKey) =>
  isBudgetKey(key) ? key.slice("budget:".length) : null;

export const extractTransactionsMonth = (key: CacheKey) =>
  isTransactionsKey(key) ? key.slice("transactions:".length) : null;
