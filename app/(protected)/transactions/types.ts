import type { CategorySection } from "@budget/app/providers/CacheProvider";

export type TransactionType = "EXPENSE" | "INCOME" | "TRANSFER";

export type TransactionOrigin = "MANUAL" | "IMPORT" | "ADJUSTMENT";

export type CategoryOption = {
  id: string;
  name: string;
  emoji: string;
  section: CategorySection;
  carryForwardDefault?: boolean;
  repeatCadenceDefault?: "MONTHLY" | "ONCE";
  usage?: {
    budgets: number;
    transactions: number;
    transactionSplits: number;
    rules: number;
  };
};

export type BudgetSnapshot = Record<
  string,
  {
    planned: number;
    spent: number;
  }
>;

export type SplitState = {
  id: string;
  categoryId: string;
  amount: string;
  memo: string;
};

export type TransactionFormState = {
  occurredOn: string;

  merchant: string;
  description: string;
  memo: string;
  amount: string;
  type: TransactionType;
  splits: SplitState[];
};

export type TransactionFormSubmitPayload = {
  occurredOn: string;

  merchant: string;
  description: string;
  memo?: string;
  amount: number;
  type: TransactionType;
  splits: Array<{
    categoryId: string;
    amount: number;
    memo?: string;
  }>;
};

export type ApiSplit = {
  id: string;
  amount: number;
  memo: string;
  category: CategoryOption | null;
};

export type MerchantSummary = {
  id: string;
  canonicalName: string;
  yelpId?: string | null;
};

export type ApiTransaction = {
  id: string;
  occurredOn: string;

  amount: number;
  type: TransactionType;
  origin: TransactionOrigin;
  description: string;
  merchantName: string;
  merchantId: string | null;
  merchant: MerchantSummary | null;
  merchantRaw?: string;
  merchantNormalizedKey?: string;
  merchantNeedsReview?: boolean;
  memo: string;
  categoryId: string | null;
  importBatchId: string | null;
  isPending: boolean;
  budgetId: string | null;
  splits: ApiSplit[];
};
